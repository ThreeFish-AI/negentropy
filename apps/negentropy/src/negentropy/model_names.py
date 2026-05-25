"""
LLM 模型名规范化工具。

提供全局唯一的模型名规范化与查表键转换逻辑，避免观测、日志、
持久化和定价等链路各自维护不同的命名规则。

# 正交分解：调度路径 vs 观测路径 vs 定价路径

调度链路（LiteLLM `acompletion` / `aembedding`、`build_full_model_name`）
**必须保留 `vendor/model_name` 前缀**——LiteLLM 依赖它选择真实 API（`openai/`、
`gemini/` 等），所以本模块对调度链路只做轻量幂等处理：

- ``canonicalize_model_name()`` —— 仅 ``strip()``，保留 vendor 前缀；

定价链路（LiteLLM 在线/本地价目表查表）需要**裸名**作为查表键：

- ``pricing_lookup_model_name()`` —— 在 canonicalize 之后剥前缀拿裸名查定价表。

观测链路（OTel span 上报到 Langfuse）需要**带 vendor 前缀的全名**——Langfuse
Model Costs 视图按模型字段聚合，若同一模型以 ``openai/gpt-5-mini`` /
``gpt-5-mini`` / ``gpt-5-mini-2025-08-07`` 三种写法上报会被拆成三行统计，
违反 Single Source of Truth。观测路径专用：

- ``observability_model_name()`` —— 补齐/保留 vendor 前缀 + 剥日期/版本后缀 +
  别名映射，幂等；
- ``extract_vendor()`` —— 从原串或裸名识别供应商，写到 OTel ``gen_ai.system``。

**仅 ``negentropy.instrumentation`` 应当调用观测路径函数**。其它代码路径继续走
``canonicalize_model_name()`` / ``pricing_lookup_model_name()``。

# 历史决策记录

- 2026 初期：曾在 GLM 系列上做 `zai/<model>` 强制规范化；ZAI/LiteLLM 整合后下线。
- 2026-05：观测路径口径**首次设计为「裸名」**（剥 vendor 前缀），目的是把
  ``openai/gpt-5-mini`` 与裸名 ``gpt-5-mini`` 聚合到同一行。
- 2026-05-21：**反转**为「vendor/model」全名。原因：LiteLLM 原生 OTel callback
  在我们的 monkey-patch 之前会先写 ``gen_ai.request.model = "openai/gpt-5-mini"``
  到 span，而 Langfuse 的 Model Costs 视图仍把带前缀的串与裸名拆成不同行。
  与其在多入口竞速覆盖裸名，不如**承认 vendor/model 才是 LiteLLM 调度路径
  唯一权威形态**，把所有上报收敛到这个形态，并显式补齐裸名调用方。
"""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# 调度链路（保持现有契约不变）
# ---------------------------------------------------------------------------


def canonicalize_model_name(model_name: str | None) -> str | None:
    """返回全局规范模型名。

    当前实现为幂等 no-op：仅剔除首尾空白，保留原始供应商前缀与模型名。
    """
    if not model_name:
        return model_name

    normalized = model_name.strip()
    return normalized or model_name


def pricing_lookup_model_name(model_name: str | None) -> str | None:
    """返回用于定价查表的模型键。

    定价表以裸模型名为键（例如 `gpt-5-mini`），因此需要在查表前
    去掉供应商前缀。
    """
    canonical = canonicalize_model_name(model_name)
    if not canonical:
        return canonical

    _, separator, raw_model = canonical.partition("/")
    return raw_model if separator else canonical


# ---------------------------------------------------------------------------
# 观测链路：仅供 negentropy.instrumentation 使用
# ---------------------------------------------------------------------------

# LiteLLM 风格的 vendor 前缀白名单（小写匹配）。命中后保留作为权威 vendor。
# 双层前缀场景（如 `bedrock/anthropic.claude-3-5-sonnet`）只剥 `bedrock/`，剩余
# `anthropic.claude-3-5-sonnet` 作为 bare model；最终输出仍以 `bedrock/` 拼回。
_VENDOR_PREFIXES: tuple[str, ...] = (
    "openai/",
    "anthropic/",
    "gemini/",
    "vertex_ai/",
    "mistral/",
    "cohere/",
    "groq/",
    "deepseek/",
    "meta/",
    "ollama/",
    "azure/",
    "bedrock/",
    "together_ai/",
    "replicate/",
)

