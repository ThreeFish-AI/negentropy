#!/usr/bin/env bash
# build-wiki-local.sh — 本地一键重建 negentropy-wiki 测试站点（:3092）
#
# 链路：主站 DB 导出已发布内容 → content/ → next build 重建 out/。
# wiki 纯静态化（output: export）后无运行时刷新：内容更新必须「导出 + 重建」，
# 重建后由本地 wiki（serve out -l 3092）提供新产物。
#
# 由后端 publish(target=local) 后 fire-and-forget spawn，或手动执行。
# 与 publish-wiki-pages.sh 共享「导出 + 重建」前两步，但**不**推送任何远端仓库
# —— 仅作用于本机 out/（测试环境）。
#
# 前置：
#   - postgres 运行中（NE_DB_URL 未设时用默认 localhost:5432/negentropy）
#   - 至少有一个 status=published 的 Wiki publication（主站「发布」后即满足）
#
# 用法：
#   ./scripts/build-wiki-local.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"

log() { printf '\033[34m[build-wiki-local]\033[0m %s\n' "$*"; }
err() { printf '\033[31m[build-wiki-local] ERROR:\033[0m %s\n' "$*" >&2; }

# Step 1: 导出已发布 Wiki 内容 → content/（复用既有导出脚本，其内部已处理
# NE_SVC_ARTIFACT_BACKEND=inmemory 容错与 DB 连接）。
log "Step 1/2 导出 Wiki 内容 → content/"
bash "$REPO_ROOT/scripts/sync-wiki-content.sh" \
  || { err "内容导出失败（postgres 未就绪 / 无已发布内容？）"; exit 1; }

# Step 2: next build → out/（content/ 在构建期烘焙进静态产物）。
log "Step 2/2 next build → out/"
(cd "$REPO_ROOT" && pnpm --filter negentropy-wiki build) \
  || { err "wiki 构建失败"; exit 1; }

[ -f "$REPO_ROOT/apps/negentropy-wiki/out/index.html" ] \
  || { err "构建产物缺失：apps/negentropy-wiki/out/index.html"; exit 1; }

log "完成：本地 wiki 已重建，http://localhost:3092 将提供新内容"
