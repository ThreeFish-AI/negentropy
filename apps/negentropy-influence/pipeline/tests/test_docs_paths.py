"""文档与脚本文件头里**命令**的路径无关性执法。

纪律（两类引用，方向相反）：
  - **命令** → 必须用 `$I`/`$R`/`$P`/`$V` 变量。命令是可执行文本，变量化后与
    子项目在仓库中的位置解耦，下次搬迁零改动。
  - **散文里的 Markdown 链接** → 必须保持真实相对路径。AGENTS.md 强制可跳转
    链接，且 `check_series.py` 规则 5 正在执法它们的存活；把链接变量化会一次性
    造出十几条死链，并让规则 5 的覆盖面凭空缩小。

本文件只管前者，三条判据：
  1. 命令内不出现「子项目在仓库中的位置」字面量（skills/*.md）
  2. 变量定义只存在于 pipeline/README.md，且位置字面量只写在 `I=` 一行
  3. 同一条命令内不混用两种锚点 —— 迁移留下的 `$R + pipeline/voices/…` 组合在
     任何 CWD 下都不成立，且因为不是 Markdown 链接，规则 5 完全看不到。判据 3
     的受检面**必须**含 `.py`：脚本文件头的用法段既无围栏也无反引号。
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


#: 子项目在仓库中的位置。**全仓只允许出现在 pipeline/README.md 的 `I=` 一行**，
#: 其余一切命令都从 `$I` 派生（`$R`/`$P`/`$V`）。
LOCATION_LITERAL = "apps/negentropy-influence"


def test_variable_convention_is_defined_exactly_once():
    """`$I`/`$R`/`$P`/`$V` 的定义只允许出现在 pipeline/README.md（单一事实源）。

    位置字面量只写一次（`I=`），其余变量派生自它 —— 否则搬迁时要改 N 处，
    而这次迁移正是靠 N 处未同步暴露出来的。
    """
    readme = (PIPELINE / "README.md").read_text(encoding="utf-8")
    for line in (
        f"I={LOCATION_LITERAL}",
        "R=$I/pipeline/scripts",
        "P=$I/episodes/<slug>-video",
        "V=$I/pipeline/voices",
    ):
        assert line in readme, f"pipeline/README.md 的路径变量约定缺 `{line}`"
    for p in sorted(SKILLS.glob("*.md")):
        text = p.read_text(encoding="utf-8")
        assert f"I={LOCATION_LITERAL}" not in text, (
            f"{p.name}: 重复定义了 $I —— 定义应只在 pipeline/README.md"
        )
        assert not re.search(r"^\s*[IRPV]=", text, re.MULTILINE), (
            f"{p.name}: 自行赋值路径变量 —— skills 只引用不定义"
        )


#: 命令行的**行级**识别：不能只看围栏与行内代码跨——脚本文件头里的用法段既没有
#: 围栏也没有反引号（tts_sample.py 就是），只覆盖那两种形态会让检查在 .py 上空转。
COMMAND_LINE_RE = re.compile(r"(uv run|\.venv/bin/python|afplay|realpath)\b")


def command_lines(text: str) -> list[tuple[int, str]]:
    """→ [(行号, 整行)]，凡看起来是命令调用的行都算，续行一并接上。"""
    out: list[tuple[int, str]] = []
    lines = text.split("\n")
    for i, line in enumerate(lines, 1):
        if not COMMAND_LINE_RE.search(line):
            continue
        joined, j = line, i
        while joined.rstrip().endswith("\\") and j < len(lines):
            joined = joined.rstrip().rstrip("\\") + " " + lines[j]
            j += 1
        out.append((i, joined))
    return out


#: 混锚检测的受检面：命令散落在 skills 之外的这些文档与脚本文件头里，
#: 而 2026-08 的迁移恰恰在这些地方留下了「$R + 子项目相对样本路径」的组合。
def command_bearing_files() -> list[Path]:
    out = sorted(SKILLS.glob("*.md"))
    out += [
        PIPELINE / "VOICE-CLONING.md",
        PIPELINE / "INDEXTTS-2.5-ADVANCED.md",
        PIPELINE / "voices" / "README.md",
        PIPELINE / "templates" / "video-skeleton" / "README.md.tmpl",
    ]
    out += sorted((PIPELINE / "scripts").glob("*.py"))
    out += sorted((PIPELINE.parent / "episodes").glob("*/README.md"))
    return [p for p in out if p.is_file()]


def test_no_mixed_anchor_commands():
    """同一条命令里不得混用两种锚点。

    `$I/$R/$P/$V` 同锚于**仓库根**；而 `pipeline.toml` 的 `tts.ref` 与
    `series.json` 的 `path` 是**子项目根相对**（由 paths.INFLUENCE 拼接）。把后者
    的写法搬进命令行就会造出 `$R/tts_sample.py --ref pipeline/voices/x.wav` 这类
    **在任何 CWD 下都不成立**的命令——迁移后这个组合一次出现在 7 个文件里，
    且因为不是 Markdown 链接，check_series 的规则 5 完全看不到。
    """
    subproject_relative = re.compile(r"(?<![\w./$<])(pipeline|episodes)/")
    offenders: list[str] = []
    for p in command_bearing_files():
        for lineno, line in command_lines(p.read_text(encoding="utf-8")):
            if not re.search(r"\$[IRPV]\b", line):
                continue
            if m := subproject_relative.search(line):
                offenders.append(f"{p.name}:{lineno} `{m.group(0)}…` ← {line.strip()}")
    assert not offenders, (
        "命令内混用仓库根变量与子项目相对路径（样本路径请用 $V）：\n  "
        + "\n  ".join(offenders)
    )


#: `$P` 是每集自己的（各集 README 在 bash 块首行赋值它，见
#: episodes/*/README.md），故 `P=` 全域允许；`I=`/`R=`/`V=` 是全局定义，
#: 只允许出现在 pipeline/README.md。
GLOBAL_VARS = frozenset("IRV")
VAR_ASSIGN_RE = re.compile(r"^\s*([IRPV])=(\S*)", re.MULTILINE)


def definition_bearing_files() -> list[Path]:
    """可能写下变量定义的全部文件 = 命令承载文件 + 子项目 README。"""
    return [
        p
        for p in [*command_bearing_files(), PIPELINE.parent / "README.md"]
        if p.is_file()
    ]


def test_global_var_definitions_and_literals_stay_out_of_consumers():
    """判据 2 的**受检面必须含 `.py` 与各集 README**，不能只有 skills/*.md。

    实测漏网：`pipeline.py` 文件头曾写 `R=apps/…/scripts; P=apps/…/episodes/<工程>`,
    把位置字面量复制了两遍进脚本——而当时的定义检查只扫 skills/*.md，看不到 .py
    文件头，于是这处违反不报红。判据要贴着「位置字面量有几份副本」，不贴着文件后缀。
    """
    readme = PIPELINE / "README.md"
    offenders: list[str] = []
    for p in definition_bearing_files():
        if p == readme:
            continue
        for m in VAR_ASSIGN_RE.finditer(p.read_text(encoding="utf-8")):
            name, value = m.group(1), m.group(2)
            if name in GLOBAL_VARS:
                offenders.append(
                    f"{p.name}: 定义了 ${name} —— 定义应只在 pipeline/README.md"
                )
            if LOCATION_LITERAL in value:
                offenders.append(
                    f"{p.name}: {name}={value} 内联了位置字面量，应从 $I 派生"
                )
    assert not offenders, "\n  ".join(["路径变量定义/位置字面量越界：", *offenders])


def test_episode_and_template_readmes_carry_no_location_literal():
    """分集 README 是**按集复制**的：位置字面量落进去就会随新集数量线性繁殖。

    模板 README 尤其承重——它是每个 scaffold 出的新集继承的那一份。
    """
    targets = [PIPELINE / "templates" / "video-skeleton" / "README.md.tmpl"]
    targets += sorted((PIPELINE.parent / "episodes").glob("*/README.md"))
    offenders = [
        f"{p.relative_to(PIPELINE.parent)}:{i}"
        for p in targets
        if p.is_file()
        for i, line in enumerate(p.read_text(encoding="utf-8").split("\n"), 1)
        if LOCATION_LITERAL in line
    ]
    assert not offenders, (
        "分集/模板 README 不得出现位置字面量（用 $I 派生，见 pipeline/README.md）：\n  "
        + "\n  ".join(offenders)
    )


def test_direct_compare_command_anchors_both_videos_to_project():
    skill = (SKILLS / "08-render-qa.md").read_text(encoding="utf-8")
    assert "--compare $P/out/baseline-draft.mp4 $P/out/draft.mp4" in skill
    assert "--compare out/baseline-draft.mp4 out/draft.mp4" not in skill
