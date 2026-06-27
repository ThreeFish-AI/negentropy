"""PG 集成测试：pdf_fidelity_patrol 真实创建并持久化巡检 Routine。

验证用户反馈的核心断点——「派生 Routine 完全没有挂载和执行」。根因是
``no_progress_patience=settings.routine.no_progress_patience``（该属性不存在于
RoutineSettings）致 handler 在创建 Routine 前抛 AttributeError。本测试用真实 PG
（conftest 的 ``_isolate_test_database`` 已 alembic upgrade head 建全 schema +
``db_engine`` fixture）落库一条 running 巡检 Routine，证明修复后「真实挂载」成立。

依赖：PG 可用（与其它 routine PG 测试同）。无网络 / 无 Claude Code（仅验证 DB 落库链路）。
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from negentropy.engine.schedulers.handlers import pdf_fidelity_patrol as patrol
from negentropy.models.plugin_common import PluginVisibility
from negentropy.models.repository import Repository
from negentropy.models.routine import Routine


async def test_create_and_start_patrol_routine_persists_real_row(db_engine):
    """_create_and_start_patrol_routine 真实落库一条 running 巡检 Routine（回归 no_progress_patience 全量异常）。"""
    session_factory = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)

    # 1) 先插一个 Repository（routine.repository_id FK 指向它）
    async with session_factory() as db:
        repo = Repository(
            owner_id="system",
            visibility=PluginVisibility.PUBLIC,
            name=f"negentropy-test-{uuid.uuid4().hex[:8]}",
            display_name="patrol-integration-test",
            github_url="https://github.com/ThreeFish-AI/negentropy",
            local_path="/tmp/nonexistent-patrol-repo",
            baseline_branch="origin/feature/1.x.x",
            default_remote="origin",
        )
        db.add(repo)
        await db.flush()
        repo_id = repo.id

        # 2) 创建并落库巡检 Routine（真实 settings + 真实 DB）
        doc = {"id": uuid.uuid4(), "original_filename": "spec.pdf"}
        routine_id = await patrol._create_and_start_patrol_routine(
            db,
            repo_id=repo_id,
            baseline_branch="origin/feature/1.x.x",
            doc=doc,
            source_pdf_path="/tmp/patrol/source.pdf",
            source_read_dir="/tmp/patrol",
            regression_sample=[],
            source_task_key="pdf_fidelity_patrol",
        )
        await db.commit()

    # 3) 新会话查询，证明真实持久化（非 in-memory）
    async with session_factory() as db:
        row = (await db.execute(select(Routine).where(Routine.id == routine_id))).scalar_one()
        assert row.status == "running"
        assert row.repository_id == repo_id
        assert row.baseline_branch == "origin/feature/1.x.x"
        assert row.no_progress_patience == 3  # per-Routine 默认（非 settings）—— 回归点
        assert row.success_score_threshold == 100
        assert row.max_iterations == 8  # settings.routine.patrol_max_iterations_per_doc
        assert row.max_cost_usd == 30.0  # patrol 专属预算（非全局 default_max_cost_usd=5）
        assert row.owner_id == "system"
        assert row.is_template is False
        assert row.key.startswith("pdf-fidelity-patrol/")
        # config 装配（patrol 标记 + source_task_key 回链 + system_prompt + read_dirs）
        assert row.config["patrol"] is True
        assert row.config["source_task_key"] == "pdf_fidelity_patrol"
        assert "system_prompt" in row.config
        assert row.config["read_dirs"] == ["/tmp/patrol"]
