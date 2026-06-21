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
#   - 对目标 Pages 仓库有 push 权限（SSH key 或 PAT 凭证已就绪）
#   - 目标仓库 Settings → Pages 已选 source = 目标分支 / root
#
# 配置（环境变量）：
#   WIKI_PAGES_REPO    目标仓库 URL（默认 git@github.com:ThreeFish-AI/threefish-ai.github.io.git）
#   WIKI_PAGES_BRANCH  目标分支（默认 main）
#   WIKI_PAGES_DRY_RUN 设为 1 则构建+同步到工作副本但不 commit/push（验证用）
#
# 用法：
#   ./scripts/publish-wiki-pages.sh
#   WIKI_PAGES_DRY_RUN=1 ./scripts/publish-wiki-pages.sh   # 演练

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"

# ── 配置 ──────────────────────────────────────────────────────────────────────
WIKI_PAGES_REPO="${WIKI_PAGES_REPO:-git@github.com:ThreeFish-AI/threefish-ai.github.io.git}"
WIKI_PAGES_BRANCH="${WIKI_PAGES_BRANCH:-main}"
WIKI_PAGES_DRY_RUN="${WIKI_PAGES_DRY_RUN:-0}"

OUT_DIR="$REPO_ROOT/apps/negentropy-wiki/out"
WORK_DIR="$REPO_ROOT/.temp/wiki-pages-repo"   # 目标仓库的本地工作副本（gitignored .temp/）

log() { printf '\033[34m[publish-wiki-pages]\033[0m %s\n' "$*"; }
err() { printf '\033[31m[publish-wiki-pages] ERROR:\033[0m %s\n' "$*" >&2; }

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

# 准备工作副本：已存在则复用并 fetch，否则浅克隆目标分支。
if [ -d "$WORK_DIR/.git" ]; then
  git -C "$WORK_DIR" remote set-url origin "$WIKI_PAGES_REPO"
  git -C "$WORK_DIR" fetch --depth=1 origin "$WIKI_PAGES_BRANCH" \
    || { err "fetch 目标分支失败（仓库可达性 / 推送凭证？）"; exit 1; }
  git -C "$WORK_DIR" checkout -B "$WIKI_PAGES_BRANCH" "origin/$WIKI_PAGES_BRANCH"
else
  rm -rf "$WORK_DIR"; mkdir -p "$(dirname "$WORK_DIR")"
  git clone --depth=1 --branch "$WIKI_PAGES_BRANCH" "$WIKI_PAGES_REPO" "$WORK_DIR" \
    || { err "克隆目标仓库失败（仓库/分支存在？凭证就绪？）"; exit 1; }
fi

# 增量同步：out/ → 工作副本；--delete 保持目标仅含当前快照；
# 保留 .git 与 CNAME（自定义域名标记，若有）。
rsync -a --delete \
  --exclude='.git/' \
  --exclude='CNAME' \
  "$OUT_DIR/" "$WORK_DIR/"

# .nojekyll：禁用 GitHub Pages 的 Jekyll，否则 _next/ 等下划线开头目录会被忽略（致 JS/CSS 404）。
touch "$WORK_DIR/.nojekyll"

if [ "$WIKI_PAGES_DRY_RUN" = "1" ]; then
  log "DRY_RUN=1：跳过 commit/push。工作副本已就绪：$WORK_DIR"
  git -C "$WORK_DIR" status --short | head
  exit 0
fi

# 幂等：无变更则跳过。
if git -C "$WORK_DIR" diff --quiet && git -C "$WORK_DIR" diff --cached --quiet \
   && [ -z "$(git -C "$WORK_DIR" status --porcelain)" ]; then
  log "无内容变更，跳过提交。"
  exit 0
fi

git -C "$WORK_DIR" add -A
git -C "$WORK_DIR" -c user.name="negentropy-wiki-bot" \
                   -c user.email="wiki-bot@threefish.ai" \
  commit -m "chore(wiki): sync static site $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git -C "$WORK_DIR" push origin "$WIKI_PAGES_BRANCH" \
  || { err "推送失败（push 权限？分支保护？）"; exit 1; }

log "✅ 已发布到 $WIKI_PAGES_REPO ($WIKI_PAGES_BRANCH)。Pages 将在数十秒内更新。"
