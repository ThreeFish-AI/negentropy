"""Wiki 静态站点重建触发器。

publish / unpublish 完成后，后端通过本模块向「wiki 内容导出 + 重建」CI 触发端点
发起 POST 通知，驱动：

  1. CI 运行 ``export_wiki_content.py`` 重新生成静态内容包；
  2. 把内容包提交到 ``apps/negentropy-wiki/content/`` 并 push；
  3. push 触发 wiki 静态重建 + 重新部署。

wiki 纯静态化后不再有运行时 ISR，内容新鲜度由「重建」取代「revalidate」。
触发端点可配置为 GitHub ``repository_dispatch``（经 token 鉴权）或任意 webhook
接收器（经共享 HMAC secret 鉴权）。

设计要点（与历史 ``revalidate.py`` 同构）：
  - **不阻塞主链路**：webhook 异常仅 WARN，不向上抛出 → publish 接口 200 不受影响。
  - **签名校验**：可选 HMAC-SHA256（``X-Negentropy-Signature: sha256=...``），
    与接收端共享 secret；未配置 secret 则跳过签名头。
  - **去依赖**：仅依赖标准库 ``hmac`` / ``hashlib`` + ``httpx``。
"""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any
from uuid import UUID

import httpx

from negentropy.config import settings
from negentropy.config.knowledge import WikiRedeploySettings
from negentropy.logging import get_logger

logger = get_logger(__name__.rsplit(".", 1)[0])


def _signature_header(secret: str, body: bytes) -> str:
    """返回 ``sha256=<hex>`` 形式的 HMAC 签名（与接收端共享格式）。"""
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def _get_cfg() -> WikiRedeploySettings:
    """获取当前生效的 wiki redeploy 配置；测试可 monkeypatch 本函数注入 stub。"""
    return settings.knowledge.wiki_redeploy


async def trigger_wiki_redeploy(
    *,
    publication_id: UUID,
    pub_slug: str,
    app_name: str,
    event: str,
) -> str:
    """通知 wiki 内容导出 + 重建流水线。

    Args:
        publication_id: 发布 ID（日志可追溯）。
        pub_slug: 站点路径前缀。
        app_name: 应用归属。
        event: ``publish`` / ``unpublish``。

    Returns:
        ``"dispatched"`` — 触发端点接收成功；
        ``"failed"`` — 调用失败（已记 WARN）；
        ``"not_configured"`` — 未配置触发 URL（等价被动，等下一次定时/手动重建）。
    """
    cfg = _get_cfg()
    if not cfg.url:
        return "not_configured"

    payload: dict[str, Any] = {
        "event": event,
        "event_type": cfg.event_type,
        "publication_id": str(publication_id),
        "pub_slug": pub_slug,
        "app_name": app_name,
    }
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    headers: dict[str, str] = {"content-type": "application/json"}
    if cfg.token is not None:
        token_value = cfg.token.get_secret_value()
        if token_value:
            headers["authorization"] = f"Bearer {token_value}"
    if cfg.secret is not None:
        secret_value = cfg.secret.get_secret_value()
        if secret_value:
            headers["x-negentropy-signature"] = _signature_header(secret_value, body)

    try:
        async with httpx.AsyncClient(timeout=cfg.timeout_seconds) as client:
            resp = await client.post(cfg.url, content=body, headers=headers)
        if resp.status_code >= 300:
            logger.warning(
                "wiki_redeploy_non_2xx",
                pub_id=str(publication_id),
                status=resp.status_code,
                wiki_event=event,
            )
            return "failed"
        logger.info(
            "wiki_redeploy_dispatched",
            pub_id=str(publication_id),
            wiki_event=event,
            status=resp.status_code,
        )
        return "dispatched"
    except Exception as exc:  # noqa: BLE001 - 主动吞噬：触发失败不阻塞发布
        logger.warning(
            "wiki_redeploy_failed",
            pub_id=str(publication_id),
            wiki_event=event,
            error=str(exc),
        )
        return "failed"
