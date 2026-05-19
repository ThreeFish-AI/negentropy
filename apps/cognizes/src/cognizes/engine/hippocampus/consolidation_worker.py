"""
MemoryConsolidationWorker: 记忆巩固 Worker

实现对标 Google ADK MemoryBankService 的记忆巩固能力：
- Fast Replay: 快速摘要最近对话
- Deep Reflection: 深度提取 Facts 和 Insights
- Vectorization: 向量化并存入 memories/facts 表

参考:
- Google ADK MemoryService: https://google.github.io/adk-docs/sessions/memory/
- LangGraph Memory: https://docs.langchain.com/oss/python/langgraph/memory
"""

from __future__ import annotations

import asyncio
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

import asyncpg
import google.generativeai as genai

from cognizes.core.database import DatabaseManager

# ========================================
# 数据类型定义
# ========================================


class JobType(str, Enum):
    FAST_REPLAY = "fast_replay"
    DEEP_REFLECTION = "deep_reflection"
    FULL_CONSOLIDATION = "full_consolidation"


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class ConsolidationJob:
    """记忆巩固任务"""

    id: str
    thread_id: str
    job_type: JobType
    status: JobStatus = JobStatus.PENDING
    result: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None


@dataclass
class Memory:
    """记忆对象"""

    id: str
    thread_id: str | None
    user_id: str
    app_name: str
    memory_type: str  # 'episodic', 'semantic', 'summary'
    content: str
    embedding: list[float] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    retention_score: float = 1.0
    access_count: int = 0


@dataclass
class Fact:
    """事实对象"""

    id: str
    thread_id: str | None
    user_id: str
    app_name: str
    fact_type: str  # 'preference', 'rule', 'profile'
    key: str
    value: dict[str, Any]
    confidence: float = 1.0


# ========================================
# Prompt 模板
# ========================================

FAST_REPLAY_PROMPT = """你是一个对话摘要专家。请将以下对话历史压缩为一个简洁的摘要，保留关键信息。

对话历史:
{conversation}

要求:
1. 摘要长度不超过 200 字
2. 保留用户的关键问题和 Agent 的核心回答
3. 保留任何重要的决策或结论
4. 使用第三人称描述

请直接输出摘要，不要添加任何前缀或解释。"""

DEEP_REFLECTION_PROMPT = """你是一个用户画像分析专家。请从以下对话中提取用户的关键信息，包括偏好、规则和事实。

对话历史:
{conversation}

请以 JSON 格式输出，格式如下:
```json
{{
    "facts": [
        {{
            "type": "preference|rule|profile",
            "key": "偏好/规则的唯一标识，如 food_preference",
            "value": {{"具体的偏好内容"}},
            "confidence": 0.0-1.0 的置信度分数
        }}
    ],
    "insights": [
        {{
            "content": "从对话中提炼的深层洞察",
            "importance": "high|medium|low"
        }}
    ]
}}
```

要求:

1. 只提取明确表达或可靠推断的信息
2. preference: 用户的喜好（如饮食、风格偏好）
3. rule: 用户设定的规则（如"每周五不开会"）
4. profile: 用户的基本信息（如职业、位置）
5. 如果没有可提取的信息，返回空数组

请只输出 JSON，不要添加任何其他内容。"""

# ========================================

# Memory Consolidation Worker

# ========================================


