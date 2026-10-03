#!/usr/bin/env python3
"""ep5 专用：给 archify 3.0 出的图注入精简 guidedViews 兼容层（E1 范式泛化，RSI-038）。

背景：to-video 录制器（record_archify.py）硬依赖 Archify.guidedViews 五 API
（count/activate/active/playCurrent/isPlaying）；archify 3.0 移除了该模块。
本脚本不修改 docs/ 的 canonical 原件（SSOT），拷贝到本集 html/ 后注入：
  ① <script id="archify-guided-views-data"> 容器（章表 = views/<slug>.json 内容）
  ② 薄包装模块：组合 3.0 原生 Archify.focus.set / view.reveal / view.centerAt
     + 播放期 opacity 脉动（保采集帧率）
重跑幂等（已注入则先剥旧块再注）。用法：
  cd apps/negentropy-influence/episodes/claude-code-multiagent-video && \
  uv run --no-project scripts/patch-archify-html.py [--only slug1,slug2]
"""

import json
import re
import sys
from pathlib import Path

P = Path(__file__).resolve().parents[1]
REPO = Path(__file__).resolve().parents[5]
SRC_DIR = REPO / "docs/assets/architecture/agent-harness"
VIEWS_DIR = P / "video/public/archify/views"
OUT_DIR = P / "video/public/archify/html"
MARK = "<!-- guided-views-compat (ep5 injected) -->"
# 结束标记须是完整 HTML 注释：拼「MARK + " end"」会把 end 落在注释外成裸文本节点
MARK_END = "<!-- guided-views-compat (ep5 injected) end -->"

# 2.x 原生带 guided-views 的图：纯拷贝不注入（避免双容器；views 章表仍可点名原生章 id）
NO_INJECT = {"five-layer-dependency"}

# slug → docs 原件文件名（12 新绘 claude-code-- 前缀 + 2 复用异名）
SLUG_MAP = {
    "seven-artifacts": "claude-code--seven-artifacts.html",
    "task-card-anatomy": "claude-code--task-card-anatomy.html",
    "dependency-failclosed": "claude-code--dependency-failclosed.html",
    "claim-guards-break": "claude-code--claim-guards-break.html",
    "claim-race-window": "claude-code--claim-race-window.html",
    "mailslot-consume": "claude-code--mailslot-consume.html",
    "receipt-ledger": "claude-code--receipt-ledger.html",
    "receipt-fsm": "claude-code--receipt-fsm.html",
    "duty-clock-loop": "claude-code--duty-clock-loop.html",
    "room-ledger-bind": "claude-code--room-ledger-bind.html",
    "room-teardown": "claude-code--room-teardown.html",
    "socket-pool": "claude-code--socket-pool.html",
    "collab-panorama": "claude-code-multiagent--collab-panorama.html",
    "five-layer-dependency": "claude-code-harness--five-layer-dependency.html",
}

JS_TEMPLATE = """
(function () {
  var raw = document.getElementById('archify-guided-views-data');
  var VIEWS = [];
  try { VIEWS = JSON.parse(raw.textContent || '[]'); } catch (_) {}
  function nodeEl(id) { return document.querySelector('[data-node-id="' + id + '"]'); }
  function nodeCenter(id) {
    var el = nodeEl(id);
    if (!el) return null;
    try { var b = el.getBBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; } catch (_) { return null; }
  }
  var api = {
    count: VIEWS.length,
    _active: null,
    _playing: false,
    activate: function (id) {
      var v = null;
      for (var i = 0; i < VIEWS.length; i++) if (VIEWS[i].id === id) v = VIEWS[i];
      if (!v) return; /* 找不到保持原值：录制器 active()!=cid 门会点名 */
      api._active = id;
      try {
        if (window.Archify && Archify.view && typeof Archify.view.reveal === 'function') {
          Archify.view.reveal(v.focus, { includeNeighbors: false, reason: 'guided' });
        } else if (window.Archify && Archify.focus && typeof Archify.focus.set === 'function') {
          v.focus.forEach(function (n) { Archify.focus.set(n, { toggle: false }); });
        }
      } catch (_) {}
    },
    active: function () { return api._active; },
    isPlaying: function () { return api._playing; },
    playCurrent: function () {
      var v = null;
      for (var i = 0; i < VIEWS.length; i++) if (VIEWS[i].id === api._active) v = VIEWS[i];
      if (!v || api._playing) return;
      api._playing = true; /* 先置位再动画：防录制器零长片段竞态 */
      var n = Math.max(1, v.focus.length);
      var dwell = Math.max(1100, 3200 / n); /* 对齐录制器 storyBeatDwell 口径 */
      var idx = 0;
      (function step() {
        if (idx >= n) { api._playing = false; return; }
        var id2 = v.focus[idx++];
        var c = nodeCenter(id2);
        try {
          var prev = document.querySelector('.gv-pulse');
          if (prev) prev.classList.remove('gv-pulse');
          var cur = nodeEl(id2);
          if (cur) cur.classList.add('gv-pulse');
          if (c && window.Archify && Archify.view && typeof Archify.view.centerAt === 'function') {
            Archify.view.centerAt(c.x, c.y, { minimumScale: 1.5 });
          }
          if (window.Archify && Archify.focus && typeof Archify.focus.set === 'function') {
            Archify.focus.set(id2, { toggle: false });
          }
        } catch (_) {}
        setTimeout(step, dwell);
      })();
    },
  };
  window.Archify = window.Archify || {};
  window.Archify.guidedViews = api;
})();
"""


