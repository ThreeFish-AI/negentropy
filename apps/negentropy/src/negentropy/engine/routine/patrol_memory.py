"""PatrolMemoryStore — pdf-fidelity-patrol 巡检的跨轮记忆 SSOT。

集中维护巡检相关的**结构化、可确定性查询**的记忆约定，供 handler（选文档/沉淀）与
巡检会话（避让 unfixable 区域、复用 pattern、读取回归基线）共用。与通用
``IterationMemoryExtractor``（LLM 自由提炼）正交：本模块负责 doc_id 键定的确定性标记，
后者负责自然语言经验沉淀，两者互补。

记忆约定（均写入 ``memories`` 表，``metadata_->>'tag'`` 为判别键）：
- ``pdf-fidelity-status``  —— 文档级状态（done|unfixable），selector 据此跳过已完成/放弃文档。
- ``pdf-fidelity-unfixable`` —— 区域级不可修复标记（locator/attempts/reason），会话内避让。
- ``pdf-fidelity-pattern`` —— 有效修法（defect_type/fix_summary/module），向后传播。
- ``pdf-fidelity-baseline`` —— 回归基线集（sample doc_ids + baseline scores）。

写入走**同会话 raw SQL INSERT**（确定性标记按 ``metadata->>'tag'`` 查询，无需 embedding；
且与 DELETE 同事务，保证 upsert 原子化，规避跨会话半写）。``retention_score`` /
``importance_score`` / ``access_count`` 等沿用列 server default；``decay_override`` 写入
``metadata_`` 供 ``MemoryGovernanceService`` 计分时优先读取。

参考文献：
[1] AGENTS.md · 单一事实源（SSOT）：以轻量指针（tag/doc_id）而非数据副本维系状态。
[2] N. Shinn et al., "Reflexion," NeurIPS, 2023. arXiv:2303.11366.
"""

from __future__ import annotations

import re
from typing import Any

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from negentropy.config import settings
from negentropy.engine.utils.json_extract import loads_lenient
from negentropy.logging import get_logger

logger = get_logger("negentropy.engine.routine.patrol_memory")

# ---------------------------------------------------------------------------
# 约定常量
# ---------------------------------------------------------------------------

TAG_STATUS = "pdf-fidelity-status"
TAG_UNFIXABLE = "pdf-fidelity-unfixable"
TAG_PATTERN = "pdf-fidelity-pattern"
TAG_BASELINE = "pdf-fidelity-baseline"

# 长期保留的衰减率覆盖（写入 metadata_）。MemoryGovernanceService 计分时优先读取。
_DECAY_LONG = 0.003  # status / baseline（事实型，长期不变）
_DECAY_MID = 0.02  # pattern（方法型，中等保留）
_DECAY_UNFIXABLE = 0.003  # unfixable 区域（避险知识，长期保留）

# 巡检系统记忆的归属（不绑定具体用户线程，便于全局检索）。
_SYSTEM_USER = "system"

# 回归基线样本大小（分层覆盖：论文 / 表格密集 / 多栏 / 含公式 / 含代码 / 图文混排）。
DEFAULT_BASELINE_SAMPLE_SIZE = 6
# 非回归阈值（样本分数下降超过此值即判退化）。
DEFAULT_REGRESSION_DROP_THRESHOLD = 3

_CONTRACT_FENCE_RE = re.compile(r"```(?:json)?\s*pdf-fidelity-contract\s*\n(.*?)```", re.DOTALL | re.IGNORECASE)


# ---------------------------------------------------------------------------
# 契约解析（纯函数）
# ---------------------------------------------------------------------------


def parse_contract(summary: str | None) -> dict[str, Any] | None:
    """从迭代 summary 中提取 ``pdf-fidelity-contract`` JSON 契约。

    优先解析显式 ``pdf-fidelity-contract`` 代码块；兜底取末尾最后一个 JSON 对象。
    返回字典或 None（无法解析）。
    """
    if not summary:
        return None

    m = _CONTRACT_FENCE_RE.search(summary)
    candidates: list[str] = []
    if m:
        candidates.append(m.group(1))
    # 兜底：summary 末尾 4KB 内的所有 JSON 候选，取最后一个能解析为 dict 的。
    tail = summary[-4096:]
    for blk in re.findall(r"\{[\s\S]*\}", tail):
        candidates.append(blk)

    for raw in reversed(candidates):  # 末尾优先
        data = loads_lenient(raw.strip())
        if isinstance(data, dict):
            return data
    return None


def contract_score(contract: dict[str, Any] | None) -> int | None:
    """从契约提取 score（int），非法/缺失返回 None。"""
    if not contract:
        return None
    try:
        return int(contract.get("score"))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# PatrolMemoryStore