class MemoryConsolidationWorker:
    """
    记忆巩固 Worker

    负责将 Session 中的对话转化为持久化的记忆：
    1. Fast Replay: 生成对话摘要
    2. Deep Reflection: 提取 Facts 和 Insights
    3. Vectorization: 向量化并写入数据库
    """

    def __init__(
        self,
        db: DatabaseManager,
        model_name: str = "gemini-2.0-flash",
        embedding_model: str = "text-embedding-004",
    ):
        self.db = db
        self.model_name = model_name
        self.embedding_model = embedding_model
        self.model = genai.GenerativeModel(model_name)

    # ========================================
    # 主入口函数
    # ========================================

    async def consolidate(
        self,
        thread_id: str,
        job_type: JobType = JobType.FULL_CONSOLIDATION,
    ) -> ConsolidationJob:
        """
        执行记忆巩固任务

        Args:
            thread_id: 要巩固的会话 ID
            job_type: 任务类型
                - FAST_REPLAY: 仅生成摘要
                - DEEP_REFLECTION: 仅提取 Facts
                - FULL_CONSOLIDATION: 两者都执行

        Returns:
            ConsolidationJob: 任务执行结果
        """
        # 创建任务记录
        job = await self._create_job(thread_id, job_type)

        try:
            # 更新任务状态为运行中
            await self._update_job_status(job.id, JobStatus.RUNNING)
            job.started_at = datetime.now()

            # 获取会话信息
            thread_info = await self._get_thread_info(thread_id)
            if not thread_info:
                raise ValueError(f"Thread {thread_id} not found")

            user_id = thread_info["user_id"]
            app_name = thread_info["app_name"]

            # 提取最近事件
            events = await self._extract_recent_events(thread_id)
            if not events:
                job.result = {"message": "No events to consolidate"}
                await self._update_job_status(job.id, JobStatus.COMPLETED, job.result)
                return job

            # 构建对话文本
            conversation = self._format_conversation(events)

            result = {}

            # 阶段 1: Fast Replay (快回放)
            if job_type in [JobType.FAST_REPLAY, JobType.FULL_CONSOLIDATION]:
                summary = await self._generate_summary(conversation)
                memory = await self._store_summary(
                    thread_id=thread_id,
                    user_id=user_id,
                    app_name=app_name,
                    content=summary,
                )
                result["summary"] = {
                    "memory_id": memory.id,
                    "content": summary[:100] + "..." if len(summary) > 100 else summary,
                }

            # 阶段 2: Deep Reflection (深反思)
            if job_type in [JobType.DEEP_REFLECTION, JobType.FULL_CONSOLIDATION]:
                extraction = await self._extract_facts(conversation)
                facts_stored = []
                insights_stored = []

                # 存储 Facts
                for fact_data in extraction.get("facts", []):
                    fact = await self._store_fact(
                        thread_id=thread_id,
                        user_id=user_id,
                        app_name=app_name,
                        fact_data=fact_data,
                    )
                    facts_stored.append(
                        {
                            "fact_id": fact.id,
                            "key": fact.key,
                        }
                    )

                # 存储 Insights 作为语义记忆
                for insight_data in extraction.get("insights", []):
                    memory = await self._store_insight(
                        thread_id=thread_id,
                        user_id=user_id,
                        app_name=app_name,
                        insight_data=insight_data,
                    )
                    insights_stored.append(
                        {
                            "memory_id": memory.id,
                            "importance": insight_data.get("importance", "medium"),
                        }
                    )

                result["facts"] = facts_stored
                result["insights"] = insights_stored

            # 任务完成
            job.result = result
            job.completed_at = datetime.now()
            job.status = JobStatus.COMPLETED
            await self._update_job_status(job.id, JobStatus.COMPLETED, result)

            return job

        except Exception as e:
            # 任务失败
            job.error = str(e)
            job.status = JobStatus.FAILED
            await self._update_job_status(job.id, JobStatus.FAILED, error=str(e))
            raise

    # ========================================
    # 阶段 1: Fast Replay (快回放)
    # ========================================

    async def _extract_recent_events(
        self,
        thread_id: str,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """提取最近的事件"""
        return await self.db.events.get_recent_events(uuid.UUID(thread_id), limit)

    def _format_conversation(self, events: list[dict[str, Any]]) -> str:
        """格式化对话历史"""
        lines = []
        for event in events:
            author = event["author"]
            content = event.get("content", {})

            # 提取消息文本
            if isinstance(content, dict):
                text = content.get("text", content.get("message", str(content)))
            else:
                text = str(content)

            role_label = {
                "user": "用户",
                "agent": "助手",
                "tool": "工具",
            }.get(author, author)

            lines.append(f"{role_label}: {text}")

        return "\n".join(lines)

    async def _generate_summary(self, conversation: str) -> str:
        """生成对话摘要 (Fast Replay)"""
        prompt = FAST_REPLAY_PROMPT.format(conversation=conversation)
        response = await asyncio.to_thread(self.model.generate_content, prompt)
        return response.text.strip()

    async def _store_summary(
        self,
        thread_id: str,
        user_id: str,
        app_name: str,
        content: str,
    ) -> Memory:
        """存储摘要作为记忆"""
        # 生成向量嵌入
        embedding = await self._generate_embedding(content)

        memory_id = str(uuid.uuid4())

        await self.db.memories.insert(
            thread_id=uuid.UUID(thread_id),
            user_id=user_id,
            app_name=app_name,
            memory_type="summary",
            content=content,
            embedding=embedding,
            metadata={"source": "fast_replay"},
        )

        return Memory(
            id=memory_id,
            thread_id=thread_id,
            user_id=user_id,
            app_name=app_name,
            memory_type="summary",
            content=content,
            embedding=embedding,
        )

    # ========================================
    # 阶段 2: Deep Reflection (深反思)
    # ========================================

    async def _extract_facts(self, conversation: str) -> dict[str, Any]:
        """从对话中提取 Facts 和 Insights"""
        prompt = DEEP_REFLECTION_PROMPT.format(conversation=conversation)
        response = await asyncio.to_thread(self.model.generate_content, prompt)

        # 解析 JSON 响应
        text = response.text.strip()
        # 移除 markdown 代码块标记
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        try:
            return json.loads(text.strip())
        except json.JSONDecodeError:
            return {"facts": [], "insights": []}

    async def _store_fact(
        self,
        thread_id: str,
        user_id: str,
        app_name: str,
        fact_data: dict[str, Any],
    ) -> Fact:
        """存储提取的事实 (Upsert 逻辑)"""
        fact_id = str(uuid.uuid4())
        fact_type = fact_data.get("type", "preference")
        key = fact_data.get("key", "unknown")
        value = fact_data.get("value", {})
        confidence = fact_data.get("confidence", 1.0)

        # 生成向量嵌入 (用于语义检索)
        content_for_embedding = f"{key}: {json.dumps(value)}"
        embedding = await self._generate_embedding(content_for_embedding)

        # Upsert: 如果已存在相同 key 则更新
        # Upsert: 如果已存在相同 key 则更新
        fact_db_id = await self.db.facts.upsert(
            user_id=user_id,
            app_name=app_name,
            fact_type=fact_type,
            key=key,
            value=value,
            embedding=embedding,
            confidence=confidence,
            thread_id=uuid.UUID(thread_id),
        )

        return Fact(
            id=str(fact_db_id),
            thread_id=thread_id,
            user_id=user_id,
            app_name=app_name,
            fact_type=fact_type,
            key=key,
            value=value,
            confidence=confidence,
        )

    async def _store_insight(
        self,
        thread_id: str,
        user_id: str,
        app_name: str,
        insight_data: dict[str, Any],
    ) -> Memory:
        """存储 Insight 作为语义记忆"""
        content = insight_data.get("content", "")
        importance = insight_data.get("importance", "medium")

        # 生成向量嵌入
        embedding = await self._generate_embedding(content)

        # 根据重要性设置初始保留分数
        retention_score = {
            "high": 1.0,
            "medium": 0.7,
            "low": 0.4,
        }.get(importance, 0.7)

        memory_id = str(uuid.uuid4())

        await self.db.memories.insert(
            thread_id=uuid.UUID(thread_id),
            user_id=user_id,
            app_name=app_name,
            memory_type="semantic",
            content=content,
            embedding=embedding,
            metadata={"source": "deep_reflection", "importance": importance},
            retention_score=retention_score,
        )

        return Memory(
            id=memory_id,
            thread_id=thread_id,
            user_id=user_id,
            app_name=app_name,
            memory_type="semantic",
            content=content,
            embedding=embedding,
            retention_score=retention_score,
        )

    # ========================================
    # 向量化
    # ========================================

    async def _generate_embedding(self, text: str) -> list[float]:
        """生成文本的向量嵌入"""
        result = await asyncio.to_thread(
            genai.embed_content,
            model=f"models/{self.embedding_model}",
            content=text,
            task_type="retrieval_document",
        )
        return result["embedding"]

    # ========================================
    # 任务管理
    # ========================================

    async def _create_job(self, thread_id: str, job_type: JobType) -> ConsolidationJob:
        """创建巩固任务"""
        job_id = str(uuid.uuid4())
        query = """
            INSERT INTO consolidation_jobs (id, thread_id, job_type, status, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING created_at
        """
        async with self.db.acquire() as conn:
            result = await conn.fetchrow(
                query,
                uuid.UUID(job_id),
                uuid.UUID(thread_id),
                job_type.value,
                JobStatus.PENDING.value,
            )

        return ConsolidationJob(
            id=job_id,
            thread_id=thread_id,
            job_type=job_type,
            status=JobStatus.PENDING,
            created_at=result["created_at"],
        )

    async def _update_job_status(
        self,
        job_id: str,
        status: JobStatus,
        result: dict | None = None,
        error: str | None = None,
    ) -> None:
        """更新任务状态"""
        query = """
            UPDATE consolidation_jobs
            SET status = $2::varchar,
                result = COALESCE($3::jsonb, result),
                error = COALESCE($4::text, error),
                started_at = CASE WHEN $2::varchar = 'running' THEN NOW() ELSE started_at END,
                completed_at = CASE WHEN $2::varchar IN ('completed', 'failed') THEN NOW() ELSE completed_at END
            WHERE id = $1::uuid
        """
        async with self.db.acquire() as conn:
            await conn.execute(
                query,
                uuid.UUID(job_id),
                status.value,
                json.dumps(result) if result else None,
                error,
            )

    async def _get_thread_info(self, thread_id: str) -> dict[str, Any] | None:
        """获取会话信息"""
        query = """
            SELECT id, user_id, app_name, state, version
            FROM threads
            WHERE id = $1
        """
        async with self.db.acquire() as conn:
            row = await conn.fetchrow(query, uuid.UUID(thread_id))
            return dict(row) if row else None


# ========================================
# 便捷函数
# ========================================


async def consolidate_thread(
    db: DatabaseManager,
    thread_id: str,
    job_type: JobType = JobType.FULL_CONSOLIDATION,
) -> ConsolidationJob:
    """便捷函数：巩固指定会话的记忆"""
    worker = MemoryConsolidationWorker(db)
    return await worker.consolidate(thread_id, job_type)
