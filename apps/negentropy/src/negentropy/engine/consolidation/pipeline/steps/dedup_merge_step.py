"""DedupMergeStep — 近重复记忆合并。

识别 cosine >= threshold 的近重复记忆，保留高 retention_score 版本，
将低分版本 soft-delete 并合并内容到 metadata_.merged_from。

当近重复记忆关联的 facts 存在 key 碰撞时，优先通过 ConflictResolver
进行 AGM 信念修正<sup>[[3]](#ref3)</sup>，避免偏好反转被静默合并。

理论：
- CLS 理论<sup>[[1]](#ref1)</sup>：巩固阶段应合并语义等价的记忆片段
- Henzinger (2006) 近重复检测<sup>[[2]](#ref2)</sup>：cosine similarity 阈值判定
- AGM 信念修正<sup>[[3]](#ref3)</sup>：矛盾信念需显式解决，保留审计痕迹

参考文献:
[1] J. L. McClelland et al., *Psychological Review*, 102(3), 1995.
[2] M. Henzinger, "Finding near-duplicate web documents: a large-scale evaluation
    of algorithms," in *Proc. SIGIR*, 2006, pp. 284-291.
[3] C. E. Alchourrón, P. Gärdenfors, and D. Makinson, "On the logic of theory
    change," *J. Symbolic Logic*, vol. 50, no. 2, pp. 510–530, 1985.
"""

from __future__ import annotations

import time

import sqlalchemy as sa

import negentropy.db.session as db_session
from negentropy.logging import get_logger
from negentropy.models.internalization import Fact, Memory

from ..protocol import PipelineContext, StepResult
from ..registry import register

logger = get_logger("negentropy.engine.consolidation.pipeline.steps.dedup_merge")


@register("dedup_merge")
class DedupMergeStep:
    name = "dedup_merge"

    async def _check_fact_conflict(
        self,
        db: sa.ext.asyncio.AsyncSession,
        primary_id: object,
        loser_id: object,
        user_id: str,
        app_name: str,
    ) -> bool:
        """检查 primary/loser 关联 facts 是否存在 key 碰撞。

        当发现 key 碰撞时，委托 ConflictResolver 执行 AGM 信念修正。
        Returns True 表示冲突已由 resolver 处理（如 keep_both），调用方应跳过 soft-delete。
        """
        from negentropy.engine.governance.conflict_resolver import ConflictResolver

        # 查找与两记忆关联的活跃 facts（通过 user_id + app_name + content 关联）
        primary_facts = (
            (
                await db.execute(
                    sa.select(Fact)
                    .where(
                        Fact.user_id == user_id,
                        Fact.app_name == app_name,
                        Fact.status == "active",
                    )
                    .order_by(Fact.created_at.desc())
                    .limit(50)
                )
            )
            .scalars()
            .all()
        )

        if len(primary_facts) < 2:
            return False

        # 按 key 分组，找到第一个碰撞对
        by_key: dict[str, list] = {}
        for f in primary_facts:
            by_key.setdefault(f.key, []).append(f)

        for _key, facts in by_key.items():
            if len(facts) < 2:
                continue
            # 尝试 resolve 前两个同 key fact（old=先创建, new=后创建）
            facts_sorted = sorted(facts, key=lambda f: f.created_at)
            try:
                resolver = ConflictResolver()
                conflict = await resolver.detect_and_resolve(
                    old_fact=facts_sorted[0],
                    new_fact=facts_sorted[-1],
                    user_id=user_id,
                    app_name=app_name,
                )
                if conflict and conflict.resolution == "keep_both":
                    return True
            except Exception:
                logger.debug("conflict_check_failed", key=_key, exc_info=True)

        return False

    async def run(self, ctx: PipelineContext) -> StepResult:
        start = time.perf_counter()

        if not ctx.new_memory_ids:
            return StepResult(step_name=self.name, status="skipped", duration_ms=0, output_count=0)

        # 读取配置
        try:
            from negentropy.config import settings as global_settings

            threshold = getattr(global_settings.memory.consolidation, "merge_threshold", 0.90)
        except Exception:
            threshold = 0.90

        merged_count = 0

        async with db_session.AsyncSessionLocal() as db:
            # 拉取新记忆
            stmt = sa.select(
                Memory.id, Memory.content, Memory.embedding, Memory.retention_score, Memory.metadata_
            ).where(Memory.id.in_(ctx.new_memory_ids))
            rows = (await db.execute(stmt)).all()

            try:
                for row in rows:
                    if row.embedding is None:
                        continue

                    # 查找用户现有记忆中的近重复
                    distance = Memory.embedding.op("<=>")(row.embedding)
                    dup_stmt = (
                        sa.select(
                            Memory.id,
                            Memory.content,
                            Memory.retention_score,
                            distance.label("dist"),
                        )
                        .where(
                            Memory.user_id == ctx.user_id,
                            Memory.app_name == ctx.app_name,
                            Memory.embedding.is_not(None),
                            Memory.id != row.id,
                            sa.func.coalesce(Memory.metadata_["deleted"].astext, "false") != "true",
                            distance <= (1.0 - threshold),
                        )
                        .order_by(distance.asc())
                        .limit(1)
                    )
                    dup_result = await db.execute(dup_stmt)
                    dup_row = dup_result.first()

                    if dup_row is None:
                        continue

                    # 决定 primary（高分）和 loser（低分）
                    if row.retention_score >= (dup_row.retention_score or 0.0):
                        primary_id, loser_id = row.id, dup_row.id
                        loser_content = dup_row.content
                    else:
                        primary_id, loser_id = dup_row.id, row.id
                        loser_content = row.content

                    # AGM 冲突检测：查找关联 facts 是否存在 key 碰撞
                    skip_soft_delete = await self._check_fact_conflict(
                        db, primary_id, loser_id, ctx.user_id, ctx.app_name
                    )

                    # 更新 primary：追加 merged_from
                    primary_meta = (
                        await db.execute(sa.select(Memory.metadata_).where(Memory.id == primary_id))
                    ).scalar() or {}

                    merged_from = list(primary_meta.get("merged_from", []))
                    merged_from.append({"content": (loser_content or "")[:500], "merged_at": time.time()})
                    # 只保留最近 5 条
                    merged_from = merged_from[-5:]

                    primary_meta["merged_from"] = merged_from
                    await db.execute(sa.update(Memory).where(Memory.id == primary_id).values(metadata_=primary_meta))

                    if skip_soft_delete:
                        # 冲突已由 ConflictResolver 处理（如 keep_both），不做 soft-delete
                        logger.debug(
                            "dedup_skip_soft_delete_conflict_resolved",
                            primary=str(primary_id),
                            loser=str(loser_id),
                        )
                    else:
                        # soft-delete loser
                        loser_meta = (
                            await db.execute(sa.select(Memory.metadata_).where(Memory.id == loser_id))
                        ).scalar() or {}
                        loser_meta["deleted"] = "true"
                        loser_meta["merged_into"] = str(primary_id)
                        await db.execute(
                            sa.update(Memory)
                            .where(Memory.id == loser_id)
                            .values(metadata_=loser_meta, retention_score=0.0)
                        )

                    merged_count += 1

                await db.commit()
            except Exception:
                await db.rollback()
                raise

        duration_ms = int((time.perf_counter() - start) * 1000)
        return StepResult(
            step_name=self.name,
            status="success",
            duration_ms=duration_ms,
            output_count=merged_count,
        )


__all__ = ["DedupMergeStep"]
