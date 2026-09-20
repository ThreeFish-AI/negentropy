// 本文件由 scripts/archify_manifest.py 从 public/archify/*.json 生成——请勿手改。
// 数据来源：pipeline/scripts/record_archify.py --mode chapter（逐章录制）
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
  "agent-identity": {
    "slug": "agent-identity",
    "type": "workflow",
    "chapters": [
      {
        "id": "ceiling",
        "label": "权限天花板只减不增",
        "file": "agent-identity--ceiling.mp4",
        "endStill": "agent-identity--ceiling-end.png",
        "beats": 4,
        "leadSec": 0.16,
        "storySec": 4.45,
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
        "file": "agent-identity--audit.mp4",
        "endStill": "agent-identity--audit-end.png",
        "beats": 2,
        "leadSec": 0.16,
        "storySec": 3.26,
        "beatNodes": [
          "sess",
          "qh"
        ]
      },
      {
        "id": "strict",
        "label": "供策略叠加严拒面",
        "file": "agent-identity--strict.mp4",
        "endStill": "agent-identity--strict-end.png",
        "beats": 2,
        "leadSec": 0.16,
        "storySec": 3.23,
        "beatNodes": [
          "sess",
          "pol"
        ]
      },
      {
        "id": "snapshot-vs-live",
        "label": "快照 vs 实时双钟",
        "file": "agent-identity--snapshot-vs-live.mp4",
        "endStill": "agent-identity--snapshot-vs-live-end.png",
        "beats": 3,
        "leadSec": 0.16,
        "storySec": 3.34,
        "beatNodes": [
          "user",
          "ceil",
          "sess"
        ]
      }
    ]
  },
  "amnesia-intern": {
    "slug": "amnesia-intern",
    "type": "workflow",
    "chapters": [
      {
        "id": "daily-reset",
        "label": "每天清零的日循环",
        "file": "amnesia-intern--daily-reset.mp4",
        "endStill": "amnesia-intern--daily-reset-end.png",
        "beats": 3,
        "leadSec": 0.16,
        "storySec": 3.36,
        "beatNodes": [
          "geniusHire",
          "doorIn",
          "memoryWipe"
        ]
      },
      {
        "id": "dark-guess",
        "label": "没术语表，黑暗中瞎猜",
        "file": "amnesia-intern--dark-guess.mp4",
        "endStill": "amnesia-intern--dark-guess-end.png",
        "beats": 5,
        "leadSec": 0.12,
        "storySec": 5.58,
        "beatNodes": [
          "memoryWipe",
          "noGlossary",
          "noCaliber",
          "darkGuess",
          "aiAssistant"
        ]
      }
    ]
  },
  "attribution-balance": {
    "slug": "attribution-balance",
    "type": "architecture",
    "chapters": [
      {
        "id": "not-the-brain",
        "label": "不取决于大脑",
        "file": "attribution-balance--not-the-brain.mp4",
        "endStill": "attribution-balance--not-the-brain-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "when-correct",
          "balance",
          "model-brain"
        ]
      },
      {
        "id": "cast-into-infra",
        "label": "取决于铸基",
        "file": "attribution-balance--cast-into-infra.mp4",
        "endStill": "attribution-balance--cast-into-infra-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
        "beatNodes": [
          "cast-into-infra",
          "mech-semantics",
          "mech-governance",
          "mech-trust"
        ]
      }
    ]
  },
  "autopilot-loop": {
    "slug": "autopilot-loop",
    "type": "workflow",
    "chapters": [
      {
        "id": "inputs",
        "label": "六路输入面",
        "file": "autopilot-loop--inputs.mp4",
        "endStill": "autopilot-loop--inputs-end.png",
        "beats": 3,
        "leadSec": 0.44,
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
        "file": "autopilot-loop--valgate.mp4",
        "endStill": "autopilot-loop--valgate-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.47,
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
        "file": "autopilot-loop--loop.mp4",
        "endStill": "autopilot-loop--loop-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "consume",
          "vqr"
        ]
      }
    ]
  },
  "bare-key-baseline": {
    "slug": "bare-key-baseline",
    "type": "workflow",
    "chapters": [
      {
        "id": "whole-key",
        "label": "整库钥匙直连",
        "file": "bare-key-baseline--whole-key.mp4",
        "endStill": "bare-key-baseline--whole-key-end.png",
        "beats": 3,
        "leadSec": 0.12,
        "storySec": 3.35,
        "beatNodes": [
          "keyHandover",
          "bareAgent",
          "rawTable"
        ]
      },
      {
        "id": "blind-wrong",
        "label": "认得出答不对",
        "file": "bare-key-baseline--blind-wrong.mp4",
        "endStill": "bare-key-baseline--blind-wrong-end.png",
        "beats": 2,
        "leadSec": 0.16,
        "storySec": 3.24,
        "beatNodes": [
          "rawTable",
          "wrongAnswer"
        ]
      },
      {
        "id": "baseline-two",
        "label": "两成多双口径对撞",
        "file": "bare-key-baseline--baseline-two.mp4",
        "endStill": "bare-key-baseline--baseline-two-end.png",
        "beats": 4,
        "leadSec": 0.16,
        "storySec": 4.45,
        "beatNodes": [
          "wrongAnswer",
          "vendorBench",
          "thirdPartyBench",
          "sameOrder"
        ]
      }
    ]
  },
  "blueprint-foundation": {
    "slug": "blueprint-foundation",
    "type": "architecture",
    "chapters": [
      {
        "id": "blueprint-vs-foundation",
        "label": "图纸vs地基",
        "file": "blueprint-foundation--blueprint-vs-foundation.mp4",
        "endStill": "blueprint-foundation--blueprint-vs-foundation-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "validateGate",
          "semanticView",
          "dbtDaily",
          "answerWrong"
        ]
      }
    ]
  },
  "calc-discipline-matrix": {
    "slug": "calc-discipline-matrix",
    "type": "architecture",
    "chapters": [
      {
        "id": "agg-before-join",
        "label": "先聚后联铁律",
        "file": "calc-discipline-matrix--agg-before-join.mp4",
        "endStill": "calc-discipline-matrix--agg-before-join-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
        "beatNodes": [
          "handbook",
          "rule-agg-before-join",
          "trap-fanout",
          "recompute"
        ]
      },
      {
        "id": "dedup-count",
        "label": "去重计数安全",
        "file": "calc-discipline-matrix--dedup-count.mp4",
        "endStill": "calc-discipline-matrix--dedup-count-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "rule-dedup-count",
          "trap-double-count",
          "recompute"
        ]
      },
      {
        "id": "divide-after-agg",
        "label": "先聚后除",
        "file": "calc-discipline-matrix--divide-after-agg.mp4",
        "endStill": "calc-discipline-matrix--divide-after-agg-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "rule-divide-after-agg",
          "trap-avg-of-avg",
          "recompute"
        ]
      },
      {
        "id": "semi-additive",
        "label": "半可加规则",
        "file": "calc-discipline-matrix--semi-additive.mp4",
        "endStill": "calc-discipline-matrix--semi-additive-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "rule-semi-additive",
          "trap-sum-over-time",
          "recompute",
          "answer"
        ]
      }
    ]
  },
  "caliber-clash": {
    "slug": "caliber-clash",
    "type": "architecture",
    "chapters": [
      {
        "id": "three-dashboards",
        "label": "三看板三种数",
        "file": "caliber-clash--three-dashboards.mp4",
        "endStill": "caliber-clash--three-dashboards-end.png",
        "beats": 5,
        "leadSec": 0.16,
        "storySec": 5.55,
        "beatNodes": [
          "netRevenue",
          "salesBoard",
          "finBoard",
          "opsBoard",
          "clash"
        ]
      },
      {
        "id": "twenty-algorithms",
        "label": "二十看板二十算法",
        "file": "caliber-clash--twenty-algorithms.mp4",
        "endStill": "caliber-clash--twenty-algorithms-end.png",
        "beats": 2,
        "leadSec": 0.12,
        "storySec": 3.26,
        "beatNodes": [
          "spread",
          "netRevenue"
        ]
      },
      {
        "id": "owners-clash",
        "label": "主管对账对不上",
        "file": "caliber-clash--owners-clash.mp4",
        "endStill": "caliber-clash--owners-clash-end.png",
        "beats": 3,
        "leadSec": 0.16,
        "storySec": 3.33,
        "beatNodes": [
          "clash",
          "salesLead",
          "cfoLead"
        ]
      }
    ]
  },
  "cipher-translate": {
    "slug": "cipher-translate",
    "type": "dataflow",
    "chapters": [
      {
        "id": "not-model-dumb",
        "label": "不是模型笨",
        "file": "cipher-translate--not-model-dumb.mp4",
        "endStill": "cipher-translate--not-model-dumb-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.34,
        "beatNodes": [
          "q-card",
          "ai-brain",
          "cipher-wall"
        ]
      },
      {
        "id": "cipher-wall",
        "label": "物理列名乱码",
        "file": "cipher-translate--cipher-wall.mp4",
        "endStill": "cipher-translate--cipher-wall-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "cipher-wall",
          "dict-missing",
          "plain-card"
        ]
      },
      {
        "id": "letters-not-meaning",
        "label": "认得出字母",
        "file": "cipher-translate--letters-not-meaning.mp4",
        "endStill": "cipher-translate--letters-not-meaning-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "cipher-wall",
          "letters-ok",
          "dict-missing",
          "outcome"
        ]
      }
    ]
  },
  "classification-tagging": {
    "slug": "classification-tagging",
    "type": "workflow",
    "chapters": [
      {
        "id": "tag-driven",
        "label": "分类到自动纳管",
        "file": "classification-tagging--tag-driven.mp4",
        "endStill": "classification-tagging--tag-driven-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.64,
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
        "file": "classification-tagging--explicit-gap.mp4",
        "endStill": "classification-tagging--explicit-gap-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "map",
          "gap"
        ]
      },
      {
        "id": "honest-limit",
        "label": "能力边界如实",
        "file": "classification-tagging--honest-limit.mp4",
        "endStill": "classification-tagging--honest-limit-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "pol",
          "limit"
        ]
      }
    ]
  },
  "collect-enrich-activate": {
    "slug": "collect-enrich-activate",
    "type": "dataflow",
    "chapters": [
      {
        "id": "collect",
        "label": "三路元数据汇聚",
        "file": "collect-enrich-activate--collect.mp4",
        "endStill": "collect-enrich-activate--collect-end.png",
        "beats": 4,
        "leadSec": 0.44,
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
        "file": "collect-enrich-activate--enrich.mp4",
        "endStill": "collect-enrich-activate--enrich-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.38,
        "beatNodes": [
          "c",
          "g",
          "i"
        ]
      },
      {
        "id": "activate",
        "label": "排序后激活",
        "file": "collect-enrich-activate--activate.mp4",
        "endStill": "collect-enrich-activate--activate-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.42,
        "beatNodes": [
          "r",
          "a1",
          "a2",
          "a3"
        ]
      }
    ]
  },
  "compile-time-block": {
    "slug": "compile-time-block",
    "type": "sequence",
    "chapters": [
      {
        "id": "ux-vs-lifeline",
        "label": "体验vs命门",
        "file": "compile-time-block--ux-vs-lifeline.mp4",
        "endStill": "compile-time-block--ux-vs-lifeline-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
        "beatNodes": [
          "caller",
          "retrieval",
          "engine",
          "gov"
        ]
      },
      {
        "id": "no-backdoor",
        "label": "不成后门",
        "file": "compile-time-block--no-backdoor.mp4",
        "endStill": "compile-time-block--no-backdoor-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "semantic",
          "caller",
          "engine"
        ]
      },
      {
        "id": "compile-second",
        "label": "编译那一秒",
        "file": "compile-time-block--compile-second.mp4",
        "endStill": "compile-time-block--compile-second-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "engine",
          "gov",
          "caller"
        ]
      }
    ]
  },
  "component-panorama": {
    "slug": "component-panorama",
    "type": "architecture",
    "chapters": [
      {
        "id": "caliber-spine",
        "label": "口径主线",
        "file": "component-panorama--caliber-spine.mp4",
        "endStill": "component-panorama--caliber-spine-end.png",
        "beats": 4,
        "leadSec": 0.16,
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
        "file": "component-panorama--consumer-feed.mp4",
        "endStill": "component-panorama--consumer-feed-end.png",
        "beats": 6,
        "leadSec": 0.12,
        "storySec": 6.66,
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
        "file": "component-panorama--reserved-supply.mp4",
        "endStill": "component-panorama--reserved-supply-end.png",
        "beats": 7,
        "leadSec": 0.12,
        "storySec": 7.76,
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
    "type": "workflow",
    "chapters": [
      {
        "id": "declare",
        "label": "五段式声明",
        "file": "declaration-execution--declare.mp4",
        "endStill": "declaration-execution--declare-end.png",
        "beats": 5,
        "leadSec": 0.12,
        "storySec": 5.55,
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
        "file": "declaration-execution--gate.mp4",
        "endStill": "declaration-execution--gate-end.png",
        "beats": 3,
        "leadSec": 0.12,
        "storySec": 3.35,
        "beatNodes": [
          "fivePart",
          "gate",
          "reject"
        ]
      },
      {
        "id": "recompute",
        "label": "查询期按 grain 重算",
        "file": "declaration-execution--recompute.mp4",
        "endStill": "declaration-execution--recompute-end.png",
        "beats": 4,
        "leadSec": 0.16,
        "storySec": 4.46,
        "beatNodes": [
          "rbac",
          "agg",
          "result",
          "denied"
        ]
      },
      {
        "id": "switch-divergence",
        "label": "执行开关分化",
        "file": "declaration-execution--switch-divergence.mp4",
        "endStill": "declaration-execution--switch-divergence-end.png",
        "beats": 4,
        "leadSec": 0.12,
        "storySec": 4.46,
        "beatNodes": [
          "fivePart",
          "rbac",
          "agg",
          "result"
        ]
      }
    ]
  },
  "dedup-safety": {
    "slug": "dedup-safety",
    "type": "workflow",
    "chapters": [
      {
        "id": "set-vs-rows",
        "label": "数集合 vs 数物理行",
        "file": "dedup-safety--set-vs-rows.mp4",
        "endStill": "dedup-safety--set-vs-rows-end.png",
        "beats": 5,
        "leadSec": 0.12,
        "storySec": 5.57,
        "beatNodes": [
          "eventRows",
          "naiveCount",
          "wrong6",
          "dedupSafety",
          "right3"
        ]
      }
    ]
  },
  "definition-registration": {
    "slug": "definition-registration",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "strict-gate",
        "label": "极严校验门",
        "file": "definition-registration--strict-gate.mp4",
        "endStill": "definition-registration--strict-gate-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.42,
        "beatNodes": [
          "validating",
          "rule_fk",
          "rule_cycle",
          "rule_grain"
        ]
      },
      {
        "id": "nonkey-rejected",
        "label": "指向非键列被拒",
        "file": "definition-registration--nonkey-rejected.mp4",
        "endStill": "definition-registration--nonkey-rejected-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "bad_fk",
          "validating",
          "rejected"
        ]
      },
      {
        "id": "no-runtime-risk",
        "label": "注册期进不去",
        "file": "definition-registration--no-runtime-risk.mp4",
        "endStill": "definition-registration--no-runtime-risk-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "rejected",
          "registered",
          "runtime"
        ]
      }
    ]
  },
  "dictionary-drift": {
    "slug": "dictionary-drift",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "dict-outside",
        "label": "词典在库外",
        "file": "dictionary-drift--dict-outside.mp4",
        "endStill": "dictionary-drift--dict-outside-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.31,
        "beatNodes": [
          "dict-mounted",
          "table-v1",
          "loose-sync"
        ]
      },
      {
        "id": "schema-changed",
        "label": "底层一改",
        "file": "dictionary-drift--schema-changed.mp4",
        "endStill": "dictionary-drift--schema-changed-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.31,
        "beatNodes": [
          "table-v1",
          "schema-change",
          "stale-dict"
        ]
      },
      {
        "id": "stale-manual",
        "label": "按旧手册猜",
        "file": "dictionary-drift--stale-manual.mp4",
        "endStill": "dictionary-drift--stale-manual-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "stale-dict",
          "ai-stale-manual",
          "wrong-answers"
        ]
      }
    ]
  },
  "dual-baseline-evidence": {
    "slug": "dual-baseline-evidence",
    "type": "dataflow",
    "chapters": [
      {
        "id": "two-benchmarks",
        "label": "两成多双口径",
        "file": "dual-baseline-evidence--two-benchmarks.mp4",
        "endStill": "dual-baseline-evidence--two-benchmarks-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.42,
        "beatNodes": [
          "snowflakeInternal",
          "internal25",
          "anthropicRetest",
          "retest21"
        ]
      }
    ]
  },
  "dual-challenge-fork": {
    "slug": "dual-challenge-fork",
    "type": "architecture",
    "chapters": [
      {
        "id": "challenge-one",
        "label": "第一个挑战",
        "file": "dual-challenge-fork--challenge-one.mp4",
        "endStill": "dual-challenge-fork--challenge-one-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "foundation",
          "challengeOne",
          "vqr",
          "sealedAnswer"
        ]
      },
      {
        "id": "challenge-two",
        "label": "第二个挑战",
        "file": "dual-challenge-fork--challenge-two.mp4",
        "endStill": "dual-challenge-fork--challenge-two-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
        "beatNodes": [
          "challengeTwo",
          "ledger",
          "intakeGate",
          "auditClose"
        ]
      }
    ]
  },
  "dual-path-disambiguation": {
    "slug": "dual-path-disambiguation",
    "type": "workflow",
    "chapters": [
      {
        "id": "two-paths",
        "label": "双路径显式声明",
        "file": "dual-path-disambiguation--two-paths.mp4",
        "endStill": "dual-path-disambiguation--two-paths-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.63,
        "beatNodes": [
          "ordersTbl",
          "forkGate",
          "buyerNode",
          "refNode",
          "custTbl",
          "ambiguous"
        ]
      }
    ]
  },
  "engine-governance": {
    "slug": "engine-governance",
    "type": "workflow",
    "chapters": [
      {
        "id": "sign-vs-wall",
        "label": "木牌 vs 承重墙",
        "file": "engine-governance--sign-vs-wall.mp4",
        "endStill": "engine-governance--sign-vs-wall-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "byp",
          "rb"
        ]
      },
      {
        "id": "governed-path",
        "label": "治理主路径",
        "file": "engine-governance--governed-path.mp4",
        "endStill": "engine-governance--governed-path-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.54,
        "beatNodes": [
          "cal",
          "flt",
          "def",
          "rb",
          "out"
        ]
      },
      {
        "id": "two-layer-defense",
        "label": "双层防线剖面",
        "file": "engine-governance--two-layer-defense.mp4",
        "endStill": "engine-governance--two-layer-defense-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "cal",
          "flt",
          "rb",
          "out"
        ]
      },
      {
        "id": "bypass-intercepted",
        "label": "绕行仍被拦截",
        "file": "engine-governance--bypass-intercepted.mp4",
        "endStill": "engine-governance--bypass-intercepted-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "cal",
          "byp",
          "ax"
        ]
      }
    ]
  },
  "event-fanout": {
    "slug": "event-fanout",
    "type": "dataflow",
    "chapters": [
      {
        "id": "hundred-three",
        "label": "一百块三次事件",
        "file": "event-fanout--hundred-three.mp4",
        "endStill": "event-fanout--hundred-three-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "order100",
          "evt-1",
          "evt-2",
          "evt-3"
        ]
      },
      {
        "id": "join-disaster",
        "label": "直接关联的灾难",
        "file": "event-fanout--join-disaster.mp4",
        "endStill": "event-fanout--join-disaster-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "naive-join",
          "dup-rows",
          "sum-300"
        ]
      }
    ]
  },
  "evidence-grading": {
    "slug": "evidence-grading",
    "type": "workflow",
    "chapters": [
      {
        "id": "vendor-claim",
        "label": "厂商自报无复测",
        "file": "evidence-grading--vendor-claim.mp4",
        "endStill": "evidence-grading--vendor-claim-end.png",
        "beats": 4,
        "leadSec": 0.16,
        "storySec": 4.47,
        "beatNodes": [
          "benchSource",
          "gradeCard",
          "vendorClaim",
          "retestGap"
        ]
      },
      {
        "id": "not-industry-norm",
        "label": "自报≠行业常态",
        "file": "evidence-grading--not-industry-norm.mp4",
        "endStill": "evidence-grading--not-industry-norm-end.png",
        "beats": 4,
        "leadSec": 0.16,
        "storySec": 4.43,
        "beatNodes": [
          "vendorClaim",
          "retestGap",
          "dualBaseline",
          "verdictNorm"
        ]
      }
    ]
  },
  "evolution-timeline": {
    "slug": "evolution-timeline",
    "type": "dataflow",
    "chapters": [
      {
        "id": "stage-objects",
        "label": "阶段一 · 对象化",
        "file": "evolution-timeline--stage-objects.mp4",
        "endStill": "evolution-timeline--stage-objects-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "ms1",
          "ms2"
        ]
      },
      {
        "id": "stage-governed-enrich",
        "label": "阶段二 · 通道与富化",
        "file": "evolution-timeline--stage-governed-enrich.mp4",
        "endStill": "evolution-timeline--stage-governed-enrich-end.png",
        "beats": 10,
        "leadSec": 0.44,
        "storySec": 11.06,
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
        "file": "evolution-timeline--stage-ecosystem.mp4",
        "endStill": "evolution-timeline--stage-ecosystem-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "ms12",
          "ms13",
          "ms14"
        ]
      }
    ]
  },
  "fan-trap": {
    "slug": "fan-trap",
    "type": "workflow",
    "chapters": [
      {
        "id": "copy-inflate",
        "label": "复印放大 100→300",
        "file": "fan-trap--copy-inflate.mp4",
        "endStill": "fan-trap--copy-inflate-end.png",
        "beats": 3,
        "leadSec": 0.12,
        "storySec": 3.35,
        "beatNodes": [
          "order100",
          "rawJoin",
          "inflated300"
        ]
      },
      {
        "id": "aggregate-first",
        "label": "先聚后联铁律",
        "file": "fan-trap--aggregate-first.mp4",
        "endStill": "fan-trap--aggregate-first-end.png",
        "beats": 3,
        "leadSec": 0.16,
        "storySec": 3.34,
        "beatNodes": [
          "order100",
          "aggFirst",
          "safeJoin"
        ]
      },
      {
        "id": "measured-440",
        "label": "实测 200 vs 440",
        "file": "fan-trap--measured-440.mp4",
        "endStill": "fan-trap--measured-440-end.png",
        "beats": 2,
        "leadSec": 0.16,
        "storySec": 3.24,
        "beatNodes": [
          "inflated300",
          "measured"
        ]
      }
    ]
  },
  "forced-query-intercept": {
    "slug": "forced-query-intercept",
    "type": "sequence",
    "chapters": [
      {
        "id": "guessed-name",
        "label": "猜出指标名",
        "file": "forced-query-intercept--guessed-name.mp4",
        "endStill": "forced-query-intercept--guessed-name-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "retrieval",
          "intern",
          "exec"
        ]
      },
      {
        "id": "impenetrable",
        "label": "不可穿透底线",
        "file": "forced-query-intercept--impenetrable.mp4",
        "endStill": "forced-query-intercept--impenetrable-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.42,
        "beatNodes": [
          "exec",
          "semantic",
          "policy",
          "intern"
        ]
      },
      {
        "id": "intercepted",
        "label": "调取即拦截",
        "file": "forced-query-intercept--intercepted.mp4",
        "endStill": "forced-query-intercept--intercepted-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "intern",
          "exec",
          "policy"
        ]
      }
    ]
  },
  "formula-vs-total": {
    "slug": "formula-vs-total",
    "type": "architecture",
    "chapters": [
      {
        "id": "declare-execute-split",
        "label": "声明半边×执行半边",
        "file": "formula-vs-total--declare-execute-split.mp4",
        "endStill": "formula-vs-total--declare-execute-split-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "manual",
          "fiveDecl",
          "calc",
          "moneyDouble"
        ]
      }
    ]
  },
  "four-factor-ranking": {
    "slug": "four-factor-ranking",
    "type": "dataflow",
    "chapters": [
      {
        "id": "signals",
        "label": "四路信号来源",
        "file": "four-factor-ranking--signals.mp4",
        "endStill": "four-factor-ranking--signals-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.55,
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
        "file": "four-factor-ranking--factors.mp4",
        "endStill": "four-factor-ranking--factors-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.47,
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
        "file": "four-factor-ranking--topk.mp4",
        "endStill": "four-factor-ranking--topk-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "score",
          "tie",
          "topk"
        ]
      }
    ]
  },
  "ghost-edge-pollution": {
    "slug": "ghost-edge-pollution",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "fake-event",
        "label": "故意推虚构流水",
        "file": "ghost-edge-pollution--fake-event.mp4",
        "endStill": "ghost-edge-pollution--fake-event-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.38,
        "beatNodes": [
          "ghost-push",
          "ingest-endpoint",
          "resolve-gate"
        ]
      },
      {
        "id": "rejected",
        "label": "当场拒收",
        "file": "ghost-edge-pollution--rejected.mp4",
        "endStill": "ghost-edge-pollution--rejected-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "resolve-gate",
          "gate-reject",
          "ledger-clean"
        ]
      },
      {
        "id": "gate-removed",
        "label": "拆掉解析闸",
        "file": "ghost-edge-pollution--gate-removed.mp4",
        "endStill": "ghost-edge-pollution--gate-removed-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "resolve-gate",
          "gate-stripped",
          "ghost-in-ledger"
        ]
      },
      {
        "id": "ledger-detached",
        "label": "对账成空话",
        "file": "ghost-edge-pollution--ledger-detached.mp4",
        "endStill": "ghost-edge-pollution--ledger-detached-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "ghost-in-ledger",
          "detached",
          "audit-hollow"
        ]
      }
    ]
  },
  "govern-vs-verify": {
    "slug": "govern-vs-verify",
    "type": "architecture",
    "chapters": [
      {
        "id": "fourth-boundary",
        "label": "第四条最重要",
        "file": "govern-vs-verify--fourth-boundary.mp4",
        "endStill": "govern-vs-verify--fourth-boundary-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
        "beatNodes": [
          "nonAdditiveBy",
          "lineageLog",
          "govStamp",
          "wrongResult"
        ]
      },
      {
        "id": "third-party-critique",
        "label": "第三方批判",
        "file": "govern-vs-verify--third-party-critique.mp4",
        "endStill": "govern-vs-verify--third-party-critique-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.31,
        "beatNodes": [
          "thirdPartyCritique",
          "agentCalc",
          "wrongResult"
        ]
      },
      {
        "id": "upstream-collapse",
        "label": "上游提前汇总塌陷",
        "file": "govern-vs-verify--upstream-collapse.mp4",
        "endStill": "govern-vs-verify--upstream-collapse-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "rawDetail",
          "upstreamRollup",
          "semanticView"
        ]
      }
    ]
  },
  "governance-demolition": {
    "slug": "governance-demolition",
    "type": "workflow",
    "chapters": [
      {
        "id": "remove-mask",
        "label": "坏法① 拆验放规则",
        "file": "governance-demolition--remove-mask.mp4",
        "endStill": "governance-demolition--remove-mask-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "removeMask",
          "plainLeak"
        ]
      },
      {
        "id": "wrong-placement",
        "label": "坏法② 闸机装错位",
        "file": "governance-demolition--wrong-placement.mp4",
        "endStill": "governance-demolition--wrong-placement-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "wrongGate",
          "silentLeak"
        ]
      },
      {
        "id": "rbac-ablation",
        "label": "坏法③ D5 泄露对照",
        "file": "governance-demolition--rbac-ablation.mp4",
        "endStill": "governance-demolition--rbac-ablation-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
        "beatNodes": [
          "internProbe",
          "accessDenied",
          "sensitiveLeak",
          "verdict"
        ]
      }
    ]
  },
  "grain-collapse": {
    "slug": "grain-collapse",
    "type": "workflow",
    "chapters": [
      {
        "id": "day-pack-collapse",
        "label": "按天打包 · grain 塌缩",
        "file": "grain-collapse--day-pack-collapse.mp4",
        "endStill": "grain-collapse--day-pack-collapse-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "rawGrain",
          "dayPack",
          "grainCollapse"
        ]
      },
      {
        "id": "legal-but-wrong",
        "label": "图纸合法 · 总数仍错",
        "file": "grain-collapse--legal-but-wrong.mp4",
        "endStill": "grain-collapse--legal-but-wrong-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "pillarLights",
          "blueprintLegal",
          "wrongTotal"
        ]
      },
      {
        "id": "measured-477-48",
        "label": "477 vs 48 对撞",
        "file": "grain-collapse--measured-477-48.mp4",
        "endStill": "grain-collapse--measured-477-48-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "wrongTotal",
          "crash477",
          "verdictGovernVerify"
        ]
      }
    ]
  },
  "hearing-showdown": {
    "slug": "hearing-showdown",
    "type": "workflow",
    "chapters": [
      {
        "id": "open-hearing",
        "label": "必须开听证会",
        "file": "hearing-showdown--open-hearing.mp4",
        "endStill": "hearing-showdown--open-hearing-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "cardGoverned",
          "cardInferred",
          "conflictCard",
          "hearingSeat"
        ]
      }
    ]
  },
  "hidden-vs-blocked": {
    "slug": "hidden-vs-blocked",
    "type": "workflow",
    "chapters": [
      {
        "id": "teardown-leak",
        "label": "拆除即泄露",
        "file": "hidden-vs-blocked--teardown-leak.mp4",
        "endStill": "hidden-vs-blocked--teardown-leak-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "internQuery",
          "teardownFlag",
          "leakOutcome"
        ]
      },
      {
        "id": "hide-not-block",
        "label": "藏≠拦",
        "file": "hidden-vs-blocked--hide-not-block.mp4",
        "endStill": "hidden-vs-blocked--hide-not-block-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.42,
        "beatNodes": [
          "hideSeal",
          "directBypass",
          "blockSeal",
          "blockedOutcome"
        ]
      }
    ]
  },
  "injection-threat": {
    "slug": "injection-threat",
    "type": "workflow",
    "chapters": [
      {
        "id": "badge-question",
        "label": "工牌怎么发",
        "file": "injection-threat--badge-question.mp4",
        "endStill": "injection-threat--badge-question-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "bizAgent",
          "keyDesk"
        ]
      },
      {
        "id": "master-key",
        "label": "注入即失守",
        "file": "injection-threat--master-key.mp4",
        "endStill": "injection-threat--master-key-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "masterKey",
          "inject",
          "sevenLocks",
          "collapse"
        ]
      }
    ]
  },
  "last-snapshot-gate": {
    "slug": "last-snapshot-gate",
    "type": "workflow",
    "chapters": [
      {
        "id": "semi-additive",
        "label": "半可加：跨账户 vs 跨时间",
        "file": "last-snapshot-gate--semi-additive.mp4",
        "endStill": "last-snapshot-gate--semi-additive-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "weekGrid",
          "semiNote"
        ]
      },
      {
        "id": "snapshot-vs-sum",
        "label": "末快照 7 vs 求和 24",
        "file": "last-snapshot-gate--snapshot-vs-sum.mp4",
        "endStill": "last-snapshot-gate--snapshot-vs-sum-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "daySum",
          "inflated24",
          "lastSnap",
          "exact7"
        ]
      }
    ]
  },
  "lineage-ledger": {
    "slug": "lineage-ledger",
    "type": "dataflow",
    "chapters": [
      {
        "id": "engine-lane",
        "label": "引擎执行",
        "file": "lineage-ledger--engine-lane.mp4",
        "endStill": "lineage-ledger--engine-lane-end.png",
        "beats": 3,
        "leadSec": 0.16,
        "storySec": 3.32,
        "beatNodes": [
          "sql",
          "edg",
          "ledger"
        ]
      },
      {
        "id": "ingest-lane",
        "label": "外部摄取",
        "file": "lineage-ledger--ingest-lane.mp4",
        "endStill": "lineage-ledger--ingest-lane-end.png",
        "beats": 4,
        "leadSec": 0.12,
        "storySec": 4.46,
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
        "file": "lineage-ledger--ledger-and-blind.mp4",
        "endStill": "lineage-ledger--ledger-and-blind-end.png",
        "beats": 3,
        "leadSec": 0.16,
        "storySec": 3.33,
        "beatNodes": [
          "ledger",
          "q",
          "blind"
        ]
      }
    ]
  },
  "majority-shortcut": {
    "slug": "majority-shortcut",
    "type": "workflow",
    "chapters": [
      {
        "id": "popularity-wins",
        "label": "热度裁决错误多数胜出",
        "file": "majority-shortcut--popularity-wins.mp4",
        "endStill": "majority-shortcut--popularity-wins-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "inferredDef",
          "autoPick",
          "wrongWins",
          "rightAnswer"
        ]
      },
      {
        "id": "habit-not-truth",
        "label": "习惯不等于真理",
        "file": "majority-shortcut--habit-not-truth.mp4",
        "endStill": "majority-shortcut--habit-not-truth-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "autoPick",
          "wrongWins",
          "warningNote"
        ]
      }
    ]
  },
  "mean-of-means": {
    "slug": "mean-of-means",
    "type": "workflow",
    "chapters": [
      {
        "id": "wrong-avg-of-avg",
        "label": "班级平均分类比",
        "file": "mean-of-means--wrong-avg-of-avg.mp4",
        "endStill": "mean-of-means--wrong-avg-of-avg-end.png",
        "beats": 3,
        "leadSec": 0.16,
        "storySec": 3.34,
        "beatNodes": [
          "divideFirst",
          "avgOfAvg",
          "classAnalogy"
        ]
      },
      {
        "id": "measured-122-108",
        "label": "实测 122 vs 108",
        "file": "mean-of-means--measured-122-108.mp4",
        "endStill": "mean-of-means--measured-122-108-end.png",
        "beats": 4,
        "leadSec": 0.16,
        "storySec": 4.46,
        "beatNodes": [
          "avgOfAvg",
          "wrong122",
          "divideOnce",
          "right108"
        ]
      }
    ]
  },
  "mechanism-experiment-matrix": {
    "slug": "mechanism-experiment-matrix",
    "type": "dataflow",
    "chapters": [
      {
        "id": "three-lesions",
        "label": "三病灶爆发",
        "file": "mechanism-experiment-matrix--three-lesions.mp4",
        "endStill": "mechanism-experiment-matrix--three-lesions-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "naive-guess",
          "lesion-caliber",
          "lesion-drift",
          "lesion-pierce"
        ]
      },
      {
        "id": "ten-teardowns",
        "label": "十次拆坏预告",
        "file": "mechanism-experiment-matrix--ten-teardowns.mp4",
        "endStill": "mechanism-experiment-matrix--ten-teardowns-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "lab-code",
          "mech-rows",
          "exp-cols",
          "verdict"
        ]
      }
    ]
  },
  "multi-entry-single-truth": {
    "slug": "multi-entry-single-truth",
    "type": "architecture",
    "chapters": [
      {
        "id": "single-point-bind",
        "label": "单点×重算绑定",
        "file": "multi-entry-single-truth--single-point-bind.mp4",
        "endStill": "multi-entry-single-truth--single-point-bind-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "salesLead",
          "finAnalyst",
          "agentIntern",
          "manual"
        ]
      },
      {
        "id": "whoever-asks",
        "label": "谁来问都唯一",
        "file": "multi-entry-single-truth--whoever-asks.mp4",
        "endStill": "multi-entry-single-truth--whoever-asks-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "manual",
          "recompute",
          "singleAnswer"
        ]
      }
    ]
  },
  "next-episode-blueprint": {
    "slug": "next-episode-blueprint",
    "type": "architecture",
    "chapters": [
      {
        "id": "self-build",
        "label": "撇开云厂商自建",
        "file": "next-episode-blueprint--self-build.mp4",
        "endStill": "next-episode-blueprint--self-build-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "consumers",
          "explicit",
          "store"
        ]
      },
      {
        "id": "blueprint-blocks",
        "label": "五块通用积木",
        "file": "next-episode-blueprint--blueprint-blocks.mp4",
        "endStill": "next-episode-blueprint--blueprint-blocks-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "gate",
          "rank",
          "eval",
          "mcp"
        ]
      }
    ]
  },
  "on-demand-recompute": {
    "slug": "on-demand-recompute",
    "type": "sequence",
    "chapters": [
      {
        "id": "frozen-widetable",
        "label": "宽表死数字",
        "file": "on-demand-recompute--frozen-widetable.mp4",
        "endStill": "on-demand-recompute--frozen-widetable-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "ledger",
          "widetable",
          "asker"
        ]
      },
      {
        "id": "formula-only",
        "label": "只存算式",
        "file": "on-demand-recompute--formula-only.mp4",
        "endStill": "on-demand-recompute--formula-only-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "widetable",
          "asker",
          "manual"
        ]
      },
      {
        "id": "grain-recompute",
        "label": "按粒度翻凭证",
        "file": "on-demand-recompute--grain-recompute.mp4",
        "endStill": "on-demand-recompute--grain-recompute-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "asker",
          "manual",
          "ledger"
        ]
      }
    ]
  },
  "one-checkpoint": {
    "slug": "one-checkpoint",
    "type": "architecture",
    "chapters": [
      {
        "id": "sign-vs-wall",
        "label": "木牌vs承重墙",
        "file": "one-checkpoint--sign-vs-wall.mp4",
        "endStill": "one-checkpoint--sign-vs-wall-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "woodSign",
          "sideDoor",
          "engineGate"
        ]
      },
      {
        "id": "shared-checkpoint",
        "label": "共用执法点",
        "file": "one-checkpoint--shared-checkpoint.mp4",
        "endStill": "one-checkpoint--shared-checkpoint-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "humanReport",
          "appQuery",
          "aiReasoning",
          "engineGate"
        ]
      }
    ]
  },
  "open-interop": {
    "slug": "open-interop",
    "type": "architecture",
    "chapters": [
      {
        "id": "portable",
        "label": "定义可携带",
        "file": "open-interop--portable.mp4",
        "endStill": "open-interop--portable-end.png",
        "beats": 4,
        "leadSec": 0.44,
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
        "file": "open-interop--socket.mp4",
        "endStill": "open-interop--socket-end.png",
        "beats": 4,
        "leadSec": 0.44,
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
        "file": "open-interop--feedback.mp4",
        "endStill": "open-interop--feedback-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "fb",
          "sv",
          "ada"
        ]
      }
    ]
  },
  "perimeter-loss": {
    "slug": "perimeter-loss",
    "type": "workflow",
    "chapters": [
      {
        "id": "inside-effective",
        "label": "楼内治理全亮",
        "file": "perimeter-loss--inside-effective.mp4",
        "endStill": "perimeter-loss--inside-effective-end.png",
        "beats": 5,
        "leadSec": 0.16,
        "storySec": 5.55,
        "beatNodes": [
          "insideQuery",
          "gateCheck",
          "tagBinding",
          "ledgerTrace",
          "insideEffective"
        ]
      },
      {
        "id": "outside-void",
        "label": "出楼即失效",
        "file": "perimeter-loss--outside-void.mp4",
        "endStill": "perimeter-loss--outside-void-end.png",
        "beats": 4,
        "leadSec": 0.16,
        "storySec": 4.46,
        "beatNodes": [
          "insideEffective",
          "externalModel",
          "voidKit",
          "perimeterLoss"
        ]
      }
    ]
  },
  "preview-gap": {
    "slug": "preview-gap",
    "type": "workflow",
    "chapters": [
      {
        "id": "preview-band",
        "label": "预览带：先进组件聚集",
        "file": "preview-gap--preview-band.mp4",
        "endStill": "preview-gap--preview-band-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "advancedComponents",
          "gaStage",
          "wideAdoption"
        ]
      }
    ]
  },
  "problem-to-mechanisms": {
    "slug": "problem-to-mechanisms",
    "type": "dataflow",
    "chapters": [
      {
        "id": "cause-chain",
        "label": "病因链",
        "file": "problem-to-mechanisms--cause-chain.mp4",
        "endStill": "problem-to-mechanisms--cause-chain-end.png",
        "beats": 4,
        "leadSec": 0.44,
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
        "file": "problem-to-mechanisms--encircle-pierce.mp4",
        "endStill": "problem-to-mechanisms--encircle-pierce-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
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
        "file": "problem-to-mechanisms--engine-cast.mp4",
        "endStill": "problem-to-mechanisms--engine-cast-end.png",
        "beats": 4,
        "leadSec": 0.44,
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
        "file": "problem-to-mechanisms--answer-ledger.mp4",
        "endStill": "problem-to-mechanisms--answer-ledger-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.37,
        "beatNodes": [
          "m4",
          "m5",
          "m7"
        ]
      },
      {
        "id": "downgraded-lane",
        "label": "降级专章",
        "file": "problem-to-mechanisms--downgraded-lane.mp4",
        "endStill": "problem-to-mechanisms--downgraded-lane-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "f10",
          "f11",
          "f12"
        ]
      }
    ]
  },
  "query-time-policy": {
    "slug": "query-time-policy",
    "type": "sequence",
    "chapters": [
      {
        "id": "instant-inspection",
        "label": "查询瞬间审查",
        "file": "query-time-policy--instant-inspection.mp4",
        "endStill": "query-time-policy--instant-inspection-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "asker",
          "gate",
          "policy"
        ]
      },
      {
        "id": "agent-recognized",
        "label": "认得出代理",
        "file": "query-time-policy--agent-recognized.mp4",
        "endStill": "query-time-policy--agent-recognized-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "agent",
          "gate",
          "policy"
        ]
      }
    ]
  },
  "rented-brilliance": {
    "slug": "rented-brilliance",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "rented-to-owned",
        "label": "租用→自有",
        "file": "rented-brilliance--rented-to-owned.mp4",
        "endStill": "rented-brilliance--rented-to-owned-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "haloRented",
          "powerLine",
          "governanceCastIn",
          "ownedBrilliance"
        ]
      }
    ]
  },
  "resolve-activation": {
    "slug": "resolve-activation",
    "type": "sequence",
    "chapters": [
      {
        "id": "hit-reconcile",
        "label": "命中与对账",
        "file": "resolve-activation--hit-reconcile.mp4",
        "endStill": "resolve-activation--hit-reconcile-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.39,
        "beatNodes": [
          "ag",
          "vq",
          "en"
        ]
      },
      {
        "id": "miss-fallback",
        "label": "未命中回退",
        "file": "resolve-activation--miss-fallback.mp4",
        "endStill": "resolve-activation--miss-fallback-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "ag",
          "vq"
        ]
      },
      {
        "id": "outside-eval",
        "label": "墙外评测闭环",
        "file": "resolve-activation--outside-eval.mp4",
        "endStill": "resolve-activation--outside-eval-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "ev"
        ]
      }
    ]
  },
  "revocation-timeline": {
    "slug": "revocation-timeline",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "realtime-ceiling",
        "label": "天花板实时求值",
        "file": "revocation-timeline--realtime-ceiling.mp4",
        "endStill": "revocation-timeline--realtime-ceiling-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "badge-live",
          "realtime-eval",
          "instant-loss",
          "no-stale-window"
        ]
      },
      {
        "id": "static-snapshot",
        "label": "启动拍静态快照",
        "file": "revocation-timeline--static-snapshot.mp4",
        "endStill": "revocation-timeline--static-snapshot-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "badge-live",
          "snap-frozen",
          "copy-static"
        ]
      },
      {
        "id": "ten-minutes",
        "label": "十分钟后回收",
        "file": "revocation-timeline--ten-minutes.mp4",
        "endStill": "revocation-timeline--ten-minutes-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "admin-revoke",
          "copy-static",
          "stale-holds"
        ]
      }
    ]
  },
  "row-column-policy": {
    "slug": "row-column-policy",
    "type": "workflow",
    "chapters": [
      {
        "id": "perpage",
        "label": "逐页验放",
        "file": "row-column-policy--perpage.mp4",
        "endStill": "row-column-policy--perpage-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
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
        "file": "row-column-policy--family.mp4",
        "endStill": "row-column-policy--family-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "po",
          "agp",
          "out"
        ]
      },
      {
        "id": "agentface",
        "label": "代理叠加更严拒绝面",
        "file": "row-column-policy--agentface.mp4",
        "endStill": "row-column-policy--agentface-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "aid",
          "po",
          "cls"
        ]
      }
    ]
  },
  "seal-off-caliber": {
    "slug": "seal-off-caliber",
    "type": "workflow",
    "chapters": [
      {
        "id": "sealed-off",
        "label": "两病灶按死",
        "file": "seal-off-caliber--sealed-off.mp4",
        "endStill": "seal-off-caliber--sealed-off-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "caliberClash",
          "definitionDrift",
          "semanticView",
          "sealedOff"
        ]
      }
    ]
  },
  "sticky-notes-to-manual": {
    "slug": "sticky-notes-to-manual",
    "type": "workflow",
    "chapters": [
      {
        "id": "first-mechanism",
        "label": "第一大机制",
        "file": "sticky-notes-to-manual--first-mechanism.mp4",
        "endStill": "sticky-notes-to-manual--first-mechanism-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "manual",
          "singleVoice",
          "liveCompute",
          "defineAsCompute"
        ]
      },
      {
        "id": "scattered-notes",
        "label": "口径散落便利贴",
        "file": "sticky-notes-to-manual--scattered-notes.mp4",
        "endStill": "sticky-notes-to-manual--scattered-notes-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "noteSticky",
          "noteDraft",
          "gather"
        ]
      }
    ]
  },
  "supply-overwhelm": {
    "slug": "supply-overwhelm",
    "type": "workflow",
    "chapters": [
      {
        "id": "flood-vs-manual",
        "label": "涌入压垮人工登记",
        "file": "supply-overwhelm--flood-vs-manual.mp4",
        "endStill": "supply-overwhelm--flood-vs-manual-end.png",
        "beats": 6,
        "leadSec": 0.16,
        "storySec": 6.64,
        "beatNodes": [
          "badgeDone",
          "dataFlood",
          "manualStamp",
          "governedSlow",
          "ungovernedGap",
          "overwhelm"
        ]
      }
    ]
  },
  "tag-gate-linkage": {
    "slug": "tag-gate-linkage",
    "type": "dataflow",
    "chapters": [
      {
        "id": "intake-test",
        "label": "进楼考验",
        "file": "tag-gate-linkage--intake-test.mp4",
        "endStill": "tag-gate-linkage--intake-test-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "newBatch",
          "manualCount",
          "unmapped"
        ]
      },
      {
        "id": "seventh-mechanism",
        "label": "第七大机制",
        "file": "tag-gate-linkage--seventh-mechanism.mp4",
        "endStill": "tag-gate-linkage--seventh-mechanism-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "newBatch",
          "classifier",
          "sysTag"
        ]
      },
      {
        "id": "auto-linkage",
        "label": "免重复配置",
        "file": "tag-gate-linkage--auto-linkage.mp4",
        "endStill": "tag-gate-linkage--auto-linkage-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "sysTag",
          "userTag",
          "policy",
          "gate"
        ]
      }
    ]
  },
  "three-claims-stack": {
    "slug": "three-claims-stack",
    "type": "architecture",
    "chapters": [
      {
        "id": "guess-only",
        "label": "没有上下文只能瞎猜",
        "file": "three-claims-stack--guess-only.mp4",
        "endStill": "three-claims-stack--guess-only-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "threeClaims",
          "noCtx",
          "agentGuess"
        ]
      },
      {
        "id": "native-act",
        "label": "原生植入才能行动",
        "file": "three-claims-stack--native-act.mp4",
        "endStill": "three-claims-stack--native-act-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "agentGuess",
          "nativeCtx",
          "agentAct"
        ]
      },
      {
        "id": "governed-trust",
        "label": "严格治理才值得信任",
        "file": "three-claims-stack--governed-trust.mp4",
        "endStill": "three-claims-stack--governed-trust-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "agentAct",
          "governedCtx",
          "agentTrusted"
        ]
      }
    ]
  },
  "trust-assets": {
    "slug": "trust-assets",
    "type": "workflow",
    "chapters": [
      {
        "id": "two-pillars",
        "label": "两柱承重",
        "file": "trust-assets--two-pillars.mp4",
        "endStill": "trust-assets--two-pillars-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.55,
        "beatNodes": [
          "verifyAnchor",
          "verifyCheck",
          "lineageGate",
          "lineageLedger",
          "decisionFlow"
        ]
      },
      {
        "id": "three-seals",
        "label": "柱基三印鉴",
        "file": "trust-assets--three-seals.mp4",
        "endStill": "trust-assets--three-seals-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.54,
        "beatNodes": [
          "sealWrong",
          "sealRight",
          "sealLedger",
          "decisionFlow",
          "auditableAsset"
        ]
      }
    ]
  },
  "trust-timeline": {
    "slug": "trust-timeline",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "before-during",
        "label": "事前事中答对",
        "file": "trust-timeline--before-during.mp4",
        "endStill": "trust-timeline--before-during-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "question-in",
          "vqr-check",
          "verified-answer",
          "adhoc-answer"
        ]
      },
      {
        "id": "after-audit",
        "label": "事后审计闭环",
        "file": "trust-timeline--after-audit.mp4",
        "endStill": "trust-timeline--after-audit-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "lineage-ledger",
          "ol-ingest",
          "audit-close"
        ]
      }
    ]
  },
  "upstream-traceback": {
    "slug": "upstream-traceback",
    "type": "dataflow",
    "chapters": [
      {
        "id": "living-ledger",
        "label": "台账活的可信",
        "file": "upstream-traceback--living-ledger.mp4",
        "endStill": "upstream-traceback--living-ledger-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "ol-evt",
          "ingest-gate",
          "rejected",
          "ledger"
        ]
      },
      {
        "id": "three-seconds",
        "label": "三秒定位源头",
        "file": "upstream-traceback--three-seconds.mp4",
        "endStill": "upstream-traceback--three-seconds-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "question",
          "get-lineage",
          "ledger",
          "src-col"
        ]
      }
    ]
  },
  "valid-sql-wrong-answer": {
    "slug": "valid-sql-wrong-answer",
    "type": "workflow",
    "chapters": [
      {
        "id": "syntax-pass",
        "label": "语法检查通过",
        "file": "valid-sql-wrong-answer--syntax-pass.mp4",
        "endStill": "valid-sql-wrong-answer--syntax-pass-end.png",
        "beats": 3,
        "leadSec": 0.16,
        "storySec": 3.35,
        "beatNodes": [
          "queryCard",
          "syntaxPass",
          "disciplineGuard"
        ]
      },
      {
        "id": "business-fail",
        "label": "业务语义错误",
        "file": "valid-sql-wrong-answer--business-fail.mp4",
        "endStill": "valid-sql-wrong-answer--business-fail-end.png",
        "beats": 2,
        "leadSec": 0.16,
        "storySec": 3.25,
        "beatNodes": [
          "bizFail",
          "verdict"
        ]
      }
    ]
  },
  "venn-intersection": {
    "slug": "venn-intersection",
    "type": "architecture",
    "chapters": [
      {
        "id": "two-iron-rules",
        "label": "两大核心铁律",
        "file": "venn-intersection--two-iron-rules.mp4",
        "endStill": "venn-intersection--two-iron-rules-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "badge",
          "intersect",
          "swipe",
          "audit"
        ]
      }
    ]
  },
  "vqr-lifecycle": {
    "slug": "vqr-lifecycle",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "signed-stamped",
        "label": "签字盖章",
        "file": "vqr-lifecycle--signed-stamped.mp4",
        "endStill": "vqr-lifecycle--signed-stamped-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "draft",
          "stamped",
          "asset"
        ]
      }
    ]
  },
  "water-pipe-ledger": {
    "slug": "water-pipe-ledger",
    "type": "dataflow",
    "chapters": [
      {
        "id": "fifth-mechanism",
        "label": "第五大机制",
        "file": "water-pipe-ledger--fifth-mechanism.mp4",
        "endStill": "water-pipe-ledger--fifth-mechanism-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "m5-badge",
          "ledger",
          "engine-pipe",
          "ext-pipe"
        ]
      },
      {
        "id": "drop-to-drop",
        "label": "每滴水从哪到哪",
        "file": "water-pipe-ledger--drop-to-drop.mp4",
        "endStill": "water-pipe-ledger--drop-to-drop-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "orders-pool",
          "engine-pipe",
          "sales-tap"
        ]
      },
      {
        "id": "not-wastepaper",
        "label": "不是废纸都收",
        "file": "water-pipe-ledger--not-wastepaper.mp4",
        "endStill": "water-pipe-ledger--not-wastepaper-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "ext-pipe",
          "resolve-gate",
          "rejected",
          "ledger"
        ]
      }
    ]
  },
  "wrong-page-failure": {
    "slug": "wrong-page-failure",
    "type": "workflow",
    "chapters": [
      {
        "id": "right-book-wrong-page",
        "label": "手册对 · 引用错",
        "file": "wrong-page-failure--right-book-wrong-page.mp4",
        "endStill": "wrong-page-failure--right-book-wrong-page-end.png",
        "beats": 3,
        "leadSec": 0.16,
        "storySec": 3.34,
        "beatNodes": [
          "manualBook",
          "modelFlip",
          "wrongPage"
        ]
      },
      {
        "id": "two-branches",
        "label": "两条失效分支",
        "file": "wrong-page-failure--two-branches.mp4",
        "endStill": "wrong-page-failure--two-branches-end.png",
        "beats": 4,
        "leadSec": 0.12,
        "storySec": 4.42,
        "beatNodes": [
          "wrongPage",
          "wrongJoin",
          "wrongIntent",
          "redAnswer"
        ]
      }
    ]
  },
  "zero-window-sequence": {
    "slug": "zero-window-sequence",
    "type": "sequence",
    "chapters": [
      {
        "id": "experiment-risk",
        "label": "实验展示风险",
        "file": "zero-window-sequence--experiment-risk.mp4",
        "endStill": "zero-window-sequence--experiment-risk-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "experimenter",
          "snap",
          "orders"
        ]
      },
      {
        "id": "dynamic-intersect",
        "label": "动态交集求值",
        "file": "zero-window-sequence--dynamic-intersect.mp4",
        "endStill": "zero-window-sequence--dynamic-intersect-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "live",
          "mentor",
          "orders"
        ]
      },
      {
        "id": "zero-window",
        "label": "零越权窗口",
        "file": "zero-window-sequence--zero-window.mp4",
        "endStill": "zero-window-sequence--zero-window-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "mentor",
          "snap",
          "live"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
