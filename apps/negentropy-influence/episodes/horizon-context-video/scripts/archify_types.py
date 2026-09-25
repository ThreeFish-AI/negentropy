#!/usr/bin/env python3
"""存量 sidecar 的图型回填（一次性维护脚本，幂等）。

背景：覆盖门的「图型多样性」判据读 sidecar 顶层 `type`（新录制由
record_archify.py --type 落盘）。本脚本把 33 张存量图的**人工审定图型表**
写回各自 sidecar，并与渲染器指纹嗅探（record_archify._sniff_diagram_type）
交叉对账——指纹与审定表不一致时点名（architecture 无框平铺与 lifecycle
无指纹，属预期空白，不算失配）。

用法：uv run --no-project scripts/archify_types.py            # 回填 + 对账
      uv run --no-project scripts/archify_types.py --check    # 只对账不写
回填后须重跑 scripts/archify_manifest.py 透传 type 进 manifest.ts。
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import os

ROOT = Path(__file__).resolve().parent.parent
SIDE = ROOT / "video" / "public" / "archify"


def _skill_scripts() -> Path:
    """定位 to-video skill 的 scripts（TO_VIDEO_HOME → 两处约定安装位）。"""
    candidates = []
    if env := os.environ.get("TO_VIDEO_HOME"):
        candidates.append(Path(env).expanduser())
    candidates += [
        Path.home() / ".claude" / "skills" / "to-video",
        Path.home() / ".agents" / "skills" / "to-video",
    ]
    for c in candidates:
        p = c / "scripts"
        # 须见 SKILL.md 哨兵：工作区根也有 scripts/pipeline.py（误中即自递归）
        if (c / "SKILL.md").is_file() and (p / "pipeline.py").is_file():
            return p
    listed = "\n  ".join(str(c) for c in candidates)
    sys.exit(
        "找不到 to-video skill（按序尝试：\n  " + listed + "\n）。\n"
        "  安装：git clone https://github.com/ThreeFish-AI/to-video <目录>\n"
        "        ln -s <目录> ~/.claude/skills/to-video"
        "   # 或设 TO_VIDEO_HOME=<目录>"
    )


R = _skill_scripts()  # 机制脚本随 to-video skill 安装（2026-09 机制外置）

#: 人工审定图型表（判型依据：交付 HTML 的 data-composition-frame-kind 指纹
#: + legend 语义，2026-09-20 由产制链路调研定稿）。
TYPES = {
    # workflow（24）
    "agent-identity": "workflow",
    "amnesia-intern": "workflow",
    "autopilot-loop": "workflow",
    "bare-key-baseline": "workflow",
    "classification-tagging": "workflow",
    "declaration-execution": "workflow",
    "dedup-safety": "workflow",
    "dual-path-disambiguation": "workflow",
    "engine-governance": "workflow",
    "evidence-grading": "workflow",
    "fan-trap": "workflow",
    "governance-demolition": "workflow",
    "grain-collapse": "workflow",
    "injection-threat": "workflow",
    "last-snapshot-gate": "workflow",
    "majority-shortcut": "workflow",
    "mean-of-means": "workflow",
    "perimeter-loss": "workflow",
    "preview-gap": "workflow",
    "row-column-policy": "workflow",
    "supply-overwhelm": "workflow",
    "trust-assets": "workflow",
    "valid-sql-wrong-answer": "workflow",
    "wrong-page-failure": "workflow",
    # dataflow（5）
    "collect-enrich-activate": "dataflow",
    "evolution-timeline": "dataflow",
    "four-factor-ranking": "dataflow",
    "lineage-ledger": "dataflow",
    "problem-to-mechanisms": "dataflow",
    # architecture（3）
    "caliber-clash": "architecture",
    "component-panorama": "architecture",
    "open-interop": "architecture",
    # sequence（1）
    "resolve-activation": "sequence",
}

sys.path.insert(0, str(R))
from record_archify import _sniff_diagram_type  # noqa: E402  —— 必须在 sys.path 注入之后导入


def _repo_root(start: Path) -> Path:
    """本仓库根：自 start 向上找 .git（**文件或目录**——worktree 是文件）。"""
    for p in [start.resolve(), *start.resolve().parents]:
        if (p / ".git").exists():
            return p
    return start.resolve()


# skill 不在本仓库内，仓库根改自本文件锚定（原 R.parents[3] 数层数随外置失效）
DOCS_ASSETS = (
    _repo_root(Path(__file__))
    / "docs"
    / "assets"
    / "architecture"
    / "cognitive-context"
)


def _local_html(sidecar: dict, slug: str) -> Path:
    """嗅探用 HTML：优先本仓 docs/assets 同名副本，退回 sidecar 记录的 source 路径。

    sidecar 的 source 是录制机的绝对路径（可能指向别的工作区）——本仓 SSOT 副本
    与其内容一致（deliver 冻结字节），优先用本仓的，工作区搬迁后也不失联。
    """
    local = DOCS_ASSETS / f"horizon-context--{slug}.html"
    return local if local.is_file() else Path(sidecar["source"])


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="只对账不写")
    a = ap.parse_args()

    mismatches: list[str] = []
    filled = 0
    for slug, typ in sorted(TYPES.items()):
        sidecar = SIDE / f"{slug}.json"
        if not sidecar.is_file():
            print(f"⚠️  {slug}: sidecar 不存在，跳过")
            continue
        d = json.loads(sidecar.read_text(encoding="utf-8"))
        if d.get("type") not in (None, typ):
            mismatches.append(
                f"{slug}: sidecar 已有 type={d['type']}，与审定表 {typ} 冲突"
            )
            continue
        sniff = _sniff_diagram_type(_local_html(d, slug))
        if sniff and sniff != typ:
            mismatches.append(f"{slug}: 指纹嗅探 {sniff} ≠ 审定表 {typ}——请人工复核")
        if d.get("type") != typ:
            if a.check:
                print(f"⏳ {slug}: 待回填 {typ}（--check 模式未写）")
                continue
            # type 排最前（其后原字段序不动），图型元数据一眼可见
            items = {"type": typ}
            for k, v in d.items():
                items.setdefault(k, v)
            sidecar.write_text(
                json.dumps(items, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
            )
            filled += 1
    for m in mismatches:
        print(f"❌ {m}")
    print(
        f"{'对账' if a.check else '回填'}完成：{filled} 写入 / {len(mismatches)} 失配"
    )
    sys.exit(1 if mismatches else 0)


if __name__ == "__main__":
    main()
