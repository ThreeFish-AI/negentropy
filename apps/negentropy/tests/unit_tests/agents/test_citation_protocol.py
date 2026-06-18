"""知识与记忆引用规范（_citation_protocol）单测。

覆盖：
- ``format_memory_citation`` 全字段 / 缺字段 fail-soft；
- 共享协议块在 6 个内置 Agent instruction 中恰好出现一次（防合并后重复）；
- ``_INSTRUCTION_FALLBACKS``（Sync 落库链路）全量携带协议块。
"""

from __future__ import annotations

from negentropy.agents._citation_protocol import (
    CITATION_PROTOCOL,
    CITATION_PROTOCOL_HEADER,
    format_memory_citation,
)


class TestFormatMemoryCitation:
    def test_full_fields(self):
        out = format_memory_citation(
            "a1b2c3d4-5678-90ab-cdef-1234567890ab",
            "episodic",
            "2026-05-12T08:00:00Z",
            3,
        )
        assert out == "[3] Memory a1b2c3d4, episodic, 2026-05-12"

    def test_missing_fields_fail_soft(self):
        # 全 None：降级占位，不抛异常
        assert format_memory_citation(None, None, None, 1) == "[1] Memory unknown, episodic"

    def test_short_id_and_no_date(self):
        out = format_memory_citation("abc", "procedural", "", 2)
        assert out == "[2] Memory abc, procedural"

    def test_date_only_takes_date_part(self):
        out = format_memory_citation("deadbeefcafe", "semantic", "2026-01-02", 5)
        assert out == "[5] Memory deadbeef, semantic, 2026-01-02"


class TestProtocolInInstructions:
    def _all_instructions(self) -> dict[str, str]:
        from negentropy.agents.agent import _ROOT_INSTRUCTION
        from negentropy.agents.faculties.action import _INSTRUCTION as action_i
        from negentropy.agents.faculties.contemplation import _INSTRUCTION as contemplation_i
        from negentropy.agents.faculties.influence import _INSTRUCTION as influence_i
        from negentropy.agents.faculties.internalization import _INSTRUCTION as internalization_i
        from negentropy.agents.faculties.perception import _INSTRUCTION as perception_i

        return {
            "NegentropyEngine": _ROOT_INSTRUCTION,
            "PerceptionFaculty": perception_i,
            "InternalizationFaculty": internalization_i,
            "ContemplationFaculty": contemplation_i,
            "ActionFaculty": action_i,
            "InfluenceFaculty": influence_i,
        }

    def test_protocol_block_present_exactly_once_in_all_six_instructions(self):
        header_line = f"## {CITATION_PROTOCOL_HEADER}"
        for name, instruction in self._all_instructions().items():
            assert instruction.count(header_line) == 1, f"{name} 中协议块标题应恰好出现一次"

    def test_protocol_content_includes_key_clauses(self):
        # 协议正文关键条款：行内标号 / 参考文献节 / Memory 格式 / 不剥离 / 绝不臆造
        assert "[N]" in CITATION_PROTOCOL
        assert "参考文献" in CITATION_PROTOCOL
        assert "Memory" in CITATION_PROTOCOL
        assert "转述不剥离引用" in CITATION_PROTOCOL
        assert "绝不臆造" in CITATION_PROTOCOL

    def test_instruction_fallbacks_carry_protocol(self):
        """Sync 落库链路（agent_presets._INSTRUCTION_FALLBACKS）须携带协议块。"""
        from negentropy.interface import agent_presets

        fallbacks = agent_presets._INSTRUCTION_FALLBACKS
        assert len(fallbacks) >= 6
        for name, text in fallbacks.items():
            assert CITATION_PROTOCOL_HEADER in text, f"{name} 的 fallback instruction 缺少引用规范"
