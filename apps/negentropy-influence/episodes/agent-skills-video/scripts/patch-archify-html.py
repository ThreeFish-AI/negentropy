#!/usr/bin/env python3
"""E1 专用：给 archify 3.0 出的两张 std 图注入精简 guidedViews 兼容层。

背景：to-video 录制器（record_archify.py）硬依赖 Archify.guidedViews 五 API
（count/activate/active/playCurrent/isPlaying）；archify 3.0 移除了该模块。
本脚本不修改 docs/ 的 canonical 原件（SSOT），拷贝到本集 html/ 后注入：
  ① <script id="archify-guided-views-data"> 容器（章表 = views/*.json 内容）
  ② 薄包装模块：组合 3.0 原生 Archify.focus.set / view.reveal / view.centerAt
重跑幂等（已注入则先剥旧块再注）。
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "docs/assets/architecture/agent-infra"
P = ROOT / "apps/negentropy-influence/episodes/agent-skills-video"
VIEWS_DIR = P / "video/public/archify/views"
OUT_DIR = P / "video/public/archify/html"
MARK = "<!-- guided-views-compat (E1 injected) -->"

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
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for slug in ("lifecycle", "dual-track"):
        src = SRC_DIR / f"agent-skills-std-{slug}.html"
        views = json.loads((VIEWS_DIR / f"{slug}.json").read_text(encoding="utf-8"))
        html = src.read_text(encoding="utf-8")
        # 幂等：剥旧注入块
        html = re.sub(
            re.escape(MARK) + r"[\s\S]*?" + re.escape(MARK + " end"),
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
            f"{MARK} end\n"
        )
        if "</body>" not in html:
            sys.exit(f"FAIL: {src} 无 </body>")
        html = html.replace("</body>", block + "</body>", 1)
        out = OUT_DIR / f"{slug}.html"
        out.write_text(html, encoding="utf-8")
        # 自检：容器可被 read_views 正则命中、节点 id 全部存在
        m = re.search(r'id="archify-guided-views-data"[^>]*>([\s\S]*?)</script>', html)
        assert m, "容器未命中"
        parsed = json.loads(m.group(1))
        missing = [
            n for v in parsed for n in v["focus"] if f'data-node-id="{n}"' not in html
        ]
        status = "OK" if not missing else f"缺节点 {missing}"
        print(f"{slug}: {len(parsed)} 章 → {out.name} [{status}]")


if __name__ == "__main__":
    main()
