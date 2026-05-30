"""Memory 配置优先级护栏测试（T5）。

锁定一条容易被遗忘、却决定 Memory 运行时行为的不变量：

    **真正生效的是 ``config.default.yaml``，而非 ``config/memory.py`` 的 Field 默认值。**

优先级链（见 ``config/__init__.py`` 与 ``config/_base.py``）::

    init > env vars > YAML chain > field defaults

历史教训（参见 docs/.agents/issue.md「Memify 休眠」）：``MemorySettings`` 的
Python 默认 ``consolidation.steps`` 为 6 步，但 ``config.default.yaml`` 长期锁在
2 步 ``[fact_extract, auto_link]``，导致 6-step Memify 管线虽已实现并接入
``_run_consolidation_pipeline`` 却从未在生产生效。本测试确保：

1. **机制不变量**（合成数据，永不随 YAML 内容漂移）：``memory`` YAML 段一旦提供值，
   即覆盖 Python Field 默认；缺省字段回落到 Field 默认。
2. **生效一致性**（动态读取，随 YAML 内容自适应）：以应用真实加载路径构建的
   ``MemorySettings`` 必须与 ``config.default.yaml`` 声明的 ``memory`` 段一致，
   从而保证"改 YAML 才是改行为"，且任何后续 flag 翻转在运行时确实落地。
"""

from __future__ import annotations

import pytest
import yaml

from negentropy.config._base import reset_sections, set_yaml_section
from negentropy.config.memory import ConsolidationSettings, MemorySettings
from negentropy.config.yaml_loader import get_default_config_path


@pytest.fixture(autouse=True)
def _clean_sections():
    """每个用例前后清空 YAML 段注册表，避免跨用例污染。"""
    reset_sections()
    yield
    reset_sections()


# ---------------------------------------------------------------------------
# 1. 机制不变量：YAML 段覆盖 Python Field 默认
# ---------------------------------------------------------------------------


class TestYamlOverridesFieldDefaults:
    """合成数据证明优先级链 ``YAML > field defaults`` —— 与具体 YAML 内容解耦。"""

    def test_consolidation_steps_yaml_wins_over_python_default(self):
        """YAML 提供 steps 时覆盖 Python 6 步默认（锁定 Memify 休眠根因）。"""
        # Python field 默认是 6 步
        assert len(ConsolidationSettings().steps) == 6

        # 注入一个与默认不同的 YAML 段
        set_yaml_section(
            "memory",
            {"consolidation": {"steps": ["fact_extract"], "policy": "serial"}},
        )
        s = MemorySettings()
        assert s.consolidation.steps == ["fact_extract"]
        assert s.consolidation.policy == "serial"

    def test_feature_flag_yaml_wins_over_python_default(self):
        """YAML 翻转 enabled flag 时覆盖 Python 默认（证明 flag 翻转可在运行时落地）。"""
        # Python 默认全部关闭
        baseline = MemorySettings()
        assert baseline.hipporag.enabled is False
        assert baseline.relevance.enabled is False
        assert baseline.reflection.enabled is False

        reset_sections()
        set_yaml_section(
            "memory",
            {
                "hipporag": {"enabled": True},
                "relevance": {"enabled": True},
                "reflection": {"enabled": True},
            },
        )
        s = MemorySettings()
        assert s.hipporag.enabled is True
        assert s.relevance.enabled is True
        assert s.reflection.enabled is True

    def test_absent_yaml_field_falls_back_to_python_default(self):
        """YAML 未声明的字段回落到 Python Field 默认（部分覆盖语义）。"""
        set_yaml_section("memory", {"consolidation": {"policy": "fail_tolerant"}})
        s = MemorySettings()
        # policy 取 YAML
        assert s.consolidation.policy == "fail_tolerant"
        # steps 未在 YAML 声明 → 回落到 Python 6 步默认
        assert len(s.consolidation.steps) == 6

    def test_empty_yaml_section_uses_all_python_defaults(self):
        """空 YAML 段时全部回落 Python 默认。"""
        set_yaml_section("memory", {})
        s = MemorySettings()
        assert s.consolidation.policy == ConsolidationSettings().policy
        assert s.pii.engine == "regex"


# ---------------------------------------------------------------------------
# 2. 生效一致性：运行时 MemorySettings == config.default.yaml 声明
# ---------------------------------------------------------------------------


def _load_default_memory_section() -> dict:
    """直接读取打包 ``config.default.yaml`` 的 ``memory`` 段（动态，随内容自适应）。"""
    path = get_default_config_path()
    with open(path) as f:
        data = yaml.safe_load(f)
    return data.get("memory", {})


class TestDefaultYamlIsRuntimeSourceOfTruth:
    """证明 ``config.default.yaml`` 是运行时事实源 —— 动态比对，后续编辑自适应。"""

    def test_default_yaml_has_memory_section(self):
        section = _load_default_memory_section()
        assert section, "config.default.yaml 必须包含 memory 段"
        assert "consolidation" in section

    def test_runtime_consolidation_matches_default_yaml(self):
        """以 default.yaml 的 memory 段构建 MemorySettings，steps/policy 必须一致。"""
        section = _load_default_memory_section()
        set_yaml_section("memory", section)
        s = MemorySettings()

        declared = section.get("consolidation", {})
        if "steps" in declared:
            assert s.consolidation.steps == declared["steps"], (
                "运行时 steps 与 config.default.yaml 声明不一致 —— YAML 应为运行时事实源"
            )
        if "policy" in declared:
            assert s.consolidation.policy == declared["policy"]

    def test_runtime_feature_flags_match_default_yaml(self):
        """default.yaml 中各特性 enabled 与运行时一致（翻转后此测试自动校验落地）。"""
        section = _load_default_memory_section()
        set_yaml_section("memory", section)
        s = MemorySettings()

        for feature in ("hipporag", "reflection", "relevance"):
            declared = section.get(feature, {})
            if "enabled" in declared:
                actual = getattr(s, feature).enabled
                assert actual == declared["enabled"], (
                    f"memory.{feature}.enabled 运行时={actual} 与 config.default.yaml={declared['enabled']} 不一致"
                )

        pii_declared = section.get("pii", {})
        if "engine" in pii_declared:
            assert s.pii.engine == pii_declared["engine"]