def main() -> None:
    # --only 仅认精确形态 `--only a,b`；其余任何带参形态（--only=a、漏值、多余参数）
    # 直接报用法退出——静默落全量会无声扩大重跑半径
    only = None
    if len(sys.argv) == 3 and sys.argv[1] == "--only":
        only = set(sys.argv[2].split(","))
        unknown = only - SLUG_MAP.keys()
        if unknown:
            # 取值校验：拼错/空串/带空格会命中零图——零迭代+空 failures=静默空转 exit 0
            sys.exit(
                f"FAIL: --only 含未知图名 {sorted(unknown)}（合法: {','.join(SLUG_MAP)}）"
            )
    elif len(sys.argv) != 1:
        sys.exit(
            f"用法: {sys.argv[0]} [--only slug1,slug2]（当前参数: {' '.join(sys.argv[1:])}）"
        )
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    failures = []
    for slug, fname in SLUG_MAP.items():
        if only and slug not in only:
            continue
        src = SRC_DIR / fname
        vpath = VIEWS_DIR / f"{slug}.json"
        if not src.is_file():
            failures.append(f"{slug}: 源图缺失 {fname}")
            continue
        if not vpath.is_file():
            failures.append(f"{slug}: views 章表缺失 views/{slug}.json")
            continue
        views = json.loads(vpath.read_text(encoding="utf-8"))
        html = src.read_text(encoding="utf-8")
        if slug in NO_INJECT:
            out = OUT_DIR / f"{slug}.html"
            out.write_text(html, encoding="utf-8")
            print(f"{slug}: 纯拷贝（原生 guided-views）→ {out.name} [OK]")
            continue
        # 幂等：剥旧注入块（兼容旧版「MARK end」裸文本结束标记与现行 MARK_END）
        html = re.sub(
            re.escape(MARK)
            + r"[\s\S]*?(?:"
            + re.escape(MARK_END)
            + r"|"
            + re.escape(MARK + " end")
            + r")",
            "",
            html,
        )
        style = (
            "<style>\n"
            "@keyframes gv-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.78; } }\n"
            ".gv-pulse { animation: gv-pulse 1.1s ease-in-out infinite; }\n"
            "</style>\n"
        )
        block = (
            f"{MARK}\n"
            f'<script id="archify-guided-views-data" type="application/json">'
            f"{json.dumps(views, ensure_ascii=False)}</script>\n"
            f"{style}"
            f"<script>{JS_TEMPLATE}</script>\n"
            f"{MARK_END}\n"
        )
        if "</body>" not in html:
            failures.append(f"{slug}: 无 </body>")
            continue
        html = html.replace("</body>", block + "</body>", 1)
        # 自检先行（容器可被 read_views 正则命中、焦点节点 id 全部存在）——
        # 通过才落盘：缺节点时坏产物不得覆盖 html/（下游录制器会直接消费）
        m = re.search(r'id="archify-guided-views-data"[^>]*>([\s\S]*?)</script>', html)
        assert m, f"{slug} 容器未命中"
        parsed = json.loads(m.group(1))
        missing = [
            n for v in parsed for n in v["focus"] if f'data-node-id="{n}"' not in html
        ]
        if missing:
            failures.append(f"{slug}: 缺节点 {missing}")
            print(f"{slug}: {len(parsed)} 章 → 未落盘 [缺节点 {missing}]")
            continue
        out = OUT_DIR / f"{slug}.html"
        out.write_text(html, encoding="utf-8")
        print(f"{slug}: {len(parsed)} 章 → {out.name} [OK]")
    if failures:
        sys.exit("FAIL:\n" + "\n".join(failures))


if __name__ == "__main__":
    main()
