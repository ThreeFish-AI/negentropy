"""archify 工程图 Play 回放录制器（Playwright + 系统 Chrome，2026-09 Context Layer 双集引入）。

用法（仓库根）：
  uv run --with playwright python apps/negentropy-influence/pipeline/scripts/record_archify.py \\
    <工程图.html 绝对路径> <输出.webm> <sidecar.json>

用法：uv run --with playwright python record_archify.py <html绝对路径> <输出.webm> <sidecar.json>
行为：
  - 1920x1080 视口、暗色主题（localStorage 锁定）、隐藏工具栏/导航外壳
  - 键盘 P 触发「播放引导故事」，轮询播放按钮 aria-pressed 回落 = 播完
  - sidecar 记录 lead/tail 秒数，供 Remotion OffthreadVideo startFrom 裁掉空白
"""

import json
import sys
import time

from playwright.sync_api import sync_playwright

HIDE_CSS = """
/* 录制视图：隐藏交互外壳（工具栏/缩放导航/章节索引/旅程条），保留图形与随行说明 */
.toolbar, .diagram-nav, .guided-view-index, .route-journey-bar,
header.app-header, .share-cue, .print-only { display: none !important; }
html, body { background: #0E1116 !important; }
"""

src, out_webm, out_sidecar = sys.argv[1], sys.argv[2], sys.argv[3]

with sync_playwright() as p:
    browser = p.chromium.launch(
        channel="chrome",
        headless=True,
        args=["--force-color-profile=srgb", "--disable-lcd-text"],
    )
    ctx = browser.new_context(
        viewport={"width": 1920, "height": 1080},
        color_scheme="dark",
        reduced_motion="no-preference",
        record_video_dir="/tmp/hc-notes/vid",
        record_video_size={"width": 1920, "height": 1080},
    )
    ctx.add_init_script(
        "try { localStorage.setItem('archify-theme', 'dark'); } catch (e) {}"
    )
    t0 = time.time()
    page = ctx.new_page()
    page.goto("about:blank")
    page.goto(f"file://{src}")
    page.wait_for_load_state("networkidle")
    page.add_style_tag(content=HIDE_CSS)
    # 播放按钮就绪即按 P（兼容被禁用时回退点击）
    page.wait_for_selector("#guided-view-play", timeout=15000)
    page.wait_for_timeout(1200)  # 入场动画落定
    t_play = time.time()
    page.keyboard.press("p")
    # 轮询：aria-pressed 曾为 true 后回落，且 label 变重播/播放 → 播完
    became_playing = False
    deadline = time.time() + 180
    while time.time() < deadline:
        state = page.get_attribute("#guided-view-play", "aria-pressed")
        label = page.get_attribute("#guided-view-play", "aria-label") or ""
        if state == "true":
            became_playing = True
        elif became_playing:
            break
        page.wait_for_timeout(400)
    t_done = time.time()
    page.wait_for_timeout(1500)  # 收尾停留
    video = page.video
    path = video.path()
    ctx.close()
    browser.close()

import shutil

shutil.copyfile(path, out_webm)
sidecar = {
    "source": src,
    "lead_sec": round(t_play - t0 + 1.6, 2),  # blank+load+settle → startFrom 依据
    "story_sec": round(t_done - t_play, 2),
    "total_wall_sec": round(time.time() - t0, 2),
    "started_playback": became_playing,
}
with open(out_sidecar, "w") as fh:
    json.dump(sidecar, fh, ensure_ascii=False, indent=1)
print(json.dumps(sidecar, ensure_ascii=False))
