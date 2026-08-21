#!/usr/bin/env python3
"""路径锚点单一事实源——按哨兵文件向上搜索，不数目录层数。

## 为什么不数层数

数层数（`parents[N]`）把「目录深度」这个**偶然事实**编码进了每一个脚本。
2026-08 把子项目从仓库根的 `media` 目录迁到 `apps/negentropy-influence/` 并新增 `episodes/`
一层时，三处仓库根锚点（pipeline.py / check_series.py / tts_sample.py）同时
静默指向 `apps/`，而三者的失败形态各不相同、且**都不报错**：

  - `pipeline.py`  → `tts.ref` 解析到不存在的路径，doctor 只打印「参考样本缺失」，
                     与「样本本就 gitignored 而缺失」不可区分（退出码不置位）
  - `check_series.py` → `series.json` 找不到而直接 exit，pre-commit 门整体失效
  - `tts_sample.py` → 试听小样写到 `apps/.temp/`，且 `.gitignore` 的 `.temp/` 非锚定，
                     git status 什么都不显示 —— 生物特征信息静默堆积在错误位置

哨兵法（git 找 `.git`、uv/pytest 找 `pyproject.toml` 的同一惯例）对位置免疫：
子项目整体搬到任何深度，锚点都不用改一个字。

## 为什么是专用哨兵而不是 `.git`

  - **本仓的 `.git` 是文件不是目录**（git worktree：内容为 `gitdir: ...`），
    `(p / ".git").is_dir()` 这个最直觉的写法在此当场失效。
  - `test_check_series.py` 在 tmp_path 里搭的假仓库根本没有 `.git`。
  - `~/tools/index-tts` **是**一个真 `.git` 目录 —— `tts_server.py` 被拷到那里跑时会误锚。
  - `pnpm-workspace.yaml` 可用，但那是用 Node 清单去锚 Python，跨了模块边界。

## 为什么 REPO 从 INFLUENCE 派生而不再找第二个标记

`.temp/` 按 AGENTS.md 是**仓库级**约定（临时产物一律收敛至仓库根 `.temp/`），
必须留在仓库根：搬进子项目会静默孤立各 worktree 里既有的样本。派生是一步、
有注释、且测试 fixture 按构造即满足，比引入第二套标记搜索更省。

## 导入边界（承重，勿破）

`pipeline.py` / `check_series.py` / `tts_sample.py` / `scaffold.py` /
`verify_skeleton.py` 可以 `import paths`（前三个需要 INFLUENCE 与 REPO 双锚点，
后两个只消费 INFLUENCE）。**`tts.py` 绝不可以** —— `tts_server.py` 文件头记载
它会被拷到 `~/tools/index-tts` 的 venv 里运行并 `from tts import ...`，给
`tts.py` 增加任何同目录依赖都会断掉那条拷出路径。`tts.py` 全靠 `--ref` 入参，
本就不需要任何根。同理 `tts_server.py` 自身也不可导入（同一条拷出路径）。
"""

from __future__ import annotations

import sys
from pathlib import Path

#: 子项目根哨兵。文件名足够独特，不会与任何生态约定冲突。
MARKER = ".influence-root"


def influence_root(start: Path | None = None) -> Path:
    """自 start（默认本模块）向上逐级搜索 MARKER，返回子项目根。

    找不到即**大声退出**，绝不回退到 `Path.cwd()` 或猜测：一个「看起来合理但错」
    的根正是 `apps/.temp/` 那类问题得以隐形的原因。报错须写明找的是什么标记、
    从哪里开始、走到哪里为止，否则使用者无法自查。
    """
    origin = (start or Path(__file__)).resolve()
    for p in [origin, *origin.parents]:  # 天然终止于文件系统根，不会无限上溯
        if (p / MARKER).is_file():
            return p
    sys.exit(
        f"找不到子项目根哨兵 {MARKER}（自 {origin} 起向上搜索至 {origin.parents[-1]}）"
        f"\n  —— 脚本被移出 negentropy-influence 子工程，或哨兵文件缺失。"
    )


#: 子项目根：series.json / pipeline/ / episodes/ 的父目录。
INFLUENCE = influence_root()

#: 仓库根：仅用于仓库级约定（`.temp/`）与仓库级文档（CHANGELOG / knowledge-map）。
#: 子项目位于 `apps/<name>/`，故出树两级。
REPO = INFLUENCE.parents[1]
