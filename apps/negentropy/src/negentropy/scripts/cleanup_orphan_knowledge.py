"""一次性清算 ``Knowledge`` 表中的孤儿 chunks 与 ``document_id`` 回填（ISSUE-078 Phase 3）。

设计动机
========

本脚本独立于 alembic 迁移：迁移内 ``DELETE`` 不可逆、无 dry-run、无审批环节，
不适合大规模数据清算。本脚本提供 ``--dry-run`` / ``--commit`` 两态、按 corpus
/ app 维度可选 scope 的运维流程，让 DBA 在 staging 与生产分别审计后再决策。

工作流
------

按以下顺序执行（``--dry-run`` 模式只报告、``--commit`` 真正写库）：

1. **回填**：对 ``Knowledge.document_id IS NULL`` 的行，基于 ``(corpus_id,
   app_name, source_uri)`` 匹配 ``KnowledgeDocument.gcs_uri`` 或
   ``metadata->>'origin_url'``，回填 ``document_id``。包含软删 doc（其 chunks
   也应有 FK 关联以便随 doc 行为联动）。
2. **报告**：按 corpus 分组输出 ``total / linked / unlinked / would_delete`` 四档计数，
   stdout JSON 与 logger 同时落，便于审计存档。
3. **清理**：仅当 ``document_id IS NULL AND source_uri IS NOT NULL AND
   source_uri ~ '^(gs://|https?://)'`` 才删除（白名单形态，规避内部脏数据 /
   奇异 URI）。``source_uri IS NULL`` 的合法 KG 类直连知识保留。
4. ``--commit`` 模式整体单事务执行，失败可整体回滚。

用法
----

::

    # 全库 dry-run（推荐先跑这个）
    uv run python -m negentropy.scripts.cleanup_orphan_knowledge --dry-run

    # 按 corpus 范围
    uv run python -m negentropy.scripts.cleanup_orphan_knowledge \\
        --dry-run --corpus-id 12345678-...

    # 按 app 范围（多租户场景）
    uv run python -m negentropy.scripts.cleanup_orphan_knowledge \\
        --dry-run --app-name negentropy

    # 真正执行（需 DBA 备份）
    uv run python -m negentropy.scripts.cleanup_orphan_knowledge --commit

返回值
------

退出码 0 表示成功，非零表示存在错误（DB 连接 / 参数 / 内部异常）。

参考
----

[1] PostgreSQL Documentation, "DELETE Statement" — 大事务 DELETE 与锁定语义
[2] ISSUE-078 RCA + Phase 1/2/3 处理记录（``docs/issue.md``）
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from typing import Any

from sqlalchemy import text

from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger

logger = get_logger("negentropy.scripts.cleanup_orphan_knowledge")

_SCHEMA = "negentropy"

# ----- SQL 模板（按是否传入 scope 参数动态拼接 WHERE 子句） -----------------
# 不使用 ``:param::type IS NULL`` 形式——asyncpg 不接受占位符与显式 cast 同时
# 出现。改为根据 corpus_id / app_name 是否提供，构造对应的额外谓词列表。


def _build_scope_clauses(
    *,
    corpus_id: str | None,
    app_name: str | None,
    table_alias: str,
) -> tuple[str, dict[str, Any]]:
    extras: list[str] = []
    params: dict[str, Any] = {}
    if corpus_id is not None:
        extras.append(f"AND {table_alias}.corpus_id = :corpus_id")
        params["corpus_id"] = corpus_id
    if app_name is not None:
        extras.append(f"AND {table_alias}.app_name = :app_name")
        params["app_name"] = app_name
    return ("\n      ".join(extras), params)


def _backfill_sql(*, corpus_id: str | None, app_name: str | None) -> tuple[Any, dict[str, Any]]:
    """回填：对 document_id IS NULL 的行，基于 source_uri 匹配回填，包含软删 doc。"""
    extras, params = _build_scope_clauses(corpus_id=corpus_id, app_name=app_name, table_alias="k")
    sql = text(
        f"""
        UPDATE {_SCHEMA}.knowledge k
        SET document_id = d.id
        FROM {_SCHEMA}.knowledge_documents d
        WHERE k.corpus_id = d.corpus_id
          AND k.app_name = d.app_name
          AND k.source_uri IS NOT NULL
          AND k.document_id IS NULL
          AND (
            d.gcs_uri = k.source_uri
            OR d.metadata->>'origin_url' = k.source_uri
          )
          {extras}
        """
    )
    return sql, params


def _stats_sql(*, corpus_id: str | None, app_name: str | None) -> tuple[Any, dict[str, Any]]:
    """按 corpus 分组列出 total / linked / unlinked / would_delete 四档计数。

    would_delete 与 ``_delete_sql`` 的过滤条件保持一致，确保 dry-run 报告准确。
    """
    extras, params = _build_scope_clauses(corpus_id=corpus_id, app_name=app_name, table_alias="k")
    where = ("WHERE 1 = 1\n      " + extras) if extras else ""
    sql = text(
        f"""
        SELECT
            c.id AS corpus_id,
            c.name AS corpus_name,
            COUNT(*)                                                     AS total,
            COUNT(*) FILTER (WHERE k.document_id IS NOT NULL)             AS linked,
            COUNT(*) FILTER (WHERE k.document_id IS NULL)                 AS unlinked,
            COUNT(*) FILTER (WHERE k.document_id IS NULL
                               AND k.source_uri IS NOT NULL
                               AND k.source_uri ~ '^(gs://|https?://)')   AS would_delete
        FROM {_SCHEMA}.knowledge k
        JOIN {_SCHEMA}.corpus c ON c.id = k.corpus_id
        {where}
        GROUP BY c.id, c.name
        ORDER BY would_delete DESC, total DESC
        """
    )
    return sql, params


def _delete_sql(*, corpus_id: str | None, app_name: str | None) -> tuple[Any, dict[str, Any]]:
    """白名单形态 + 仍未 linked 的孤儿才删除；KG 类（source_uri NULL）保留。"""
    extras, params = _build_scope_clauses(corpus_id=corpus_id, app_name=app_name, table_alias="knowledge")
    sql = text(
        f"""
        DELETE FROM {_SCHEMA}.knowledge
        WHERE document_id IS NULL
          AND source_uri IS NOT NULL
          AND source_uri ~ '^(gs://|https?://)'
          {extras}
        """
    )
    return sql, params


async def _run(
    *,
    commit: bool,
    corpus_id: str | None,
    app_name: str | None,
) -> dict[str, Any]:
    """执行清算流程，返回报告 dict。整体单事务（commit 模式）。"""
    backfill_stmt, backfill_params = _backfill_sql(corpus_id=corpus_id, app_name=app_name)
    stats_stmt, stats_params = _stats_sql(corpus_id=corpus_id, app_name=app_name)
    delete_stmt, delete_params = _delete_sql(corpus_id=corpus_id, app_name=app_name)

    async with AsyncSessionLocal() as session:
        # Step 1: 回填 document_id（dry-run 也回填以让统计真实反映可清理量；
        # 之所以安全：回填本身是无损操作，只是把空字段补上正确的 FK；commit 模式
        # 才真正落库，dry-run 模式下事务不 commit 即可丢弃）。
        backfill_result = await session.execute(backfill_stmt, backfill_params)
        backfilled_count = backfill_result.rowcount or 0
        logger.info(
            "cleanup_orphan_knowledge_backfill",
            backfilled=backfilled_count,
            corpus_id=corpus_id,
            app_name=app_name,
        )

        # Step 2: 统计报告
        stats_result = await session.execute(stats_stmt, stats_params)
        per_corpus_rows = stats_result.fetchall()
        per_corpus = [
            {
                "corpus_id": str(row.corpus_id),
                "corpus_name": row.corpus_name,
                "total": int(row.total or 0),
                "linked": int(row.linked or 0),
                "unlinked": int(row.unlinked or 0),
                "would_delete": int(row.would_delete or 0),
            }
            for row in per_corpus_rows
        ]
        total_would_delete = sum(item["would_delete"] for item in per_corpus)

        # Step 3: 清理（仅 commit 模式真正 DELETE）
        deleted_count = 0
        if commit:
            del_result = await session.execute(delete_stmt, delete_params)
            deleted_count = del_result.rowcount or 0
            await session.commit()
            logger.info(
                "cleanup_orphan_knowledge_committed",
                deleted=deleted_count,
                backfilled=backfilled_count,
                corpus_id=corpus_id,
                app_name=app_name,
            )
        else:
            await session.rollback()
            logger.info(
                "cleanup_orphan_knowledge_dry_run",
                would_delete=total_would_delete,
                backfilled=backfilled_count,
                corpus_id=corpus_id,
                app_name=app_name,
            )

        return {
            "mode": "commit" if commit else "dry-run",
            "scope": {
                "corpus_id": corpus_id,
                "app_name": app_name,
            },
            "backfilled": backfilled_count,
            "would_delete_total": total_would_delete,
            "deleted": deleted_count,
            "per_corpus": per_corpus,
        }


async def count_orphan_knowledge(
    *,
    corpus_id: str | None = None,
    app_name: str | None = None,
) -> dict[str, Any]:
    """轻量观测函数：返回当前孤儿 chunks 计数（供监控 cron 调用）。

    返回结构::

        {
            "total_orphans": int,
            "per_corpus": [{"corpus_id", "corpus_name", "orphans", "total"}, ...]
        }

    与 CLI 内部的 ``_stats_sql`` 共用同一个口径（``document_id IS NULL`` +
    白名单 source_uri 形态），避免「每日扫描数」与「实际可清理数」漂移。
    建议接入方式：
      - cron 每天调用，将 ``total_orphans`` 上报为 metric
        ``negentropy.knowledge.orphan_count{corpus_id}``；
      - 阈值告警：``total_orphans > 0`` 触发，提示存在新增孤儿（即便 Phase 1/2/3
        三层防御也兜住了路径，仍是实际入侵 / 异常 SQL 的 canary）。
    """
    stats_stmt, params = _stats_sql(corpus_id=corpus_id, app_name=app_name)
    async with AsyncSessionLocal() as session:
        result = await session.execute(stats_stmt, params)
        rows = result.fetchall()

    per_corpus = [
        {
            "corpus_id": str(row.corpus_id),
            "corpus_name": row.corpus_name,
            "orphans": int(row.would_delete or 0),
            "total": int(row.total or 0),
        }
        for row in rows
    ]
    return {
        "total_orphans": sum(item["orphans"] for item in per_corpus),
        "per_corpus": per_corpus,
    }


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cleanup_orphan_knowledge",
        description=(
            "ISSUE-078 Phase 3：回填 Knowledge.document_id 并清理孤儿 chunks。"
            "默认安全语义——必须显式指定 --dry-run 或 --commit。"
        ),
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="只报告 would_delete 计数，不实际写库（事务回滚）；推荐先在 staging 跑这个。",
    )
    mode.add_argument(
        "--commit",
        action="store_true",
        help="真正执行回填 + 清理（整体单事务）；执行前请由 DBA 备份。",
    )
    parser.add_argument(
        "--corpus-id",
        type=str,
        default=None,
        help="可选：限定为指定 corpus_id（UUID）。",
    )
    parser.add_argument(
        "--app-name",
        type=str,
        default=None,
        help="可选：限定为指定 app_name（多租户隔离）。",
    )
    parser.add_argument(
        "--json",
        dest="json_output",
        action="store_true",
        help="结果以 JSON 格式输出至 stdout（默认人类可读 + JSON 摘要）。",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    commit = bool(args.commit)

    try:
        report = asyncio.run(
            _run(
                commit=commit,
                corpus_id=args.corpus_id,
                app_name=args.app_name,
            )
        )
    except Exception as exc:  # noqa: BLE001 — CLI 顶层兜底
        logger.error("cleanup_orphan_knowledge_failed", error=str(exc), exc_info=True)
        print(f"FAILED: {exc}", file=sys.stderr)
        return 1

    if args.json_output:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print("=" * 70)
        print(f"  Mode: {report['mode'].upper()}")
        print(f"  Scope: corpus_id={report['scope']['corpus_id']}, app_name={report['scope']['app_name']}")
        print(f"  Backfilled document_id: {report['backfilled']}")
        if commit:
            print(f"  Deleted orphan chunks: {report['deleted']}")
        else:
            print(f"  Would-delete orphan chunks: {report['would_delete_total']}")
        print("-" * 70)
        print(f"  Per-corpus breakdown ({len(report['per_corpus'])} corpora):")
        for item in report["per_corpus"]:
            print(
                f"    [{item['corpus_id']}] {item['corpus_name']:<30s} "
                f"total={item['total']:>6d}  linked={item['linked']:>6d}  "
                f"unlinked={item['unlinked']:>6d}  would_delete={item['would_delete']:>6d}"
            )
        print("=" * 70)
        print(json.dumps(report, indent=2, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    sys.exit(main())
