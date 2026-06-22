#!/usr/bin/env bash
# publish-wiki-pages.sh — 本地一键把 Wiki 发布到独立 GitHub Pages 仓库
#
# 链路：主站 DB 导出（烘焙图片）→ next build → 推 out/ 到 Pages 仓库分支。
# 适用「主站纯本地（DB 不公网暴露）」场景——云端 CI 连不上本地 DB，故在本地完成
# 导出+构建+推送，使 https://<org>.github.io 自包含上线（零主站运行时依赖）。
#
# 由后端 publish 后 spawn（NE_KNOWLEDGE_WIKI_PAGES_PUBLISH__ENABLED=true），
# 或手动执行。
#
# 前置：
#   - postgres 运行中（NE_DB_URL 未设时用默认 localhost:5432/negentropy）
#   - 至少一个 status=published 的 Wiki publication
#   - 对目标 Pages 仓库有 push 权限（SSH key、或 WIKI_PAGES_TOKEN/gh CLI 的 HTTPS token）
#   - 目标仓库 Settings → Pages 已选 source = 目标分支 / root
#
# 配置（环境变量）：
#   WIKI_PAGES_REPO    目标仓库（默认 ThreeFish-AI/threefish-ai.github.io）。可为
#                      git@github.com:owner/repo.git（SSH）或 https://github.com/owner/repo.git。
#   WIKI_PAGES_BRANCH  目标分支（默认 master —— GitHub user/org pages 默认分支）
#   WIKI_PAGES_TOKEN   可选；GitHub PAT/token。提供则用 HTTPS + token 推送（x-access-token），
#                      无需 SSH key。缺省时回退 `gh auth token`（若装了 gh CLI），再缺则用
#                      WIKI_PAGES_REPO 原样（SSH 凭证由本机 ssh-agent 提供）。
#   WIKI_PAGES_BACKUP  覆盖前是否在目标仓库备份当前分支为 <branch>-archive-<ts>（默认 1=备份）。
#   WIKI_PAGES_DRY_RUN 设为 1 则构建+同步到工作副本但不 commit/push（验证用）。
#
# 用法：
#   WIKI_PAGES_TOKEN=$(gh auth token) ./scripts/publish-wiki-pages.sh
#   WIKI_PAGES_DRY_RUN=1 ./scripts/publish-wiki-pages.sh   # 演练

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"

# ── 配置 ──────────────────────────────────────────────────────────────────────
WIKI_PAGES_REPO="${WIKI_PAGES_REPO:-https://github.com/ThreeFish-AI/threefish-ai.github.io.git}"
WIKI_PAGES_BRANCH="${WIKI_PAGES_BRANCH:-master}"
WIKI_PAGES_DRY_RUN="${WIKI_PAGES_DRY_RUN:-0}"
WIKI_PAGES_BACKUP="${WIKI_PAGES_BACKUP:-1}"

OUT_DIR="$REPO_ROOT/apps/negentropy-wiki/out"
WORK_DIR="$REPO_ROOT/.temp/wiki-pages-repo"   # 目标仓库的本地工作副本（gitignored .temp/）
LOG_FILE="$REPO_ROOT/.temp/wiki-pages-publish.log"   # 全流程日志（后端 spawn / 手动运行统一入口）
LOCK_DIR="$REPO_ROOT/.temp/wiki-pages-publish.lock"  # 并发锁目录（mkdir 原子操作）
mkdir -p "$(dirname "$LOG_FILE")"

# 日志落盘：手动运行（stdout 为终端）时同时落盘 + 终端；被后端 spawn 时 stdout/stderr
# 已由 _maybe_spawn_pages_publish 重定向到同一 LOG_FILE，此处不再 tee（避免重复写）。
if [ -t 1 ]; then
  exec > >(tee -a "$LOG_FILE") 2>&1
fi

log() { printf '\033[34m[publish-wiki-pages]\033[0m %s\n' "$*"; }
err() { printf '\033[31m[publish-wiki-pages] ERROR:\033[0m %s\n' "$*" >&2; }

# 并发锁：串行化多次 publish 触发的 spawn，避免目标 Pages 仓库 push 竞争（后写覆盖 /
# 分支冲突 / 备份分支污染）。用 mkdir 原子操作实现（portable；flock 仅 Linux，本地
# macOS 主站不可用）。拿不到锁则跳过本次——publish 幂等，下次会带上最新内容。
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  LOCK_PID="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    err "另一发布进程正在运行（pid $LOCK_PID），跳过本次（下次 publish 会带上最新内容）。"
    exit 0
  fi
  err "检测到陈旧锁（pid ${LOCK_PID:-unknown} 已不在），清理后重试。"
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR"
fi
echo "$$" > "$LOCK_DIR/pid"
trap 'rm -rf "$LOCK_DIR" 2>/dev/null || true' EXIT
log "已获取发布锁（pid $$）→ $LOCK_DIR"