# 非 vendor 的可剥离前缀。Google Gemini Embedding API 返回
# ``models/text-embedding-004`` 作为 response model，``models/`` 不是 vendor
# 标识——在 vendor 检测之前剥离，避免它污染 bare model 名。
_STRIP_PREFIXES: tuple[str, ...] = ("models/",)

# 日期/版本后缀正则（白名单策略，锚到 `$`）。
# 仅剥可识别的「日期形」尾巴，避免误伤 `gpt-4o-mini`、`text-embedding-3-large`
# 等本身就含数字的模型名。新增正则需同步补单测覆盖。
_DATE_SUFFIX_REGEXES: tuple[re.Pattern[str], ...] = (
    re.compile(r"-\d{4}-\d{2}-\d{2}$"),  # 2025-08-07 风格（OpenAI gpt-5-mini-2025-08-07）
    re.compile(r"-\d{8}$"),  # 20241022 风格（Anthropic claude-3-5-sonnet-20241022）
)

# 显式别名映射（`alias → canonical`）。起步只放最确定的一两条；新增映射
# **必须**同步补 `tests/unit_tests/config/test_model_names.py` 单测。
# 注意：别名作用于「裸名」阶段（剥前缀剥日期之后、拼回 vendor 之前），所以
# 别名键也应当是裸名形态。
_MODEL_ALIASES: dict[str, str] = {
    # 空起步：保持最小风险面；后续如发现明确同模型不同名再加。
}

# 裸名按系族识别 vendor（仅在 vendor 前缀缺失时兜底）。键为前缀，值为 vendor。
# 长前缀优先于短前缀，避免 `chatgpt-` 被 `gpt-` 抢先匹配。
_VENDOR_FAMILY_PREFIXES: tuple[tuple[str, str], ...] = (
    ("chatgpt-", "openai"),
    ("gpt-", "openai"),
    ("o1-", "openai"),
    ("o3-", "openai"),
    ("o4-", "openai"),
    ("text-embedding-", "openai"),  # OpenAI text-embedding-3-*；Gemini 同名必须走前缀或 vendor_hint
    ("claude-", "anthropic"),
    ("gemini-", "gemini"),
    ("llama-", "meta"),
    ("codestral-", "mistral"),
    ("mixtral-", "mistral"),
    ("mistral-", "mistral"),
    ("command-", "cohere"),
    ("deepseek-", "deepseek"),
)


def _split_vendor_and_bare(name: str) -> tuple[str | None, str]:
    """把 `vendor/bare` 形态拆成 ``(vendor_lowercased, bare)``；未命中返回 ``(None, name)``。

    仅识别 ``_VENDOR_PREFIXES`` 白名单，避免把模型名里偶发的 ``/`` 误判为 vendor 分隔符。
    大小写不敏感；返回的 vendor 一律 lowercase，便于在 Langfuse 聚合时收敛到同一聚合键。

    在 vendor 检测之前，先剥离 ``_STRIP_PREFIXES`` 中的非 vendor 前缀
    （如 Gemini Embedding API 返回的 ``models/``），避免它们污染 bare model 名。
    """
    lowered = name.lower()
    for strip_prefix in _STRIP_PREFIXES:
        if lowered.startswith(strip_prefix):
            name = name[len(strip_prefix) :]
            lowered = lowered[len(strip_prefix) :]
            break
    for prefix in _VENDOR_PREFIXES:
        if lowered.startswith(prefix):
            return prefix.rstrip("/"), name[len(prefix) :]
    return None, name


def _strip_vendor_prefix(name: str) -> str:
    """剥外层 vendor 前缀（仅一次），大小写不敏感。未命中则返回原串。

    保留供 ``pricing_lookup_model_name`` 之外的潜在调用方；新代码优先使用
    ``_split_vendor_and_bare`` 拿到 vendor + bare 一次完成。
    """
    _, bare = _split_vendor_and_bare(name)
    return bare


