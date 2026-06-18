"""记忆检索工具 — Preload 自动注入（交互式对话主链路接入点）。

修复「记忆检索断链」的核心组件：root Agent 此前没有任何记忆检索入口，
长期记忆只写不读。本模块提供 :class:`NegentropyPreloadMemoryTool`，
在每轮对话的 LLM 请求前自动以用户消息为 query 检索长期记忆，并把命中
内容以 ``<RELEVANT_MEMORIES>`` 块注入 system instruction。

与 ADK 原生 ``PreloadMemoryTool`` 的差异：

1. **settings 门控**：运行时每请求读取 ``settings.memory.retrieval.preload_enabled``
   （fail-soft，配置不可用时按默认启用），支持环境变量一键回退
   ``NE_MEMORY_RETRIEVAL__PRELOAD_ENABLED=false``。
2. **同 invocation 去重**：ADK 同一 invocation 的每个 LLM step 都会重跑
   ``process_llm_request`` 且 query 不变；原生实现会重复检索，导致
   ``access_count`` / ``importance_score`` 被重复累加、``memory_retrieval_logs``
   重复落行，污染艾宾浩斯遗忘曲线与 Insights 指标。本实现用 ``temp:`` 前缀
   state 缓存（invocation 级生命周期、不持久化）保证每 invocation 每 query
   至多检索一次。
3. **top_k / max_chars 截断**：``tool_context.search_memory`` 无 limit 参数
   （服务端默认返回 10 条全文），注入块按配置截断，封顶 token 预算。
4. **引用锚点**：每条记忆渲染为 ``[Memory <id8>, <memory_type>, <YYYY-MM-DD>]``
   行，供 CITATION_PROTOCOL 第 3 条（Memory 引用格式）直接引用。

成本提示：当 ``PostgresMemoryService`` 接线 embedding_fn 后，每轮 preload
检索为一次 embedding 调用 + hybrid SQL；未接线时退化为 BM25/ilike 纯 SQL。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, override

from google.adk.tools.preload_memory_tool import PreloadMemoryTool

from negentropy.logging import get_logger

if TYPE_CHECKING:
    from google.adk.memory.memory_entry import MemoryEntry
    from google.adk.models import LlmRequest
    from google.adk.tools.tool_context import ToolContext

logger = get_logger("negentropy.agents.tools.memory")

# temp: 前缀 → invocation 级生命周期、session service 持久化时剥离；
# 含 ":" 的键同时绕过 ADK state_schema 校验（State.__setitem__ 的约定）。
_STATE_CACHE_KEY = "temp:negentropy:preload_memory"

_DEFAULT_PRELOAD_ENABLED = True
_DEFAULT_PRELOAD_TOP_K = 5
_DEFAULT_PRELOAD_MAX_CHARS = 4000

_BLOCK_HEADER = (
    "以下为系统从长期记忆检索到的相关内容（按相关性排序）。"
    "与当前问题相关时方可使用，并按「知识与记忆引用规范」第 3 条标注 Memory 引用；"
    "无关时直接忽略，不要复述。"
)


@dataclass(frozen=True)
class _RetrievalConfig:
    preload_enabled: bool = _DEFAULT_PRELOAD_ENABLED
    preload_top_k: int = _DEFAULT_PRELOAD_TOP_K
    preload_max_chars: int = _DEFAULT_PRELOAD_MAX_CHARS


def _resolve_retrieval_settings() -> _RetrievalConfig:
    """读取 memory.retrieval 配置；settings 不可用时回退到内置默认（启用）。

    模式对齐 ``retrieval_tracker._resolve_max_inflight``：配置层异常绝不
    阻断主链路，preload 行为退化为默认参数而非抛错。
    """
    try:
        from negentropy.config import settings as global_settings

        retrieval = global_settings.memory.retrieval
        return _RetrievalConfig(
            preload_enabled=bool(retrieval.preload_enabled),
            preload_top_k=int(retrieval.preload_top_k),
            preload_max_chars=int(retrieval.preload_max_chars),
        )
    except Exception:
        return _RetrievalConfig()


def _render_memory_line(entry: MemoryEntry) -> str | None:
    """单条记忆 → ``- [Memory <id8>, <memory_type>, <YYYY-MM-DD>] <text>``。

    全字段 best-effort：缺失字段降级为占位，渲染失败返回 None 跳过该条。
    """
    try:
        parts = getattr(getattr(entry, "content", None), "parts", None) or []
        text = " ".join(p.text for p in parts if getattr(p, "text", None)).strip()
        if not text:
            return None
        id8 = str(getattr(entry, "id", "") or "")[:8] or "unknown"
        meta = getattr(entry, "custom_metadata", None) or {}
        mtype = meta.get("memory_type", "episodic") if isinstance(meta, dict) else "episodic"
        date = str(getattr(entry, "timestamp", "") or "")[:10]
        anchor = f"[Memory {id8}, {mtype}" + (f", {date}]" if date else "]")
        return f"- {anchor} {text}"
    except Exception:  # noqa: BLE001 — 单条渲染失败不阻断整块注入
        return None


def _render_block(memories: list[MemoryEntry], *, top_k: int, max_chars: int) -> str | None:
    """渲染注入块；无可用内容时返回 None。"""
    lines: list[str] = []
    used = 0
    for entry in memories[:top_k]:
        line = _render_memory_line(entry)
        if not line:
            continue
        # 字符预算：超限截断当前行并停止追加
        remaining = max_chars - used
        if remaining <= 0:
            break
        if len(line) > remaining:
            line = line[:remaining]
        lines.append(line)
        used += len(line)
    if not lines:
        return None
    body = "\n".join(lines)
    return f"<RELEVANT_MEMORIES>\n{_BLOCK_HEADER}\n{body}\n</RELEVANT_MEMORIES>"


class NegentropyPreloadMemoryTool(PreloadMemoryTool):
    """每次 llm_request 自动检索长期记忆并注入；同 invocation 去重。

    不注册 FunctionDeclaration（LLM 不可见、不可调用），仅改写 llm_request，
    与 root agent 的 ``before_model_callback`` 职责正交。
    """

    @override
    async def process_llm_request(
        self,
        *,
        tool_context: ToolContext,
        llm_request: LlmRequest,
    ) -> None:
        cfg = _resolve_retrieval_settings()
        if not cfg.preload_enabled:
            return

        user_content = tool_context.user_content
        if not user_content or not user_content.parts or not user_content.parts[0].text:
            return
        query: str = user_content.parts[0].text

        # 同 invocation 去重：cache key 拼 invocation_id，防御 session 对象
        # 跨 invocation 复用导致的 temp 残留（新 invocation_id 强制重新检索）。
        invocation_id = getattr(tool_context, "invocation_id", "") or ""
        cache_key = f"{invocation_id}:{hash(query)}"
        try:
            cached = tool_context.state.get(_STATE_CACHE_KEY)
        except Exception:  # noqa: BLE001 — state 不可用时退化为无缓存
            cached = None
        if isinstance(cached, dict) and cached.get("key") == cache_key:
            block = cached.get("block")
            if block:
                llm_request.append_instructions([block])
            return

        try:
            response = await tool_context.search_memory(query)
        except Exception as exc:  # noqa: BLE001 — 检索失败不阻断对话；不缓存，下一 step 可重试
            logger.warning("preload_memory_search_failed", error=str(exc), query_length=len(query))
            return

        memories = getattr(response, "memories", None) or []
        block = _render_block(memories, top_k=cfg.preload_top_k, max_chars=cfg.preload_max_chars)

        # 空结果也缓存：同 invocation 后续 step 不再重复检索
        try:
            tool_context.state[_STATE_CACHE_KEY] = {"key": cache_key, "block": block}
        except Exception as exc:  # noqa: BLE001 — 缓存写入失败仅损失去重，不影响注入
            logger.debug("preload_memory_cache_write_failed", error=str(exc))

        if block:
            llm_request.append_instructions([block])
            logger.debug(
                "preload_memory_injected",
                memory_count=len(memories),
                block_chars=len(block),
            )


preload_memory_tool = NegentropyPreloadMemoryTool()

__all__ = [
    "NegentropyPreloadMemoryTool",
    "preload_memory_tool",
]
