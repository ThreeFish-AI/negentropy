#!/usr/bin/env python3
"""工作区级薄包装：转发到 to-video skill 的单入口编排 pipeline.py。

argv 原样转发（--project / --series / 子命令及其 flag 均由 skill 侧解析）。
工作区锚由本文件位置自证（parent.parent = 工作区根），硬性覆写 TO_VIDEO_WORKSPACE
env——从任意 CWD 调用都锚定本工作区，不依赖调用现场。
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
    os.environ["TO_VIDEO_WORKSPACE"] = str(Path(__file__).resolve().parent.parent)
    sys.exit(
        subprocess.run(
            [sys.executable, str(_skill_scripts() / "pipeline.py"), *sys.argv[1:]],
            check=False,
        ).returncode
    )
