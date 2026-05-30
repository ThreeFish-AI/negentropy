"""记忆冲突解决单元测试

覆盖 ConflictResolver 的分类、解决策略、DB 写入、手动解决、版本链追踪逻辑。

参考文献:
[1] C. E. Alchourrón, P. Gärdenfors, and D. Makinson,
    "On the logic of theory change," J. Symbolic Logic, vol. 50, no. 2,
    pp. 510–530, 1985.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
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


# ---------------------------------------------------------------------------
# DB 写路径 Mock 测试
# ---------------------------------------------------------------------------


def _make_resolver_with_mock_db() -> tuple[ConflictResolver, AsyncMock]:
    """创建带 mock session factory 的 ConflictResolver。

    SQLAlchemy AsyncSession 的 add/flush 等方法是同步调用，
    execute/commit/refresh 是异步调用，因此需要混合 mock。
    """
    mock_db = AsyncMock()
    mock_factory = MagicMock(return_value=mock_db)
    mock_db.__aenter__ = AsyncMock(return_value=mock_db)
    mock_db.__aexit__ = AsyncMock(return_value=False)
    mock_factory.return_value = mock_db

    # SQLAlchemy session.add() 是同步方法，不能用 AsyncMock
    mock_db.add = MagicMock()
    mock_db.flush = MagicMock()

    resolver = ConflictResolver(session_factory=mock_factory)
    return resolver, mock_db


class TestResolveDBWrite:
    """_resolve() 的 DB 写入验证。"""

    @pytest.mark.asyncio
    async def test_supersede_marks_old_fact_superseded(self) -> None:
        """supersede 策略应将旧 Fact 状态更新为 superseded。"""
        resolver, mock_db = _make_resolver_with_mock_db()
        old = _make_fact(key="theme", value={"text": "dark"}, confidence=0.7)
        new = _make_fact(key="theme", value={"text": "light"}, confidence=0.9)

        # mock db.add 和 db.refresh（用于 MemoryConflict 记录）
        added_objects: list = []

        def capture_add(obj):
            added_objects.append(obj)

        mock_db.add.side_effect = capture_add
        mock_db.refresh = AsyncMock()

        with patch("asyncio.create_task", MagicMock()):
            await resolver._resolve(
                old_fact=old,
                new_fact=new,
                user_id="u1",
                app_name="app",
                conflict_type="contradiction",
                resolution="supersede",
                detected_by="key_collision",
            )

        # 验证旧事实被标记为 superseded
        mock_db.execute.assert_called()
        # 验证 MemoryConflict 被添加
        assert len(added_objects) == 1
        conflict_obj = added_objects[0]
        assert conflict_obj.conflict_type == "contradiction"
        assert conflict_obj.resolution == "supersede"
        assert conflict_obj.detected_by == "key_collision"
        assert conflict_obj.confidence_delta == pytest.approx(0.2)

    @pytest.mark.asyncio
    async def test_keep_both_creates_conflict_record(self) -> None:
        """keep_both 策略应创建冲突记录但不修改事实状态。"""
        resolver, mock_db = _make_resolver_with_mock_db()
        old = _make_fact(key="detail", value={"text": "v1"}, confidence=0.9)
        new = _make_fact(key="detail", value={"text": "v2"}, confidence=0.5)

        added_objects: list = []
        mock_db.add.side_effect = lambda obj: added_objects.append(obj)
        mock_db.refresh = AsyncMock()

        with patch("asyncio.create_task", MagicMock()):
            await resolver._resolve(
                old_fact=old,
                new_fact=new,
                user_id="u1",
                app_name="app",
                conflict_type="refinement",
                resolution="keep_both",
                detected_by="key_collision",
            )

        # keep_both 不应执行 update（不修改事实状态）
        mock_db.execute.assert_not_called()
        # 但应创建冲突记录
        assert len(added_objects) == 1
        assert added_objects[0].resolution == "keep_both"


class TestManualResolve:
    """manual_resolve() 四种策略验证。"""

    @pytest.mark.asyncio
    async def test_invalid_resolution_raises(self) -> None:
        """非法 resolution 参数应抛出 ValueError。"""
        resolver, mock_db = _make_resolver_with_mock_db()
        with pytest.raises(ValueError, match="Invalid resolution"):
            await resolver.manual_resolve(conflict_id=uuid4(), resolution="invalid_option")

    @pytest.mark.asyncio
    async def test_nonexistent_conflict_returns_none(self) -> None:
        """不存在的 conflict_id 应返回 None。"""
        resolver, mock_db = _make_resolver_with_mock_db()
        mock_db.get.return_value = None

        result = await resolver.manual_resolve(conflict_id=uuid4(), resolution="supersede")
        assert result is None

    @pytest.mark.asyncio
    async def test_keep_old_restores_old_supersedes_new(self) -> None:
        """keep_old 应恢复旧事实 active，标记新事实为 superseded。"""
        resolver, mock_db = _make_resolver_with_mock_db()

        old_id = uuid4()
        new_id = uuid4()
        mock_conflict = MagicMock()
        mock_conflict.new_fact_id = new_id
        mock_conflict.old_fact_id = old_id
        mock_conflict.resolution = "pending"

        mock_db.get.return_value = mock_conflict
        mock_db.refresh = AsyncMock()

        with patch("asyncio.create_task", MagicMock()):
            await resolver.manual_resolve(conflict_id=uuid4(), resolution="keep_old")

        # 新事实应被标记为 superseded
        assert mock_db.execute.call_count == 2
        # 验证 resolution 被更新
        assert mock_conflict.resolution == "keep_old"

    @pytest.mark.asyncio
    async def test_keep_new_supersedes_old(self) -> None:
        """keep_new 应标记旧事实为 superseded。"""
        resolver, mock_db = _make_resolver_with_mock_db()

        old_id = uuid4()
        new_id = uuid4()
        mock_conflict = MagicMock()
        mock_conflict.new_fact_id = new_id
        mock_conflict.old_fact_id = old_id

        mock_db.get.return_value = mock_conflict
        mock_db.refresh = AsyncMock()

        with patch("asyncio.create_task", MagicMock()):
            await resolver.manual_resolve(conflict_id=uuid4(), resolution="keep_new")

        assert mock_conflict.resolution == "keep_new"
        assert mock_db.execute.call_count == 2

    @pytest.mark.asyncio
    async def test_merge_combines_values(self) -> None:
        """merge 应合并新旧事实的值。"""
        resolver, mock_db = _make_resolver_with_mock_db()

        old_id = uuid4()
        new_id = uuid4()

        mock_conflict = MagicMock()
        mock_conflict.new_fact_id = new_id
        mock_conflict.old_fact_id = old_id

        old_fact = SimpleNamespace(id=old_id, value={"a": "old_a", "shared": "old"}, status="active")
        new_fact = SimpleNamespace(id=new_id, value={"b": "new_b", "shared": "new"}, status="active")

        def mock_get(_, obj_id):
            if obj_id == old_id:
                return old_fact
            if obj_id == new_id:
                return new_fact
            return mock_conflict

        mock_db.get.side_effect = mock_get
        mock_db.refresh = AsyncMock()

        with patch("asyncio.create_task", MagicMock()):
            await resolver.manual_resolve(conflict_id=uuid4(), resolution="merge")

        assert mock_conflict.resolution == "merge"


class TestGetFactHistory:
    """get_fact_history() 版本链追踪。"""

    @pytest.mark.asyncio
    async def test_single_fact_no_chain(self) -> None:
        """孤立事实（无前后继）返回自身。"""
        resolver, mock_db = _make_resolver_with_mock_db()

        fact_id = uuid4()
        mock_fact = SimpleNamespace(id=fact_id, superseded_by=None)
        mock_db.get.return_value = mock_fact

        # 无前驱
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        history = await resolver.get_fact_history(fact_id)

        assert len(history) == 1
        assert history[0].id == fact_id

    @pytest.mark.asyncio
    async def test_chain_with_successor(self) -> None:
        """有后继的事实应追踪版本链。"""
        resolver, mock_db = _make_resolver_with_mock_db()

        fact_v1_id = uuid4()
        fact_v2_id = uuid4()

        fact_v1 = SimpleNamespace(id=fact_v1_id, superseded_by=fact_v2_id)
        fact_v2 = SimpleNamespace(id=fact_v2_id, superseded_by=None)

        def mock_get(_, obj_id):
            if obj_id == fact_v1_id:
                return fact_v1
            if obj_id == fact_v2_id:
                return fact_v2
            return None

        mock_db.get.side_effect = mock_get

        # 无前驱
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        history = await resolver.get_fact_history(fact_v1_id)

        assert len(history) == 2
        assert history[0].id == fact_v1_id
        assert history[1].id == fact_v2_id


class TestListConflicts:
    """list_conflicts() 过滤验证。"""

    @pytest.mark.asyncio
    async def test_filter_by_app_name(self) -> None:
        """应按 app_name 过滤。"""
        resolver, mock_db = _make_resolver_with_mock_db()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        result = await resolver.list_conflicts(app_name="test_app")

        assert result == []
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_filter_by_user_and_resolution(self) -> None:
        """应同时按 user_id 和 resolution 过滤。"""
        resolver, mock_db = _make_resolver_with_mock_db()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        result = await resolver.list_conflicts(user_id="user-1", app_name="app", resolution="supersede", limit=10)

        assert result == []
        # 验证 SQL 包含过滤条件
        call_args = mock_db.execute.call_args
        compiled = str(call_args[0][0].compile(compile_kwargs={"literal_binds": True}))
        assert "supersede" in compiled
