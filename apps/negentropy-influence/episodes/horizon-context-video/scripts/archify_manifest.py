"""由 video/public/archify/*.json 生成 video/src/archify.manifest.ts。

静态导入的好处：章节 id 拼错在 `tsc --noEmit` 就红，不用等渲染才发现。
录制或重测 lead 之后重跑本脚本即可。
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SIDE = ROOT / "video" / "public" / "archify"
OUT = ROOT / "video" / "src" / "archify.manifest.ts"

diagrams = {}
for f in sorted(SIDE.glob("*.json")):
    d = json.loads(f.read_text(encoding="utf-8"))
    if not isinstance(d, dict) or not d.get("chapters"):
        continue
    diagrams[d["slug"]] = {
        "slug": d["slug"],
        "chapters": [
            {"id": c["id"], "label": c["label"], "file": c["file"],
             "endStill": c["end_still"], "beats": c["beats"],
             "leadSec": c["lead_sec"], "storySec": c["story_sec"],
             "beatNodes": c["beat_nodes"]}
            for c in d["chapters"]
        ],
    }

body = json.dumps(diagrams, ensure_ascii=False, indent=2)
OUT.write_text(
    "// 本文件由 scripts/archify_manifest.py 从 public/archify/*.json 生成——请勿手改。\n"
    "// 数据来源：pipeline/scripts/record_archify.py --mode chapter（逐章录制）\n"
    "//         + scripts/archify_lead.py（场记板白闪测定真实 leadSec）。\n"
    "\n"
    "export type ArchifyChapter = {\n"
    "  /** views JSON 里的章节 id */\n  id: string;\n"
    "  /** 章节小标题（画面左下） */\n  label: string;\n"
    "  /** public/archify/ 下的 webm 文件名 */\n  file: string;\n"
    "  /** 该章末帧 PNG（fit='hold' 时用于冻结补足） */\n  endStill: string;\n"
    "  /** 本章拍数（每拍 max(1100ms, 3200ms/拍数)） */\n  beats: number;\n"
    "  /** 片内故事起点（秒，视频钟实测，非墙钟估算） */\n  leadSec: number;\n"
    "  /** 本章正片时长（秒） */\n  storySec: number;\n"
    "  /** 逐拍点亮的节点 id，供抽帧目视核对 */\n  beatNodes: string[];\n"
    "};\n\n"
    "export type ArchifyDiagram = {slug: string; chapters: ArchifyChapter[]};\n\n"
    f"export const ARCHIFY = {body} as const satisfies Record<string, ArchifyDiagram>;\n\n"
    "export type ArchifySlug = keyof typeof ARCHIFY;\n",
    encoding="utf-8")
n = sum(len(v["chapters"]) for v in diagrams.values())
print(f"✅ archify.manifest.ts：{len(diagrams)} 图 / {n} 章")
