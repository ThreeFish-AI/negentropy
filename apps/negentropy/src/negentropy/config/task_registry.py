"""Task Registry — 后台 LLM/Embedding 任务的单一事实源。

每个 ``TaskSlot`` 表示一处后台模型调用点的"槽位"，可在 UI 上绑定到 ``model_configs``
表中的具体模型；未绑定时由 ``model_resolver.resolve_*_for_task`` 自动回退到默认。

新增任务槽位的步骤:
    1. 在 ``ALL_TASKS`` 中追加一行
    2. 在对应业务模块（如 ``engine/consolidation/llm_fact_extractor.py``）的调用点
       注入对应的 ``task_key``
    3. 单测覆盖新槽位的解析链

设计原则:
    - **单一事实源**：所有合法 task_key 集中在本文件，API/前端通过 ``/interface/task-models/registry``
      端点读取，前后端零硬编码。
    - **作用域 (scope)**:
        - ``"global"``：与 Corpus 无关，全局唯一映射（如 Memory Consolidation、Session 标题）。
        - ``"corpus"``：可被特定 Corpus 重写（如 KG 实体抽取按 Corpus 单独绑定模型）。
    - **类型 (model_type)**：``"llm"`` / ``"embedding"``。本期仅含 LLM；Embedding 当前由
      ``corpus.config.models.embedding_config_id`` 覆盖，未拆细粒度任务槽。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

TaskScope = Literal["global", "corpus"]
TaskModelType = Literal["llm", "embedding"]


@dataclass(frozen=True, slots=True)
class TaskSlot:
    """单个任务槽位定义。

    Attributes:
        task_key: 唯一标识符（点分命名空间），如 ``consolidation.fact_extract``。
        model_type: 该任务期望的模型类型。
        scope: 作用域 — ``"global"`` 仅允许全局映射；``"corpus"`` 同时支持全局 + Corpus 级映射。
        label: UI 展示的人类可读名称（中文）。
        category: UI 分组（中文），便于按业务领域分块呈现。
        description: 一句话补充说明，鼠标悬浮或副标题展示。
    """

    task_key: str
    model_type: TaskModelType
    scope: TaskScope
    label: str
    category: str
    description: str = ""


# ============================================================================
# 任务槽位清单（单一事实源）
# ============================================================================
# 命名约定：<业务域>.<子模块>.<动作>，全部小写、用 "." 分隔。
# 顺序：先 global（Memory + Session），再 corpus（Knowledge Graph + Ingestion）。

ALL_TASKS: tuple[TaskSlot, ...] = (
    # --- Memory Consolidation (global) ---
    TaskSlot(
        task_key="consolidation.fact_extract",
        model_type="llm",
        scope="global",
        label="事实提取",
        category="Memory Consolidation",
        description="从对话中提取用户偏好 / 资料 / 规则等结构化事实。",
    ),
    TaskSlot(
        task_key="consolidation.summarize",
        model_type="llm",
        scope="global",
        label="用户画像摘要",
        category="Memory Consolidation",
        description="基于事实生成用户画像摘要文本。",
    ),
    TaskSlot(
        task_key="consolidation.reflection",
        model_type="llm",
        scope="global",
        label="记忆反思",
        category="Memory Consolidation",
        description="从历史记忆生成更高阶的反思与归纳。",
    ),
    TaskSlot(
        task_key="consolidation.entity_normalization",
        model_type="llm",
        scope="global",
        label="实体规范化",
        category="Memory Consolidation",
        description="将实体的别名、缩写等归一到统一表达。",
    ),
    # 注：dedup_merge / auto_link / topic_cluster 三个 step 目前为规则/嵌入驱动，
    # 不调用 LLM。未来若引入 LLM 评判，再在此处补充对应 task_key 并接入调用点。
    # --- Session (global) ---
    TaskSlot(
        task_key="session.title",
        model_type="llm",
        scope="global",
        label="会话标题生成",
        category="Session",
        description="为新会话生成简短的标题。",
    ),
    # --- Routine (global) ---
    TaskSlot(
        task_key="routine.evaluate",
        model_type="llm",
        scope="global",
        label="Routine 结果评估",
        category="Routine",
        description="LLM-as-Judge 按验收标准为 Routine 迭代结果评分并生成反思反馈。",
    ),
    # --- Knowledge Graph (corpus) ---
    TaskSlot(
        task_key="knowledge.kg.extraction.entity",
        model_type="llm",
        scope="corpus",
        label="KG 实体抽取",
        category="Knowledge Graph",
        description="从文档中抽取实体节点。",
    ),
    TaskSlot(
        task_key="knowledge.kg.extraction.relation",
        model_type="llm",
        scope="corpus",
        label="KG 关系抽取",
        category="Knowledge Graph",
        description="从文档中抽取实体间关系边。",
    ),
    TaskSlot(
        task_key="knowledge.ingestion.extract",
        model_type="llm",
        scope="corpus",
        label="文档内容抽取",
        category="Knowledge Graph",
        description="文档入库前的结构化抽取（标题、章节、要点）。",
    ),
    TaskSlot(
        task_key="knowledge.kg.global_search",
        model_type="llm",
        scope="corpus",
        label="KG 全局问答",
        category="Knowledge Graph",
        description="基于社区摘要的 Map-Reduce 全局检索问答。",
    ),
)

# 索引：避免每次线性扫描
_TASK_INDEX: dict[str, TaskSlot] = {slot.task_key: slot for slot in ALL_TASKS}


def get_task(task_key: str) -> TaskSlot | None:
    """按 task_key 查找槽位；未注册返回 None。"""
    return _TASK_INDEX.get(task_key)


def list_all_tasks() -> tuple[TaskSlot, ...]:
    """列出所有任务槽位（保持声明顺序）。"""
    return ALL_TASKS


def list_global_tasks() -> tuple[TaskSlot, ...]:
    """列出全局作用域任务槽位。"""
    return tuple(slot for slot in ALL_TASKS if slot.scope == "global")


def list_corpus_tasks() -> tuple[TaskSlot, ...]:
    """列出 Corpus 作用域任务槽位。"""
    return tuple(slot for slot in ALL_TASKS if slot.scope == "corpus")


def is_valid_task_key(task_key: str) -> bool:
    """判定 task_key 是否在注册表内（API 层入参校验用）。"""
    return task_key in _TASK_INDEX


def to_dict(slot: TaskSlot) -> dict[str, str]:
    """序列化为前端友好的 dict（用于 /registry 端点）。"""
    return {
        "task_key": slot.task_key,
        "model_type": slot.model_type,
        "scope": slot.scope,
        "label": slot.label,
        "category": slot.category,
        "description": slot.description,
    }
