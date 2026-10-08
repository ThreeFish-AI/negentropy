// 本文件由 vibe-video skill 的 scripts/archify_manifest.py 从 public/archify/*.json 生成——请勿手改。
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
  "disclosure": {
    "slug": "disclosure",
    "type": "workflow",
    "chapters": [
      {
        "id": "dl-discover",
        "label": "发现与解析",
        "file": "disclosure--dl-discover.mp4",
        "endStill": "disclosure--dl-discover-end.png",
        "beats": 3,
        "leadSec": 0.52,
        "storySec": 3.38,
        "beatNodes": [
          "discover",
          "parse",
          "resolve"
        ]
      },
      {
        "id": "dl-catalog",
        "label": "台账常驻",
        "file": "disclosure--dl-catalog.mp4",
        "endStill": "disclosure--dl-catalog-end.png",
        "beats": 1,
        "leadSec": 0.52,
        "storySec": 3.23,
        "beatNodes": [
          "catalog"
        ]
      },
      {
        "id": "dl-activate",
        "label": "提箱整载",
        "file": "disclosure--dl-activate.mp4",
        "endStill": "disclosure--dl-activate-end.png",
        "beats": 2,
        "leadSec": 0.52,
        "storySec": 3.22,
        "beatNodes": [
          "route",
          "activate"
        ]
      },
      {
        "id": "dl-tier3",
        "label": "隔层按需",
        "file": "disclosure--dl-tier3.mp4",
        "endStill": "disclosure--dl-tier3-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.26,
        "beatNodes": [
          "interpret",
          "resources"
        ]
      },
      {
        "id": "dl-rewrite",
        "label": "改写账本",
        "file": "disclosure--dl-rewrite.mp4",
        "endStill": "disclosure--dl-rewrite-end.png",
        "beats": 2,
        "leadSec": 0.52,
        "storySec": 3.25,
        "beatNodes": [
          "exempt",
          "dedupe"
        ]
      }
    ]
  },
  "governance": {
    "slug": "governance",
    "type": "architecture",
    "chapters": [
      {
        "id": "gl-three",
        "label": "三层治理",
        "file": "governance--gl-three.mp4",
        "endStill": "governance--gl-three-end.png",
        "beats": 3,
        "leadSec": 0.52,
        "storySec": 3.35,
        "beatNodes": [
          "must",
          "advise",
          "blank"
        ]
      },
      {
        "id": "gl-guide",
        "label": "指南层",
        "file": "governance--gl-guide.mp4",
        "endStill": "governance--gl-guide-end.png",
        "beats": 3,
        "leadSec": 0.52,
        "storySec": 3.32,
        "beatNodes": [
          "guide-discover",
          "guide-lenient",
          "guide-trust"
        ]
      },
      {
        "id": "gl-algo",
        "label": "极简算法",
        "file": "governance--gl-algo.mp4",
        "endStill": "governance--gl-algo-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.24,
        "beatNodes": [
          "blank",
          "guide-trust"
        ]
      },
      {
        "id": "gl-verdict",
        "label": "判词",
        "file": "governance--gl-verdict.mp4",
        "endStill": "governance--gl-verdict-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.32,
        "beatNodes": [
          "pr254",
          "pr573",
          "pr546"
        ]
      },
      {
        "id": "ge-eco",
        "label": "生态分叉",
        "file": "governance--ge-eco.mp4",
        "endStill": "governance--ge-eco-end.png",
        "beats": 3,
        "leadSec": 0.52,
        "storySec": 3.35,
        "beatNodes": [
          "gemini",
          "claudecode",
          "openai"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
