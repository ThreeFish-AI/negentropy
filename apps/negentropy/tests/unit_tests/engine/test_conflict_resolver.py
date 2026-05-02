"""记忆冲突解决单元测试

覆盖 ConflictResolver 的分类和解决策略逻辑。

参考文献:
[1] C. E. Alchourrón, P. Gärdenfors, and D. Makinson,
    "On the logic of theory change," J. Symbolic Logic, vol. 50, no. 2,
    pp. 510–530, 1985.
"""

from types import SimpleNamespace
from uuid import uuid4

import pytest

from negentropy.engine.governance.conflict_resolver import ConflictResolver


def _make_fact(
    *,
    key: str = "test_key",
    value: dict | None = None,
    fact_type: str = "preference",
    confidence: float = 1.0,
) -> SimpleNamespace:
    """创建测试用 Fact 代理对象"""
    return SimpleNamespace(
        id=uuid4(),
        key=key,
        value=value or {"text": "test_value"},
        fact_type=fact_type,
        confidence=confidence,
        status="active",
        superseded_by=None,
    )


class TestConflictClassification:
    def test_preference_contradiction(self) -> None:
        resolver = ConflictResolver.__new__(ConflictResolver)
        old = _make_fact(key="theme", value={"text": "dark"}, fact_type="preference")
        new = _make_fact(key="theme", value={"text": "light"}, fact_type="preference")
        assert resolver._classify_conflict(old, new) == "contradiction"

    def test_rule_contradiction(self) -> None:
        resolver = ConflictResolver.__new__(ConflictResolver)
        old = _make_fact(key="max_retries", value={"text": "3"}, fact_type="rule")
        new = _make_fact(key="max_retries", value={"text": "5"}, fact_type="rule")
        assert resolver._classify_conflict(old, new) == "contradiction"

    def test_profile_temporal_update(self) -> None:
        resolver = ConflictResolver.__new__(ConflictResolver)
        old = _make_fact(key="location", value={"text": "Beijing"}, fact_type="profile")
        new = _make_fact(key="location", value={"text": "Shanghai"}, fact_type="profile")
        assert resolver._classify_conflict(old, new) == "temporal_update"

    def test_custom_type_refinement(self) -> None:
        resolver = ConflictResolver.__new__(ConflictResolver)
        old = _make_fact(key="detail", value={"text": "v1"}, fact_type="custom")
        new = _make_fact(key="detail", value={"text": "v2"}, fact_type="custom")
        assert resolver._classify_conflict(old, new) == "refinement"


class TestResolutionStrategy:
    def test_contradiction_supersedes(self) -> None:
        resolver = ConflictResolver.__new__(ConflictResolver)
        old = _make_fact(key="theme", value={"text": "dark"}, fact_type="preference")
        new = _make_fact(key="theme", value={"text": "light"}, fact_type="preference")
        assert resolver._determine_resolution(old, new, "contradiction") == "supersede"

    def test_temporal_update_supersedes(self) -> None:
        resolver = ConflictResolver.__new__(ConflictResolver)
        old = _make_fact(key="location", value={"text": "Beijing"}, fact_type="profile")
        new = _make_fact(key="location", value={"text": "Shanghai"}, fact_type="profile")
        assert resolver._determine_resolution(old, new, "temporal_update") == "supersede"

    def test_refinement_higher_confidence_supersedes(self) -> None:
        resolver = ConflictResolver.__new__(ConflictResolver)
        old = _make_fact(key="detail", value={"text": "v1"}, fact_type="custom", confidence=0.5)
        new = _make_fact(key="detail", value={"text": "v2"}, fact_type="custom", confidence=0.9)
        assert resolver._determine_resolution(old, new, "refinement") == "supersede"

    def test_refinement_lower_confidence_keeps_both(self) -> None:
        resolver = ConflictResolver.__new__(ConflictResolver)
        old = _make_fact(key="detail", value={"text": "v1"}, fact_type="custom", confidence=0.9)
        new = _make_fact(key="detail", value={"text": "v2"}, fact_type="custom", confidence=0.5)
        assert resolver._determine_resolution(old, new, "refinement") == "keep_both"


class TestDetectNoConflict:
    @pytest.mark.asyncio
    async def test_different_keys_no_conflict(self) -> None:
        resolver = ConflictResolver.__new__(ConflictResolver)
        old = _make_fact(key="theme", value={"text": "dark"})
        new = _make_fact(key="language", value={"text": "en"})
        result = await resolver.detect_and_resolve(old_fact=old, new_fact=new, user_id="u1", app_name="app")
        assert result is None

    @pytest.mark.asyncio
    async def test_same_value_no_conflict(self) -> None:
        resolver = ConflictResolver.__new__(ConflictResolver)
        old = _make_fact(key="theme", value={"text": "dark"})
        new = _make_fact(key="theme", value={"text": "dark"})
        result = await resolver.detect_and_resolve(old_fact=old, new_fact=new, user_id="u1", app_name="app")
        assert result is None