# ---------------------------------------------------------------------------


class PatrolMemoryStore:
    """巡检记忆读写器（每 tick 由 handler 构造一个实例）。

    Args:
        db: 异步会话（确定性查询 + 原子 upsert 均在此会话）
        app_name: 记忆归属 app（默认 settings.app_name）
    """

    def __init__(
        self,
        db: AsyncSession,
        *,
        app_name: str | None = None,
    ) -> None:
        self._db = db
        self._app = app_name or settings.app_name

    # ------------------------------------------------------------------
    # 写入（同会话 raw SQL，保证与 upsert DELETE 原子化）
    # ------------------------------------------------------------------

    async def _add(self, *, tag: str, content: str, memory_type: str, metadata: dict[str, Any]) -> None:
        meta = {"tag": tag, **metadata}
        await self._db.execute(
            sa.text(
                "INSERT INTO negentropy.memories "
                "(user_id, app_name, memory_type, content, metadata) "
                "VALUES (:u, :app, :mt, :c, :meta)"
            ).bindparams(
                sa.bindparam("u", value=_SYSTEM_USER),
                sa.bindparam("app", value=self._app),
                sa.bindparam("mt", value=memory_type),
                sa.bindparam("c", value=content),
                sa.bindparam("meta", value=meta, type_=sa.dialects.postgresql.JSONB),
            )
        )

    async def _upsert_status(self, *, doc_id: str, status: str, score: int | None, routine_id: str) -> None:
        """文档级状态 upsert：先删旧 status 记忆再写新（同事务，幂等）。"""
        await self._db.execute(
            sa.text(
                "DELETE FROM negentropy.memories "
                "WHERE app_name = :app AND user_id = :u "
                "AND metadata->>'tag' = :tag AND metadata->>'doc_id' = :doc"
            ).bindparams(app=self._app, u=_SYSTEM_USER, tag=TAG_STATUS, doc=doc_id)
        )
        score_str = "" if score is None else f"（评分 {score}）"
        await self._add(
            tag=TAG_STATUS,
            memory_type="semantic",
            content=f"PDF 高保真巡检：文档 {doc_id} 已达到 {status}{score_str}。",
            metadata={
                "doc_id": doc_id,
                "status": status,
                "score": score,
                "routine_id": routine_id,
                "decay_override": _DECAY_LONG,
            },
        )

    async def record_done(self, *, doc_id: str, score: int | None, routine_id: str) -> None:
        await self._upsert_status(doc_id=doc_id, status="done", score=score, routine_id=routine_id)

    async def record_doc_unfixable(self, *, doc_id: str, score: int | None, routine_id: str) -> None:
        await self._upsert_status(doc_id=doc_id, status="unfixable", score=score, routine_id=routine_id)

    async def record_unfixable_region(
        self,
        *,
        doc_id: str,
        locator: str,
        attempts: int,
        reason: str,
        suspected_module: str = "",
    ) -> None:
        await self._add(
            tag=TAG_UNFIXABLE,
            memory_type="procedural",
            content=(
                f"PDF 高保真巡检：文档 {doc_id} 的区域 {locator} 反复 {attempts} 次仍无法修复——"
                f"{reason}。后续巡检应跳过该区域。"
            ),
            metadata={
                "doc_id": doc_id,
                "locator": locator,
                "attempts": attempts,
                "reason": reason,
                "suspected_module": suspected_module,
                "decay_override": _DECAY_UNFIXABLE,
            },
        )

    async def record_pattern(self, *, doc_id: str, defect_type: str, fix_summary: str, module: str) -> None:
        if not fix_summary.strip():
            return
        await self._add(
            tag=TAG_PATTERN,
            memory_type="procedural",
            content=(f"PDF 高保真巡检有效修法（{defect_type}）：{fix_summary}。作用模块：{module or '未知'}。"),
            metadata={
                "doc_id": doc_id,
                "defect_type": defect_type,
                "fix_summary": fix_summary,
                "module": module,
                "decay_override": _DECAY_MID,
            },
        )

    # ------------------------------------------------------------------
    # 读取（selector 用）
    # ------------------------------------------------------------------

    async def get_skip_doc_ids(self) -> set[str]:
        """已 done / unfixable 的文档 id 集合（selector 跳过）。"""
        rows = await self._db.execute(
            sa.text(
                "SELECT DISTINCT metadata->>'doc_id' AS doc_id FROM negentropy.memories "
                "WHERE app_name = :app AND user_id = :u "
                "AND metadata->>'tag' = :tag AND metadata->>'doc_id' IS NOT NULL"
            ).bindparams(app=self._app, u=_SYSTEM_USER, tag=TAG_STATUS)
        )
        return {r[0] for r in rows.fetchall() if r[0]}

    async def get_unfixable_regions(self, doc_id: str) -> list[dict[str, Any]]:
        """某文档已标记 unfixable 的区域（注入巡检会话避让）。"""
        rows = await self._db.execute(
            sa.text(
                "SELECT metadata FROM negentropy.memories "
                "WHERE app_name = :app AND user_id = :u "
                "AND metadata->>'tag' = :tag AND metadata->>'doc_id' = :doc"
            ).bindparams(app=self._app, u=_SYSTEM_USER, tag=TAG_UNFIXABLE, doc=doc_id)
        )
        return [r[0] for r in rows.fetchall() if isinstance(r[0], dict)]

    # ------------------------------------------------------------------
    # 回归基线集
    # ------------------------------------------------------------------

    async def get_baseline(self) -> dict[str, Any] | None:
        """读取回归基线集（sample_doc_ids + baseline_scores）。"""
        row = await self._db.execute(
            sa.text(
                "SELECT metadata FROM negentropy.memories "
                "WHERE app_name = :app AND user_id = :u AND metadata->>'tag' = :tag LIMIT 1"
            ).bindparams(app=self._app, u=_SYSTEM_USER, tag=TAG_BASELINE)
        )
        r = row.fetchone()
        return r[0] if r and isinstance(r[0], dict) else None

    async def set_baseline(self, *, sample_doc_ids: list[str], scores: dict[str, int] | None) -> None:
        """upsert 回归基线集（先删后写）。"""
        await self._db.execute(
            sa.text(
                "DELETE FROM negentropy.memories WHERE app_name = :app AND user_id = :u AND metadata->>'tag' = :tag"
            ).bindparams(app=self._app, u=_SYSTEM_USER, tag=TAG_BASELINE)
        )
        await self._add(
            tag=TAG_BASELINE,
            memory_type="fact",
            content=("PDF 高保真巡检回归基线集：用于 FINALIZE 非回归门控的对照样本及其基线评分。"),
            metadata={
                "sample_doc_ids": sample_doc_ids,
                "baseline_scores": scores or {},
                "decay_override": _DECAY_LONG,
            },
        )

    # ------------------------------------------------------------------
    # 契约 → 记忆（巡检会话每轮产物落库）
    # ------------------------------------------------------------------

    async def persist_contract(self, *, contract: dict[str, Any], routine_id: str) -> None:
        """把一轮 ``pdf-fidelity-contract`` 解析为结构化记忆。

        - status==done → record_done；status==unfixable → record_doc_unfixable。
        - unfixable_regions → 逐条 record_unfixable_region（去重：同 locator 已存在则跳过）。
        - patterns → 逐条 record_pattern。
        """
        doc_id = str(contract.get("doc_id") or "").strip()
        if not doc_id:
            return
        score = contract_score(contract)
        status = str(contract.get("status") or "").strip().lower()

        if status == "done":
            await self.record_done(doc_id=doc_id, score=score, routine_id=routine_id)
        elif status == "unfixable":
            await self.record_doc_unfixable(doc_id=doc_id, score=score, routine_id=routine_id)

        existing = {r.get("locator") for r in await self.get_unfixable_regions(doc_id)}
        for region in contract.get("unfixable_regions") or []:
            if not isinstance(region, dict):
                continue
            locator = str(region.get("locator") or "").strip()
            if not locator or locator in existing:
                continue
            try:
                attempts = int(region.get("attempts") or 0)
            except (TypeError, ValueError):
                attempts = 0
            await self.record_unfixable_region(
                doc_id=doc_id,
                locator=locator,
                attempts=attempts,
                reason=str(region.get("reason") or ""),
                suspected_module=str(region.get("suspected_module") or ""),
            )
            existing.add(locator)

        for pat in contract.get("patterns") or []:
            if not isinstance(pat, dict):
                continue
            await self.record_pattern(
                doc_id=doc_id,
                defect_type=str(pat.get("defect_type") or ""),
                fix_summary=str(pat.get("fix_summary") or ""),
                module=str(pat.get("module") or ""),
            )


__all__ = [
    "DEFAULT_BASELINE_SAMPLE_SIZE",
    "DEFAULT_REGRESSION_DROP_THRESHOLD",
    "PatrolMemoryStore",
    "parse_contract",
    "contract_score",
    "TAG_STATUS",
    "TAG_UNFIXABLE",
    "TAG_PATTERN",
    "TAG_BASELINE",
]
