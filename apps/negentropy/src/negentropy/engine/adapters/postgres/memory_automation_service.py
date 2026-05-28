from __future__ import annotations

import json
from copy import deepcopy
from typing import Any, Literal

from sqlalchemy import select, text

from negentropy.db.session import AsyncSessionLocal
from negentropy.logging import get_logger
from negentropy.models.base import NEGENTROPY_SCHEMA
from negentropy.models.internalization import MemoryAutomationConfig

logger = get_logger("negentropy.engine.adapters.postgres.memory_automation_service")

JobKey = Literal["cleanup_memories", "trigger_consolidation", "reweight_relevance"]

TASK_KEY_MAP: dict[str, str] = {
    "cleanup_memories": "memory_cleanup",
    "trigger_consolidation": "memory_consolidation",
    "reweight_relevance": "memory_reweight",
}

JOB_LABELS: dict[JobKey, str] = {
    "cleanup_memories": "Ebbinghaus Cleanup",
    "trigger_consolidation": "Maintenance Consolidation",
    "reweight_relevance": "Rocchio Reweight",
}

JOB_FUNCTION_NAMES: dict[JobKey, str] = {
    "cleanup_memories": "cleanup_low_value_memories",
    "trigger_consolidation": "trigger_maintenance_consolidation",
    "reweight_relevance": "reweight_all_users_relevance",
}

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
    "reweight_relevance": {
        "enabled": False,
        "schedule": "0 */6 * * *",
    },
}


def _format_float(value: float) -> str:
    return f"{value:.6f}".rstrip("0").rstrip(".")


def _escape_sql_literal(value: str) -> str:
    return value.replace("'", "''")


