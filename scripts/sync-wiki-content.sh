#!/usr/bin/env bash
# sync-wiki-content.sh — 从主站 DB 导出已发布 Wiki 内容到 apps/negentropy-wiki/content/
#
# 本地「publish → restart → 看到内容」闭环的关键步骤。
# wiki 纯静态化后不读 DB，内容来自 content/；本地需本脚本把主站已发布内容导出为
# 静态内容包（生产/CI 由 .github/workflows/wiki-content-export.yml 承担）。
#
# 前置：
#   - postgres 运行中（与 backend 同源；NE_DB_URL 未设时用默认 localhost:5432/negentropy）
#   - 至少有一个 status=published 的 Wiki publication（主站「同步并发布」后即满足）
#
# 用法：
#   ./scripts/sync-wiki-content.sh
#   # 之后重新构建 wiki：pnpm --filter negentropy-wiki build  （或 ./scripts/cli.sh restart）
#
# 注意：本脚本写入（覆盖式 _reset）apps/negentropy-wiki/content/ —— 该目录整体 gitignored，
# 是真实导出落点（构建期 content-source.ts 优先采用）。开发种子 fixture 另存于
# content.fixture/（入 git）；content/ 缺失时构建自动回退 fixture。本地生成的 content/ 勿提交。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"

# 导出工具仅需 DB（+ 可选 GCS 用于图片直链重写），不使用 artifact 后端。
# 显式置 inmemory 以容忍用户级 ~/.negentropy/config.yaml 中与本分支枚举
# （inmemory|gcs）不符的 artifact_backend 取值，避免无关校验阻塞导出。
export NE_SVC_ARTIFACT_BACKEND="${NE_SVC_ARTIFACT_BACKEND:-inmemory}"

cd "$REPO_ROOT/apps/negentropy"
exec uv run python scripts/export_wiki_content.py \
  --out "$REPO_ROOT/apps/negentropy-wiki/content"
