"""Harness 物化器 — 单元测试。

覆盖：
1. ``resolve_repo_root``：``NE_REPO_ROOT`` 优先、否则 cwd 向上找 ``.agent/``；
2. ``_validate`` / ``_meta``：harness_skill frontmatter 校验（缺 name → 422）与元信息抽取；
3. ``materialize_all``：DB → ``.agent/skills/<key>/SKILL.md`` 写盘 + 幂等（内容未变跳过）+
   回写一致（改 DB → 文件更新；恢复 → 文件恢复）。
"""

from __future__ import annotations

import pytest

from negentropy.agents.definitions import DefinitionParseError, parse_definition
from negentropy.agents.definitions.harness_materializer import (
    materialize_all,
    resolve_repo_root,
)

MARKER = "<!-- phase3-materializer-test -->"


def test_resolve_repo_root_env_priority(monkeypatch, tmp_path):
    env_repo = tmp_path / "repo"
    (env_repo / ".agent").mkdir(parents=True)
    monkeypatch.setenv("NE_REPO_ROOT", str(env_repo))
    assert resolve_repo_root() == env_repo


def test_resolve_repo_root_none_when_unresolvable(monkeypatch, tmp_path):
    monkeypatch.delenv("NE_REPO_ROOT", raising=False)
    monkeypatch.chdir(tmp_path)  # tmp_path 及其父级均无 .agent/
    assert resolve_repo_root() is None


def test_validate_requires_name():
    meta = parse_definition("harness_skill", "markdown", "---\nname: foo\ndescription: d\n---\nbody")
    assert meta.get("name") == "foo"
    with pytest.raises(DefinitionParseError):
        parse_definition("harness_skill", "markdown", "---\ndescription: no name\n---\nbody")


@pytest.mark.asyncio
async def test_materialize_roundtrip_idempotent(monkeypatch, tmp_path):
    """改 DB → 文件更新；恢复 → 文件恢复；内容未变 → 跳过（0 写入）。

    用自建临时行（非 seeded 行）做往返，避免污染共享测试库的内置定义。
    """
    from sqlalchemy import delete

    from negentropy.db.session import AsyncSessionLocal
    from negentropy.models.definition import Definition

    probe_key = "_test_materialize_probe"
    base_source = "---\nname: _test_materialize_probe\ndescription: probe\n---\n# body\n"

    repo = tmp_path / "repo"
    (repo / ".agent" / "skills").mkdir(parents=True)
    monkeypatch.setenv("NE_REPO_ROOT", str(repo))

    async with AsyncSessionLocal() as db:
        db.add(
            Definition(
                kind="harness_skill",
                key=probe_key,
                format="markdown",
                source=base_source,
                owner_id="system",
                is_system=False,
                is_enabled=True,
                sort_order=9999,
            )
        )
        try:
            await db.commit()
        except Exception:
            await db.rollback()
            # 已存在（前次未清理）—— 先删再建
            await db.execute(delete(Definition).where(Definition.kind == "harness_skill", Definition.key == probe_key))
            await db.commit()
            db.add(
                Definition(
                    kind="harness_skill",
                    key=probe_key,
                    format="markdown",
                    source=base_source,
                    owner_id="system",
                    is_system=False,
                    is_enabled=True,
                    sort_order=9999,
                )
            )
            await db.commit()

    target = repo / ".agent" / "skills" / probe_key / "SKILL.md"
    try:
        # 首次 materialize → probe 写入；再跑 → 0（幂等）
        assert await materialize_all(repo) >= 1
        assert await materialize_all(repo) == 0
        assert target.read_text(encoding="utf-8") == base_source

        # 改 DB 加 marker → materialize → 仅 probe 写入、含 marker
        await _set_probe_source(probe_key, base_source + MARKER + "\n")
        n1 = await materialize_all(repo)
        assert n1 == 1
        on_disk = target.read_text(encoding="utf-8")
        assert MARKER in on_disk
        assert await materialize_all(repo) == 0

        # 恢复 → materialize → 文件恢复、无 Marker
        await _set_probe_source(probe_key, base_source)
        n3 = await materialize_all(repo)
        assert n3 == 1
        on_disk2 = target.read_text(encoding="utf-8")
        assert MARKER not in on_disk2
        assert on_disk2 == base_source
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Definition).where(Definition.kind == "harness_skill", Definition.key == probe_key))
            await db.commit()


async def _set_probe_source(key: str, source: str) -> None:
    from sqlalchemy import update

    from negentropy.db.session import AsyncSessionLocal
    from negentropy.models.definition import Definition

    async with AsyncSessionLocal() as db:
        await db.execute(
            update(Definition).where(Definition.kind == "harness_skill", Definition.key == key).values(source=source)
        )
        await db.commit()
