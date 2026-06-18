"""子进程环境净化 — 剥离引擎自身的 venv / uv 激活痕迹，避免泄漏到隔离 worktree 子进程。

定位（物理隔离延伸到 Python 环境）：
    引擎自身经 ``uv run`` 在 ``negentropy/.venv`` 下运行；而 Routine 的 Claude Code 执行与
    验证门控（gate）在**另一个项目**的隔离 worktree（拥有自己的 ``.venv``）内运行。worktree
    隔离此前只覆盖文件系统 cwd（``--add-dir`` / deny / cwd），但**进程环境仍整体继承引擎的
    ``os.environ``**——其中引擎 ``uv run`` 注入的 venv 激活变量会越界泄漏给任务子进程：

    - ``VIRTUAL_ENV``：指向引擎 venv。``uv run <gate>`` 报 "VIRTUAL_ENV does not match
      project" 警告（被忽略但污染门控输出）；**非 ``uv run`` 门控**（裸 ``pytest`` / ``python``）
      会落到**引擎的 venv** 而非任务 venv → 找错包、产生假失败，直接污染评分；
    - ``UV_RUN_RECURSION_DEPTH``：因引擎经 ``uv run`` 启动而置位，会把任务**独立**的 ``uv run``
      误计为嵌套递归，蚕食任务自身的 uv run 嵌套预算（深层 ``uv run make`` 等可能触顶被拒）。

    故对 worktree 子进程（Claude Code 执行 + gate 命令）统一净化这些变量，使「物理隔离」从
    文件系统 cwd 延伸到 Python 运行环境，任务子进程据其 cwd 自行解析正确的项目环境。

实证（ISSUE-120）：忠实复刻 routine 的 IMPLEMENT 门控 ``uv run pytest -q`` 输出首行即为
``warning: VIRTUAL_ENV=.../negentropy/apps/negentropy/.venv does not match the project
environment path `.venv` and will be ignored``——引擎 venv 泄漏的直接证据。
"""

from __future__ import annotations

import os

# 引擎自身 uv run / venv 激活注入、不应泄漏给任务 worktree 子进程的环境变量。
ENGINE_VENV_ENV_VARS: tuple[str, ...] = (
    "VIRTUAL_ENV",
    "VIRTUAL_ENV_PROMPT",
    "UV_RUN_RECURSION_DEPTH",
)


def inherited_env_without_engine_venv() -> dict[str, str]:
    """返回 ``os.environ`` 副本，剥离引擎自身的 venv / uv 激活痕迹（见模块文档）。

    不就地修改 ``os.environ``；供 Claude Code 子进程与 gate 子进程构建 env 复用，
    使两条任务子进程路径以单一事实源净化环境（避免 strip 逻辑双副本漂移）。
    """
    env = os.environ.copy()
    for key in ENGINE_VENV_ENV_VARS:
        env.pop(key, None)
    return env


__all__ = ["ENGINE_VENV_ENV_VARS", "inherited_env_without_engine_venv"]
