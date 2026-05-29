"""
Model Resolver — 默认模型 + vendor_configs 凭证的模型配置解析器。

遵循 Single Source of Truth 原则：
1. 默认模型名由环境变量或硬编码 fallback 决定
2. 从模型名解析 vendor，再从 vendor_configs 表读取 api_key/api_base
3. 内存缓存 + TTL 避免每次请求查 DB

公开接口:
- resolve_llm_config()                  — 异步解析默认 LLM
- resolve_embedding_config()            — 异步解析默认 Embedding
- resolve_llm_config_by_model_name()    — 按 vendor/model_name 字符串解析 LLM
- resolve_llm_config_for_task()         — 按 task_key (+ 可选 corpus_id) 解析 LLM
- resolve_embedding_config_for_task()   — 按 task_key (+ 可选 corpus_id) 解析 Embedding
- resolve_subagent_model_name()         — 按 agent_name 读取 agents.model
- resolve_subagent_instruction()        — 按 agent_name 读取 agents.system_prompt
- get_cached_llm_config()               — 同步缓存读取 (无法 await 的上下文)
- get_cached_llm_config_for_task()      — 同步缓存读取 task 槽位 (无法 await 的上下文)
- get_fallback_llm_config()             — 同步获取硬编码 LLM 默认值
- get_fallback_embedding_config()       — 同步获取硬编码 Embedding 默认值
- invalidate_cache()                    — 缓存失效 (Admin 写操作后调用)
"""

from __future__ import annotations

import os
import time
from typing import Any
from uuid import UUID

# Cache TTL in seconds
_CACHE_TTL = 60.0

# 硬编码默认值 — DB 不可达时的回退配置
_DEFAULT_LLM_MODEL = "openai/gpt-5-mini"
_DEFAULT_LLM_KWARGS: dict[str, Any] = {
    "temperature": 0.7,
    "drop_params": True,
}
# gemini/text-embedding-004 与 vertex_ai/text-embedding-005 同为 768 维，
# 切换不破坏既有 HNSW 向量索引；如需恢复 vertex 模型可通过环境变量覆盖。
_DEFAULT_EMBEDDING_MODEL = os.getenv("NEGENTROPY_DEFAULT_EMBEDDING_MODEL", "gemini/text-embedding-004")
_DEFAULT_EMBEDDING_KWARGS: dict[str, Any] = {}

# In-memory cache: { model_type: (full_model_name, kwargs, timestamp) }
_cache: dict[str, tuple[str, dict[str, Any], float]] = {}


def invalidate_cache(model_type: str | None = None, *, prefix: str | None = None) -> None:
    """使缓存失效。Admin 写操作后调用。

    Args:
        model_type: 指定键精确失效; None 表示全部失效 (除非提供 prefix)。
        prefix: 按前缀批量失效 (如 "subagent:" 清所有 Agent 缓存)。

    说明：``model_type`` 与 ``prefix`` 可组合使用；若仅提供 ``prefix`` 则按前缀清，
    不影响其它键；两者均为 None 时清空全部缓存。
    """
    if prefix:
        for key in [k for k in _cache if k.startswith(prefix)]:
            _cache.pop(key, None)
        if model_type:
            _cache.pop(model_type, None)
        return
    if model_type:
        _cache.pop(model_type, None)
    else:
        _cache.clear()


def get_cached_llm_config() -> tuple[str, dict[str, Any]] | None:
    """同步缓存读取 — 用于 create_model() 等无法 await 的上下文。

    返回 kwargs 的浅拷贝，防止调用方原地修改污染缓存。

    Returns:
        (full_model_name, litellm_kwargs) 或 None (缓存未命中/过期)。
    """
    entry = _cache.get("llm")
    if entry is not None:
        name, kwargs, ts = entry
        if time.monotonic() - ts < _CACHE_TTL:
            return name, kwargs.copy()
    return None


def get_cached_embedding_config() -> tuple[str, dict[str, Any]] | None:
    """同步缓存读取 — Embedding 模型。返回 kwargs 浅拷贝。"""
    entry = _cache.get("embedding")
    if entry is not None:
        name, kwargs, ts = entry
        if time.monotonic() - ts < _CACHE_TTL:
            return name, kwargs.copy()
    return None


def get_fallback_llm_config() -> tuple[str, dict[str, Any]]:
    """同步获取硬编码 LLM 默认值 — 供消费者在无法 await 的上下文中使用。"""
    return _DEFAULT_LLM_MODEL, _DEFAULT_LLM_KWARGS.copy()


def get_fallback_embedding_config() -> tuple[str, dict[str, Any]]:
    """同步获取硬编码 Embedding 默认值。"""
    return _DEFAULT_EMBEDDING_MODEL, _DEFAULT_EMBEDDING_KWARGS.copy()


async def resolve_llm_config() -> tuple[str, dict[str, Any]]:
    """异步解析默认 LLM 模型配置。

    Returns:
        (full_model_name, litellm_kwargs)
    """
    return await _resolve("llm")


async def resolve_embedding_config() -> tuple[str, dict[str, Any]]:
    """异步解析默认 Embedding 模型配置。

    Returns:
        (full_model_name, embedding_kwargs)
    """
    return await _resolve("embedding")


