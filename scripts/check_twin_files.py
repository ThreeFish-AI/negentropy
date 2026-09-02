# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""孪生文件（逐字节副本）一致性校验。

某些模块因构建边界无法提为共享包，只能以「逐字节副本」形式在多处持有。
副本的固有风险是**单边漂移**：改了一处忘了另一处，缺陷从此静默分叉。
本脚本把「必须同步」从人工纪律升格为机器保证。

设计要点（贴合 AGENTS.md「单一事实源 + 最小干预 + 正交分解」）：

* **登记表显式列出** —— 不用 glob 或内容嗅探猜测谁是副本，避免误纳与漏纳。
  新增一组副本只需往 ``TWIN_GROUPS`` 加一条，正交于校验逻辑本身。
* **精确字节相等** —— 不做注释剥离、空白归一等启发式处理。副本的交叉标注写成
  两端对称（同时列出全部路径、文字一致），故连文档注释的漂移也在射程内。
  启发式比对会放过「注释说 A 代码做 B」这类最危险的漂移。
* **可诊断输出** —— 漂移时打印统一 diff（含行号）而非仅「哈希不一致」，
  使开发者无需自行 diff 即知何处分叉、往哪个方向同步。
* **只读** —— 不自动同步。哪份是权威取决于改动意图，机器不该替开发者猜；
  自动覆盖有静默丢失改动的风险。

用法::

    uv run --no-project scripts/check_twin_files.py   # 任一组漂移则 exit 1

供 pre-commit 钩子与 CI（.github/workflows/twin-files-consistency.yml）双侧调用。
"""

from __future__ import annotations

import difflib
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# ── 孪生文件登记表 ──────────────────────────────────────────────────────────
# 每组为 (简称, 无法共享的理由, 必须逐字节相同的仓库相对路径列表[≥2])。
# 简称用于通过态的单行输出；理由仅在漂移时打印，供后来者判断该不该合并成共享包。
TWIN_GROUPS: list[tuple[str, str, list[str]]] = [
    (
        "remark-math-sanitize",
        (
            "wiki 与 ui 渲染同一份 PDF 提取语料，净化判据单边漂移即产生渲染不对称。"
            "wiki 无 workspace 依赖且以 GitHub Pages 为出口，为单个插件引入构建链的"
            "爆炸半径过大，故采副本而非共享包。"
        ),
        [
            "apps/negentropy-wiki/src/components/markdown/remark-math-sanitize.ts",
            "apps/negentropy-ui/utils/remark-math-sanitize.ts",
        ],
    ),
]


def check_group(rel_paths: list[str]) -> list[str]:
    """校验一组孪生文件，返回问题描述列表（空表示该组通过）。"""
    problems: list[str] = []

    missing = [p for p in rel_paths if not (REPO_ROOT / p).is_file()]
    if missing:
        # 副本被删除/改名亦是漂移的一种 —— 报错而非静默跳过。
        problems.append(f"以下路径不存在（副本被删除或改名？）：{', '.join(missing)}")
        return problems

    # 以第一条为比对基准（仅作 diff 的左侧，不含「它更权威」的语义）。
    base_rel = rel_paths[0]
    base_bytes = (REPO_ROOT / base_rel).read_bytes()

    for other_rel in rel_paths[1:]:
        other_bytes = (REPO_ROOT / other_rel).read_bytes()
        if other_bytes == base_bytes:
            continue

        diff = "".join(
            difflib.unified_diff(
                base_bytes.decode("utf-8", errors="replace").splitlines(keepends=True),
                other_bytes.decode("utf-8", errors="replace").splitlines(keepends=True),
                fromfile=base_rel,
                tofile=other_rel,
            )
        )
        problems.append(f"{base_rel}\n     ≠ {other_rel}\n\n{diff}")

    return problems


def check_trigger_coverage() -> list[str]:
    """自检：登记表内每条路径都须出现在 pre-commit 的 files 正则与 CI 的 paths 里。

    二者是独立于登记表的第二/第三份清单，漏配会使执法对新增副本组**静默失效**
    （pre-commit 跳过、CI 不触发，均不报错）。此自检把该风险闭合在本脚本内。
    """
    problems: list[str] = []
    watchers = {
        ".pre-commit-config.yaml": REPO_ROOT / ".pre-commit-config.yaml",
        ".github/workflows/twin-files-consistency.yml": (REPO_ROOT / ".github/workflows/twin-files-consistency.yml"),
    }

    for label, path in watchers.items():
        if not path.is_file():
            problems.append(f"{label} 不存在，无法确认触发覆盖")
            continue
        text = path.read_text(encoding="utf-8")
        for _name, _rationale, rel_paths in TWIN_GROUPS:
            for rel in rel_paths:
                # pre-commit 正则里 `.` 写作 `\.`，故两种写法均视为已覆盖。
                if rel not in text and rel.replace(".", r"\.") not in text:
                    problems.append(f"{label} 未覆盖登记路径：{rel}")

    return problems


def main() -> int:
    failed = False

    for name, rationale, rel_paths in TWIN_GROUPS:
        if len(rel_paths) < 2:
            print(f"[配置错误] 分组「{name}」少于 2 条路径，无从比对", file=sys.stderr)
            failed = True
            continue

        problems = check_group(rel_paths)
        if not problems:
            print(f"✓ {name}：{len(rel_paths)} 份副本逐字节一致")
            continue

        failed = True
        print(f"\n✗ {name}：孪生文件漂移", file=sys.stderr)
        print(f"  副本存在的理由：{rationale}", file=sys.stderr)
        for problem in problems:
            print(f"\n  {problem}", file=sys.stderr)

    if failed:
        print(
            "\n孪生文件出现漂移。请判断哪份体现了本次改动的意图，"
            "将其同步到同组其余路径（含文档注释），并同步两端回归用例。",
            file=sys.stderr,
        )

    coverage_problems = check_trigger_coverage()
    if coverage_problems:
        failed = True
        print("\n✗ 执法触发覆盖不全（新增副本组后忘了扩充触发清单？）：", file=sys.stderr)
        for problem in coverage_problems:
            print(f"  - {problem}", file=sys.stderr)
        print(
            "  未覆盖的路径不会触发 pre-commit 钩子 / CI job —— 执法对其静默失效。",
            file=sys.stderr,
        )

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
