"""
pytest 配置 - 添加 src 目录和 cognizes 包到 Python 路径，并加载 .env 文件
"""

import os
import sys
from pathlib import Path

# 项目根目录 (e2e_travel_agent)
project_root = Path(__file__).parent.parent

# 加载 .env 文件 (在导入其他模块之前)
env_file = project_root / ".env"
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())

# 将 src 目录添加到 Python 路径 (用于 config, services 等模块)
src_path = project_root / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

# 将 cognizes 包的父目录添加到 Python 路径
# 路径: e2e_travel_agent/tests/../../../.. = src/cognizes 的父目录 = src/
cognizes_parent = project_root.parent.parent.parent
if str(cognizes_parent) not in sys.path:
    sys.path.insert(0, str(cognizes_parent))
