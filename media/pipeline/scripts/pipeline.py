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

用法：uv run --no-project media/pipeline/scripts/pipeline.py <cmd> --project media/<工程>
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
REPO = SCRIPTS.parents[2]
sys.path.insert(0, str(SCRIPTS))  # noqa: E402 - 复用 timeline 的 load_constants

MANUAL = "media/pipeline/VOICE-CLONING.md"


def load_config(root: Path) -> dict:
    cfg_path = root / "pipeline.toml"
    if not cfg_path.is_file():
        sys.exit(
            f"缺少分集配置: {cfg_path}\n  可执行参数已收敛至 pipeline.toml"
            "（见 media/pipeline/README.md 字段表）；直接调用底层脚本亦可"
        )
    return tomllib.loads(cfg_path.read_text(encoding="utf-8"))


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


def cmd_doctor(root: Path, cfg: dict) -> int:
    """环境自检：配置、时序 SSOT、参考样本、IndexTTS 服务、node_modules。"""
    ok = True
    tts = cfg.get("tts", {})
    print(">> doctor")
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
        ref = REPO / tts.get("ref", "")
        if ref.is_file():
            import hashlib

            sha1 = hashlib.sha1(ref.read_bytes()).hexdigest()[:12]
            match = "✅" if sha1 == tts.get("ref_sha1") else "❌ 指纹不符"
            print(f"  {match} 参考样本 {ref.name} sha1={sha1}")
            ok = ok and sha1 == tts.get("ref_sha1")
        else:
            print(f"  ⚠️  参考样本缺失: {ref}（音频不入库；用 refs.py rebuild 重建）")
        try:
            server = tts.get("server", "http://127.0.0.1:8766")
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
        tts.get("engine", "indextts"),
    ]
    if tts.get("engine", "indextts") == "indextts":
        cmd += ["--ref", str(REPO / tts["ref"])]
        if tts.get("ref_sha1"):
            cmd += ["--expect-ref-sha1", tts["ref_sha1"]]
        cmd += [
            "--style",
            style or tts.get("style", "sunny-steady"),
            "--lang",
            tts.get("lang", "ZH"),
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
            str(r.get("draft_scale", 0.5)),
            "--jpeg-quality",
            str(r.get("draft_jpeg_quality", 60)),
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
            eff = cfg.get("render", {}).get("draft_scale", 0.5)
        if eff is not None:
            cmd += ["--scale", str(eff)]
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
    print(
        f"       --project {root} {root / 'out' / 'draft.mp4'} --last-n 6 --check"
        f" --scale {cfg.get('render', {}).get('draft_scale', 0.5)}   # 草渲像素折算，不可省"
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


def main() -> None:
    ap = argparse.ArgumentParser(
        description="科普视频管线单入口（薄编排，阶段契约见 media/pipeline/README.md）"
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
    p.add_argument("--video", help="渲染产物路径")
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
    args = ap.parse_args()

    root = Path(args.project).resolve()
    cfg = load_config(root)
    t0 = time.time()
    rc = {
        "status": lambda: cmd_status(root, cfg),
        "doctor": lambda: cmd_doctor(root, cfg),
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
