# =============================================================================
# Negentropy Perceives — Multi-stage Dockerfile
# =============================================================================
# Python 3.13 + uv 构建的 FastMCP MCP Server（Web/PDF 内容提取）
# =============================================================================

# ── Stage 1: Build dependencies ─────────────────────────────────────────────
FROM python:3.13-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /build

# 先复制依赖声明（利用 Docker 层缓存）
COPY apps/negentropy-perceives/pyproject.toml apps/negentropy-perceives/uv.lock ./

# 安装依赖到虚拟环境
RUN uv sync --frozen --no-dev --no-install-project

# 复制应用源码
COPY apps/negentropy-perceives/src ./src/

# 安装项目本身
RUN uv sync --frozen --no-dev

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM python:3.13-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 从 builder 复制虚拟环境
COPY --from=builder /build/.venv /app/.venv

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app" \
    PYTHONUNBUFFERED=1

EXPOSE 2992

CMD ["negentropy-perceives"]
