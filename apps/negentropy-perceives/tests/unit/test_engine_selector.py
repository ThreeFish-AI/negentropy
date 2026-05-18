"""``EngineSelector`` 单元测试。

覆盖 IdentitySelector 与 ProfileAwareSelector 的全部决策规则。
"""

from __future__ import annotations

from negentropy.perceives.pipeline.engine_selector import (
    IdentitySelector,
    ProfileAwareSelector,
    SelectionContext,
    build_selector,
)
from negentropy.perceives.pipeline.models import DocumentCharacteristics


# ============================================================
# IdentitySelector
# ============================================================
class TestIdentitySelector:
    def test_preserves_yaml_order(self) -> None:
        s = IdentitySelector()
        tools = [
            {"name": "docling", "rank": 1},
            {"name": "pymupdf", "rank": 2},
        ]
        d = s.select("table_extraction", tools, SelectionContext())
        assert not d.skip
        assert d.tools == tools
        assert d.reason == "identity"

    def test_never_skips_even_without_features(self) -> None:
        s = IdentitySelector()
        chars = DocumentCharacteristics(page_count=10, has_tables=False)
        d = s.select(
            "table_extraction",
            [{"name": "docling"}],
            SelectionContext(characteristics=chars),
        )
        assert not d.skip


# ============================================================
# ProfileAwareSelector — Stage skip 规则
# ============================================================
class TestProfileAwareSkip:
    def test_skip_table_when_no_tables(self) -> None:
        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(has_tables=False)
        d = s.select(
            "table_extraction",
            [{"name": "docling"}],
            SelectionContext(characteristics=chars),
        )
        assert d.skip is True
        assert "no_has_tables" in d.reason

    def test_skip_formula_when_no_formulas(self) -> None:
        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(has_formulas=False)
        d = s.select(
            "formula_extraction",
            [{"name": "mineru"}],
            SelectionContext(characteristics=chars),
        )
        assert d.skip is True

    def test_skip_code_when_no_code_blocks(self) -> None:
        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(has_code_blocks=False)
        d = s.select(
            "code_detection",
            [{"name": "docling"}],
            SelectionContext(characteristics=chars),
        )
        assert d.skip is True

    def test_skip_image_when_no_images(self) -> None:
        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(has_images=False)
        d = s.select(
            "image_extraction",
            [{"name": "pymupdf"}],
            SelectionContext(characteristics=chars),
        )
        assert d.skip is True

    def test_no_skip_when_feature_present(self) -> None:
        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(has_tables=True)
        d = s.select(
            "table_extraction",
            [{"name": "docling"}],
            SelectionContext(characteristics=chars),
        )
        assert d.skip is False


# ============================================================
# ProfileAwareSelector — text_extraction 路由
# ============================================================
class TestProfileAwareTextExtraction:
    DEFAULT_TOOLS = [
        {"name": "pymupdf", "rank": 1},
        {"name": "opendataloader", "rank": 2},
        {"name": "docling", "rank": 3},
        {"name": "pypdf", "rank": 4},
    ]

    def test_scanned_prefers_marker_docling(self) -> None:
        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(page_count=80, is_scanned=True)
        d = s.select(
            "text_extraction",
            self.DEFAULT_TOOLS,
            SelectionContext(characteristics=chars),
        )
        assert d.skip is False
        # 当 marker 不在 default_tools 中，docling 应排第一
        assert d.tools[0]["name"] == "docling"
        assert "scanned" in d.reason

    def test_scanned_with_marker_first(self) -> None:
        s = ProfileAwareSelector()
        tools = [
            {"name": "pymupdf", "rank": 1},
            {"name": "marker", "rank": 2},
            {"name": "docling", "rank": 3},
        ]
        chars = DocumentCharacteristics(page_count=80, is_scanned=True)
        d = s.select(
            "text_extraction",
            tools,
            SelectionContext(characteristics=chars),
        )
        # marker 在偏好顺序中排首位
        assert d.tools[0]["name"] == "marker"

    def test_small_doc_fast_path(self) -> None:
        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(page_count=3, is_scanned=False)
        d = s.select(
            "text_extraction",
            self.DEFAULT_TOOLS,
            SelectionContext(characteristics=chars),
        )
        assert d.skip is False
        assert len(d.tools) == 1
        assert d.tools[0]["name"] == "pymupdf"
        assert "small_doc" in d.reason

    def test_normal_doc_falls_back_to_yaml(self) -> None:
        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(page_count=30, is_scanned=False)
        d = s.select(
            "text_extraction",
            self.DEFAULT_TOOLS,
            SelectionContext(characteristics=chars),
        )
        assert d.tools == self.DEFAULT_TOOLS

    def test_small_scanned_doc_still_uses_scanned_rule(self) -> None:
        """扫描规则优先于小文档规则。"""
        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(page_count=3, is_scanned=True)
        d = s.select(
            "text_extraction",
            self.DEFAULT_TOOLS,
            SelectionContext(characteristics=chars),
        )
        # 扫描分支应包含完整重排
        assert len(d.tools) == len(self.DEFAULT_TOOLS)
        assert "scanned" in d.reason


