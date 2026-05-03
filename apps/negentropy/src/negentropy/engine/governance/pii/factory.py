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


class PIIEngineUnavailableError(RuntimeError):
    """配置的 PII 引擎无法初始化且未授权降级；阻止以更弱引擎隐式启动。"""


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
            # Review fix：默认禁止静默降级。配置 engine='presidio' 时若依赖
            # 缺失，operator 会预期 PERSON / LOCATION / 多语言 NER；悄悄退回
            # regex（仅 4 类）会让保密性退化且无可观测信号。
            # 仅在显式置 ``allow_engine_fallback=True`` 时降级，并写 ERROR。
            allow_fallback = bool(getattr(cfg, "allow_engine_fallback", False))
            if not allow_fallback:
                logger.error(
                    "presidio_init_failed_no_fallback",
                    error=str(exc),
                    hint="install via `uv sync --extra pii-presidio`，"
                    "或显式设置 NE_MEMORY_PII__ALLOW_ENGINE_FALLBACK=true",
                )
                raise PIIEngineUnavailableError(
                    f"Presidio engine init failed and allow_engine_fallback is False: {exc}"
                ) from exc
            logger.error(
                "presidio_init_failed_fallback_regex",
                error=str(exc),
                hint="降级路径已启用 (allow_engine_fallback=True)；保密性等级实际为 regex",
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


__all__ = ["PIIEngineUnavailableError", "get_pii_detector", "reset_pii_detector"]
