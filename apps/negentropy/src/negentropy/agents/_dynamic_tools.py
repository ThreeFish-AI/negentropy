"""
动态工具集 — 运行时按 ``agents.tools`` 解析六翼工具集（WS1 tools 单一事实源）。

与 ``_dynamic_instruction`` / ``_dynamic_model`` 同构（三者共用 ``subagent:<name>`` 60s TTL
缓存行，Agent PATCH 触发 ``invalidate_cache(prefix="subagent:")`` 一并失效）：

- ADK ``LlmAgent.tools`` 接受 ``BaseToolset``；``flows/llm_flows/base_llm_flow`` 每个
  invocation 用 ``ReadonlyContext`` 调 ``agent.canonical_tools`` → ``NegentropyToolset.get_tools``
  （``canonical_tools_cache`` 仅在单次 invocation 内缓存），故 UI 编辑 ``agents.tools`` 后经缓存
  失效、**下一轮请求即生效**，无需重建单例 faculty 实例。
- DB 不可达 / 未启用 / 为空 / 异常 → 回退构造期 ``default_names``（= 代码硬编码可摘工具集），
  保持「永不阻塞请求」语义（与 instruction fallback 同构）。
- ``allowed_names`` 白名单：仅该翼被许可的工具名可经 DB 挂载，越权 / 未知名丢弃 + warn，防止
  UI 把高危工具（如 ``invoke_claude_code``）跨翼挂到只读翼（慧眼）。ADK 层无翼隔离，此白名单
  是 WS1 的关键安全增量。
- ``mandatory_names``：恒常挂载工具（如 ``log_activity`` / ``load_memory``）已在工厂 ``tools=[]``
  常量位以裸 callable 挂载，本 toolset 从产出中剔除，避免重复声明（即便 DB 误列亦然）。
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from google.adk.tools import FunctionTool
from google.adk.tools.base_tool import BaseTool
from google.adk.tools.base_toolset import BaseToolset

from negentropy.logging import get_logger

from .tools.registry import canonicalize_tool_name, resolve_tool_names

if TYPE_CHECKING:
    from google.adk.agents.readonly_context import ReadonlyContext

_logger = get_logger("negentropy.agents.dynamic_tools")


class NegentropyToolset(BaseToolset):
    """按 ``agents.tools`` 运行时解析某个 faculty 的「可摘」工具集。

    Args:
        agent_name: ``agents.name``，用于 DB 查询；与 ADK ``Agent.name`` 一致。
        default_names: DB 未命中 / 为空 / 异常时回退的可摘工具名列表（= 代码硬编码集）。
        mandatory_names: 恒常挂载工具名（已在工厂常量位挂载）；本 toolset 从产出中剔除。
        allowed_names: 该翼被许可经 DB 挂载的工具名上界；越界名丢弃 + warn。
            ``None``（默认）→ 取 ``mandatory + default``（= 当前硬编码集）：UI 只能「摘除」
            既有工具、不能跨翼新增高危工具（保守安全默认）。未来若要放开某翼可挂的工具面，
            显式传入更宽的 ``allowed_names`` 即可。
    """

    def __init__(
        self,
        *,
        agent_name: str,
        default_names: list[str],
        mandatory_names: list[str],
        allowed_names: list[str] | None = None,
    ) -> None:
        super().__init__()
        self._agent_name = agent_name
        self._default_names = list(default_names)
        self._mandatory_names = list(mandatory_names)
        self._mandatory_set = set(mandatory_names)
        self._allowed_set = set(allowed_names) if allowed_names is not None else {*mandatory_names, *default_names}

    def configured_tool_names(self) -> list[str]:
        """序列化用：该翼「恒常 + 默认可摘」工具名（保序去重）。

        供 ``interface/agent_presets.serialize_adk_config`` 把 toolset 展开为稳定的工具名数组，
        作为 sync 落库 ``agents.tools`` 的初值，避免 ``NegentropyToolset`` 类名污染。
        """
        seen: set[str] = set()
        ordered: list[str] = []
        for name in [*self._mandatory_names, *self._default_names]:
            if name not in seen:
                seen.add(name)
                ordered.append(name)
        return ordered

    async def _resolve_names(self) -> list[str]:
        """解析工具名列表。

        总开关 ``settings.agents.tools_from_db_enabled`` 关（默认）→ 恒用 ``default_names``
        （与改造前硬编码逐字节等价，零回归）；开 → 读 DB ``agents.tools``（60s TTL 缓存），
        None / 空 → 回退 ``default_names``（与 instruction / model fallback 同构）。
        """
        from negentropy.config import settings

        if not settings.agents.tools_from_db_enabled:
            return self._default_names

        from negentropy.config.model_resolver import resolve_subagent_tool_names

        names = await resolve_subagent_tool_names(self._agent_name)
        if not names:
            return self._default_names
        return names

    async def get_tools(
        self,
        readonly_context: ReadonlyContext | None = None,
    ) -> list[BaseTool]:
        try:
            names = await self._resolve_names()
        except Exception:
            _logger.warning(
                "dynamic_tools_resolve_failed",
                agent_name=self._agent_name,
                exc_info=True,
            )
            names = self._default_names

        # 过滤：先归一别名（claude_code → invoke_claude_code）再比对，避免误删已许可工具；
        # 剔除 mandatory（已在常量位）、剔除白名单外（越权防御）、去重保序。
        effective: list[str] = []
        seen: set[str] = set()
        for raw in names:
            name = canonicalize_tool_name(raw)
            if name in self._mandatory_set:
                continue
            if name not in self._allowed_set:
                _logger.warning(
                    "dynamic_tools_disallowed",
                    agent_name=self._agent_name,
                    name=raw,
                )
                continue
            if name in seen:
                continue
            seen.add(name)
            effective.append(name)

        tools: list[BaseTool] = []
        for union in resolve_tool_names(effective):
            if isinstance(union, BaseTool):
                tools.append(union)
            elif callable(union):
                # 与 ADK ``_convert_tool_union_to_tools`` 一致：裸 callable → FunctionTool。
                tools.append(FunctionTool(func=union))
            # 其它类型（不应发生）静默跳过，绝不抛。
        return tools
