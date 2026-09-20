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
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
