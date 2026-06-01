# =============================================================================
# Negentropy Backend — Multi-stage Dockerfile
# =============================================================================
# Python 3.13 + uv 构建的 Google ADK Web Server（含 Alembic 迁移）
# =============================================================================

# ── Stage 1: Build dependencies ─────────────────────────────────────────────
FROM python:3.13-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /build

# 先复制依赖声明（利用 Docker 层缓存）
COPY apps/negentropy/pyproject.toml apps/negentropy/uv.lock ./

# 安装依赖到虚拟环境（--frozen 锁定版本，--no-install-project 跳过项目本身）
RUN uv sync --frozen --no-dev --no-install-project

# 复制应用源码
COPY apps/negentropy/src ./src/

# 安装项目本身（使 entry_point 可用）
RUN uv sync --frozen --no-dev

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM python:3.13-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 从 builder 复制虚拟环境
COPY --from=builder /build/.venv /app/.venv

# 复制应用代码
COPY --from=builder /build/src ./src/

# 复制 Alembic 配置（entrypoint 需要执行迁移）
COPY apps/negentropy/alembic.ini ./

# 复制 entrypoint 脚本
COPY docker/backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app" \
    PYTHONUNBUFFERED=1

EXPOSE 3292

ENTRYPOINT ["/app/entrypoint.sh"]
