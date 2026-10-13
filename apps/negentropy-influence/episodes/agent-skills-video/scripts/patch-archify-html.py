#!/usr/bin/env python3
"""本集专用：给 archify 3.0 出的两张 210 图注入精简 guidedViews 兼容层。

背景：vibe-video 录制器（record_archify.py）硬依赖 Archify.guidedViews 五 API
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

# 本脚本位于 apps/negentropy-influence/episodes/agent-skills-video/scripts/：
# parents[1]=本集目录，parents[5]=仓库根（源自 .temp/ 搬迁而来，层级不可再按
# 旧 parent.parent 推导）
P = Path(__file__).resolve().parents[1]
REPO = Path(__file__).resolve().parents[5]
SRC_DIR = REPO / "docs/assets/architecture/agent-infra"
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
    # 210 换代重制：图 slug（=views/*.json 与 html/{slug}.html 命名锚）→ docs 原件
    SLUG_SRC = {
        "disclosure": "agent-skills--disclosure-lifecycle.html",
        "governance": "agent-skills--governance-layers.html",
    }
    for slug, src_name in SLUG_SRC.items():
        src = SRC_DIR / src_name
        views = json.loads((VIEWS_DIR / f"{slug}.json").read_text(encoding="utf-8"))
        html = src.read_text(encoding="utf-8")
        # 幂等：剥旧注入块
        html = re.sub(
            re.escape(MARK) + r"[\s\S]*?" + re.escape(MARK + " end"),
            "",
            html,
        )
        # 剥原件自带的 GL 章集容器（archify 生成件内嵌 data 标签）：集侧 views/*.json
        # 是录制章集的唯一事实源——同名 id 双容器时 getElementById 取先者（文档前部），
        # 注入章会被原件章静默遮蔽（2026-10-06 实测：governance 打印 3 章=原件 gl-*）。
        html = re.sub(
            r'<script id="archify-guided-views-data"[^>]*>[\s\S]*?</script>\s*',
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
        if missing:
            # 强失败（对齐 assert 的严格度）：节点 id 失配时录制器只校验章 id 不校验
            # 节点 id，playCurrent 的 centerAt/focus.set 会静默跳过——不能只打印退出 0
            sys.exit(f"FAIL: {slug} 缺节点 {missing}（HTML 与 views/{slug}.json 失配）")
        print(f"{slug}: {len(parsed)} 章 → {out.name} [OK]")


if __name__ == "__main__":
    main()
