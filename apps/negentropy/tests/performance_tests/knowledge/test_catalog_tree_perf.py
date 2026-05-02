"""
Catalog 树查询性能基准测试

固化 get_tree() Recursive CTE 的 P99 基线，防止性能回退。
参考阈值（基于 3 层 100 节点树，本地 PG 实例）：
  - get_tree() 平均耗时 < 50ms
  - get_subtree() 平均耗时 < 20ms
"""

from __future__ import annotations

import time
from uuid import UUID

import pytest


class TestCatalogTreePerformance:
    """Catalog 目录树 CTE 查询的性能基准测试"""

    @pytest.fixture
    async def perf_catalog(self, db_engine):
        """创建性能测试用 Catalog（不依赖 corpus）"""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

        from negentropy.models.perception import DocCatalog

        session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)
        catalog_id: UUID | None = None
        async with session_factory() as session:
            catalog = DocCatalog(
                app_name="negentropy",
                name="perf-test-catalog",
                slug="perf-test-catalog",
                visibility="INTERNAL",
                version=1,
                is_archived=False,
            )
            session.add(catalog)
            await session.flush()
            await session.commit()
            catalog_id = catalog.id

        yield catalog_id, session_factory

        async with session_factory() as s:
            obj = await s.get(DocCatalog, catalog_id)
            if obj is not None:
                await s.delete(obj)
            await s.commit()

    async def _build_tree(self, session_factory, catalog_id: UUID, depth: int = 3, branching: int = 4) -> int:
        """递归构建指定深度和分支因子的目录树，返回节点总数。"""

        from negentropy.knowledge.lifecycle.catalog_dao import CatalogDao

        total = 0

        async def _create_level(parent_id: UUID | None, current_depth: int, prefix: str) -> None:
            nonlocal total
            if current_depth > depth:
                return
            for i in range(branching):
                slug = f"{prefix}-d{current_depth}-{i}"
                async with session_factory() as session:
                    node = await CatalogDao.create_node(
                        session,
                        catalog_id=catalog_id,
                        name=slug,
                        slug=slug,
                        parent_id=parent_id,
                    )
                    await session.commit()
                    total += 1
                await _create_level(node.id, current_depth + 1, slug)

        await _create_level(None, 1, "perf")
        return total

    @pytest.mark.asyncio
    async def test_get_tree_100_nodes_under_50ms(self, db_engine, perf_catalog):
        """100 节点的 3 层树，get_tree() 平均耗时应 < 50ms"""

        from negentropy.knowledge.lifecycle.catalog_dao import CatalogDao

        catalog_id, session_factory = perf_catalog

        # 构建约 84 节点的树（branching=4, depth=3: 4+16+64=84）
        total_nodes = await self._build_tree(session_factory, catalog_id, depth=3, branching=4)
        assert total_nodes >= 4, f"tree should have nodes, got {total_nodes}"

        # 预热
        async with session_factory() as session:
            await CatalogDao.get_tree(session, catalog_id=catalog_id)

        # 实际计时（5 次取平均）
        durations_ms = []
        for _ in range(5):
            t0 = time.perf_counter()
            async with session_factory() as session:
                tree = await CatalogDao.get_tree(session, catalog_id=catalog_id)
            elapsed_ms = (time.perf_counter() - t0) * 1000
            durations_ms.append(elapsed_ms)

        avg_ms = sum(durations_ms) / len(durations_ms)
        p99_ms = sorted(durations_ms)[-1]  # 5 次中最慢的即为近似 P99

        assert len(tree) == total_nodes, f"expected {total_nodes} nodes, got {len(tree)}"
        assert avg_ms < 50, f"get_tree() avg {avg_ms:.1f}ms exceeds 50ms threshold"
        assert p99_ms < 100, f"get_tree() p99 {p99_ms:.1f}ms exceeds 100ms threshold"

    @pytest.mark.asyncio
    async def test_get_subtree_under_20ms(self, db_engine, perf_catalog):
        """get_subtree() 对子树查询应 < 20ms"""

        from negentropy.knowledge.lifecycle.catalog_dao import CatalogDao

        catalog_id, session_factory = perf_catalog

        # 构建小树（branching=3, depth=2: 3+9=12 节点）
        await self._build_tree(session_factory, catalog_id, depth=2, branching=3)

        # 获取根节点 ID 作为子树锚点
        async with session_factory() as session:
            tree = await CatalogDao.get_tree(session, catalog_id=catalog_id)

        assert len(tree) > 0
        root_id = [r["id"] for r in tree if r["depth"] == 0][0]

        # 预热
        async with session_factory() as session:
            await CatalogDao.get_subtree(session, node_id=root_id)

        # 实际计时（5 次取平均）
        durations_ms = []
        for _ in range(5):
            t0 = time.perf_counter()
            async with session_factory() as session:
                subtree = await CatalogDao.get_subtree(session, node_id=root_id)
            elapsed_ms = (time.perf_counter() - t0) * 1000
            durations_ms.append(elapsed_ms)

        avg_ms = sum(durations_ms) / len(durations_ms)

        assert len(subtree) > 0
        assert avg_ms < 20, f"get_subtree() avg {avg_ms:.1f}ms exceeds 20ms threshold"

    @pytest.mark.asyncio
    async def test_list_catalogs_under_10ms(self, db_engine, perf_catalog):
        """list_catalogs() 应 < 10ms"""

        from negentropy.knowledge.lifecycle.catalog_dao import CatalogDao

        _, session_factory = perf_catalog

        durations_ms = []
        for _ in range(5):
            t0 = time.perf_counter()
            async with session_factory() as session:
                catalogs, total = await CatalogDao.list_catalogs(session, app_name="negentropy")
            elapsed_ms = (time.perf_counter() - t0) * 1000
            durations_ms.append(elapsed_ms)

        avg_ms = sum(durations_ms) / len(durations_ms)
        assert avg_ms < 10, f"list_catalogs() avg {avg_ms:.1f}ms exceeds 10ms threshold"
