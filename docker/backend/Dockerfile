# =============================================================================
# Negentropy Backend — Multi-stage Dockerfile
# =============================================================================
# Python 3.13 + uv 构建的 Google ADK Web Server（含 Alembic 迁移）
# =============================================================================

# ── Stage 1: Build dependencies ─────────────────────────────────────────────
FROM python:3.13-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# 与 runtime stage 同路径（/app）：uv 生成的 console_script shebang 与 editable install
# 的 .pth 会被固化为该绝对路径，builder/runtime 一致方能在 runtime 正确解析（否则 exec 报
# "no such file or directory"、容器退出码 255）。
WORKDIR /app

# 先复制依赖声明与 README（pyproject.toml 引用 README.md，hatchling 构建需要）
COPY apps/negentropy/pyproject.toml apps/negentropy/uv.lock apps/negentropy/README.md ./

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

# 从 builder 复制虚拟环境（builder/runtime 同为 /app，确保 console_script shebang 生效）
COPY --from=builder /app/.venv /app/.venv

# 复制应用代码
COPY --from=builder /app/src ./src/

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
