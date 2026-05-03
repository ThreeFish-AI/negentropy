"""按 ``settings.memory.pii.engine`` 实例化 PIIDetectorBase（线程级单例）。"""

from __future__ import annotations

import threading

from negentropy.logging import get_logger

from .base import PIIDetectorBase
from .regex_detector import RegexPIIDetector

logger = get_logger("negentropy.engine.governance.pii.factory")

_lock = threading.Lock()
_singleton: PIIDetectorBase | None = None
_singleton_engine: str | None = None


def _build_detector() -> PIIDetectorBase:
    try:
        from negentropy.config import settings as global_settings

        cfg = global_settings.memory.pii
    except Exception as exc:
        logger.debug("pii_settings_load_failed_use_regex", error=str(exc))
        return RegexPIIDetector()

    engine = (cfg.engine or "regex").strip().lower()
    if engine == "regex":
        return RegexPIIDetector()
    if engine == "presidio":
        try:
            from .presidio_detector import PresidioPIIDetector

            return PresidioPIIDetector(
                languages=list(cfg.languages),
                score_threshold=cfg.score_threshold,
            )
        except Exception as exc:
            logger.warning(
                "presidio_init_failed_fallback_regex",
                error=str(exc),
                hint="run `uv sync --extra pii-presidio` to install Presidio",
            )
            return RegexPIIDetector()

    logger.warning("pii_engine_unknown_use_regex", engine=engine)
    return RegexPIIDetector()


def get_pii_detector() -> PIIDetectorBase:
    """返回当前生效的 PII 检测器（线程级单例）。"""
    global _singleton, _singleton_engine
    if _singleton is not None:
        return _singleton
    with _lock:
        if _singleton is None:
            detector = _build_detector()
            _singleton = detector
            _singleton_engine = detector.name
            logger.debug("pii_detector_initialized", engine=_singleton_engine)
        return _singleton


def reset_pii_detector() -> None:
    """清空单例（测试用）。"""
    global _singleton, _singleton_engine
    with _lock:
        _singleton = None
        _singleton_engine = None


__all__ = ["get_pii_detector", "reset_pii_detector"]
