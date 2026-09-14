#!/usr/bin/env python3
"""薄包装：转发到公共管线 ../../../pipeline/scripts/tts.py。

实现已收敛至子项目级单一事实源；本文件仅保留原 CLI 契约
（uv run --no-project --with edge-tts --with mutagen scripts/tts.py [--force]）。

parents[3] 编码的是本文件在 `episodes/<slug>/scripts/` 的落位（scripts→分集→
episodes→子项目根）。薄包装不在 pipeline/scripts/ 内，无法 `import paths` 复用
哨兵搜索（见 paths.py 的导入边界），故此处只能数层——分集目录层级若再变，
本文件与上方 docstring 的相对路径须同步。
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

PIPELINE_SCRIPT = (
    Path(__file__).resolve().parents[3] / "pipeline" / "scripts" / "tts.py"
)

if __name__ == "__main__":
    sys.exit(
        subprocess.run(
            [
                sys.executable,
                str(PIPELINE_SCRIPT),
                "--project",
                str(Path(__file__).resolve().parent.parent),
                *sys.argv[1:],
            ],
            check=False,
        ).returncode
    )
