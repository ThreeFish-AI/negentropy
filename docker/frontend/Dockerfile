# =============================================================================
# Negentropy Frontend — Multi-stage Dockerfile (UI only)
# =============================================================================
# Node 22 + pnpm monorepo 构建 Next.js standalone 输出。
# 仅用于 negentropy-ui（主聊天前端，需 Node 运行时）。
# negentropy-wiki 已迁移至 docker/wiki/Dockerfile（纯静态托管，无 Node 运行时）。
# =============================================================================

ARG TARGET_SERVICE=negentropy-ui

# ── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:22-slim AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 先复制 workspace 根文件（利用 Docker 层缓存）
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# 复制所有 package.json（workspace resolution 需要）
COPY packages/agents-chat-core/package.json ./packages/agents-chat-core/package.json
COPY apps/negentropy-ui/package.json ./apps/negentropy-ui/package.json
COPY apps/negentropy-wiki/package.json ./apps/negentropy-wiki/package.json

# 安装依赖（frozen lockfile）
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ──────────────────────────────────────────────────────────
FROM deps AS builder

ARG TARGET_SERVICE

# 复制共享库源码
COPY packages/agents-chat-core/ ./packages/agents-chat-core/

# 复制目标应用源码
COPY apps/${TARGET_SERVICE}/ ./apps/${TARGET_SERVICE}/

# 先构建共享库 @negentropy/agents-chat-core（ui/wiki 均依赖）
RUN pnpm --filter @negentropy/agents-chat-core build

# 构建目标应用（NEGENTROPY_CORE_PREBUILT=1 跳过 core 重复构建）
WORKDIR /app/apps/${TARGET_SERVICE}
ENV NEGENTROPY_CORE_PREBUILT=1
RUN pnpm build

# ── Stage 3: Production runtime ─────────────────────────────────────────────
FROM node:22-slim AS runner

ARG TARGET_SERVICE

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# 复制 standalone 输出（Next.js 独立部署产物）
# monorepo 模式下 standalone 输出包含 apps/<service>/ 目录结构
COPY --from=builder /app/apps/${TARGET_SERVICE}/.next/standalone ./

# 复制 static 资源和 public（standalone 不自动包含）
COPY --from=builder /app/apps/${TARGET_SERVICE}/.next/static ./apps/${TARGET_SERVICE}/.next/static
COPY --from=builder /app/apps/${TARGET_SERVICE}/public ./apps/${TARGET_SERVICE}/public

# 复制生产启动脚本（处理 standalone 输出路径检测与 symlink）
COPY --from=builder /app/apps/${TARGET_SERVICE}/scripts ./apps/${TARGET_SERVICE}/scripts
COPY --from=builder /app/apps/${TARGET_SERVICE}/package.json ./apps/${TARGET_SERVICE}/package.json

WORKDIR /app/apps/${TARGET_SERVICE}

# start-production.mjs 默认 PORT=3192（ui）或 3092（wiki），HOSTNAME=localhost
# Docker 环境变量 PORT / HOSTNAME 会覆盖默认值
CMD ["node", "./scripts/start-production.mjs"]
