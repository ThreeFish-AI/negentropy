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
  "compact-entries": {
    "slug": "compact-entries",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "entries-overview",
        "label": "入口不止一个",
        "file": "compact-entries--entries-overview.mp4",
        "endStill": "compact-entries--entries-overview-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "entry-sign",
          "auto-precheck",
          "manual-tool",
          "rescue-lane"
        ]
      },
      {
        "id": "auto-gate",
        "label": "自动预处理",
        "file": "compact-entries--auto-gate.mp4",
        "endStill": "compact-entries--auto-gate-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "auto-precheck"
        ]
      },
      {
        "id": "manual-tool",
        "label": "主动请压缩",
        "file": "compact-entries--manual-tool.mp4",
        "endStill": "compact-entries--manual-tool-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "manual-tool"
        ]
      },
      {
        "id": "rescue-lane",
        "label": "应急车道",
        "file": "compact-entries--rescue-lane.mp4",
        "endStill": "compact-entries--rescue-lane-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "rescue-lane",
          "reject-stamp"
        ]
      },
      {
        "id": "tail-five",
        "label": "保尾五条",
        "file": "compact-entries--tail-five.mp4",
        "endStill": "compact-entries--tail-five-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "tail-guard",
          "rescue-lane"
        ]
      },
      {
        "id": "once-only",
        "label": "只救一次",
        "file": "compact-entries--once-only.mp4",
        "endStill": "compact-entries--once-only-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "retry-limit",
          "rescue-lane"
        ]
      }
    ]
  },
  "compact-pipeline": {
    "slug": "compact-pipeline",
    "type": "workflow",
    "chapters": [
      {
        "id": "four-layers",
        "label": "四层手段亮相",
        "file": "compact-pipeline--four-layers.mp4",
        "endStill": "compact-pipeline--four-layers-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.47,
        "beatNodes": [
          "snip-lane",
          "micro-lane",
          "budget-lane",
          "digest-lane"
        ]
      },
      {
        "id": "cost-ladder",
        "label": "便宜的先跑",
        "file": "compact-pipeline--cost-ladder.mp4",
        "endStill": "compact-pipeline--cost-ladder-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.53,
        "beatNodes": [
          "cost-column",
          "snip-lane",
          "micro-lane",
          "budget-lane",
          "digest-lane"
        ]
      },
      {
        "id": "text-vs-llm",
        "label": "前三层零调用",
        "file": "compact-pipeline--text-vs-llm.mp4",
        "endStill": "compact-pipeline--text-vs-llm-end.png",
        "beats": 4,
        "leadSec": 0.48,
        "storySec": 4.47,
        "beatNodes": [
          "snip-lane",
          "micro-lane",
          "budget-lane",
          "cost-column"
        ]
      },
      {
        "id": "one-llm-call",
        "label": "第四层一次调用",
        "file": "compact-pipeline--one-llm-call.mp4",
        "endStill": "compact-pipeline--one-llm-call-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "digest-lane",
          "cost-column"
        ]
      },
      {
        "id": "teach-vs-real",
        "label": "讲课序撞实序",
        "file": "compact-pipeline--teach-vs-real.mp4",
        "endStill": "compact-pipeline--teach-vs-real-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "teach-numbering",
          "real-flow"
        ]
      },
      {
        "id": "real-order",
        "label": "实序逐拍点亮",
        "file": "compact-pipeline--real-order.mp4",
        "endStill": "compact-pipeline--real-order-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.57,
        "beatNodes": [
          "real-flow",
          "budget-lane",
          "snip-lane",
          "micro-lane",
          "digest-lane"
        ]
      }
    ]
  },
  "five-layer-dependency": {
    "slug": "five-layer-dependency",
    "type": "architecture",
    "chapters": [
      {
        "id": "layer-flash",
        "label": "记忆层一闪",
        "file": "five-layer-dependency--layer-flash.mp4",
        "endStill": "five-layer-dependency--layer-flash-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.31,
        "beatNodes": [
          "layer-3",
          "layer-2",
          "layer-4"
        ]
      },
      {
        "id": "read-two-books",
        "label": "先分两本账",
        "file": "five-layer-dependency--read-two-books.mp4",
        "endStill": "five-layer-dependency--read-two-books-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "loop-core",
          "layer-3",
          "device-zones"
        ]
      },
      {
        "id": "two-dark-zones",
        "label": "两个区没开灯",
        "file": "five-layer-dependency--two-dark-zones.mp4",
        "endStill": "five-layer-dependency--two-dark-zones-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "dim-zones",
          "layer-4",
          "layer-5"
        ]
      }
    ]
  },
  "four-memory-types": {
    "slug": "four-memory-types",
    "type": "dataflow",
    "chapters": [
      {
        "id": "four-questions",
        "label": "四问分型",
        "file": "four-memory-types--four-questions.mp4",
        "endStill": "four-memory-types--four-questions-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.42,
        "beatNodes": [
          "q-who",
          "q-how",
          "q-what",
          "q-where"
        ]
      },
      {
        "id": "who-and-how",
        "label": "你是谁怎么做事",
        "file": "four-memory-types--who-and-how.mp4",
        "endStill": "four-memory-types--who-and-how-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
        "beatNodes": [
          "q-who",
          "type-user",
          "q-how",
          "type-feedback"
        ]
      },
      {
        "id": "what-and-where",
        "label": "何事何地",
        "file": "four-memory-types--what-and-where.mp4",
        "endStill": "four-memory-types--what-and-where-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.47,
        "beatNodes": [
          "q-what",
          "type-project",
          "q-where",
          "type-reference"
        ]
      }
    ]
  },
  "lossy-summary": {
    "slug": "lossy-summary",
    "type": "workflow",
    "chapters": [
      {
        "id": "taste-lost",
        "label": "留得住目标",
        "file": "lossy-summary--taste-lost.mp4",
        "endStill": "lossy-summary--taste-lost-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "verbatim-tabs",
          "generic-style"
        ]
      },
      {
        "id": "tabs-verbatim",
        "label": "原话在册",
        "file": "lossy-summary--tabs-verbatim.mp4",
        "endStill": "lossy-summary--tabs-verbatim-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.2,
        "beatNodes": [
          "verbatim-tabs"
        ]
      },
      {
        "id": "collapse-rounds",
        "label": "几轮压下来",
        "file": "lossy-summary--collapse-rounds.mp4",
        "endStill": "lossy-summary--collapse-rounds-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "round-1",
          "round-n",
          "generic-style"
        ]
      },
      {
        "id": "forgetting-per-round",
        "label": "压一次丢一层",
        "file": "lossy-summary--forgetting-per-round.mp4",
        "endStill": "lossy-summary--forgetting-per-round-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "forget-depth",
          "generic-style"
        ]
      },
      {
        "id": "all-for-one-line",
        "label": "全部历史一条消息",
        "file": "lossy-summary--all-for-one-line.mp4",
        "endStill": "lossy-summary--all-for-one-line-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "history-one-line",
          "round-n"
        ]
      }
    ]
  },
  "memory-ledger": {
    "slug": "memory-ledger",
    "type": "architecture",
    "chapters": [
      {
        "id": "not-handwritten",
        "label": "扉页不是手写的",
        "file": "memory-ledger--not-handwritten.mp4",
        "endStill": "memory-ledger--not-handwritten-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "index-page"
        ]
      },
      {
        "id": "full-rebuild",
        "label": "从头重排",
        "file": "memory-ledger--full-rebuild.mp4",
        "endStill": "memory-ledger--full-rebuild-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "rebuild-arrow",
          "index-page",
          "memory-file"
        ]
      },
      {
        "id": "derived-vs-source",
        "label": "派生对事实源",
        "file": "memory-ledger--derived-vs-source.mp4",
        "endStill": "memory-ledger--derived-vs-source-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "index-page",
          "file-source"
        ]
      },
      {
        "id": "index-cheap-files-precious",
        "label": "丢扉页不丢文件",
        "file": "memory-ledger--index-cheap-files-precious.mp4",
        "endStill": "memory-ledger--index-cheap-files-precious-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "index-page",
          "rebuild-arrow",
          "file-source"
        ]
      }
    ]
  },
  "memory-panorama": {
    "slug": "memory-panorama",
    "type": "architecture",
    "chapters": [
      {
        "id": "evolved-hint",
        "label": "占位符带上地址",
        "file": "memory-panorama--evolved-hint.mp4",
        "endStill": "memory-panorama--evolved-hint-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.22,
        "beatNodes": [
          "evolve",
          "micro"
        ]
      },
      {
        "id": "roads-closed",
        "label": "路一条条堵上",
        "file": "memory-panorama--roads-closed.mp4",
        "endStill": "memory-panorama--roads-closed-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "evolve",
          "micro",
          "spill"
        ]
      },
      {
        "id": "answer-panorama",
        "label": "现在能答了",
        "file": "memory-panorama--answer-panorama.mp4",
        "endStill": "memory-panorama--answer-panorama-end.png",
        "beats": 7,
        "leadSec": 0.44,
        "storySec": 7.75,
        "beatNodes": [
          "spill",
          "trim",
          "micro",
          "digest",
          "select",
          "extract",
          "night"
        ]
      },
      {
        "id": "lossy-side",
        "label": "会丢的那套",
        "file": "memory-panorama--lossy-side.mp4",
        "endStill": "memory-panorama--lossy-side-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.47,
        "beatNodes": [
          "spill",
          "trim",
          "micro",
          "digest"
        ]
      },
      {
        "id": "ledger-side",
        "label": "不能丢的那套",
        "file": "memory-panorama--ledger-side.mp4",
        "endStill": "memory-panorama--ledger-side-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "select",
          "extract",
          "night"
        ]
      },
      {
        "id": "two-clamps",
        "label": "两处咬合",
        "file": "memory-panorama--two-clamps.mp4",
        "endStill": "memory-panorama--two-clamps-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "extract",
          "model"
        ]
      },
      {
        "id": "vow-cashed",
        "label": "立碑兑现",
        "file": "memory-panorama--vow-cashed.mp4",
        "endStill": "memory-panorama--vow-cashed-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.64,
        "beatNodes": [
          "spill",
          "trim",
          "micro",
          "digest",
          "select",
          "extract"
        ]
      }
    ]
  },
  "night-shift": {
    "slug": "night-shift",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "threshold-in",
        "label": "攒够进场",
        "file": "night-shift--threshold-in.mp4",
        "endStill": "night-shift--threshold-in-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "threshold-gate"
        ]
      },
      {
        "id": "rough-rewrite",
        "label": "删光重写",
        "file": "night-shift--rough-rewrite.mp4",
        "endStill": "night-shift--rough-rewrite-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "catalog-truncate",
          "delete-all",
          "rewrite-list"
        ]
      },
      {
        "id": "reverse-gate",
        "label": "反向的门",
        "file": "night-shift--reverse-gate.mp4",
        "endStill": "night-shift--reverse-gate-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "reverse-gate",
          "catalog-truncate",
          "delete-all"
        ]
      },
      {
        "id": "outside-deleted",
        "label": "窗外照样删",
        "file": "night-shift--outside-deleted.mp4",
        "endStill": "night-shift--outside-deleted-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "reverse-gate",
          "delete-all"
        ]
      },
      {
        "id": "stuck-paradox",
        "label": "越厚越整理不动",
        "file": "night-shift--stuck-paradox.mp4",
        "endStill": "night-shift--stuck-paradox-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "reverse-gate",
          "threshold-gate"
        ]
      }
    ]
  },
  "pair-guard": {
    "slug": "pair-guard",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "pair-rule",
        "label": "同去同留",
        "file": "pair-guard--pair-rule.mp4",
        "endStill": "pair-guard--pair-rule-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "pair-bond"
        ]
      },
      {
        "id": "pair-bound",
        "label": "一对搭档",
        "file": "pair-guard--pair-bound.mp4",
        "endStill": "pair-guard--pair-bound-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "request-card",
          "result-card",
          "pair-bond"
        ]
      },
      {
        "id": "orphan-rejected",
        "label": "孤立回执非法",
        "file": "pair-guard--orphan-rejected.mp4",
        "endStill": "pair-guard--orphan-rejected-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "orphan-result",
          "reject-stamp"
        ]
      },
      {
        "id": "cut-yields",
        "label": "切点让开",
        "file": "pair-guard--cut-yields.mp4",
        "endStill": "pair-guard--cut-yields-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "cut-point-a",
          "cut-point-b",
          "pair-bond"
        ]
      },
      {
        "id": "content-vs-structure",
        "label": "丢内容不丢结构",
        "file": "pair-guard--content-vs-structure.mp4",
        "endStill": "pair-guard--content-vs-structure-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "invariant",
          "pair-bond",
          "request-card",
          "result-card"
        ]
      }
    ]
  },
  "pointer-trade": {
    "slug": "pointer-trade",
    "type": "dataflow",
    "chapters": [
      {
        "id": "batch-account",
        "label": "只算最新一批",
        "file": "pointer-trade--batch-account.mp4",
        "endStill": "pointer-trade--batch-account-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "latest-batch",
          "budget-check"
        ]
      },
      {
        "id": "size-queue",
        "label": "按大小排队",
        "file": "pointer-trade--size-queue.mp4",
        "endStill": "pointer-trade--size-queue-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "size-sort",
          "disk-vault"
        ]
      },
      {
        "id": "parcel-tag",
        "label": "包裹标签",
        "file": "pointer-trade--parcel-tag.mp4",
        "endStill": "pointer-trade--parcel-tag-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "parcel-tag",
          "preview-block"
        ]
      },
      {
        "id": "full-on-disk",
        "label": "全文在磁盘",
        "file": "pointer-trade--full-on-disk.mp4",
        "endStill": "pointer-trade--full-on-disk-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "disk-vault",
          "parcel-tag"
        ]
      },
      {
        "id": "slide-and-flatten",
        "label": "滑出即压扁",
        "file": "pointer-trade--slide-and-flatten.mp4",
        "endStill": "pointer-trade--slide-and-flatten-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "recent-window",
          "old-result",
          "generic-hint"
        ]
      },
      {
        "id": "hint-no-address",
        "label": "提示不带地址",
        "file": "pointer-trade--hint-no-address.mp4",
        "endStill": "pointer-trade--hint-no-address-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "generic-hint",
          "parcel-tag"
        ]
      }
    ]
  },
  "stop-extraction": {
    "slug": "stop-extraction",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "stop-moment",
        "label": "撂活那一刻",
        "file": "stop-extraction--stop-moment.mp4",
        "endStill": "stop-extraction--stop-moment-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "stop-moment"
        ]
      },
      {
        "id": "no-new-call",
        "label": "停且无调用",
        "file": "stop-extraction--no-new-call.mp4",
        "endStill": "stop-extraction--no-new-call-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "stop-moment",
          "no-tool-use"
        ]
      },
      {
        "id": "side-extract",
        "label": "旁路抽取",
        "file": "stop-extraction--side-extract.mp4",
        "endStill": "stop-extraction--side-extract-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.25,
        "beatNodes": [
          "bypass-open",
          "candidate-extract"
        ]
      },
      {
        "id": "dedupe-first",
        "label": "先查旧账",
        "file": "stop-extraction--dedupe-first.mp4",
        "endStill": "stop-extraction--dedupe-first-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "existing-list",
          "candidate-extract"
        ]
      },
      {
        "id": "strong-signals",
        "label": "最认的信号",
        "file": "stop-extraction--strong-signals.mp4",
        "endStill": "stop-extraction--strong-signals-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "signal-strong",
          "candidate-extract"
        ]
      }
    ]
  },
  "two-layer-loading": {
    "slug": "two-layer-loading",
    "type": "sequence",
    "chapters": [
      {
        "id": "two-tracks",
        "label": "两层递送",
        "file": "two-layer-loading--two-tracks.mp4",
        "endStill": "two-layer-loading--two-tracks-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "system-prefix",
          "user-turn"
        ]
      },
      {
        "id": "index-resident",
        "label": "扉页常驻垫纸",
        "file": "two-layer-loading--index-resident.mp4",
        "endStill": "two-layer-loading--index-resident-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "index-resident",
          "system-prefix"
        ]
      },
      {
        "id": "body-on-demand",
        "label": "正文按需进当前轮",
        "file": "two-layer-loading--body-on-demand.mp4",
        "endStill": "two-layer-loading--body-on-demand-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "selector",
          "inject-copy",
          "user-turn"
        ]
      },
      {
        "id": "copy-not-pollute",
        "label": "拼的是拷贝",
        "file": "two-layer-loading--copy-not-pollute.mp4",
        "endStill": "two-layer-loading--copy-not-pollute-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "inject-copy",
          "dialog-ledger"
        ]
      },
      {
        "id": "cache-stakes",
        "label": "前缀一动全白算",
        "file": "two-layer-loading--cache-stakes.mp4",
        "endStill": "two-layer-loading--cache-stakes-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "cache-zone",
          "system-prefix",
          "user-turn"
        ]
      },
      {
        "id": "side-query",
        "label": "目录员旁路",
        "file": "two-layer-loading--side-query.mp4",
        "endStill": "two-layer-loading--side-query-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "side-query",
          "selector"
        ]
      },
      {
        "id": "model-not-vectors",
        "label": "模型选不相似度",
        "file": "two-layer-loading--model-not-vectors.mp4",
        "endStill": "two-layer-loading--model-not-vectors-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "selector",
          "model-pick"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
