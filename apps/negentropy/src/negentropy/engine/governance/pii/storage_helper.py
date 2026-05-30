"""写入路径 PII 检测助手 —— 经工厂选择的引擎检测，产出可落库的 flags + spans。

设计动机（修复预存缺陷 ISSUE-099）：
    Memory 写入路径（``memory_service`` 的 ``_simple_consolidate`` / ``add_memory_typed``）
    原先硬编码调用 legacy ``pii_detector.detect``（仅 RegexPIIDetector），完全绕过
    ``settings.memory.pii.engine`` 工厂选择，使 Presidio 引擎成为热路径死代码；且只落
    ``metadata.pii_flags``（计数），不落 ``pii_spans``，导致检索侧 ``PIIGatekeeper``
    （依赖 spans 才能 mask/anonymize）即使启用也无数据可遮蔽。

    本助手统一经 ``get_pii_detector()`` 检测，同时产出：
    - ``flags``: ``{pii_type: count}``（兼容既有 metadata.pii_flags 语义）
    - ``spans``: ``[{type,start,end,score,text}]``（供 PIIGatekeeper 检索遮蔽）

容错：检测器初始化或运行抛错时返回空结果而非中断写入主链路（保密性降级有日志，
不阻断记忆持久化）。``allow_engine_fallback`` 语义由工厂层面负责。
"""

from __future__ import annotations

from typing import Any

from negentropy.logging import get_logger

from .base import PIISpan, summarize_pii_flags
from .factory import get_pii_detector

logger = get_logger("negentropy.engine.governance.pii.storage_helper")


def _spans_to_json(spans: list[PIISpan]) -> list[dict[str, Any]]:
    """把 PIISpan 序列化为可落 JSONB 的 dict 列表（PIIGatekeeper 可逆读取）。"""
    return [
        {
            "type": s.pii_type,
            "start": s.start,
            "end": s.end,
            "score": round(float(s.score), 4),
            # 仅保留命中片段用于检索侧遮蔽；不额外存储其它上下文，控制 PII 暴露面。
            "text": s.text,
        }
        for s in spans
    ]


def detect_pii_for_storage(content: str) -> tuple[dict[str, int], list[dict[str, Any]]]:
    """对内容做 PII 检测，返回 ``(flags, spans_json)``。

    经 ``settings.memory.pii.engine`` 选定的引擎（regex / presidio）执行；
    任何异常降级为空结果并记 WARNING，绝不中断写入。
    """
    if not content:
        return {}, []
    try:
        detector = get_pii_detector()
        spans = detector.detect(content)
    except Exception as exc:
        # 工厂在 allow_engine_fallback=False + presidio 缺失时会抛 PIIEngineUnavailableError；
        # 写入路径不应因 PII 引擎不可用而丢记忆，这里降级为「无标记」并告警。
        logger.warning("pii_detect_for_storage_failed_skip", error=str(exc))
        return {}, []

    if not spans:
        return {}, []
    return summarize_pii_flags(spans), _spans_to_json(spans)


__all__ = ["detect_pii_for_storage"]
