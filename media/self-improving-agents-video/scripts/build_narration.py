#!/usr/bin/env python3
"""从 narration.md 解析生成 narration.json（逐句：id/scene/text）。

narration.md 是唯一事实源；本脚本是纯派生转换，不做任何内容改写。
用法：uv run --no-project scripts/build_narration.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "script" / "narration.md"
DST = ROOT / "script" / "narration.json"

LINE_RE = re.compile(r"^- \[(?P<id>[a-z0-9-]+)\]\s+(?P<text>.+)$")
SCENE_RE = re.compile(r"^## (?P<scene>P\d+)\b")


def main() -> None:
    scene = ""
    items: list[dict[str, str]] = []
    seen: set[str] = set()
    for raw in SRC.read_text(encoding="utf-8").splitlines():
        if m := SCENE_RE.match(raw):
            scene = m.group("scene")
            continue
        if m := LINE_RE.match(raw):
            sid, text = m.group("id"), m.group("text").strip()
            if sid in seen:
                raise SystemExit(f"重复句 id: {sid}")
            if not sid.startswith(scene.lower() + "-"):
                raise SystemExit(f"句 id {sid} 与所在幕 {scene} 不一致")
            seen.add(sid)
            items.append({"id": sid, "scene": scene, "text": text})

    DST.write_text(
        json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    total_chars = sum(len(i["text"]) for i in items)
    per_scene: dict[str, int] = {}
    for i in items:
        per_scene[i["scene"]] = per_scene.get(i["scene"], 0) + 1
    print(f"句数: {len(items)}  总字数: {total_chars}")
    print(f"各幕句数: {per_scene}")
    print(f"估算时长(280字/分): {total_chars / 280:.1f} 分钟")


if __name__ == "__main__":
    main()
