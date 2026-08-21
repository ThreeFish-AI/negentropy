#!/usr/bin/env python3
"""科普视频管线单入口——九阶段中工具化阶段的薄编排。

此前「跑管线」= 人从 README 复制粘贴命令序列，且每集的引擎/风格/样本参数
散落三份 README（已实际漂移：README 仍教 passionate 而VOICE-CLONING 推荐位
已迁移）。本入口从每集 pipeline.toml 装配默认参数，CLI 显式参数仍可覆盖。

设计约束（刻意不做的事）：
  - 不做阶段状态机/状态文件——幂等与续跑已由内容摘要提供（{id}.sha 逐句
    sidecar；narration.json 是 narration.md 的纯函数派生），再存一份阶段状态
    就是第二事实源，必然漂移。`status` 实时派生新鲜度，零存储。
  - 不假装能跑写作阶段（①②④⑤中的人/代理部分）——只跑工具与其质量门。

用法（$R/$P 的定义见 ../README.md 路径变量约定——那里是唯一定义处，此处不复制
位置字面量，否则搬迁时又多两处要改）：
  uv run --no-project $R/pipeline.py --project $P <cmd>
子命令：status / doctor / build / check / tts / captions / render / qa / all / clean-samples
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import tomllib
import urllib.error
import urllib.request
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))  # noqa: E402 - 复用 timeline 的 load_constants

import config  # noqa: E402 - 必须在 sys.path 注入之后导入
from paths import INFLUENCE, REPO  # noqa: E402

MANUAL = "pipeline/VOICE-CLONING.md"  # 子项目根相对（见 paths.py）


def load_config(root: Path) -> tuple[dict, dict[str, str]]:
    """→ (填过默认值的配置, {键: 来源})。schema/默认值/校验全在 config.py。

    编排器对缺配置是硬失败：没有配置就真的无法装配 TTS 与渲染参数。
    校验 FAIL 同样硬失败——但 `status`/`doctor` 例外（见 main()）：诊断工具
    因为被诊断对象有病而拒绝运行是荒谬的。
    """
    cfg, origin, fails, warns = config.load(root, required=True)
    for w in warns:
        print(f"  ⚠️  {w}")
    if fails:
        sys.exit("配置校验失败：\n  " + "\n  ".join(f"❌ {f}" for f in fails))
    return cfg, origin


def run(cmd: list[str], cwd: Path | None = None) -> int:
    print(f"\n$ {' '.join(cmd)}" + (f"   (cwd={cwd})" if cwd else ""))
    return subprocess.run(cmd, cwd=cwd, check=False).returncode


def uv_no_project(
    script: str, with_pkgs: list[str], *extra: str, project: Path
) -> list[str]:
    cmd = ["uv", "run", "--no-project"]
    for p in with_pkgs:
        cmd += ["--with", p]
    cmd += [str(SCRIPTS / script), "--project", str(project), *extra]
    return cmd


# ---------------- 子命令 ----------------


def cmd_status(root: Path, _cfg: dict) -> int:
    """派生式阶段新鲜度表（无状态文件：全部由产物 mtime/摘要实时推断）。"""
    from timeline import load_constants

    narr_md = root / "script" / "narration.md"
    narr_json = root / "script" / "narration.json"
    board = root / "script" / "storyboard.md"
    manifest = root / "video" / "public" / "audio" / "manifest.json"
    draft = root / "out" / "draft.mp4"
    final = root / "out" / "final.mp4"

    def fresh(target: Path, *deps: Path) -> str:
        if not target.is_file():
            return "待产出"
        tt = target.stat().st_mtime
        stale = [d.name for d in deps if d.is_file() and d.stat().st_mtime > tt]
        return f"⚠️ 输入已更新（{', '.join(stale)}）" if stale else "✅ 新鲜"

    print(f">> {root.name} 阶段新鲜度（实时派生，无状态文件）")
    print(f"  ③ narration.json    {fresh(narr_json, narr_md)}")
    print(f"  ⑥ audio/manifest    {fresh(manifest, narr_json)}")
    if manifest.is_file():
        items = json.loads(manifest.read_text(encoding="utf-8"))
        done = sum(
            1
            for i in items
            if (root / "video/public/audio" / f"{i['id']}.mp3").is_file()
        )
        c = load_constants(root)
        from timeline import total_duration_in_frames

        mins = total_duration_in_frames(items, c) / c["fps"] / 60
        print(f"     {done}/{len(items)} 句 mp3 · 预计成片 {mins:.1f} 分钟")
    print(f"  ⑧ out/draft.mp4     {fresh(draft, manifest, board)}")
    print(
        f"  ⑨ out/final.mp4     {final.is_file() and fresh(final, draft) or '待产出'}"
    )
    return 0


def cmd_doctor(root: Path, cfg: dict, origin: dict[str, str] | None = None) -> int:
    """环境自检：配置、时序 SSOT、参考样本、IndexTTS 服务、node_modules。"""
    ok = True
    tts = cfg.get("tts", {})
    print(">> doctor")
    if origin:
        # 默认值集中进 config.py 后，单看 toml 不再自证全貌——这张带来源标记的
        # 表就是发现性补偿（git config --list --show-origin 的同类做法）。
        print("  ℹ️  生效配置（来源标注）：")
        for line in config.format_table(cfg, origin):
            print(line)
    from timeline import load_constants

    try:
        c = load_constants(root)
        print(
            f"  ✅ timing.json: fps={c['fps']} 句间={c['sentenceGapSec']}s 幕间={c['sceneGapSec']}s"
        )
    except SystemExit as e:
        print(f"  ❌ {e}")
        ok = False
    if tts.get("engine") == "indextts":
        # doctor 容忍配置 FAIL 继续跑（见 main()），故 ref 可能真的没配。此时须
        # 明说「未配置」——`INFLUENCE / ""` 会解析成子项目根，把它报成「样本缺失」
        # 是在用一个不存在的路径掩盖配置缺失，两种病因不可混为一谈。
        ref_rel = tts.get("ref")
        if not ref_rel:
            print(
                "  ❌ 未配置 tts.ref（engine=indextts 时必填，字段表见 pipeline/README.md）"
            )
            ok = False
        elif (ref := INFLUENCE / ref_rel).is_file():
            import hashlib

            sha1 = hashlib.sha1(ref.read_bytes()).hexdigest()[:12]
            match = "✅" if sha1 == tts.get("ref_sha1") else "❌ 指纹不符"
            print(f"  {match} 参考样本 {ref.name} sha1={sha1}")
            ok = ok and sha1 == tts.get("ref_sha1")
        else:
            print(f"  ⚠️  参考样本缺失: {ref}（音频不入库；用 refs.py rebuild 重建）")
        try:
            server = tts.get("server", config.default("tts.server"))
            with urllib.request.urlopen(f"{server}/health", timeout=5) as resp:
                h = json.loads(resp.read())
            print(
                f"  ✅ IndexTTS 服务: v{h.get('version')} {h.get('device')}/{h.get('dtype')}"
            )
        except (urllib.error.URLError, OSError) as e:
            print(f"  ❌ IndexTTS 服务不可达: {e}（启动命令见 {MANUAL} §二）")
            ok = False
    if not (root / "video" / "node_modules").is_dir():
        print(
            "  ⚠️  video/node_modules 未安装（渲染前: cd video && pnpm install --ignore-workspace）"
        )
    print(
        "  ℹ️  渲染主机约束：macOS + PingFang SC/Songti SC 系统字体（Linux/CI 渲染不在支持范围）"
    )
    return 0 if ok else 1


def cmd_build(root: Path, _cfg: dict) -> int:
    return run(uv_no_project("build_narration.py", [], project=root))


def cmd_check(root: Path, _cfg: dict, scenes: bool = False) -> int:
    extra = ["--check-scenes"] if scenes else []
    return run(uv_no_project("check_script.py", [], *extra, project=root))


def cmd_tts(
    root: Path,
    cfg: dict,
    plan: bool,
    force: bool,
    steady: str | None,
    style: str | None,
    allow_voice_switch: bool = False,
) -> int:
    tts = cfg.get("tts", {})
    cmd = [
        "uv",
        "run",
        "--no-project",
        "--with",
        "mutagen",
        str(root / "scripts" / "tts.py"),  # 工程内薄包装（注入 --project）
        "--engine",
        tts.get("engine", config.default("tts.engine")),
    ]
    if tts.get("engine", config.default("tts.engine")) == "indextts":
        cmd += ["--ref", str(INFLUENCE / tts["ref"])]
        if tts.get("ref_sha1"):
            cmd += ["--expect-ref-sha1", tts["ref_sha1"]]
        # style 无 SCHEMA 默认值（engine=indextts 时必填、已由 config.validate 拦），
        # 故直取而不编造兜底档名——凭空的 "sunny-steady" 会盖住配置缺失。
        cmd += [
            "--style",
            style or tts["style"],
            "--lang",
            tts.get("lang", config.default("tts.lang")),
        ]
    if plan:
        cmd.append("--plan")
    if force:
        cmd.append("--force")
    if steady:
        cmd += ["--steady", steady]
    if allow_voice_switch:
        # 两遍法经单入口的放行阀：.engine 签名护栏会拦「换风格=整集重录」，
        # 草稿遍(A)/定稿遍(B)任一换档都须显式带上（护栏原理见 tts.py §音色签名）
        cmd.append("--allow-voice-switch")
    return run(cmd, cwd=root)


def cmd_captions(root: Path, _cfg: dict) -> int:
    return run(uv_no_project("captions.py", [], project=root))


def cmd_render(root: Path, cfg: dict, final: bool) -> int:
    video = root / "video"
    if not (video / "node_modules").is_dir():
        print("先安装依赖（--ignore-workspace 隔离根 workspace）…")
        rc = run(["pnpm", "install", "--ignore-workspace"], cwd=video)
        if rc:
            return rc
    r = cfg.get("render", {})
    out = "../out/final.mp4" if final else "../out/draft.mp4"
    cmd = ["./node_modules/.bin/remotion", "render", "Main", out]
    if not final:
        cmd += [
            "--scale",
            str(r.get("draft_scale", config.default("render.draft_scale"))),
            "--jpeg-quality",
            str(
                r.get("draft_jpeg_quality", config.default("render.draft_jpeg_quality"))
            ),
        ]
    return run(cmd, cwd=video)


def cmd_qa(
    root: Path,
    cfg: dict,
    video: str | None,
    scene: str | None,
    last_n: int | None,
    ids: list[str],
    check: bool,
    scale: float | None,
) -> int:
    cmd = ["uv", "run", "--no-project"]
    if check:
        cmd += ["--with", "pillow", "--with", "numpy"]
    cmd += [str(SCRIPTS / "qa_frames.py"), "--project", str(root)]
    if scene:
        cmd += ["--scene", scene]
    if last_n:
        cmd += ["--last-n", str(last_n)]
    if check:
        cmd += ["--check"]
        # 字幕带/亮块间隔是全分辨率像素常数：草渲（0.5x）不折算则带高×2、间隔×2，
        # 侵入判据双向失真。显式 --scale 优先；未给时按产物名推断（draft → pipeline.toml）
        eff = scale
        if eff is None and video and Path(video).name == "draft.mp4":
            eff = cfg.get("render", {}).get(
                "draft_scale", config.default("render.draft_scale")
            )
        if eff is not None:
            cmd += ["--scale", str(eff)]
        else:
            print("  ⚠️  未指定 --scale 且产物非 draft.mp4：按全分辨率（1.0）体检")
    if video:
        cmd.append(video)
    cmd += ids
    return run(cmd, cwd=root)


def cmd_all(root: Path, cfg: dict) -> int:
    """build → check → tts → captions → render --draft → qa 抽帧（含自动体检）。"""
    for step in (
        lambda: cmd_build(root, cfg),
        lambda: cmd_check(root, cfg),
        lambda: cmd_tts(root, cfg, plan=False, force=False, steady=None, style=None),
        lambda: cmd_captions(root, cfg),
        lambda: cmd_render(root, cfg, final=False),
    ):
        if rc := step():
            return rc
    print("\n>> 草渲完成。尾幕必查（渐黑过早缺陷的回归点）：")
    # 全部路径用绝对值：脚本/工程/视频各自相对不同 CWD，混用相对路径则任一工作目录照抄必有一端落空
    print(
        f"   uv run --no-project --with pillow --with numpy {SCRIPTS / 'qa_frames.py'} \\"
    )
    draft_scale = cfg.get("render", {}).get(
        "draft_scale", config.default("render.draft_scale")
    )
    print(
        f"       --project {root} {root / 'out' / 'draft.mp4'} --last-n 6 --check"
        f" --scale {draft_scale}   # 草渲像素折算，不可省"
    )
    return 0


def cmd_clean_samples(_root: Path, _cfg: dict) -> int:
    d = REPO / ".temp" / "voice-samples"
    if d.is_dir():
        import shutil

        shutil.rmtree(d)
        print(f"已删除 {d}（小样含本人音色，属生物特征信息）")
    else:
        print(f"无待清理目录: {d}")
    return 0


def cmd_stages() -> int:
    """打印九阶段声明表（替代 README 手维护的阶段表；声明源 pipeline/stages.toml）。

    与工程无关，故不读 pipeline.toml。
    """
    decl = tomllib.loads((SCRIPTS.parent / "stages.toml").read_text(encoding="utf-8"))
    print(
        ">> 九阶段（声明源 pipeline/stages.toml；authored=撰写产出 / tooled=工具产出）\n"
    )
    for st in decl["stage"]:
        cmds = " ".join(st["commands"]) or "—"
        print(
            f"  {st['ordinal']} {st['name']:<22} [{st['kind']:<8}] 命令 {cmds:<18} {st['skill']}"
        )
        print(f"      门：{st['gate']}")
    print(
        "\n  注：序号与文件号刻意不对齐 —— ⑥↔07-tts-voice、⑦↔06-remotion-implementation"
        "（入链 ≥5 处，重命名代价大于收益；由 tests/test_stages.py 守住）"
    )
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(
        description="科普视频管线单入口（薄编排，阶段契约见 pipeline/README.md）"
    )
    ap.add_argument(
        "--project",
        default=".",
        help="视频工程根目录（含 pipeline.toml）；须置于子命令之前",
    )
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status", help="阶段新鲜度（实时派生）")
    sub.add_parser("doctor", help="环境自检")
    sub.add_parser("build", help="③ narration.md → narration.json")
    p = sub.add_parser("check", help="④⑤ 内容门")
    p.add_argument(
        "--check-scenes",
        action="store_true",
        help="附:分镜↔场景代码 beat 互比（WARN-only）",
    )
    sub.add_parser("captions", help="⑥+ 导出 srt/vtt")
    sub.add_parser("clean-samples", help="清理 .temp/voice-samples（生物特征）")
    p = sub.add_parser("tts", help="⑥ 配音合成（参数来自 pipeline.toml）")
    p.add_argument("--plan", action="store_true", help="只看排期不实跑")
    p.add_argument("--force", action="store_true", help="忽略缓存")
    p.add_argument("--steady", help="混合档选择器")
    p.add_argument("--style", help="覆写风格（两遍法草稿遍用 --style sunny）")
    p.add_argument(
        "--allow-voice-switch",
        action="store_true",
        help="放行音色签名变更（两遍法换档经单入口时须带上，否则被 .engine 护栏硬拦）",
    )
    p = sub.add_parser("render", help="⑧⑨ 渲染")
    p.add_argument("--final", action="store_true", help="终渲（默认草渲）")
    p = sub.add_parser("qa", help="⑧ 抽帧 QA")
    p.add_argument(
        "--video",
        help="渲染产物路径，**按分集工程目录解析**（本入口以 cwd=<工程> 启动 "
        "qa_frames.py）——写 out/draft.mp4，勿写 $P/out/draft.mp4",
    )
    p.add_argument("--scene")
    p.add_argument("--last-n", type=int)
    p.add_argument("--check", action="store_true", help="自动体检")
    p.add_argument(
        "--scale",
        type=float,
        help="产物缩放系数（草渲不传时按 draft.mp4 自动取 pipeline.toml 的 draft_scale）",
    )
    p.add_argument("ids", nargs="*")
    sub.add_parser("all", help="build→check→tts→captions→render(草渲) 一键链")
    sub.add_parser("stages", help="打印九阶段声明表（与工程无关）")
    args = ap.parse_args()

    root = Path(args.project).resolve()
    # 与具体工程无关的子命令不读 pipeline.toml —— 否则「某集 toml 写坏」会连带
    # 让「清理生物特征小样」和「查阶段表」都无法执行，属荒谬耦合。
    if args.cmd == "stages":
        sys.exit(cmd_stages())
    if args.cmd == "clean-samples":
        sys.exit(cmd_clean_samples(root, {}))
    # status/doctor 是诊断工具：配置有病时它们尤其该运行，故只报不退
    if args.cmd in {"status", "doctor"}:
        cfg, origin, fails, warns = config.load(root, required=True)
        for w in warns:
            print(f"  ⚠️  {w}")
        for f in fails:
            print(f"  ❌ 配置：{f}")
    else:
        cfg, origin = load_config(root)
    t0 = time.time()
    rc = {
        "status": lambda: cmd_status(root, cfg),
        "doctor": lambda: cmd_doctor(root, cfg, origin),
        "build": lambda: cmd_build(root, cfg),
        "check": lambda: cmd_check(root, cfg, args.check_scenes),
        "tts": lambda: cmd_tts(
            root,
            cfg,
            args.plan,
            args.force,
            args.steady,
            args.style,
            args.allow_voice_switch,
        ),
        "captions": lambda: cmd_captions(root, cfg),
        "render": lambda: cmd_render(root, cfg, args.final),
        "qa": lambda: cmd_qa(
            root,
            cfg,
            args.video,
            args.scene,
            args.last_n,
            args.ids,
            args.check,
            args.scale,
        ),
        "all": lambda: cmd_all(root, cfg),
        "clean-samples": lambda: cmd_clean_samples(root, cfg),
    }[args.cmd]()
    print(f"\n>> {args.cmd} 完成（{time.time() - t0:.1f}s，退出码 {rc}）")
    sys.exit(rc)


if __name__ == "__main__":
    main()
