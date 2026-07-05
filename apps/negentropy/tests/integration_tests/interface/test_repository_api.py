"""Repository API + Routine 关联 全链路集成测试 — 真实 Postgres + ASGI + 真实 git。

覆盖：
- Repository CRUD：create / 非法 local_path 422 / 重复 name 400 / list / get / patch / delete 204
- 分支枚举：POST /inspect 返回分支；非法路径 422
- Routine 关联：带 repository_id 创建（cwd/baseline 留空仍过校验）→ 序列化含 repository_id；
  start 守卫用 Repo 派生配置放行；running 改 repository_id → 409；删除 Repo → FK SET NULL 回退
- 单一事实源红线：_hydrate_effective_repo 注入内存有效 cwd/baseline，dispatch commit 后
  DB routines.cwd/baseline_branch 仍为 NULL（不被副本污染）
"""

from __future__ import annotations

import subprocess
import uuid

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import delete

import negentropy.db.session as db_session
from negentropy.auth.deps import get_current_user
from negentropy.auth.service import AuthUser
from negentropy.engine.routine.orchestrator import RoutineOrchestrator
from negentropy.interface.repository_api import router as repo_router
from negentropy.interface.routine_api import router as routine_router
from negentropy.models.plugin import PluginVisibility, Repository
from negentropy.models.routine import Routine

pytestmark = pytest.mark.asyncio


def _name() -> str:
    return f"itest_repo_{uuid.uuid4().hex[:8]}"


def _key() -> str:
    return f"itest_repo_rt_{uuid.uuid4().hex[:8]}"


def _user() -> AuthUser:
    return AuthUser(
        user_id="itest_repo_user",
        email=None,
        name=None,
        picture=None,
        roles=["user"],
        provider="test",
        subject="itest_repo_user",
        domain=None,
    )


def _app() -> FastAPI:
    app = FastAPI()
    app.include_router(repo_router)
    app.include_router(routine_router)
    app.dependency_overrides[get_current_user] = _user
    return app


def _client(app: FastAPI) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def _cleanup(name_prefix: str, key_prefix: str) -> None:
    async with db_session.AsyncSessionLocal() as db:
        await db.execute(delete(Routine).where(Routine.key.like(f"{key_prefix}%")))
        await db.execute(delete(Repository).where(Repository.name.like(f"{name_prefix}%")))
        await db.commit()


@pytest.fixture(scope="module")
def git_repo(tmp_path_factory) -> str:
    """模块级临时 git 仓库（含 main + feature/x 分支），供注册校验与分支枚举。"""
    repo = tmp_path_factory.mktemp("repo_api_repo")
    p = str(repo)
    subprocess.run(["git", "init", "-q", p], check=True)
    subprocess.run(["git", "-C", p, "config", "user.email", "t@t.io"], check=True)
    subprocess.run(["git", "-C", p, "config", "user.name", "t"], check=True)
    (repo / "README.md").write_text("# repo\n")
    subprocess.run(["git", "-C", p, "add", "-A"], check=True)
    subprocess.run(["git", "-C", p, "commit", "-q", "-m", "init"], check=True)
    subprocess.run(["git", "-C", p, "branch", "-M", "main"], check=True)
    subprocess.run(["git", "-C", p, "branch", "feature/x"], check=True)
    return p


# ---------------------------------------------------------------------------
# Repository CRUD + inspect
# ---------------------------------------------------------------------------


async def test_repository_crud_and_inspect(git_repo):
    app = _app()
    name = _name()
    try:
        async with _client(app) as c:
            # CREATE（合法本地仓库 + 基线）
            r = await c.post(
                "/interface/repositories",
                json={
                    "name": name,
                    "display_name": "Repo One",
                    "github_url": "https://github.com/org/repo",
                    "local_path": git_repo,
                    "baseline_branch": "main",
                },
            )
            assert r.status_code == 201, r.text
            repo_id = r.json()["id"]
            assert r.json()["local_path"] == git_repo
            assert r.json()["baseline_branch"] == "main"
            assert r.json()["owner_id"] == "itest_repo_user"

            # CREATE 非法 local_path → 422
            bad = await c.post(
                "/interface/repositories",
                json={
                    "name": _name(),
                    "github_url": "https://github.com/org/repo",
                    "local_path": "/nonexistent/path/xyz",
                    "baseline_branch": "main",
                },
            )
            assert bad.status_code == 422, bad.text

            # 重复 name → 400
            dup = await c.post(
                "/interface/repositories",
                json={
                    "name": name,
                    "github_url": "https://github.com/org/repo",
                    "local_path": git_repo,
                    "baseline_branch": "main",
                },
            )
            assert dup.status_code == 400, dup.text

            # LIST（含刚建的）
            lst = await c.get("/interface/repositories")
            assert lst.status_code == 200
            assert any(x["id"] == repo_id for x in lst.json())

            # GET 详情
            got = await c.get(f"/interface/repositories/{repo_id}")
            assert got.status_code == 200 and got.json()["name"] == name

            # PATCH display_name
            upd = await c.patch(f"/interface/repositories/{repo_id}", json={"display_name": "Renamed"})
            assert upd.status_code == 200 and upd.json()["display_name"] == "Renamed"

            # PATCH 非法 local_path → 422
            bad_upd = await c.patch(f"/interface/repositories/{repo_id}", json={"local_path": "/nope/xyz"})
            assert bad_upd.status_code == 422

            # inspect 分支枚举 → 含 main + feature/x
            ins = await c.post("/interface/repositories/inspect", json={"local_path": git_repo})
            assert ins.status_code == 200, ins.text
            local = set(ins.json()["local"])
            assert "main" in local and "feature/x" in local

            # inspect 非法路径 → 422
            bad_ins = await c.post("/interface/repositories/inspect", json={"local_path": "/nope/xyz"})
            assert bad_ins.status_code == 422

            # DELETE → 204
            dele = await c.delete(f"/interface/repositories/{repo_id}")
            assert dele.status_code == 204
            # 删除后再取：access 检查先于存在性，找不到行返回 403（与 McpServer get 行为一致）。
            assert (await c.get(f"/interface/repositories/{repo_id}")).status_code in (403, 404)
    finally:
        await _cleanup(name, _key())


