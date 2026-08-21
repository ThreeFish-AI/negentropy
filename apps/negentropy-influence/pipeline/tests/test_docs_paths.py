"""技能文档的路径无关性执法。

纪律（两类引用，方向相反）：
  - **代码块里的命令** → 必须用 `$R` / `$P` 变量。命令是可执行文本，变量化后
    与子项目在仓库中的位置解耦，下次搬迁零改动。
  - **散文里的 Markdown 链接** → 必须保持真实相对路径。AGENTS.md 强制可跳转
    链接，且 `check_series.py` 规则 5 正在执法它们的存活；把链接变量化会一次性
    造出十几条死链，并让规则 5 的覆盖面凭空缩小。

本文件只管前者：断言围栏代码块内不出现任何「子项目在仓库中的位置」字面量。
它把「路径无关」从愿望变成判据，并自动阻止未来有人把硬编码写回命令里。
"""

from __future__ import annotations

import re
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
SKILLS = PIPELINE / "skills"

#: 这些串出现在**命令**里即为回归——它们把命令钉死在当前目录布局上。
FORBIDDEN_IN_COMMANDS = (
    "apps/negentropy-influence/pipeline/scripts",
    "apps/negentropy-influence/episodes",
    "media/pipeline",
    "media/<slug>-video",
)

FENCE_RE = re.compile(r"^```")
#: 行内代码跨（skills/07 的命令就写成这种形态，不是围栏块）
INLINE_CODE_RE = re.compile(r"`([^`\n]+)`")


def fenced_blocks(text: str) -> list[tuple[int, str]]:
    """→ [(起始行号, 块内文本)]。只取围栏代码块，散文一概不看。"""
    out, buf, start, inside = [], [], 0, False
    for i, line in enumerate(text.split("\n"), 1):
        if FENCE_RE.match(line):
            if inside:
                out.append((start, "\n".join(buf)))
                buf, inside = [], False
            else:
                inside, start = True, i
            continue
        if inside:
            buf.append(line)
    if inside:  # 悬空围栏本身也是缺陷（会把后续正文吞进代码块）
        out.append((start, "\n".join(buf)))
    return out


def test_skill_docs_exist():
    assert sorted(p.name[:2] for p in SKILLS.glob("*.md")) == [
        f"{n:02d}" for n in range(1, 10)
    ]


def command_spans(text: str) -> list[tuple[str, str]]:
    """命令出现的两种形态：围栏代码块 + 行内代码跨。

    只覆盖围栏是不够的 —— skills/07 的两条命令就写在行内代码跨里，
    漏掉它会让这条守卫在那个文件上空转。
    """
    spans = [(f"~{start}", block) for start, block in fenced_blocks(text)]
    spans += [
        ("行内", m.group(1))
        for m in INLINE_CODE_RE.finditer(text)
        if "uv run" in m.group(1) or "/scripts/" in m.group(1)
    ]
    return spans


def test_no_hardcoded_paths_in_skill_commands():
    offenders: list[str] = []
    for p in sorted(SKILLS.glob("*.md")):
        for where, block in command_spans(p.read_text(encoding="utf-8")):
            for bad in FORBIDDEN_IN_COMMANDS:
                if bad in block:
                    offenders.append(f"{p.name}:{where} 命令内出现硬编码路径 {bad!r}")
    assert not offenders, (
        "命令须用 $R/$P 变量（定义见 pipeline/README.md）：\n  "
        + "\n  ".join(offenders)
    )


def test_fences_are_balanced():
    """悬空围栏会把正文困进代码块——本仓有过同类事故（Perceives 切片相位错位）。"""
    for p in sorted(SKILLS.glob("*.md")):
        n = sum(
            1
            for line in p.read_text(encoding="utf-8").split("\n")
            if FENCE_RE.match(line)
        )
        assert n % 2 == 0, f"{p.name}: 围栏数 {n} 为奇数（悬空围栏）"


def test_variable_convention_is_defined_exactly_once():
    """`$R`/`$P` 的定义只允许出现在 pipeline/README.md（单一事实源）。

    各 skills 文档引用变量但不重复定义 —— 否则搬迁时又要改 N 处。
    """
    readme = (PIPELINE / "README.md").read_text(encoding="utf-8")
    assert "R=apps/negentropy-influence/pipeline/scripts" in readme, (
        "pipeline/README.md 缺少 $R/$P 路径变量约定小节"
    )
    for p in sorted(SKILLS.glob("*.md")):
        text = p.read_text(encoding="utf-8")
        assert "R=apps/negentropy-influence" not in text, (
            f"{p.name}: 重复定义了 $R —— 定义应只在 pipeline/README.md"
        )
