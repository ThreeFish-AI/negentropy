# =============================================================================
# Negentropy Perceives — Multi-stage Dockerfile
# =============================================================================
# Python 3.13 + uv 构建的 FastMCP MCP Server（Web/PDF 内容提取）
# =============================================================================

# ── Stage 1: Build dependencies ─────────────────────────────────────────────
FROM python:3.13-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# 与 runtime stage 同路径（/app）：uv 生成的 console_script shebang 与 editable install
# 的 .pth 会被固化为该绝对路径，builder/runtime 一致方能在 runtime 正确解析（否则 exec 报
# "no such file or directory"、容器退出码 255）。
WORKDIR /app

# 先复制依赖声明与 README（pyproject.toml 引用 README.md，hatchling 构建需要）
COPY apps/negentropy-perceives/pyproject.toml apps/negentropy-perceives/uv.lock apps/negentropy-perceives/README.md ./

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

# 从 builder 复制虚拟环境（builder/runtime 同为 /app，确保 console_script shebang 生效）
COPY --from=builder /app/.venv /app/.venv
# 复制应用源码（editable install 的 .pth 指向 /app/src，runtime 须就位）
COPY --from=builder /app/src ./src/

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app" \
    PYTHONUNBUFFERED=1

EXPOSE 2992

CMD ["negentropy-perceives"]
