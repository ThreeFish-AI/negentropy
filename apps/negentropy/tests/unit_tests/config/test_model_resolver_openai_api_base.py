"""单元测试：normalize_api_base_for_litellm 针对 OpenAI api_base 的归一化规则。

覆盖 litellm 1.83.x 对 `openai/*` 将用户 `api_base` 原样作为 `AsyncOpenAI(base_url=...)`，
而 OpenAI Python SDK 仅以相对路径 `chat/completions` 拼接最终 URL 的上游行为缺陷。
若用户按官网 placeholder 填入裸 host（如 `http://llms.as-in.io`），请求将落到缺失 `/v1`
版本段的根路径，自建网关以 catchall 429 响应，反向伪装成「供应商限流」。
"""

from negentropy.config.model_resolver import normalize_api_base_for_litellm


def test_openai_none_passthrough():
    assert normalize_api_base_for_litellm("openai/gpt-4o-mini", None) is None


def test_openai_empty_returns_none():
    assert normalize_api_base_for_litellm("openai/gpt-4o-mini", "") is None
    assert normalize_api_base_for_litellm("openai/gpt-4o-mini", "   ") is None


def test_openai_official_host_bare_maps_to_none():
    # 裸官方域名 → 返回 None，让 litellm 走内置默认 URL（含 /v1）
    assert normalize_api_base_for_litellm("openai/gpt-4o-mini", "https://api.openai.com") is None


def test_openai_official_host_with_v1_maps_to_none():
    # 官方域名 + /v1 → 返回 None，与裸 host 等价（均放行 litellm 内置 URL，消除配置分叉）
    assert normalize_api_base_for_litellm("openai/gpt-4o-mini", "https://api.openai.com/v1") is None


def test_openai_official_host_trailing_slash_maps_to_none():
    assert normalize_api_base_for_litellm("openai/gpt-4o-mini", "https://api.openai.com/v1/") is None


def test_openai_custom_gateway_appends_v1():
    # 核心回归：自建网关补齐 /v1，抵消 SDK 仅拼 /chat/completions 的缺陷
    assert normalize_api_base_for_litellm("openai/gpt-4o-mini", "http://llms.as-in.io") == "http://llms.as-in.io/v1"


def test_openai_custom_gateway_with_v1_unchanged():
    assert normalize_api_base_for_litellm("openai/gpt-4o-mini", "https://my-gateway/v1") == "https://my-gateway/v1"


def test_openai_custom_gateway_with_v1_slash_stripped():
    assert normalize_api_base_for_litellm("openai/gpt-4o-mini", "https://my-gateway/v1/") == "https://my-gateway/v1"


def test_openai_full_curl_path_mispaste():
    # 用户误粘 `https://gateway/v1/chat/completions` → 剥离后补齐为 /v1
    assert (
        normalize_api_base_for_litellm("openai/gpt-4o-mini", "https://gateway/v1/chat/completions")
        == "https://gateway/v1"
    )


def test_openai_rootlevel_chat_completions_mispaste():
    # 根路径 /chat/completions 误粘 → 剥离后补齐 /v1
    assert (
        normalize_api_base_for_litellm("openai/gpt-4o-mini", "https://gateway/chat/completions") == "https://gateway/v1"
    )


def test_openai_embeddings_endpoint_mispaste():
    assert normalize_api_base_for_litellm("openai/gpt-4o-mini", "https://gateway/v1/embeddings") == "https://gateway/v1"


def test_openai_responses_endpoint_mispaste():
    assert normalize_api_base_for_litellm("openai/gpt-4o-mini", "https://gateway/v1/responses") == "https://gateway/v1"


def test_openai_mid_url_v1_preserved():
    # 多租户代理常见路径 `/openai/v1` 已显式带 /v1 结尾 → 恒等透传
    assert (
        normalize_api_base_for_litellm("openai/gpt-4o-mini", "https://gateway/openai/v1") == "https://gateway/openai/v1"
    )


def test_openai_nested_v1_path_preserved():
    # URL 中段含 /v1/（如 https://gateway/v1/custom）→ 恒等透传，避免双重 /v1
    assert (
        normalize_api_base_for_litellm("openai/gpt-4o-mini", "https://gateway/v1/custom") == "https://gateway/v1/custom"
    )


def test_openai_port_preserved():
    # 端口在 /v1 补齐时正确保留
    assert (
        normalize_api_base_for_litellm("openai/gpt-4o-mini", "http://llms.as-in.io:8080")
        == "http://llms.as-in.io:8080/v1"
    )


def test_openai_embedding_model_also_normalized():
    # embedding 链路复用同一规则
    assert (
        normalize_api_base_for_litellm("openai/text-embedding-3-small", "http://llms.as-in.io")
        == "http://llms.as-in.io/v1"
    )


def test_openai_prefix_collision_safe():
    # `text-completion-openai/*` 非 openai/ 前缀 → 不触发 OpenAI 分支，恒等清洗
    assert normalize_api_base_for_litellm("text-completion-openai/davinci-002", "http://gateway") == "http://gateway"
