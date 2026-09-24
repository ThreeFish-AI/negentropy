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
  "benchmark-audit": {
    "slug": "benchmark-audit",
    "type": "dataflow",
    "chapters": [
      {
        "id": "ba-scales",
        "label": "倍数天平",
        "file": "benchmark-audit--ba-scales.mp4",
        "endStill": "benchmark-audit--ba-scales-end.png",
        "beats": 3,
        "leadSec": 0.0,
        "storySec": 3.35,
        "beatNodes": [
          "ba-headline",
          "ba-demo",
          "ba-third"
        ]
      },
      {
        "id": "ba-pipeline",
        "label": "考核卷构成",
        "file": "benchmark-audit--ba-pipeline.mp4",
        "endStill": "benchmark-audit--ba-pipeline-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "ba-self",
          "ba-llm-ref",
          "ba-adapter"
        ]
      }
    ]
  },
  "calibration-ladder": {
    "slug": "calibration-ladder",
    "chapters": [
      {
        "id": "cl-ladder",
        "label": "校准台阶",
        "file": "calibration-ladder--cl-ladder.mp4",
        "endStill": "calibration-ladder--cl-ladder-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "cl-indist",
          "cl-ood",
          "cl-forced"
        ]
      },
      {
        "id": "cl-ledger",
        "label": "对账账本",
        "file": "calibration-ladder--cl-ledger.mp4",
        "endStill": "calibration-ladder--cl-ledger-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "cl-temp"
        ]
      },
      {
        "id": "cl-temperature",
        "label": "温度打折的边界",
        "file": "calibration-ladder--cl-temperature.mp4",
        "endStill": "calibration-ladder--cl-temperature-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.26,
        "beatNodes": [
          "cl-temp",
          "cl-honest"
        ]
      }
    ]
  },
  "closed-vs-open": {
    "slug": "closed-vs-open",
    "type": "workflow",
    "chapters": [
      {
        "id": "co-open-path",
        "label": "拆掉闭合",
        "file": "closed-vs-open--co-open-path.mp4",
        "endStill": "closed-vs-open--co-open-path-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "co-generate",
          "co-lenient"
        ]
      },
      {
        "id": "co-verdict",
        "label": "越界判例",
        "file": "closed-vs-open--co-verdict.mp4",
        "endStill": "closed-vs-open--co-verdict-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "co-out-open",
          "co-out-closed"
        ]
      }
    ]
  },
  "confidence-readout": {
    "slug": "confidence-readout",
    "type": "dataflow",
    "chapters": [
      {
        "id": "cr-formula",
        "label": "公式读数",
        "file": "confidence-readout--cr-formula.mp4",
        "endStill": "confidence-readout--cr-formula-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "cr-probs",
          "cr-formula-node",
          "cr-readout"
        ]
      },
      {
        "id": "cr-no-new-info",
        "label": "不是新信息",
        "file": "confidence-readout--cr-no-new-info.mp4",
        "endStill": "confidence-readout--cr-no-new-info-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "cr-readout",
          "cr-adapter"
        ]
      }
    ]
  },
  "decision-vs-generation": {
    "slug": "decision-vs-generation",
    "chapters": [
      {
        "id": "dg-split",
        "label": "分工线",
        "file": "decision-vs-generation--dg-split.mp4",
        "endStill": "decision-vs-generation--dg-split-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "dg-generation",
          "dg-judgment",
          "dg-interface"
        ]
      },
      {
        "id": "dg-checklist",
        "label": "四拿四缺",
        "file": "decision-vs-generation--dg-checklist.mp4",
        "endStill": "decision-vs-generation--dg-checklist-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "dg-got",
          "dg-miss"
        ]
      },
      {
        "id": "dg-open",
        "label": "开放问题",
        "file": "decision-vs-generation--dg-open.mp4",
        "endStill": "decision-vs-generation--dg-open-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "dg-open"
        ]
      }
    ]
  },
  "fast-slow-harness": {
    "slug": "fast-slow-harness",
    "type": "workflow",
    "chapters": [
      {
        "id": "fs-three-lanes",
        "label": "三条去向",
        "file": "fast-slow-harness--fs-three-lanes.mp4",
        "endStill": "fast-slow-harness--fs-three-lanes-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.69,
        "beatNodes": [
          "jevh-gate",
          "jevh-exec",
          "jevh-llm",
          "jevh-human"
        ]
      },
      {
        "id": "fs-rules",
        "label": "代码规则+窄问题",
        "file": "fast-slow-harness--fs-rules.mp4",
        "endStill": "fast-slow-harness--fs-rules-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "jevh-state",
          "jevh-rules",
          "jevh-jev"
        ]
      },
      {
        "id": "fs-judge",
        "label": "评审位",
        "file": "fast-slow-harness--fs-judge.mp4",
        "endStill": "fast-slow-harness--fs-judge-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "jevh-judge"
        ]
      },
      {
        "id": "fs-jevons",
        "label": "杰文斯回路",
        "file": "fast-slow-harness--fs-jevons.mp4",
        "endStill": "fast-slow-harness--fs-jevons-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "jevh-gate",
          "jevh-jev"
        ]
      }
    ]
  },
  "gate-thresholds": {
    "slug": "gate-thresholds",
    "chapters": [
      {
        "id": "gt-gates",
        "label": "三档阈值",
        "file": "gate-thresholds--gt-gates.mp4",
        "endStill": "gate-thresholds--gt-gates-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "gt-gate-act",
          "gt-gate-llm",
          "gt-gate-human"
        ]
      },
      {
        "id": "gt-budget",
        "label": "有把握的大多数",
        "file": "gate-thresholds--gt-budget.mp4",
        "endStill": "gate-thresholds--gt-budget-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "gt-budget"
        ]
      }
    ]
  },
  "isolation-probe": {
    "slug": "isolation-probe",
    "type": "sequence",
    "chapters": [
      {
        "id": "ip-sibling",
        "label": "暗号在兄弟小票",
        "file": "isolation-probe--ip-sibling.mp4",
        "endStill": "isolation-probe--ip-sibling-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "ip-sibling-q",
          "ip-probe-q"
        ]
      },
      {
        "id": "ip-state",
        "label": "暗号在底单",
        "file": "isolation-probe--ip-state.mp4",
        "endStill": "isolation-probe--ip-state-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "ip-state-doc",
          "ip-probe-q"
        ]
      }
    ]
  },
  "no-cross-invariant": {
    "slug": "no-cross-invariant",
    "type": "workflow",
    "chapters": [
      {
        "id": "ni-two-noul",
        "label": "两个 Noul 翻车",
        "file": "no-cross-invariant--ni-two-noul.mp4",
        "endStill": "no-cross-invariant--ni-two-noul-end.png",
        "beats": 2,
        "leadSec": 1.48,
        "storySec": 3.23,
        "beatNodes": [
          "ni-noul-pair",
          "ni-sum-119"
        ]
      },
      {
        "id": "ni-choice",
        "label": "单个 Choice 兜住",
        "file": "no-cross-invariant--ni-choice.mp4",
        "endStill": "no-cross-invariant--ni-choice-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "ni-choice",
          "ni-sum-1"
        ]
      },
      {
        "id": "ni-recipe",
        "label": "编排解",
        "file": "no-cross-invariant--ni-recipe.mp4",
        "endStill": "no-cross-invariant--ni-recipe-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "ni-choice",
          "ni-recipe-code"
        ]
      }
    ]
  },
  "one-pass-decision": {
    "slug": "one-pass-decision",
    "type": "dataflow",
    "chapters": [
      {
        "id": "op-encode",
        "label": "state 编码一次",
        "file": "one-pass-decision--op-encode.mp4",
        "endStill": "one-pass-decision--op-encode-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "jev-state",
          "jev-encode"
        ]
      },
      {
        "id": "op-branch",
        "label": "问题分支隔离",
        "file": "one-pass-decision--op-branch.mp4",
        "endStill": "one-pass-decision--op-branch-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "jev-questions",
          "jev-branch"
        ]
      },
      {
        "id": "op-readout",
        "label": "选项读出",
        "file": "one-pass-decision--op-readout.mp4",
        "endStill": "one-pass-decision--op-readout-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "jev-readout",
          "jev-probs",
          "jev-answer"
        ]
      }
    ]
  },
  "question-contracts": {
    "slug": "question-contracts",
    "type": "workflow",
    "chapters": [
      {
        "id": "qc-anatomy",
        "label": "请求解剖",
        "file": "question-contracts--qc-anatomy.mp4",
        "endStill": "question-contracts--qc-anatomy-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "qc-state",
          "qc-questions"
        ]
      },
      {
        "id": "qc-three-types",
        "label": "三题型",
        "file": "question-contracts--qc-three-types.mp4",
        "endStill": "question-contracts--qc-three-types-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.43,
        "beatNodes": [
          "qc-noul",
          "qc-choice",
          "qc-score"
        ]
      },
      {
        "id": "qc-closed",
        "label": "答案空间先定",
        "file": "question-contracts--qc-closed.mp4",
        "endStill": "question-contracts--qc-closed-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "qc-choice",
          "qc-validate",
          "qc-answer"
        ]
      }
    ]
  },
  "slot-wall": {
    "slug": "slot-wall",
    "chapters": [
      {
        "id": "sw-legal-vs-correct",
        "label": "合法 ≠ 正确",
        "file": "slot-wall--sw-legal-vs-correct.mp4",
        "endStill": "slot-wall--sw-legal-vs-correct-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "sw-formal",
          "sw-semantic"
        ]
      },
      {
        "id": "sw-trap",
        "label": "陷阱面单",
        "file": "slot-wall--sw-trap.mp4",
        "endStill": "slot-wall--sw-trap-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "sw-trap",
          "sw-wall"
        ]
      }
    ]
  },
  "sorting-center": {
    "slug": "sorting-center",
    "chapters": [
      {
        "id": "sc-four-sins",
        "label": "四宗罪",
        "file": "sorting-center--sc-four-sins.mp4",
        "endStill": "sorting-center--sc-four-sins-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "sc-dispatcher"
        ]
      },
      {
        "id": "sc-mismatch",
        "label": "错配：判断塞进生成通道",
        "file": "sorting-center--sc-mismatch.mp4",
        "endStill": "sorting-center--sc-mismatch-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "sc-dispatcher",
          "sc-parcel"
        ]
      },
      {
        "id": "sc-one-liner",
        "label": "一次前向逐项打分",
        "file": "sorting-center--sc-one-liner.mp4",
        "endStill": "sorting-center--sc-one-liner-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "sc-sorter",
          "sc-slots"
        ]
      },
      {
        "id": "sc-tour",
        "label": "分拣中心总览",
        "file": "sorting-center--sc-tour.mp4",
        "endStill": "sorting-center--sc-tour-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.65,
        "beatNodes": [
          "sc-dispatcher",
          "sc-sorter",
          "sc-slots",
          "sc-review",
          "sc-manual",
          "sc-belt"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
