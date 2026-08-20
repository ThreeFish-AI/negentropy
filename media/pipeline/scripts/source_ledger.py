#!/usr/bin/env python3
"""非论文信源的可复现清单——把「信源可回溯 + 陈旧可发现」从人工纪律变成机器门。

背景：论文型选题的事实源是一份 PDF，冻结、可逐字回溯（paper_extract.py 那条链）。
但文档/代码/课程站点型选题不是——站点会改版、仓库会往前走，而逐字稿里的断言在
录完音之后就冻住了。ISSUE-162 的教训正出在这里：数字取自会变的页面，发布时已陈旧。

本脚本 + <project>/research/sources.toml 补上这条链（设计对标 refs.py）：

    fetch    抓取一个信源，记录 URL / 取数日期 / 双指纹，写入清单
    list     列出清单条目
    verify   重抓并比对指纹，报「未变 / 已变更 / 抓取失败」

两类信源的判据刻意不同（kind）：

  repo  指向**固定 commit** 的仓库文件（raw.githubusercontent 带 sha）。内容按定义
        不可变，故 raw 字节指纹漂移即 **FAIL**——说明 URL 里的 ref 不是不可变引用
        （例如误写成分支名），整条取证链失效。
  site  指向线上页面。构建产物哈希、埋点、A/B 文案都会让 raw 字节天天变，比对 raw
        毫无信噪比；故 site 只对**剥标签归一后的正文文本**比对指纹，漂移报 **WARN**
        （「正文已变，去复核笔记」），raw 漂移则完全忽略。

用法（仓库根，零第三方依赖）：
    uv run --no-project media/pipeline/scripts/source_ledger.py list   --project media/<slug>-video
    uv run --no-project media/pipeline/scripts/source_ledger.py verify --project media/<slug>-video
    uv run --no-project media/pipeline/scripts/source_ledger.py fetch  --project media/<slug>-video \\
        --name s01-repo --kind repo --via "pinned commit" \\
        --url https://raw.githubusercontent.com/o/r/<sha>/s01/README.zh.md

退出码：0 = 全部未变（或仅 WARN）；1 = 有 FAIL。
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import html
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

import tomllib

#: 剥掉整块 script/style，再把标签换成换行——与逐字稿取证时用的归一方式保持一致
_BLOCK_RE = re.compile(r"(?is)<(script|style)\b.*?</\1>")
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
USER_AGENT = "negentropy-source-ledger/1.0 (+media/pipeline)"
TIMEOUT = 30


def ledger_path(project: Path) -> Path:
    return project / "research" / "sources.toml"


def load_ledger(project: Path) -> dict:
    p = ledger_path(project)
    if not p.is_file():
        sys.exit(f"清单不存在: {p}\n  先用 fetch 子命令登记第一个信源")
    return tomllib.loads(p.read_text(encoding="utf-8"))


def normalize_text(raw: bytes) -> str:
    """HTML → 归一正文文本。非 HTML（如 .md/.py）原样归一空白即可。"""
    s = raw.decode("utf-8", errors="replace")
    if "<" in s and ">" in s:
        s = _BLOCK_RE.sub(" ", s)
        s = _TAG_RE.sub("\n", s)
        s = html.unescape(s)
    return _WS_RE.sub(" ", s).strip()


def digests(raw: bytes) -> tuple[str, str]:
    """(raw 字节 sha256, 归一正文 sha256)，各取前 16 位便于人眼比对。"""
    return (
        hashlib.sha256(raw).hexdigest()[:16],
        hashlib.sha256(normalize_text(raw).encode("utf-8")).hexdigest()[:16],
    )


def http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read()


def toml_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def render_ledger(entries: dict) -> str:
    head = (
        "# 非论文信源清单（可复现取证链，工具：media/pipeline/scripts/source_ledger.py）\n"
        "#\n"
        "# kind=repo 指向固定 commit，raw 指纹漂移即 FAIL（说明 URL 里的 ref 不是不可变引用）。\n"
        "# kind=site 指向线上页面，只对剥标签归一后的正文比对指纹，漂移报 WARN（去复核笔记）。\n"
        "# text_sha256 是判据；raw_sha256 仅供 repo 类硬校验与人工核对。\n"
    )
    out = [head]
    for name, e in entries.items():
        out.append(f'\n[{name}]\nurl = "{toml_escape(e["url"])}"\nkind = "{e["kind"]}"')
        if e.get("pinned_ref"):
            out.append(f'pinned_ref = "{toml_escape(e["pinned_ref"])}"')
        out.append(f'accessed = "{e["accessed"]}"')
        out.append(f'raw_sha256 = "{e["raw_sha256"]}"')
        out.append(f'text_sha256 = "{e["text_sha256"]}"')
        out.append(f"bytes = {e['bytes']}")
        out.append(f"lines = {e['lines']}")
        if e.get("via"):
            out.append(f'via = "{toml_escape(e["via"])}"')
    return "\n".join(out) + "\n"


def cmd_fetch(project: Path, args: argparse.Namespace) -> int:
    p = ledger_path(project)
    entries = tomllib.loads(p.read_text(encoding="utf-8")) if p.is_file() else {}
    try:
        raw = http_get(args.url)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
        print(f"❌ {args.name}: 抓取失败 {exc}")
        return 1
    raw_sha, text_sha = digests(raw)
    if args.kind == "repo" and args.pinned_ref and args.pinned_ref not in args.url:
        print(
            f"❌ {args.name}: --pinned-ref {args.pinned_ref} 未出现在 URL 中"
            "——repo 类信源的 URL 必须是不可变引用（含 commit sha）"
        )
        return 1
    entries[args.name] = {
        "url": args.url,
        "kind": args.kind,
        "pinned_ref": args.pinned_ref or "",
        "accessed": args.accessed or datetime.date.today().isoformat(),
        "raw_sha256": raw_sha,
        "text_sha256": text_sha,
        "bytes": len(raw),
        "lines": raw.count(b"\n"),
        "via": args.via or "",
    }
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(render_ledger(entries), encoding="utf-8")
    print(
        f"✅ {args.name}: 已登记 · {len(raw)} bytes / {raw.count(b'\n')} lines"
        f" · raw {raw_sha} · text {text_sha}"
    )
    return 0


def cmd_list(entries: dict) -> int:
    print(f"信源清单：{len(entries)} 条")
    for name, e in entries.items():
        pin = f" @{e['pinned_ref'][:12]}" if e.get("pinned_ref") else ""
        print(
            f"  {name:<14} [{e['kind']:<4}]{pin}  取数 {e['accessed']}"
            f"  text {e['text_sha256']}  {e['lines']} lines"
        )
        print(f"                 {e['url']}")
    return 0


def cmd_verify(entries: dict, args: argparse.Namespace) -> int:
    names = [args.name] if args.name else list(entries)
    fails = warns = 0
    for name in names:
        e = entries.get(name)
        if e is None:
            print(f"❌ {name}: 清单无此条目")
            fails += 1
            continue
        try:
            raw = http_get(e["url"])
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
            print(f"❌ {name}: 抓取失败 {exc}")
            fails += 1
            continue
        raw_sha, text_sha = digests(raw)
        if e["kind"] == "repo":
            if raw_sha != e["raw_sha256"]:
                print(
                    f"❌ {name}: raw 指纹漂移 {e['raw_sha256']} → {raw_sha}\n"
                    "   repo 类信源应指向固定 commit 而内容变了：检查 URL 里的 ref "
                    "是否误用分支名；整条取证链需重做"
                )
                fails += 1
            else:
                print(f"✅ {name}: 固定引用未变（raw {raw_sha}）")
            continue
        # site：只看正文，raw 漂移属正常（构建产物哈希）
        if text_sha != e["text_sha256"]:
            print(
                f"⚠️  {name}: 正文已变更 {e['text_sha256']} → {text_sha}"
                f"（取数日期 {e['accessed']}）\n"
                "   去复核 research/source-notes.md 中引自该页的断言是否仍成立"
            )
            warns += 1
        else:
            print(f"✅ {name}: 正文未变（text {text_sha}）")
    print(f">> 信源核验 · 受检 {len(names)} · FAIL {fails} · WARN {warns}")
    return fails


def main() -> None:
    ap = argparse.ArgumentParser(description="非论文信源可复现清单")
    ap.add_argument("--project", default=".", help="视频工程根（含 research/）")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list", help="列出清单条目")
    p = sub.add_parser("verify", help="重抓并比对指纹")
    p.add_argument("--name", help="只核对指定信源（默认全部）")
    p = sub.add_parser("fetch", help="抓取并登记一个信源")
    p.add_argument("--name", required=True, help="清单条目名（kebab-case）")
    p.add_argument("--url", required=True)
    p.add_argument("--kind", required=True, choices=("repo", "site"))
    p.add_argument(
        "--pinned-ref", help="repo 类的不可变引用（commit sha），会校验其出现在 URL 中"
    )
    p.add_argument("--via", help="取数方式备注（进清单，供审计）")
    p.add_argument("--accessed", help="取数日期 YYYY-MM-DD（默认今天）")
    args = ap.parse_args()

    project = Path(args.project).resolve()
    if args.cmd == "fetch":
        sys.exit(cmd_fetch(project, args))
    entries = load_ledger(project)
    sys.exit(cmd_list(entries) if args.cmd == "list" else cmd_verify(entries, args))


if __name__ == "__main__":
    main()