# ---------------------------------------------------------------------------
# Routine 关联（repository_id 指针，单一事实源）
# ---------------------------------------------------------------------------


async def test_routine_with_repository_id_lifecycle(git_repo):
    app = _app()
    name = _name()
    key = _key()
    try:
        async with _client(app) as c:
            # 注册 Repository
            r = await c.post(
                "/interface/repositories",
                json={
                    "name": name,
                    "github_url": "https://github.com/org/repo",
                    "local_path": git_repo,
                    "baseline_branch": "main",
                },
            )
            assert r.status_code == 201, r.text
            repo_id = r.json()["id"]

            # 创建 Routine：仅给 repository_id，cwd/baseline 留空 → 仍过校验（后端从 Repo 派生）
            cr = await c.post(
                "/routines",
                json={
                    "key": key,
                    "title": "Repo-linked routine",
                    "goal": "实现 X",
                    "acceptance_criteria": "通过",
                    "repository_id": repo_id,
                    "max_iterations": 5,
                },
            )
            assert cr.status_code == 200, cr.text
            rid = cr.json()["id"]
            # 序列化含 repository_id；cwd/baseline 仍为 null（不存副本）
            assert cr.json()["repository_id"] == repo_id
            assert cr.json()["cwd"] is None
            assert cr.json()["baseline_branch"] is None

            # start：守卫用 Repo 派生配置放行（即便 routine.cwd 为空）
            st = await c.post(f"/routines/{rid}/start")
            assert st.status_code == 200, st.text
            assert st.json()["status"] == "running"

            # running 态改 repository_id → 409（非 runtime-safe）
            bad = await c.put(f"/routines/{rid}", json={"repository_id": repo_id})
            assert bad.status_code == 409, bad.text

            # 删除 Repository → FK SET NULL：routine.repository_id 置空（解除关联）
            # 先 pause 以便后续可观察（删除 Repo 不依赖 routine 状态）
            await c.post(f"/routines/{rid}/pause")
            dele = await c.delete(f"/interface/repositories/{repo_id}")
            assert dele.status_code == 204
            async with db_session.AsyncSessionLocal() as db:
                routine = await db.get(Routine, uuid.UUID(rid))
                assert routine is not None
                assert routine.repository_id is None  # SET NULL 生效
    finally:
        await _cleanup(name, key)


# ---------------------------------------------------------------------------
# 单一事实源红线：dispatch 注入不污染 DB
# ---------------------------------------------------------------------------


async def test_hydrate_effective_repo_does_not_pollute_db(git_repo):
    """repository_id 非空的 routine 经 _hydrate + 一次 commit 后，DB cwd/baseline 仍为 NULL。

    set_committed_value 注入的内存有效值不进 dirty 集合，故 dispatch 写回 worktree_path 的
    commit 不会把派生 cwd/baseline 持久化进 routines 行（单一事实源不被副本污染）。
    """
    name = _name()
    key = _key()
    try:
        async with db_session.AsyncSessionLocal() as db:
            repo = Repository(
                owner_id="itest_repo_user",
                visibility=PluginVisibility.PRIVATE,
                name=name,
                github_url="https://github.com/org/repo",
                local_path=git_repo,
                baseline_branch="main",
            )
            db.add(repo)
            await db.commit()
            await db.refresh(repo)
            repo_id = repo.id

        async with db_session.AsyncSessionLocal() as db:
            routine = Routine(
                key=key,
                title="hydrate",
                goal="g",
                acceptance_criteria="a",
                status="running",
                repository_id=repo_id,
                cwd=None,
                baseline_branch=None,
                reflections={},
                config={},
            )
            db.add(routine)
            await db.commit()
            rid = routine.id

        orch = RoutineOrchestrator()
        async with db_session.AsyncSessionLocal() as db:
            routine = await db.get(Routine, rid)
            await orch._hydrate_effective_repo(db, routine)  # noqa: SLF001
            # 内存注入了有效配置
            assert routine.cwd == git_repo
            assert routine.baseline_branch == "main"
            # 模拟 dispatch 写回 worktree 句柄并提交
            routine.worktree_path = "/tmp/fake-wt"
            await db.commit()

        # 红线：DB 中 cwd/baseline 仍为 NULL，worktree_path 已持久化
        async with db_session.AsyncSessionLocal() as db:
            routine = await db.get(Routine, rid)
            assert routine.cwd is None, "cwd 被副本污染了（单一事实源被破坏）"
            assert routine.baseline_branch is None, "baseline_branch 被副本污染了"
            assert routine.worktree_path == "/tmp/fake-wt"
    finally:
        await _cleanup(name, key)
