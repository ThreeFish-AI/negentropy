// 本文件由 scripts/archify_manifest.py 从 public/archify/*.json 生成——请勿手改。
// 数据来源：pipeline/scripts/record_archify.py --mode chapter（逐章录制）
//         + scripts/archify_lead.py（场记板白闪测定真实 leadSec）。

export type ArchifyChapter = {
  /** views JSON 里的章节 id */
  id: string;
  /** 章节小标题（画面左下） */
  label: string;
  /** public/archify/ 下的 webm 文件名 */
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

export type ArchifyDiagram = {slug: string; chapters: ArchifyChapter[]};

export const ARCHIFY = {
  "agent-identity": {
    "slug": "agent-identity",
    "chapters": [
      {
        "id": "ceiling",
        "label": "权限天花板只减不增",
        "file": "agent-identity--ceiling.webm",
        "endStill": "agent-identity--ceiling-end.png",
        "beats": 4,
        "leadSec": 1.88,
        "storySec": 4.43,
        "beatNodes": [
          "user",
          "agent",
          "ceil",
          "sess"
        ]
      },
      {
        "id": "audit",
        "label": "刷卡可归因",
        "file": "agent-identity--audit.webm",
        "endStill": "agent-identity--audit-end.png",
        "beats": 2,
        "leadSec": 1.76,
        "storySec": 3.22,
        "beatNodes": [
          "sess",
          "qh"
        ]
      },
      {
        "id": "strict",
        "label": "供策略叠加严拒面",
        "file": "agent-identity--strict.webm",
        "endStill": "agent-identity--strict-end.png",
        "beats": 2,
        "leadSec": 1.76,
        "storySec": 3.22,
        "beatNodes": [
          "sess",
          "pol"
        ]
      }
    ]
  },
  "autopilot-loop": {
    "slug": "autopilot-loop",
    "chapters": [
      {
        "id": "inputs",
        "label": "六路输入面",
        "file": "autopilot-loop--inputs.webm",
        "endStill": "autopilot-loop--inputs-end.png",
        "beats": 3,
        "leadSec": 1.8,
        "storySec": 3.33,
        "beatNodes": [
          "in_zero",
          "in_bi",
          "in_pairs"
        ]
      },
      {
        "id": "valgate",
        "label": "验证门与入库",
        "file": "autopilot-loop--valgate.webm",
        "endStill": "autopilot-loop--valgate-end.png",
        "beats": 4,
        "leadSec": 1.8,
        "storySec": 4.43,
        "beatNodes": [
          "validate",
          "discard",
          "sv",
          "vqr"
        ]
      },
      {
        "id": "loop",
        "label": "激活与反馈回流",
        "file": "autopilot-loop--loop.webm",
        "endStill": "autopilot-loop--loop-end.png",
        "beats": 2,
        "leadSec": 1.76,
        "storySec": 3.21,
        "beatNodes": [
          "consume",
          "vqr"
        ]
      }
    ]
  },
  "classification-tagging": {
    "slug": "classification-tagging",
    "chapters": [
      {
        "id": "tag-driven",
        "label": "分类到自动纳管",
        "file": "classification-tagging--tag-driven.webm",
        "endStill": "classification-tagging--tag-driven-end.png",
        "beats": 6,
        "leadSec": 1.88,
        "storySec": 6.63,
        "beatNodes": [
          "new",
          "cls",
          "map",
          "tag",
          "pol",
          "out"
        ]
      },
      {
        "id": "explicit-gap",
        "label": "未映射显式缺口",
        "file": "classification-tagging--explicit-gap.webm",
        "endStill": "classification-tagging--explicit-gap-end.png",
        "beats": 2,
        "leadSec": 1.8,
        "storySec": 3.21,
        "beatNodes": [
          "map",
          "gap"
        ]
      },
      {
        "id": "honest-limit",
        "label": "能力边界如实",
        "file": "classification-tagging--honest-limit.webm",
        "endStill": "classification-tagging--honest-limit-end.png",
        "beats": 2,
        "leadSec": 1.8,
        "storySec": 3.21,
        "beatNodes": [
          "pol",
          "limit"
        ]
      }
    ]
  },
  "collect-enrich-activate": {
    "slug": "collect-enrich-activate",
    "chapters": [
      {
        "id": "collect",
        "label": "三路元数据汇聚",
        "file": "collect-enrich-activate--collect.webm",
        "endStill": "collect-enrich-activate--collect-end.png",
        "beats": 4,
        "leadSec": 1.76,
        "storySec": 4.43,
        "beatNodes": [
          "s1",
          "s2",
          "s3",
          "c"
        ]
      },
      {
        "id": "enrich",
        "label": "双轨富化与冲突浮出",
        "file": "collect-enrich-activate--enrich.webm",
        "endStill": "collect-enrich-activate--enrich-end.png",
        "beats": 3,
        "leadSec": 1.76,
        "storySec": 3.33,
        "beatNodes": [
          "c",
          "g",
          "i"
        ]
      },
      {
        "id": "activate",
        "label": "排序后激活",
        "file": "collect-enrich-activate--activate.webm",
        "endStill": "collect-enrich-activate--activate-end.png",
        "beats": 4,
        "leadSec": 1.8,
        "storySec": 4.43,
        "beatNodes": [
          "r",
          "a1",
          "a2",
          "a3"
        ]
      }
    ]
  },
  "component-panorama": {
    "slug": "component-panorama",
    "chapters": [
      {
        "id": "caliber-spine",
        "label": "口径主线",
        "file": "component-panorama--caliber-spine.webm",
        "endStill": "component-panorama--caliber-spine-end.png",
        "beats": 4,
        "leadSec": 1.76,
        "storySec": 4.41,
        "beatNodes": [
          "ap",
          "sv",
          "gov",
          "pol"
        ]
      },
      {
        "id": "consumer-feed",
        "label": "消费端五路汇入",
        "file": "component-panorama--consumer-feed.webm",
        "endStill": "component-panorama--consumer-feed-end.png",
        "beats": 6,
        "leadSec": 1.76,
        "storySec": 6.63,
        "beatNodes": [
          "vqr",
          "us",
          "mcp",
          "el",
          "grd",
          "agents"
        ]
      },
      {
        "id": "reserved-supply",
        "label": "降级保留区",
        "file": "component-panorama--reserved-supply.webm",
        "endStill": "component-panorama--reserved-supply-end.png",
        "beats": 7,
        "leadSec": 1.76,
        "storySec": 7.75,
        "beatNodes": [
          "ap",
          "cs",
          "us",
          "oss",
          "mcp",
          "ada",
          "grd"
        ]
      }
    ]
  },
  "declaration-execution": {
    "slug": "declaration-execution",
    "chapters": [
      {
        "id": "declare",
        "label": "五段式声明",
        "file": "declaration-execution--declare.webm",
        "endStill": "declaration-execution--declare-end.png",
        "beats": 5,
        "leadSec": 1.8,
        "storySec": 5.53,
        "beatNodes": [
          "tables",
          "rels",
          "facts",
          "metrics",
          "fivePart"
        ]
      },
      {
        "id": "gate",
        "label": "注册期结构校验门",
        "file": "declaration-execution--gate.webm",
        "endStill": "declaration-execution--gate-end.png",
        "beats": 3,
        "leadSec": 1.76,
        "storySec": 3.31,
        "beatNodes": [
          "fivePart",
          "gate",
          "reject"
        ]
      },
      {
        "id": "recompute",
        "label": "查询期按 grain 重算",
        "file": "declaration-execution--recompute.webm",
        "endStill": "declaration-execution--recompute-end.png",
        "beats": 4,
        "leadSec": 1.76,
        "storySec": 4.41,
        "beatNodes": [
          "rbac",
          "agg",
          "result",
          "denied"
        ]
      }
    ]
  },
  "engine-governance": {
    "slug": "engine-governance",
    "chapters": [
      {
        "id": "governed-path",
        "label": "治理主路径",
        "file": "engine-governance--governed-path.webm",
        "endStill": "engine-governance--governed-path-end.png",
        "beats": 5,
        "leadSec": 1.92,
        "storySec": 5.53,
        "beatNodes": [
          "cal",
          "flt",
          "def",
          "rb",
          "out"
        ]
      },
      {
        "id": "bypass-intercepted",
        "label": "绕行仍被拦截",
        "file": "engine-governance--bypass-intercepted.webm",
        "endStill": "engine-governance--bypass-intercepted-end.png",
        "beats": 3,
        "leadSec": 1.76,
        "storySec": 3.32,
        "beatNodes": [
          "cal",
          "byp",
          "ax"
        ]
      }
    ]
  },
  "evolution-timeline": {
    "slug": "evolution-timeline",
    "chapters": [
      {
        "id": "stage-objects",
        "label": "阶段一 · 对象化",
        "file": "evolution-timeline--stage-objects.webm",
        "endStill": "evolution-timeline--stage-objects-end.png",
        "beats": 2,
        "leadSec": 1.68,
        "storySec": 3.21,
        "beatNodes": [
          "ms1",
          "ms2"
        ]
      },
      {
        "id": "stage-governed-enrich",
        "label": "阶段二 · 通道与富化",
        "file": "evolution-timeline--stage-governed-enrich.webm",
        "endStill": "evolution-timeline--stage-governed-enrich-end.png",
        "beats": 10,
        "leadSec": 1.88,
        "storySec": 11.05,
        "beatNodes": [
          "ms3",
          "ms4",
          "ms5",
          "ms6",
          "ms7a",
          "ms7b",
          "ms8",
          "ms9",
          "ms10",
          "ms11"
        ]
      },
      {
        "id": "stage-ecosystem",
        "label": "阶段三 · 生态开放",
        "file": "evolution-timeline--stage-ecosystem.webm",
        "endStill": "evolution-timeline--stage-ecosystem-end.png",
        "beats": 3,
        "leadSec": 1.96,
        "storySec": 3.33,
        "beatNodes": [
          "ms12",
          "ms13",
          "ms14"
        ]
      }
    ]
  },
  "four-factor-ranking": {
    "slug": "four-factor-ranking",
    "chapters": [
      {
        "id": "signals",
        "label": "四路信号来源",
        "file": "four-factor-ranking--signals.webm",
        "endStill": "four-factor-ranking--signals-end.png",
        "beats": 5,
        "leadSec": 1.72,
        "storySec": 5.53,
        "beatNodes": [
          "q",
          "gov",
          "inf",
          "use",
          "tm"
        ]
      },
      {
        "id": "factors",
        "label": "四因子称重",
        "file": "four-factor-ranking--factors.webm",
        "endStill": "four-factor-ranking--factors-end.png",
        "beats": 4,
        "leadSec": 1.76,
        "storySec": 4.43,
        "beatNodes": [
          "rel",
          "aut",
          "pop",
          "fre"
        ]
      },
      {
        "id": "topk",
        "label": "合成与显式裁决",
        "file": "four-factor-ranking--topk.webm",
        "endStill": "four-factor-ranking--topk-end.png",
        "beats": 3,
        "leadSec": 1.92,
        "storySec": 3.33,
        "beatNodes": [
          "score",
          "tie",
          "topk"
        ]
      }
    ]
  },
  "lineage-ledger": {
    "slug": "lineage-ledger",
    "chapters": [
      {
        "id": "engine-lane",
        "label": "引擎执行",
        "file": "lineage-ledger--engine-lane.webm",
        "endStill": "lineage-ledger--engine-lane-end.png",
        "beats": 3,
        "leadSec": 1.68,
        "storySec": 3.33,
        "beatNodes": [
          "sql",
          "edg",
          "ledger"
        ]
      },
      {
        "id": "ingest-lane",
        "label": "外部摄取",
        "file": "lineage-ledger--ingest-lane.webm",
        "endStill": "lineage-ledger--ingest-lane-end.png",
        "beats": 4,
        "leadSec": 1.76,
        "storySec": 4.43,
        "beatNodes": [
          "evt",
          "gate",
          "rej",
          "ledger"
        ]
      },
      {
        "id": "ledger-and-blind",
        "label": "账本与盲区",
        "file": "lineage-ledger--ledger-and-blind.webm",
        "endStill": "lineage-ledger--ledger-and-blind-end.png",
        "beats": 3,
        "leadSec": 1.92,
        "storySec": 3.33,
        "beatNodes": [
          "ledger",
          "q",
          "blind"
        ]
      }
    ]
  },
  "open-interop": {
    "slug": "open-interop",
    "chapters": [
      {
        "id": "portable",
        "label": "定义可携带",
        "file": "open-interop--portable.webm",
        "endStill": "open-interop--portable-end.png",
        "beats": 4,
        "leadSec": 1.96,
        "storySec": 4.43,
        "beatNodes": [
          "oss",
          "sys",
          "sv",
          "dbt"
        ]
      },
      {
        "id": "socket",
        "label": "受控工具面开放",
        "file": "open-interop--socket.webm",
        "endStill": "open-interop--socket-end.png",
        "beats": 4,
        "leadSec": 1.76,
        "storySec": 4.43,
        "beatNodes": [
          "sv",
          "mcp",
          "ext",
          "rbx"
        ]
      },
      {
        "id": "feedback",
        "label": "反馈回流",
        "file": "open-interop--feedback.webm",
        "endStill": "open-interop--feedback-end.png",
        "beats": 3,
        "leadSec": 1.72,
        "storySec": 3.32,
        "beatNodes": [
          "fb",
          "sv",
          "ada"
        ]
      }
    ]
  },
  "problem-to-mechanisms": {
    "slug": "problem-to-mechanisms",
    "chapters": [
      {
        "id": "cause-chain",
        "label": "病因链",
        "file": "problem-to-mechanisms--cause-chain.webm",
        "endStill": "problem-to-mechanisms--cause-chain-end.png",
        "beats": 4,
        "leadSec": 1.92,
        "storySec": 4.43,
        "beatNodes": [
          "sym-gap",
          "sym-acc",
          "sym-col",
          "verdict"
        ]
      },
      {
        "id": "encircle-pierce",
        "label": "病灶③合围",
        "file": "problem-to-mechanisms--encircle-pierce.webm",
        "endStill": "problem-to-mechanisms--encircle-pierce-end.png",
        "beats": 4,
        "leadSec": 1.72,
        "storySec": 4.43,
        "beatNodes": [
          "pierce",
          "m2",
          "m3",
          "m6"
        ]
      },
      {
        "id": "engine-cast",
        "label": "铸入引擎",
        "file": "problem-to-mechanisms--engine-cast.webm",
        "endStill": "problem-to-mechanisms--engine-cast-end.png",
        "beats": 4,
        "leadSec": 1.76,
        "storySec": 4.43,
        "beatNodes": [
          "m1",
          "m2",
          "m3",
          "m6"
        ]
      },
      {
        "id": "answer-ledger",
        "label": "应答与纳管",
        "file": "problem-to-mechanisms--answer-ledger.webm",
        "endStill": "problem-to-mechanisms--answer-ledger-end.png",
        "beats": 3,
        "leadSec": 1.76,
        "storySec": 3.31,
        "beatNodes": [
          "m4",
          "m5",
          "m7"
        ]
      },
      {
        "id": "downgraded-lane",
        "label": "降级专章",
        "file": "problem-to-mechanisms--downgraded-lane.webm",
        "endStill": "problem-to-mechanisms--downgraded-lane-end.png",
        "beats": 3,
        "leadSec": 1.76,
        "storySec": 3.32,
        "beatNodes": [
          "f10",
          "f11",
          "f12"
        ]
      }
    ]
  },
  "resolve-activation": {
    "slug": "resolve-activation",
    "chapters": [
      {
        "id": "hit-reconcile",
        "label": "命中与对账",
        "file": "resolve-activation--hit-reconcile.webm",
        "endStill": "resolve-activation--hit-reconcile-end.png",
        "beats": 3,
        "leadSec": 1.88,
        "storySec": 3.31,
        "beatNodes": [
          "ag",
          "vq",
          "en"
        ]
      },
      {
        "id": "miss-fallback",
        "label": "未命中回退",
        "file": "resolve-activation--miss-fallback.webm",
        "endStill": "resolve-activation--miss-fallback-end.png",
        "beats": 2,
        "leadSec": 1.72,
        "storySec": 3.22,
        "beatNodes": [
          "ag",
          "vq"
        ]
      },
      {
        "id": "outside-eval",
        "label": "墙外评测闭环",
        "file": "resolve-activation--outside-eval.webm",
        "endStill": "resolve-activation--outside-eval-end.png",
        "beats": 1,
        "leadSec": 1.8,
        "storySec": 3.21,
        "beatNodes": [
          "ev"
        ]
      }
    ]
  },
  "row-column-policy": {
    "slug": "row-column-policy",
    "chapters": [
      {
        "id": "perpage",
        "label": "逐页验放",
        "file": "row-column-policy--perpage.webm",
        "endStill": "row-column-policy--perpage-end.png",
        "beats": 4,
        "leadSec": 1.8,
        "storySec": 4.43,
        "beatNodes": [
          "cal",
          "po",
          "msk",
          "rap"
        ]
      },
      {
        "id": "family",
        "label": "同族策略对象",
        "file": "row-column-policy--family.webm",
        "endStill": "row-column-policy--family-end.png",
        "beats": 3,
        "leadSec": 1.76,
        "storySec": 3.32,
        "beatNodes": [
          "po",
          "agp",
          "out"
        ]
      },
      {
        "id": "agentface",
        "label": "代理叠加更严拒绝面",
        "file": "row-column-policy--agentface.webm",
        "endStill": "row-column-policy--agentface-end.png",
        "beats": 3,
        "leadSec": 1.8,
        "storySec": 3.32,
        "beatNodes": [
          "aid",
          "po",
          "cls"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
