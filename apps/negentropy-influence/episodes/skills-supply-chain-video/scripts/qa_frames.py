#!/usr/bin/env python3
"""薄包装：转发到 to-video skill 公共管线的 qa_frames.py。

实现收敛于技能仓单一事实源；本文件仅保留原 CLI 契约
（uv run --no-project --with pillow --with numpy scripts/qa_frames.py ...）。

skill 解析：TO_VIDEO_HOME → ~/.claude/skills/to-video → ~/.agents/skills/to-video，
全部未命中即**大声退出**并打印安装指令——静默跳过是被禁止的失效形态。
包装器刻意零依赖单文件（与既有冻结档纪律一致）：修缺陷 = 改模板 + 全集同步，
由 verify_skeleton.py 字节执法。
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def _skill_scripts() -> Path:
    """定位 skill 的 scripts 目录；找不到即大声退出。"""
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


if __name__ == "__main__":
    sys.exit(
        subprocess.run(
            [
                sys.executable,
                str(_skill_scripts() / "qa_frames.py"),
                "--project",
                str(Path(__file__).resolve().parent.parent),
                *sys.argv[1:],
            ],
            check=False,
        ).returncode
    )