async def resolve_llm_config_by_id(config_id: UUID | str | None) -> tuple[str, dict[str, Any]]:
    """根据 model_configs.id 解析 LLM 配置；None / 查询失败回退默认。"""
    if config_id is None:
        return await resolve_llm_config()
    return await _resolve_by_id("llm", config_id)


async def resolve_llm_config_by_model_name(full_name: str | None) -> tuple[str, dict[str, Any]] | None:
    """根据 ``vendor/model_name`` 字符串解析 LLM 配置。

    解析链（Single Source of Truth）：
    1. 拆分 ``full_name`` 为 ``(vendor, model_name)``；
    2. 查 ``model_configs``：匹配 ``model_type=llm``、``enabled=true``、``vendor``、``model_name``；
       若多行，优先 ``is_default=true``，再按 ``created_at`` 升序；命中则叠加其 ``config`` JSONB；
    3. 查 ``vendor_configs`` 拼接 ``api_key`` / ``api_base``；
    4. 60s TTL 缓存，键为 ``llm_name:<vendor/model_name>``。

    返回值：
    - ``(full_model_name, litellm_kwargs)`` — 命中任意一侧（model_configs 行或 vendor_configs 凭证）；
    - ``None`` — ``full_name`` 为空，或 vendor/model 两侧均无配置（避免阻塞调用方，交由调用方降级到默认）。
    """
    if not full_name:
        return None

    cache_key = f"llm_name:{full_name}"
    now = time.monotonic()
    entry = _cache.get(cache_key)
    if entry is not None:
        name, kwargs, ts = entry
        if now - ts < _CACHE_TTL:
            return name, kwargs.copy()

    vendor, model_name = _split_vendor_and_model(full_name)
    if vendor is None or not model_name:
        return None

    try:
        row = await _load_model_config_row_by_name("llm", vendor, model_name)
    except Exception:
        from negentropy.logging import get_logger

        get_logger("negentropy.config.model_resolver").warning(
            "model_resolver_by_name_row_failed",
            full_name=full_name,
            exc_info=True,
        )
        row = None

    vendor_config = None
    try:
        vendor_config = await _get_vendor_config(vendor)
    except Exception:
        from negentropy.logging import get_logger

        get_logger("negentropy.config.model_resolver").warning(
            "model_resolver_by_name_vendor_failed",
            full_name=full_name,
            vendor=vendor,
            exc_info=True,
        )

    if row is None and vendor_config is None:
        from negentropy.logging import get_logger

        get_logger("negentropy.config.model_resolver").warning(
            "model_resolver_by_name_miss",
            full_name=full_name,
            vendor=vendor,
        )
        return None

    config_jsonb: dict[str, Any] = dict(row.config or {}) if row is not None else {}
    normalized_full = build_full_model_name(vendor, model_name)
    kwargs = _build_llm_kwargs(vendor, model_name, config_jsonb, vendor_config)
    for k, v in _DEFAULT_LLM_KWARGS.items():
        kwargs.setdefault(k, v.copy() if isinstance(v, dict) else v)

    _cache[cache_key] = (normalized_full, kwargs, now)
    return normalized_full, kwargs.copy()


async def resolve_subagent_model_name(agent_name: str | None) -> str | None:
    """按 ``agent_name`` 读取 ``agents.model`` 字段（``vendor/model_name`` 字符串）。

    - 行不存在、未启用或 ``model`` 为空 → ``None``（调用方应回退默认 LLM）；
    - 60s TTL 缓存，键为 ``subagent:<agent_name>``，与 ``resolve_subagent_instruction`` 共用；
      Agent PATCH/DELETE 端点调用 ``invalidate_cache(prefix="subagent:")`` 实现强一致。
    """
    row = await _resolve_subagent_row(agent_name)
    if row is None:
        return None
    return row[0] or None


async def resolve_subagent_instruction(agent_name: str | None) -> str | None:
    """按 ``agent_name`` 读取 ``agents.system_prompt`` 字段。

    - 行不存在、未启用或 ``system_prompt`` 为空 → ``None``（调用方应回退到代码 fallback）；
    - 60s TTL 缓存，与 ``resolve_subagent_model_name`` 共用同一行查询；
      Agent PATCH/DELETE/Sync 调用 ``invalidate_cache(prefix="subagent:")`` 同时让两者失效。
    """
    row = await _resolve_subagent_row(agent_name)
    if row is None:
        return None
    return row[1] or None


