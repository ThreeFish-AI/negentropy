-- =============================================================================
-- Negentropy PostgreSQL Initialization
-- =============================================================================
-- Pre-create extensions required by the Negentropy platform.
-- Alembic migrations also execute CREATE EXTENSION IF NOT EXISTS (idempotent),
-- but pre-creating here ensures extensions are available before any migration runs.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
