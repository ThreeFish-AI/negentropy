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

## 清晰度：cdp 采集模式（chapter 默认）

Playwright 自带录像的 ffmpeg 参数是硬编码的（driver `videoRecorder.js:46`）：
`-b:v 1M -deadline realtime -speed 8`——1Mbps 封顶 + 最低质量档，API 无任何质量
旋钮；实测 1080p webm 仅 0.84–1.14Mbps，进片后图内文字糊成一团。对已损 webm
重编码无法挽回信息，只能绕开它的编码器：

  - `--capture cdp`（chapter 默认）：自管 CDP `Page.startScreencast`
    （JPEG quality=100、maxWidth/Height=物理 4K）逐帧落盘，采集面
    `device_scale_factor=2`（viewport 仍 1920×1080 CSS，布局不变）；
  - 合成恒定 CFR 25fps（复刻 Playwright 的 `floor((ts-t0)×25)` 量化 + 缺号补
    上一帧），`measured_fps`/`trimBefore`/rate 数学与旧 webm 完全同构；
  - 编码用 remotion 内置 ffmpeg：h264 CRF16@2560×1440（full 档 1298 画框≈1:1
    像素映射），VP9 为回退档；末帧 PNG 经同一缩放链路与视频同分辨率（hold
    接缝约束，见上）。

