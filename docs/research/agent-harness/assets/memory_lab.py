#!/usr/bin/env python3
"""memory_lab.py — Learn Claude Code 记忆管理（s08+s09）机制最小原型（clean-room，纯标准库）

验证机制逻辑是否自洽，不验证模型能力：材料里的 LLM 角色（摘要、记忆选择、
记忆提取、整理）全部用确定性 mock 或脚本化序列替代。

机制清单（对应材料 s08/s09 @ ce8f9f18）：
  s08 四层压缩 + 应急：
    L_budget  tool_result_budget  最后一批 tool_result 总量超预算 → 最大者先落盘
    L_snip    snip_compact        消息数超上限 → 裁中段、保配对、写 transcript、幂等
    L_micro   micro_compact       上下文超限 → 已读旧结果换地址（保最近 3、unseen 不动）
    L_compact compact_history     仍超限 → mock 摘要替换全部历史（active_request 分离）
    reactive  reactive_compact    mock API 拒绝 → 摘要 + 保留尾部（配对保护）
  s09 记忆四环节：
    store     write_memory_file + rebuild_index（frontmatter + MEMORY.md）
    recall    select_relevant_memories（mock side-query，失败降级关键词）+ load_memories
    extract   extract_memories（scope 门 / 临时词门 / 三重查重门）
    consolidate ≥10 条 → mock 合并，快照 → 改写 → 失败恢复

运行（仓库根）：uv run --no-project python docs/research/agent-harness/assets/memory_lab.py --selftest
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import tempfile
import uuid
from pathlib import Path

# ---------------- Mock LLM（确定性，无网络） ----------------


class MockLLM:
    """脚本化 LLM：摘要/选择/提取/合并都是确定性的文本变换。"""

    calls = 0

    @classmethod
    def summarize(cls, messages: list[dict]) -> str:
        cls.calls += 1
        # 确定性「摘要」：每条消息取首 24 字符拼接，模拟有损压缩
        parts = []
        for m in messages:
            text = _message_text(m)[:24]
            parts.append(f"{m['role']}:{text}")
        return " | ".join(parts) or "(empty)"

    @classmethod
    def select_indices(cls, query: str, catalog_names: list[str]) -> list[int]:
        cls.calls += 1
        # 确定性「相关性选择」：目录名中的词出现在查询里即选中
        words = set(re.findall(r"[a-z0-9_]{3,}|[一-鿿]{2,}", query.lower()))
        out = []
        for i, name in enumerate(catalog_names):
            if any(w in name.lower() for w in words):
                out.append(i)
        return out[:5]

    @classmethod
    def extract_candidates(cls, dialogue: str) -> list[dict]:
        cls.calls += 1
        # 脚本化「提取」：识别 prefer/记住 句式；故意产出会被各门拦截的候选
        cands: list[dict] = []
        for line in dialogue.splitlines():
            low = line.lower()
            if "prefer" in low or "记住" in low or "prefer" in line:
                cands.append({
                    "name": f"pref-{len(cands)}",
                    "type": "user",
                    "scope": "persistent",
                    "description": line.strip()[:40],
                    "body": line.strip(),
                })
            if "today only" in low or "本次" in line or "this session" in low:
                cands.append({
                    "name": f"tmp-{len(cands)}",
                    "type": "project",
                    "scope": "persistent",
                    "description": line.strip()[:40],
                    "body": line.strip(),
                })
            if "current task" in low:
                cands.append({
                    "name": f"task-{len(cands)}",
                    "type": "project",
                    "scope": "current_task",
                    "description": line.strip()[:40],
                    "body": line.strip(),
                })
        return cands

    @classmethod
    def consolidate_records(cls, records: list[dict]) -> list[dict]:
        cls.calls += 1
        # 确定性「整理」：按 name 去重保留 description 最长者
        best: dict[str, dict] = {}
        for r in records:
            k = r["name"].split("-")[0]
            if k not in best or len(r["description"]) > len(best[k]["description"]):
                best[k] = r
        return list(best.values())[:30]


def _message_text(message: dict) -> str:
    c = message.get("content", "")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        out = []
        for b in c:
            if isinstance(b, dict):
                if b.get("type") == "text":
                    out.append(str(b.get("text", "")))
                elif b.get("type") == "tool_result":
                    out.append(str(b.get("content", "")))
        return "\n".join(out)
    return ""


# ---------------- s08：四层压缩 + 应急 ----------------

CONTEXT_CHAR_LIMIT = 50_000          # 材料教学值：触发上限（字符估算）
TOOL_RESULT_BATCH_CHAR_LIMIT = 200_000  # 单批 tool_result 总预算
LARGE_RESULT_CHAR_LIMIT = 30_000     # 单条超过才落盘
KEEP_RECENT_RESULTS = 3              # micro 保留最近几条完整结果
KEEP_RECENT_MESSAGES = 5             # reactive 尾部保留条数
MAX_MESSAGES = 50                    # snip 上限
MICRO_REPLACE_MIN = 120              # 短于它的旧结果不替换
MICRO_TARGET_RATIO = 0.8             # micro 目标压到阈值的 80%


def estimate_chars(messages: list[dict]) -> int:
    return len(json.dumps(messages, default=str, ensure_ascii=False))


def has_tool_use(message: dict) -> bool:
    c = message.get("content")
    return (message.get("role") == "assistant" and isinstance(c, list)
            and any(isinstance(b, dict) and b.get("type") == "tool_use" for b in c))


def is_tool_result(message: dict) -> bool:
    c = message.get("content")
    return (message.get("role") == "user" and isinstance(c, list)
            and any(isinstance(b, dict) and b.get("type") == "tool_result" for b in c))


def validate_pairs(messages: list[dict]) -> list[int]:
    """mock API 校验：返回配对断裂的消息下标（空列表 = 请求合法）。

    双向：tool_result 无对应 tool_use（孤立结果）、tool_use 无对应
    tool_result（孤立调用）都会被 API 拒绝。
    """
    calls: set[str] = set()
    results: set[str] = set()
    for m in messages:
        c = m.get("content")
        if not isinstance(c, list):
            continue
        for b in c:
            if isinstance(b, dict):
                if b.get("type") == "tool_use":
                    calls.add(str(b.get("id", "")))
                elif b.get("type") == "tool_result":
                    results.add(str(b.get("tool_use_id", "")))
    broken = []
    for i, m in enumerate(messages):
        c = m.get("content")
        if not isinstance(c, list):
            continue
        for b in c:
            if not isinstance(b, dict):
                continue
            if b.get("type") == "tool_result" and str(b.get("tool_use_id", "")) not in calls:
                broken.append(i)
            elif b.get("type") == "tool_use" and str(b.get("id", "")) not in results:
                broken.append(i)
    return broken


class Compactor:
    def __init__(self, root: Path, llm=MockLLM):
        self.root = root
        self.transcript_dir = root / ".transcripts"
        self.outputs_dir = root / ".task_outputs" / "tool-results"
        self.llm = llm

    # -- 落盘 --
    def persist(self, tool_use_id: str, content: str, preview: int = 2000) -> str:
        self.outputs_dir.mkdir(parents=True, exist_ok=True)
        safe = re.sub(r"[^A-Za-z0-9._-]", "_", str(tool_use_id))[:120] or "unknown"
        path = self.outputs_dir / f"{safe}.txt"
        path.write_text(content, encoding="utf-8")
        return (f"<persisted-output>\nFull output: {path}\nPreview:\n"
                f"{content[:preview]}\n</persisted-output>")

    def write_transcript(self, messages: list[dict]) -> Path:
        self.transcript_dir.mkdir(parents=True, exist_ok=True)
        path = self.transcript_dir / f"transcript_{uuid.uuid4().hex[:8]}.jsonl"
        with path.open("w", encoding="utf-8") as f:
            for m in messages:
                f.write(json.dumps(m, default=str, ensure_ascii=False) + "\n")
        return path

    # -- L_budget --
    def tool_result_budget(self, messages: list[dict]) -> list[dict]:
        if not messages:
            return messages
        last = messages[-1]
        c = last.get("content")
        if last.get("role") != "user" or not isinstance(c, list):
            return messages
        blocks = [b for b in c if isinstance(b, dict) and b.get("type") == "tool_result"]
        total = sum(len(str(b.get("content", ""))) for b in blocks)
        for b in sorted(blocks, key=lambda x: len(str(x.get("content", ""))), reverse=True):
            if total <= TOOL_RESULT_BATCH_CHAR_LIMIT:
                break
            content = str(b.get("content", ""))
            if len(content) <= LARGE_RESULT_CHAR_LIMIT:
                continue  # 教学版：小结果不落盘
            b["content"] = self.persist(b.get("tool_use_id", "unknown"), content)
            total = sum(len(str(x.get("content", ""))) for x in blocks)
        return messages

    # -- L_snip --
    _ARCHIVE_RE = re.compile(r"\[\d+ messages archived at (.+)\]")

    def snip_compact(self, messages: list[dict]) -> list[dict]:
        if len(messages) <= MAX_MESSAGES:
            return messages
        head_end, tail_start = 3, len(messages) - (MAX_MESSAGES - 3 - 1)
        if has_tool_use(messages[head_end - 1]):
            while head_end < tail_start and is_tool_result(messages[head_end]):
                head_end += 1
        if tail_start > 0 and is_tool_result(messages[tail_start]) and has_tool_use(messages[tail_start - 1]):
            tail_start -= 1
        if head_end >= tail_start:
            return messages
        middle = messages[head_end:tail_start]
        if len(middle) == 1 and isinstance(middle[0].get("content"), str) \
                and self._ARCHIVE_RE.fullmatch(middle[0]["content"]):
            return messages  # 幂等：中段已是归档标记
        transcript = self.write_transcript(messages)
        marker = {"role": "user", "content":
                  f"[{tail_start - head_end} messages archived at {transcript}]"}
        return [*messages[:head_end], marker, *messages[tail_start:]]

    # -- L_micro --
    def _all_tool_result_blocks(self, messages: list[dict]):
        for mi, m in enumerate(messages):
            c = m.get("content")
            if m.get("role") == "user" and isinstance(c, list):
                for bi, b in enumerate(c):
                    if isinstance(b, dict) and b.get("type") == "tool_result":
                        yield mi, bi, b

    def _unseen_positions(self, messages: list[dict]) -> set[tuple[int, int]]:
        last_asst = next((i for i in range(len(messages) - 1, -1, -1)
                          if messages[i].get("role") == "assistant"), -1)
        return {(mi, bi) for mi, bi, b in self._all_tool_result_blocks(messages)
                if mi > last_asst}

    def micro_compact(self, messages: list[dict]) -> list[dict]:
        target = int(CONTEXT_CHAR_LIMIT * MICRO_TARGET_RATIO)
        results = list(self._all_tool_result_blocks(messages))
        unseen = self._unseen_positions(messages)
        consumed = [e for e in results if e[:2] not in unseen]
        for _, _, block in consumed[:-KEEP_RECENT_RESULTS] if KEEP_RECENT_RESULTS else []:
            if estimate_chars(messages) <= target:
                break
            content = str(block.get("content", ""))
            if len(content) <= MICRO_REPLACE_MIN:
                continue
            path = self.outputs_dir / f"{block.get('tool_use_id', 'unknown')}.txt"
            if not path.exists():
                self.persist(block.get("tool_use_id", "unknown"), content)
            block["content"] = f"[Earlier tool result saved at {path}]"
        return messages

    # -- L_fit（材料 fit_tool_results：micro 后仍超限，把最大的结果落盘留 1000 预览）--
    def fit_tool_results(self, messages: list[dict]) -> list[dict]:
        target = int(CONTEXT_CHAR_LIMIT * MICRO_TARGET_RATIO)
        blocks = [b for _, _, b in self._all_tool_result_blocks(messages)]
        for b in sorted(blocks, key=lambda x: len(str(x.get("content", ""))), reverse=True):
            if estimate_chars(messages) <= target:
                break
            content = str(b.get("content", ""))
            safe = re.sub(r"[^A-Za-z0-9._-]", "_", str(b.get("tool_use_id", "unknown")))[:120]
            path = self.outputs_dir / f"{safe}.txt"
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")
            b["content"] = (f"<persisted-output>\nFull output: {path}\nPreview:\n"
                            f"{content[:1000]}\n</persisted-output>")
        return messages

    # -- L_compact / reactive --
    def _summary_message(self, label, request, summary, transcript) -> dict:
        return {"role": "user", "content": (
            f"[{label}]\n\nCurrent user request:\n{request}\n\n"
            f"Conversation summary (reference only):\n{json.dumps(summary, ensure_ascii=False)}\n\n"
            f"Full transcript: {transcript}")}

    def compact_history(self, messages: list[dict], active_request: str) -> list[dict]:
        transcript = self.write_transcript(messages)
        summary = self.llm.summarize(messages)
        return [self._summary_message("Compacted", active_request, summary, transcript)]

    def reactive_compact(self, messages: list[dict], active_request: str) -> list[dict]:
        transcript = self.write_transcript(messages)
        tail_start = max(0, len(messages) - KEEP_RECENT_MESSAGES)
        if tail_start > 0 and is_tool_result(messages[tail_start]) \
                and has_tool_use(messages[tail_start - 1]):
            tail_start -= 1
        old = messages[:tail_start] if tail_start else messages
        summary = self.llm.summarize(old)
        message = self._summary_message("Reactive compact", active_request, summary, transcript)
        return [message, *messages[tail_start:]] if tail_start else [message]

    # -- prepare（每轮模型调用前）--
    def prepare(self, messages: list[dict], active_request: str) -> list[dict]:
        messages = self.tool_result_budget(messages)
        messages = self.snip_compact(messages)
        if estimate_chars(messages) > CONTEXT_CHAR_LIMIT:
            messages = self.micro_compact(messages)
            if estimate_chars(messages) > CONTEXT_CHAR_LIMIT:
                messages = self.fit_tool_results(messages)
            if estimate_chars(messages) > CONTEXT_CHAR_LIMIT:
                messages = self.compact_history(messages, active_request)
        return messages


# ---------------- s09：记忆四环节 ----------------

MEMORY_TYPES = ("user", "feedback", "project", "reference")


def memory_slug(name: str) -> str:
    return re.sub(r"[^\w]+", "-", name.lower()).strip("-_") or "memory"
CONSOLIDATE_THRESHOLD = 10
RECALL_CHAR_LIMIT = 20_000
TEMPORARY_MARKERS = ("this session", "current session", "today only", "本次", "当前会话",
                     "暂时", "just this time")


class MemoryStore:
    def __init__(self, root: Path, llm=MockLLM):
        self.dir = root / ".memory"
        self.index = self.dir / "MEMORY.md"
        self.llm = llm

    # -- store --
    def write_memory(self, name: str, mem_type: str, description: str, body: str) -> Path:
        assert mem_type in MEMORY_TYPES and name and description and body
        self.dir.mkdir(parents=True, exist_ok=True)
        slug = memory_slug(name)
        path = self.dir / f"{slug}.md"
        path.write_text(
            f"---\nname: {name}\ndescription: {description}\ntype: {mem_type}\n---\n\n{body}\n",
            encoding="utf-8")
        self.rebuild_index()
        return path

    def rebuild_index(self) -> None:
        lines = []
        for path in sorted(self.dir.glob("*.md")):
            if path.name == "MEMORY.md":
                continue
            meta, body = self._parse(path)
            name = meta.get("name", path.stem)
            desc = meta.get("description") or next(
                (l for l in body.splitlines() if l.strip()), "")
            lines.append(f"- [{name}]({path.name}) - {desc}")
        self.index.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

    @staticmethod
    def _parse(path: Path) -> tuple[dict, str]:
        text = path.read_text(encoding="utf-8")
        if not text.startswith("---\n"):
            return {}, text
        parts = text.split("---", 2)
        if len(parts) < 3:
            return {}, text
        meta = {}
        for line in parts[1].strip().splitlines():
            if ":" in line:
                k, _, v = line.partition(":")
                meta[k.strip()] = v.strip()
        return meta, parts[2].lstrip()

    def list_memories(self) -> list[dict]:
        if not self.dir.exists():
            return []
        out = []
        for path in sorted(self.dir.glob("*.md")):
            if path.name == "MEMORY.md":
                continue
            meta, body = self._parse(path)
            out.append({"filename": path.name, "name": meta.get("name", path.stem),
                        "description": meta.get("description", ""),
                        "type": meta.get("type", "project"), "body": body.strip()})
        return out

    # -- recall（两条路径）--
    def select_relevant(self, query: str) -> list[str]:
        records = self.list_memories()
        if not records or not query:
            return []
        names = [r["name"] for r in records]
        try:
            indices = self.llm.select_indices(query, names)  # mock side-query
        except Exception:
            return self._keyword_selection(records, query)
        picked = []
        for i in indices:
            if isinstance(i, int) and 0 <= i < len(records):
                f = records[i]["filename"]
                if f not in picked:
                    picked.append(f)
                if len(picked) == 5:
                    break
        return picked

    @staticmethod
    def _keyword_selection(records, query) -> list[str]:
        words = set(re.findall(r"[a-z0-9_]{3,}|[一-鿿]{2,}", query.lower()))
        ranked = []
        for r in records:
            text = f"{r['name']} {r['description']}".lower()
            score = sum(w in text for w in words)
            if score:
                ranked.append((-score, r["filename"]))
        ranked.sort()
        return [f for _, f in ranked[:5]]

    def load_memories(self, query: str) -> str:
        loaded, remaining = [], RECALL_CHAR_LIMIT
        for filename in self.select_relevant(query):
            path = self.dir / filename
            content = path.read_text(encoding="utf-8") if path.is_file() else ""
            if not content or remaining <= 0:
                continue
            loaded.append(content[:remaining])
            remaining -= len(loaded[-1])
        return "\n".join(loaded)

    # -- extract（三门）--
    def should_store(self, cand: dict, existing: list[dict]) -> bool:
        if not isinstance(cand, dict):
            return False
        if cand.get("scope") != "persistent":          # 门 1：scope
            return False
        if cand.get("type") not in MEMORY_TYPES:
            return False
        name, desc, body = (str(cand.get(k, "")).strip() for k in ("name", "description", "body"))
        if not (name and desc and body):               # 门 2：字段完整
            return False
        text = f"{name}\n{desc}\n{body}".lower()
        if any(marker in text for marker in TEMPORARY_MARKERS):  # 门 2b：临时词
            return False
        slug = memory_slug(name)
        norm = lambda s: " ".join(s.lower().split())
        for m in existing:                              # 门 3：三重查重
            if memory_slug(str(m.get("name", ""))) == slug:
                return False
            if norm(str(m.get("description", ""))) == norm(desc):
                return False
            if norm(str(m.get("body", ""))) == norm(body):
                return False
        return True

    def extract_memories(self, dialogue: str) -> int:
        existing = self.list_memories()
        stored = 0
        for cand in self.llm.extract_candidates(dialogue):
            if self.should_store(cand, existing):
                self.write_memory(cand["name"], cand["type"],
                                  cand["description"], cand["body"])
                existing.append(cand)
                stored += 1
        return stored

    # -- consolidate（快照事务）--
    def consolidate(self, fail: bool = False) -> int:
        records = self.list_memories()
        if len(records) < CONSOLIDATE_THRESHOLD:
            return 0
        merged = self.llm.consolidate_records(records)
        snapshot = {r["filename"]: (self.dir / r["filename"]).read_text(encoding="utf-8")
                    for r in records}
        try:
            for path in self.dir.glob("*.md"):
                if path.name != "MEMORY.md":
                    path.unlink()
            if fail:  # 破坏性实验注入点：写盘阶段失败
                raise OSError("injected consolidation failure")
            for r in merged:
                (self.dir / f"{memory_slug(r['name'])}.md").write_text(
                    f"---\nname: {r['name']}\ndescription: {r['description']}\n"
                    f"type: {r['type']}\n---\n\n{r['body']}\n", encoding="utf-8")
            self.rebuild_index()
        except Exception:
            for path in self.dir.glob("*.md"):   # 恢复快照
                if path.name != "MEMORY.md":
                    path.unlink()
            for fn, content in snapshot.items():
                (self.dir / fn).write_text(content, encoding="utf-8")
            self.rebuild_index()
            raise
        return len(merged)


# ---------------- 构造材料与断言 ----------------


def big_content(n: int, tag: str) -> str:
    return (tag + "-line\n") * (n // len(tag + "-line\n") + 1)


def make_pair(i: int, result_len: int = 200) -> tuple[dict, dict]:
    """一对 tool_use / tool_result 消息。"""
    call = {"role": "assistant", "content": [
        {"type": "tool_use", "id": f"tu{i}", "name": "read_file",
         "input": {"path": f"f{i}.py"}}]}
    result = {"role": "user", "content": [
        {"type": "tool_result", "tool_use_id": f"tu{i}",
         "content": big_content(result_len, f"file{i}")}]}
    return call, result


def run_selftest() -> int:
    root = Path(tempfile.mkdtemp(prefix="memory-lab-"))
    comp = Compactor(root)
    store = MemoryStore(root)
    log: list[str] = []

    def check(name: str, cond: bool, detail: str = "") -> None:
        log.append(f"{'PASS' if cond else 'FAIL'} {name} {detail}")
        assert cond, f"{name} {detail}"

    # ===== s08 =====
    # T1 budget：510K 批次 → 最大者先落盘，压到预算内，小结果不动
    blocks = [(f"tu{i}", big_content(n, f"f{i}")) for i, n in
              [(1, 78_000), (2, 142_000), (3, 290_000), (4, 500), (5, 800)]]
    last_user = {"role": "user", "content": [
        {"type": "tool_result", "tool_use_id": tid, "content": c} for tid, c in blocks]}
    msgs = [{"role": "user", "content": "读取 5 个大文件"}] + [last_user]
    out = comp.tool_result_budget([*msgs[:-1], dict(last_user)])
    kept = [b for b in out[-1]["content"]]
    total = sum(len(str(b.get("content", ""))) for b in kept)
    persisted = list((root / ".task_outputs" / "tool-results").glob("*.txt"))
    check("budget.total<=200K", total <= TOOL_RESULT_BATCH_CHAR_LIMIT, f"total={total}")
    check("budget.biggest-persisted-first", (root / ".task_outputs/tool-results/tu3.txt").exists(),
          "最大块 290K 先落盘")
    check("budget.small-kept", any(b.get("tool_use_id") == "tu4" for b in kept)
          and not (root / ".task_outputs/tool-results/tu4.txt").exists(), "500 字符小结果不落盘")

    # T2 snip：60 条 → 约 50，切点回退保配对（材料语义：保护优先于精确条数）
    msgs = [{"role": "user", "content": "q"}, {"role": "user", "content": "ctx"}]
    call0, result0 = make_pair(0)
    msgs += [call0, result0]           # messages[2]=assistant(tool_use)，切点压在配对上
    for i in range(1, 29):             # 再加 28 对
        call, result = make_pair(i)
        msgs += [call, result]
    assert len(msgs) == 60 and has_tool_use(msgs[2]), "测试前提"
    snipped = comp.snip_compact(msgs)
    check("snip.len~50", len(snipped) <= MAX_MESSAGES + 1, f"len={len(snipped)}")
    check("snip.pair-kept-in-head", has_tool_use(snipped[2]) and is_tool_result(snipped[3]),
          "切点回退后 call0/result0 整对保留在头部")
    check("snip.marker", "messages archived at" in str(snipped[4]["content"]))
    check("snip.pair-intact", not validate_pairs(snipped), "裁后无孤立结果")
    again = comp.snip_compact(snipped)
    check("snip.idempotent", again is snipped or estimate_chars(again) == estimate_chars(snipped),
          "二次裁剪不重复归档")

    # T3 micro：unseen 不动、保最近 3、>120 替换带路径（数据须超限才触发）
    msgs = [{"role": "user", "content": "q"}]
    for i in range(8):
        call, result = make_pair(i, result_len=8_000)
        msgs += [call, result]
    msgs.append({"role": "assistant", "content": [{"type": "text", "text": "done"}]})
    fresh_pair = make_pair(99, result_len=8_000)  # assistant 之后的 unseen 批
    msgs += [fresh_pair[0], fresh_pair[1]]
    assert estimate_chars(msgs) > CONTEXT_CHAR_LIMIT, "测试前提：超限"
    before = estimate_chars(msgs)
    out = comp.micro_compact(msgs)
    tu99 = next(b for m in out if isinstance(m.get("content"), list)
                for b in m["content"] if isinstance(b, dict)
                and b.get("tool_use_id") == "tu99")
    check("micro.unseen-untouched", len(str(tu99["content"])) >= 8_000, "unseen 不压")
    replaced = sum(1 for m in out if isinstance(m.get("content"), list)
                   for b in m["content"] if isinstance(b, dict)
                   and str(b.get("content", "")).startswith("[Earlier tool result saved at"))
    check("micro.replaced-count", replaced == 5, f"8 已读-3 保留=5 替换，got {replaced}")
    check("micro.shrunk", estimate_chars(out) < before)

    # T4 compact_history：摘要替换 + active_request 分离 + transcript 落盘
    msgs = [{"role": "user", "content": "比较 s08 和 s09"}]
    for i in range(5):
        call, result = make_pair(i, result_len=12_000)
        msgs += [call, result]
    out = comp.compact_history(msgs, active_request="比较 s08 和 s09")
    check("compact.single-msg", len(out) == 1)
    text = str(out[0]["content"])
    check("compact.request-separated", "Current user request:\n比较 s08 和 s09" in text)
    check("compact.transcript-kept", "Full transcript:" in text
          and len(list((root / ".transcripts").glob("*.jsonl"))) >= 1)

    # T5 reactive：尾部 5 条 + 配对保护
    msgs = [{"role": "user", "content": "q"}]
    for i in range(10):
        call, result = make_pair(i)
        msgs += [call, result]
    out = comp.reactive_compact(msgs, active_request="q")
    check("reactive.tail-kept", len(out) <= 1 + KEEP_RECENT_MESSAGES + 1,
          f"尾部 5 条 + 配对回退余量 + 1 摘要，len={len(out)}")
    check("reactive.pair-intact", not validate_pairs(out))
    check("reactive.marker", "[Reactive compact]" in str(out[0]["content"]))

    # T6 prepare 顺序（budget → snip → 条件 micro/compact）
    llm_calls_before = MockLLM.calls
    msgs = [{"role": "user", "content": "q"}]
    for i in range(3):
        call, result = make_pair(i, result_len=300)
        msgs += [call, result]
    out = comp.prepare(msgs, "q")
    check("prepare.no-api-when-small", MockLLM.calls == llm_calls_before,
          "预算内零 mock LLM 调用")

    # ===== s09 =====
    # T7 store + index
    p = store.write_memory("user-preference-tabs", "user",
                           "User prefers tabs", "Use tabs, not spaces.")
    check("store.file", p.exists() and "name: user-preference-tabs" in p.read_text())
    idx = store.index.read_text()
    check("store.index", "user-preference-tabs" in idx and "User prefers tabs" in idx)

    # T8 select + load（mock side-query）
    for i in range(4):
        store.write_memory(f"topic-database-{i}", "project",
                           f"DB note {i}", f"database facts {i}")
    picked = store.select_relevant("database tuning question")
    check("recall.select<=5", 0 < len(picked) <= 5, f"{picked}")
    loaded = store.load_memories("database tuning question")
    check("recall.loaded", "database facts" in loaded and "tabs" not in loaded,
          "只加载相关记忆")

    # T9 extract 三门
    stored = store.extract_memories(
        "user: I prefer tabs over spaces. Remember that.\n"
        "assistant: ok\n"
        "user: just for this session use test data\n"
        "user: this is a current task note\n")
    names = [m["name"] for m in store.list_memories()]
    check("extract.scope-gate", not any(n.startswith("task-") for n in names),
          "current_task 候选被 scope 门拒绝")
    check("extract.temp-gate", not any(n.startswith("tmp-") for n in names),
          "临时词候选被拒")
    check("extract.kept", any(n.startswith("pref-") for n in names), f"{names}")

    # T9b 查重门：同一句再提取不产生重复
    n_before = len(store.list_memories())
    store.extract_memories("user: I prefer tabs over spaces. Remember that.")
    check("extract.dedup", len(store.list_memories()) == n_before)

    # T10 consolidate：阈值 + 快照恢复
    while len(store.list_memories()) < CONSOLIDATE_THRESHOLD:
        i = len(store.list_memories())
        store.write_memory(f"bulk-note-{i}", "reference", f"note {i}", f"body {i}")
    n_before = len(store.list_memories())
    try:
        store.consolidate(fail=True)
        check("consolidate.restore", False, "应当抛出")
    except OSError:
        pass
    check("consolidate.snapshot-restored",
          len(store.list_memories()) == n_before
          and all((store.dir / m["filename"]).exists() for m in store.list_memories()),
          "失败后原样恢复")
    merged_n = store.consolidate(fail=False)
    check("consolidate.merged", 0 < merged_n <= 30 and len(store.list_memories()) == merged_n)

    # T11/T12 walkthrough（§3.4 两个场景；独立 root 防串台，输出数字即笔记 §3.4/§6 引用源）
    def walkthrough(sizes: list[int]) -> tuple[list[dict], int, list[str], list[int], int]:
        wroot = Path(tempfile.mkdtemp(prefix="memory-lab-w-"))
        try:
            wcomp = Compactor(wroot)
            calls = [{"type": "tool_use", "id": f"tu{i}", "name": "read_file",
                      "input": {"path": f"f{i}.py"}} for i in range(len(sizes))]
            msgs = [{"role": "user", "content": "q"},
                    {"role": "assistant", "content": calls},
                    {"role": "user", "content": [
                        {"type": "tool_result", "tool_use_id": c["id"],
                         "content": big_content(n, f"f{i}")} for i, (c, n) in enumerate(zip(calls, sizes))]}]
            before = MockLLM.calls
            out = wcomp.prepare(msgs, "q")
            files = sorted(p.name for p in (wroot / ".task_outputs" / "tool-results").glob("*.txt"))
            lens = [len(str(b.get("content", ""))) for b in out[-1]["content"]]
            return out, MockLLM.calls - before, files, lens, estimate_chars(out)
        finally:
            shutil.rmtree(wroot, ignore_errors=True)

    _out1, llm1, files1, lens1, est1 = walkthrough([40_000, 170_000, 320_000])
    check("walk.s1-all-persisted", files1 == ["tu0.txt", "tu1.txt", "tu2.txt"] and llm1 == 0,
          f"budget 落 tu2/tu1、fit 兜底落 tu0，摘要调用 {llm1} 次，files={files1}")
    check("walk.s1-fit-receipt", 1000 <= lens1[0] < 2000,
          f"tu0 换 1,000 预览收据（{lens1[0]} 字符；budget 收据为 2,000 预览，{lens1[1]} 字符）")
    check("walk.s1-final", est1 < CONTEXT_CHAR_LIMIT,
          f"终态估算 {est1}（json 转义换行令 budget 后估算略超 50,000，fit 因此多落一条）")

    _out2, llm2, files2, lens2, est2 = walkthrough([25_000, 45_000, 260_000])
    check("walk.s2-persisted", files2 == ["tu1.txt", "tu2.txt"] and llm2 == 0,
          f"budget 落 260K、fit 落 45K，25K 完整保留，摘要调用 {llm2} 次")
    check("walk.s2-kept", lens2[0] >= 25_000 and 1000 <= lens2[1] < 2000,
          f"tu0 原样 {lens2[0]}，tu1 换 1,000 预览收据（{lens2[1]} 字符）")
    check("walk.s2-final", est2 < CONTEXT_CHAR_LIMIT, f"终态估算 {est2}")

    print("\n".join(log))
    print(f"\nSELFTEST PASSED ✔ ({len(log)} checks, mock-LLM calls={MockLLM.calls})")
    shutil.rmtree(root, ignore_errors=True)
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        sys.exit(run_selftest())
    ap.print_help()
