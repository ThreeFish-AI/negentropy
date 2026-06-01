#!/usr/bin/env bash
# =============================================================================
# Negentropy Backend Entrypoint
# =============================================================================
# 1. 等待 PostgreSQL 就绪（由 docker-compose depends_on + healthcheck 保证）
# 2. 执行 Alembic 数据库迁移
# 3. 启动 ADK Web Server
# =============================================================================
set -euo pipefail

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running Alembic migrations..."
alembic upgrade head
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Alembic migrations completed."

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Negentropy backend server..."
exec negentropy serve --host 0.0.0.0 --port 3292