async def _resolve_subagent_row(agent_name: str | None) -> tuple[str | None, str | None] | None:
    """共用 Agent 行加载：返回 ``(model, system_prompt)``，未启用 / 不存在返回 ``None``。

    缓存键 ``subagent:<agent_name>`` 复用三元组：``(model_or_empty, kwargs={"i": instruction}, ts)``。
    单次 DB 查询同时取 model + instruction，避免 model_resolver 与 instruction provider 双查。
    """
    if not agent_name:
        return None

    cache_key = f"subagent:{agent_name}"
    now = time.monotonic()
    entry = _cache.get(cache_key)
    if entry is not None:
        cached_model, cached_extras, ts = entry
        if now - ts < _CACHE_TTL:
            cached_instruction = cached_extras.get("i") if isinstance(cached_extras, dict) else None
            return (cached_model or None, cached_instruction or None)

    try:
        loaded = await _load_subagent_row(agent_name)
    except Exception:
        from negentropy.logging import get_logger

        get_logger("negentropy.config.model_resolver").warning(
            "subagent_row_load_failed",
            agent_name=agent_name,
            exc_info=True,
        )
        return None

    if loaded is None:
        # 行不存在 / 未启用 → 同样写入空占位，让 60s TTL 覆盖负命中场景，
        # 避免每次 LLM 请求重复触发 DB 查询。
        _cache[cache_key] = ("", {"i": ""}, now)
        return None
    model_value, instruction_value = loaded

    # 空串占位：缓存同样适用于「未配置」场景，避免重复 DB 查询
    _cache[cache_key] = (model_value or "", {"i": instruction_value or ""}, now)
    return (model_value or None, instruction_value or None)


async def _load_model_config_row_by_name(model_type: str, vendor: str, model_name: str):
    """按 (vendor, model_name) 读取 ``model_configs`` 单行；多行时优先 is_default。"""
    from sqlalchemy import select

    from negentropy.db.session import AsyncSessionLocal
    from negentropy.models.model_config import ModelConfig, ModelType

    mt_map = {"llm": ModelType.LLM, "embedding": ModelType.EMBEDDING, "rerank": ModelType.RERANK}
    if model_type not in mt_map:
        return None

    async with AsyncSessionLocal() as session:
        stmt = (
            select(ModelConfig)
            .where(
                ModelConfig.model_type == mt_map[model_type],
                ModelConfig.vendor == vendor,
                ModelConfig.model_name == model_name,
                ModelConfig.enabled.is_(True),
            )
            .order_by(ModelConfig.is_default.desc(), ModelConfig.created_at.asc())
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


async def _load_subagent_row(agent_name: str) -> tuple[str | None, str | None] | None:
    """从 ``agents`` 表读取 ``(model, system_prompt)``；行不存在或未启用返回 ``None``。

    单次 SQL 同时取 model + instruction（system_prompt），避免双查；调用方负责把 ``""``
    视为「未配置」并兜底，本函数仅做 trim。

    若 Agent 关联了 Skills，会在同一 session 内解析 Skills 并按 Progressive Disclosure
    （Anthropic Claude Skills / Google ADK Skills 的描述常驻 + 模板按需）将 Skills 块附加
    到 instruction 末尾。Skills 解析失败 → log 后跳过，不冒泡（fail-soft）。
    """
    from sqlalchemy import select

    from negentropy.agents.skills_injector import (
        SkillToolMissingError,
        build_progressive_disclosure_prompt,
        resolve_skills,
    )
    from negentropy.db.session import AsyncSessionLocal
    from negentropy.models.agent import Agent

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(
                Agent.model,
                Agent.system_prompt,
                Agent.is_enabled,
                Agent.skills,
                Agent.tools,
                Agent.owner_id,
            )
            .where(Agent.name == agent_name)
            .limit(1)
        )
        row = result.first()
        if row is None:
            return None
        model_value, system_prompt_value, is_enabled, skill_refs, tools_list, owner_id = row
        if not is_enabled:
            return None

        instruction_normalized = str(system_prompt_value).strip() if system_prompt_value else None

        # Progressive Disclosure 注入：Skills 描述常驻、prompt_template 按需展开（Phase 2）。
        if skill_refs:
            try:
                resolved = await resolve_skills(session, skill_refs, owner_id=owner_id or "")
                instruction_normalized = (
                    build_progressive_disclosure_prompt(
                        instruction_normalized,
                        resolved,
                        agent_tools=list(tools_list or []),
                    )
                    or None
                )
            except SkillToolMissingError:
                # strict 模式下缺工具：降级为无 system prompt（明确比"装作没事"更安全）。
                from negentropy.logging import get_logger

                get_logger("negentropy.config.model_resolver").error(
                    "subagent_skills_strict_blocked",
                    agent_name=agent_name,
                    exc_info=True,
                )
                instruction_normalized = None
            except Exception:
                from negentropy.logging import get_logger

                get_logger("negentropy.config.model_resolver").warning(
                    "subagent_skills_inject_failed",
                    agent_name=agent_name,
                    exc_info=True,
                )

    model_normalized = str(model_value).strip() if model_value else None
    return (model_normalized or None, instruction_normalized or None)


async def resolve_embedding_config_by_id(config_id: UUID | str | None) -> tuple[str, dict[str, Any]]:
    """根据 model_configs.id 解析 Embedding 配置；None / 查询失败回退默认。"""
    if config_id is None:
        return await resolve_embedding_config()
    return await _resolve_by_id("embedding", config_id)


