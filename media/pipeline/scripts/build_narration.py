#!/usr/bin/env python3
"""从 narration.md 解析生成 narration.json（逐句：id/scene/text）——公共管线版本。

narration.md 是单一事实源；本脚本是纯派生转换，不做任何内容改写。
适用于任何 `media/*-video/` 科普视频工程（目录约定见 media/pipeline/README.md）。

用法：uv run --no-project media/pipeline/scripts/build_narration.py --project media/<工程>
     工程内薄包装等价于：uv run --no-project scripts/build_narration.py
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

LINE_RE = re.compile(r"^- \[(?P<id>[a-z0-9-]+)\]\s+(?P<text>.+)$")
SCENE_RE = re.compile(r"^## (?P<scene>P\d+)\b")


def main() -> None:
    parser = argparse.ArgumentParser(description="narration.md → narration.json")
    parser.add_argument("--project", default=".", help="视频工程根目录（含 script/）")
    args = parser.parse_args()

    root = Path(args.project).resolve()
    src = root / "script" / "narration.md"
    dst = root / "script" / "narration.json"

    scene = ""
    items: list[dict[str, str]] = []
    seen: set[str] = set()
    for raw in src.read_text(encoding="utf-8").splitlines():
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

    dst.write_text(
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
