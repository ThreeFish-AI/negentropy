"""子项目自身的工程卫生（与 pipeline.toml 内容无关，故不并入 test_config.py）。

当前只守一条不变量：本子项目**刻意不是可构建的 Python 包**（pyproject.toml 无
`[project]` 表，全部脚本走 `uv run --no-project` + 调用点 `--with` 注入依赖），
因此不该有 uv 锁文件。但 uv 没有「拒绝成为项目」的开关——漏打 `--no-project`
的 `uv run` 会当场把本目录当项目根并生成 `uv.lock`。`.venv/` 有根 ignore 兜着，
`uv.lock` 此前没有，于是留下一个**可提交**的产物，一旦入库就与「不参与任何 uv
workspace」的声明直接矛盾（实测触发过一次）。

判据必须是**双向**的：拦住本子项目的锁文件，同时不误伤兄弟子项目——它们的
`uv.lock` 是受版本控制的依赖 SSOT（negentropy 那份还挂着 Version SSOT 钩子），
裸 `uv.lock` 规则会把三份一起吞掉。只测第一半的门会把这次修复变成下一个事故。
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

INFLUENCE = Path(__file__).resolve().parents[2]
REPO = INFLUENCE.parents[1]

#: 本子项目不该有的锁文件（仓库根相对；由锚点派生，不写位置字面量）
STRAY_LOCK = f"{INFLUENCE.relative_to(REPO).as_posix()}/uv.lock"
#: 兄弟子项目的锁文件：必须**不被**忽略
SIBLING_LOCKS = (
    "apps/negentropy/uv.lock",
    "apps/negentropy-perceives/uv.lock",
    "apps/cognizes/uv.lock",
)


def _ignored(rel: str) -> bool:
    """→ 该路径是否被 ignore 规则命中。

    `--no-index` 是承重的：兄弟子项目的锁文件**已被跟踪**，不加该旗标时
    `check-ignore` 一律报「未忽略」，于是反向判据变成永真。加上它才是在测
    规则本身，而不是在测当前的跟踪状态。
    """
    r = subprocess.run(
        ["git", "check-ignore", "-q", "--no-index", rel],
        cwd=REPO,
        capture_output=True,
        check=False,
    )
    return r.returncode == 0


@pytest.fixture(scope="module")
def in_git_work_tree() -> bool:
    """git 不可用或不在工作树内（如 `git archive` 导出的纯目录）时**大声 skip**。

    这条门天生依赖 git 语义，无 git 时既不能判通过也不能判失败；skip 会出现在
    pytest 汇总里，不是静默跳过。
    """
    if shutil.which("git") is None:
        pytest.skip("git 不可用：本门依赖 git check-ignore 语义")
    r = subprocess.run(
        ["git", "rev-parse", "--is-inside-work-tree"],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=False,
    )
    if r.stdout.strip() != "true":
        pytest.skip(f"{REPO} 不在 git 工作树内（导出目录？）：本门无从判定")
    return True


def test_subproject_has_no_committed_uv_lock(in_git_work_tree):
    """现状核对：那份锁文件不该真的存在于工作树里（更不该入库）。"""
    assert not (INFLUENCE / "uv.lock").is_file(), (
        f"{STRAY_LOCK} 存在 —— 大概率是漏打 `--no-project` 的 `uv run` 留下的，"
        "删掉即可（本子项目刻意无 [project]，不该有锁文件）"
    )


def test_stray_uv_lock_is_ignored(in_git_work_tree):
    """正向：真被生成时必须落在 ignore 里，不能以未跟踪文件的形态等人 `git add -A`。"""
    assert _ignored(STRAY_LOCK), (
        f"{STRAY_LOCK} 未被 .gitignore 覆盖 —— 漏打 `--no-project` 的一次 `uv run`"
        "就会留下可提交产物（规则维护在根 .gitignore 的 negentropy-influence 段）"
    )


@pytest.mark.parametrize("rel", SIBLING_LOCKS)
def test_sibling_uv_locks_stay_tracked(in_git_work_tree, rel):
    """反向：拦法必须逐路径锚定 —— 裸 `uv.lock` 规则会吞掉兄弟子项目的依赖 SSOT。"""
    assert not _ignored(rel), (
        f"{rel} 被 ignore 命中 —— 兄弟子项目的锁文件是受版本控制的依赖 SSOT，"
        "本子项目的拦法必须写成完整路径，不可用裸 `uv.lock` 或通配"
    )
