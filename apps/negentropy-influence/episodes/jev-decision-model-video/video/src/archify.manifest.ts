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
  "calibration-territory": {
    "slug": "calibration-territory",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "ct-in",
        "label": "领地内",
        "file": "calibration-territory--ct-in.mp4",
        "endStill": "calibration-territory--ct-in-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "in-dist"
        ]
      },
      {
        "id": "ct-drift",
        "label": "静默漂移",
        "file": "calibration-territory--ct-drift.mp4",
        "endStill": "calibration-territory--ct-drift-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "drift"
        ]
      },
      {
        "id": "ct-cliff",
        "label": "台阶出现",
        "file": "calibration-territory--ct-cliff.mp4",
        "endStill": "calibration-territory--ct-cliff-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "cliff"
        ]
      },
      {
        "id": "ct-fix",
        "label": "对冲与重标",
        "file": "calibration-territory--ct-fix.mp4",
        "endStill": "calibration-territory--ct-fix-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "audit"
        ]
      },
      {
        "id": "ct-wild",
        "label": "无基准地带",
        "file": "calibration-territory--ct-wild.mp4",
        "endStill": "calibration-territory--ct-wild-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "dice"
        ]
      }
    ]
  },
  "evidence-reconciliation": {
    "slug": "evidence-reconciliation",
    "type": "architecture",
    "chapters": [
      {
        "id": "er-parties",
        "label": "四方证据",
        "file": "evidence-reconciliation--er-parties.mp4",
        "endStill": "evidence-reconciliation--er-parties-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
        "beatNodes": [
          "self-report",
          "field-audit",
          "defect-list",
          "homegrown"
        ]
      },
      {
        "id": "er-desk",
        "label": "对账台",
        "file": "evidence-reconciliation--er-desk.mp4",
        "endStill": "evidence-reconciliation--er-desk-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "desk"
        ]
      },
      {
        "id": "er-verdicts",
        "label": "三句裁决",
        "file": "evidence-reconciliation--er-verdicts.mp4",
        "endStill": "evidence-reconciliation--er-verdicts-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "claim-speed",
          "claim-hallu",
          "claim-calib"
        ]
      },
      {
        "id": "er-open",
        "label": "开放三问",
        "file": "evidence-reconciliation--er-open.mp4",
        "endStill": "evidence-reconciliation--er-open-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "homegrown",
          "claim-calib"
        ]
      }
    ]
  },
  "forecast-form-rows": {
    "slug": "forecast-form-rows",
    "type": "architecture",
    "chapters": [
      {
        "id": "ff-rows",
        "label": "三类行",
        "file": "forecast-form-rows--ff-rows.mp4",
        "endStill": "forecast-form-rows--ff-rows-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "row-choice",
          "row-score",
          "row-noul"
        ]
      },
      {
        "id": "ff-choice",
        "label": "单选行",
        "file": "forecast-form-rows--ff-choice.mp4",
        "endStill": "forecast-form-rows--ff-choice-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "caller",
          "validator",
          "row-choice"
        ]
      },
      {
        "id": "ff-closure",
        "label": "闭合保证",
        "file": "forecast-form-rows--ff-closure.mp4",
        "endStill": "forecast-form-rows--ff-closure-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.42,
        "beatNodes": [
          "row-choice",
          "row-score",
          "row-noul",
          "consumer"
        ]
      },
      {
        "id": "ff-trap",
        "label": "填错的格",
        "file": "forecast-form-rows--ff-trap.mp4",
        "endStill": "forecast-form-rows--ff-trap-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "row-choice",
          "consumer"
        ]
      }
    ]
  },
  "lesions-to-specs": {
    "slug": "lesions-to-specs",
    "type": "architecture",
    "chapters": [
      {
        "id": "ls-lesions",
        "label": "四个病灶",
        "file": "lesions-to-specs--ls-lesions.mp4",
        "endStill": "lesions-to-specs--ls-lesions-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.42,
        "beatNodes": [
          "l1",
          "l2",
          "l3",
          "l4"
        ]
      },
      {
        "id": "ls-specs",
        "label": "四条硬要求",
        "file": "lesions-to-specs--ls-specs.mp4",
        "endStill": "lesions-to-specs--ls-specs-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.42,
        "beatNodes": [
          "r1",
          "r2",
          "r3",
          "r4"
        ]
      },
      {
        "id": "ls-rows12",
        "label": "格与校准",
        "file": "lesions-to-specs--ls-rows12.mp4",
        "endStill": "lesions-to-specs--ls-rows12-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.64,
        "beatNodes": [
          "l1",
          "r1",
          "m1",
          "l2",
          "r2",
          "m2"
        ]
      },
      {
        "id": "ls-mech",
        "label": "四个机制",
        "file": "lesions-to-specs--ls-mech.mp4",
        "endStill": "lesions-to-specs--ls-mech-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
        "beatNodes": [
          "m1",
          "m2",
          "m3",
          "m4"
        ]
      }
    ]
  },
  "passphrase-probe": {
    "slug": "passphrase-probe",
    "type": "sequence",
    "chapters": [
      {
        "id": "pp-design",
        "label": "实验设计",
        "file": "passphrase-probe--pp-design.mp4",
        "endStill": "passphrase-probe--pp-design-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "researcher",
          "sibling",
          "screen"
        ]
      },
      {
        "id": "pp-sibling",
        "label": "暗号在卡上",
        "file": "passphrase-probe--pp-sibling.mp4",
        "endStill": "passphrase-probe--pp-sibling-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "researcher",
          "sibling",
          "judge"
        ]
      },
      {
        "id": "pp-state",
        "label": "暗号进大屏",
        "file": "passphrase-probe--pp-state.mp4",
        "endStill": "passphrase-probe--pp-state-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "researcher",
          "screen",
          "judge"
        ]
      },
      {
        "id": "pp-replica",
        "label": "复刻对拍",
        "file": "passphrase-probe--pp-replica.mp4",
        "endStill": "passphrase-probe--pp-replica-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "researcher",
          "replica"
        ]
      }
    ]
  },
  "readout-pipeline": {
    "slug": "readout-pipeline",
    "type": "dataflow",
    "chapters": [
      {
        "id": "rp-probs",
        "label": "概率柱",
        "file": "readout-pipeline--rp-probs.mp4",
        "endStill": "readout-pipeline--rp-probs-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "probs",
          "scoreboard"
        ]
      },
      {
        "id": "rp-formula",
        "label": "计算栏",
        "file": "readout-pipeline--rp-formula.mp4",
        "endStill": "readout-pipeline--rp-formula-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "probs",
          "formula",
          "conf"
        ]
      },
      {
        "id": "rp-k",
        "label": "K 依赖",
        "file": "readout-pipeline--rp-k.mp4",
        "endStill": "readout-pipeline--rp-k-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "conf",
          "k2",
          "k10"
        ]
      },
      {
        "id": "rp-gate",
        "label": "门槛消费",
        "file": "readout-pipeline--rp-gate.mp4",
        "endStill": "readout-pipeline--rp-gate-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "k2",
          "k10",
          "gate"
        ]
      }
    ]
  },
  "rlhf-rlvr-rlcd": {
    "slug": "rlhf-rlvr-rlcd",
    "type": "workflow",
    "chapters": [
      {
        "id": "tr-base",
        "label": "共用底座",
        "file": "rlhf-rlvr-rlcd--tr-base.mp4",
        "endStill": "rlhf-rlvr-rlcd--tr-base-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "base"
        ]
      },
      {
        "id": "tr-rlhf",
        "label": "RLHF 路",
        "file": "rlhf-rlvr-rlcd--tr-rlhf.mp4",
        "endStill": "rlhf-rlvr-rlcd--tr-rlhf-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "base",
          "rlhf",
          "anchor"
        ]
      },
      {
        "id": "tr-rlvr",
        "label": "RLVR 路",
        "file": "rlhf-rlvr-rlcd--tr-rlvr.mp4",
        "endStill": "rlhf-rlvr-rlcd--tr-rlvr-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "base",
          "rlvr",
          "chief"
        ]
      },
      {
        "id": "tr-rlcd",
        "label": "RLCD 路",
        "file": "rlhf-rlvr-rlcd--tr-rlcd.mp4",
        "endStill": "rlhf-rlvr-rlcd--tr-rlcd-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "base",
          "rlcd",
          "judge"
        ]
      }
    ]
  },
  "shared-read-isolated-branches": {
    "slug": "shared-read-isolated-branches",
    "type": "dataflow",
    "chapters": [
      {
        "id": "sr-once",
        "label": "只编码一次",
        "file": "shared-read-isolated-branches--sr-once.mp4",
        "endStill": "shared-read-isolated-branches--sr-once-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "state-in",
          "encode"
        ]
      },
      {
        "id": "sr-fanout",
        "label": "封卡分支",
        "file": "shared-read-isolated-branches--sr-fanout.mp4",
        "endStill": "shared-read-isolated-branches--sr-fanout-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "encode",
          "branch-a",
          "branch-b"
        ]
      },
      {
        "id": "sr-between",
        "label": "行间互不可见",
        "file": "shared-read-isolated-branches--sr-between.mp4",
        "endStill": "shared-read-isolated-branches--sr-between-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "branch-a",
          "branch-b",
          "readout"
        ]
      },
      {
        "id": "sr-within",
        "label": "行内互相影响",
        "file": "shared-read-isolated-branches--sr-within.mp4",
        "endStill": "shared-read-isolated-branches--sr-within-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "branch-b"
        ]
      },
      {
        "id": "sr-cost",
        "label": "代价与对账",
        "file": "shared-read-isolated-branches--sr-cost.mp4",
        "endStill": "shared-read-isolated-branches--sr-cost-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "readout",
          "gate"
        ]
      }
    ]
  },
  "speedup-ledger": {
    "slug": "speedup-ledger",
    "type": "dataflow",
    "chapters": [
      {
        "id": "sl-setup",
        "label": "口径设定",
        "file": "speedup-ledger--sl-setup.mp4",
        "endStill": "speedup-ledger--sl-setup-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "evals"
        ]
      },
      {
        "id": "sl-official",
        "label": "官方出口",
        "file": "speedup-ledger--sl-official.mp4",
        "endStill": "speedup-ledger--sl-official-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "headline"
        ]
      },
      {
        "id": "sl-recompute",
        "label": "复算对账",
        "file": "speedup-ledger--sl-recompute.mp4",
        "endStill": "speedup-ledger--sl-recompute-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "recompute",
          "demo"
        ]
      },
      {
        "id": "sl-verdict",
        "label": "归并",
        "file": "speedup-ledger--sl-verdict.mp4",
        "endStill": "speedup-ledger--sl-verdict-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "indep",
          "verdict"
        ]
      }
    ]
  },
  "three-city-architectures": {
    "slug": "three-city-architectures",
    "type": "architecture",
    "chapters": [
      {
        "id": "tc-demand",
        "label": "同一批需求",
        "file": "three-city-architectures--tc-demand.mp4",
        "endStill": "three-city-architectures--tc-demand-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.47,
        "beatNodes": [
          "demand",
          "rules",
          "anchor",
          "plan"
        ]
      },
      {
        "id": "tc-hard",
        "label": "硬规则之城",
        "file": "three-city-architectures--tc-hard.mp4",
        "endStill": "three-city-architectures--tc-hard-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "rules",
          "dev"
        ]
      },
      {
        "id": "tc-agent",
        "label": "主播自决之城",
        "file": "three-city-architectures--tc-agent.mp4",
        "endStill": "three-city-architectures--tc-agent-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "anchor",
          "monitor"
        ]
      },
      {
        "id": "tc-plan",
        "label": "预案之城",
        "file": "three-city-architectures--tc-plan.mp4",
        "endStill": "three-city-architectures--tc-plan-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "plan",
          "judge",
          "chief"
        ]
      }
    ]
  },
  "three-gates-routing": {
    "slug": "three-gates-routing",
    "type": "workflow",
    "chapters": [
      {
        "id": "tg-read",
        "label": "判读交读数",
        "file": "three-gates-routing--tg-read.mp4",
        "endStill": "three-gates-routing--tg-read-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "judge",
          "gate"
        ]
      },
      {
        "id": "tg-auto",
        "label": "自动闸",
        "file": "three-gates-routing--tg-auto.mp4",
        "endStill": "three-gates-routing--tg-auto-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "gate",
          "auto"
        ]
      },
      {
        "id": "tg-confirm",
        "label": "确认与人工",
        "file": "three-gates-routing--tg-confirm.mp4",
        "endStill": "three-gates-routing--tg-confirm-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "gate",
          "confirm",
          "human"
        ]
      },
      {
        "id": "tg-chief",
        "label": "首席兜底",
        "file": "three-gates-routing--tg-chief.mp4",
        "endStill": "three-gates-routing--tg-chief-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "human",
          "chief"
        ]
      }
    ]
  },
  "two-deliveries": {
    "slug": "two-deliveries",
    "type": "dataflow",
    "chapters": [
      {
        "id": "td-old",
        "label": "旧路·要人听写",
        "file": "two-deliveries--td-old.mp4",
        "endStill": "two-deliveries--td-old-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.42,
        "beatNodes": [
          "state-in",
          "llm-gen",
          "parse-validate",
          "switch-fall"
        ]
      },
      {
        "id": "td-new",
        "label": "新路·只填格",
        "file": "two-deliveries--td-new.mp4",
        "endStill": "two-deliveries--td-new-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "state-in",
          "judge-fill",
          "answers",
          "gate-branch"
        ]
      },
      {
        "id": "td-shape",
        "label": "形状保证",
        "file": "two-deliveries--td-shape.mp4",
        "endStill": "two-deliveries--td-shape-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "judge-fill",
          "answers"
        ]
      },
      {
        "id": "td-consume",
        "label": "代码消费",
        "file": "two-deliveries--td-consume.mp4",
        "endStill": "two-deliveries--td-consume-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "answers",
          "gate-branch"
        ]
      }
    ]
  },
  "validation-roundtrip": {
    "slug": "validation-roundtrip",
    "type": "sequence",
    "chapters": [
      {
        "id": "vr-request",
        "label": "出单与拒单",
        "file": "validation-roundtrip--vr-request.mp4",
        "endStill": "validation-roundtrip--vr-request-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "code",
          "api"
        ]
      },
      {
        "id": "vr-judge",
        "label": "落格",
        "file": "validation-roundtrip--vr-judge.mp4",
        "endStill": "validation-roundtrip--vr-judge-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "api",
          "judge"
        ]
      },
      {
        "id": "vr-return",
        "label": "返回",
        "file": "validation-roundtrip--vr-return.mp4",
        "endStill": "validation-roundtrip--vr-return-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "judge",
          "api",
          "code"
        ]
      },
      {
        "id": "vr-route",
        "label": "代码分流",
        "file": "validation-roundtrip--vr-route.mp4",
        "endStill": "validation-roundtrip--vr-route-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "code",
          "action"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