CDP 事件 handler 里**绝不调用 Playwright API**（sync API 回调内嵌套 send 会死锁
dispatcher fiber）——只写文件 + 入队 sessionId，ack 由主 greenlet 在泵循环里批量做。
`--capture playwright` 保留旧行为作二分回归出口；story 模式恒为 playwright
（context-layer 旧消费形态的字节级兼容承诺）。
"""

import argparse
import base64
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


FPS_OUT = 25  # 合成恒定帧率：与 Playwright 录像的名义 CFR 一致，下游数学零改动


def find_remotion() -> tuple[Path, Path] | None:
    """→ (remotion CLI, 工程 video 根)。任一集 video/node_modules 装好即可用。"""
    video_root = Path(__file__).resolve().parents[2] / "episodes"
    for proj in video_root.glob("*/video"):
        exe = proj / "node_modules" / ".bin" / "remotion"
        if exe.is_file():
            return exe, proj
    return None


def probe_dims(path: Path) -> tuple[int, int] | None:
    """ffprobe 实测视频宽高（cdp 末帧 PNG 与视频同分辨率的断言用）。"""
    hit = find_remotion()
    if hit is None:
        return None
    exe, proj = hit
    r = subprocess.run(
        [
            str(exe),
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0",
            str(path.resolve()),
        ],
        capture_output=True,
        text=True,
        timeout=120,
        cwd=str(proj),
        check=False,
    )
    try:
        w, h = r.stdout.strip().split(",")
        return int(w), int(h)
    except ValueError:
        return None


class CdpRecorder:
    """自管 CDP screencast 采集：JPEG q100 帧序列落盘 + 主循环泵 ack。

    handler 只写文件 + 入队 sessionId（sync API 回调内嵌套 Playwright 调用会死锁
    dispatcher fiber）；Chromium 的 screencast 有在途帧上限（默认 3，我们放宽到
    64），不连续 ack 就停发——故播放等待全部走 50ms 泵循环而非 wait_for_function。
    """

    def __init__(self, out_dir: Path, scale: int):
        self.dir = out_dir
        self.dir.mkdir(parents=True, exist_ok=True)
        self.max_w, self.max_h = 1920 * scale, 1080 * scale
        self.session = None
        self.frames: list[tuple[str, float]] = []  # (jpg 文件名, 单调秒)
        self.pending: list[str] = []
        self.t0: float | None = None

    def _on_frame(self, params: dict) -> None:
        data = base64.b64decode(params["data"])
        ts = params.get("metadata", {}).get("timestamp") or 0.0
        name = f"f{len(self.frames) + 1:06d}.jpg"
        (self.dir / name).write_bytes(data)
        if self.t0 is None:
            self.t0 = ts
        self.frames.append((name, ts))
        self.pending.append(params["sessionId"])

    def start(self, ctx, page) -> None:
        self.session = ctx.new_cdp_session(page)
        self.session.on("Page.screencastFrame", self._on_frame)
        self.session.send(
            "Page.startScreencast",
            {
                "format": "jpeg",
                "quality": 100,
                "maxWidth": self.max_w,
                "maxHeight": self.max_h,
                "everyNthFrame": 1,
                "maxFramesInFlight": 64,
            },
        )

    def ack_pending(self) -> None:
        while self.pending:
            sid = self.pending.pop(0)
            try:
                self.session.send("Page.screencastFrameAck", {"sessionId": sid})
            except Exception:  # noqa: BLE001 - ack 失败只损失帧率，不该炸整场录制
                break

    def stop(self) -> None:
        try:
            self.session.send("Page.stopScreencast")
            self.ack_pending()
            self.session.detach()
        finally:
            self.session = None

    def quantize(self) -> dict[int, str]:
        """墙钟时间戳 → CFR25 槽位（同槽后到者胜，与 Playwright 量化同构）。"""
        slots: dict[int, str] = {}
        for name, ts in self.frames:
            slots[max(0, int((ts - self.t0) * FPS_OUT))] = name
        return slots


def encode_frames(
    rec: CdpRecorder, dst: Path, encode: str, crf: int
) -> tuple[float, int]:
    """槽位补帧 → remotion ffmpeg 编码 → (有效采集帧率, 交付高度)。"""
    hit = find_remotion()
    if hit is None:
        sys.exit(
            "FAIL: 未找到任何集的 video/node_modules/.bin/remotion——先 pnpm install"
        )
    exe, proj = hit
    slots = rec.quantize()
    if not slots:
        sys.exit("FAIL: CDP 采集到 0 帧（screencast 未启动或页面未渲染）")
    seq = rec.dir / "seq"
    seq.mkdir(exist_ok=True)
    last = None
    for i in range(max(slots) + 1):
        if i in slots:
            last = slots[i]
        if last is not None:
            shutil.copyfile(rec.dir / last, seq / f"f{i:06d}.jpg")
    out_h = 1440 if rec.max_h >= 2160 else 1080
    tail = (
        [
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            str(crf),
            "-pix_fmt",
            "yuv420p",
            "-g",
            "25",
            "-movflags",
            "+faststart",
        ]
        if encode == "h264"
        else [
            "-c:v",
            "libvpx-vp9",
            "-crf",
            str(crf),
            "-b:v",
            "0",
            "-row-mt",
            "1",
            "-cpu-used",
            "4",
        ]
    )
    r = subprocess.run(
        [
            str(exe),
            "ffmpeg",
            "-v",
            "error",
            "-y",
            "-framerate",
            str(FPS_OUT),
            "-i",
            str(seq / "f%06d.jpg"),
            "-vf",
            f"scale=-2:{out_h}:flags=lanczos",
            *tail,
            str(dst.resolve()),
        ],
        capture_output=True,
        text=True,
        timeout=600,
        cwd=str(proj),
        check=False,
    )
    if r.returncode:
        sys.exit(f"FAIL: ffmpeg 编码失败：{r.stderr[-400:]}")
    # 采集健康度口径：**峰值 1s 窗口接收帧数**，不是均值——screencast 是
    # damage-driven，静态停留期不产帧（CFR 靠补帧），均值恒低且与画质无关；
    # 动画期 compositor 按 vsync 产帧，峰值掉下去才是真采集卡顿。
    ts_list = sorted(t for _n, t in rec.frames)
    best, j = 0, 0
    for i, t in enumerate(ts_list):
        while ts_list[j] < t - 1.0:
            j += 1
        best = max(best, i - j + 1)
    shutil.rmtree(seq)
    return float(best), out_h


def downscale_still(src: Path, out_h: int) -> None:
    """末帧 PNG 压到与视频同分辨率（同一 lanczos 链路，维持 hold 接缝同构同帧）。"""
    hit = find_remotion()
    if hit is None:
        return
    exe, proj = hit
    tmp = src.with_suffix(".tmp.png")
    r = subprocess.run(
        [
            str(exe),
            "ffmpeg",
            "-v",
            "error",
            "-y",
            "-i",
            str(src.resolve()),
            "-vf",
            f"scale=-2:{out_h}:flags=lanczos",
            str(tmp.resolve()),
        ],
        capture_output=True,
        text=True,
        timeout=120,
        cwd=str(proj),
        check=False,
    )
    if r.returncode == 0 and tmp.is_file():
        tmp.replace(src)
    elif tmp.is_file():
        tmp.unlink()


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
    hit = find_remotion()
    for exe, proj in [hit] if hit else []:
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


def new_ctx(browser, tmpvid: Path, scale: int = 1, playwright_video: bool = True):
    kwargs = {
        "viewport": {"width": 1920, "height": 1080},
        "color_scheme": "dark",
        "reduced_motion": "no-preference",
        # DSF=2：viewport 仍 1920×1080 CSS（rem 布局不变），合成面 3840×2160——
        # 采集超采样，文字笔画再经 lanczos 降到 1440 交付，是清晰度的一半来源。
        "device_scale_factor": scale,
    }
    if playwright_video:
        kwargs["record_video_dir"] = str(tmpvid)
        kwargs["record_video_size"] = {"width": 1920, "height": 1080}
    ctx = browser.new_context(**kwargs)
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


_FRAME_KIND_TO_TYPE = {
    "lane": "workflow",
    "stage": "dataflow",
    "region": "architecture",
    "segment": "sequence",
}


def _sniff_diagram_type(src: Path) -> str:
    """从交付 HTML 的渲染器指纹嗅图型（best-effort，嗅不出返回 ""）。

    lifecycle 与无框平铺的 architecture 没有 frame-kind 指纹——由 --type 显式给。
    指纹与图型的对应实证于 horizon 33 图（fan-trap=lane / collect-enrich-activate=
    stage / component-panorama=region / resolve-activation=segment+data-segment-id）。
    """
    try:
        html = src.read_text(encoding="utf-8")
    except OSError:
        return ""
    if "data-segment-id" in html:
        return "sequence"
    for kind, t in _FRAME_KIND_TO_TYPE.items():
        if f'data-composition-frame-kind="{kind}"' in html:
            return t
    return ""


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
    ap.add_argument(
        "--capture",
        choices=["playwright", "cdp"],
        default=None,
        help="采集方式：chapter 默认 cdp（高清）；story 恒 playwright（旧行为）",
    )
    ap.add_argument(
        "--scale",
        type=int,
        choices=[1, 2],
        default=2,
        help="device_scale_factor（仅 cdp 采集生效；playwright 恒 1，保旧 webm 二分基线）",
    )
    ap.add_argument("--encode", choices=["h264", "vp9"], default="h264")
    ap.add_argument("--crf", type=int, default=16)
    ap.add_argument(
        "--type",
        choices=["architecture", "workflow", "sequence", "dataflow", "lifecycle"],
        help="图型（落 sidecar 顶层 type，覆盖门图型多样性门的数据源）；"
        "省略则从交付 HTML 的渲染器指纹嗅探，嗅不出（lifecycle/无框平铺）留空",
    )
    a = ap.parse_args()
    a.capture = a.capture or ("cdp" if a.mode == "chapter" else "playwright")
    if a.mode == "story" and a.capture == "cdp":
        sys.exit("FAIL: story 模式不接 cdp 采集（字节级兼容承诺，见模块 docstring）")

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
    sidecar["type"] = a.type or _sniff_diagram_type(src)
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


def pump_until(page, recorder: CdpRecorder | None, js: str, timeout_s: float) -> None:
    """50ms 泵循环替代 wait_for_function：CDP 在途帧须连续 ack，否则 Chromium 停发。"""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if page.evaluate(f"() => ({js})"):
            return
        if recorder:
            recorder.ack_pending()
        page.wait_for_timeout(50)
    sys.exit(f"FAIL: 等待 {js} 超时 {timeout_s}s（录制中断）")


def record_chapters(browser, page_src, tmp, out_dir, slug, views, a) -> dict:
    """逐章独立录制：activate(id) → 场记板 → playCurrent() → 等自停 → 尾帧截图。"""
    targets = views if a.all_chapters else views[:1]
    use_cdp = a.capture == "cdp"
    chapters, t_all = [], time.time()
    for idx, view in enumerate(targets):
        cid = view["id"]
        tmpvid = tmp / f"ch{idx}"
        tmpvid.mkdir()
        # playwright 采集恒 DSF=1：旧 webm 是 1× 渲染面录的，注入 2× 会与 v3/v4
        # 基线产生系统性像素差，--capture playwright 作为二分回归出口即失真。
        ctx = new_ctx(
            browser,
            tmpvid,
            scale=a.scale if use_cdp else 1,
            playwright_video=not use_cdp,
        )
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
        recorder = None
        if use_cdp:
            recorder = CdpRecorder(tmpvid / "frames", a.scale)
            recorder.start(ctx, page)
            # 先泵 300ms 再打场记板：startScreencast 的激活与白闪渲染存在竞态，
            # 首帧若晚于白闪到达，整段视频就没有零点标记（实测 19/86 章白闪丢失）。
            # 预滚保证白闪落在已确认在流的中段，lead 测定不再依赖运气。
            page.wait_for_timeout(300)
            recorder.ack_pending()
        clapper(page)
        t_play = time.time()
        page.evaluate("() => Archify.guidedViews.playCurrent()")
        # 先等「真的播起来」再等「停」——否则 playCurrent() 尚未置位时
        # `!isPlaying()` 立刻为真，会录出零长片段（本轮自查发现的竞态）。
        if use_cdp:
            pump_until(page, recorder, "Archify.guidedViews.isPlaying()", 15)
            pump_until(page, recorder, "!Archify.guidedViews.isPlaying()", 120)
        else:
            page.wait_for_function(
                "() => Archify.guidedViews.isPlaying()", timeout=15000
            )
            page.wait_for_function(
                "() => !Archify.guidedViews.isPlaying()", timeout=120000
            )
        t_done = time.time()
        page.wait_for_timeout(350)
        still = out_dir / f"{slug}--{cid}-end.png"
        # 整视口截图：必须与成片同构同框，否则 fit='hold' 切换处突跳（见模块 docstring）
        page.screenshot(path=str(still))
        beats = page.evaluate("() => window.__archify.beats")
        capture_fps = None
        if use_cdp:
            recorder.stop()
            ctx.close()  # 编码/探宽高只剩文件与 CPU 侧工作——不关则每章泄漏一个 4K 渲染 context
            ext = "mp4" if a.encode == "h264" else "webm"
            video = out_dir / f"{slug}--{cid}.{ext}"
            capture_fps, out_h = encode_frames(recorder, video, a.encode, a.crf)
            downscale_still(still, out_h)
            vd, pd = probe_dims(video), probe_dims(still)
            if vd and pd and vd != pd:
                sys.exit(
                    f"FAIL: {slug}/{cid} 末帧 PNG {pd} ≠ 视频 {vd}——hold 接缝会突跳"
                )
        else:
            vpath = page.video.path()
            ctx.close()
            video = out_dir / f"{slug}--{cid}.webm"
            shutil.copyfile(vpath, video)
        fps = measure_fps(video)
        n = len(view["focus"])
        rel = (
            [round((b["t"] - beats[0]["t"]) / 1000, 3) for b in beats] if beats else []
        )
        chapters.append(
            {
                "id": cid,
                "label": view.get("label", cid),
                "index": idx,
                "file": video.name,
                "end_still": still.name,
                "beats": n,
                "dwell_ms": round(dwell_ms(n)),
                "lead_sec": 0.0,  # 场记板白闪即视频钟零点
                "story_sec": round(t_done - t_play, 2),
                "beat_offsets_sec": rel,
                "beat_nodes": view["focus"],
                "measured_fps": fps,
                "capture_fps": capture_fps,
            }
        )
        eff = capture_fps if capture_fps is not None else fps
        flag = "⚠️ 低帧率" if (eff is not None and eff < a.min_fps) else "ok"
        print(
            f"  [{idx + 1}/{len(targets)}] {slug}/{cid} "
            f"{chapters[-1]['story_sec']}s · {n} 拍 · fps={eff} {flag}",
            file=sys.stderr,
        )
    fpss = [c["measured_fps"] for c in chapters if c["measured_fps"]]
    out = {
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
    if use_cdp:
        out["capture"] = {
            "mode": "cdp",
            "scale": a.scale,
            "encoder": a.encode,
            "crf": a.crf,
            "fps": FPS_OUT,
            "out_h": 1440 if a.scale == 2 else 1080,
        }
    return out


if __name__ == "__main__":
    main()
