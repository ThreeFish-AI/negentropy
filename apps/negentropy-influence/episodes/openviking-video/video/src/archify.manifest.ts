// 本文件由 to-video skill 的 pipeline/scripts/archify_manifest.py 从 public/archify/*.json 生成——请勿手改。
// 数据来源：pipeline/scripts/record_archify.py --mode chapter（逐章录制）
//         + pipeline/scripts/archify_lead.py（场记板白闪测定真实 leadSec）。

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
  "freshness-bubbling": {
    "slug": "freshness-bubbling",
    "type": "dataflow",
    "chapters": [
      {
        "id": "funnel",
        "label": "漏斗入口",
        "file": "freshness-bubbling--funnel.mp4",
        "endStill": "freshness-bubbling--funnel-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "gate",
          "noop"
        ]
      },
      {
        "id": "small",
        "label": "小架直通",
        "file": "freshness-bubbling--small.mp4",
        "endStill": "freshness-bubbling--small-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "small",
          "bubble"
        ]
      },
      {
        "id": "wide",
        "label": "宽架攒批",
        "file": "freshness-bubbling--wide.mp4",
        "endStill": "freshness-bubbling--wide-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "count"
        ]
      }
    ]
  },
  "ingest-phase": {
    "slug": "ingest-phase",
    "type": "dataflow",
    "chapters": [
      {
        "id": "main",
        "label": "同步落盘",
        "file": "ingest-phase--main.mp4",
        "endStill": "ingest-phase--main-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.37,
        "beatNodes": [
          "req",
          "parse_tb",
          "agfs"
        ]
      },
      {
        "id": "queue",
        "label": "语义队列",
        "file": "ingest-phase--queue.mp4",
        "endStill": "ingest-phase--queue-end.png",
        "beats": 1,
        "leadSec": 0.4,
        "storySec": 3.25,
        "beatNodes": [
          "semq"
        ]
      },
      {
        "id": "summarize",
        "label": "编目",
        "file": "ingest-phase--summarize.mp4",
        "endStill": "ingest-phase--summarize-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "fsum",
          "dirl0"
        ]
      },
      {
        "id": "index",
        "label": "向量化",
        "file": "ingest-phase--index.mp4",
        "endStill": "ingest-phase--index-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "embq"
        ]
      },
      {
        "id": "bubble",
        "label": "冒泡",
        "file": "ingest-phase--bubble.mp4",
        "endStill": "ingest-phase--bubble-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "bubble",
          "noop"
        ]
      }
    ]
  },
  "intent-typed-queries": {
    "slug": "intent-typed-queries",
    "type": "workflow",
    "chapters": [
      {
        "id": "gate",
        "label": "有没有会话",
        "file": "intent-typed-queries--gate.mp4",
        "endStill": "intent-typed-queries--gate-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.27,
        "beatNodes": [
          "q",
          "gate"
        ]
      },
      {
        "id": "split",
        "label": "拆单",
        "file": "intent-typed-queries--split.mp4",
        "endStill": "intent-typed-queries--split-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "analyzer",
          "qres",
          "qmem",
          "qskill"
        ]
      },
      {
        "id": "merge",
        "label": "拼接",
        "file": "intent-typed-queries--merge.mp4",
        "endStill": "intent-typed-queries--merge-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "merge"
        ]
      }
    ]
  },
  "lab-break-matrix": {
    "slug": "lab-break-matrix",
    "type": "architecture",
    "chapters": [
      {
        "id": "struct",
        "label": "结构赌注",
        "file": "lab-break-matrix--struct.mp4",
        "endStill": "lab-break-matrix--struct-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "b1",
          "b5"
        ]
      },
      {
        "id": "idcheck",
        "label": "身份与提交点",
        "file": "lab-break-matrix--identity.mp4",
        "endStill": "lab-break-matrix--identity-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.29,
        "beatNodes": [
          "b3",
          "b6"
        ]
      },
      {
        "id": "cost",
        "label": "成本闸",
        "file": "lab-break-matrix--cost.mp4",
        "endStill": "lab-break-matrix--cost-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.23,
        "beatNodes": [
          "b2",
          "b4"
        ]
      }
    ]
  },
  "memory-identity": {
    "slug": "memory-identity",
    "type": "workflow",
    "chapters": [
      {
        "id": "prefetch",
        "label": "提名",
        "file": "memory-identity--prefetch.mp4",
        "endStill": "memory-identity--prefetch-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "prefetch"
        ]
      },
      {
        "id": "identity",
        "label": "身份裁决",
        "file": "memory-identity--identity.mp4",
        "endStill": "memory-identity--identity-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "identity",
          "name"
        ]
      },
      {
        "id": "upsert",
        "label": "落卡",
        "file": "memory-identity--upsert.mp4",
        "endStill": "memory-identity--upsert-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "exists",
          "upsert"
        ]
      }
    ]
  },
  "retrieval-phase": {
    "slug": "retrieval-phase",
    "type": "workflow",
    "chapters": [
      {
        "id": "route",
        "label": "分流",
        "file": "retrieval-phase--route.mp4",
        "endStill": "retrieval-phase--route-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "q",
          "route"
        ]
      },
      {
        "id": "quick",
        "label": "默认档",
        "file": "retrieval-phase--quick.mp4",
        "endStill": "retrieval-phase--quick-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "quick"
        ]
      },
      {
        "id": "thinking",
        "label": "豪华档",
        "file": "retrieval-phase--thinking.mp4",
        "endStill": "retrieval-phase--thinking-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "start",
          "batch"
        ]
      },
      {
        "id": "prune",
        "label": "剪枝与刹车",
        "file": "retrieval-phase--prune.mp4",
        "endStill": "retrieval-phase--prune-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.25,
        "beatNodes": [
          "prune",
          "brake"
        ]
      },
      {
        "id": "asm",
        "label": "借阅推车",
        "file": "retrieval-phase--asm.mp4",
        "endStill": "retrieval-phase--asm-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "asm"
        ]
      }
    ]
  },
  "session-commit-two-phase": {
    "slug": "session-commit-two-phase",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "live",
        "label": "来访",
        "file": "session-commit-two-phase--live.mp4",
        "endStill": "session-commit-two-phase--live-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "live"
        ]
      },
      {
        "id": "archived",
        "label": "装订",
        "file": "session-commit-two-phase--archived.mp4",
        "endStill": "session-commit-two-phase--archived-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "archived"
        ]
      },
      {
        "id": "p2",
        "label": "后台整理",
        "file": "session-commit-two-phase--p2.mp4",
        "endStill": "session-commit-two-phase--p2-end.png",
        "beats": 1,
        "leadSec": 0.48,
        "storySec": 3.23,
        "beatNodes": [
          "p2"
        ]
      },
      {
        "id": "done",
        "label": "盖章",
        "file": "session-commit-two-phase--done.mp4",
        "endStill": "session-commit-two-phase--done-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "done"
        ]
      },
      {
        "id": "failed",
        "label": "封条",
        "file": "session-commit-two-phase--failed.mp4",
        "endStill": "session-commit-two-phase--failed-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "failed",
          "redeliver"
        ]
      }
    ]
  },
  "tiering-l0-l1-l2": {
    "slug": "tiering-l0-l1-l2",
    "type": "architecture",
    "chapters": [
      {
        "id": "layers",
        "label": "三层",
        "file": "tiering-l0-l1-l2--layers.mp4",
        "endStill": "tiering-l0-l1-l2--layers-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "files",
          "l1",
          "l0"
        ]
      },
      {
        "id": "gen",
        "label": "生成链",
        "file": "tiering-l0-l1-l2--gen.mp4",
        "endStill": "tiering-l0-l1-l2--gen-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "fsum",
          "gen"
        ]
      },
      {
        "id": "cut",
        "label": "裁剪",
        "file": "tiering-l0-l1-l2--cut.mp4",
        "endStill": "tiering-l0-l1-l2--cut-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "cut"
        ]
      },
      {
        "id": "sample",
        "label": "采样闸",
        "file": "tiering-l0-l1-l2--sample.mp4",
        "endStill": "tiering-l0-l1-l2--sample-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "sample"
        ]
      },
      {
        "id": "vec",
        "label": "向量化",
        "file": "tiering-l0-l1-l2--vec.mp4",
        "endStill": "tiering-l0-l1-l2--vec-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "vec"
        ]
      }
    ]
  },
  "uri-scope-tree": {
    "slug": "uri-scope-tree",
    "type": "architecture",
    "chapters": [
      {
        "id": "tree",
        "label": "一棵树",
        "file": "uri-scope-tree--tree.mp4",
        "endStill": "uri-scope-tree--tree-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.47,
        "beatNodes": [
          "root",
          "resources",
          "user",
          "agent"
        ]
      },
      {
        "id": "docs",
        "label": "公共馆藏区",
        "file": "uri-scope-tree--docs.mp4",
        "endStill": "uri-scope-tree--docs-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "resources",
          "rdocs"
        ]
      },
      {
        "id": "mem",
        "label": "读者档案室",
        "file": "uri-scope-tree--mem.mp4",
        "endStill": "uri-scope-tree--mem-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "user",
          "umem"
        ]
      },
      {
        "id": "skill",
        "label": "馆员手册室",
        "file": "uri-scope-tree--skill.mp4",
        "endStill": "uri-scope-tree--skill-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "agent",
          "askill"
        ]
      },
      {
        "id": "counter",
        "label": "位置即身份",
        "file": "uri-scope-tree--counter.mp4",
        "endStill": "uri-scope-tree--counter-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "counter"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
