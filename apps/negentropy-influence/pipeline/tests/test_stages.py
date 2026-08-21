"""stages.toml 的执法。

**这个文件是 stages.toml 的存在许可证。** 一份没有消费者的声明是第四个事实源，
严格劣于「散文 + 子命令 + mermaid + 路由表」四处漂移的现状——因为它多了一处
可漂移的地方却没有换来任何约束。砍范围时宁可砍 `pipeline.py stages` 子命令
（那只是便利），也不能砍这里。

覆盖五条：
  1. skill 指针全部真实存在
  2. commands 每一项都是 pipeline.py 真实注册的子命令
  3. ordinal 恰好是 ①..⑨、无重无缺
  4. 每篇 skill 文档的 H1 与声明（ordinal / name / 文件号）逐字相符
  5. .agent 路由壳的速查表覆盖全部九个 skill 文档（**校验而非生成**：生成物
     会被手改，那是更隐蔽的第二事实源）
"""

from __future__ import annotations

import re
import sys
import tomllib
from pathlib import Path

PIPELINE = Path(__file__).resolve().parents[1]
INFLUENCE = PIPELINE.parent
STAGES_TOML = PIPELINE / "stages.toml"
PIPELINE_PY = PIPELINE / "scripts" / "pipeline.py"
ROUTER = (
    INFLUENCE.parents[1] / ".agent" / "skills" / "science-video-pipeline" / "SKILL.md"
)

ORDINALS = "①②③④⑤⑥⑦⑧⑨"

sys.path.insert(0, str(PIPELINE / "scripts"))


def stages() -> list[dict]:
    return tomllib.loads(STAGES_TOML.read_text(encoding="utf-8"))["stage"]


def test_skill_pointers_exist():
    """skill 是**子项目相对**的轻量指针，全部须落到真实文件。"""
    for st in stages():
        target = INFLUENCE / st["skill"]
        assert target.is_file(), f"{st['id']}: skill 指针失效 {st['skill']}"


def test_commands_are_registered_subcommands():
    """commands 不得声明 pipeline.py 里不存在的子命令（防声明与实现漂移）。"""
    src = PIPELINE_PY.read_text(encoding="utf-8")
    registered = set(re.findall(r'add_parser\("([a-z-]+)"', src))
    assert registered, "未能从 pipeline.py 解析出任何子命令——解析器该更新了"
    for st in stages():
        for c in st["commands"]:
            assert c in registered, (
                f"{st['id']}: 声明了子命令 {c!r}，但 pipeline.py 未注册"
                f"（已注册：{sorted(registered)}）"
            )


#: 子命令清单被抄进三份散文。抄件无执法就会漂——`stages` 上线时三处**全部**漏更，
#: 而当时的守卫只查 stages.toml→parser 一个方向（声明多于实现），看不见反向缺口。
BRACE_LIST_RE = re.compile(r"\{([a-z|-]{20,})\}")
DOCSTRING_LIST_RE = re.compile(r"^子命令：(.+)$", re.MULTILINE)


def documented_subcommand_lists() -> list[tuple[str, set[str]]]:
    """→ [(出处, 该处声明的子命令集合)]。找不到清单即视为检测器失效并报错。"""
    out: list[tuple[str, set[str]]] = []
    m = DOCSTRING_LIST_RE.search(PIPELINE_PY.read_text(encoding="utf-8"))
    assert m, "pipeline.py 文件头的「子命令：」行形态变了，检测器该更新了"
    out.append(("pipeline.py 文件头", {s.strip() for s in m.group(1).split("/")}))
    for doc in (PIPELINE / "README.md", INFLUENCE / "README.md"):
        hits = BRACE_LIST_RE.findall(doc.read_text(encoding="utf-8"))
        assert hits, f"{doc.name}: 未找到 {{a|b|c}} 形态的子命令清单（检测器失效？）"
        out += [(doc.name, set(h.split("|"))) for h in hits]
    return out


def test_documented_subcommand_lists_match_the_parser():
    """三份散文抄件必须逐项等于 argparse 真实注册表。"""
    registered = set(
        re.findall(r'add_parser\("([a-z-]+)"', PIPELINE_PY.read_text(encoding="utf-8"))
    )
    assert registered, "未能从 pipeline.py 解析出任何子命令——解析器该更新了"
    for where, listed in documented_subcommand_lists():
        assert listed == registered, (
            f"{where} 的子命令清单与 argparse 注册表不符："
            f"缺 {sorted(registered - listed)} / 多 {sorted(listed - registered)}"
        )


def test_ordinals_are_exactly_one_through_nine():
    got = [st["ordinal"] for st in stages()]
    assert got == list(ORDINALS), f"ordinal 应恰为 ①..⑨ 且按序声明，实际 {got}"


def test_kind_is_known_and_authored_stages_own_no_generation():
    """kind 只有两个取值；tooled 阶段必须至少有一个子命令（否则「工具生成」无从发生）。"""
    for st in stages():
        assert st["kind"] in {"authored", "tooled"}, (
            f"{st['id']}: 未知 kind {st['kind']!r}"
        )
        if st["kind"] == "tooled":
            assert st["commands"], f"{st['id']}: 声明为 tooled 却没有任何子命令"


def test_skill_h1_matches_declaration():
    """H1 形态统一为 `# Stage <序号> <名字>（skill 规格 · <NN>）`。

    这一条把「文件 06 是第 ⑦ 阶段」从读者要自己撞见的陷阱，变成文件第一行就说、
    且改错就红的事实。
    """
    for st in stages():
        p = INFLUENCE / st["skill"]
        nn = p.name[:2]
        want = f"# Stage {st['ordinal']} {st['name']}（skill 规格 · {nn}）"
        first = p.read_text(encoding="utf-8").split("\n", 1)[0]
        assert first == want, f"{p.name} H1 不符：\n  实际 {first!r}\n  期望 {want!r}"


def test_declared_misalignment_is_real():
    """守住那个反直觉事实本身：⑥↔07、⑦↔06。

    若将来真去重命名文件，本条会红——那正是提醒：入链 ≥5 处需同步。
    """
    by_ord = {st["ordinal"]: Path(st["skill"]).name for st in stages()}
    assert by_ord["⑥"].startswith("07-"), "⑥ 不再对应 07-*，请同步所有入链"
    assert by_ord["⑦"].startswith("06-"), "⑦ 不再对应 06-*，请同步所有入链"


def test_router_table_covers_every_skill():
    """.agent 路由壳必须链到全部九篇规格。

    路由表把 ④⑤ 合并成一行（8 行覆盖 9 阶段），故按「文件是否被链接」判定，
    而非按行数——判据要贴着不变量，不贴着排版。
    """
    assert ROUTER.is_file(), f"路由壳不存在：{ROUTER}"
    text = ROUTER.read_text(encoding="utf-8")
    for st in stages():
        name = Path(st["skill"]).name
        assert name in text, f"路由壳未链到 {name}（{st['id']}）"


def test_router_declares_subproject_ssot_paths():
    """路由壳自称「内容 SSOT 在 skills/、工具 SSOT 在 scripts/」，这两条路径须真实。

    迁移会一次性打断它的 13 条链接，而此前**没有任何检查**覆盖它。
    """
    text = ROUTER.read_text(encoding="utf-8")
    for rel in ("pipeline/skills/", "pipeline/scripts/"):
        assert rel in text, f"路由壳未声明 SSOT 路径 {rel}"
        assert (INFLUENCE / rel).is_dir(), f"SSOT 路径不存在：{rel}"
