#!/usr/bin/env python3
"""新集脚手架——从命名的模板实例化，替代「cp -r 任一既有集」。

此前 README 的原话是「以**任一**既有集工程为模板复制 video/ 骨架」。「任一」
就是那个 SSOT 违规：391 行冻结基建因此有 4 个同权真理声明者，而「改一处须同步」
的义务没有判据、从未被执行。本脚本让复制源头有名字，`verify_skeleton.py` 让
义务有判据。

## 刻意不做的三件事

1. **不生成 scenes/**。目录留空，场景骨架样例只在模板里（scenes-EXAMPLE.tsx.txt，
   刻意不用 .tsx 后缀，免得被 tsc 收进去）。切割线是有意的：脚手架只拿走**机械
   复制**（那 391 行你本来就不该逐行读的冻结基建），保留**创作性撰写**（theme
   与 scenes 必须读 skills/06 才写得对）。手抄一遍学到的东西不该被一键抹掉。
2. **不改根 .gitignore**。会修改仓库根文件的脚手架是爆炸半径的意外扩张；且
   ignore 规则已通配到分集级，新集自动覆盖，本来就无需这一步。
3. **不写 series.json**。登记发布顺序是内容决策（要定 episode 序号、色板、
   sourceKind），不是机械步骤；`check_series.py` 会对漏登记大声 FAIL。

用法：
  uv run --no-project $R/scaffold.py <slug>-video --title "本集标题"
"""

from __future__ import annotations

import argparse
import shutil
import sys
import tomllib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from paths import INFLUENCE  # noqa: E402

TEMPLATE = INFLUENCE / "pipeline" / "templates" / "video-skeleton"
EPISODES = INFLUENCE / "episodes"


def render(text: str, subs: dict[str, str]) -> str:
    for k, v in subs.items():
        text = text.replace(f"{{{{{k}}}}}", v)
    return text


def main() -> int:
    ap = argparse.ArgumentParser(description="从模板实例化新集工程")
    ap.add_argument(
        "slug", help="工程目录名，须以 -video 结尾（= series.json 的 slug）"
    )
    ap.add_argument(
        "--title", required=True, help="本集标题（写入 README 与 package.json）"
    )
    ap.add_argument("--ref", default="me-bright", help="参考样本名（见 refs.py list）")
    #: 占位符**必须自身合规**（12 位）：config.validate 的位数检查是全节执法，
    #: 而 pipeline.py 对每个子命令都以 scope=None 校验——一个 11 位的占位会让刚
    #: 实例化的新集连 `build`（Stage ③，与 TTS 无关）都跑不起来。指纹不符仍由
    #: doctor 与 tts.py 的 --expect-ref-sha1 硬拦，占位不会被误当成真值。
    ap.add_argument("--ref-sha1", default="TODOTODOTODO", help="样本 12 位指纹")
    ap.add_argument("--style", default="sunny-steady", help="风格预设档名")
    ap.add_argument("--force", action="store_true", help="目标已存在时仍继续（危险）")
    args = ap.parse_args()

    if not args.slug.endswith("-video"):
        sys.exit(f"slug 须以 -video 结尾（与既有四集一致）：{args.slug!r}")
    dest = EPISODES / args.slug
    if dest.exists() and not args.force:
        sys.exit(f"目标已存在：{dest}（如确要覆盖请加 --force）")

    skel = tomllib.loads((TEMPLATE / "skeleton.toml").read_text(encoding="utf-8"))
    subs = {
        "SLUG": args.slug,
        "TITLE": args.title,
        "REF": args.ref,
        "REF_SHA1": args.ref_sha1,
        "STYLE": args.style,
    }

    #: 只留在模板里、不复制进新集的文件。scenes-EXAMPLE 是刻意的（见文件头
    #: 「不生成 scenes/」）：抄骨架的过程本身有价值，样例留在模板供查阅。
    TEMPLATE_ONLY = {"skeleton.toml", "scenes-EXAMPLE.tsx.txt"}

    copied, rendered = 0, 0
    for src in sorted(TEMPLATE.rglob("*")):
        if not src.is_file() or src.name in TEMPLATE_ONLY:
            continue
        rel = src.relative_to(TEMPLATE)
        if src.suffix == ".tmpl":
            target = dest / rel.with_suffix("")  # 去掉 .tmpl
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(
                render(src.read_text(encoding="utf-8"), subs), encoding="utf-8"
            )
            rendered += 1
        else:
            target = dest / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, target)
            copied += 1

    # 内容层空目录（写作阶段的产物落点，刻意不给模板内容）
    for d in ("research", "script"):
        (dest / d).mkdir(parents=True, exist_ok=True)

    print(
        f">> 已实例化 {dest.relative_to(INFLUENCE)}：复制 {copied} 文件 / 渲染 {rendered} 模板\n"
    )
    print("接下来**必须**人工完成的（脚手架刻意不代做）：")
    print(
        "  1. research/ 取证：Stage ① —— A 型论文走 paper_extract.py，B 型走 source_ledger.py"
    )
    print("  2. script/planning.md：Stage ② 六节齐，含本集视觉契约（色彩语义）")
    print(
        "  3. video/src/design/theme.ts：换本集概念色（≥4.5:1，色相不与系列已用色撞车）"
    )
    print(
        "  4. script/narration.md → storyboard.md → video/src/scenes/*.tsx（全部新写）"
    )
    print(
        "  5. video/src/Main.tsx：填 scenes/ import 与 SCENE_COMPONENTS 注册表"
        "（模板两处刻意留空，故新集开箱即 tsc 干净）"
    )
    print(
        "  6. 登记到 series.json（漏登无阻塞门：verify_skeleton.py 会点名警告孤儿目录）"
    )
    print(
        "  7. cd video && pnpm install --ignore-workspace（装完核对根 lockfile 零变更）"
    )
    print(
        f"\n  冻结档位与漂移判据见 {(TEMPLATE / 'skeleton.toml').relative_to(INFLUENCE)}"
        f"（{len(skel['classes'].get('frozen', []))} 个 frozen 文件已复制，勿改）"
    )
    print("  实例化后立刻跑一次：uv run --no-project $R/verify_skeleton.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
