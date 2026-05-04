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
- resolve_subagent_model_name()         — 按 agent_name 读取 sub_agents.model
- resolve_subagent_instruction()        — 按 agent_name 读取 sub_agents.system_prompt
- get_cached_llm_config()               — 同步缓存读取 (无法 await 的上下文)
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
        prefix: 按前缀批量失效 (如 "subagent:" 清所有 SubAgent 缓存)。

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
    """按 ``agent_name`` 读取 ``sub_agents.model`` 字段（``vendor/model_name`` 字符串）。

    - 行不存在、未启用或 ``model`` 为空 → ``None``（调用方应回退默认 LLM）；
    - 60s TTL 缓存，键为 ``subagent:<agent_name>``，与 ``resolve_subagent_instruction`` 共用；
      SubAgent PATCH/DELETE 端点调用 ``invalidate_cache(prefix="subagent:")`` 实现强一致。
    """
    row = await _resolve_subagent_row(agent_name)
    if row is None:
        return None
    return row[0] or None


async def resolve_subagent_instruction(agent_name: str | None) -> str | None:
    """按 ``agent_name`` 读取 ``sub_agents.system_prompt`` 字段。

    - 行不存在、未启用或 ``system_prompt`` 为空 → ``None``（调用方应回退到代码 fallback）；
    - 60s TTL 缓存，与 ``resolve_subagent_model_name`` 共用同一行查询；
      SubAgent PATCH/DELETE/Sync 调用 ``invalidate_cache(prefix="subagent:")`` 同时让两者失效。
    """
    row = await _resolve_subagent_row(agent_name)
    if row is None:
        return None
    return row[1] or None


async def _resolve_subagent_row(agent_name: str | None) -> tuple[str | None, str | None] | None:
    """共用 SubAgent 行加载：返回 ``(model, system_prompt)``，未启用 / 不存在返回 ``None``。

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
    """从 ``sub_agents`` 表读取 ``(model, system_prompt)``；行不存在或未启用返回 ``None``。

    单次 SQL 同时取 model + instruction（system_prompt），避免双查；调用方负责把 ``""``
    视为「未配置」并兜底，本函数仅做 trim。

    若 SubAgent 关联了 Skills，会在同一 session 内解析 Skills 并按 Progressive Disclosure
    （Anthropic Claude Skills / Google ADK Skills 的描述常驻 + 模板按需）将 Skills 块附加
    到 instruction 末尾。Skills 解析失败 → log 后跳过，不冒泡（fail-soft）。
    """
    from sqlalchemy import select

    from negentropy.agents.skills_injector import build_progressive_disclosure_prompt, resolve_skills
    from negentropy.db.session import AsyncSessionLocal
    from negentropy.models.sub_agent import SubAgent

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(
                SubAgent.model,
                SubAgent.system_prompt,
                SubAgent.is_enabled,
                SubAgent.skills,
                SubAgent.owner_id,
            )
            .where(SubAgent.name == agent_name)
            .limit(1)
        )
        row = result.first()
        if row is None:
            return None
        model_value, system_prompt_value, is_enabled, skill_refs, owner_id = row
        if not is_enabled:
            return None

        instruction_normalized = str(system_prompt_value).strip() if system_prompt_value else None

        # Progressive Disclosure 注入：Skills 描述常驻、prompt_template 按需展开（Phase 2）。
        if skill_refs:
            try:
                resolved = await resolve_skills(session, skill_refs, owner_id=owner_id or "")
                instruction_normalized = build_progressive_disclosure_prompt(instruction_normalized, resolved) or None
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

    # 供应商特定的 thinking/reasoning 适配
    model_lower = model_name.lower()

    if vendor == "anthropic" or "claude" in model_lower:
        thinking_mode = config.get("thinking_mode", False)
        if thinking_mode:
            kwargs["thinking"] = {
                "type": "enabled",
                "budget_tokens": config.get("thinking_budget", 2048),
            }
        else:
            kwargs["thinking"] = {"type": "disabled"}

    elif vendor == "openai" and model_lower.startswith(("o1", "o3")):
        thinking_mode = config.get("thinking_mode", False)
        if thinking_mode:
            kwargs["reasoning_effort"] = config.get("reasoning_effort", "medium")

    if "drop_params" in config and "drop_params" not in kwargs:
        kwargs["drop_params"] = config["drop_params"]

    # 透传 API 凭证: model config > vendor config > LiteLLM 环境变量回退
    effective_api_key = config.get("api_key") or (vendor_config or {}).get("api_key")
    effective_api_base = config.get("api_base") or (vendor_config or {}).get("api_base")
    if effective_api_key:
        kwargs["api_key"] = effective_api_key
    full_model = f"{vendor}/{model_name}" if vendor else model_name
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
