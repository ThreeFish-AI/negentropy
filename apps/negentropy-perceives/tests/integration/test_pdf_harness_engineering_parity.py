"""集成测试：harness-engineering 学术论文 PDF → Markdown 一比一还原回归。

将 baseline Markdown 与预期特征签名（``expected_signature.json``）做计数级
对比，保护后续改动不退化。本测试不存全文 Markdown 做 golden（仓库体积），
仅存可量化的特征签名（counts + MD5 + 必须/禁止子串）。

执行方式（默认 CI 跳过，本地按需）::

    uv run pytest -m "integration and slow" tests/integration/test_pdf_harness_engineering_parity.py -v

PDF 源在仓库外（私人 paper 库），仅在本地存在时运行；CI 由 ``-m "not slow"``
默认过滤。
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

PDF_PATH = Path(
    "/Users/cm.huang/Documents/projects/aurelius/negentropy/assets/papers/source/harness-engineering/50714_Agent_Harness_Engineerin.pdf"
)
SIGNATURE_PATH = (
    Path(__file__).resolve().parent.parent
    / "fixtures"
    / "pdf"
    / "harness-engineering"
    / "expected_signature.json"
)


pytestmark = [
    pytest.mark.integration,
    pytest.mark.slow,
    pytest.mark.skipif(
        not PDF_PATH.exists(),
        reason=f"PDF fixture not available at {PDF_PATH} (local-only resource)",
    ),
]


def _within_tolerance(actual: int, expected: int, tolerance_pct: float) -> bool:
    """检查 actual 是否在 expected 的容差范围内。"""
    if expected == 0:
        return actual <= max(1, int(tolerance_pct))
    deviation = abs(actual - expected) / expected
    return deviation <= tolerance_pct / 100.0


@pytest.fixture(scope="module")
def expected_signature() -> dict:
    return json.loads(SIGNATURE_PATH.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
async def pipeline_result():
    """运行完整 Pipeline 并返回结果。仅运行一次，模块内多测共享。"""
    from negentropy.perceives.pipeline.convenience import run_pdf_pipeline

    result = await run_pdf_pipeline(
        source=str(PDF_PATH),
        page_range=None,
        extract_images=True,
        extract_tables=True,
        extract_formulas=True,
    )
    assert result.success, f"Pipeline 失败: {result.error}"
    return result


def _features(md: str) -> dict:
    """从 Markdown 提取特征。"""
    return {
        "word_count": len(re.findall(r"\b\w+\b", md)),
        "h1": len(re.findall(r"^# [^#]", md, re.M)),
        "h2": len(re.findall(r"^## [^#]", md, re.M)),
        "h3": len(re.findall(r"^### [^#]", md, re.M)),
        "h4": len(re.findall(r"^#### [^#]", md, re.M)),
        "image_refs": len(re.findall(r"!\[[^\]]*\]\(", md)),
        "hyphenation_artifacts": len(re.findall(r"[a-z]- [a-z]", md)),
    }


class TestHarnessEngineeringParity:
    """harness-engineering survey PDF 端到端回归。"""

    async def test_pipeline_success_and_basic_counts(
        self, pipeline_result, expected_signature
    ):
        sig = expected_signature
        assert _within_tolerance(
            pipeline_result.word_count,
            sig["word_count"],
            sig["word_count_tolerance_pct"],
        ), (
            f"word_count out of tolerance: "
            f"actual={pipeline_result.word_count} expected={sig['word_count']} "
            f"tolerance={sig['word_count_tolerance_pct']}%"
        )
        assert _within_tolerance(
            pipeline_result.tables_count,
            sig["tables_count"],
            sig["tables_count_tolerance_pct"],
        )
        assert _within_tolerance(
            pipeline_result.images_count,
            sig["images_count"],
            sig["images_count_tolerance_pct"],
        )
        assert pipeline_result.code_blocks_count <= sig["code_blocks_count_max"]

    async def test_hyphenation_artifacts_eliminated(
        self, pipeline_result, expected_signature
    ):
        """跨行断字必须完全合并（核心质量指标）。"""
        features = _features(pipeline_result.markdown)
        assert (
            features["hyphenation_artifacts"]
            <= expected_signature["hyphenation_artifacts_max"]
        ), (
            f"Hyphenation artifacts present: {features['hyphenation_artifacts']} "
            f"(see formatter._typography_inner '[a-z]- [a-z]' substitution)"
        )

    async def test_heading_distribution_within_tolerance(
        self, pipeline_result, expected_signature
    ):
        features = _features(pipeline_result.markdown)
        sig_headings = expected_signature["headings"]
        tol = expected_signature["headings_tolerance_pct"]
        for level in ("h1", "h2", "h3", "h4"):
            assert _within_tolerance(features[level], sig_headings[level], tol), (
                f"{level} count out of tolerance: "
                f"actual={features[level]} expected={sig_headings[level]} ±{tol}%"
            )

    async def test_must_contain_critical_anchors(
        self, pipeline_result, expected_signature
    ):
        """关键章节锚点必须存在（标题层级被正确识别）。"""
        for required in expected_signature["quality_invariants"]["must_contain"]:
            assert required in pipeline_result.markdown, (
                f"Missing required anchor: {required!r}"
            )

    async def test_must_not_contain_known_regressions(
        self, pipeline_result, expected_signature
    ):
        """已修复 issue 的特征不得回归。"""
        for forbidden in expected_signature["quality_invariants"]["must_not_contain"]:
            assert forbidden not in pipeline_result.markdown, (
                f"Regression detected: forbidden substring {forbidden!r} "
                f"reappeared (see docs/agents/issue.md ISSUE-094)"
            )

    async def test_image_refs_match_image_count(
        self, pipeline_result, expected_signature
    ):
        features = _features(pipeline_result.markdown)
        assert _within_tolerance(
            features["image_refs"],
            expected_signature["image_ref_md_count"],
            expected_signature["image_ref_md_count_tolerance_pct"],
        )

    async def test_engines_used_includes_expected(
        self, pipeline_result, expected_signature
    ):
        """关键引擎必须参与（mineru 为公式提取，docling 为布局/表格）。"""
        used = set(pipeline_result.engines_used or [])
        for required in ("docling", "pymupdf", "builtin_assembler"):
            assert any(required in u for u in used), (
                f"Required engine {required!r} not in used engines: {used}"
            )
