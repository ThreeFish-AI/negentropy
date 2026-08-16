#!/usr/bin/env python3
"""薄包装：转发到公共管线 media/pipeline/scripts/build_narration.py。

实现已收敛至仓库级单一事实源；本文件仅保留原 CLI 契约
（uv run --no-project scripts/build_narration.py）。
"""

from __future__ import annotations

import runpy
import subprocess
import sys
from pathlib import Path

PIPELINE_SCRIPT = Path(__file__).resolve().parents[2] / "pipeline" / "scripts" / "build_narration.py"

if __name__ == "__main__":
    sys.exit(
        subprocess.run(
            [sys.executable, str(PIPELINE_SCRIPT), "--project", str(Path(__file__).resolve().parent.parent), *sys.argv[1:]],
            check=False,
        ).returncode
    )
