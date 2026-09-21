"""archify 工程图批量重录驱动（遍历分集 views/ 清单，逐图调 record_archify.py）。

用法（仓库根）：
  uv run --with playwright python $R/record_archify_all.py --project $P
  uv run --with playwright python $R/record_archify_all.py --project $P --dry-run
  uv run --with playwright python $R/record_archify_all.py --project $P --only agent-identity --force

为什么要有这个驱动：mp4 / *-end.png 是派生产物（根 .gitignore 明写「HTML 为 SSOT，
sidecar json 入库」），所以**换一个 worktree 就要全量重录一次**——这是常规操作而非
一次性动作。此前唯一文档化的方式是一条含 <slug> 占位符的单图模板，重录全集要手工
替换 67 次；录制因此成了这条链路上唯一的手工步骤（下游测 lead 与生成 manifest 都自带
遍历）。占位符没替换正是 2026-09-21 那次裸 traceback 的来源。

职责边界（正交分解）：record_archify.py = 机制（怎么录一张图），本驱动 = 策略
（录哪些、跳过谁、失败了怎么报）。不把 --all 塞进录制器，两者各自单一职责。

为什么串行：录制走 channel="chrome" 起真实浏览器，多实例互抢前台焦点会掉帧；而
--min-fps 只告警不失败，掉帧会**静默**污染产物。本机另有过热导致时序漂移的先例。
宁可慢，不要一批悄悄降质的素材。
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import config
from record_archify import find_remotion

REPO_ROOT = Path(__file__).resolve().parents[4]
RECORDER = Path(__file__).resolve().parent / "record_archify.py"


def prior_type(sidecar: Path) -> str:
    """既有 sidecar 里人工审定的图型——重录必须**保住**它。

    录制器对 type 的兜底是指纹嗅探（_sniff_diagram_type），而本集 67 张里有 14 张
    嗅不出（7 张 lifecycle + 7 张无框平铺 architecture）。不透传就会让 lifecycle
    整型消失、图型多样性 5 → 4；而本集 min_diagram_types 恰好是 4，**门照样绿**。
    绿着的门盖住退化的片子，是这条链路上最不该留的缺口。
    """
    if not sidecar.is_file():
        return ""
    try:
        return json.loads(sidecar.read_text(encoding="utf-8")).get("type") or ""
    except (json.JSONDecodeError, OSError):
        return ""


def diagram_types(archify_dir: Path, slugs: list[str]) -> set[str]:
    """→ 这批 slug 当前在库的图型集合（空 type 不计）。"""
    return {t for s in slugs if (t := prior_type(archify_dir / f"{s}.json"))}


def expected_products(sidecar: Path, out_dir: Path) -> list[Path]:
    """→ 该图应当存在的产物（视频 + 末帧 PNG）。

    以入库 sidecar 的 chapters[] 为准而非重新推导命名：sidecar 是「上次录成什么样」
    的事实记录，例外图（产物名 ≠ 文件名派生 slug）也只有它说得准。
    读不出就返回空列表 —— 空列表在调用方被当作「无法判定，必须重录」。
    """
    if not sidecar.is_file():
        return []
    try:
        data = json.loads(sidecar.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    out: list[Path] = []
    for ch in data.get("chapters", []):
        for key in ("file", "end_still"):
            if name := ch.get(key):
                out.append(out_dir / name)
    return out


def stale_reason(sidecar: Path, views: Path, products: list[Path]) -> str:
    """→ 非空理由 = 产物虽齐但不可信，须重录；空串 = 可跳过。

    存在性判据的两道盲区，都在此补上：
      - **mtime 一致性**：录制器逐章写产物、全部录完才写 sidecar，故「产物新于
        sidecar」只能来自一次被打断/失败的重录——留下的新旧章混合素材里，sidecar
        的 lead_sec 仅对旧章成立，静默混剪即废片；
      - **章节集对齐**：sidecar 只记「上次录成什么样」，views JSON 才是「现在要
        什么」；views 增删章后旧清单仍判已齐，新章永远录不上（要等 tsc/渲染期
        才炸，归因极难）。只比集合不比顺序——章序不影响按 id 取材。
    """
    try:
        data = json.loads(sidecar.read_text(encoding="utf-8"))
        sc_m = sidecar.stat().st_mtime
    except (json.JSONDecodeError, OSError):
        return ""  # sidecar 读不出：expected_products 已空，调用方判「必须重录」
    if any(p.is_file() and p.stat().st_mtime > sc_m for p in products):
        return "产物新于 sidecar（上次重录未完成，新旧章混合态）"
    try:
        want = {v.get("id") for v in json.loads(views.read_text(encoding="utf-8"))}
    except (json.JSONDecodeError, OSError):
        return ""  # views 读不出：录制器的 --views 注入同样会失败并点名，不重复执法
    have = {c.get("id") for c in data.get("chapters", [])}
    if want != have:
        diff = "、".join(sorted(str(x) for x in want ^ have))
        return f"views 与 sidecar 章节集不一致（{diff}）"
    return ""


def main() -> None:
    ap = argparse.ArgumentParser(description="archify 工程图批量重录驱动")
    ap.add_argument("--project", required=True, help="分集工程根（如 $P）")
    ap.add_argument("--only", help="逗号分隔的 slug 子集；缺省 = views/ 下全部")
    ap.add_argument(
        "--force", action="store_true", help="产物已齐也重录（缺省跳过已齐的图）"
    )
    ap.add_argument("--dry-run", action="store_true", help="只做映射与预检，不起浏览器")
    a = ap.parse_args()

    root = Path(a.project).resolve()
    archify_dir = root / "video" / "public" / "archify"
    views_dir = archify_dir / "views"
    if not views_dir.is_dir():
        sys.exit(
            f"FAIL: views 目录不存在：{views_dir}\n"
            f"      --project 应指向分集工程根（含 video/public/archify/views/）。"
        )

    cfg, _origin, cfg_fails, cfg_warns = config.load(
        root, required=False, scope={"archify"}
    )
    for w in cfg_warns:
        print(f"  WARN {w}", file=sys.stderr)
    if cfg_fails:
        sys.exit("FAIL: pipeline.toml 配置有误：\n      " + "\n      ".join(cfg_fails))
    arch = cfg.get("archify", {})
    html_dir = REPO_ROOT / arch.get("html_dir", config.default("archify.html_dir"))
    pattern = arch.get("html_pattern", config.default("archify.html_pattern"))
    overrides = arch.get("html_overrides", config.default("archify.html_overrides"))

    slugs = sorted(p.stem for p in views_dir.glob("*.json"))
    if not slugs:
        sys.exit(f"FAIL: {views_dir} 下没有 views JSON——无图可录。")
    if a.only:
        want = [s.strip() for s in a.only.split(",") if s.strip()]
        if unknown := [s for s in want if s not in slugs]:
            sys.exit(
                f"FAIL: --only 里有 views/ 下不存在的图名：{', '.join(unknown)}\n"
                f"      清单见 {views_dir}/ 下的文件名。"
            )
        slugs = want

    # 映射 + 源图存在性：全部先验完再开录，免得跑到第 40 分钟才发现某张缺源图。
    plan: list[tuple[str, Path, bool]] = []
    missing: list[str] = []
    for slug in slugs:
        overridden = slug in overrides
        name = overrides[slug] if overridden else pattern.format(slug=slug)
        html = html_dir / name
        if not html.is_file():
            missing.append(f"{slug} → {html}")
            continue
        plan.append((slug, html, overridden))
    if missing:
        sys.exit(
            "FAIL: 以下图找不到源 HTML（约定 = html_pattern，例外走 html_overrides）：\n      "
            + "\n      ".join(missing)
        )

    if find_remotion() is None:
        # dry-run 的用途正是「装依赖之前先把映射核对干净」，故此处降为告警。
        msg = (
            "未找到任何集的 video/node_modules/.bin/remotion——先 pnpm install"
            "（cdp 采集用它的内置 ffmpeg 编码）"
        )
        if a.dry_run:
            print(f"  WARN {msg}", file=sys.stderr)
        else:
            sys.exit(f"FAIL: {msg}\n      此处预检，免得录完才失败。")

    done, skipped, failed = [], [], []
    types_before = diagram_types(archify_dir, [s for s, _h, _o in plan])
    print(f"计划重录 {len(plan)} 图（串行）；源图目录 {html_dir}")
    for i, (slug, html, overridden) in enumerate(plan, 1):
        sidecar = archify_dir / f"{slug}.json"
        views = views_dir / f"{slug}.json"
        products = expected_products(sidecar, archify_dir)
        # 「已齐」= 文件齐**且**不属于混合/陈旧态；不可信的产物要点名重录，
        # 静默当作已齐等于把两代素材混进成片（两道判据见 stale_reason）。
        gap = stale_reason(sidecar, views, products) if products else ""
        if (
            not a.force
            and products
            and not gap
            and all(p.is_file() and p.stat().st_size > 0 for p in products)
        ):
            skipped.append(slug)
            print(f"[{i}/{len(plan)}] 跳过 {slug}（{len(products)} 个产物已齐）")
            continue

        cmd = [
            sys.executable,
            str(RECORDER),
            str(html),
            "/dev/null",
            str(sidecar),
            "--mode",
            "chapter",
            "--all-chapters",
            "--out-dir",
            str(archify_dir),
        ]
        if views.is_file():
            cmd += ["--views", str(views)]
        # 例外图的文件名派生 slug 与产物名对不上，必须显式钉住，否则产出的 mp4
        # 叫不上 manifest 期望的名字，渲染期才 throw。
        if overridden:
            cmd += ["--slug", slug]
        # 审定图型必须活过重录：嗅探对 14/67 张无效，不透传即静默丢型。
        if t := prior_type(sidecar):
            cmd += ["--type", t]

        label = f"{slug}（例外源图 {html.name}）" if overridden else slug
        why = f"；{gap}" if gap else ""
        print(f"[{i}/{len(plan)}] 录制 {label}{why}")
        if a.dry_run:
            done.append(slug)
            continue
        # 逐图独立进程：单图崩溃不拖垮整批，且每张图拿到干净的浏览器状态。
        r = subprocess.run(cmd, stdout=subprocess.PIPE, text=True)
        if r.returncode == 0:
            done.append(slug)
        else:
            failed.append(slug)
            print(f"  ✗ {slug} 退出码 {r.returncode}", file=sys.stderr)

    verb = "预演" if a.dry_run else "录成"
    print(f"\n{verb} {len(done)} · 跳过 {len(skipped)} · 失败 {len(failed)}")
    # 跳过项必须点名：无声截断等于谎报覆盖。
    if skipped:
        print(f"  跳过（产物已齐，--force 可强制重录）：{', '.join(skipped)}")
    if failed:
        print(f"  失败：{', '.join(failed)}")

    lost: set[str] = set()
    if not a.dry_run:
        types_after = diagram_types(archify_dir, [s for s, _h, _o in plan])
        if lost := types_before - types_after:
            print(
                f"  FAIL 图型在重录中丢失：{sorted(lost)}"
                f"——覆盖门的 min_diagram_types 可能恰好放行这次退化，勿忽略"
            )
    if not a.dry_run and done:
        print(
            "  下一步：scripts/archify_lead.py 测定 lead_sec（录制器恒写 0.0，"
            "漏跑则每章片头把场记板白闪播进成片）→ scripts/archify_manifest.py"
        )
    if failed or lost:
        sys.exit(1)


if __name__ == "__main__":
    main()
