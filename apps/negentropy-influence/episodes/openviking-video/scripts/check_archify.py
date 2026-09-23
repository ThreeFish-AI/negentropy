#!/usr/bin/env python3
"""薄包装：转发到 to-video skill 公共管线的 check_archify.py。

实现收敛于技能仓单一事实源（2026-09 二次抽取迁入）；本文件仅保留原
CLI 契约（archify 回放结构门，工程根直跑形态）。

skill 解析：TO_VIDEO_HOME → ~/.claude/skills/to-video → ~/.agents/skills/to-video，
全部未命中即**大声退出**并打印安装指令——静默跳过是被禁止的失效形态。
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def _skill_scripts() -> Path:
    """定位 skill 的 pipeline/scripts 目录；找不到即大声退出。"""
    candidates = []
    if env := os.environ.get("TO_VIDEO_HOME"):
        candidates.append(Path(env).expanduser())
    candidates += [
        Path.home() / ".claude" / "skills" / "to-video",
        Path.home() / ".agents" / "skills" / "to-video",
    ]
    for c in candidates:
        p = c / "pipeline" / "scripts"
        if (p / "pipeline.py").is_file():
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
                str(_skill_scripts() / "check_archify.py"),
                "--project",
                str(Path(__file__).resolve().parent.parent),
                *sys.argv[1:],
            ],
            check=False,
        ).returncode
    )
