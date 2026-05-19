"""LLM 客户端封装模块（基于 LiteLLM）。

当 ``litellm`` 可选依赖已安装时，提供对 OpenAI GPT 等大语言模型的
异步调用能力，用于 PDF 多引擎编排的分析与融合阶段。

降级策略：当 ``litellm`` 未安装时，``is_available()`` 返回 ``False``，
由上层 ``LLMOrchestrator`` 自动切换至默认编排计划。
"""

import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 数据类：标准化 LLM 输出
# ---------------------------------------------------------------------------


@dataclass
class LLMResponse:
    """LLM 调用结果的标准化数据结构。"""

    content: str
    model: str = ""
    usage: Dict[str, int] = field(default_factory=dict)
    raw_response: Any = None


# ---------------------------------------------------------------------------
# LLM 客户端
# ---------------------------------------------------------------------------


class LLMClient:
    """LiteLLM 客户端封装。

    特性：

    * 延迟导入 ``litellm``，不影响无 LLM 场景的启动性能
    * 支持异步调用（``acomplete``）
    * 结构化 JSON 输出解析（容忍 markdown 围栏）
    * 指数退避重试
    * 调用计时与错误分类
    """

    def __init__(
        self,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        api_base_url: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        timeout: float = 60.0,
        max_retries: int = 2,
    ) -> None:
        if model is None:
            from ...config import settings

            model = settings.llm_model
        self._model = model
        self._api_key = api_key
        self._api_base_url = api_base_url
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._timeout = timeout
        self._max_retries = max_retries

    # ------------------------------------------------------------------
    # 可用性检测
    # ------------------------------------------------------------------

    @staticmethod
    def is_available() -> bool:
        """检测 ``litellm`` 是否已安装且可用。"""
        try:
            import litellm  # noqa: F401

            return True
        except ImportError:
            return False

    # ------------------------------------------------------------------
    # 异步调用
    # ------------------------------------------------------------------

    async def acomplete(
        self,
        messages: List[Dict[str, str]],
        response_format: Optional[Dict[str, str]] = None,
    ) -> LLMResponse:
        """异步调用 LLM 并返回标准化结果。

        Args:
            messages: OpenAI 格式的消息列表。
            response_format: 可选的响应格式约束，如 ``{"type": "json_object"}``。

        Returns:
            ``LLMResponse`` 标准化结果。

        Raises:
            RuntimeError: ``litellm`` 未安装时抛出。
            Exception: 所有重试耗尽后抛出最后一次异常。
        """
        if not self.is_available():
            raise RuntimeError(
                "litellm 未安装，请安装 llm 可选依赖: "
                "uv pip install negentropy-perceives[llm]"
            )

        import litellm

        kwargs: Dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "temperature": self._temperature,
            "max_tokens": self._max_tokens,
            "timeout": self._timeout,
        }
        if self._api_key:
            kwargs["api_key"] = self._api_key
        if self._api_base_url:
            kwargs["api_base"] = self._api_base_url
        if response_format:
            kwargs["response_format"] = response_format

        last_error: Optional[Exception] = None
        for attempt in range(self._max_retries + 1):
            try:
                start = time.monotonic()
                response = await litellm.acompletion(**kwargs)
                elapsed = time.monotonic() - start

                content = response.choices[0].message.content or ""
                usage = {}
                if hasattr(response, "usage") and response.usage:
                    usage = {
                        "prompt_tokens": getattr(response.usage, "prompt_tokens", 0),
                        "completion_tokens": getattr(
                            response.usage, "completion_tokens", 0
                        ),
                    }

                logger.info(
                    "LLM 调用完成: model=%s, elapsed=%.2fs, tokens=%s",
                    self._model,
                    elapsed,
                    usage,
                )
                return LLMResponse(
                    content=content,
                    model=self._model,
                    usage=usage,
                    raw_response=response,
                )

            except Exception as e:
                last_error = e
                if attempt < self._max_retries:
                    delay = 1.0 * (2**attempt)
                    logger.warning(
                        "LLM 调用失败 (attempt %d/%d): %s, %.1fs 后重试",
                        attempt + 1,
                        self._max_retries + 1,
                        e,
                        delay,
                    )
                    import asyncio

                    await asyncio.sleep(delay)
                else:
                    logger.error("LLM 调用失败 (所有重试耗尽): %s", e)

        raise last_error  # type: ignore[misc]

    # ------------------------------------------------------------------
    # JSON 解析
    # ------------------------------------------------------------------

    @staticmethod
    def parse_json_response(response: LLMResponse) -> Dict[str, Any]:
        """安全解析 LLM 返回的 JSON 内容。

        支持去除 markdown 代码围栏（LLM 有时在 JSON 外包裹 ``json ... ``）。

        Args:
            response: LLM 调用结果。

        Returns:
            解析后的字典。如果解析失败，返回 ``{"error": "...", "raw": "..."}``。
        """
        content = response.content.strip()

        # 去除 markdown 代码围栏
        fence_pattern = re.compile(r"^```(?:json)?\s*\n?(.*?)\n?\s*```$", re.DOTALL)
        match = fence_pattern.match(content)
        if match:
            content = match.group(1).strip()

        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            logger.warning("LLM JSON 解析失败: %s, content=%s", e, content[:200])
            return {"error": str(e), "raw": content}
