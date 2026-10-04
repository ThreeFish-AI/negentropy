// 本文件由 to-video skill 的 scripts/archify_manifest.py 从 public/archify/*.json 生成——请勿手改。
// 数据来源：scripts/record_archify.py --mode chapter（逐章录制）
//         + scripts/archify_lead.py（场记板白闪测定真实 leadSec）。

export type ArchifyChapter = {
  /** views JSON 里的章节 id */
  id: string;
  /** 章节小标题（画面左下） */
  label: string;
  /** public/archify/ 下的视频文件名（webm / mp4，随采集方式而定） */
  file: string;
  /** 该章末帧 PNG（fit='hold' 时用于冻结补足） */
  endStill: string;
  /** 本章拍数（每拍 max(1100ms, 3200ms/拍数)） */
  beats: number;
  /** 片内故事起点（秒，视频钟实测，非墙钟估算） */
  leadSec: number;
  /** 本章正片时长（秒） */
  storySec: number;
  /** 逐拍点亮的节点 id，供抽帧目视核对 */
  beatNodes: string[];
};

export type ArchifyDiagram = {slug: string; type?: string; chapters: ArchifyChapter[]};

export const ARCHIFY = {
  "dual-track": {
    "slug": "dual-track",
    "type": "workflow",
    "chapters": [
      {
        "id": "dt-spec",
        "label": "规范面",
        "file": "dual-track--dt-spec.mp4",
        "endStill": "dual-track--dt-spec-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "spec"
        ]
      },
      {
        "id": "dt-strict",
        "label": "校验轨道",
        "file": "dual-track--dt-strict.mp4",
        "endStill": "dual-track--dt-strict-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "val"
        ]
      },
      {
        "id": "dt-lenient",
        "label": "装载轨道",
        "file": "dual-track--dt-lenient.mp4",
        "endStill": "dual-track--dt-lenient-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "guide"
        ]
      },
      {
        "id": "dt-ext-a",
        "label": "扩展·Claude Code",
        "file": "dual-track--dt-ext-a.mp4",
        "endStill": "dual-track--dt-ext-a-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "ext1"
        ]
      },
      {
        "id": "dt-ext-b",
        "label": "扩展·claude.ai",
        "file": "dual-track--dt-ext-b.mp4",
        "endStill": "dual-track--dt-ext-b-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.27,
        "beatNodes": [
          "ext2"
        ]
      },
      {
        "id": "dt-ext-c",
        "label": "扩展·Codex",
        "file": "dual-track--dt-ext-c.mp4",
        "endStill": "dual-track--dt-ext-c-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "ext3"
        ]
      },
      {
        "id": "dt-eco",
        "label": "生态登记",
        "file": "dual-track--dt-eco.mp4",
        "endStill": "dual-track--dt-eco-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "eco"
        ]
      },
      {
        "id": "dt-gate",
        "label": "守门哲学",
        "file": "dual-track--dt-gate.mp4",
        "endStill": "dual-track--dt-gate-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "gate"
        ]
      }
    ]
  },
  "lifecycle": {
    "slug": "lifecycle",
    "type": "workflow",
    "chapters": [
      {
        "id": "lc-discover",
        "label": "发现",
        "file": "lifecycle--lc-discover.mp4",
        "endStill": "lifecycle--lc-discover-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "discover"
        ]
      },
      {
        "id": "lc-load",
        "label": "宽容装载",
        "file": "lifecycle--lc-load.mp4",
        "endStill": "lifecycle--lc-load-end.png",
        "beats": 1,
        "leadSec": 0.48,
        "storySec": 3.27,
        "beatNodes": [
          "loadp"
        ]
      },
      {
        "id": "lc-catalog",
        "label": "目录常驻",
        "file": "lifecycle--lc-catalog.mp4",
        "endStill": "lifecycle--lc-catalog-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "catalog"
        ]
      },
      {
        "id": "lc-activate",
        "label": "激活",
        "file": "lifecycle--lc-activate.mp4",
        "endStill": "lifecycle--lc-activate-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "activate"
        ]
      },
      {
        "id": "lc-execute",
        "label": "按需执行",
        "file": "lifecycle--lc-execute.mp4",
        "endStill": "lifecycle--lc-execute-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "execute"
        ]
      },
      {
        "id": "lc-compact",
        "label": "压缩保护",
        "file": "lifecycle--lc-compact.mp4",
        "endStill": "lifecycle--lc-compact-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "compact"
        ]
      },
      {
        "id": "lc-strict",
        "label": "严格校验",
        "file": "lifecycle--lc-strict.mp4",
        "endStill": "lifecycle--lc-strict-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.28,
        "beatNodes": [
          "strict"
        ]
      },
      {
        "id": "lc-inject",
        "label": "注入防御",
        "file": "lifecycle--lc-inject.mp4",
        "endStill": "lifecycle--lc-inject-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "inject"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
