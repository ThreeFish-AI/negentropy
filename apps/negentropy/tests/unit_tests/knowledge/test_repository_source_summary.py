from negentropy.knowledge.repository import KnowledgeRepository


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
