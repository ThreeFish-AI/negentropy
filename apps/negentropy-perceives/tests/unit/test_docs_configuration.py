"""配置环境变量一致性测试。

原 configuration.md 已删除，环境变量一致性验证现针对 user-guide.md
（环境变量完整参考章节）。
"""

import re

import pytest

from negentropy.perceives.config import NegentropyPerceivesSettings
from tests.unit.doc_contracts import read_doc

# 环境变量表格已迁移至 user-guide.md
ENV_VAR_DOC = "user-guide.md"

# NegentropyPerceivesSettings 中非配置元字段（model_config 等不映射为环境变量）
_EXCLUDED_FIELDS = {"model_config"}

# 从 NegentropyPerceivesSettings 的 model_fields 中推导 NEGENTROPY_PERCEIVES_* 环境变量名
_SETTINGS_ENV_VARS: set[str] = {
    f"NEGENTROPY_PERCEIVES_{name.upper()}"
    for name in NegentropyPerceivesSettings.model_fields
    if name not in _EXCLUDED_FIELDS
}


@pytest.fixture(scope="module")
def env_var_doc_content() -> str:
    """读取环境变量参考所在的 user-guide.md 内容。"""
    return read_doc(ENV_VAR_DOC)


class TestEnvVarConsistency:
    """user-guide.md 中环境变量与代码实现的一致性验证。"""

    ENV_VAR_PATTERN = re.compile(r"`(NEGENTROPY_PERCEIVES_\w+)`")

    def test_doc_covers_all_code_env_vars(self, env_var_doc_content: str):
        """user-guide.md 覆盖 config.py 中所有配置字段对应的环境变量。"""
        doc_vars = set(self.ENV_VAR_PATTERN.findall(env_var_doc_content))
        missing = _SETTINGS_ENV_VARS - doc_vars
        assert missing == set(), (
            f"以下环境变量在 config.py 中定义但 user-guide.md 未记录: {sorted(missing)}"
        )

    # 元配置环境变量列表（已移除 .env 支持，当前为空）
    _META_ENV_VARS: set[str] = set()

    def test_doc_env_vars_exist_in_code(self, env_var_doc_content: str):
        """user-guide.md 中引用的环境变量在 config.py 中有对应字段。"""
        doc_vars = set(self.ENV_VAR_PATTERN.findall(env_var_doc_content))
        extra = doc_vars - _SETTINGS_ENV_VARS - self._META_ENV_VARS
        assert extra == set(), (
            f"以下环境变量在 user-guide.md 中出现但 config.py 中无对应字段: {sorted(extra)}"
        )


class TestConfigGroupCompleteness:
    """user-guide.md 表格对 config.py 字段的覆盖完整性验证。"""

    TABLE_ROW_PATTERN = re.compile(
        r"^\| `NEGENTROPY_PERCEIVES_(\w+)`\s+\|", re.MULTILINE
    )

    def test_all_fields_in_tables(self, env_var_doc_content: str):
        """user-guide.md 表格行覆盖 config.py 中所有配置字段。"""
        table_fields = {
            match.lower()
            for match in self.TABLE_ROW_PATTERN.findall(env_var_doc_content)
        }
        code_fields = {
            name
            for name in NegentropyPerceivesSettings.model_fields
            if name not in _EXCLUDED_FIELDS
        }
        missing = code_fields - table_fields
        assert missing == set(), (
            f"以下字段在 config.py 中定义但未出现在 user-guide.md 表格中: {sorted(missing)}"
        )
