"""PresidioPIIDetector — Microsoft Presidio 适配器（可选依赖）。

只有在 ``uv sync --extra pii-presidio`` 安装了 ``presidio-analyzer`` +
``presidio-anonymizer`` + spaCy 模型后才能成功实例化。导入失败时由
``factory.get_pii_detector`` 自动 fallback 到 RegexPIIDetector，并写一条 WARNING。

设计取舍：
- 在 ``__init__`` 中懒加载（避免模块顶部 import 触发 200MB+ spaCy 模型）；
- 中文/英文双语 analyzer 单例；首次调用之外的请求复用同一实例；
- 自定义 ``PatternRecognizer`` 补强中文身份证/手机号/银行卡（Presidio 默认未含）。
"""

from __future__ import annotations

from typing import Any

from negentropy.logging import get_logger

from .base import PIIDetectorBase, PIISpan
from .regex_detector import RegexPIIDetector, luhn_check

logger = get_logger("negentropy.engine.governance.pii.presidio")


class PresidioImportError(ImportError):
    """Presidio 库未安装的特定错误，便于 factory 选择性兜底。"""


def _try_import() -> tuple[Any, Any, Any]:
    """尝试导入 presidio_analyzer + Pattern + PatternRecognizer。"""
    try:
        from presidio_analyzer import AnalyzerEngine, Pattern, PatternRecognizer
    except ImportError as exc:  # pragma: no cover - 仅在未装 extras 时触发
        raise PresidioImportError("presidio-analyzer not installed; run `uv sync --extra pii-presidio`") from exc
    return AnalyzerEngine, Pattern, PatternRecognizer


class PresidioPIIDetector(PIIDetectorBase):
    """Presidio 引擎；首次实例化触发模型加载。"""

    name = "presidio"

    def __init__(
        self,
        *,
        languages: list[str] | None = None,
        score_threshold: float = 0.6,
    ) -> None:
        AnalyzerEngine, Pattern, PatternRecognizer = _try_import()
        self._languages = languages or ["en", "zh"]
        self._score_threshold = score_threshold

        recognizers: list[Any] = []
        # 中国大陆身份证（18 位）
        recognizers.append(
            PatternRecognizer(
                supported_entity="CN_ID_CARD",
                name="cn_id_card",
                supported_language="zh",
                patterns=[
                    Pattern(name="cn_id_card_18", regex=r"(?<!\d)\d{17}[\dXx](?!\d)", score=0.85),
                ],
            )
        )
        # 中国大陆手机号
        recognizers.append(
            PatternRecognizer(
                supported_entity="CN_MOBILE",
                name="cn_mobile",
                supported_language="zh",
                patterns=[
                    Pattern(name="cn_mobile_11", regex=r"(?<!\d)1[3-9]\d{9}(?!\d)", score=0.8),
                ],
            )
        )

        try:
            self._engine = AnalyzerEngine(supported_languages=self._languages)
            for r in recognizers:
                try:
                    self._engine.registry.add_recognizer(r)
                except Exception as exc:
                    logger.debug("presidio_recognizer_skip", name=r.name, error=str(exc))
        except Exception as exc:
            raise PresidioImportError(f"Presidio AnalyzerEngine init failed: {exc}") from exc

    def detect(self, text: str, *, languages: list[str] | None = None) -> list[PIISpan]:
        if not text:
            return []
        languages = languages or self._languages
        spans: list[PIISpan] = []
        for lang in languages:
            try:
                results = self._engine.analyze(text=text, language=lang, score_threshold=self._score_threshold)
            except Exception as exc:
                logger.debug("presidio_analyze_failed", lang=lang, error=str(exc))
                continue
            for r in results:
                pii_type = self._map_entity(r.entity_type)
                if pii_type == "credit_card":
                    if not luhn_check(text[r.start : r.end]):
                        continue
                spans.append(
                    PIISpan(
                        pii_type=pii_type,
                        start=r.start,
                        end=r.end,
                        score=float(r.score),
                        text=text[r.start : r.end],
                    )
                )
        # 去重：按 (start, end) 保留首条
        deduped: dict[tuple[int, int], PIISpan] = {}
        for s in spans:
            deduped.setdefault((s.start, s.end), s)
        result = sorted(deduped.values(), key=lambda s: s.start)
        # Luhn 增强：兜底 regex 中可能命中但 Presidio 漏掉的 credit_card。
        # Review fix：regex 命中固定 score=0.99；若操作员把 score_threshold
        # 调到 > 0.99（如 1.0 抑制弱命中），增强结果也必须被过滤掉，否则
        # 会绕过阈值产生未授权透传。
        for r in RegexPIIDetector().detect(text):
            if r.pii_type != "credit_card":
                continue
            if (r.start, r.end) in deduped:
                continue
            if r.score < self._score_threshold:
                continue
            result.append(r)
        result.sort(key=lambda s: s.start)
        return result

    @staticmethod
    def _map_entity(entity_type: str) -> str:
        """将 Presidio 实体类型映射到本项目 PII 命名空间。"""
        mapping = {
            "EMAIL_ADDRESS": "email",
            "PHONE_NUMBER": "phone",
            "CN_MOBILE": "phone",
            "CN_ID_CARD": "id_card",
            "CREDIT_CARD": "credit_card",
            "PERSON": "person",
            "LOCATION": "location",
            "DATE_TIME": "date_time",
            "IP_ADDRESS": "ip_address",
            "URL": "url",
        }
        return mapping.get(entity_type, entity_type.lower())


__all__ = ["PresidioPIIDetector", "PresidioImportError"]
