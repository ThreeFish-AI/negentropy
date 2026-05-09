"""
LLM 模型名规范化工具。

提供全局唯一的模型名规范化与查表键转换逻辑，避免观测、日志、
持久化和定价等链路各自维护不同的命名规则。

# 正交分解：调度路径 vs 观测路径

调度链路（LiteLLM `acompletion` / `aembedding`、`build_full_model_name`、定价查表）
**必须保留 `vendor/model_name` 前缀**——LiteLLM 依赖它选择真实 API（`openai/`、
`gemini/` 等），所以本模块对调度链路只做轻量幂等处理：

- ``canonicalize_model_name()`` —— 仅 ``strip()``，保留 vendor 前缀；
- ``pricing_lookup_model_name()`` —— 在 canonicalize 之后剥前缀拿裸名查定价表。

观测链路（OTel span 上报到 Langfuse）则**需要裸名**——Langfuse Model Costs 视图按
模型字段聚合，若同一模型以 ``openai/gpt-5-mini`` / ``gpt-5-mini`` /
``gpt-5-mini-2025-08-07`` 三种写法上报会被拆成三行统计，违反 Single Source of Truth。
观测路径专用：

- ``observability_model_name()`` —— 剥 vendor 前缀 + 剥日期/版本后缀 + 别名映射，幂等；
- ``extract_vendor()`` —— 从原串或裸名识别供应商，写到 OTel ``gen_ai.system``。

**仅 ``negentropy.instrumentation`` 应当调用观测路径函数**。其它代码路径继续走
``canonicalize_model_name()`` / ``pricing_lookup_model_name()``。

历史上 GLM 系列曾在此被强制规范为 `zai/<model>`；该专属链路已随
ZAI/LiteLLM 整合下线。上游调用点（观测、定价、日志）保持接口不变以
维持正交性，若未来需要引入新的供应商规范化规则，可在此处扩展。
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

# LiteLLM 风格的 vendor 前缀白名单（小写匹配）。命中后剥外层一次。
# 双层前缀场景（如 `bedrock/anthropic.claude-3-5-sonnet`）只剥 `bedrock/`，剩余
# `anthropic.claude-3-5-sonnet` 与 LiteLLM catalog 裸名格式一致，便于定价查表对齐。
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

# 日期/版本后缀正则（白名单策略，锚到 `$`）。
# 仅剥可识别的「日期形」尾巴，避免误伤 `gpt-4o-mini`、`text-embedding-3-large`
# 等本身就含数字的模型名。新增正则需同步补单测覆盖。
_DATE_SUFFIX_REGEXES: tuple[re.Pattern[str], ...] = (
    re.compile(r"-\d{4}-\d{2}-\d{2}$"),  # 2025-08-07 风格（OpenAI gpt-5-mini-2025-08-07）
    re.compile(r"-\d{8}$"),  # 20241022 风格（Anthropic claude-3-5-sonnet-20241022）
)

# 显式别名映射（`alias → canonical`）。起步只放最确定的一两条；新增映射
# **必须**同步补 `tests/unit_tests/config/test_model_names.py` 单测。
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
    ("text-embedding-", "openai"),  # OpenAI text-embedding-3-*；Gemini 同名必须走前缀
    ("claude-", "anthropic"),
    ("gemini-", "gemini"),
    ("llama-", "meta"),
    ("codestral-", "mistral"),
    ("mixtral-", "mistral"),
    ("mistral-", "mistral"),
    ("command-", "cohere"),
    ("deepseek-", "deepseek"),
)


def _strip_vendor_prefix(name: str) -> str:
    """剥外层 vendor 前缀（仅一次），大小写不敏感。未命中则返回原串。"""
    lowered = name.lower()
    for prefix in _VENDOR_PREFIXES:
        if lowered.startswith(prefix):
            return name[len(prefix) :]
    return name


def _strip_date_suffix(name: str) -> str:
    """剥日期/版本后缀（白名单正则）。锚到 `$`，剥完不再匹配，幂等。"""
    for pattern in _DATE_SUFFIX_REGEXES:
        if pattern.search(name):
            return pattern.sub("", name)
    return name


def observability_model_name(model_name: str | None) -> str | None:
    """返回**仅供观测上报**的裸模型名（剥 vendor 前缀 + 剥日期后缀 + 别名映射）。

    四步幂等管线：
    1. ``strip()`` 空白；空 / None 透传。
    2. 剥 ``vendor/`` 前缀（最外层一次，大小写不敏感）。
    3. 剥日期/版本后缀（白名单正则，避免误伤 ``gpt-4o-mini``）。
    4. 显式别名映射兜底。

    幂等保证：步骤 2 之后无 ``/``、步骤 3 之后无匹配尾、步骤 4 字典查表 fixpoint，
    重复调用结果不变。**禁止**在 LiteLLM 调度路径使用本函数（会破坏供应商路由）。
    """
    if not model_name:
        return model_name

    normalized = model_name.strip()
    if not normalized:
        return model_name

    normalized = _strip_vendor_prefix(normalized)
    normalized = _strip_date_suffix(normalized)
    normalized = _MODEL_ALIASES.get(normalized, normalized)
    return normalized


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

    lowered = normalized.lower()

    # 1. 显式 vendor/ 前缀
    for prefix in _VENDOR_PREFIXES:
        if lowered.startswith(prefix):
            return prefix.rstrip("/")

    # 2. 系族前缀回退（用裸名形式判断，避免一次错误 strip 影响后续）
    bare = _strip_vendor_prefix(normalized).lower()
    for family_prefix, vendor in _VENDOR_FAMILY_PREFIXES:
        if bare.startswith(family_prefix):
            return vendor

    return None
