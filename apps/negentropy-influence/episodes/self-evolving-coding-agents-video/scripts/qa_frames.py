#!/usr/bin/env python3
"""薄包装：转发到公共管线 ../../pipeline/scripts/qa_frames.py。

实现已收敛至子项目级单一事实源；本文件仅保留原 CLI 契约
（uv run --no-project scripts/qa_frames.py <video.mp4> [--offset N] <句id|--scene P1>）。
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

PIPELINE_SCRIPT = Path(__file__).resolve().parents[3] / "pipeline" / "scripts" / "qa_frames.py"

if __name__ == "__main__":
    sys.exit(
        subprocess.run(
            [sys.executable, str(PIPELINE_SCRIPT), "--project", str(Path(__file__).resolve().parent.parent), *sys.argv[1:]],
            check=False,
        ).returncode
    )
