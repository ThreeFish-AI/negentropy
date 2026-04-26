"""单元测试：normalize_api_base_for_litellm 针对 Gemini api_base 的归一化规则。

覆盖 litellm 1.83.x `_check_custom_proxy` 对 Gemini provider 在 api_base 非空时
会拼出缺失 `/v1beta/` 的 URL 这一上游缺陷的补偿逻辑。
"""

from negentropy.config.model_resolver import normalize_api_base_for_litellm


def test_none_passthrough():
    assert normalize_api_base_for_litellm("gemini/gemini-2.5-flash", None) is None


def test_empty_string_returns_none():
    assert normalize_api_base_for_litellm("gemini/gemini-2.5-flash", "") is None
    assert normalize_api_base_for_litellm("gemini/gemini-2.5-flash", "   ") is None


def test_non_gemini_model_identity_passthrough():
    # Anthropic 等非 gemini/ 非 openai/ 前缀模型不应被改写（恒等清洗）
    # OpenAI 分支用例已迁移至 test_model_resolver_openai_api_base.py
    assert normalize_api_base_for_litellm("anthropic/claude-sonnet-4", "https://proxy.local") == "https://proxy.local"


def test_non_gemini_still_strips_trailing_slash():
    # 非 gemini/ 非 openai/ 前缀仅做去尾斜杠清洗，不做版本段补齐
    assert normalize_api_base_for_litellm("anthropic/claude-sonnet-4", "https://proxy.local/") == "https://proxy.local"


def test_gemini_default_host_maps_to_none():
    # Google 官方默认域名 → 返回 None，让 litellm 走内置默认 URL（含 /v1beta/）
    assert (
        normalize_api_base_for_litellm("gemini/gemini-2.5-flash", "https://generativelanguage.googleapis.com") is None
    )


def test_gemini_default_host_with_trailing_slash_maps_to_none():
    assert (
        normalize_api_base_for_litellm("gemini/gemini-2.5-flash", "https://generativelanguage.googleapis.com/") is None
    )


def test_gemini_default_host_with_curl_path_suffix_maps_to_none():
    # 用户误粘 curl 完整路径时被动清洗，归一后等价于 None
    assert (
        normalize_api_base_for_litellm(
            "gemini/gemini-2.5-flash",
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        )
        is None
    )


def test_gemini_default_host_with_v1beta_suffix_maps_to_none():
    assert (
        normalize_api_base_for_litellm(
            "gemini/gemini-2.5-flash",
            "https://generativelanguage.googleapis.com/v1beta",
        )
        is None
    )


def test_gemini_custom_proxy_gets_v1beta_appended():
    # 自建代理 / 私有网关：补齐 /v1beta，抵消 litellm 的 URL 拼接偏差
    assert (
        normalize_api_base_for_litellm("gemini/gemini-2.5-flash", "https://my-gateway.local")
        == "https://my-gateway.local/v1beta"
    )


def test_gemini_custom_proxy_already_has_v1beta():
    # 已经手动带了 /v1beta 则不重复追加
    assert (
        normalize_api_base_for_litellm("gemini/gemini-2.5-flash", "https://my-gateway.local/v1beta")
        == "https://my-gateway.local/v1beta"
    )


def test_gemini_embedding_model_also_normalized():
    # 同一规则覆盖 gemini 的 embedding 链路
    assert (
        normalize_api_base_for_litellm("gemini/text-embedding-004", "https://generativelanguage.googleapis.com") is None
    )
