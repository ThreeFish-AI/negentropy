"""Extraction Schema 单元测试

测试 ExtractionSchema 的格式化、验证和预置 AI Paper Schema。

参考文献:
[1] J. L. Martinez-Rodriguez et al., "Information Extraction with Ontologies,"
    Knowledge-Based Systems, vol. 147, pp. 48–59, 2018.
"""

from __future__ import annotations

import pytest

from negentropy.knowledge.graph.extraction_schema import (
    AI_PAPER_SCHEMA,
    EntityTypeSpec,
    ExtractionSchema,
    RelationTypeSpec,
    get_schema,
)


class TestExtractionSchema:
    """ExtractionSchema 格式化测试"""

    def test_format_entity_types_for_prompt(self):
        schema = ExtractionSchema(
            name="test",
            entity_types=[
                EntityTypeSpec(name="Author", description="A researcher", examples=["Ada Lovelace"]),
                EntityTypeSpec(name="Method", description="A technique"),
            ],
            relation_types=[],
        )
        result = schema.format_entity_types_for_prompt()
        assert "Author" in result
        assert "Method" in result
        assert "Ada Lovelace" in result
        assert "Entity Types" in result

    def test_format_relation_types_for_prompt(self):
        schema = ExtractionSchema(
            name="test",
            entity_types=[],
            relation_types=[
                RelationTypeSpec(
                    name="PROPOSED_BY",
                    source="Method",
                    target="Author",
                    description="The method was proposed by this author",
                ),
            ],
        )
        result = schema.format_relation_types_for_prompt()
        assert "PROPOSED_BY" in result
        assert "Method" in result
        assert "Author" in result
        assert "Relation Types" in result

    def test_format_for_prompt(self):
        schema = ExtractionSchema(
            name="test",
            entity_types=[EntityTypeSpec(name="E1", description="Type 1")],
            relation_types=[RelationTypeSpec(name="R1", source="E1", target="E1", description="Rel 1")],
        )
        result = schema.format_for_prompt()
        assert "Entity Types" in result
        assert "Relation Types" in result
        assert "E1" in result
        assert "R1" in result

    def test_entity_type_names(self):
        schema = ExtractionSchema(
            name="test",
            entity_types=[
                EntityTypeSpec(name="Author", description=""),
                EntityTypeSpec(name="Method", description=""),
            ],
            relation_types=[],
        )
        assert schema.entity_type_names() == {"AUTHOR", "METHOD"}

    def test_relation_type_names(self):
        schema = ExtractionSchema(
            name="test",
            entity_types=[],
            relation_types=[
                RelationTypeSpec(name="PROPOSED_BY", source="", target="", description=""),
                RelationTypeSpec(name="EVALUATED_ON", source="", target="", description=""),
            ],
        )
        assert schema.relation_type_names() == {"PROPOSED_BY", "EVALUATED_ON"}

    def test_frozen(self):
        schema = ExtractionSchema(
            name="test",
            entity_types=[EntityTypeSpec(name="E1", description="")],
            relation_types=[],
        )
        with pytest.raises(AttributeError):
            schema.name = "other"  # type: ignore[misc]


class TestAIPaperSchema:
    """AI Paper 预置 Schema 完整性测试"""

    def test_schema_exists(self):
        assert AI_PAPER_SCHEMA.name == "ai_paper"

    def test_has_entity_types(self):
        names = {et.name for et in AI_PAPER_SCHEMA.entity_types}
        assert "Author" in names
        assert "Method" in names
        assert "Dataset" in names
        assert "Metric" in names
        assert "Result" in names
        assert len(AI_PAPER_SCHEMA.entity_types) >= 7

    def test_has_relation_types(self):
        names = {rt.name for rt in AI_PAPER_SCHEMA.relation_types}
        assert "PROPOSED_BY" in names
        assert "EVALUATED_ON" in names
        assert "OUTPERFORMS" in names
        assert "EXTENDS" in names
        assert len(AI_PAPER_SCHEMA.relation_types) >= 7

    def test_format_produces_valid_prompt(self):
        prompt = AI_PAPER_SCHEMA.format_for_prompt()
        assert len(prompt) > 100
        assert "Author" in prompt
        assert "PROPOSED_BY" in prompt

    def test_relation_types_have_valid_source_target(self):
        entity_names = {et.name for et in AI_PAPER_SCHEMA.entity_types}
        for rt in AI_PAPER_SCHEMA.relation_types:
            assert rt.source in entity_names, f"Relation {rt.name} has invalid source: {rt.source}"
            assert rt.target in entity_names, f"Relation {rt.name} has invalid target: {rt.target}"

    def test_entity_types_have_descriptions(self):
        for et in AI_PAPER_SCHEMA.entity_types:
            assert len(et.description) > 10, f"Entity type {et.name} has insufficient description"


class TestGetSchema:
    """Schema 注册表测试"""

    def test_get_ai_paper_schema(self):
        schema = get_schema("ai_paper")
        assert schema is not None
        assert schema.name == "ai_paper"

    def test_case_insensitive(self):
        schema = get_schema("AI_Paper")
        assert schema is not None

    def test_unknown_schema_returns_none(self):
        assert get_schema("nonexistent") is None

    def test_empty_name_returns_none(self):
        assert get_schema("") is None
