from negentropy.knowledge.retrieval.repository import KnowledgeRepository


def test_infer_display_name_prefers_non_empty_original_filename():
    assert (
        KnowledgeRepository._infer_display_name(
            {"original_filename": "Q1 Report 2026 final.pdf"},
        )
        == "Q1 Report 2026 final.pdf"
    )


def test_infer_display_name_ignores_blank_or_invalid_values():
    assert KnowledgeRepository._infer_display_name({"original_filename": "   "}) is None
    assert KnowledgeRepository._infer_display_name({"original_filename": 123}) is None
    assert KnowledgeRepository._infer_display_name({}) is None
    assert KnowledgeRepository._infer_display_name(None) is None


def test_infer_display_name_prefers_display_name_over_original_filename():
    """用户重命名覆盖（display_name）优先于 original_filename（chunk metadata 回填后）。"""
    assert (
        KnowledgeRepository._infer_display_name(
            {"display_name": "Q3 Report", "original_filename": "ugly-hash.pdf"},
        )
        == "Q3 Report"
    )


def test_infer_display_name_falls_back_to_original_when_display_name_blank():
    """display_name 为空 / 非字符串时回退到 original_filename。"""
    assert (
        KnowledgeRepository._infer_display_name(
            {"display_name": "   ", "original_filename": "fallback.pdf"},
        )
        == "fallback.pdf"
    )
    assert (
        KnowledgeRepository._infer_display_name(
            {"display_name": 123, "original_filename": "fallback.pdf"},
        )
        == "fallback.pdf"
    )
