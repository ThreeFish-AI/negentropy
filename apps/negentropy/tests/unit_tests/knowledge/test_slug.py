"""``negentropy.knowledge.slug`` 单元测试

收敛 Wiki Publication / Wiki Entry / Catalog Entry 三处历史 ``_slugify`` /
``_compute_slug`` 重复实现后，本测试是 slugify 行为的单一权威验收点。
前端 ``apps/negentropy-ui/tests/unit/knowledge/wiki-slug.test.ts`` 通过断言
``WIKI_SLUG_PATTERN`` 字符串值与本文件保持前后端 SSOT。
"""

from __future__ import annotations

from negentropy.knowledge.slug import (
    DEFAULT_SLUG,
    SLUG_PATTERN,
    compute_slug,
    is_valid_slug,
    slugify,
)


class TestSlugify:
    def test_basic_text(self):
        assert slugify("Hello World") == "hello-world"

    def test_already_valid_slug(self):
        assert slugify("my-page") == "my-page"

    def test_special_chars_collapsed(self):
        assert slugify("Hello!! World@@") == "hello-world"

    def test_multiple_spaces_collapsed(self):
        assert slugify("Hello   World") == "hello-world"

    def test_chinese_returns_default_after_strip(self):
        # NFKC 归一不会将中文字符映射到 [a-z0-9]，故全为非法字符 → fallback
        assert slugify("技术文档") == DEFAULT_SLUG

    def test_chinese_mixed_with_ascii(self):
        assert slugify("中文 docs Hub") == "docs-hub"

    def test_empty_string_returns_default(self):
        assert slugify("") == DEFAULT_SLUG

    def test_none_safe(self):
        assert slugify(None) == DEFAULT_SLUG  # type: ignore[arg-type]

    def test_only_special_chars(self):
        assert slugify("!@#$%") == DEFAULT_SLUG

    def test_leading_trailing_dashes_stripped(self):
        assert slugify("---abc---") == "abc"


class TestIsValidSlug:
    def test_valid_lowercase(self):
        assert is_valid_slug("abc-def") is True

    def test_valid_with_digits(self):
        assert is_valid_slug("docs-2024") is True

    def test_invalid_uppercase(self):
        assert is_valid_slug("Abc") is False

    def test_invalid_space(self):
        assert is_valid_slug("a b") is False

    def test_invalid_leading_dash(self):
        assert is_valid_slug("-abc") is False

    def test_invalid_trailing_dash(self):
        assert is_valid_slug("abc-") is False

    def test_invalid_double_dash(self):
        assert is_valid_slug("a--b") is False

    def test_empty_invalid(self):
        assert is_valid_slug("") is False

    def test_pattern_value_stable(self):
        # SSOT 锚点：值发生变化必须同步前端 wiki-slug.ts。
        assert SLUG_PATTERN == "^[a-z0-9]+(?:-[a-z0-9]+)*$"


class TestComputeSlug:
    def test_uses_override_when_provided(self):
        # override 即便不规范也原样返回（由调用方再做 is_valid_slug 校验）
        assert compute_slug("My Title", "custom-slug") == "custom-slug"

    def test_falls_back_to_slugify_when_override_empty(self):
        assert compute_slug("My Title", None) == "my-title"
        assert compute_slug("My Title", "") == "my-title"
