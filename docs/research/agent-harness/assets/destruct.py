#!/usr/bin/env python3
"""destruct.py — memory_lab 五项破坏性实验（每次只拆一个机制，实测退化）

运行（仓库根）：uv run --no-project python docs/research/agent-harness/assets/destruct.py
输出：逐实验三件套（改了什么 / 实测观察到什么 / 教训一句话）
"""

from __future__ import annotations

import copy
import shutil
import sys
import tempfile
from pathlib import Path

from memory_lab import (Compactor, MemoryStore, CONTEXT_CHAR_LIMIT, MAX_MESSAGES,
                        estimate_chars, make_pair, validate_pairs, big_content)


def header(title: str) -> None:
    print(f"\n{'=' * 62}\n{title}\n{'=' * 62}")


def experiment1(root: Path) -> None:
    """拆掉 snip 切点回退（配对保护）→ 孤立 tool_result → mock API 校验失败。"""
    header("实验 1：拆掉切点回退（配对保护）")

    class NoRetreatCompactor(Compactor):
        def snip_compact(self, messages):
            # 改动：删掉两处配对回退（每次一两行的「跳过校验」式拆除）
            if len(messages) <= MAX_MESSAGES:
                return messages
            head_end, tail_start = 3, len(messages) - (MAX_MESSAGES - 3 - 1)
            if head_end >= tail_start:
                return messages
            transcript = self.write_transcript(messages)
            marker = {"role": "user", "content":
                      f"[{tail_start - head_end} messages archived at {transcript}]"}
            return [*messages[:head_end], marker, *messages[tail_start:]]

    comp = NoRetreatCompactor(root)
    msgs = [{"role": "user", "content": "q"}, {"role": "user", "content": "ctx"}]
    call0, result0 = make_pair(0)
    msgs += [call0, result0]                       # messages[2]=call0，切点正好压在配对上
    for i in range(1, 29):
        msgs += make_pair(i)

    intact = Compactor(root).snip_compact(copy.deepcopy(msgs))
    broken = comp.snip_compact(copy.deepcopy(msgs))
    orphans = validate_pairs(broken)
    print(f"改了什么：snip_compact 不再检查切点是否落在调用/结果之间（删 6 行回退逻辑）")
    print(f"实测：保护版裁后孤立结果数 = {len(validate_pairs(intact))}（0 个，请求合法）")
    print(f"      拆除版裁后孤立结果数 = {len(orphans)}（{orphans[:3]}...，mock API 校验失败）")
    print(f"教训：裁掉一条调用、留下一条结果，下一个请求整体非法——配对保护是 API 硬约束，不是优化。")


def experiment2(root: Path) -> None:
    """拆掉 micro「替换前先落盘」→ 旧大结果从上下文与磁盘同时消失。"""
    header("实验 2：拆掉 micro 的「替换前落盘」")

    class NoSaveCompactor(Compactor):
        def micro_compact(self, messages):
            # 改动：替换占位不再先写磁盘（站点 s08 早期形态：Re-run if needed）
            target = int(CONTEXT_CHAR_LIMIT * 0.8)
            results = list(self._all_tool_result_blocks(messages))
            unseen = self._unseen_positions(messages)
            consumed = [e for e in results if e[:2] not in unseen]
            for _, _, block in consumed[:-3]:
                if estimate_chars(messages) <= target:
                    break
                content = str(block.get("content", ""))
                if len(content) <= 120:
                    continue
                block["content"] = "[Earlier tool result compacted. Re-run if needed.]"
            return messages

    comp = NoSaveCompactor(root)
    msgs = [{"role": "user", "content": "q"}]
    for i in range(8):
        msgs += make_pair(i, result_len=8_000)
    msgs.append({"role": "assistant", "content": [{"type": "text", "text": "done"}]})

    good = Compactor(root).micro_compact(copy.deepcopy(msgs))
    bad = comp.micro_compact(copy.deepcopy(msgs))
    disks = list((root / ".task_outputs" / "tool-results").glob("tu*.txt"))
    lost = sum(1 for m in bad if isinstance(m.get("content"), list)
               for b in m["content"] if isinstance(b, dict)
               and str(b.get("content", "")).startswith("[Earlier tool result compacted"))
    recovered = sum(1 for m in good if isinstance(m.get("content"), list)
                    for b in m["content"] if isinstance(b, dict)
                    and str(b.get("content", "")).startswith("[Earlier tool result saved"))
    print(f"改了什么：micro 替换占位符前不再 save_output（一条分支）")
    print(f"实测：保护版 {recovered} 条旧结果带磁盘路径可取回；磁盘档案 {len(disks)} 个")
    print(f"      拆除版 {lost} 条旧结果只剩「需要就重跑」，内容在上下文与磁盘都不存在")
    print(f"教训：占位符的价值=「取件地址」，替换前落盘是可恢复性的全部——先归档，再腾地方。")


