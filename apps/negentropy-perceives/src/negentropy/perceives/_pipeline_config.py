"""Pipeline 配置模型 — 向后兼容层。

原始实现已迁至 ``core/pipeline_config.py``，
本文件保留重导出以保持向后兼容。

注意：由于 ``core/__init__.py`` 存在对 ``config.settings`` 的传递依赖，
此处通过在加载前将模块预注册到 ``sys.modules`` 来绕过循环引用。
"""

import importlib.util
import sys
import warnings
from pathlib import Path

warnings.warn(
    "Importing from '_pipeline_config' is deprecated, use 'core.pipeline_config' instead.",
    DeprecationWarning,
    stacklevel=2,
)

# 直接加载 core/pipeline_config.py，绕过 core.__init__ 以避免循环引用
_module_name = "negentropy.perceives.core.pipeline_config"
_target = Path(__file__).parent / "core" / "pipeline_config.py"
_spec = importlib.util.spec_from_file_location(
    _module_name,
    str(_target),
    submodule_search_locations=[],
)

# 预注册到 sys.modules，使 Pydantic 注解解析能找到正确的模块
if _spec is None:
    raise ImportError(f"Failed to create ModuleSpec for {_target}")
_mod = sys.modules.setdefault(_module_name, importlib.util.module_from_spec(_spec))
_spec.loader.exec_module(_mod)  # type: ignore[union-attr]

# 重导出所有公开符号
_globals = globals()
for _name in getattr(_mod, "__all__", dir(_mod)):
    if not _name.startswith("_"):
        _globals[_name] = getattr(_mod, _name)  # noqa: F401
