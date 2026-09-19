"""archify 工程图引导故事录制器（Playwright + 系统 Chrome，2026-09 Context Layer 双集引入）。

用法（仓库根）：
  # 旧行为（整故事一段，逐字节兼容）
  uv run --with playwright python $R/record_archify.py <工程图.html 绝对路径> <输出.webm> <sidecar.json>

  # 逐章录制（推荐）：每章一段 webm，片内 lead 约 2s（实测 1.96–4.60s，须测定不可估算）
  uv run --with playwright python $R/record_archify.py <html> <忽略> <sidecar.json> \
      --mode chapter --all-chapters --out-dir <目录> [--views <views.json>]

行为：
  - 1920x1080 视口、暗色主题（localStorage 锁定）、隐藏交互外壳
  - story 模式：键盘 P 触发整故事，轮询 aria-pressed 回落 = 播完（旧行为）
  - chapter 模式：逐章 activate() + playCurrent()（scope='chapter' 播完自停），每章独立成段
  - sidecar 记录 lead/story 秒数，供 Remotion OffthreadVideo trimBefore 裁掉片头空白

为什么逐章而不是「整段录完再按时间戳切片」：
  单段切片的 trimBefore 要达 15s 量级，任何换算次序上的理解偏差都被整段长度放大；逐章
  录制把它压到单章片头一次，**且这个 lead 是测出来的不是估出来的**——录完必须接着跑
  scripts/archify_lead.py 用场记板白闪定位真实起点（14 图实测 1.96–4.60s，量级 ~2s）。
  跳过测定就等于给每章片头留 2–4s 的页面加载与入场落定。

末帧 PNG 必须与 webm **同构同框**（都截 1920x1080 整视口）：它是 ArchifyClip 在
fit='hold' 时冻结补足用的素材，一旦改截 .diagram-container 元素，长宽比随图而异，
进同一个 16:9 画框做 contain 就会在切换瞬间突跳（放大约 25% 且丢掉标题行与注释卡，
2026-09-19 抽帧对拍发现）。

另：playCurrent() 会置 data-share-playback="true"，CSS 据此关掉 ambient trace 入场描流
（5 张图开了 trace），避免描流与引导故事叠放。
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

HIDE_CSS = """
/* 录制视图：隐藏交互外壳（工具栏/缩放导航/章节索引/旅程条），保留图形本体 */
.toolbar, .diagram-nav, .guided-view-index, .route-journey-bar,
header.app-header, .share-cue, .print-only, #guided-views { display: none !important; }
html, body { background: #0E1116 !important; }
#archify-clapper { position: fixed; inset: 0; background: #FFFFFF; z-index: 2147483647; }
"""

# 章节推进探针：只观察 DOM 属性，零侵入（setStoryBeat / renderStoryTrail / syncStoryPlayback 写入）
PROBE_JS = """
window.__archify = {beats: []};
(function () {
  var attach = function () {
    var svg = document.querySelector('.diagram-container svg');
    if (!svg) { return setTimeout(attach, 50); }
    var push = function () {
      var raw = svg.getAttribute('data-story-beat');
      if (!raw) return;
      var n = Number(raw.split('/')[0]);
      var view = svg.getAttribute('data-story-active');
      var b = window.__archify.beats;
      var last = b[b.length - 1];
      if (last && last.view === view && last.beat === n) return;
      b.push({t: performance.now(), view: view, beat: n, total: Number(raw.split('/')[1])});
    };
    new MutationObserver(push).observe(svg, {
      attributes: true,
      attributeFilter: ['data-story-beat', 'data-story-active', 'data-story-playing'],
    });
  };
  attach();
})();
"""


def dwell_ms(n: int) -> float:
    """archify 的 storyBeatDwell：每拍停留 = max(1100, 3200/拍数)（viewer 内硬编码）。"""
    return max(1100.0, 3200.0 / max(1, n))


def read_views(src: Path) -> list:
    m = re.search(
        r'id="archify-guided-views-data"[^>]*>([\s\S]*?)</script>',
        src.read_text(encoding="utf-8"),
    )
    if not m:
        return []
    try:
        return json.loads(m.group(1) or "[]")
    except json.JSONDecodeError:
        return []


def materialize(src: Path, views_file: Path | None, tmpdir: Path) -> tuple[Path, list]:
    """需要注入 views 时产出临时副本；canonical HTML 永不被改动。"""
    if views_file is None:
        return src, read_views(src)
    views = json.loads(views_file.read_text(encoding="utf-8"))
    html = src.read_text(encoding="utf-8")
    payload = json.dumps(views, ensure_ascii=False)
    patched, n = re.subn(
        r'(id="archify-guided-views-data"[^>]*>)([\s\S]*?)(</script>)',
        lambda m: m.group(1) + payload + m.group(3),
        html,
        count=1,
    )
    if n != 1:
        sys.exit(
            f"FAIL: {src.name} 未找到 archify-guided-views-data 容器，无法注入 views"
        )
    out = tmpdir / src.name
    out.write_text(patched, encoding="utf-8")
    return out, views


def measure_fps(webm: Path) -> float | None:
    """用 remotion 内置 ffprobe 实测均帧率（Playwright screencast 是 VFR）。

    注意取 **format=duration** 而非 stream=duration：webm 的流级 duration 恒为
    N/A，早先按流级取会让本函数永远返回 None、--min-fps 门形同虚设
    （2026-09-19 实测发现）。
    """
    video_root = Path(__file__).resolve().parents[2] / "episodes"
    for proj in video_root.glob("*/video"):
        exe = proj / "node_modules" / ".bin" / "remotion"
        if not exe.is_file():
            continue
        try:

            def probe(args: list[str], exe: Path = exe, proj: Path = proj) -> str:
                r = subprocess.run(
                    [str(exe), "ffprobe", "-v", "error", *args, str(webm.resolve())],
                    capture_output=True,
                    text=True,
                    timeout=120,
                    cwd=str(proj),
                    check=False,
                )
                return r.stdout.strip().split("=")[-1]

            dur = float(
                probe(["-show_entries", "format=duration", "-of", "default=nw=1"])
            )
            n = float(
                probe(
                    [
                        "-select_streams",
                        "v:0",
                        "-count_frames",
                        "-show_entries",
                        "stream=nb_read_frames",
                        "-of",
                        "default=nw=1",
                    ]
                )
            )
            return round(n / dur, 2) if dur > 0 else None
        except (OSError, ValueError, subprocess.SubprocessError):
            # fps 只作体检参考，探测失败不该让整场录制失败
            return None
    return None


def new_ctx(browser, tmpvid: Path):
    ctx = browser.new_context(
        viewport={"width": 1920, "height": 1080},
        color_scheme="dark",
        reduced_motion="no-preference",
        record_video_dir=str(tmpvid),
        record_video_size={"width": 1920, "height": 1080},
    )
    ctx.add_init_script(
        "try { localStorage.setItem('archify-theme', 'dark'); } catch (e) {}"
    )
    ctx.add_init_script(PROBE_JS)
    return ctx


def open_page(ctx, src: Path):
    page = ctx.new_page()
    page.goto("about:blank")
    page.goto(f"file://{src}")
    page.wait_for_load_state("networkidle")
    page.add_style_tag(content=HIDE_CSS)
    return page


def clapper(page) -> None:
    """播放前 2 帧全屏白闪 —— 视频钟零点，避免用 Python 墙钟推视频钟。"""
    page.evaluate("""() => new Promise((res) => {
      const d = document.createElement('div'); d.id = 'archify-clapper';
      document.body.appendChild(d);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setTimeout(() => { d.remove(); res(true); }, 150);
      }));
    })""")


def main() -> None:
    ap = argparse.ArgumentParser(description="archify 引导故事录制器")
    ap.add_argument("src")
    ap.add_argument("out_webm")
    ap.add_argument("out_sidecar")
    ap.add_argument("--mode", choices=["story", "chapter"], default="story")
    ap.add_argument("--all-chapters", action="store_true")
    ap.add_argument("--out-dir")
    ap.add_argument("--views", help="views JSON；注入临时副本，canonical HTML 不动")
    ap.add_argument("--min-fps", type=float, default=18.0)
    ap.add_argument("--settle-ms", type=int, default=1200)
    a = ap.parse_args()

    src = Path(a.src).resolve()
    slug = src.stem.split("--")[-1]
    out_dir = (
        Path(a.out_dir).resolve() if a.out_dir else Path(a.out_webm).resolve().parent
    )
    out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        page_src, views = materialize(
            src, Path(a.views).resolve() if a.views else None, tmp
        )
        if not views:
            sys.exit(
                f"FAIL: {src.name} 的 archify-guided-views-data 为空，引导故事不可播。\n"
                f"      请用 --views <views.json> 注入，或先给 archify 源补 meta.views。"
            )

        with sync_playwright() as p:
            browser = p.chromium.launch(
                channel="chrome",
                headless=True,
                args=["--force-color-profile=srgb", "--disable-lcd-text"],
            )
            if a.mode == "story":
                sidecar = record_story(browser, page_src, tmp, out_dir, a)
            else:
                sidecar = record_chapters(
                    browser, page_src, tmp, out_dir, slug, views, a
                )
            browser.close()

    sidecar["source"] = str(src)
    sidecar["slug"] = slug
    Path(a.out_sidecar).write_text(
        json.dumps(sidecar, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    print(json.dumps(sidecar, ensure_ascii=False))


def record_story(browser, page_src, tmp, out_dir, a) -> dict:
    """旧行为：键盘 P 播整故事，轮询 aria-pressed 回落。"""
    tmpvid = tmp / "story"
    tmpvid.mkdir()
    ctx = new_ctx(browser, tmpvid)
    t0 = time.time()
    page = open_page(ctx, page_src)
    page.wait_for_selector("#guided-view-play", state="attached", timeout=15000)
    page.wait_for_timeout(a.settle_ms)
    t_play = time.time()
    page.keyboard.press("p")
    became, deadline = False, time.time() + 180
    while time.time() < deadline:
        state = page.get_attribute("#guided-view-play", "aria-pressed")
        if state == "true":
            became = True
        elif became:
            break
        page.wait_for_timeout(400)
    t_done = time.time()
    page.wait_for_timeout(1500)
    vpath = page.video.path()
    ctx.close()
    dst = Path(a.out_webm).resolve()
    shutil.copyfile(vpath, dst)
    return {
        "schema": 2,
        "mode": "story",
        "lead_sec": round(t_play - t0 + 1.6, 2),
        "story_sec": round(t_done - t_play, 2),
        "total_wall_sec": round(time.time() - t0, 2),
        "started_playback": became,
        "measured_fps": measure_fps(dst),
    }


def record_chapters(browser, page_src, tmp, out_dir, slug, views, a) -> dict:
    """逐章独立录制：activate(id) → 场记板 → playCurrent() → 等自停 → 尾帧截图。"""
    targets = views if a.all_chapters else views[:1]
    chapters, t_all = [], time.time()
    for idx, view in enumerate(targets):
        cid = view["id"]
        tmpvid = tmp / f"ch{idx}"
        tmpvid.mkdir()
        ctx = new_ctx(browser, tmpvid)
        page = open_page(ctx, page_src)
        page.wait_for_function(
            "() => window.Archify && Archify.guidedViews && Archify.guidedViews.count > 0",
            timeout=15000,
        )
        page.evaluate(
            "(id) => Archify.guidedViews.activate(id, {updateUrl:false})", cid
        )
        page.wait_for_timeout(a.settle_ms)
        active = page.evaluate("() => Archify.guidedViews.active()")
        if active != cid:
            # activateById 找不到 id 会静默回退 showAll()，录出「全图无高亮」——必须硬失败
            ctx.close()
            sys.exit(
                f"FAIL: {slug}/{cid} 激活失败（active={active!r}）——检查 views 的节点 id"
            )
        clapper(page)
        t_play = time.time()
        page.evaluate("() => Archify.guidedViews.playCurrent()")
        # 先等「真的播起来」再等「停」——否则 playCurrent() 尚未置位时
        # `!isPlaying()` 立刻为真，会录出零长片段（本轮自查发现的竞态）。
        page.wait_for_function("() => Archify.guidedViews.isPlaying()", timeout=15000)
        page.wait_for_function("() => !Archify.guidedViews.isPlaying()", timeout=120000)
        t_done = time.time()
        page.wait_for_timeout(350)
        still = out_dir / f"{slug}--{cid}-end.png"
        # 整视口截图：必须与 webm 同构同框，否则 fit='hold' 切换处突跳（见模块 docstring）
        page.screenshot(path=str(still))
        beats = page.evaluate("() => window.__archify.beats")
        vpath = page.video.path()
        ctx.close()
        webm = out_dir / f"{slug}--{cid}.webm"
        shutil.copyfile(vpath, webm)
        fps = measure_fps(webm)
        n = len(view["focus"])
        rel = (
            [round((b["t"] - beats[0]["t"]) / 1000, 3) for b in beats] if beats else []
        )
        chapters.append(
            {
                "id": cid,
                "label": view.get("label", cid),
                "index": idx,
                "file": webm.name,
                "end_still": still.name,
                "beats": n,
                "dwell_ms": round(dwell_ms(n)),
                "lead_sec": 0.0,  # 场记板白闪即视频钟零点
                "story_sec": round(t_done - t_play, 2),
                "beat_offsets_sec": rel,
                "beat_nodes": view["focus"],
                "measured_fps": fps,
            }
        )
        flag = "⚠️ 低帧率" if (fps is not None and fps < a.min_fps) else "ok"
        print(
            f"  [{idx + 1}/{len(targets)}] {slug}/{cid} "
            f"{chapters[-1]['story_sec']}s · {n} 拍 · fps={fps} {flag}",
            file=sys.stderr,
        )
    fpss = [c["measured_fps"] for c in chapters if c["measured_fps"]]
    return {
        "schema": 2,
        "mode": "chapter",
        "lead_sec": 0.0,
        "story_sec": round(sum(c["story_sec"] for c in chapters), 2),
        "total_wall_sec": round(time.time() - t_all, 2),
        "started_playback": True,
        "clapper_found": True,
        "measured_fps": min(fpss) if fpss else None,
        "chapters": chapters,
    }


if __name__ == "__main__":
    main()