# 解析推送 URL：优先 WIKI_PAGES_TOKEN（或 gh auth token）→ HTTPS+token；否则原样（SSH）。
# token 仅注入到 remote URL，不落盘日志（git remote 存于 .git/config，工作副本在 gitignored .temp/）。
_resolve_push_url() {
  local repo="$WIKI_PAGES_REPO" token="${WIKI_PAGES_TOKEN:-}"
  if [ -z "$token" ] && command -v gh >/dev/null 2>&1; then
    token="$(gh auth token 2>/dev/null || true)"
  fi
  if [ -n "$token" ]; then
    # 归一化为 https://github.com/owner/repo.git 后注入 token
    local path
    path="$(printf '%s' "$repo" | sed -E 's#^git@github\.com:#https://github.com/#; s#^https://github\.com/##')"
    printf 'https://x-access-token:%s@github.com/%s' "$token" "$path"
  else
    printf '%s' "$repo"
  fi
}

# ── Step 1: 导出（烘焙图片为静态文件，零主站依赖）────────────────────────────────
log "Step 1/3 导出 Wiki 内容（烘焙图片）→ content/"
# bake_assets=true：图片字节写入 content/assets/，markdown 改相对路径，产物自包含。
# inmemory 容忍用户级 config 中失效的 artifact_backend 取值（导出不需 artifact 后端）。
NE_SVC_ARTIFACT_BACKEND="${NE_SVC_ARTIFACT_BACKEND:-inmemory}" \
NE_KNOWLEDGE_WIKI_EXPORT__BAKE_ASSETS="${NE_KNOWLEDGE_WIKI_EXPORT__BAKE_ASSETS:-true}" \
  bash -c "cd '$REPO_ROOT/apps/negentropy' && uv run python scripts/export_wiki_content.py --out '$REPO_ROOT/apps/negentropy-wiki/content'" \
  || { err "内容导出失败（postgres 未就绪 / 无已发布内容？）"; exit 1; }

# ── Step 2: 构建静态产物 ────────────────────────────────────────────────────────
log "Step 2/3 next build → out/（含 assets/ + pagefind/）"
(cd "$REPO_ROOT" && pnpm --filter negentropy-wiki build) \
  || { err "wiki 构建失败"; exit 1; }
[ -f "$OUT_DIR/index.html" ] || { err "构建产物缺失：$OUT_DIR/index.html"; exit 1; }

# ── Step 3: 同步 out/ 到目标 Pages 仓库并推送 ───────────────────────────────────
log "Step 3/3 同步到 $WIKI_PAGES_REPO ($WIKI_PAGES_BRANCH)"

PUSH_URL="$(_resolve_push_url)"   # 含 token（若有）；仅存于 remote，不打印

# 每次重新浅克隆（避免复用副本残留旧 token；.temp 已 gitignored）。
rm -rf "$WORK_DIR"; mkdir -p "$(dirname "$WORK_DIR")"
git clone --depth=1 --branch "$WIKI_PAGES_BRANCH" "$PUSH_URL" "$WORK_DIR" 2>/dev/null \
  || { err "克隆目标仓库失败（仓库/分支 $WIKI_PAGES_BRANCH 存在？凭证就绪？）"; exit 1; }

# 覆盖前备份目标分支（可逆兜底）：把当前 HEAD 推到 <branch>-archive-<ts>。
# 适用「目标分支原本有内容（如既有站点）」——一次性覆盖前留存，可随时恢复。
if [ "$WIKI_PAGES_BACKUP" = "1" ] && [ "$WIKI_PAGES_DRY_RUN" != "1" ]; then
  ARCHIVE_BRANCH="${WIKI_PAGES_BRANCH}-archive-$(date -u +%Y%m%d%H%M%S)"
  if git -C "$WORK_DIR" push origin "HEAD:refs/heads/${ARCHIVE_BRANCH}" 2>/dev/null; then
    log "已备份目标分支当前内容 → ${ARCHIVE_BRANCH}"
  else
    log "备份分支推送跳过（无变更/权限不足，不阻断发布）"
  fi
fi

# 全量覆盖：out/ → 工作副本；--delete 使目标仅含当前快照（连同旧站点文件一并清理）；
# 保留 .git 与 CNAME（自定义域名标记，若有）。
rsync -a --delete \
  --exclude='.git/' \
  --exclude='CNAME' \
  "$OUT_DIR/" "$WORK_DIR/"

# .nojekyll：禁用 GitHub Pages 的 Jekyll（legacy 构建模式同样读取），
# 否则 _next/ 等下划线开头目录会被忽略（致 JS/CSS 404）。
touch "$WORK_DIR/.nojekyll"

if [ "$WIKI_PAGES_DRY_RUN" = "1" ]; then
  log "DRY_RUN=1：跳过 commit/push。工作副本已就绪：$WORK_DIR"
  git -C "$WORK_DIR" status --short | head
  exit 0
fi

# 幂等：无变更则跳过（buildId 绑定内容版本，内容未变则 out/ 无差异）。
if [ -z "$(git -C "$WORK_DIR" status --porcelain)" ]; then
  log "无内容变更，跳过提交。"
  exit 0
fi

git -C "$WORK_DIR" add -A
git -C "$WORK_DIR" -c user.name="negentropy-wiki-bot" \
                   -c user.email="wiki-bot@threefish.ai" \
  commit -q -m "chore(wiki): sync static site $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git -C "$WORK_DIR" push origin "$WIKI_PAGES_BRANCH" \
  || { err "推送失败（push 权限？分支保护？）"; exit 1; }

log "✅ 已发布到 $WIKI_PAGES_BRANCH 分支。GitHub Pages 将在数十秒内更新。"
