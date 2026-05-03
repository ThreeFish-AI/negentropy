"""Phase 5 F4 — PIIDetectorBase / RegexPIIDetector / Gatekeeper / factory 单元测试。

不依赖 Presidio 库（presidio_detector 在导入失败时由 factory 自动 fallback）。
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from negentropy.engine.governance.pii import (
    PIIDetectorBase,
    PIIGatekeeper,
    PIISpan,
    RegexPIIDetector,
    apply_policy,
    get_pii_detector,
    reset_pii_detector,
)


def _make_settings(
    *, engine: str = "regex", policy: str = "mark", gatekeeper_enabled: bool = False, threshold: str = "editor"
):
    cfg = MagicMock()
    cfg.engine = engine
    cfg.policy = policy
    cfg.languages = ["en", "zh"]
    cfg.score_threshold = 0.6
    cfg.gatekeeper_enabled = gatekeeper_enabled
    cfg.acl_role_threshold = threshold
    settings = MagicMock()
    settings.memory.pii = cfg
    return settings


class TestRegexPIIDetector:
    def test_email_credit_card_id_card(self):
        d = RegexPIIDetector()
        spans = d.detect("alice@example.com pays with 4242 4242 4242 4242 ID 110101199003078117")
        types = sorted(s.pii_type for s in spans)
        assert "email" in types
        assert "credit_card" in types
        assert "id_card" in types

    def test_phone_cn_and_na(self):
        d = RegexPIIDetector()
        spans = d.detect("Call 13812345678 or +1 415-555-1234")
        types = [s.pii_type for s in spans]
        assert types.count("phone") >= 2

    def test_invalid_credit_card_filtered_by_luhn(self):
        d = RegexPIIDetector()
        spans = d.detect("Order id 12345678901234567 confirmed")
        assert not any(s.pii_type == "credit_card" for s in spans)

    def test_empty_returns_empty(self):
        assert RegexPIIDetector().detect("") == []

    def test_protocol_implementation(self):
        assert isinstance(RegexPIIDetector(), PIIDetectorBase)


class TestApplyPolicy:
    def _spans(self):
        return [
            PIISpan(pii_type="email", start=14, end=31, score=0.99, text="alice@example.com"),
        ]

    def test_mark_returns_original(self):
        text = "Contact me at alice@example.com please"
        out = apply_policy(text, self._spans(), policy="mark")
        assert out == text

    def test_mask_obscures_middle(self):
        text = "Contact me at alice@example.com please"
        out = apply_policy(text, self._spans(), policy="mask")
        assert "alice@example.com" not in out
        assert "*" in out

    def test_anonymize_replaces_with_placeholder(self):
        text = "Contact me at alice@example.com please"
        out = apply_policy(text, self._spans(), policy="anonymize")
        assert "<EMAIL>" in out
        assert "alice@example.com" not in out

    def test_invalid_policy_raises(self):
        with pytest.raises(ValueError):
            apply_policy("x", [], policy="bogus")

    def test_overlapping_spans_skipped(self):
        spans = [
            PIISpan(pii_type="email", start=0, end=10, score=0.9, text="0123456789"),
            PIISpan(pii_type="phone", start=5, end=15, score=0.9, text="5678901234"),
        ]
        # 重叠 span 应不会破坏文本
        out = apply_policy("0123456789ABCDE", spans, policy="anonymize")
        assert "<EMAIL>" in out


class TestFactory:
    def setup_method(self):
        reset_pii_detector()

    def teardown_method(self):
        reset_pii_detector()

    def test_default_returns_regex(self):
        with patch.dict("sys.modules", {"negentropy.config": MagicMock(settings=_make_settings(engine="regex"))}):
            d = get_pii_detector()
        assert d.name == "regex"
        assert isinstance(d, RegexPIIDetector)

    def test_unknown_engine_falls_back_regex(self):
        with patch.dict("sys.modules", {"negentropy.config": MagicMock(settings=_make_settings(engine="bogus"))}):
            d = get_pii_detector()
        assert d.name == "regex"

    def test_presidio_init_failure_falls_back_regex(self):
        # 拦截 presidio import 让其失败，确保 factory fallback
        from negentropy.engine.governance.pii import presidio_detector

        class _FakePresidio:
            def __init__(self, *args, **kwargs):
                raise RuntimeError("presidio not installed in this test env")

        with (
            patch.dict("sys.modules", {"negentropy.config": MagicMock(settings=_make_settings(engine="presidio"))}),
            patch.object(presidio_detector, "PresidioPIIDetector", _FakePresidio),
        ):
            d = get_pii_detector()
        assert d.name == "regex"


class TestGatekeeper:
    def _record_with_email_span(self):
        return {
            "id": "m1",
            "content": "alice@example.com is here",
            "metadata": {
                "pii_spans": [{"type": "email", "start": 0, "end": 17, "score": 0.99, "text": "alice@example.com"}]
            },
        }

    def test_disabled_returns_unchanged(self):
        gk = PIIGatekeeper(enabled=False)
        records = [self._record_with_email_span()]
        out = gk.filter_records(records, role="viewer")
        assert out[0]["content"] == "alice@example.com is here"
        assert "pii_redacted" not in (out[0].get("metadata") or {})

    def test_high_priv_admin_sees_raw(self):
        gk = PIIGatekeeper(enabled=True, acl_role_threshold="editor", low_priv_policy="anonymize")
        out = gk.filter_records([self._record_with_email_span()], role="admin")
        assert out[0]["content"] == "alice@example.com is here"
        assert not (out[0].get("metadata") or {}).get("pii_redacted")

    def test_low_priv_anonymized(self):
        gk = PIIGatekeeper(enabled=True, acl_role_threshold="editor", low_priv_policy="anonymize")
        out = gk.filter_records([self._record_with_email_span()], role="viewer")
        assert "<EMAIL>" in out[0]["content"]
        assert out[0]["metadata"]["pii_redacted"] is True
        assert out[0]["metadata"]["pii_redaction_policy"] == "anonymize"

    def test_low_priv_mask(self):
        gk = PIIGatekeeper(enabled=True, acl_role_threshold="editor", low_priv_policy="mask")
        out = gk.filter_records([self._record_with_email_span()], role="viewer")
        assert "*" in out[0]["content"]
        assert "alice@example.com" not in out[0]["content"]

    def test_records_without_spans_passthrough(self):
        gk = PIIGatekeeper(enabled=True, acl_role_threshold="editor", low_priv_policy="anonymize")
        rec = {"id": "m2", "content": "no pii here", "metadata": {}}
        out = gk.filter_records([rec], role="viewer")
        assert out[0]["content"] == "no pii here"

    def test_invalid_low_priv_policy_raises(self):
        with pytest.raises(ValueError):
            PIIGatekeeper(enabled=True, low_priv_policy="bogus")

    def test_from_settings_factory(self):
        with patch.dict(
            "sys.modules",
            {"negentropy.config": MagicMock(settings=_make_settings(gatekeeper_enabled=True, policy="mask"))},
        ):
            gk = PIIGatekeeper.from_settings()
        assert gk._enabled is True
        assert gk._policy == "mask"


class TestBackwardsCompat:
    """老 import 路径 negentropy.engine.governance.pii_detector 必须仍工作。"""

    def test_legacy_detect_returns_pii_match(self):
        from negentropy.engine.governance.pii_detector import (
            PIIMatch,
            _luhn_check,
            detect,
            summarize_flags,
        )

        matches = detect("Email a@b.co phone 13812345678")
        assert all(isinstance(m, PIIMatch) for m in matches)
        flags = summarize_flags(matches)
        assert flags.get("email", 0) >= 1
        assert flags.get("phone", 0) >= 1
        assert _luhn_check("4242424242424242") is True