async def _resolve_by_id(model_type: str, config_id: UUID | str) -> tuple[str, dict[str, Any]]:
    """按 model_configs.id 解析: 缓存 → DB 行 + vendor_configs → 失败回退默认。"""
    now = time.monotonic()
    cache_key = f"{model_type}:{config_id!s}"

    entry = _cache.get(cache_key)
    if entry is not None:
        name, kwargs, ts = entry
        if now - ts < _CACHE_TTL:
            return name, kwargs.copy()

    try:
        result = await _resolve_from_model_config_row(model_type, config_id)
        if result is not None:
            name, kwargs = result
            _cache[cache_key] = (name, kwargs, now)
            return name, kwargs.copy()
    except Exception:
        from negentropy.logging import get_logger

        logger = get_logger("negentropy.config.model_resolver")
        logger.warning(
            "model_resolver_by_id_failed",
            model_type=model_type,
            config_id=str(config_id),
            exc_info=True,
        )

    # 行不存在 / 禁用 / 类型不匹配 → 回退默认解析
    from negentropy.logging import get_logger

    get_logger("negentropy.config.model_resolver").warning(
        "model_resolver_by_id_fallback_default",
        model_type=model_type,
        config_id=str(config_id),
    )
    if model_type == "embedding":
        return await resolve_embedding_config()
    return await resolve_llm_config()


async def _resolve_from_model_config_row(model_type: str, config_id: UUID | str) -> tuple[str, dict[str, Any]] | None:
    """从 model_configs 表读取指定行并构建 kwargs；行不存在 / 已禁用 / 类型不匹配返回 None。"""
    from uuid import UUID as _UUID

    from sqlalchemy import select

    from negentropy.db.session import AsyncSessionLocal
    from negentropy.models.model_config import ModelConfig, ModelType

    mt_map = {"llm": ModelType.LLM, "embedding": ModelType.EMBEDDING, "rerank": ModelType.RERANK}
    if model_type not in mt_map:
        return None

    try:
        config_uuid = config_id if isinstance(config_id, _UUID) else _UUID(str(config_id))
    except (ValueError, TypeError):
        return None

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(ModelConfig).where(ModelConfig.id == config_uuid))
        mc = result.scalar_one_or_none()

    if mc is None or not mc.enabled:
        return None

    row_model_type = mc.model_type.value if hasattr(mc.model_type, "value") else str(mc.model_type)
    if row_model_type != model_type:
        return None

    vendor = mc.vendor
    model_name = mc.model_name
    full_name = build_full_model_name(vendor, model_name)
    vendor_config = await _get_vendor_config(vendor) if vendor else None

    config_jsonb: dict[str, Any] = dict(mc.config or {})

    if model_type == "embedding":
        kwargs = _build_embedding_kwargs(config_jsonb, vendor_config, full_model_name=full_name)
    else:
        kwargs = _build_llm_kwargs(vendor or "", model_name, config_jsonb, vendor_config)
        for k, v in _DEFAULT_LLM_KWARGS.items():
            kwargs.setdefault(k, v.copy() if isinstance(v, dict) else v)

    return full_name, kwargs


async def _resolve(model_type: str) -> tuple[str, dict[str, Any]]:
    """核心解析: 缓存 → vendor_configs + 默认模型名 → 硬编码回退。"""
    now = time.monotonic()

    # 1. 检查缓存
    entry = _cache.get(model_type)
    if entry is not None:
        name, kwargs, ts = entry
        if now - ts < _CACHE_TTL:
            return name, kwargs.copy()

    # 2. 尝试 vendor_configs + 默认模型名
    try:
        result = await _resolve_from_vendor_configs(model_type)
        if result is not None:
            name, kwargs = result
            _cache[model_type] = (name, kwargs, now)
            return name, kwargs.copy()
    except Exception:
        # Lazy import to avoid circular dependency at module level
        from negentropy.logging import get_logger

        logger = get_logger("negentropy.config.model_resolver")
        logger.warning("model_resolver_db_fallback", model_type=model_type, exc_info=True)

    # 3. 回退到硬编码默认值
    name, kwargs = _resolve_defaults(model_type)
    _cache[model_type] = (name, kwargs, now)
    return name, kwargs.copy()


async def _resolve_from_vendor_configs(model_type: str) -> tuple[str, dict[str, Any]] | None:
    """根据默认模型名 + vendor_configs 凭证组合解析。

    - 默认模型名由环境变量或硬编码 fallback 决定
    - 从模型名解析 vendor (如 'gemini/text-embedding-004' → 'gemini')
    - 从 vendor_configs 表读取该 vendor 的 api_key/api_base
    """
    if model_type == "embedding":
        full_name = _DEFAULT_EMBEDDING_MODEL
    elif model_type == "llm":
        full_name = _DEFAULT_LLM_MODEL
    else:
        return None

    vendor, model_name = _split_vendor_and_model(full_name)
    vendor_config = await _get_vendor_config(vendor) if vendor else None

    if model_type == "embedding":
        kwargs = _build_embedding_kwargs({}, vendor_config, full_model_name=full_name)
    else:
        # LLM 默认 kwargs 由 _DEFAULT_LLM_KWARGS 提供 (temperature/drop_params/thinking)
        # vendor 特定逻辑通过 _build_llm_kwargs 适配；此处合并以保留默认行为
        kwargs = _build_llm_kwargs(vendor or "", model_name, {}, vendor_config)
        for k, v in _DEFAULT_LLM_KWARGS.items():
            kwargs.setdefault(k, v.copy() if isinstance(v, dict) else v)

    return full_name, kwargs


