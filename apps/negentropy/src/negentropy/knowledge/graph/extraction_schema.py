"""Schema-Guided Entity Extraction

基于 Martinez-Rodriguez et al. (2018) "Information Extraction with Ontologies" 的
本体约束提取，通过预定义实体/关系类型 Schema 增强 LLM 提取精度。

Cognee ECL Pipeline 在 Cognify 阶段实现了类似的 ontology-based validation。

参考文献:
[1] J. L. Martinez-Rodriguez et al., "Information Extraction with Ontologies,"
    *Knowledge-Based Systems*, vol. 147, pp. 48–59, 2018.
[2] S. Vashishth et al., "RESIDE: Improving Distantly-Supervised Neural Relation
    Extraction using Side Information," *ACL*, 2018.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class EntityTypeSpec:
    """实体类型规格"""

    name: str
    description: str
    examples: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class RelationTypeSpec:
    """关系类型规格"""

    name: str
    source: str
    target: str
    description: str
    examples: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ExtractionSchema:
    """提取 Schema

    定义目标领域期望的实体类型和关系类型，约束 LLM 提取结果。
    """

    name: str
    entity_types: list[EntityTypeSpec]
    relation_types: list[RelationTypeSpec]

    def format_entity_types_for_prompt(self) -> str:
        """格式化实体类型列表供 LLM prompt 使用"""
        lines = ["### Entity Types"]
        for et in self.entity_types:
            line = f"- **{et.name}**: {et.description}"
            if et.examples:
                line += f" (e.g., {', '.join(et.examples[:3])})"
            lines.append(line)
        return "\n".join(lines)

    def format_relation_types_for_prompt(self) -> str:
        """格式化关系类型列表供 LLM prompt 使用"""
        lines = ["### Relation Types"]
        for rt in self.relation_types:
            line = f"- **{rt.name}** ({rt.source} → {rt.target}): {rt.description}"
            if rt.examples:
                line += f" (e.g., {', '.join(rt.examples[:2])})"
            lines.append(line)
        return "\n".join(lines)

    def format_for_prompt(self) -> str:
        """完整 Schema 格式化供 LLM prompt 使用"""
        return f"{self.format_entity_types_for_prompt()}\n\n{self.format_relation_types_for_prompt()}"

    def entity_type_names(self) -> set[str]:
        return {et.name.upper() for et in self.entity_types}

    def relation_type_names(self) -> set[str]:
        return {rt.name.upper() for rt in self.relation_types}


# ============================================================================
# 预置 Schema
# ============================================================================


AI_PAPER_SCHEMA = ExtractionSchema(
    name="ai_paper",
    entity_types=[
        EntityTypeSpec(
            name="Author",
            description="A researcher who authored or co-authored a paper",
            examples=["Yann LeCun", "Ashish Vaswani", "Jianlin Feng"],
        ),
        EntityTypeSpec(
            name="Method",
            description="A technique, algorithm, model architecture, or approach",
            examples=["Transformer", "BERT", "PPO", "DPO", "LoRA"],
        ),
        EntityTypeSpec(
            name="Dataset",
            description="A benchmark or dataset used for evaluation",
            examples=["MNIST", "SQuAD", "MMLU", "HumanEval"],
        ),
        EntityTypeSpec(
            name="Metric",
            description="An evaluation metric or scoring method",
            examples=["accuracy", "F1", "BLEU", "ROUGE", "pass@k"],
        ),
        EntityTypeSpec(
            name="Result",
            description="A quantitative finding or performance number",
            examples=["92.3% accuracy", "BLEU score of 38.7"],
        ),
        EntityTypeSpec(
            name="Institution",
            description="A research institution, university, or company",
            examples=["Google DeepMind", "OpenAI", "Stanford University"],
        ),
        EntityTypeSpec(
            name="Conference",
            description="A conference, journal, or publication venue",
            examples=["NeurIPS", "ICML", "ACL", "ICLR"],
        ),
        EntityTypeSpec(
            name="Concept",
            description="A theoretical concept or research topic area",
            examples=["attention mechanism", "reinforcement learning", "chain-of-thought"],
        ),
    ],
    relation_types=[
        RelationTypeSpec(
            name="PROPOSED_BY",
            source="Method",
            target="Author",
            description="The method/technique was proposed by this author",
        ),
        RelationTypeSpec(
            name="AFFILIATED_WITH",
            source="Author",
            target="Institution",
            description="The author is affiliated with this institution",
        ),
        RelationTypeSpec(
            name="PUBLISHED_AT",
            source="Method",
            target="Conference",
            description="The method was published at this venue",
        ),
        RelationTypeSpec(
            name="EVALUATED_ON",
            source="Method",
            target="Dataset",
            description="The method was evaluated on this dataset/benchmark",
        ),
        RelationTypeSpec(
            name="MEASURED_BY",
            source="Result",
            target="Metric",
            description="The result is measured using this metric",
        ),
        RelationTypeSpec(
            name="ACHIEVES",
            source="Method",
            target="Result",
            description="The method achieves this quantitative result",
        ),
        RelationTypeSpec(
            name="OUTPERFORMS",
            source="Method",
            target="Method",
            description="One method outperforms another on some benchmark",
        ),
        RelationTypeSpec(
            name="EXTENDS",
            source="Method",
            target="Method",
            description="One method extends or builds upon another",
        ),
        RelationTypeSpec(
            name="USES_CONCEPT",
            source="Method",
            target="Concept",
            description="The method relies on or utilizes this concept",
        ),
    ],
)

# Schema 注册表
SCHEMAS: dict[str, ExtractionSchema] = {
    "ai_paper": AI_PAPER_SCHEMA,
}


def get_schema(name: str) -> ExtractionSchema | None:
    """按名称获取预置 Schema"""
    return SCHEMAS.get(name.lower())
