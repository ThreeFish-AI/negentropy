"""
Skills Injector — 单元测试。

覆盖：
1. ``format_skills_block`` 空列表 / 单个 / 多个 Skill 的 XML 块格式；
2. ``format_skill_invocation`` 在缺少 ``prompt_template`` 时返回空字符串；
3. ``validate_required_tools`` 缺失工具集合差；
4. ``build_progressive_disclosure_prompt`` 与 base_prompt 的拼接；
5. ``resolve_skills`` 用 in-memory mock session 验证 name / UUID / owner / public 路径。

设计原则：纯逻辑层无 DB / LLM 调用，秒级执行；fail-soft 行为有断言保护。
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from uuid import uuid4

import pytest

from negentropy.agents.skills_injector import (
    ResolvedSkill,
    build_progressive_disclosure_prompt,
    format_skill_invocation,
    format_skills_block,
    resolve_skills,
    validate_required_tools,
)
from negentropy.models.plugin_common import PluginVisibility


@dataclass
class _FakeSkill:
    id: str
    name: str
    display_name: str | None
    description: str | None
    prompt_template: str | None
    required_tools: list[str]
    is_enabled: bool
    owner_id: str
    visibility: PluginVisibility


class _ScalarsResult:
    def __init__(self, items: Iterable[_FakeSkill]):
        self._items = list(items)

    def all(self):
        return list(self._items)


class _ExecuteResult:
    def __init__(self, items: Iterable[_FakeSkill]):
        self._items = list(items)

    def scalars(self):
        return _ScalarsResult(self._items)


class _FakeSession:
    """In-memory async session — 只支持 ``execute(stmt)`` 返回固定 Skill 列表。

    我们不 mock SQLAlchemy 的 query 编译路径；resolve_skills 内部通过
    Skill ORM filter 构造 stmt，本 mock 直接吞掉 stmt 并返回预置数据，
    把过滤验证留给后续 integration test。"""

    def __init__(self, skills: Iterable[_FakeSkill]):
        self._skills = list(skills)

    async def execute(self, _stmt):
        return _ExecuteResult(self._skills)


def _skill(
    *,
    name: str = "demo",
    description: str | None = "demo desc",
    prompt_template: str | None = "do {{x}}",
    required_tools: list[str] | None = None,
    enabled: bool = True,
    owner: str = "owner-A",
    visibility: PluginVisibility = PluginVisibility.PRIVATE,
) -> _FakeSkill:
    return _FakeSkill(
        id=str(uuid4()),
        name=name,
        display_name=None,
        description=description,
        prompt_template=prompt_template,
        required_tools=required_tools or [],
        is_enabled=enabled,
        owner_id=owner,
        visibility=visibility,
    )


# ----------------------------- format_skills_block -----------------------------


def test_format_skills_block_empty_returns_empty_string():
    assert format_skills_block([]) == ""


def test_format_skills_block_single_skill_emits_xml_wrapper():
    skill = ResolvedSkill(
        id="x",
        name="arxiv-fetch",
        display_name=None,
        description="Search and fetch arXiv papers",
        prompt_template=None,
        required_tools=(),
        is_enabled=True,
    )
    out = format_skills_block([skill])
    assert out.startswith("<available_skills>")
    assert out.endswith("</available_skills>")
    assert "- arxiv-fetch: Search and fetch arXiv papers" in out


def test_format_skills_block_falls_back_to_display_name_then_placeholder():
    s1 = ResolvedSkill(
        id="1",
        name="s1",
        display_name="Skill One",
        description=None,
        prompt_template=None,
        required_tools=(),
        is_enabled=True,
    )
    s2 = ResolvedSkill(
        id="2", name="s2", display_name=None, description=None, prompt_template=None, required_tools=(), is_enabled=True
    )
    out = format_skills_block([s1, s2])
    assert "- s1: Skill One" in out
    assert "- s2: (no description)" in out


# ----------------------------- format_skill_invocation -----------------------------


def test_format_skill_invocation_empty_template_returns_empty():
    skill = ResolvedSkill(
        id="1", name="x", display_name=None, description=None, prompt_template=None, required_tools=(), is_enabled=True
    )
    assert format_skill_invocation(skill) == ""


def test_format_skill_invocation_wraps_template_with_xml_tag():
    skill = ResolvedSkill(
        id="1",
        name="arxiv-fetch",
        display_name=None,
        description=None,
        prompt_template="search {{q}}",
        required_tools=(),
        is_enabled=True,
    )
    out = format_skill_invocation(skill)
    assert '<skill name="arxiv-fetch">' in out
    assert "search {{q}}" in out
    assert "</skill>" in out


# ----------------------------- validate_required_tools -----------------------------


def test_validate_required_tools_no_requirement_returns_empty():
    skill = ResolvedSkill(
        id="1", name="x", display_name=None, description=None, prompt_template=None, required_tools=(), is_enabled=True
    )
    assert validate_required_tools(skill, ["a", "b"]) == []


def test_validate_required_tools_returns_missing():
    skill = ResolvedSkill(
        id="1",
        name="x",
        display_name=None,
        description=None,
        prompt_template=None,
        required_tools=("search", "fetch", "parse"),
        is_enabled=True,
    )
    missing = validate_required_tools(skill, ["search"])
    assert missing == ["fetch", "parse"]


def test_validate_required_tools_handles_none_agent_tools():
    skill = ResolvedSkill(
        id="1",
        name="x",
        display_name=None,
        description=None,
        prompt_template=None,
        required_tools=("a", "b"),
        is_enabled=True,
    )
    assert validate_required_tools(skill, None) == ["a", "b"]


# ----------------------------- build_progressive_disclosure_prompt -----------------------------


def test_build_prompt_with_no_skills_returns_base():
    assert build_progressive_disclosure_prompt("base instruction", []) == "base instruction"


def test_build_prompt_with_no_base_returns_block_only():
    skill = ResolvedSkill(
        id="1", name="s", display_name=None, description="d", prompt_template=None, required_tools=(), is_enabled=True
    )
    out = build_progressive_disclosure_prompt(None, [skill])
    assert out.startswith("<available_skills>")


def test_build_prompt_concatenates_base_then_block_with_blank_line():
    skill = ResolvedSkill(
        id="1", name="s", display_name=None, description="d", prompt_template=None, required_tools=(), is_enabled=True
    )
    out = build_progressive_disclosure_prompt("You are X.", [skill])
    assert out.startswith("You are X.\n\n<available_skills>")


def test_build_prompt_strips_trailing_whitespace_in_base():
    skill = ResolvedSkill(
        id="1", name="s", display_name=None, description="d", prompt_template=None, required_tools=(), is_enabled=True
    )
    out = build_progressive_disclosure_prompt("base   \n\n  ", [skill])
    assert out.startswith("base\n\n<available_skills>")


# ----------------------------- resolve_skills -----------------------------


@pytest.mark.asyncio
async def test_resolve_skills_returns_owner_owned_regardless_of_visibility():
    s = _skill(name="arxiv", owner="owner-A", visibility=PluginVisibility.PRIVATE)
    session = _FakeSession([s])
    out = await resolve_skills(session, ["arxiv"], owner_id="owner-A")
    assert len(out) == 1
    assert out[0].name == "arxiv"


@pytest.mark.asyncio
async def test_resolve_skills_skips_other_owners_private_skill():
    s = _skill(name="private", owner="owner-X", visibility=PluginVisibility.PRIVATE)
    session = _FakeSession([s])
    out = await resolve_skills(session, ["private"], owner_id="owner-A")
    assert out == []


@pytest.mark.asyncio
async def test_resolve_skills_includes_other_owners_public_skill():
    s = _skill(name="shared-pub", owner="owner-X", visibility=PluginVisibility.PUBLIC)
    session = _FakeSession([s])
    out = await resolve_skills(session, ["shared-pub"], owner_id="owner-A")
    assert len(out) == 1
    assert out[0].name == "shared-pub"


@pytest.mark.asyncio
async def test_resolve_skills_dedups_when_name_and_uuid_both_provided():
    s = _skill(name="dup")
    session = _FakeSession([s])
    out = await resolve_skills(session, [s.id, "dup"], owner_id=s.owner_id)
    assert len(out) == 1


@pytest.mark.asyncio
async def test_resolve_skills_empty_refs_returns_empty():
    session = _FakeSession([])
    assert await resolve_skills(session, None, owner_id="x") == []
    assert await resolve_skills(session, [], owner_id="x") == []
    assert await resolve_skills(session, [""], owner_id="x") == []