def _build_function_definitions(config: dict[str, Any]) -> dict[str, str]:
    retention = config["retention"]
    consolidation = config["consolidation"]
    context = config["context_assembler"]

    decay_lambda = _format_float(retention["decay_lambda"])
    low_retention_threshold = _format_float(retention["low_retention_threshold"])
    min_age_days = int(retention["min_age_days"])
    max_tokens = int(context["max_tokens"])
    memory_ratio = _format_float(context["memory_ratio"])
    history_ratio = _format_float(context["history_ratio"])
    lookback_interval = _escape_sql_literal(str(consolidation["lookback_interval"]))

    return {
        "calculate_retention_score": f"""
CREATE OR REPLACE FUNCTION {NEGENTROPY_SCHEMA}.calculate_retention_score(
    p_access_count INTEGER,
    p_last_accessed_at TIMESTAMP WITH TIME ZONE,
    p_decay_rate FLOAT DEFAULT {decay_lambda}
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
    p_threshold FLOAT DEFAULT {low_retention_threshold},
    p_min_age_days INTEGER DEFAULT {min_age_days},
    p_decay_rate FLOAT DEFAULT {decay_lambda}
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
    p_max_tokens INTEGER DEFAULT {max_tokens},
    p_memory_ratio FLOAT DEFAULT {memory_ratio},
    p_history_ratio FLOAT DEFAULT {history_ratio}
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
    p_interval INTERVAL DEFAULT '{lookback_interval}'
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
        "reweight_all_users_relevance": f"""
CREATE OR REPLACE FUNCTION {NEGENTROPY_SCHEMA}.reweight_all_users_relevance()
RETURNS INTEGER AS $$
DECLARE
    user_record RECORD;
    updated_count INTEGER := 0;
    batch_count INTEGER;
BEGIN
    FOR user_record IN
        SELECT DISTINCT user_id, app_name FROM {NEGENTROPY_SCHEMA}.memory_retrieval_logs
        WHERE outcome_feedback IS NOT NULL
    LOOP
        -- The actual reweight logic is in Python (rocchio_reweighter.py)
        -- This SQL function is a placeholder for the unified scheduler handler
        -- The real execution path goes through run_job() → Python
        updated_count := updated_count + 1;
    END LOOP;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;
""".strip(),
    }


class MemoryAutomationService:
    async def get_snapshot(self, *, app_name: str) -> dict[str, Any]:
        config = await self.get_effective_config(app_name=app_name)
        functions = await self._get_function_states(config=config)
        jobs = await self._get_job_states()
        logs = await self.get_logs(limit=10)

        degraded_reasons: list[str] = []
        if any(item["status"] == "missing" for item in functions):
            degraded_reasons.append("function_missing")
        if any(item["status"] == "drifted" for item in functions):
            degraded_reasons.append("function_drifted")

        return {
            "capabilities": {
                "scheduler_type": "unified_registry",
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
        sql = text(
            f"""
            SELECT te.id, te.task_id, st.key AS task_key, te.status,
                   te.duration_ms, te.started_at, te.finished_at,
                   te.output_summary, te.error, te.fire_reason
            FROM {NEGENTROPY_SCHEMA}.task_executions te
            JOIN {NEGENTROPY_SCHEMA}.scheduled_tasks st ON st.id = te.task_id
            WHERE st.handler_kind = 'memory_automation'
            ORDER BY te.started_at DESC
            LIMIT :limit
            """
        )
        async with AsyncSessionLocal() as db:
            result = await db.execute(sql, {"limit": limit})
            rows = result.mappings().all()

        return [
            {
                "execution_id": str(row["id"]),
                "task_id": str(row["task_id"]),
                "task_key": row["task_key"],
                "status": row["status"],
                "duration_ms": row["duration_ms"],
                "started_at": row["started_at"].isoformat() if row["started_at"] else None,
                "finished_at": row["finished_at"].isoformat() if row["finished_at"] else None,
                "output_summary": row["output_summary"],
                "error": row["error"],
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
            result = await db.execute(select(MemoryAutomationConfig).where(MemoryAutomationConfig.app_name == app_name))
            entity = result.scalar_one_or_none()
            if entity is None:
                entity = MemoryAutomationConfig(app_name=app_name, config=merged, updated_by=updated_by)
                db.add(entity)
            else:
                entity.config = merged
                entity.updated_by = updated_by
            await db.commit()

        await self.reconcile_all(app_name=app_name, config=merged)
        await self._sync_config_to_scheduled_tasks(config=merged)
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
        config = await self.get_effective_config(app_name=app_name)
        await self._reconcile_functions(config=config)
        return await self.get_snapshot(app_name=app_name)

    async def reconcile_all(self, *, app_name: str, config: dict[str, Any] | None = None) -> None:
        effective_config = config or await self.get_effective_config(app_name=app_name)
        await self._reconcile_functions(config=effective_config)

    async def run_job(self, *, app_name: str, job_key: JobKey) -> dict[str, Any]:
        config = await self.get_effective_config(app_name=app_name)
        await self._reconcile_functions(config=config)
        process_label = JOB_LABELS.get(job_key, job_key)

        if job_key == "reweight_relevance":
            result_data = await self._run_reweight_relevance()
        elif job_key == "cleanup_memories":
            retention = config["retention"]
            sql = text(
                f"SELECT {NEGENTROPY_SCHEMA}.cleanup_low_value_memories(:threshold, :min_age_days, :decay_lambda)"
            )
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    sql,
                    {
                        "threshold": retention["low_retention_threshold"],
                        "min_age_days": retention["min_age_days"],
                        "decay_lambda": retention["decay_lambda"],
                    },
                )
                row = result.first()
                await db.commit()
            result_data = row[0] if row else None
        elif job_key == "trigger_consolidation":
            consolidation = config["consolidation"]
            sql = text(f"SELECT {NEGENTROPY_SCHEMA}.trigger_maintenance_consolidation(:lookback::interval)")
            async with AsyncSessionLocal() as db:
                result = await db.execute(sql, {"lookback": consolidation["lookback_interval"]})
                row = result.first()
                await db.commit()
            result_data = row[0] if row else None
        else:
            raise ValueError(f"Unsupported job key: {job_key}")

        return {
            "job_key": job_key,
            "process_label": process_label,
            "result": result_data,
            "snapshot": await self.get_snapshot(app_name=app_name),
        }

    async def _run_reweight_relevance(self) -> dict[str, Any]:
        import sqlalchemy as sa

        from negentropy.engine.relevance.rocchio_reweighter import reweight_memories
        from negentropy.models.internalization import MemoryRetrievalLog

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                sa.select(
                    MemoryRetrievalLog.user_id,
                    MemoryRetrievalLog.app_name,
                )
                .where(MemoryRetrievalLog.outcome_feedback.isnot(None))
                .distinct()
            )
            users = result.all()

        total_reweighted = 0
        failed_users = 0
        for row in users:
            try:
                count = await reweight_memories(user_id=row.user_id, app_name=row.app_name)
                total_reweighted += count
            except Exception:
                failed_users += 1
                logger.warning("reweight_user_failed", user_id=row.user_id, app_name=row.app_name, exc_info=True)

        return {
            "reweighted_memories": total_reweighted,
            "users_processed": len(users) - failed_users,
            "failed_users": failed_users,
        }

    async def list_policy_summary(self, *, app_name: str) -> dict[str, Any]:
        config = await self.get_effective_config(app_name=app_name)
        jobs = await self._get_job_states()
        return {
            "decay_lambda": config["retention"]["decay_lambda"],
            "low_retention_threshold": config["retention"]["low_retention_threshold"],
            "auto_cleanup_enabled": config["retention"]["auto_cleanup_enabled"],
            "cleanup_cron": config["retention"]["cleanup_schedule"],
            "consolidation_enabled": config["consolidation"]["enabled"],
            "consolidation_cron": config["consolidation"]["schedule"],
            "managed_jobs": {job["job_key"]: job["status"] for job in jobs},
        }

    async def _sync_config_to_scheduled_tasks(self, *, config: dict[str, Any]) -> None:
        """Config 变更后同步 payload 和 cron_expr 到 scheduled_tasks。"""
        retention = config["retention"]
        consolidation = config["consolidation"]
        reweight = config["reweight_relevance"]

        updates = [
            (
                TASK_KEY_MAP["cleanup_memories"],
                retention["auto_cleanup_enabled"],
                retention["cleanup_schedule"],
                {
                    "job_type": "cleanup_memories",
                    "threshold": retention["low_retention_threshold"],
                    "min_age_days": retention["min_age_days"],
                    "decay_lambda": retention["decay_lambda"],
                },
            ),
            (
                TASK_KEY_MAP["trigger_consolidation"],
                consolidation["enabled"],
                consolidation["schedule"],
                {
                    "job_type": "trigger_consolidation",
                    "lookback_interval": consolidation["lookback_interval"],
                },
            ),
            (
                TASK_KEY_MAP["reweight_relevance"],
                reweight["enabled"],
                reweight["schedule"],
                {
                    "job_type": "reweight_relevance",
                },
            ),
        ]

        async with AsyncSessionLocal() as db:
            for task_key, enabled, cron_expr, payload in updates:
                await db.execute(
                    text(
                        "UPDATE scheduled_tasks SET enabled = :enabled, "
                        "cron_expr = :cron_expr, payload = :payload ::jsonb "
                        "WHERE key = :task_key"
                    ),
                    {
                        "task_key": task_key,
                        "enabled": enabled,
                        "cron_expr": cron_expr,
                        "payload": json.dumps(payload),
                    },
                )
            await db.commit()

    async def _load_stored_config(self, *, app_name: str) -> dict[str, Any]:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(MemoryAutomationConfig).where(MemoryAutomationConfig.app_name == app_name))
            entity = result.scalar_one_or_none()
        return entity.config if entity and entity.config else {}

    async def _reconcile_functions(self, *, config: dict[str, Any]) -> None:
        function_definitions = _build_function_definitions(config)
        async with AsyncSessionLocal() as db:
            for sql in function_definitions.values():
                await db.execute(text(sql))
            await db.commit()

    async def _get_function_states(self, *, config: dict[str, Any]) -> list[dict[str, Any]]:
        function_definitions = _build_function_definitions(config)
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
                row["name"]: row["definition"] for row in result.mappings().all() if row["name"] in function_definitions
            }

        states = []
        for name, expected in function_definitions.items():
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

    async def _get_job_states(self) -> list[dict[str, Any]]:
        """从 scheduled_tasks 表读取 memory_automation 作业状态。"""
        sql = text(
            f"""
            SELECT id, key, enabled, cron_expr, last_status,
                   last_fire_at, next_fire_at, consecutive_failures,
                   payload, display_name
            FROM {NEGENTROPY_SCHEMA}.scheduled_tasks
            WHERE handler_kind = 'memory_automation'
            ORDER BY key
            """
        )
        async with AsyncSessionLocal() as db:
            result = await db.execute(sql)
            rows = result.mappings().all()

        reverse_map = {v: k for k, v in TASK_KEY_MAP.items()}
        jobs = []
        for row in rows:
            task_key = row["key"]
            job_key = reverse_map.get(task_key, task_key)
            last_status = row["last_status"]
            if last_status is None:
                status = "pending"
            elif last_status == "ok":
                status = "scheduled"
            elif last_status == "failed":
                status = "failed"
            else:
                status = last_status

            jobs.append(
                {
                    "job_key": job_key,
                    "process_label": row["display_name"] or JOB_LABELS.get(job_key, job_key),
                    "function_name": JOB_FUNCTION_NAMES.get(job_key, ""),
                    "enabled": row["enabled"],
                    "status": status,
                    "task_id": str(row["id"]),
                    "schedule": row["cron_expr"] or "",
                    "last_status": last_status,
                    "last_fire_at": row["last_fire_at"].isoformat() if row["last_fire_at"] else None,
                    "next_fire_at": row["next_fire_at"].isoformat() if row["next_fire_at"] else None,
                }
            )
        return jobs

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
                "job": job_map.get("cleanup_memories"),
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
                "job": job_map.get("trigger_consolidation"),
                "functions": [function_map["trigger_maintenance_consolidation"]],
            },
            {
                "key": "reweight_relevance",
                "label": "Rocchio Relevance Reweight",
                "description": "定期聚合用户反馈，调整记忆检索权重。",
                "config": config["reweight_relevance"],
                "job": job_map.get("reweight_relevance"),
                "functions": [function_map["reweight_all_users_relevance"]],
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
        if job_key == "reweight_relevance":
            config["reweight_relevance"]["enabled"] = enabled
            return
        raise ValueError(f"Unsupported job key: {job_key}")

    def _normalize_sql(self, sql: str) -> str:
        return " ".join(sql.split()).strip().lower()
