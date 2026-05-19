"""
单元测试：examples 目录
测试提取配置构建器、配置完整性和基础用法示例。
"""

import pytest

from negentropy.perceives.examples.configs.extraction_configs import (
    ACADEMIC_PAPER_CONFIG,
    CONTACT_PAGE_CONFIG,
    ECOMMERCE_CONFIG,
    EVENT_LISTING_CONFIG,
    EXTRACTION_CONFIGS,
    FORUM_POST_CONFIG,
    JOB_LISTING_CONFIG,
    NEWS_ARTICLE_CONFIG,
    REAL_ESTATE_CONFIG,
    RESTAURANT_MENU_CONFIG,
    SOCIAL_PROFILE_CONFIG,
    _attr,
    _attr_list,
    _text,
    _text_list,
    get_config_for_site_type,
)


# ---------------------------------------------------------------------------
# 字段构建器
# ---------------------------------------------------------------------------
class TestFieldBuilders:
    """测试字段构建器函数"""

    def test_text_returns_single_text_field(self):
        result = _text(".selector")
        assert result == {"selector": ".selector", "attr": "text", "multiple": False}

    def test_text_list_returns_multiple_text_field(self):
        result = _text_list(".items li")
        assert result == {"selector": ".items li", "attr": "text", "multiple": True}

    def test_attr_returns_single_attribute_field(self):
        result = _attr("img", "src")
        assert result == {"selector": "img", "attr": "src", "multiple": False}

    def test_attr_list_returns_multiple_attribute_field(self):
        result = _attr_list("a", "href")
        assert result == {"selector": "a", "attr": "href", "multiple": True}


# ---------------------------------------------------------------------------
# 配置结构完整性
# ---------------------------------------------------------------------------
ALL_CONFIGS = [
    ECOMMERCE_CONFIG,
    NEWS_ARTICLE_CONFIG,
    SOCIAL_PROFILE_CONFIG,
    JOB_LISTING_CONFIG,
    REAL_ESTATE_CONFIG,
    RESTAURANT_MENU_CONFIG,
    ACADEMIC_PAPER_CONFIG,
    FORUM_POST_CONFIG,
    EVENT_LISTING_CONFIG,
    CONTACT_PAGE_CONFIG,
]


class TestExtractionConfigStructure:
    """测试所有配置常量的结构完整性"""

    @pytest.mark.parametrize("config", ALL_CONFIGS)
    def test_config_is_non_empty_dict(self, config):
        assert isinstance(config, dict)
        assert len(config) > 0

    @pytest.mark.parametrize("config", ALL_CONFIGS)
    def test_every_field_has_required_keys(self, config):
        for field_name, field_def in config.items():
            assert "selector" in field_def, f"{field_name} 缺少 selector"
            assert "attr" in field_def, f"{field_name} 缺少 attr"
            assert "multiple" in field_def, f"{field_name} 缺少 multiple"

    @pytest.mark.parametrize("config", ALL_CONFIGS)
    def test_selector_is_nonempty_string(self, config):
        for field_name, field_def in config.items():
            assert isinstance(field_def["selector"], str), f"{field_name}"
            assert len(field_def["selector"]) > 0, f"{field_name} selector 为空"

    @pytest.mark.parametrize("config", ALL_CONFIGS)
    def test_multiple_is_boolean(self, config):
        for field_name, field_def in config.items():
            assert isinstance(field_def["multiple"], bool), f"{field_name}"


# ---------------------------------------------------------------------------
# 配置注册表
# ---------------------------------------------------------------------------
EXPECTED_KEYS = [
    "ecommerce",
    "news",
    "social",
    "jobs",
    "realestate",
    "restaurant",
    "academic",
    "forum",
    "events",
    "contact",
]


class TestExtractionConfigRegistry:
    """测试配置注册表"""

    def test_registry_contains_all_10_configs(self):
        assert len(EXTRACTION_CONFIGS) == 10

    @pytest.mark.parametrize("key", EXPECTED_KEYS)
    def test_registry_key_exists(self, key):
        assert key in EXTRACTION_CONFIGS

    def test_get_config_for_valid_type(self):
        config = get_config_for_site_type("ecommerce")
        assert config is ECOMMERCE_CONFIG

    def test_get_config_case_insensitive(self):
        assert get_config_for_site_type("ECOMMERCE") is ECOMMERCE_CONFIG
        assert get_config_for_site_type("News") is NEWS_ARTICLE_CONFIG

    def test_get_config_for_invalid_type_returns_none(self):
        assert get_config_for_site_type("nonexistent") is None


# ---------------------------------------------------------------------------
# 基础用法示例
# ---------------------------------------------------------------------------
class TestBasicUsageExamples:
    """测试基础用法示例"""

    @pytest.mark.asyncio
    async def test_mock_mcp_call_returns_success(self):
        from negentropy.perceives.examples.mcp.basic_usage import mock_mcp_call

        result = await mock_mcp_call("test_tool", {"key": "value"})
        assert result["success"] is True
        assert "data" in result
        assert "duration_ms" in result

    def test_examples_list_has_6_entries(self):
        from negentropy.perceives.examples.mcp.basic_usage import EXAMPLES

        assert len(EXAMPLES) == 6

    def test_python_sdk_example_exists(self):
        from pathlib import Path

        example_path = (
            Path(__file__).resolve().parent.parent.parent
            / "src"
            / "negentropy"
            / "perceives"
            / "examples"
        )
        assert (example_path / "sdk" / "python_sdk_usage.py").exists()

    def test_each_example_is_valid_triple(self):
        from negentropy.perceives.examples.mcp.basic_usage import EXAMPLES

        for item in EXAMPLES:
            assert len(item) == 3
            title, tool_name, params = item
            assert isinstance(title, str) and len(title) > 0
            assert isinstance(tool_name, str) and len(tool_name) > 0
            assert isinstance(params, dict)

    @pytest.mark.asyncio
    async def test_run_example_executes_without_error(self):
        from negentropy.perceives.examples.mcp.basic_usage import _run_example

        await _run_example("Test Title", "test_tool", {"url": "https://example.com"})
