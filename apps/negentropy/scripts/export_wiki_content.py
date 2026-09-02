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

from _logging import configure_script_logging  # noqa: E402

# 顺序即正确性：先配置日志，再 import 下方重型模块——后者在 import 期即注册 disposer
# 等并打日志，若晚于本行，这些早期事件会落到 structlog 出厂默认（不过滤 DEBUG、非项目格式）。
configure_script_logging()

from _db import run_script, script_engine  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker  # noqa: E402

from negentropy.knowledge.lifecycle.wiki_export_service import WikiExportService  # noqa: E402
from negentropy.logging import get_logger  # noqa: E402

logger = get_logger("negentropy.scripts.export_wiki_content")


async def _run(out_dir: Path) -> int:
    try:
        async with script_engine() as engine:
            session_factory = async_sessionmaker(engine, expire_on_commit=False)
            async with session_factory() as db:
                service = WikiExportService()
                result = await service.export_all_published(db, out_dir=out_dir)
    except Exception:
        # error 级保证失败原因不被 NE_LOG_LEVEL≥WARNING 门控（stderr 已被接管，
        # run_script 的 print 只会落成 INFO 级日志行）。退出码交由 run_script。
        logger.exception("wiki_export_cli_failed", out_dir=str(out_dir))
        return 1

    # 用结构化事件而非 print 输出汇总：configure_script_logging 已接管 sys.stdout。
    summary = result.to_dict()
    logger.info(
        "wiki_export_cli_done",
        publications=summary["publications_count"],
        entries=summary["entries"],
        graphs=summary["graphs"],
        files=summary["files_count"],
        out_dir=str(out_dir),
    )
    return 0


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
