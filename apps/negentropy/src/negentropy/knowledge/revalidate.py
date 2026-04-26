"""Wiki SSG ISR 主动 revalidate 触发器。

publish / unpublish 完成后，后端通过本模块向 SSG ``/api/revalidate`` 端点
发起 POST 通知，SSG 立即对相应路径执行 ``revalidatePath`` / ``revalidateTag``，
让用户访问到的内容尽量新鲜（不必等 5 分钟 ISR 窗口）。

设计要点：

- **不阻塞主链路**：webhook 异常仅 WARN，不向上抛出 → publish 接口 200 不受影响。
- **签名校验**：可选 HMAC-SHA256（``X-Negentropy-Signature: sha256=...``），
  SSG 端通过共享 secret 校验请求来源。
- **去依赖**：仅依赖标准库 ``hmac`` / ``hashlib`` + ``httpx``，无重型 SDK。
"""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any
from uuid import UUID

import httpx

from negentropy.config import settings
from negentropy.config.knowledge import WikiRevalidateSettings
from negentropy.logging import get_logger

logger = get_logger(__name__.rsplit(".", 1)[0])


def _signature_header(secret: str, body: bytes) -> str:
    """返回 ``sha256=<hex>`` 形式的 HMAC 签名（与 SSG 路由共享格式）。"""
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def _get_cfg() -> WikiRevalidateSettings:
    """获取当前生效的 wiki revalidate 配置；测试可 monkeypatch 此函数注入 stub。

    包装为函数（而非直接读 settings 属性）的动机：``KnowledgeSettings`` frozen=True
    使得 ``monkeypatch.setattr(settings.knowledge, "wiki_revalidate", ...)`` 会触发
    pydantic FrozenInstanceError。通过函数边界，单测改写本函数指针即可隔离配置。
    """
    return settings.knowledge.wiki_revalidate


async def trigger_wiki_revalidate(
    *,
    publication_id: UUID,
    pub_slug: str,
    app_name: str,
    event: str,
) -> str:
    """向 SSG 通知 Wiki 发布变更，要求其立即 revalidate 相关路径。

    Args:
        publication_id: 发布 ID（用于日志可追溯）。
        pub_slug: 站点路径前缀（SSG 用于定位 ``revalidatePath('/'+pub_slug)``）。
        app_name: 应用归属（多租户 SSG 用于命名空间隔离）。
        event: ``publish`` / ``unpublish``（SSG 可据此选择 revalidatePath/Tag 策略）。

    Returns:
        ``"dispatched"`` — SSG 接收成功；
        ``"failed"`` — 调用失败（已记 WARN）；
        ``"not_configured"`` — 未配置 webhook URL。
    """
    cfg = _get_cfg()
    if not cfg.url:
        # 未配置：等价"被动 ISR"，发布主链路无需感知。
        return "not_configured"

    payload: dict[str, Any] = {
        "event": event,
        "publication_id": str(publication_id),
        "pub_slug": pub_slug,
        "app_name": app_name,
    }
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    headers = {"content-type": "application/json"}
    if cfg.secret is not None:
        secret_value = cfg.secret.get_secret_value()
        if secret_value:
            headers["x-negentropy-signature"] = _signature_header(secret_value, body)

    try:
        async with httpx.AsyncClient(timeout=cfg.timeout_seconds) as client:
            resp = await client.post(cfg.url, content=body, headers=headers)
        if resp.status_code >= 300:
            logger.warning(
                "wiki_revalidate_non_2xx",
                pub_id=str(publication_id),
                status=resp.status_code,
                wiki_event=event,
            )
            return "failed"
        logger.info(
            "wiki_revalidate_dispatched",
            pub_id=str(publication_id),
            wiki_event=event,
            status=resp.status_code,
        )
        return "dispatched"
    except Exception as exc:  # noqa: BLE001 - 主动吞噬：webhook 失败不阻塞发布
        logger.warning(
            "wiki_revalidate_failed",
            pub_id=str(publication_id),
            wiki_event=event,
            error=str(exc),
        )
        return "failed"
