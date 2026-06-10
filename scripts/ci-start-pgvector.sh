#!/usr/bin/env bash
# Start pgvector PostgreSQL container for CI with retry (Docker Hub transient timeout protection).
#
# Usage: scripts/ci-start-pgvector.sh [IMAGE] [CONTAINER_NAME]
#
# Environment variables (all optional):
#   PGVECTOR_IMAGE     Docker image (default: pgvector/pgvector:pg16)
#   PGVECTOR_CONTAINER Container name (default: postgres)
#   PGVECTOR_PASSWORD  POSTGRES_PASSWORD (default: postgres)
#   PGVECTOR_DB        POSTGRES_DB (default: test_db)
#   PGVECTOR_USER      POSTGRES_USER (default: postgres)
#   PGVECTOR_PORT      Host port mapping (default: 5432)
#   PULL_MAX_ATTEMPTS  Max pull retry attempts (default: 5)
#   READY_TIMEOUT_SECS Max seconds to wait for readiness (default: 60)
set -euo pipefail

IMAGE="${PGVECTOR_IMAGE:-${1:-pgvector/pgvector:pg16}}"
CONTAINER="${PGVECTOR_CONTAINER:-${2:-postgres}}"
PASSWORD="${PGVECTOR_PASSWORD:-postgres}"
DB="${PGVECTOR_DB:-test_db}"
USER="${PGVECTOR_USER:-postgres}"
PORT="${PGVECTOR_PORT:-5432}"
MAX_ATTEMPTS="${PULL_MAX_ATTEMPTS:-5}"
READY_TIMEOUT="${READY_TIMEOUT_SECS:-60}"

# --- Pull with exponential backoff ---
for i in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "Pulling ${IMAGE} (attempt ${i}/${MAX_ATTEMPTS})..."
  if docker pull "$IMAGE"; then
    echo "Pull succeeded."
    break
  fi
  if [ "$i" -eq "$MAX_ATTEMPTS" ]; then
    echo "::error::Failed to pull ${IMAGE} after ${MAX_ATTEMPTS} attempts"
    exit 1
  fi
  WAIT=$((i * 10))
  echo "Pull failed, retrying in ${WAIT}s..."
  sleep "$WAIT"
done

# --- Start container ---
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD="$PASSWORD" \
  -e POSTGRES_DB="$DB" \
  -e POSTGRES_USER="$USER" \
  -p "${PORT}:5432" \
  "$IMAGE"

# --- Wait for readiness ---
RETRIES=$((READY_TIMEOUT / 2))
echo "Waiting for PostgreSQL to be ready (timeout ${READY_TIMEOUT}s)..."
for i in $(seq 1 "$RETRIES"); do
  if docker exec "$CONTAINER" pg_isready -U "$USER" -q; then
    echo "PostgreSQL is ready."
    exit 0
  fi
  sleep 2
done
echo "::error::PostgreSQL did not become ready in time"
docker logs "$CONTAINER"
exit 1
