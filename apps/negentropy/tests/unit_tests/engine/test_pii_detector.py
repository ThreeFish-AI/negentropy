"""PII Detector 单元测试

覆盖 regex 命中 + Luhn 校验。
"""

from __future__ import annotations

from negentropy.engine.governance.pii_detector import (
    _luhn_check,
    detect,
    summarize_flags,
)


class TestLuhnCheck:
    def test_valid_visa(self) -> None:
        assert _luhn_check("4242424242424242") is True

    def test_valid_mastercard(self) -> None:
        assert _luhn_check("5555555555554444") is True

    def test_invalid_random_digits(self) -> None:
        assert _luhn_check("1234567890123456") is False

    def test_too_short(self) -> None:
        assert _luhn_check("123456") is False

    def test_handles_separators(self) -> None:
        assert _luhn_check("4242-4242-4242-4242") is True
        assert _luhn_check("4242 4242 4242 4242") is True


class TestDetect:
    def test_email_detection(self) -> None:
        matches = detect("Contact me at alice@example.com or bob@x.org")
        types = [m.pii_type for m in matches]
        assert types.count("email") == 2

    def test_email_masked(self) -> None:
        matches = detect("alice@example.com")
        assert matches[0].pii_type == "email"
        assert matches[0].masked_value.startswith("al")
        assert matches[0].masked_value.endswith("om")
        assert "*" in matches[0].masked_value

    def test_chinese_phone_detection(self) -> None:
        matches = detect("我的手机是 13812345678 请联系")
        assert any(m.pii_type == "phone" for m in matches)

    def test_chinese_id_card(self) -> None:
        matches = detect("身份证号码 110101199003078117")
        assert any(m.pii_type == "id_card" for m in matches)

    def test_credit_card_with_luhn(self) -> None:
        matches = detect("Pay with 4242 4242 4242 4242")
        assert any(m.pii_type == "credit_card" for m in matches)

    def test_random_digits_not_credit_card(self) -> None:
        matches = detect("Order id 12345678901234567 confirmed")
        assert not any(m.pii_type == "credit_card" for m in matches)

    def test_no_pii_returns_empty(self) -> None:
        assert detect("plain text without pii") == []

    def test_summarize_flags(self) -> None:
        matches = detect("Email a@b.co phone 13812345678 and ID 110101199003078117")
        flags = summarize_flags(matches)
        assert flags.get("email") == 1
        assert flags.get("phone") == 1
        assert flags.get("id_card") == 1
