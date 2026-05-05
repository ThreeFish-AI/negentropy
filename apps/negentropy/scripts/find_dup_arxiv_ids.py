"""扫描 ``negentropy.knowledge`` 中重复入库的 arxiv 论文 chunk。

只读脚本，不写任何数据。Phase 2 P2-1 引入 ``ingest_paper`` 幂等去重之前用于体检：
- 若发现某 ``arxiv_id`` 横跨多个 ``source_uri``（多次 ingest 的实际证据），后续可结合
  ``ingest_paper`` 的 ``status: already_ingested`` 状态确认未来不会再增；
- 若 chunk_count 异常（>200），可能是 PDF 解析切得过碎，与本 P2-1 无关但可顺带记录。

用法：
    uv run python apps/negentropy/scripts/find_dup_arxiv_ids.py [--top N]

输出（CSV 风格，stdout）：
    arxiv_id,source_uri_count,chunk_count,first_seen_at,latest_seen_at
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from negentropy.config import settings


async def _scan(limit: int) -> int:
    engine = create_async_engine(settings.database_url, echo=False)
    try:
        async with engine.connect() as conn:
            stmt = text(
                """
                SELECT
                    metadata->>'arxiv_id' AS arxiv_id,
                    COUNT(DISTINCT source_uri) AS source_uri_count,
                    COUNT(*) AS chunk_count,
                    MIN(created_at) AS first_seen_at,
                    MAX(created_at) AS latest_seen_at
                FROM negentropy.knowledge
                WHERE metadata ? 'arxiv_id'
                GROUP BY metadata->>'arxiv_id'
                HAVING COUNT(DISTINCT source_uri) > 1
                ORDER BY chunk_count DESC
                LIMIT :limit
                """
            )
            result = await conn.execute(stmt, {"limit": limit})
            rows = result.all()

            print("arxiv_id,source_uri_count,chunk_count,first_seen_at,latest_seen_at")
            for row in rows:
                print(
                    ",".join(
                        [
                            str(row.arxiv_id or ""),
                            str(row.source_uri_count),
                            str(row.chunk_count),
                            row.first_seen_at.isoformat() if row.first_seen_at else "",
                            row.latest_seen_at.isoformat() if row.latest_seen_at else "",
                        ]
                    )
                )
            return len(rows)
    finally:
        await engine.dispose()


async def _main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--top", type=int, default=200, help="最多输出条数（默认 200）")
    args = parser.parse_args()
    count = await _scan(args.top)
    print(f"# total_duplicate_groups={count}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(_main()))
