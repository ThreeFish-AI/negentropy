# =============================================================================
# Negentropy Wiki — 纯静态部署 Dockerfile（独立于主站）
# =============================================================================
# 构建 Next.js `output: export` 产物（out/），用 static-web-server 托管。
# 运行时**无 Node 进程、无后端、无数据库依赖** —— 纯静态站点，可由任意静态托管
# 替换。内容来自仓库内 `apps/negentropy-wiki/content/`（主站 publish 经 CI
# 导出并提交）；构建期只读本地文件，运行期产物为静态 HTML。
#
# 与 docker/frontend/Dockerfile（ui 专用，standalone + node 运行时）解耦。
# =============================================================================

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:22-slim AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 复制 workspace 根文件（层缓存）
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# 复制 workspace 内相关 package.json（与 frontend Dockerfile 同集合，确保 frozen-lockfile 解析稳定）
COPY packages/agents-chat-core/package.json ./packages/agents-chat-core/package.json
COPY apps/negentropy-ui/package.json ./apps/negentropy-ui/package.json
COPY apps/negentropy-wiki/package.json ./apps/negentropy-wiki/package.json

# 安装依赖（含 pagefind 等 devDeps，构建期索引需要）
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build（静态导出）─────────────────────────────────────────────────
FROM deps AS builder

WORKDIR /app

# 复制 wiki 源码 + 静态内容包（CI 已提交）
COPY apps/negentropy-wiki/ ./apps/negentropy-wiki/

# 构建纯静态产物：next build（output:export → out/）+ postbuild pagefind 索引
RUN pnpm --filter negentropy-wiki build

# ── Stage 3: Runtime（纯静态托管，零 Node 运行时）─────────────────────────────
FROM joseluisq/static-web-server:2 AS runtime

# 静态产物拷入默认根目录 /public
COPY --from=builder /app/apps/negentropy-wiki/out /public

# trailingSlash:true 已为每个 [pubSlug]/[...entrySlug] 生成目录式 HTML，
# 无需 SPA fallback；static-web-server 按目录托管即可。
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=80

EXPOSE 80