# ============================================================
# ProfileAwareSelector — layout_analysis 路由
# ============================================================
class TestProfileAwareLayoutAnalysis:
    DEFAULT_TOOLS = [
        {"name": "docling", "rank": 1},
        {"name": "opendataloader", "rank": 2},
        {"name": "mineru", "rank": 3},
        {"name": "marker", "rank": 4},
        {"name": "pymupdf", "rank": 5},
    ]

    def test_small_simple_doc_fast_path(self) -> None:
        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(
            page_count=3, has_complex_layout=False, is_scanned=False
        )
        d = s.select(
            "layout_analysis",
            self.DEFAULT_TOOLS,
            SelectionContext(characteristics=chars),
        )
        assert d.skip is False
        assert len(d.tools) == 1
        assert d.tools[0]["name"] == "pymupdf"

    def test_complex_layout_keeps_yaml(self) -> None:
        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(
            page_count=3, has_complex_layout=True, is_scanned=False
        )
        d = s.select(
            "layout_analysis",
            self.DEFAULT_TOOLS,
            SelectionContext(characteristics=chars),
        )
        assert d.tools == self.DEFAULT_TOOLS

    def test_large_doc_keeps_yaml(self) -> None:
        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(
            page_count=80, has_complex_layout=False, is_scanned=False
        )
        d = s.select(
            "layout_analysis",
            self.DEFAULT_TOOLS,
            SelectionContext(characteristics=chars),
        )
        assert d.tools == self.DEFAULT_TOOLS

    def test_scanned_keeps_yaml(self) -> None:
        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(
            page_count=3, has_complex_layout=False, is_scanned=True
        )
        d = s.select(
            "layout_analysis",
            self.DEFAULT_TOOLS,
            SelectionContext(characteristics=chars),
        )
        # 扫描版仍走完整 layout 引擎链
        assert d.tools == self.DEFAULT_TOOLS


# ============================================================
# ProfileAwareSelector — 缺失 characteristics 保守回退
# ============================================================
class TestProfileAwareFallback:
    def test_missing_characteristics_returns_default(self) -> None:
        s = ProfileAwareSelector()
        tools = [{"name": "docling"}]
        d = s.select("table_extraction", tools, SelectionContext())
        assert d.skip is False
        assert d.tools == tools
        assert "missing_characteristics" in d.reason

    def test_unknown_stage_returns_default(self) -> None:
        s = ProfileAwareSelector()
        chars = DocumentCharacteristics(page_count=10)
        tools = [{"name": "foo"}]
        d = s.select("unknown_stage", tools, SelectionContext(characteristics=chars))
        assert d.skip is False
        assert d.tools == tools


# ============================================================
# build_selector 工厂
# ============================================================
class TestBuildSelector:
    def test_identity(self) -> None:
        s = build_selector("identity")
        assert isinstance(s, IdentitySelector)

    def test_profile_aware(self) -> None:
        s = build_selector("profile_aware")
        assert isinstance(s, ProfileAwareSelector)

    def test_default_from_settings(self) -> None:
        # 默认应是 profile_aware
        s = build_selector()
        assert isinstance(s, ProfileAwareSelector)

    def test_unknown_policy_falls_back_to_profile_aware(self) -> None:
        s = build_selector("unknown_xyz")
        assert isinstance(s, ProfileAwareSelector)
