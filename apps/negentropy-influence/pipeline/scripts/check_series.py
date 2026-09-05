#!/usr/bin/env python3
"""系列一致性校验——series.json（发布顺序 SSOT）的机械化执法。

此前顺序只活在散文与 React 常量里（EP3 的 SeriesThree 数组说「第一集=AI 如何
自己变强」而意图已变），且反串线 lint 无法只用 grep 实现：EP1 的 p1-25a 会命中
自己的片名「上线之后」——正确排除自身标题必须知道标题属于哪个工程，也就是
必须有清单。本脚本按价值降序执行六条规则：

  1. 口播反串线：任一集 narration.md 的口播行出现**他集标题**或顺序词
     （上一集/上期/第N集/前两集/本系列…）即 FAIL；自身标题排除；「下期」白名单
     （顺序无关收尾语）
  2. 多标题顺序：同一文件出现**同系列** ≥2 集标题时，首现顺序必须等于清单
     episode 顺序 —— 一条规则覆盖 SeriesThree 数组、storyboard、README、
     planning、知识索引
  3. 序号↔标题绑定：`第N集` 附近的标题必须与该标题自身的 episode 匹配
  4. 清单完整性：每个系列内 episode 连续无重、slug 全局唯一、路径存在、
     accents 色值在该集 theme.ts 中存在且系列内不撞色；**反向登记**——
     episodes/ 下未登记目录分级执法（narration.md 已落盘即 FAIL，见
     rule_manifest_integrity 的死锁注释）
  5. 相对链接死链：受检文件集内的 `](./x.md)` / `](../x)` 目标必须存在
    （抓 video-package 类残留并防复发）
  6. 可渲染性：storyboard 已定稿的集，video/src/scenes/*.tsx 非空，且
     Main.tsx 的 SCENE_COMPONENTS 注册表与场景文件双向对齐——注册→文件
     是 FAIL 方向（注册了却渲染不出来，build 必炸），文件→注册只 WARN
     （未注册的可能是被其他场景 import 的合法辅助组件）
  7. 去站点化：观众可见层（narration.md 口播行+画面备注 / storyboard.md /
     scenes/*.tsx 字符串）不得出现课程站点标识（课程/站点/learn.shareai/
     Learn Claude Code/shareAI/章号 s01–s20）。归档期豁免：`{slug}-archive-*`
     的 research/ 台账与 source-map/ 不在受检文件集（内部取证保留具名归属）。
     背景：系列更名《Claude Code Harness Engineering》（2026-08-23）时定位
     从「介绍开源课程」转为「拆解 harness 工程」——站点只作组织骨架，观众
     不得感知其存在。改写示例：「课程作者拆过源码，他说…」→「有人拆过它的
     源码，他说…」（三级证据归属保留、不点名）。
  8. 下期卡同步：配了「系列身份卡 + 下期预告卡」收尾装置的系列（见
     NEXT_CARD_SERIES_IDS），P6 场景文本必须含本集标题与下集标题的主段
     ——硬编码标题在系列更名/改题时会静默变陈旧，此处在提交前拦住。

多系列语义（2026-08 起 series.json 顶层为 seriesList[]）：
  - 规则 1 **跨系列全局生效**——不同系列各自独立成片，口播互不引用，故「他集」
    范围取全部系列的全部集，只按 slug 排除自身。
  - 规则 2/3/4 **按系列内判定**——两个系列的发布顺序互相无关，同一文件（知识
    索引 / CHANGELOG / series.md）同时提及多个系列属正常形态；episode 的
    `1..N` 连续性也只在系列内成立。撞色同理：色相错开是系列内视觉契约
    （skills/06「与已用色撞车」登记表按系列维护），**跨系列撞色是接受态**
    ——实测真树 #4A9EFF（self-evolution）与 #4ADE80（claude-code 系）同处
    蓝/绿邻域；expand 的二维平行列表天然按系列分组，跨系列互不可见。

用法：uv run --no-project apps/negentropy-influence/pipeline/scripts/check_series.py
退出码：0 = 一致；1 = 有 FAIL。挂牌 pre-commit 后自动覆盖子项目相关提交。

受检范围按根拆分（见 COVERED_GLOBS_INFLUENCE / COVERED_GLOBS_REPO）：子项目侧
用相对 glob，故本脚本内不出现任何「子项目在仓库中的位置」字面量。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# 同目录模块：作为脚本运行时脚本目录即 sys.path[0]，无需注入
from paths import INFLUENCE, REPO

SERIES_JSON = INFLUENCE / "series.json"

#: 顺序词。白名单：「下期」顺序无关收尾语；「前两集」从终集视角恒真（相对表述，改序仍成立）
ORDINAL_WORDS = re.compile(
    r"上一集|上集|上期|下一集|下集|第[一二三四五六七八九十]集|前一集|本系列"
)
SPOKEN_LINE_RE = re.compile(r"^- \[(?P<id>[a-z0-9-]+)\]\s+(?P<text>.+)$", re.M)
REL_LINK_RE = re.compile(r"\]\((\.{1,2}/[^)#?]+)\)")
EP_NUM = re.compile(r"第([一二三四五六七八九十])集")

#: 规则 7 · 课程站点标识（观众可见层禁词）。`课程/站点` 单独成词太宽——
#: 「教程/网站」一类常用词不受牵连。章号不用 `\b` 锚：CJK 汉字在 re 里属
#: `\w`，中文最常见的无空格贴邻写法（「对应s01」）前后都是汉字、不构成
#: 边界，恰好逃过执法——改用 ASCII 侧环视：两侧只要不是 ASCII 字母数字
#: 下划线就算命中（「对应s01」「s01-readme」✓；`s01e02`/`as01` 仍排除，
#: `s01_agent_loop` 目录名与原 `\b` 行为一致地排除），且只认 20 章真实编号。
#: 「站点」按系列豁免：self-evolution 系（论文型）用它指论文的**配套网站**
#: （「官方工程站点统计」「配套站点 data/papers.json」）——与课程站点无关，
#: 执法进去是纯假报。课程系指站点一律用「课程」或显式 URL，语义不重叠。
SITE_MARKER_RE = re.compile(
    r"learn\.shareai|Learn Claude Code|shareAI"
    r"|课程"
    r"|(?<![A-Za-z0-9_])s(?:0[1-9]|1[0-9]|20)(?![A-Za-z0-9_])"
)
COURSE_SERIES_IDS = frozenset({"claude-code-explained"})
SITE_WORD_RE = re.compile(r"站点")
#: 规则 8 的适用系列：配了「系列身份卡 + 下期预告卡」统一收尾装置的系列
#: （Harness Engineering 五集）。self-evolution 系是旧版论文型收尾（无身份卡，
#: 只有「下期再见」），对其执法是假报——装置在哪个系列落地，规则就管到哪。
NEXT_CARD_SERIES_IDS = frozenset({"claude-code-explained"})
#: 规则 7 的受检文件（观众可见层）：口播/分镜/场景组件。research/、
#: source-map/、series.json 属内部取证与元数据——具名归属的署名义务在
#: 仓库层履行，观众层匿名化（系列改造决策 2026-08-23）。
AUDIENCE_GLOBS = (
    "episodes/*/script/narration.md",
    "episodes/*/script/storyboard.md",
    "episodes/*/video/src/scenes/*.tsx",
)

CN_NUM = {
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
    "十": 10,
}

#: 受检文件集（规则 2/3/5 的扫描范围；.context 等工作区目录不含）。
#: **按根拆分**是刻意的：子项目侧写相对 glob，路径字面量便从本脚本彻底消失
#: —— 于是「误把 `apps/negentropy-influence/**` 写宽成 `apps/**`」这个陷阱
#: 结构性不可能发生（实测宽化会炸出 12 条其他子项目的既存死链假 FAIL）。
#: 排除 templates/：模板是**机制**（与各集字面同源、由 verify_skeleton.py 执法），
#: 不是内容——被规则 2/3 扫进结果集只会稀释信号。
COVERED_GLOBS_INFLUENCE = (
    "**/*.md",
    "**/*.tsx",
    "**/*.ts",
)
#: 仓库级受检文件。science-video-pipeline 路由壳此前**完全没有死链校验**，而它
#: 有 13 条指向本子项目的链接——正是整目录迁移会一次性打断的东西。
#: 刻意只收该技能而非 `.agent/skills/**`：后者会连带执法其他技能的既存债
#: （实测 pdf-reader 有一条示意用占位链接 `../images/pdf_name/...`），
#: 把无关的假 FAIL 引进来，最终只会促使有人把这条 glob 整行删掉。
COVERED_GLOBS_REPO = (
    "docs/.agents/knowledge-map.md",
    "CHANGELOG.md",
    ".agent/skills/science-video-pipeline/**/*.md",
)


def load_series() -> list[dict]:
    """读取 seriesList[]；每个系列必须非空。"""
    if not SERIES_JSON.is_file():
        sys.exit(f"series.json 不存在: {SERIES_JSON}")
    data = json.loads(SERIES_JSON.read_text(encoding="utf-8"))
    series_list = data.get("seriesList", [])
    if not series_list:
        sys.exit("series.json 无 seriesList")
    for s in series_list:
        if not s.get("episodes"):
            sys.exit(f"series.json：系列 {s.get('id')!r} 无 episodes")
    return series_list


def all_episodes(series_list: list[dict]) -> list[dict]:
    """跨系列展平——规则 1/3 需要全局视野。"""
    return [ep for s in series_list for ep in s["episodes"]]


def covered_files() -> list[Path]:
    out: list[Path] = []
    for base, globs in (
        (INFLUENCE, COVERED_GLOBS_INFLUENCE),
        (REPO, COVERED_GLOBS_REPO),
    ):
        for g in globs:
            out.extend(
                p
                for p in base.glob(g)
                if p.is_file()
                and "node_modules" not in p.parts
                and "templates" not in p.parts  # 机制目录，非内容（见上方注释）
            )
    return sorted(set(out))


def rule_spoken_interleave(series_list: list[dict], msgs: list[str]) -> None:
    """规则 1：口播反串线（**跨系列全局**——见模块 docstring「多系列语义」）。"""
    eps = all_episodes(series_list)
    for ep in eps:
        others = [e["title"] for e in eps if e["slug"] != ep["slug"]]
        narration = INFLUENCE / ep["path"] / "script" / "narration.md"
        if not narration.is_file():
            msgs.append(f"FAIL 规则1：{ep['slug']} 缺 {narration.relative_to(REPO)}")
            continue
        for m in SPOKEN_LINE_RE.finditer(narration.read_text(encoding="utf-8")):
            sid, text = m.group("id"), m.group("text")
            hit_other = [t for t in others if t in text]
            if hit_other:
                msgs.append(
                    f"FAIL 规则1：{ep['slug']} {sid} 口播出现他集标题「{hit_other[0]}」"
                )
            if w := ORDINAL_WORDS.search(text):
                msgs.append(
                    f"FAIL 规则1：{ep['slug']} {sid} 口播出现顺序词「{w.group(0)}」"
                    "——序号只允许存在于视觉层与 series.json"
                )


def rule_title_order(
    series_list: list[dict], files: list[Path], msgs: list[str]
) -> None:
    """规则 2：同一文件内**同系列**多集标题的首现顺序 == 清单顺序。

    文件位于某集工程内时排除其自集标题——本集文件以自己的片名开篇（H1/组件数组）
    是自然形态，不该被计入顺序。跨系列不比顺序：两个系列发布顺序互相无关，
    知识索引 / CHANGELOG / series.md 同时提及多系列属正常形态。
    """
    for f in files:
        try:
            text = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        segs = set(f.parts)
        for series in series_list:
            own = next(
                (e for e in series["episodes"] if e["path"].split("/")[-1] in segs),
                None,
            )
            present = [
                (text.find(e["title"]), e["episode"], e["title"])
                for e in series["episodes"]
                if e["title"] in text and e is not own
            ]
            if len(present) >= 2:
                seq = [ep for _, ep, _ in sorted(present)]  # 按文本首现位置排序
                if seq != sorted(seq):
                    msgs.append(
                        f"FAIL 规则2：{f.relative_to(REPO)} 中系列 {series['id']} 的多集标题"
                        f"首现顺序为 {[t for _, _, t in sorted(present)]}"
                        f"（episode 序 {seq}），与 series.json 顺序不符"
                    )


def rule_ordinal_binding(
    series_list: list[dict], files: list[Path], msgs: list[str]
) -> None:
    """规则 3：`第N集` 的 ±60 字符窗口内出现的标题必须与该标题自身的序号匹配。

    跨系列无需分组：判据是「标题 → 它自己的 episode」，与标题属于哪个系列无关。
    多系列下各自都有第 1 集，故合法序号集合取并集（`valid_nums`）。
    """
    eps = all_episodes(series_list)
    valid_nums = {e["episode"] for e in eps}
    title_to_ep = {e["title"]: e["episode"] for e in eps}
    for f in files:
        if (
            f.suffix != ".md"
        ):  # 仅散文：TSX 里标签常在标题之后，近邻法必误报（规则2已覆盖数组）
            continue
        segs = set(f.parts)
        own_ep = next(
            (e["episode"] for e in eps if e["path"].split("/")[-1] in segs),
            None,
        )
        try:
            text = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for m in EP_NUM.finditer(text):
            if own_ep and CN_NUM.get(m.group(1)) == own_ep:
                continue  # 本集自称序号合法（如 EP3 README 开篇「系列第三集」）
            n = CN_NUM.get(m.group(1), 0)
            if n not in valid_nums:
                continue
            window = text[max(0, m.start() - 60) : m.end() + 60]
            for title, ep in title_to_ep.items():
                if title in window and ep != n:
                    msgs.append(
                        f"FAIL 规则3：{f.relative_to(REPO)} 「第{m.group(1)}集」邻域出现第 {ep} 集的标题《{title}》"
                    )


def rule_manifest_integrity(series_list: list[dict], msgs: list[str]) -> None:
    """规则 4：清单完整性——episode 连续性按系列内判定，slug 全局唯一。

    撞色只按系列内、且只认**精确同值**（不做色相邻近 WARN）：「色相与已用色
    错开」是 skills/06 定义的系列内视觉契约，skills/06 的登记表也按系列维护；
    跨系列撞色是接受态（见模块 docstring 多系列语义）。色相邻近则是弹性建议
    ——判据松一分就漏、紧一分就假报（蓝 #4A9EFF 与青 #2DD4BF 本就相邻共存），
    假报一多门就会被关掉（ISSUE-167 防范 3 的教训）。
    """
    seen_slugs: dict[str, str] = {}
    for series in series_list:
        eps = series["episodes"]
        nums = [e["episode"] for e in eps]
        if nums != list(range(1, len(eps) + 1)):
            msgs.append(
                f"FAIL 规则4：系列 {series['id']} 的 episode 序列 {nums} 不连续或有重复"
            )
        #: hex → slug 二维映射：撞色要报「谁与谁」，还要按系列内分组（跨系列豁免）。
        by_hex: dict[str, list[str]] = {}
        for e in eps:
            # slug 是工程目录名，必须全局唯一（否则两系列指向同一工程）
            if e["slug"] in seen_slugs:
                msgs.append(
                    f"FAIL 规则4：slug {e['slug']} 在系列 {seen_slugs[e['slug']]} "
                    f"与 {series['id']} 重复"
                )
            seen_slugs[e["slug"]] = series["id"]
            root = INFLUENCE / e["path"]
            for need in ("README.md", "script/narration.md"):
                if not (root / need).is_file():
                    msgs.append(f"FAIL 规则4：{e['slug']} 缺 {need}")
            theme = root / "video" / "src" / "design" / "theme.ts"
            if theme.is_file():
                src = theme.read_text(encoding="utf-8")
                for hexv in e.get("accents", []):
                    by_hex.setdefault(hexv, []).append(e["slug"])
                    if hexv not in src:
                        msgs.append(
                            f"FAIL 规则4：{e['slug']} 的 accents 色值 {hexv} "
                            "未出现在其 theme.ts"
                        )
            else:
                msgs.append(f"WARN 规则4：{e['slug']} 缺 theme.ts（工程未初始化？）")
                for hexv in e.get("accents", []):
                    by_hex.setdefault(hexv, []).append(e["slug"])
        for hexv, slugs in by_hex.items():
            if len(slugs) > 1:
                msgs.append(
                    f"FAIL 规则4：系列内撞色 {hexv} 同时出现在 {slugs[0]} 与 {slugs[1]}"
                )
        #: 供下一集选色参考（skills/06 的「已用色」登记表在此机器化）；
        #: 空系列不刷（无信息量的输出行只会稀释信噪比）。
        if by_hex:
            msgs.append(
                f"INFO 规则4：{series['id']} 已用色：{' '.join(sorted(by_hex))}"
            )

    # ── 反向登记：episodes/ 下存在、series.json 却没登记的工程目录 ──────────
    # ⚠️ 判据是**分级**的，且分级是承重设计而非折衷：若一概 FAIL，脚手架→登记
    # 的窗口期会被两条门**前后夹死**——scaffold 刻意不写 series.json（登记发布
    # 顺序是内容决策，见 scaffold.py 的「刻意不做的三件事」），此时新目录若是
    # FAIL，那就先登记再写；可一旦登记，规则 4 的 accents 校验立即要求该集
    # theme.ts 已含登记的色值——而 theme 恰恰是脚手架刻意留 TODO 的 seeded 档。
    # 于是「先登记」这条路要求先定色板色值，「先写」这条路要求先登记：死锁。
    # 分级触发把 FAIL 挪到 narration.md 落盘（= 口播定稿，规则 1 的判据已生效，
    # 反串线扫描唯独看不见这集才是真风险），而登记期以 WARN 提示不阻塞。
    episodes_dir = INFLUENCE / "episodes"
    if not episodes_dir.is_dir():
        return
    for p in sorted(episodes_dir.iterdir()):
        if not p.is_dir() or p.name in seen_slugs:
            continue
        if (p / "script" / "narration.md").is_file():
            msgs.append(
                f"FAIL 规则4：{p.name} 未登记到 series.json"
                "（已有 narration.md —— 规则 1 的反串线扫描看不到它）"
            )
        else:
            msgs.append(
                f"WARN 规则4：{p.name} 未登记到 series.json"
                "（脚手架期；写下 narration.md 后本条转 FAIL）"
            )


def rule_dead_links(files: list[Path], msgs: list[str]) -> None:
    """规则 5：受检文件内的相对链接目标必须存在。"""
    for f in files:
        try:
            text = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for m in REL_LINK_RE.finditer(text):
            target = (f.parent / m.group(1)).resolve()
            if not target.exists():
                msgs.append(f"FAIL 规则5：{f.relative_to(REPO)} 死链 {m.group(1)}")


#: Main.tsx（regioned 档）每集两处可变区域，形状在四集上稳定（verify_skeleton.py
#: 的 SCENE_IMPORT_RE / REGISTRY_ENTRY_RE 同源）：
#:   import {P2Dispatch} from './scenes/P2Dispatch';
#:   P2: P2Dispatch,
SCENE_IMPORT_LINE_RE = re.compile(
    r"import\s*\{(?P<names>[^}]+)\}\s*from\s*['\"](?P<path>\./scenes/[^'\"]+)['\"]"
)
SCENE_REGISTRY_LINE_RE = re.compile(
    r"^\s*(?P<key>P\d+)\s*:\s*(?P<val>\w+)\s*,?\s*$", re.M
)
#: 注册表的对象字面量本体。锚点的坑：`SCENE_COMPONENTS` 与赋值 `=` 之间隔着
#: 泛型注解 `: Record<string, React.FC<{scene: SceneRange}>>`——它**自带两对
#: 花括号**，取「SCENE_COMPONENTS 后第一个 `{`」会落进类型层。注解内没有
#: `=`，故先懒扫到赋值号、再取第一个 `{...}`（条目是 `P0: P0Hook,` 形状的
#: 标识符对，字面量内部无嵌套花括号，`[^{}]*` 即为本体）。
SCENE_REGISTRY_BODY_RE = re.compile(r"SCENE_COMPONENTS[^=]*=\s*(?P<body>\{[^{}]*\})")


def rule_renderability(series_list: list[dict], msgs: list[str]) -> None:
    """规则 6：storyboard 已定稿的集，注册表 ↔ 场景文件双向对齐。

    触发条件是 `script/storyboard.md` **存在**——storyboard 是场景拆解的 SSOT
    （skills/05→06 的交接物），它落地之前 scenes/ 留空是合法的脚手架期状态
    （scaffold 刻意不生成 scenes/），此刻执法只会把门变成「一建工程就红」。

    判据方向不对称是刻意的：**注册 → 文件是 FAIL**（注册了却不存在的场景，
    tsc / build 必炸——这是可以在提交前拦住的生产事故）；**文件 → 注册只
    WARN**（未注册进 SCENE_COMPONENTS 的 .tsx 可能是被其他场景 import 的合法
    辅助组件，一概 FAIL 会把那个合法形态误杀成假报）。

    解析必须**失败容忍**：Main.tsx 是 regioned 档（每集两处可变区域的 boilerplate
    文件），本规则不执法它的形状——解析不出注册表本体时跳过该集（零消息），
    绝不基于「没解析到」发 FAIL。判据的适用前提是「读到了注册表」，读不到就
    装作没看见，同 ISSUE-167 防范 3：一个常假报的门等于被关掉的门。
    """
    for ep in all_episodes(series_list):
        root = INFLUENCE / ep["path"]
        if not (root / "script" / "storyboard.md").is_file():
            continue
        src_dir = root / "video" / "src"
        scenes_dir = src_dir / "scenes"
        scene_files = sorted(scenes_dir.glob("*.tsx")) if scenes_dir.is_dir() else []
        if not scene_files:
            msgs.append(
                f"FAIL 规则6：{ep['slug']} storyboard 已定稿但 video/src/scenes/ 为空"
                "（场景组件一个未写）"
            )
            continue

        main_path = src_dir / "Main.tsx"
        if not main_path.is_file():
            continue  # Main.tsx 缺失由 verify_skeleton 的 regioned 受门档兜底
        text = main_path.read_text(encoding="utf-8")

        # 组件标识符 → import 语句声明的路径（判定「注册值是否有实体文件」）
        ident_to_path: dict[str, str] = {}
        for m in SCENE_IMPORT_LINE_RE.finditer(text):
            for name in m.group("names").split(","):
                if name.strip():
                    ident_to_path[name.strip()] = m.group("path")

        body = SCENE_REGISTRY_BODY_RE.search(text)
        if body is None:
            continue  # 解析不结论：跳过（见 docstring 的失败容忍原则）
        imported_basenames = {Path(v).stem for v in ident_to_path.values()}
        for m in SCENE_REGISTRY_LINE_RE.finditer(body.group("body")):
            key, ident = m.group("key"), m.group("val")
            # (b) 注册表条目必须有 import 且 import 指向存在的文件
            if ident not in ident_to_path:
                msgs.append(
                    f"FAIL 规则6：{ep['slug']} Main.tsx 注册 {key}: {ident} "
                    "但无对应的 scenes/ import（渲染必炸）"
                )
            elif not (src_dir / f"{ident_to_path[ident]}.tsx").is_file():
                msgs.append(
                    f"FAIL 规则6：{ep['slug']} Main.tsx 注册 {key}: {ident} "
                    f"但 {ident_to_path[ident]}.tsx 不存在"
                )
        # (c) 场景文件未被任何 import 引用 → 只 WARN（可能是场景内部拆出的合法
        # 辅助组件，也可能是写完忘了接线——两种形态人眼一秒可辨，机器不可辨）
        for f in scene_files:
            if f.stem not in imported_basenames:
                msgs.append(
                    f"WARN 规则6：{ep['slug']} {f.stem}.tsx 未注册进 Main.tsx"
                    "（可能是辅助组件，若是请确认）"
                )


def rule_site_marker(series_list: list[dict], msgs: list[str]) -> None:
    """规则 7：去站点化——观众可见层不得出现课程站点标识。

    受检面刻意只收**观众会看到的**三类文件（narration 口播+画面备注、
    storyboard、scenes 的字符串字面量），而 research/、sources.toml、
    source-map/ 不进门：内部取证链保留具名归属（署名义务在仓库层履行），
    观众层匿名化——两层口径不同是系列定位决策，不是疏漏。

    按系列分级：强标识（learn.shareai / Learn Claude Code / shareAI / 课程 /
    章号 s01–s20）全系列执法（其他系列本不该出现这些词，出现即异常）；
    「站点」一词只对课程系执法——论文系用它指论文配套网站，属正常用法。
    """
    course_paths = set()
    for series in series_list:
        if series["id"] in COURSE_SERIES_IDS:
            course_paths.update(e["path"] for e in series["episodes"])
    for g in AUDIENCE_GLOBS:
        for f in sorted(INFLUENCE.glob(g)):
            try:
                text = f.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            rel = f.relative_to(REPO)
            hits = list(SITE_MARKER_RE.finditer(text))
            is_course = f.relative_to(INFLUENCE).parts[1] in {
                p.split("/")[-1] for p in course_paths
            }
            if is_course:
                hits.extend(SITE_WORD_RE.finditer(text))
            for m in hits:
                msgs.append(
                    f"FAIL 规则7：{rel} 出现课程站点标识「{m.group(0)}」"
                    "（观众可见层须匿名化，改法见模块 docstring 规则 7）"
                )


def rule_next_ep_card(series_list: list[dict], msgs: list[str]) -> None:
    """规则 8：下期卡与 series.json 同步——身份卡标题/下期卡标题硬编码即漂移。

    P6 身份卡的本集标题、下期卡的「下期 · 层名」与下集标题，都是
    series.json 的派生数据，却是各集 P6 场景组件里的字符串字面量。
    本规则把两者机械化对账：本集身份卡标题、下集预告标题必须能在 P6
    场景文本里找到（标题含「：」时按**主标题后半段**匹配——画面卡的
    层名前缀在卡眉「下期 · X层」，正文只放副题部分）。系列更名/改标题
    时这里第一时间 FAIL，而不是等观众看到陈旧预告。仅对
    NEXT_CARD_SERIES_IDS（配了统一收尾装置的系列）执法。
    """

    def main_part(title: str) -> str:
        return title.split("：", 1)[-1] if "：" in title else title

    for series in series_list:
        if series["id"] not in NEXT_CARD_SERIES_IDS:
            continue
        eps = sorted(series["episodes"], key=lambda e: e["episode"])
        for i, e in enumerate(eps):
            p6 = INFLUENCE / e["path"] / "video/src/scenes"
            files = sorted(p6.glob("P6*.tsx")) if p6.is_dir() else []
            if not files:
                continue
            text = "".join(f.read_text(encoding="utf-8") for f in files)
            rel = files[0].relative_to(REPO)
            if main_part(e["title"]) not in text:
                msgs.append(
                    f"FAIL 规则8：{rel} 身份卡缺本集标题「{e['title']}」"
                    "（series.json 是发布顺序 SSOT，画面卡须逐字同步）"
                )
            if i + 1 < len(eps):
                nxt = eps[i + 1]
                if main_part(nxt["title"]) not in text:
                    msgs.append(
                        f"FAIL 规则8：{rel} 下期卡缺下集标题「{nxt['title']}」"
                        "（series.json 是发布顺序 SSOT，硬编码漂移即陈旧预告）"
                    )


def main() -> None:
    series_list = load_series()
    files = covered_files()
    msgs: list[str] = []
    rule_spoken_interleave(series_list, msgs)
    rule_title_order(series_list, files, msgs)
    rule_ordinal_binding(series_list, files, msgs)
    rule_manifest_integrity(series_list, msgs)
    rule_dead_links(files, msgs)
    rule_renderability(series_list, msgs)
    rule_site_marker(series_list, msgs)
    rule_next_ep_card(series_list, msgs)

    fails = [m for m in msgs if m.startswith("FAIL")]
    warns = [m for m in msgs if m.startswith("WARN")]
    for m in msgs:
        print(f"  {m}")
    n_eps = len(all_episodes(series_list))
    print(
        f">> 系列一致性 · {len(series_list)} 系列 / {n_eps} 集 · "
        f"受检 {len(files)} 文件 · FAIL {len(fails)} · WARN {len(warns)}"
    )
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
