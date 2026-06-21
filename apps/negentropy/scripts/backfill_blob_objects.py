"""回填存量文档的 blob 字节到 PostgreSQL（GCS 退役迁移断层修复）。

背景：GCS 退役（#932/#935）后，迁移 0072 仅把存量文档的 ``content_uri`` 从
``gs://{bucket}/key`` 改写为 ``pgblob://key``，**未把字节回填到 ``blob_objects`` 表**。
GCS 已彻底移除（bucket 名亦被正则剥离丢失），无法从 GCS 读回字节。

本脚本对「blob 缺失」的存量文档尽力恢复：
  - ``source_type='url'`` 且有 source_url/original_url：按 URL 重新下载字节并上传到
    ``blob_objects``（key 与文档既有 content_uri 严格一致，回填后 download 必命中）；
  - 其余（本地文件来源 / 无源 URL）：字节永久无源，标记
    ``markdown_extract_status='failed'`` + 可读 error，便于运维识别需重新上传。

用法::

    # 仅统计（不写库、不下载）
    uv run python scripts/backfill_blob_objects.py --dry-run

    # 执行回填（URL 重下 + 无源标记）
    uv run python scripts/backfill_blob_objects.py

    # 仅处理指定 app_name
    uv run python scripts/backfill_blob_objects.py --app-name negentropy

诊断 SQL（手动核对规模，可直接在 DB 跑）::

    -- blob 缺失总数 + 按来源分类
    SELECT
      COUNT(*) AS total_active,
      COUNT(*) FILTER (WHERE bo.key IS NULL) AS blob_missing,
      COUNT(*) FILTER (WHERE bo.key IS NULL AND ds.source_type = 'url'
                       AND COALESCE(ds.source_url, ds.original_url) IS NOT NULL) AS url_recoverable,
      COUNT(*) FILTER (WHERE bo.key IS NULL
                       AND (ds.source_type <> 'url' OR ds.source_type IS NULL)) AS file_unrecoverable
    FROM negentropy.knowledge_documents kd
    LEFT JOIN negentropy.doc_sources ds ON ds.document_id = kd.id
    LEFT JOIN negentropy.blob_objects bo
      ON bo.key = regexp_replace(kd.content_uri, '^pgblob://', '')
    WHERE kd.status = 'active';
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# 回填工具不使用 artifact 后端；置 inmemory 容忍用户级 config 中失效的取值。
os.environ.setdefault("NE_SVC_ARTIFACT_BACKEND", "inmemory")

# 让 `from _db import ...` 可用（scripts/ 同目录共享工具）。
sys.path.insert(0, str(Path(__file__).resolve().parent))

from _db import run_script  # noqa: E402


async def _run(args: argparse.Namespace) -> int:
    import httpx
    from sqlalchemy import select

    from negentropy.db.session import AsyncSessionLocal
    from negentropy.models.perception import DocSource, KnowledgeDocument
    from negentropy.models.storage import BlobObject
    from negentropy.storage.postgres_client import PostgresBlobStorage
    from negentropy.storage.uri import is_blob_uri, parse_uri

    blob = PostgresBlobStorage()

    stats = {"scanned": 0, "missing": 0, "recovered": 0, "marked_failed": 0, "errors": 0}

    async with AsyncSessionLocal() as db:
        # 拉取 active 文档 + 其 DocSource（来源信息）。
        doc_stmt = select(KnowledgeDocument).where(KnowledgeDocument.status == "active")
        if args.app_name:
            doc_stmt = doc_stmt.where(KnowledgeDocument.app_name == args.app_name)
        docs = list((await db.execute(doc_stmt)).scalars().all())

        for doc in docs:
            stats["scanned"] += 1
            content_uri = doc.content_uri
            if not is_blob_uri(content_uri):
                continue  # 非 pgblob URI（异常数据）跳过
            key = parse_uri(content_uri)

            # blob 是否已存在？
            exists = await db.scalar(select(BlobObject.key).where(BlobObject.key == key).limit(1))
            if exists:
                continue
            stats["missing"] += 1

            # 查来源：仅 URL 来源可重新下载。
            src = (
                await db.execute(select(DocSource).where(DocSource.document_id == doc.id).limit(1))
            ).scalar_one_or_none()
            url = None
            if src and src.source_type == "url":
                url = src.source_url or src.original_url

            print(
                f"[missing] doc={doc.id} file={doc.original_filename!r} "
                f"source={'url:' + url if url else (src.source_type if src else 'unknown')}"
            )

            if args.dry_run:
                if url:
                    stats["recovered"] += 1  # dry-run 下记为"可恢复"
                else:
                    stats["marked_failed"] += 1
                continue

            if url:
                # URL 来源：重新下载并回填（尽力而为，失败仅 WARN）。
                try:
                    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                        resp = await client.get(url)
                        resp.raise_for_status()
                        data = resp.content
                    if not data:
                        raise ValueError("downloaded empty content")
                    await blob.upload(data, key, content_type=doc.content_type)
                    stats["recovered"] += 1
                    print(f"  ✅ recovered {len(data)} bytes → {content_uri}")
                except Exception as exc:  # noqa: BLE001 - 单文档失败不中断批处理
                    stats["errors"] += 1
                    print(f"  ⚠️ download/upload failed: {exc}", file=sys.stderr)
            else:
                # 无源：标记 failed，提示运维重新上传。
                doc.markdown_extract_status = "failed"
                doc.markdown_extract_error = (
                    "Source blob missing and no recovery source "
                    "(non-URL origin; bytes lost in GCS retirement). Please re-upload."
                )
                stats["marked_failed"] += 1

        if not args.dry_run:
            await db.commit()

    mode = "DRY-RUN" if args.dry_run else "EXECUTED"
    print(
        f"\n[backfill-blob {mode}] scanned={stats['scanned']} missing={stats['missing']} "
        f"recovered={stats['recovered']} marked_failed={stats['marked_failed']} errors={stats['errors']}"
    )
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill missing blob_objects bytes for legacy (GCS-era) documents.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="仅扫描统计，不下载、不写库。",
    )
    parser.add_argument(
        "--app-name",
        default=None,
        help="仅处理指定 app_name 的文档（缺省处理全部）。",
    )
    args = parser.parse_args()
    run_script(_run(args))


if __name__ == "__main__":
    main()
