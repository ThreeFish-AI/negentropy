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
2. **环境变量兜底**：``CLAUDE_CODE_OAUTH_TOKEN``；或 ``ANTHROPIC_API_KEY``（仅当为真实
   ``sk-ant-`` 前缀，避免误用 AfterShip 32 位网关 key）。
3. 均无 → ``None``：不注入，保持既有行为（继承环境 / 交互式登录态），不破坏开发与终端场景。

凭证为敏感数据，**绝不写入日志**（调用方亦不得记录返回值）。
"""

from __future__ import annotations

import os

# 与 ``interface/api.py::_mask_credentials`` 产生的脱敏占位保持一致的判定语义：
# 脱敏值形如 "abcd****wxyz" 或 "****"，一律含此标记。
_MASK_MARKER = "****"

# 真实 Anthropic API Key 前缀。AfterShip 网关 key（32 位 hex，如 ``0f12ec0…``）不带此前缀，
# 用作 ``x-api-key`` 会被根 ``/v1/messages`` failover anthropic tier 转发后 401，故须排除。
_ANTHROPIC_API_KEY_PREFIX = "sk-ant-"


def _is_masked(value: str) -> bool:
    """判断是否为 ``_mask_credentials`` 产生的脱敏占位值（含 ``****``）。"""
    return _MASK_MARKER in value


def resolve_claude_code_credential(credentials: dict | None) -> str | None:
    """解析注入 Claude Code 子进程的真实 Anthropic 凭证。

    Args:
        credentials: ``builtin_tools.claude_code.credentials`` 字典（可为 ``None``）。
            识别 ``oauth_token``（订阅长期令牌，Bearer）与 ``api_key``（``sk-ant-`` API Key）。

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
