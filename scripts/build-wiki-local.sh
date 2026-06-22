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

LOG_FILE="$REPO_ROOT/.temp/wiki-local-rebuild.log"   # 全流程日志（后端 spawn / 手动运行统一入口）
LOCK_DIR="$REPO_ROOT/.temp/wiki-local-rebuild.lock"  # 并发锁目录（mkdir 原子操作）
mkdir -p "$(dirname "$LOG_FILE")"

# 日志落盘：手动运行（stdout 为终端）时同时落盘 + 终端；被后端 spawn 时 stdout/stderr
# 已由 _spawn_wiki_deploy_script 重定向到同一 LOG_FILE，此处不再 tee（避免重复写）。
if [ -t 1 ]; then
  exec > >(tee -a "$LOG_FILE") 2>&1
fi

log() { printf '\033[34m[build-wiki-local]\033[0m %s\n' "$*"; }
err() { printf '\033[31m[build-wiki-local] ERROR:\033[0m %s\n' "$*" >&2; }

# 并发锁：串行化多次 publish(target=local) 触发的并发 spawn，避免 next build 并发
# 损坏 out/。用 mkdir 原子操作（portable；flock 仅 Linux，本地 macOS 主站不可用）。
# 拿不到锁则跳过本次——publish 幂等，下次会带上最新内容。
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  LOCK_PID="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    err "另一本地重建进程正在运行（pid $LOCK_PID），跳过本次（下次 publish 会带上最新内容）。"
    exit 0
  fi
  err "检测到陈旧锁（pid ${LOCK_PID:-unknown} 已不在），清理后重试。"
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
fi
echo "$$" > "$LOCK_DIR/pid"
trap 'rm -rf "$LOCK_DIR" 2>/dev/null || true' EXIT
log "已获取本地重建锁（pid $$）→ $LOCK_DIR"

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
