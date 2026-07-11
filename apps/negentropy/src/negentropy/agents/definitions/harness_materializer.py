"""Harness 技能物化器 —— DB（kind=harness_skill）→ ``.agent/skills/<key>/SKILL.md``。

背景（Phase 3）：
- ``.agent/skills/*/SKILL.md`` 供 **Claude Code harness 文件 glob 发现**（negentropy 运行时
  不读）。Phase 3 把这些文件的内容收敛到 ``definitions(kind=harness_skill)``，DB 成为 SSOT；
  盘上文件降级为**生成物**，由本模块从 DB 渲染回盘。
- 后端在 prod 未必能访问仓库盘（无 ``.agent/``），故物化器为 **fail-soft + 路径自动解析**：
  优先 ``NE_REPO_ROOT``，否则从 cwd 向上找 ``.agent/``；找不到则跳过（不报错）。

触发点：
- CLI：``uv run python -m negentropy.agents.definitions.harness_materializer``；
- 保存触发：``definitions_api`` 在 create/update ``harness_skill`` 后 fire-and-forget
  ``materialize_all``（仅当仓库根可解析；``asyncio.create_task``，fail-soft）。

同时向 Definition Registry 注册 ``harness_skill`` 的校验器/元信息提取器（表单保存时校验：
frontmatter 必须含 ``name``）。
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any

from negentropy.agents.definitions import (
    DefinitionParseError,
    register_meta_extractor,
    register_validator,
)
from negentropy.logging import get_logger

_logger = get_logger("negentropy.agents.definitions.harness_materializer")

_KIND = "harness_skill"


# ── Definition Registry 适配器 ────────────────────────────────────────


def _validate(raw: Any, source: str) -> None:
    """frontmatter 必须含非空 ``name``（harness 按 ``.agent/skills/<name>/`` 发现）。"""
    if not isinstance(raw, dict):
        raise DefinitionParseError("Harness 技能源缺少合法 YAML frontmatter")
    name = str(raw.get("name") or "").strip()
    if not name:
        raise DefinitionParseError("Harness 技能 frontmatter 缺少必填字段: name")


def _meta(raw: Any, body: str) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    return {k: raw[k] for k in ("name", "description", "allowed-tools") if k in raw}


register_validator(_KIND, _validate)
register_meta_extractor(_KIND, _meta)


# ── 物化器 ──────────────────────────────────────────────────────────


def resolve_repo_root() -> Path | None:
    """``NE_REPO_ROOT`` 优先；否则从 cwd 向上找 ``.agent/``；找不到返回 None。"""
    env = os.environ.get("NE_REPO_ROOT")
    if env:
        return Path(env)
    cwd = Path.cwd()
    for d in (cwd, *cwd.parents):
        if (d / ".agent").is_dir():
            return d
    return None


async def _fetch_harness_skills() -> list[tuple[str, str]]:
    """读 DB 中启用的 harness_skill 定义，返回 ``[(key, source), ...]``。"""
    from sqlalchemy import select

    from negentropy.db.session import AsyncSessionLocal
    from negentropy.models.definition import Definition

    out: list[tuple[str, str]] = []
    async with AsyncSessionLocal() as db:
        rows = (
            (
                await db.execute(
                    select(Definition)
                    .where(Definition.kind == _KIND, Definition.is_enabled.is_(True))
                    .order_by(Definition.sort_order, Definition.key)
                )
            )
            .scalars()
            .all()
        )
    for row in rows:
        out.append((row.key, row.source))
    return out


def _is_safe_skill_key(key: str) -> bool:
    """key 必须是单段安全目录名（harness 按 ``.agent/skills/<key>/`` 发现）。

    DB 中的 key 由 admin 经 Definitions 表单自由填写、无路径字符约束，写盘前必须在此设防：
    拒绝空 / ``.`` / ``..`` / 绝对路径 / 含路径分隔符的值，防止 ``skills_dir / key`` 逃逸出
    ``.agent/skills``（如 ``../../tmp/evil`` 或 ``/tmp/evil``）而向任意位置写文件。
    """
    if not key or key in (".", ".."):
        return False
    if os.path.isabs(key):
        return False
    return not ("/" in key or "\\" in key or os.sep in key or (os.altsep and os.altsep in key))


def _write_to_disk(rows: list[tuple[str, str]], repo_root: Path) -> int:
    """同步写盘：每条 → ``<repo_root>/.agent/skills/<key>/SKILL.md``；按内容幂等跳过。

    非法 key（路径穿越 / 绝对路径 / 非单段名）跳过并告警，不写盘。
    """
    skills_dir = repo_root / ".agent" / "skills"
    skills_dir.mkdir(parents=True, exist_ok=True)
    written = 0
    for key, source in rows:
        if not _is_safe_skill_key(key):
            _logger.warning("harness_skill_unsafe_key_skipped", key=key)
            continue
        target_dir = skills_dir / key
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / "SKILL.md"
        existing = target.read_text(encoding="utf-8") if target.exists() else None
        if existing == source:
            continue
        target.write_text(source, encoding="utf-8")
        written += 1
    return written


async def materialize_all(repo_root: Path) -> int:
    """DB → ``.agent/skills/*/SKILL.md``；写盘走 ``asyncio.to_thread`` 避免阻塞事件循环。

    Returns: 实际写入（内容有变化）的文件数。
    """
    rows = await _fetch_harness_skills()
    if not rows:
        return 0
    return await asyncio.to_thread(_write_to_disk, rows, repo_root)


def maybe_materialize_now() -> None:
    """保存触发的 fire-and-forget 入口：仓库根可解析时后台渲染，fail-soft。"""
    repo = resolve_repo_root()
    if repo is None:
        return  # prod / 非仓库环境：静默跳过
    try:
        asyncio.create_task(materialize_all(repo))  # noqa: RUF006 — fire-and-forget
    except RuntimeError:
        # 无运行中事件循环（如同步调用方）：降级为阻塞执行，best-effort。
        try:
            asyncio.run(materialize_all(repo))
        except Exception:  # pragma: no cover — fail-soft，绝不阻断保存
            _logger.warning("harness_materialize_sync_failed", exc_info=True)


def main() -> None:
    """CLI 入口：``uv run python -m negentropy.agents.definitions.harness_materializer``。"""
    repo = resolve_repo_root()
    if repo is None:
        print("Could not resolve repo root. Set NE_REPO_ROOT or run from the repo root.")
        raise SystemExit(2)
    count = asyncio.run(materialize_all(repo))
    print(f"Materialized {count} harness skill(s) to {repo / '.agent' / 'skills'}")


if __name__ == "__main__":
    main()
