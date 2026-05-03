"""PIIGatekeeper — 检索路径的 PII 守门员。

按用户角色 + ``settings.memory.pii.retrieval`` 决定 Memory content 展现形态：
- 高权限（>= acl_role_threshold）：原文返回；
- 低权限：依据 ``low_priv_policy`` 对原文做 mask / anonymize。

设计取舍：
- 仅依赖 ``Memory.content`` + ``metadata.pii_spans``（写入时若被 RegexPIIDetector
  / PresidioPIIDetector 命中，会落库该字段）；
- 老记忆无 ``pii_spans`` 字段时直接放行；
- 角色比较使用预定义的 viewer < editor < admin 序值表。
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from negentropy.logging import get_logger

from .base import PIISpan, apply_policy

logger = get_logger("negentropy.engine.governance.pii.gatekeeper")

_ROLE_RANK = {"viewer": 1, "editor": 2, "admin": 3}


def _rank(role: str | None) -> int:
    if not role:
        return 0
    return _ROLE_RANK.get(role.strip().lower(), 0)


class PIIGatekeeper:
    """检索结果出口处的 PII 守门员。"""

    def __init__(
        self,
        *,
        enabled: bool = False,
        acl_role_threshold: str = "editor",
        low_priv_policy: str = "anonymize",
    ) -> None:
        self._enabled = enabled
        self._threshold_rank = _rank(acl_role_threshold) or 2
        if low_priv_policy not in ("mark", "mask", "anonymize"):
            raise ValueError(f"Invalid low_priv_policy: {low_priv_policy!r}")
        self._policy = low_priv_policy

    @classmethod
    def from_settings(cls) -> PIIGatekeeper:
        try:
            from negentropy.config import settings as global_settings

            cfg = global_settings.memory.pii
            # ``cfg.policy`` 是写入路径策略；用 "mark" 作为低权限检索遮蔽
            # 等于不遮蔽，与 Gatekeeper 目标矛盾。优先读独立的
            # ``retrieval_policy``，缺省时把 "mark" 兜底改写为 "anonymize"。
            retrieval_policy = getattr(cfg, "retrieval_policy", None)
            if isinstance(retrieval_policy, str) and retrieval_policy in ("mark", "mask", "anonymize"):
                policy = retrieval_policy
            else:
                policy = getattr(cfg, "policy", "anonymize") or "anonymize"
            if policy == "mark":
                policy = "anonymize"
            return cls(
                enabled=bool(getattr(cfg, "gatekeeper_enabled", False)),
                acl_role_threshold=getattr(cfg, "acl_role_threshold", "editor"),
                low_priv_policy=policy,
            )
        except Exception as exc:
            logger.debug("pii_gatekeeper_settings_load_failed", error=str(exc))
            return cls(enabled=False)

    def should_redact(self, *, role: str | None) -> bool:
        if not self._enabled:
            return False
        return _rank(role) < self._threshold_rank

    def filter_records(
        self,
        records: Iterable[dict[str, Any]],
        *,
        role: str | None,
    ) -> list[dict[str, Any]]:
        """按角色过滤每条 record。

        每条 record 至少应有 ``content``；可选 ``metadata`` / ``metadata.pii_spans``。
        高权限或未启用时原样透传；低权限时按策略改写 ``content``，并在 metadata
        中加 ``pii_redacted=True`` 标志。
        """
        if not self.should_redact(role=role):
            return list(records)

        filtered: list[dict[str, Any]] = []
        for r in records:
            content = r.get("content") or ""
            metadata = dict(r.get("metadata") or {})
            spans_raw = metadata.get("pii_spans")
            if not spans_raw:
                filtered.append(r)
                continue

            spans: list[PIISpan] = []
            for s in spans_raw:
                try:
                    spans.append(
                        PIISpan(
                            pii_type=str(s.get("type") or s.get("pii_type") or "unknown"),
                            start=int(s.get("start", 0)),
                            end=int(s.get("end", 0)),
                            score=float(s.get("score", 0.99)),
                            text=str(s.get("text") or content[int(s.get("start", 0)) : int(s.get("end", 0))]),
                        )
                    )
                except Exception:
                    continue
            if not spans:
                filtered.append(r)
                continue

            redacted = apply_policy(content, spans, policy=self._policy)
            new_record = dict(r)
            new_record["content"] = redacted
            new_record_metadata = dict(metadata)
            new_record_metadata["pii_redacted"] = True
            new_record_metadata["pii_redaction_policy"] = self._policy
            new_record["metadata"] = new_record_metadata
            filtered.append(new_record)
        return filtered


__all__ = ["PIIGatekeeper"]
