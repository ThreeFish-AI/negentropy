from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy import select, text

from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA
from negentropy.models.internalization import MemoryAutomationConfig

logger = get_logger("negentropy.engine.adapters.postgres.memory_automation_service")

JobKey = Literal["cleanup_memories", "trigger_consolidation"]


DEFAULT_AUTOMATION_CONFIG: dict[str, Any] = {
    "retention": {
        "decay_lambda": 0.1,
        "low_retention_threshold": 0.1,
        "min_age_days": 7,
        "auto_cleanup_enabled": False,
        "cleanup_schedule": "0 2 * * *",
    },
    "consolidation": {
        "enabled": False,
        "schedule": "0 * * * *",
        "lookback_interval": "1 hour",
    },
    "context_assembler": {
        "max_tokens": 4000,
        "memory_ratio": 0.3,
        "history_ratio": 0.5,
    },
}

FUNCTION_DEFINITIONS: dict[str, str] = {
    "calculate_retention_score": f"""
CREATE OR REPLACE FUNCTION {NEGENTROPY_SCHEMA}.calculate_retention_score(
    p_access_count INTEGER,
    p_last_accessed_at TIMESTAMP WITH TIME ZONE,
    p_decay_rate FLOAT DEFAULT 0.1
)
RETURNS FLOAT AS $$
DECLARE
    days_elapsed FLOAT;
    time_decay FLOAT;
    frequency_boost FLOAT;
BEGIN
    days_elapsed := EXTRACT(EPOCH FROM (NOW() - p_last_accessed_at)) / 86400.0;
    time_decay := EXP(-p_decay_rate * days_elapsed);
    frequency_boost := 1.0 + LN(1.0 + p_access_count);
    RETURN LEAST(1.0, time_decay * frequency_boost / 5.0);
END;
$$ LANGUAGE plpgsql;
""".strip(),
    "cleanup_low_value_memories": f"""
CREATE OR REPLACE FUNCTION {NEGENTROPY_SCHEMA}.cleanup_low_value_memories(
    p_threshold FLOAT DEFAULT 0.1,
    p_min_age_days INTEGER DEFAULT 7,
    p_decay_rate FLOAT DEFAULT 0.1
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE {NEGENTROPY_SCHEMA}.memories
    SET retention_score = {NEGENTROPY_SCHEMA}.calculate_retention_score(
        access_count,
        COALESCE(last_accessed_at, created_at),
        p_decay_rate
    );

    DELETE FROM {NEGENTROPY_SCHEMA}.memories
    WHERE retention_score < p_threshold
      AND created_at < NOW() - make_interval(days => p_min_age_days);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
""".strip(),
    "get_context_window": f"""
CREATE OR REPLACE FUNCTION {NEGENTROPY_SCHEMA}.get_context_window(
    p_user_id VARCHAR(255),
    p_app_name VARCHAR(255),
    p_query TEXT,
    p_query_embedding vector(1536),
    p_max_tokens INTEGER DEFAULT 4000,
    p_memory_ratio FLOAT DEFAULT 0.3,
    p_history_ratio FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    context_type VARCHAR(50),
    content TEXT,
    relevance_score FLOAT,
    token_estimate INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'memory'::VARCHAR(50),
        m.content,
        (1 - (m.embedding <=> p_query_embedding)) * m.retention_score AS relevance_score,
        (LENGTH(m.content) / 4)::INTEGER AS token_estimate
    FROM {NEGENTROPY_SCHEMA}.memories m
    WHERE m.user_id = p_user_id
      AND m.app_name = p_app_name
    ORDER BY relevance_score DESC
    LIMIT GREATEST(1, (p_max_tokens * p_memory_ratio / 256)::INTEGER);

    RETURN QUERY
    SELECT
        'history'::VARCHAR(50),
        e.content::TEXT,
        1.0::FLOAT,
        (LENGTH(e.content::TEXT) / 4)::INTEGER
    FROM {NEGENTROPY_SCHEMA}.events e
    JOIN {NEGENTROPY_SCHEMA}.threads t ON e.thread_id = t.id
    WHERE t.user_id = p_user_id
      AND t.app_name = p_app_name
    ORDER BY e.created_at DESC
    LIMIT GREATEST(1, (p_max_tokens * p_history_ratio / 256)::INTEGER);
END;
$$ LANGUAGE plpgsql;
""".strip(),
    "trigger_maintenance_consolidation": f"""
CREATE OR REPLACE FUNCTION {NEGENTROPY_SCHEMA}.trigger_maintenance_consolidation(
    p_interval INTERVAL DEFAULT '1 hour'
)
RETURNS INTEGER AS $$
DECLARE
    job_count INTEGER;
BEGIN
    WITH new_jobs AS (
        INSERT INTO {NEGENTROPY_SCHEMA}.consolidation_jobs (thread_id, job_type, status)
        SELECT t.id, 'full_consolidation', 'pending'
        FROM {NEGENTROPY_SCHEMA}.threads t
        WHERE t.updated_at > NOW() - p_interval
          AND NOT EXISTS (
              SELECT 1
              FROM {NEGENTROPY_SCHEMA}.consolidation_jobs cj
              WHERE cj.thread_id = t.id
                AND cj.created_at > NOW() - p_interval
          )
        RETURNING 1
    )
    SELECT COUNT(*) INTO job_count FROM new_jobs;

    RETURN job_count;
END;
$$ LANGUAGE plpgsql;
""".strip(),
}