def _split_vendor_and_model(full_name: str) -> tuple[str | None, str]:
    """从 'vendor/model' 形式解析 (vendor, model_name)。"""
    if "/" in full_name:
        vendor, model_name = full_name.split("/", 1)
        return vendor, model_name
    return None, full_name


def _resolve_defaults(model_type: str) -> tuple[str, dict[str, Any]]:
    """返回硬编码默认值 — DB 不可达时的回退。"""
    if model_type == "embedding":
        return get_fallback_embedding_config()
    return get_fallback_llm_config()


def build_full_model_name(vendor: str, model_name: str) -> str:
    """构建 LiteLLM 兼容的 vendor/model_name 字符串。"""
    from negentropy.model_names import canonicalize_model_name

    raw = f"{vendor}/{model_name}" if "/" not in model_name else model_name
    return canonicalize_model_name(raw) or raw


# Google AI Studio 默认域名常量（litellm 内置默认指向同一地址）。
_GEMINI_DEFAULT_API_HOST = "https://generativelanguage.googleapis.com"
# 用户常误粘的路径后缀（来自 curl 示例或 OpenAI 兼容文档），归一化时需剥离。
_GEMINI_API_BASE_STRIP_SUFFIXES: tuple[str, ...] = (
    "/v1beta/openai/chat/completions",
    "/v1beta/openai",
    "/chat/completions",
    "/generateContent",
    "/v1beta",
)

# OpenAI 官方 host（litellm 内置默认 = 此 host + "/v1"）。
_OPENAI_DEFAULT_API_HOST = "https://api.openai.com"
# 用户易误粘的 curl 路径后缀（覆盖 chat/completions/embeddings/responses 四链路，含 /v1 前缀变体，长串优先）。
_OPENAI_API_BASE_STRIP_SUFFIXES: tuple[str, ...] = (
    "/v1/chat/completions",
    "/v1/completions",
    "/v1/embeddings",
    "/v1/responses",
    "/chat/completions",
    "/completions",
    "/embeddings",
    "/responses",
)


def normalize_api_base_for_litellm(model: str, api_base: str | None) -> str | None:
    """为 LiteLLM 规范化 Gemini 与 OpenAI 的 api_base，抵消其 URL 拼接对版本段的丢弃。

    **Gemini**：litellm 1.83.x 的 `_check_custom_proxy` 在 `custom_llm_provider=="gemini"` 且
    `api_base` 非空时，以 `{api_base}/models/{model}:{endpoint}` 拼接目标 URL
    (参见 `.venv/.../vertex_ai/vertex_llm_base.py:_check_custom_proxy`)，该格式
    丢失了 Google 要求的 `/v1beta/` 版本段。直接透传 `api_base` 会让请求落到错误
    路径，Google 边缘以 HTML 兜底页响应，进而触发 `GeminiException - Received=<!DOCTYPE html>`。

    **OpenAI**：litellm 将用户 `api_base` 原样作为 `AsyncOpenAI(base_url=...)`，而 OpenAI
    Python SDK 仅以相对路径 `chat/completions` 拼接最终 URL（见
    `site-packages/openai/resources/chat/completions/completions.py::create`），与 litellm 内置
    默认 `https://api.openai.com/v1` 的 `/v1` 版本段不对齐。用户按官网 placeholder 风格填入裸 host
    时请求落到根路径 `chat/completions`，网关以 catchall 40x/429 响应。

    规则：
    1. `api_base` 为空/None → 返回 None，交给 litellm 默认链路。
    2. 清洗尾斜杠 + 与 vendor 无关的 Anthropic 及其它前缀 → 清洗后恒等返回。
    3. **Gemini** 分支：剥离常见误粘后缀；官方域名 → None 放行 litellm 内置 URL；自建代理补齐 `/v1beta`。
    4. **OpenAI** 分支：剥离常见误粘后缀；官方域名（含 `/v1` 写法）→ None；URL 已显式带 `/v1` 结尾或
       中段含 `/v1/` → 恒等透传；其余自建代理末尾无 `/v1` → 补齐 `/v1`。
    """
    if api_base is None:
        return None
    stripped = api_base.strip().rstrip("/")
    if not stripped:
        return None

    if model.startswith("gemini/"):
        # 迭代剥离末尾噪声后缀（用户在 Base URL 字段粘贴了 curl 完整路径时尤其常见）。
        changed = True
        while changed:
            changed = False
            for suffix in _GEMINI_API_BASE_STRIP_SUFFIXES:
                if stripped.endswith(suffix):
                    stripped = stripped[: -len(suffix)].rstrip("/")
                    changed = True
                    break

        if not stripped:
            return None
        if stripped == _GEMINI_DEFAULT_API_HOST:
            return None
        if stripped.endswith("/v1beta"):
            return stripped
        return f"{stripped}/v1beta"

    if model.startswith("openai/"):
        # 迭代剥离常见 curl 完整路径误粘（长串后缀已按优先级排序）。
        changed = True
        while changed:
            changed = False
            for suffix in _OPENAI_API_BASE_STRIP_SUFFIXES:
                if stripped.endswith(suffix):
                    stripped = stripped[: -len(suffix)].rstrip("/")
                    changed = True
                    break

        if not stripped:
            return None
        # 官方域名（含裸 host 与 host/v1 两种写法）→ None 放行 litellm 内置 URL。
        if stripped in (_OPENAI_DEFAULT_API_HOST, f"{_OPENAI_DEFAULT_API_HOST}/v1"):
            return None
        # 已显式带 /v1 结尾 → 不重复追加（含 https://gateway/v1、https://gateway/openai/v1 等）。
        if stripped.endswith("/v1"):
            return stripped
        # URL 中段已含 /v1/（如 https://gateway/v1/custom）→ 恒等透传，避免双重 /v1。
        if "/v1/" in stripped:
            return stripped
        # 默认：补齐 /v1，抵消 OpenAI SDK 仅拼 /chat/completions 的缺陷。
        return f"{stripped}/v1"

    return stripped


