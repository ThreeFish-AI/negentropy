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

# 导出工具仅需 DB（不使用 artifact 后端）。bake_assets=true 时下载图片字节烘焙为
# content/assets/{doc}/{file}（需 DB 内 bytea 可读）；bake_assets=false 时仅做 URL
# 字符串变换。显式置 inmemory 以容忍用户级 ~/.negentropy/config.yaml 中与当前枚举
# （inmemory|postgres）不符的 artifact_backend 取值（如已退役的 gcs），避免无关校验阻塞导出。
export NE_SVC_ARTIFACT_BACKEND="${NE_SVC_ARTIFACT_BACKEND:-inmemory}"

# bake_assets=true（默认）：图片烘焙为 content/assets/{doc}/{file} 静态文件、markdown
# 改相对路径 /assets/{doc}/{file}，产物自包含、零主站运行时依赖（与 publish-wiki-pages.sh
# 对齐）。用 ${VAR:-true} 允许调用方显式置 false 走 asset_base_url URL 重写（分域反代部署，
# 见 docs/reference/wiki/deployment.md §4.4）。烘焙图片进静态产物由 wiki 端 prebuild 同步
# content/assets/ → public/assets/ 完成（next build 自动复制 public/ → out/）。
export NE_KNOWLEDGE_WIKI_EXPORT__BAKE_ASSETS="${NE_KNOWLEDGE_WIKI_EXPORT__BAKE_ASSETS:-true}"

cd "$REPO_ROOT/apps/negentropy"
uv run python scripts/export_wiki_content.py \
  --out "$REPO_ROOT/apps/negentropy-wiki/content"

cat <<'EOF'
[sync-wiki-content] 已导出（含烘焙图片 content/assets/）。
  - wiki 用 pnpm dev 运行：请重启 pnpm dev 以加载新图片（predev 同步 public/assets/）；
  - wiki 用 serve out 托管：请重新 pnpm --filter negentropy-wiki build 后 pnpm start。
EOF