@dataclass(frozen=True)
class JobTemplate:
    key: JobKey
    process_label: str
    function_name: str


JOB_TEMPLATES: dict[JobKey, JobTemplate] = {
    "cleanup_memories": JobTemplate(
        key="cleanup_memories",
        process_label="Ebbinghaus Cleanup",
        function_name="cleanup_low_value_memories",
    ),
    "trigger_consolidation": JobTemplate(
        key="trigger_consolidation",
        process_label="Maintenance Consolidation",
        function_name="trigger_maintenance_consolidation",
    ),
}


class MemoryAutomationService:
    async def get_snapshot(self, *, app_name: str) -> dict[str, Any]:
        config = await self.get_effective_config(app_name=app_name)
        capabilities = await self._get_capabilities()
        functions = await self._get_function_states()
        jobs = await self._get_job_states(config=config, capabilities=capabilities)
        logs = await self.get_logs(limit=10)

        degraded_reasons: list[str] = []
        if not capabilities["pg_cron_installed"]:
            degraded_reasons.append("pg_cron_not_installed")
        if any(item["status"] == "missing" for item in functions):
            degraded_reasons.append("function_missing")

        return {
            "capabilities": {
                **capabilities,
                "management_mode": "backend-managed",
                "degraded_reasons": degraded_reasons,
            },
            "config": config,
            "functions": functions,
            "jobs": jobs,
            "health": {
                "status": "degraded" if degraded_reasons else "healthy",
                "recent_log_count": len(logs),
            },
            "processes": self._build_processes(config=config, jobs=jobs, functions=functions),
        }

    async def get_logs(self, *, limit: int = 20) -> list[dict[str, Any]]:
        if not await self._is_pg_cron_installed():
            return []

        sql = text(
            """
            SELECT jobid, runid, database, username, command, status, return_message, start_time, end_time
            FROM cron.job_run_details
            ORDER BY start_time DESC
            LIMIT :limit
            """
        )
        async with AsyncSessionLocal() as db:
            result = await db.execute(sql, {"limit": limit})
            rows = result.mappings().all()

        return [
            {
                "job_id": row["jobid"],
                "run_id": row["runid"],
                "database": row["database"],
                "username": row["username"],
                "command": row["command"],
                "status": row["status"],
                "return_message": row["return_message"],
                "start_time": row["start_time"].isoformat() if row["start_time"] else None,
                "end_time": row["end_time"].isoformat() if row["end_time"] else None,
            }
            for row in rows
        ]

    async def get_effective_config(self, *, app_name: str) -> dict[str, Any]:
        stored = await self._load_stored_config(app_name=app_name)
        return self._merge_config(DEFAULT_AUTOMATION_CONFIG, stored)

    async def update_config(self, *, app_name: str, config: dict[str, Any], updated_by: str) -> dict[str, Any]:
        merged = self._merge_config(DEFAULT_AUTOMATION_CONFIG, config)
        self._validate_config(merged)

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(MemoryAutomationConfig).where(MemoryAutomationConfig.app_name == app_name)
            )
            entity = result.scalar_one_or_none()
            if entity is None:
                entity = MemoryAutomationConfig(app_name=app_name, config=merged, updated_by=updated_by)
                db.add(entity)
            else:
                entity.config = merged
                entity.updated_by = updated_by
            await db.commit()

        await self.reconcile_all(app_name=app_name)
        return merged

    async def enable_job(self, *, app_name: str, job_key: JobKey) -> dict[str, Any]:
        config = await self.get_effective_config(app_name=app_name)
        self._set_job_enabled(config, job_key, True)
        await self.update_config(app_name=app_name, config=config, updated_by="system:job-enable")
        return await self.get_snapshot(app_name=app_name)

    async def disable_job(self, *, app_name: str, job_key: JobKey) -> dict[str, Any]:
        config = await self.get_effective_config(app_name=app_name)
        self._set_job_enabled(config, job_key, False)
        await self.update_config(app_name=app_name, config=config, updated_by="system:job-disable")
        return await self.get_snapshot(app_name=app_name)

    async def reconcile_job(self, *, app_name: str, job_key: JobKey) -> dict[str, Any]:
        await self._reconcile_functions()
        if await self._is_pg_cron_installed():
            config = await self.get_effective_config(app_name=app_name)
            await self._reconcile_single_job(job_key=job_key, config=config)
        return await self.get_snapshot(app_name=app_name)

    async def reconcile_all(self, *, app_name: str) -> None:
        await self._reconcile_functions()
        if not await self._is_pg_cron_installed():
            return
        config = await self.get_effective_config(app_name=app_name)
        for job_key in JOB_TEMPLATES:
            await self._reconcile_single_job(job_key=job_key, config=config)

    async def run_job(self, *, app_name: str, job_key: JobKey) -> dict[str, Any]:
        config = await self.get_effective_config(app_name=app_name)
        await self._reconcile_functions()
        template = self._get_job_template(job_key)
        sql = self._build_manual_run_sql(job_key=job_key, config=config)
        async with AsyncSessionLocal() as db:
            result = await db.execute(text(sql))
            row = result.first()
            await db.commit()
        return {
            "job_key": job_key,
            "process_label": template.process_label,
            "result": row[0] if row else None,
            "snapshot": await self.get_snapshot(app_name=app_name),
        }

    async def list_policy_summary(self, *, app_name: str) -> dict[str, Any]:
        config = await self.get_effective_config(app_name=app_name)
        capabilities = await self._get_capabilities()
        jobs = await self._get_job_states(config=config, capabilities=capabilities)
        return {
            "decay_lambda": config["retention"]["decay_lambda"],
            "low_retention_threshold": config["retention"]["low_retention_threshold"],
            "auto_cleanup_enabled": config["retention"]["auto_cleanup_enabled"],
            "cleanup_cron": config["retention"]["cleanup_schedule"],
            "consolidation_enabled": config["consolidation"]["enabled"],
            "consolidation_cron": config["consolidation"]["schedule"],
            "pg_cron_installed": capabilities["pg_cron_installed"],
            "managed_jobs": {job["job_key"]: job["status"] for job in jobs},
        }

    async def _load_stored_config(self, *, app_name: str) -> dict[str, Any]:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(MemoryAutomationConfig).where(MemoryAutomationConfig.app_name == app_name)
            )
            entity = result.scalar_one_or_none()
        return entity.config if entity and entity.config else {}

    async def _reconcile_functions(self) -> None:
        async with AsyncSessionLocal() as db:
            for sql in FUNCTION_DEFINITIONS.values():
                await db.execute(text(sql))
            await db.commit()

    async def _reconcile_single_job(self, *, job_key: JobKey, config: dict[str, Any]) -> None:
        template = self._get_job_template(job_key)
        enabled, schedule, command = self._build_job_runtime(job_key=job_key, config=config)
        async with AsyncSessionLocal() as db:
            if not enabled:
                await db.execute(
                    text("SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = :job_name"),
                    {"job_name": template.key},
                )
                await db.commit()
                return

            existing = await db.execute(
                text(
                    """
                    SELECT jobid, schedule, command
                    FROM cron.job
                    WHERE jobname = :job_name
                    LIMIT 1
                    """
                ),
                {"job_name": template.key},
            )
            row = existing.mappings().first()
            if row is None:
                await db.execute(
                    text("SELECT cron.schedule(:job_name, :schedule, :command)"),
                    {"job_name": template.key, "schedule": schedule, "command": command},
                )
            elif row["schedule"] != schedule or row["command"] != command:
                await db.execute(
                    text("SELECT cron.unschedule(:job_id)"),
                    {"job_id": row["jobid"]},
                )
                await db.execute(
                    text("SELECT cron.schedule(:job_name, :schedule, :command)"),
                    {"job_name": template.key, "schedule": schedule, "command": command},
                )
            await db.commit()

    async def _get_capabilities(self) -> dict[str, Any]:
        installed = await self._is_pg_cron_installed()
        return {
            "pg_cron_installed": installed,
            "pg_cron_available": installed,
        }

    async def _get_function_states(self) -> list[dict[str, Any]]:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                text(
                    """
                    SELECT p.proname AS name, pg_get_functiondef(p.oid) AS definition
                    FROM pg_proc p
                    JOIN pg_namespace n ON p.pronamespace = n.oid
                    WHERE n.nspname = :schema
                    """
                ),
                {"schema": NEGENTROPY_SCHEMA},
            )
            rows = {
                row["name"]: row["definition"]
                for row in result.mappings().all()
                if row["name"] in FUNCTION_DEFINITIONS
            }

        states = []
        for name, expected in FUNCTION_DEFINITIONS.items():
            definition = rows.get(name)
            normalized_expected = self._normalize_sql(expected)
            normalized_actual = self._normalize_sql(definition or "")
            status = "present"
            if definition is None:
                status = "missing"
            elif normalized_expected != normalized_actual:
                status = "drifted"
            states.append(
                {
                    "name": name,
                    "schema": NEGENTROPY_SCHEMA,
                    "status": status,
                    "definition": definition or expected,
                    "managed": True,
                }
            )
        return states

    async def _get_job_states(self, *, config: dict[str, Any], capabilities: dict[str, Any]) -> list[dict[str, Any]]:
        cron_rows: dict[str, dict[str, Any]] = {}
        if capabilities["pg_cron_installed"]:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    text(
                        """
                        SELECT jobid, jobname, schedule, command, active
                        FROM cron.job
                        """
                    ),
                )
                cron_rows = {
                    row["jobname"]: dict(row)
                    for row in result.mappings().all()
                    if row["jobname"] in JOB_TEMPLATES
                }

        jobs = []
        for job_key, template in JOB_TEMPLATES.items():
            enabled, schedule, command = self._build_job_runtime(job_key=job_key, config=config)
            row = cron_rows.get(job_key)
            status = "disabled"
            if row:
                status = "scheduled"
                if row["schedule"] != schedule or row["command"] != command:
                    status = "drifted"
            elif enabled and not capabilities["pg_cron_installed"]:
                status = "degraded"
            elif enabled:
                status = "missing"

            jobs.append(
                {
                    "job_key": job_key,
                    "process_label": template.process_label,
                    "function_name": template.function_name,
                    "enabled": enabled,
                    "status": status,
                    "job_id": row["jobid"] if row else None,
                    "schedule": schedule,
                    "command": command,
                    "active": bool(row["active"]) if row and "active" in row else False,
                }
            )
        return jobs

    async def _is_pg_cron_installed(self) -> bool:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                text("SELECT 1 FROM pg_extension WHERE extname = 'pg_cron' LIMIT 1")
            )
            return result.scalar() == 1

    def _build_processes(
        self,
        *,
        config: dict[str, Any],
        jobs: list[dict[str, Any]],
        functions: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        function_map = {item["name"]: item for item in functions}
        job_map = {item["job_key"]: item for item in jobs}
        return [
            {
                "key": "retention_cleanup",
                "label": "Retention Cleanup",
                "description": "基于艾宾浩斯遗忘曲线清理低价值记忆。",
                "config": config["retention"],
                "job": job_map["cleanup_memories"],
                "functions": [
                    function_map["calculate_retention_score"],
                    function_map["cleanup_low_value_memories"],
                ],
            },
            {
                "key": "context_assembler",
                "label": "Context Assembler",
                "description": "按 token 预算组装长期记忆与对话历史。",
                "config": config["context_assembler"],
                "job": None,
                "functions": [function_map["get_context_window"]],
            },
            {
                "key": "maintenance_consolidation",
                "label": "Maintenance Consolidation",
                "description": "按时间窗口批量触发会话巩固任务。",
                "config": config["consolidation"],
                "job": job_map["trigger_consolidation"],
                "functions": [function_map["trigger_maintenance_consolidation"]],
            },
        ]

    def _merge_config(self, base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
        merged = deepcopy(base)
        for key, value in patch.items():
            if isinstance(value, dict) and isinstance(merged.get(key), dict):
                merged[key] = self._merge_config(merged[key], value)
            else:
                merged[key] = value
        return merged

    def _validate_config(self, config: dict[str, Any]) -> None:
        retention = config["retention"]
        context = config["context_assembler"]
        if retention["decay_lambda"] <= 0:
            raise ValueError("retention.decay_lambda must be > 0")
        if not 0 < retention["low_retention_threshold"] < 1:
            raise ValueError("retention.low_retention_threshold must be between 0 and 1")
        if retention["min_age_days"] < 1:
            raise ValueError("retention.min_age_days must be >= 1")
        if context["max_tokens"] < 256:
            raise ValueError("context_assembler.max_tokens must be >= 256")
        if context["memory_ratio"] <= 0 or context["history_ratio"] <= 0:
            raise ValueError("context_assembler ratios must be > 0")
        if context["memory_ratio"] + context["history_ratio"] > 1:
            raise ValueError("context_assembler ratios must sum to <= 1")

    def _set_job_enabled(self, config: dict[str, Any], job_key: JobKey, enabled: bool) -> None:
        if job_key == "cleanup_memories":
            config["retention"]["auto_cleanup_enabled"] = enabled
            return
        if job_key == "trigger_consolidation":
            config["consolidation"]["enabled"] = enabled
            return
        raise ValueError(f"Unsupported job key: {job_key}")

    def _build_job_runtime(self, *, job_key: JobKey, config: dict[str, Any]) -> tuple[bool, str, str]:
        if job_key == "cleanup_memories":
            retention = config["retention"]
            return (
                bool(retention["auto_cleanup_enabled"]),
                retention["cleanup_schedule"],
                "SELECT "
                f"{NEGENTROPY_SCHEMA}.cleanup_low_value_memories("
                f"{retention['low_retention_threshold']}, "
                f"{retention['min_age_days']}, "
                f"{retention['decay_lambda']}"
                ")",
            )
        consolidation = config["consolidation"]
        interval = str(consolidation["lookback_interval"]).replace("'", "''")
        return (
            bool(consolidation["enabled"]),
            consolidation["schedule"],
            "SELECT "
            f"{NEGENTROPY_SCHEMA}.trigger_maintenance_consolidation('{interval}'::interval)",
        )

    def _build_manual_run_sql(self, *, job_key: JobKey, config: dict[str, Any]) -> str:
        _, _, command = self._build_job_runtime(job_key=job_key, config=config)
        return command

    def _normalize_sql(self, sql: str) -> str:
        return " ".join(sql.split()).strip().lower()

    def _get_job_template(self, job_key: JobKey) -> JobTemplate:
        template = JOB_TEMPLATES.get(job_key)
        if template is None:
            raise ValueError(f"Unsupported job key: {job_key}")
        return template