async def _get_vendor_config(vendor: str) -> dict[str, str] | None:
    """从 DB 查询供应商级凭证（api_key + api_base）。查询失败时静默返回 None。"""
    try:
        from sqlalchemy import select

        from negentropy.db.session import AsyncSessionLocal
        from negentropy.models.vendor_config import VendorConfig

        async with AsyncSessionLocal() as session:
            result = await session.execute(select(VendorConfig).where(VendorConfig.vendor == vendor))
            vc = result.scalar_one_or_none()

        if vc is None:
            return None
        return {"api_key": vc.api_key, "api_base": vc.api_base}
    except Exception:
        # vendor_configs 表可能尚未迁移，或 DB 不可达 — 静默回退
        return None


def _supports_anthropic_thinking(vendor: str, model_name: str) -> bool:
    model_lower = model_name.lower()
    return vendor == "anthropic" or "claude" in model_lower


def _supports_openai_reasoning(vendor: str, model_name: str) -> bool:
    model_lower = model_name.lower()
    return vendor == "openai" and (model_lower.startswith("gpt-5") or model_lower[:2] in {"o1", "o3", "o4"})


def apply_llm_thinking_override(
    full_model_name: str,
    kwargs: dict[str, Any],
    enabled: bool,
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """按模型能力覆盖单轮 Thinking / Reasoning 参数。

    ``enabled`` 来自 Home Composer 的 per-run 开关；它只表示"请求增强推理"，
    不承诺供应商一定返回可见推理文本。不支持的模型保持 kwargs 原样，避免向
    上游注入未知参数。
    """
    next_kwargs = kwargs.copy()
    config = config or {}
    vendor, model_name = _split_vendor_and_model(full_model_name)
    vendor = vendor or ""

    if _supports_anthropic_thinking(vendor, model_name):
        if enabled:
            next_kwargs["thinking"] = {
                "type": "enabled",
                "budget_tokens": config.get("thinking_budget", 2048),
            }
        else:
            next_kwargs["thinking"] = {"type": "disabled"}
        return next_kwargs

    if _supports_openai_reasoning(vendor, model_name):
        if enabled:
            next_kwargs["reasoning_effort"] = config.get("reasoning_effort", "medium")
        else:
            next_kwargs.pop("reasoning_effort", None)
        return next_kwargs

    return next_kwargs


def _build_llm_kwargs(
    vendor: str, model_name: str, config: dict[str, Any], vendor_config: dict[str, str] | None = None
) -> dict[str, Any]:
    """从 DB config JSONB 构建 LiteLLM kwargs。

    供应商特定的 LiteLLM kwargs 构建逻辑。
    凭证解析链: model config > vendor config > LiteLLM 环境变量回退。
    """
    kwargs: dict[str, Any] = {}

    if "temperature" in config:
        kwargs["temperature"] = config["temperature"]
    if "max_tokens" in config:
        kwargs["max_tokens"] = config["max_tokens"]
    if "top_p" in config:
        kwargs["top_p"] = config["top_p"]

    # 供应商特定的 thinking/reasoning 适配。DB config 仍是模型配置事实源；
    # Home 的 per-run 开关会在 DynamicLiteLlm 层覆盖本轮请求，不回写配置。
    full_model = f"{vendor}/{model_name}" if vendor else model_name
    kwargs = apply_llm_thinking_override(
        full_model,
        kwargs,
        bool(config.get("thinking_mode", False)),
        config,
    )

    if "drop_params" in config and "drop_params" not in kwargs:
        kwargs["drop_params"] = config["drop_params"]

    # 透传 API 凭证: model config > vendor config > LiteLLM 环境变量回退
    effective_api_key = config.get("api_key") or (vendor_config or {}).get("api_key")
    effective_api_base = config.get("api_base") or (vendor_config or {}).get("api_base")
    if effective_api_key:
        kwargs["api_key"] = effective_api_key
    normalized_api_base = normalize_api_base_for_litellm(full_model, effective_api_base)
    if normalized_api_base:
        kwargs["api_base"] = normalized_api_base

    return kwargs


def _build_embedding_kwargs(
    config: dict[str, Any],
    vendor_config: dict[str, str] | None = None,
    full_model_name: str | None = None,
) -> dict[str, Any]:
    """从 DB config JSONB 构建 Embedding kwargs。"""
    kwargs: dict[str, Any] = {}
    if "dimensions" in config and config["dimensions"] is not None:
        kwargs["dimensions"] = config["dimensions"]
    if "input_type" in config and config["input_type"]:
        kwargs["input_type"] = config["input_type"]

    # 透传 API 凭证: model config > vendor config > LiteLLM 环境变量回退
    effective_api_key = config.get("api_key") or (vendor_config or {}).get("api_key")
    effective_api_base = config.get("api_base") or (vendor_config or {}).get("api_base")
    if effective_api_key:
        kwargs["api_key"] = effective_api_key
    normalized_api_base = normalize_api_base_for_litellm(full_model_name or "", effective_api_base)
    if normalized_api_base:
        kwargs["api_base"] = normalized_api_base

    return kwargs


# =============================================================================
# Task-aware 解析（task_model_settings 表驱动）
# =============================================================================
# 解析链（按优先级降序）:
#   1. task_model_settings (scope_corpus_id=corpus_id, task_key)  — Corpus 级覆盖
#   2. task_model_settings (scope_corpus_id IS NULL, task_key)    — 全局映射
#   3. resolve_llm_config() / resolve_embedding_config()          — model_configs.is_default
#   4. _DEFAULT_LLM_MODEL / _DEFAULT_EMBEDDING_MODEL               — 硬编码 fallback
#
# 缓存键格式: ``task:<llm|embedding>:<corpus_id|'_'>:<task_key>``，与现有 ``llm`` /
# ``embedding`` / ``llm:<id>`` / ``subagent:`` 命名空间隔离；写操作后 API 层调
# ``invalidate_cache(prefix="task:")`` 批量清除。


def _task_cache_key(model_type: str, task_key: str, corpus_id: UUID | str | None) -> str:
    return f"task:{model_type}:{corpus_id or '_'}:{task_key}"


def get_cached_llm_config_for_task(
    task_key: str,
    corpus_id: UUID | str | None = None,
) -> tuple[str, dict[str, Any]] | None:
    """同步缓存读取 — task 槽位 LLM 配置（用于无法 await 的上下文）。"""
    entry = _cache.get(_task_cache_key("llm", task_key, corpus_id))
    if entry is not None:
        name, kwargs, ts = entry
        if time.monotonic() - ts < _CACHE_TTL:
            return name, kwargs.copy()
    return None


def get_cached_embedding_config_for_task(
    task_key: str,
    corpus_id: UUID | str | None = None,
) -> tuple[str, dict[str, Any]] | None:
    """同步缓存读取 — task 槽位 Embedding 配置。"""
    entry = _cache.get(_task_cache_key("embedding", task_key, corpus_id))
    if entry is not None:
        name, kwargs, ts = entry
        if time.monotonic() - ts < _CACHE_TTL:
            return name, kwargs.copy()
    return None


async def resolve_llm_config_for_task(
    task_key: str,
    *,
    corpus_id: UUID | str | None = None,
    fallback_config_id: UUID | str | None = None,
) -> tuple[str, dict[str, Any]]:
    """按 task_key (+ 可选 corpus_id) 解析 LLM 配置。

    解析链:
        1. ``task_model_settings(scope_corpus_id=corpus_id, task_key)``
        2. ``task_model_settings(scope_corpus_id IS NULL, task_key)``
        3. ``fallback_config_id`` — 调用方提供的兜底配置 ID（如语料库绑定）
        4. ``resolve_llm_config()``  — 全局默认
        5. ``get_fallback_llm_config()`` — 硬编码 fallback（由前述链路自动兜底）

    Returns:
        ``(full_model_name, litellm_kwargs)`` — 与 ``resolve_llm_config`` 同形签名，
        调用方无需关心是否命中 task 映射。
    """
    return await _resolve_for_task("llm", task_key, corpus_id, fallback_config_id)


async def resolve_embedding_config_for_task(
    task_key: str,
    *,
    corpus_id: UUID | str | None = None,
    fallback_config_id: UUID | str | None = None,
) -> tuple[str, dict[str, Any]]:
    """按 task_key (+ 可选 corpus_id) 解析 Embedding 配置。语义同 ``resolve_llm_config_for_task``。"""
    return await _resolve_for_task("embedding", task_key, corpus_id, fallback_config_id)


async def _resolve_for_task(
    model_type: str,
    task_key: str,
    corpus_id: UUID | str | None,
    fallback_config_id: UUID | str | None = None,
) -> tuple[str, dict[str, Any]]:
    """统一的 task 槽位解析实现。

    优先级：corpus_id 映射 → 全局映射 → fallback_config_id → 全局默认 → 硬编码 fallback。
    每一层未命中时静默回退，错误（DB 不可达等）也降级为继续走下一层。
    """
    now = time.monotonic()
    cache_key = _task_cache_key(model_type, task_key, corpus_id)

    entry = _cache.get(cache_key)
    if entry is not None:
        name, kwargs, ts = entry
        if now - ts < _CACHE_TTL:
            return name, kwargs.copy()

    # 1. 优先尝试 corpus 级映射（若提供了 corpus_id）
    if corpus_id is not None:
        config_id = await _lookup_task_model_config_id(task_key, corpus_id)
        if config_id is not None:
            try:
                result = await _resolve_from_model_config_row(model_type, config_id)
                if result is not None:
                    _cache[cache_key] = (result[0], result[1], now)
                    _log_task_resolved(task_key, corpus_id, model_type, result[0], "corpus_task")
                    return result[0], result[1].copy()
            except Exception:
                from negentropy.logging import get_logger

                get_logger("negentropy.config.model_resolver").warning(
                    "task_model_resolve_corpus_failed",
                    task_key=task_key,
                    corpus_id=str(corpus_id),
                    model_type=model_type,
                    exc_info=True,
                )

    # 2. 全局映射 (scope_corpus_id IS NULL)
    config_id = await _lookup_task_model_config_id(task_key, None)
    if config_id is not None:
        try:
            result = await _resolve_from_model_config_row(model_type, config_id)
            if result is not None:
                _cache[cache_key] = (result[0], result[1], now)
                _log_task_resolved(task_key, corpus_id, model_type, result[0], "global_task")
                return result[0], result[1].copy()
        except Exception:
            from negentropy.logging import get_logger

            get_logger("negentropy.config.model_resolver").warning(
                "task_model_resolve_global_failed",
                task_key=task_key,
                model_type=model_type,
                exc_info=True,
            )

    # 3. 调用方提供的兜底配置 ID（如语料库绑定的 llm_config_id）
    if fallback_config_id is not None:
        try:
            result = await _resolve_from_model_config_row(model_type, fallback_config_id)
            if result is not None:
                _cache[cache_key] = (result[0], result[1], now)
                _log_task_resolved(task_key, corpus_id, model_type, result[0], "fallback_config")
                return result[0], result[1].copy()
        except Exception:
            from negentropy.logging import get_logger

            get_logger("negentropy.config.model_resolver").warning(
                "task_model_resolve_fallback_failed",
                task_key=task_key,
                fallback_config_id=str(fallback_config_id),
                model_type=model_type,
                exc_info=True,
            )

    # 4. 回退到全局默认（model_configs.is_default → vendor_configs → 硬编码 fallback）
    if model_type == "embedding":
        name, kwargs = await resolve_embedding_config()
    else:
        name, kwargs = await resolve_llm_config()
    _cache[cache_key] = (name, kwargs, now)
    _log_task_resolved(task_key, corpus_id, model_type, name, "default")
    return name, kwargs.copy()


async def _lookup_task_model_config_id(
    task_key: str,
    corpus_id: UUID | str | None,
) -> UUID | None:
    """查 task_model_settings 表，返回 model_config_id；行不存在或表不可用返回 None。

    NOTE: 复合主键中 scope_corpus_id 为 NULL 的语义在 SQL 端需用 IS NULL 表达，
    不能用 = NULL（永远为 false）。
    """
    try:
        from uuid import UUID as _UUID

        from sqlalchemy import and_, select

        from negentropy.db.session import AsyncSessionLocal
        from negentropy.models.task_model_setting import TaskModelSetting

        async with AsyncSessionLocal() as session:
            if corpus_id is None:
                stmt = select(TaskModelSetting.model_config_id).where(
                    and_(
                        TaskModelSetting.scope_corpus_id.is_(None),
                        TaskModelSetting.task_key == task_key,
                    )
                )
            else:
                corpus_uuid = corpus_id if isinstance(corpus_id, _UUID) else _UUID(str(corpus_id))
                stmt = select(TaskModelSetting.model_config_id).where(
                    and_(
                        TaskModelSetting.scope_corpus_id == corpus_uuid,
                        TaskModelSetting.task_key == task_key,
                    )
                )
            result = await session.execute(stmt)
            return result.scalar_one_or_none()
    except Exception:
        # 表尚未迁移 / DB 不可达 → 静默回退，由调用方继续走下一层。
        from negentropy.logging import get_logger

        get_logger("negentropy.config.model_resolver").debug(
            "task_model_lookup_failed",
            task_key=task_key,
            corpus_id=str(corpus_id) if corpus_id is not None else None,
            exc_info=True,
        )
        return None


def _log_task_resolved(
    task_key: str,
    corpus_id: UUID | str | None,
    model_type: str,
    resolved_model: str,
    source: str,
) -> None:
    """结构化日志：便于运维核对 task -> model 实际路由。

    source ∈ {corpus_task, global_task, default}
    """
    try:
        from negentropy.logging import get_logger

        get_logger("negentropy.config.model_resolver").info(
            "task_model_resolved",
            task_key=task_key,
            corpus_id=str(corpus_id) if corpus_id is not None else None,
            model_type=model_type,
            resolved_model=resolved_model,
            source=source,
        )
    except Exception:
        # 日志失败绝不影响主链路
        pass