def _strip_date_suffix(name: str) -> str:
    """剥日期/版本后缀（白名单正则）。锚到 `$`，剥完不再匹配，幂等。"""
    for pattern in _DATE_SUFFIX_REGEXES:
        if pattern.search(name):
            return pattern.sub("", name)
    return name


def observability_model_name(model_name: str | None, *, vendor_hint: str | None = None) -> str | None:
    """返回**仅供观测上报**的全名（``vendor/model`` 形态，剥日期 + 别名 + 幂等）。

    五步幂等管线：

    1. ``strip()`` 空白；空 / None 透传。
    2. 拆分 vendor 与裸名：若原串带 ``_VENDOR_PREFIXES`` 中的显式前缀，取该前缀（lowercase）
       作为权威 vendor；否则 vendor 落空，bare 为整串。
    3. 剥日期/版本后缀（白名单正则，避免误伤 ``gpt-4o-mini`` / ``text-embedding-3-large``）。
       作用于 bare。
    4. 别名映射兜底（``_MODEL_ALIASES``，作用于 bare）。
    5. 决定最终 vendor 并组合输出：
       - 显式前缀命中 → 用之；
       - 否则使用 ``vendor_hint`` 兜底（调用方通过该参数注入 request 侧权威 vendor，
         消除 ``gemini/text-embedding-004`` request 与 ``text-embedding-004`` response
         在家族前缀表中被识别成不同 vendor 的歧义）；
       - 都落空再用 ``extract_vendor(bare)`` 兜底；
       - 最终 vendor 仍为 None 时返回裸名（保持「未知模型保持原样」契约）。

    幂等保证：
    - 步骤 2 之后若再调用一次，新输入已是 ``vendor/bare`` 形态，会再次拆出同一 vendor；
    - 步骤 3 的正则锚到 ``$``，剥完不再匹配；
    - 步骤 4 字典查表 fixpoint；
    - 步骤 5 组合输出后再次进入本函数，会被步骤 2 识别为 ``vendor/bare`` 形态并取同一 vendor。

    **禁止**在 LiteLLM 调度路径使用本函数（语义虽然兼容，但调度路径应走
    ``canonicalize_model_name`` 表达「不修改」的契约）。
    """
    if not model_name:
        return model_name

    normalized = model_name.strip()
    if not normalized:
        return model_name

    explicit_vendor, bare = _split_vendor_and_bare(normalized)
    bare = _strip_date_suffix(bare)
    bare = _MODEL_ALIASES.get(bare, bare)

    vendor = explicit_vendor or (vendor_hint.strip().lower() if vendor_hint else None)
    if not vendor:
        vendor = extract_vendor(bare)

    if vendor:
        return f"{vendor}/{bare}"
    return bare


def extract_vendor(model_name: str | None) -> str | None:
    """从模型名提取供应商标识（写入 OTel ``gen_ai.system``）。

    优先级：
    1. 原串带 ``vendor/`` 前缀（与 ``_VENDOR_PREFIXES`` 白名单交集）→ 直接返回 vendor；
    2. 否则按裸名前缀匹配 ``_VENDOR_FAMILY_PREFIXES``（长前缀优先）；
    3. 落空返回 ``None``，调用方相应不写 ``gen_ai.system``，避免污染未知值。
    """
    if not model_name:
        return None

    normalized = model_name.strip()
    if not normalized:
        return None

    # 1. 显式 vendor/ 前缀（_split_vendor_and_bare 会先剥离 _STRIP_PREFIXES）
    explicit_vendor, bare = _split_vendor_and_bare(normalized)
    if explicit_vendor:
        return explicit_vendor

    # 2. 系族前缀回退（用剥离后的 bare 形式判断，确保 models/text-embedding-004
    #    剥掉 models/ 后能匹配 text-embedding- 前缀）
    bare_lower = bare.lower()
    for family_prefix, vendor in _VENDOR_FAMILY_PREFIXES:
        if bare_lower.startswith(family_prefix):
            return vendor

    return None
