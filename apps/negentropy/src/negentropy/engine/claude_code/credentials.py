"""Claude Code 子进程凭证解析 —— 让 headless 调用出示「真实 Anthropic 凭证」。

## 为什么需要它

Routine 引擎运行在 detached 后台进程（``negentropy serve``，无 TTY / GUI）内，
通过 ``ClaudeCodeService`` 以子进程方式拉起 ``claude`` CLI。该子进程过去未注入任何
Anthropic 凭证：当环境缺 ``ANTHROPIC_API_KEY`` / ``ANTHROPIC_AUTH_TOKEN`` 时，Claude Code
会回退去读 macOS Keychain 的交互式登录态（claude.ai OAuth）—— 后台进程拿不到该登录态，
于是向 coding-proxy 出示了无效/缺失凭证。代理主 tier（zhipu/GLM）忽略客户端鉴权用自己的
key（故正常，仅偶发 529 过载）；529 触发 failover 到「透明转发客户端鉴权」的 anthropic
tier，把无效凭证原样转发给 ``api.anthropic.com`` → 401。

本模块把「真实 Anthropic 凭证」从单一事实源解析出来，由 ``ClaudeCodeService`` 注入子进程
环境变量（见 ``service._build_subprocess_env``），使 failover 鉴权成功、且与交互式登录态解耦。

## 凭证来源优先级（单一事实源 + 运维兜底）

1. **Interface / Tools UI**：``builtin_tools.claude_code.credentials`` 的 ``oauth_token`` /
   ``api_key`` 字段（入库、UI 脱敏、热轮换免重启）。脱敏占位值（含 ``****``）视为「未配置」。
2. **环境变量兜底**：``CLAUDE_CODE_OAUTH_TOKEN``；或 ``ANTHROPIC_API_KEY``（仅当为 Console API Key
   ``sk-ant-api…`` 前缀，避免误用 AfterShip 32 位网关 key 或 ``sk-ant-oat…`` 订阅令牌）。
3. 均无 → ``None``：不注入，保持既有行为（继承环境 / 交互式登录态），不破坏开发与终端场景。

凭证类型与注入头（见 ``service._credential_env``）：``sk-ant-api…`` Console Key → ``x-api-key``；
其它（``sk-ant-oat…`` 订阅 OAuth 令牌等）→ ``Authorization: Bearer``。

凭证为敏感数据，**绝不写入日志**（调用方亦不得记录返回值）。
"""

from __future__ import annotations

import os

# 与 ``interface/api.py::_mask_credentials`` 产生的脱敏占位保持一致的判定语义：
# 脱敏值形如 "abcd****wxyz" 或 "****"，一律含此标记。
_MASK_MARKER = "****"

# Anthropic Console API Key 前缀（``sk-ant-api…``，pay-per-token，console.anthropic.com 签发）。
# 注意：``setup-token`` 生成的 claude.ai 订阅 OAuth 令牌前缀为 ``sk-ant-oat…``，二者认证机制不同——
#   - Console API Key → ``x-api-key`` 头（``ANTHROPIC_API_KEY``）；
#   - OAuth 订阅令牌  → ``Authorization: Bearer`` 头（``ANTHROPIC_AUTH_TOKEN``）。
# 故判别须用 ``sk-ant-api`` 精确前缀，不能用 ``sk-ant-`` 笼统前缀（后者会把 OAuth 令牌误判为 API Key）。
# AfterShip 网关 key（32 位 hex，如 ``0f12ec0…``）不带任何 ``sk-ant-`` 前缀，亦被排除。
_ANTHROPIC_API_KEY_PREFIX = "sk-ant-api"


def is_console_api_key(value: str | None) -> bool:
    """判断凭证是否为 Anthropic Console API Key（``sk-ant-api…``，走 ``x-api-key``）。

    非此前缀者（含 ``sk-ant-oat…`` OAuth 订阅令牌、网关 key 等）一律按 Bearer 令牌处理。
    """
    return bool(value) and value.startswith(_ANTHROPIC_API_KEY_PREFIX)


def _is_masked(value: str) -> bool:
    """判断是否为 ``_mask_credentials`` 产生的脱敏占位值（含 ``****``）。"""
    return _MASK_MARKER in value


def resolve_claude_code_credential(credentials: dict | None) -> str | None:
    """解析注入 Claude Code 子进程的真实 Anthropic 凭证。

    Args:
        credentials: ``builtin_tools.claude_code.credentials`` 字典（可为 ``None``）。
            识别 ``oauth_token``（claude.ai 订阅令牌，``sk-ant-oat…``，注入为 Bearer）与
            ``api_key``（Console API Key，``sk-ant-api…``，注入为 x-api-key）。注入头由
            ``is_console_api_key`` 按前缀判别，与本函数读取的字段名无关。

    Returns:
        去除首尾空白的凭证字符串；无任何可用来源时返回 ``None``。脱敏占位值按「未配置」处理。
    """
    if credentials:
        for key in ("oauth_token", "api_key"):
            tok = credentials.get(key)
            if isinstance(tok, str):
                tok = tok.strip()
                if tok and not _is_masked(tok):
                    return tok

    env_token = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN", "").strip()
    if env_token:
        return env_token

    env_api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if env_api_key.startswith(_ANTHROPIC_API_KEY_PREFIX):
        return env_api_key

    return None
