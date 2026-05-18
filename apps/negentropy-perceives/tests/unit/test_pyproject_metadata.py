"""pyproject.toml 元数据完整性测试。

验证关键字准确性、可选依赖无重复、版本号一致性、coverage 配置有效性等，
防止配置漂移和回归。设计意图为**持续守护配置完整性**，而非一次性验证。
"""

import re
from pathlib import Path

import pytest
import tomllib

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
PYPROJECT_PATH = PROJECT_ROOT / "pyproject.toml"


def _load_pyproject() -> dict:
    """使用 tomllib 结构化解析 pyproject.toml（Python 3.13+ 标准库）。"""
    return tomllib.loads(PYPROJECT_PATH.read_text(encoding="utf-8"))


def _read_pyproject_raw() -> str:
    """返回 pyproject.toml 原始文本，用于版本号等需要逐行扫描的场景。"""
    return PYPROJECT_PATH.read_text(encoding="utf-8")


def _find_dependency_versions(raw: str, package: str) -> set[str]:
    """仅在非注释行中查找包的版本约束，避免注释中的引用导致误报。"""
    versions: set[str] = set()
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        match = re.search(
            rf"{re.escape(package)}(?:\[[^\]]+\])?([><=!]+[\d.]+)",
            stripped,
        )
        if match:
            versions.add(match.group(1))
    return versions


class TestKeywordsAccuracy:
    """keywords 字段中的每个关键词必须在源码中有对应引用或合理依据。"""

    def test_no_dead_keywords(self):
        """keywords 不包含已移除的技术栈名称。"""
        data = _load_pyproject()
        keywords = data["project"]["keywords"]

        assert "scrapy" not in keywords, (
            "keywords 中包含 'scrapy'，但该依赖已从运行时移除"
        )


class TestOptionalDepsNoDuplicates:
    """optional-dependencies 中不应存在完全相同的别名组。"""

    def test_no_identical_optional_dep_groups(self):
        """不存在两个 optional-dependencies 组具有完全相同的非空包列表。
        空列表组（已移入核心依赖的占位 extra）不参与去重检查。"""
        data = _load_pyproject()
        opt_deps = data.get("project", {}).get("optional-dependencies", {})

        groups: dict[tuple[str, ...], str] = {}
        for name, packages in opt_deps.items():
            if not packages:
                continue
            key = tuple(sorted(packages))
            if key in groups:
                pytest.fail(
                    f"Optional dep group '{name}' 与 '{groups[key]}' "
                    f"具有完全相同的包列表: {list(key)}"
                )
            groups[key] = name


class TestDoclingVersionConsistency:
    """docling 版本号在所有出现位置应保持一致。"""

    def test_docling_version_unified(self):
        """docling 的版本约束在主依赖和所有 optional-deps 中一致。

        仅扫描非注释行，避免 changelog 引用等导致的假阳性。
        """
        raw = _read_pyproject_raw()
        versions = _find_dependency_versions(raw, "docling")

        assert len(versions) <= 1, (
            f"docling 版本不一致，发现多种约束: {versions}。应统一为一个版本。"
        )


class TestCoverageOmitNoDeadPaths:
    """coverage omit 列表不应引用不存在的具体文件路径。

    允许虚拟环境等预防性 glob 模式（venv/*, .venv/*），
    因为这些目录在 CI 环境中可能不存在。
    """

    # 已知的预防性排除模式（目录可能不存在但属于合法配置）
    _PREVENTATIVE_PATTERNS = {"venv/*", ".venv/*"}

    def test_no_dead_file_paths_in_omit(self):
        """coverage omit 中不包含指向不存在具体文件的路径。"""
        data = _load_pyproject()
        omit_patterns = (
            data.get("tool", {}).get("coverage", {}).get("run", {}).get("omit", [])
        )

        for pattern in omit_patterns:
            if pattern in self._PREVENTATIVE_PATTERNS:
                continue
            matched = list(PROJECT_ROOT.glob(pattern))
            assert len(matched) > 0, (
                f"coverage omit 包含 '{pattern}'，但项目中不存在匹配的文件"
            )


class TestNoUnusedRuntimeDeps:
    """运行时依赖列表中不应包含已确认未使用的包。"""

    def test_scrapy_not_in_runtime_deps(self):
        """scrapy 不在运行时依赖列表中。"""
        data = _load_pyproject()
        deps = data.get("project", {}).get("dependencies", [])
        dep_names = [re.split(r"[><=!~[;\s]", d)[0] for d in deps]

        assert "scrapy" not in dep_names, (
            "scrapy 仍在运行时依赖中，但源码中无任何 import scrapy"
        )

    def test_platformdirs_not_in_runtime_deps(self):
        """platformdirs 不在运行时依赖列表中（源码中无任何 import platformdirs）。"""
        data = _load_pyproject()
        deps = data.get("project", {}).get("dependencies", [])
        dep_names = [re.split(r"[><=!~[;\s]", d)[0] for d in deps]

        assert "platformdirs" not in dep_names, (
            "platformdirs 仍在运行时依赖中，但源码中无任何 import platformdirs，"
            "其功能已由 pydantic-settings 的 YAML 自定义路径机制替代"
        )


class TestDoclingNotInOptionalDeps:
    """docling 已列入核心依赖，不应再出现在 optional-dependencies 中造成重复声明。"""

    def test_docling_not_in_optional_deps(self):
        """docling 不在 optional-dependencies 中（避免 DRY 违规与配置混淆）。"""
        data = _load_pyproject()
        opt_deps = data.get("project", {}).get("optional-dependencies", {})

        assert "docling" not in opt_deps, (
            "docling 出现在 optional-dependencies 中，但其已在 dependencies 中声明为核心依赖，"
            "重复声明违反 DRY 原则并向用户传递混淆信号"
        )


class TestMypyConfigUnified:
    """mypy 配置应统一在 pyproject.toml 中，mypy.ini 不应存在（避免配置分裂）。"""

    def test_mypy_ini_not_present(self):
        """mypy.ini 文件不存在；所有 mypy 配置已迁移至 pyproject.toml [tool.mypy]。"""
        mypy_ini = PROJECT_ROOT / "mypy.ini"

        assert not mypy_ini.exists(), (
            "mypy.ini 仍存在，与 pyproject.toml [tool.mypy] 形成配置分裂（Split-Brain）。"
            "请将 mypy.ini 中的第三方库 stub 配置迁移至 [[tool.mypy.overrides]] 并删除该文件。"
        )

    def test_mypy_overrides_present_in_pyproject(self):
        """pyproject.toml 中包含 [[tool.mypy.overrides]] 块以声明第三方库 stub 豁免。"""
        data = _load_pyproject()
        overrides = data.get("tool", {}).get("mypy", {}).get("overrides", [])

        assert len(overrides) > 0, (
            "pyproject.toml [tool.mypy] 中缺少 [[tool.mypy.overrides]] 配置，"
            "第三方库 ignore_missing_imports 声明应通过 overrides 管理"
        )