def experiment3(root: Path) -> None:
    """拆掉 unseen 保护 → 模型还没读到的新结果被压掉。"""
    header("实验 3：拆掉 unseen 保护")

    class NoUnseenCompactor(Compactor):
        def _unseen_positions(self, messages):  # 改动：视为全部已读
            return set()

    comp = NoUnseenCompactor(root)
    msgs = [{"role": "user", "content": "q"}]
    for i in range(6):
        msgs += make_pair(i, result_len=9_000)
    # 真实 API 批形态：一次响应发起 5 个调用（同一条 assistant 消息），
    # 执行完的 5 个结果合在同一条 user 消息——模型尚未读到（下一次调用才读）
    calls = [{"type": "tool_use", "id": f"tu{j}", "name": "search",
              "input": {"q": f"topic{j}"}} for j in range(95, 100)]
    results = [{"type": "tool_result", "tool_use_id": f"tu{j}",
                "content": big_content(9_000, f"hit{j}")} for j in range(95, 100)]
    msgs.append({"role": "assistant", "content": calls})
    msgs.append({"role": "user", "content": results})
    assert estimate_chars(msgs) > CONTEXT_CHAR_LIMIT

    good = Compactor(root).micro_compact(copy.deepcopy(msgs))
    bad = comp.micro_compact(copy.deepcopy(msgs))

    def result_len_of(out, tid):
        return len(str(next(b for m in out if isinstance(m.get("content"), list)
                            for b in m["content"] if isinstance(b, dict)
                            and b.get("tool_use_id") == tid)["content"]))

    print(f"改了什么：_unseen_positions 恒返回空集（模型「没读过」不再是保护条件）")
    for tid in ("tu95", "tu99"):
        print(f"实测：{tid}（刚返回未读的检索，9,000 字符）保护版压缩后长度 = {result_len_of(good, tid)}")
        print(f"      拆除版压缩后长度 = {result_len_of(bad, tid)}"
              f"（{'原样保留' if result_len_of(bad, tid) >= 9000 else '被换成一行地址，模型读不到这次检索的发现'}）")
    print(f"教训：压缩发生在「下一次调用之前」、阅读发生在「下一次调用之时」——没读过的东西压掉=白干。")


def experiment4(root: Path) -> None:
    """拆掉 scope/临时词门 → 临时指令成为跨会话持久规则。"""
    header("实验 4：拆掉 scope 门与临时词门")

    class NoGatesStore(MemoryStore):
        def should_store(self, cand, existing):   # 改动：全放行
            return True

    store = NoGatesStore(root)
    protected = MemoryStore(root)
    dialogue = ("user: just for this session use the staging database\n"
                "user: this is a current task note\n"
                "user: I prefer tabs. Remember that.\n")
    protected.extract_memories(dialogue)
    names_p = sorted(m["name"] for m in protected.list_memories())
    store.extract_memories(dialogue)
    names_b = sorted(m["name"] for m in store.list_memories())
    leaked = [n for n in names_b if n.startswith(("tmp-", "task-"))]
    print(f"改了什么：should_store 恒真（scope 审查、临时词黑名单、查重全部失效）")
    print(f"实测：保护版入库 = {names_p}（只剩持久偏好）")
    print(f"      拆除版入库 = {names_b}")
    print(f"      其中 {leaked} 是「本次/当前任务」级临时指令——下次会话它们会替用户做主")
    print(f"教训：记忆系统的死法不是记不住，而是记错——写入端的门决定它是资产还是负债。")


def experiment5(root: Path) -> None:
    """拆掉整理的快照恢复 → 合并失败后记忆库被清空。"""
    header("实验 5：拆掉整理的快照恢复")

    class NoRestoreStore(MemoryStore):
        def consolidate(self, fail: bool = False) -> int:
            records = self.list_memories()
            if len(records) < 10:
                return 0
            merged = self.llm.consolidate_records(records)
            for path in self.dir.glob("*.md"):     # 改动：先删全部
                if path.name != "MEMORY.md":
                    path.unlink()
            if fail:                               # 写盘阶段失败，且无恢复
                raise OSError("injected consolidation failure")
            for r in merged:
                (self.dir / f"{r['name'].lower().replace(' ', '-')}.md").write_text(
                    f"---\nname: {r['name']}\ntype: {r['type']}\n---\n\n{r['body']}\n",
                    encoding="utf-8")
            self.rebuild_index()
            return len(merged)

    root2 = Path(tempfile.mkdtemp(prefix="memory-lab-x5-"))
    try:
        store = NoRestoreStore(root2)
        for i in range(10):
            store.write_memory(f"note-{i}", "reference", f"note {i}", f"body {i}")
        n0 = len(store.list_memories())
        try:
            store.consolidate(fail=True)
        except OSError:
            pass
        n1 = len(store.list_memories())
        print(f"改了什么：删掉「快照 → 失败恢复」的 try/except（整段）")
        print(f"实测：整理前记忆 {n0} 条；合并写盘中途失败后剩 {n1} 条"
              f"（{'清空' if n1 == 0 else '部分丢失'}，不可恢复）")
        print(f"教训：批量改写持久存储必须是事务——先快照、后改写、失败回滚，缺一步就把资产变空箱。")
    finally:
        shutil.rmtree(root2, ignore_errors=True)


def main() -> int:
    for fn in (experiment1, experiment2, experiment3, experiment4, experiment5):
        root = Path(tempfile.mkdtemp(prefix="memory-lab-x-"))  # 每实验独立 root，杜绝磁盘串台
        try:
            fn(root)
        finally:
            shutil.rmtree(root, ignore_errors=True)
    print("\nDESTRUCT DONE ✔（5 项实验全部完成）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
