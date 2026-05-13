"""KG 实体抽取后置校验单元测试（extraction_validator）

覆盖：
  1. known_entities 白名单覆盖（Claude/person → product）
  2. AI 产品 regex 兜底（型号变体 + 仅对 person 生效）
  3. 密度截断（按 chunk 字符数动态上限 + 按 confidence 降序保留）
  4. 边界与容错
  5. ``_parse_entity_response`` 端到端集成（验证 metadata 透传与 stats 回写）
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest

from negentropy.knowledge.graph.extraction_validator import (
    AI_PRODUCT_PATTERN,
    ChunkExtractionStats,
    apply_type_overrides,
    compute_max_entities,
    enforce_density_cap,
    load_known_entities,
)


@dataclass
class _FakeResult:
    """符合 enforce_density_cap 协议的最小实现（带 confidence）。"""

    name: str
    confidence: float


# ────────────────────────── known_entities 加载 ──────────────────────────


class TestLoadKnownEntities:
    def test_known_entities_yaml_loaded_with_aliases(self) -> None:
        """从仓库内 known_entities.yml 加载，应至少命中 Claude / Anthropic 等典型 case。"""
        load_known_entities.cache_clear()
        table = load_known_entities()

        assert "claude" in table
        assert table["claude"] == ("Claude", "product")
        # 别名同样命中
        assert "claude 3.5" in table
        assert table["claude 3.5"] == ("Claude", "product")

        assert "anthropic" in table
        assert table["anthropic"] == ("Anthropic", "organization")

    def test_load_missing_file_returns_empty(self, tmp_path) -> None:
        """缺失白名单文件时应静默降级为空表（不影响主流程）。"""
        load_known_entities.cache_clear()
        missing = tmp_path / "not_exists.yml"
        assert load_known_entities(missing) == {}
        load_known_entities.cache_clear()


# ────────────────────────── apply_type_overrides ──────────────────────────


class TestApplyTypeOverrides:
    def setup_method(self) -> None:
        load_known_entities.cache_clear()

    def test_known_entity_override_person_to_product(self) -> None:
        """核心场景：Claude 被 LLM 标为 person，白名单改判为 product。"""
        corrected, source = apply_type_overrides("Claude", "person")
        assert corrected == "product"
        assert source == "known_entities"

    def test_known_entity_alias_case_insensitive(self) -> None:
        corrected, source = apply_type_overrides("claude 3.5", "person")
        assert corrected == "product"
        assert source == "known_entities"

    def test_known_entity_no_change_when_already_correct(self) -> None:
        """LLM 已给出正确类型时不动也不标 override。"""
        corrected, source = apply_type_overrides("Claude", "product")
        assert corrected == "product"
        assert source is None

    def test_regex_fallback_for_unseen_ai_product(self) -> None:
        """型号变体（白名单未列）+ LLM 标 person → 正则兜底为 product。"""
        corrected, source = apply_type_overrides("Claude 3.7 Sonnet", "person")
        assert corrected == "product"
        assert source == "regex_rule"

    def test_regex_does_not_touch_non_person_types(self) -> None:
        """LLM 标的不是 person 时不触发正则兜底（避免误改 concept 等）。"""
        corrected, source = apply_type_overrides("Claude 3.7 Sonnet", "concept")
        assert corrected == "concept"
        assert source is None

    def test_real_person_not_misclassified(self) -> None:
        """真人名（不匹配 AI 产品 regex）保持 person 类型。"""
        corrected, source = apply_type_overrides("Sam Altman", "person")
        assert corrected == "person"
        assert source is None

    def test_empty_name_returns_unchanged(self) -> None:
        corrected, source = apply_type_overrides("", "person")
        assert corrected == "person"
        assert source is None

    def test_ai_product_pattern_explicit_cases(self) -> None:
        """直接验证正则覆盖范围，避免回归。"""
        assert AI_PRODUCT_PATTERN.match("Claude")
        assert AI_PRODUCT_PATTERN.match("GPT-4")
        assert AI_PRODUCT_PATTERN.match("ChatGPT")
        assert AI_PRODUCT_PATTERN.match("Gemini Pro")
        assert AI_PRODUCT_PATTERN.match("Llama 3.1")
        assert AI_PRODUCT_PATTERN.match("o1-preview")
        # 真人名不应命中
        assert not AI_PRODUCT_PATTERN.match("Sam Altman")
        assert not AI_PRODUCT_PATTERN.match("Yann LeCun")


# ────────────────────────── 密度截断 ──────────────────────────


class TestEnforceDensityCap:
    def test_compute_max_entities_formula(self) -> None:
        assert compute_max_entities(1000) == 5  # 1000 // 200
        assert compute_max_entities(1137) == 5  # chunk 6 复现：1137 // 200 = 5
        assert compute_max_entities(2400) == 12
        # 下界保护
        assert compute_max_entities(200) == 3
        assert compute_max_entities(0) == 3
        assert compute_max_entities(50) == 3

    def test_below_cap_passes_through(self) -> None:
        results = [_FakeResult(f"e{i}", 0.9) for i in range(3)]
        kept, dropped = enforce_density_cap(results, chunk_len=1000)
        assert len(kept) == 3
        assert dropped == 0

    def test_above_cap_truncates_by_confidence(self) -> None:
        """超出上限时按 confidence 降序保留。"""
        results = [
            _FakeResult("low", 0.2),
            _FakeResult("hi1", 0.95),
            _FakeResult("mid", 0.6),
            _FakeResult("hi2", 0.9),
            _FakeResult("very_low", 0.1),
        ]
        # chunk_len=400 → cap = max(3, 2) = 3
        kept, dropped = enforce_density_cap(results, chunk_len=400)
        assert dropped == 2
        assert len(kept) == 3
        kept_names = {r.name for r in kept}
        assert kept_names == {"hi1", "hi2", "mid"}

    def test_chunk_6_reproduction(self) -> None:
        """复现实际 issue：1137 字符 + 16 实体 → 截断到 5。"""
        results = [_FakeResult(f"e{i}", 0.9 - i * 0.01) for i in range(16)]
        kept, dropped = enforce_density_cap(results, chunk_len=1137)
        assert len(kept) == 5
        assert dropped == 11
        # 应保留 confidence 最高的前 5 个（按 confidence 降序后）
        assert {r.name for r in kept} == {"e0", "e1", "e2", "e3", "e4"}

    def test_stable_sort_keeps_original_order_for_ties(self) -> None:
        """相同 confidence 时保留原 index 较小者，输出按原序。"""
        results = [_FakeResult(f"e{i}", 0.5) for i in range(5)]
        kept, _ = enforce_density_cap(results, chunk_len=400)  # cap=3
        assert [r.name for r in kept] == ["e0", "e1", "e2"]

    def test_empty_list(self) -> None:
        kept, dropped = enforce_density_cap([], chunk_len=1000)
        assert kept == []
        assert dropped == 0


# ────────────────────────── ChunkExtractionStats ──────────────────────────


class TestChunkExtractionStats:
    def test_default_values(self) -> None:
        stats = ChunkExtractionStats()
        assert stats.type_override_count == 0
        assert stats.density_truncated is False
        assert stats.density_dropped_count == 0
        assert stats.entity_density_per_kchar == 0.0

    def test_fields_are_mutable(self) -> None:
        """Stats 必须可变以便 extractor 写入累加。"""
        stats = ChunkExtractionStats()
        stats.type_override_count += 1
        stats.density_truncated = True
        assert stats.type_override_count == 1
        assert stats.density_truncated is True


# ────────────────────────── _parse_entity_response 集成 ──────────────────────────


class TestParseEntityResponseIntegration:
    """验证 validator 与 LLMEntityExtractor._parse_entity_response 的端到端衔接。"""

    def setup_method(self) -> None:
        load_known_entities.cache_clear()

    def test_claude_person_corrected_in_parse(self) -> None:
        """LLM 输出 Claude/person，解析后应改判为 product 并在 metadata 标记 override 源。"""
        import json

        from negentropy.knowledge.graph.extractors import LLMEntityExtractor

        extractor = LLMEntityExtractor(fallback_to_regex=False)
        payload = json.dumps(
            {
                "entities": [
                    {"name": "Claude", "type": "person", "confidence": 0.9},
                    {"name": "Sam Altman", "type": "person", "confidence": 0.85},
                ]
            }
        )
        stats = ChunkExtractionStats()
        results = extractor._parse_entity_response(payload, chunk_len=500, stats=stats)

        names = {r.name: r for r in results}
        assert names["Claude"].entity_type == "product"
        assert names["Claude"].metadata["type_override_source"] == "known_entities"
        assert names["Claude"].metadata["original_type"] == "person"
        # 真人名不应被改
        assert names["Sam Altman"].entity_type == "person"
        assert "type_override_source" not in names["Sam Altman"].metadata
        # stats 已累加
        assert stats.type_override_count == 1

    def test_density_truncation_in_parse(self) -> None:
        """解析阶段对超密度 chunk 应触发截断并填充 stats。"""
        import json

        from negentropy.knowledge.graph.extractors import LLMEntityExtractor

        extractor = LLMEntityExtractor(fallback_to_regex=False)
        entities = [{"name": f"Entity{i}", "type": "concept", "confidence": 0.9 - i * 0.01} for i in range(16)]
        payload = json.dumps({"entities": entities})
        stats = ChunkExtractionStats()

        # 复现 chunk 6：1137 字符上限 5
        results = extractor._parse_entity_response(payload, chunk_len=1137, stats=stats)
        assert len(results) == 5
        assert stats.density_truncated is True
        assert stats.density_dropped_count == 11
        assert stats.entity_density_per_kchar == pytest.approx(5 / 1137 * 1000, rel=1e-3)

    def test_chunk_len_zero_disables_truncation(self) -> None:
        """chunk_len=0（ad-hoc 调用）时不应截断。"""
        import json

        from negentropy.knowledge.graph.extractors import LLMEntityExtractor

        extractor = LLMEntityExtractor(fallback_to_regex=False)
        entities = [{"name": f"Entity{i}", "type": "concept", "confidence": 0.9} for i in range(10)]
        payload = json.dumps({"entities": entities})
        results = extractor._parse_entity_response(payload, chunk_len=0, stats=None)
        assert len(results) == 10
