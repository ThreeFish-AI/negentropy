"""导出已发布 Wiki 内容为静态内容包。

由 CI（publish 触发）headless 运行：连主站 DB → 调 ``WikiExportService`` →
写入 ``--out`` 目录（默认 ``apps/negentropy-wiki/content/``）。CI 随后把产物
提交到 wiki 仓库，触发 wiki 静态重建部署。

**边界**：本脚本是主站职责（合法持有 DB 访问）；其产出的静态文件是 wiki 的唯一
内容来源。wiki 端构建期只读这些文件，运行期纯静态，不直接或间接依赖主站数据库。

用法::

    uv run python scripts/export_wiki_content.py --out apps/negentropy-wiki/content
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# 让 `from _db import ...` 可用（scripts/ 同目录共享工具）。
sys.path.insert(0, str(Path(__file__).resolve().parent))

from _db import run_script, script_engine  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker  # noqa: E402

from negentropy.knowledge.lifecycle.wiki_export_service import WikiExportService  # noqa: E402


async def _run(out_dir: Path) -> None:
    async with script_engine() as engine:
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            service = WikiExportService()
            result = await service.export_all_published(db, out_dir=out_dir)

    summary = result.to_dict()
    print(
        "[wiki-export] 已导出静态内容包："
        f"{summary['publications_count']} publications / "
        f"{summary['entries']} entries / "
        f"{summary['graphs']} graphs / "
        f"{summary['files_count']} files → {out_dir}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export published Wiki content to a static content bundle.",
    )
    parser.add_argument(
        "--out",
        default="apps/negentropy-wiki/content",
        help="输出目录（默认 apps/negentropy-wiki/content）",
    )
    args = parser.parse_args()
    out_dir = Path(args.out).resolve()
    run_script(_run(out_dir))


if __name__ == "__main__":
    main()
