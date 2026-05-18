"""S1: 合规检查 — robots.txt 解析与 URL 合法性校验。

使用标准库 ``urllib.robotparser.RobotFileParser`` 解析 robots.txt，
并通过 ``infra.URLValidator`` 校验 URL 格式。属于 WebPage Pipeline 的
第一道守门 Stage，在实际发起网络请求之前完成合规预检。
"""

from __future__ import annotations

import logging
from typing import Any, Dict
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

from ...base import StageResult
from ...models import StageContext
from ...registry import register_tool
from .._base import WebToolBase

logger = logging.getLogger(__name__)


@register_tool("robotparser")
class RobotParserTool(WebToolBase):
    """基于 ``urllib.robotparser`` 的 robots.txt 合规检查工具。"""

    tool_name = "robotparser"

    def is_available(self) -> bool:
        return True  # 纯标准库实现，始终可用

    async def _run(self, ctx: StageContext) -> StageResult[StageContext]:
        """执行合规检查。

        流程：
        1. 校验 URL 格式合法性
        2. 构造 robots.txt URL 并获取内容
        3. 解析 robots.txt 规则，判断是否允许抓取
        4. 将结果写入 ``ctx.metadata["robots_info"]``
        """
        url = ctx.url

        # ── Step 1: URL 格式校验 ──────────────────────────────────────
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return StageResult(
                success=False,
                error=f"URL 格式无效: {url}",
                engine_used=self.tool_name,
            )

        if parsed.scheme not in ("http", "https"):
            return StageResult(
                success=False,
                error=f"仅支持 http/https 协议，当前: {parsed.scheme}",
                engine_used=self.tool_name,
            )

        # ── Step 2: 构造 robots.txt URL ──────────────────────────────
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

        # ── Step 3: 获取并解析 robots.txt ─────────────────────────────
        is_allowed = True
        robots_content = ""
        fetch_error = None

        try:
            import aiohttp

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    robots_url, timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        robots_content = await resp.text()
                    else:
                        # robots.txt 不存在或无法访问，默认允许抓取
                        logger.info(
                            "robots.txt 返回状态码 %d，默认允许抓取: %s",
                            resp.status,
                            robots_url,
                        )
        except ImportError:
            # aiohttp 不可用时，回退到同步 requests
            try:
                import requests

                resp = requests.get(robots_url, timeout=10)  # type: ignore[assignment]
                if resp.status_code == 200:  # type: ignore[attr-defined]
                    robots_content = resp.text  # type: ignore[assignment]
            except Exception as e:
                fetch_error = str(e)
                logger.warning("获取 robots.txt 失败: %s", e)
        except Exception as e:
            fetch_error = str(e)
            logger.warning("获取 robots.txt 失败: %s", e)

        # 使用 RobotFileParser 解析
        if robots_content:
            rp = RobotFileParser()
            rp.parse(robots_content.splitlines())
            user_agent = ctx.config.get("user_agent", "*")
            is_allowed = rp.can_fetch(user_agent, url)

        # ── Step 4: 写入上下文 ────────────────────────────────────────
        robots_info: Dict[str, Any] = {
            "robots_url": robots_url,
            "is_allowed": is_allowed,
            "robots_content": robots_content[:2000] if robots_content else "",
            "fetch_error": fetch_error,
        }
        ctx.metadata["robots_info"] = robots_info
        ctx.metadata["compliance_passed"] = is_allowed

        if not is_allowed:
            return StageResult(
                success=False,
                output=ctx,
                error=f"robots.txt 禁止抓取: {url}",
                engine_used=self.tool_name,
            )

        return StageResult(
            success=True,
            output=ctx,
            engine_used=self.tool_name,
            metadata=robots_info,
        )


# Stage 本地工具映射
TOOLS: Dict[str, type] = {
    "robotparser": RobotParserTool,
}

STAGE_ID = "compliance_check"
STAGE_NAME = "合规检查"
