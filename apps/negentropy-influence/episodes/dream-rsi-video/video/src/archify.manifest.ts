// 本文件由 scripts/archify_manifest.py 从 public/archify/*.json 生成——请勿手改。
// 数据来源：to-video skill 的 pipeline/scripts/record_archify.py --mode chapter（逐章录制）
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
  "behavior-adaptive": {
    "slug": "behavior-adaptive",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "early",
        "label": "起步：满编探索",
        "file": "behavior-adaptive--early.mp4",
        "endStill": "behavior-adaptive--early-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "early"
        ]
      },
      {
        "id": "save",
        "label": "顺境：主动省钱",
        "file": "behavior-adaptive--save.mp4",
        "endStill": "behavior-adaptive--save-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "economize",
          "stalled"
        ]
      },
      {
        "id": "re-explore",
        "label": "停滞：加码再探",
        "file": "behavior-adaptive--re-explore.mp4",
        "endStill": "behavior-adaptive--re-explore-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "re-explore"
        ]
      },
      {
        "id": "perf",
        "label": "成绩单",
        "file": "behavior-adaptive--perf.mp4",
        "endStill": "behavior-adaptive--perf-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.22,
        "beatNodes": [
          "performance",
          "lesson"
        ]
      }
    ]
  },
  "determinism-proof": {
    "slug": "determinism-proof",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "reset",
        "label": "重置到根再出发",
        "file": "determinism-proof--reset.mp4",
        "endStill": "determinism-proof--reset-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "reset",
          "pick"
        ]
      },
      {
        "id": "nonroot",
        "label": "老节点：唯一后继",
        "file": "determinism-proof--nonroot.mp4",
        "endStill": "determinism-proof--nonroot-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "reveal-child"
        ]
      },
      {
        "id": "root",
        "label": "树根：建档序开枝",
        "file": "determinism-proof--root.mp4",
        "endStill": "determinism-proof--root-end.png",
        "beats": 1,
        "leadSec": 0.48,
        "storySec": 3.26,
        "beatNodes": [
          "reveal-earliest"
        ]
      },
      {
        "id": "end",
        "label": "长大与终止",
        "file": "determinism-proof--end.mp4",
        "endStill": "determinism-proof--end-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "grow",
          "terminate"
        ]
      }
    ]
  },
  "dilemma-cost": {
    "slug": "dilemma-cost",
    "type": "workflow",
    "chapters": [
      {
        "id": "dilemma",
        "label": "两条路都堵",
        "file": "dilemma-cost--dilemma.mp4",
        "endStill": "dilemma-cost--dilemma-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "rsi",
          "fixed",
          "online"
        ]
      },
      {
        "id": "stuck",
        "label": "写死砸空转 vs 改不起",
        "file": "dilemma-cost--stuck.mp4",
        "endStill": "dilemma-cost--stuck-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.27,
        "beatNodes": [
          "fixed-harm",
          "online-cost"
        ]
      },
      {
        "id": "verdict",
        "label": "成本结构的死结",
        "file": "dilemma-cost--verdict.mp4",
        "endStill": "dilemma-cost--verdict-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "verdict"
        ]
      },
      {
        "id": "breakthrough",
        "label": "破局：历史已是模拟器",
        "file": "dilemma-cost--breakthrough.mp4",
        "endStill": "dilemma-cost--breakthrough-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "breakthrough"
        ]
      }
    ]
  },
  "discovery-tree": {
    "slug": "discovery-tree",
    "type": "dataflow",
    "chapters": [
      {
        "id": "pages",
        "label": "新页的出身与身价",
        "file": "discovery-tree--pages.mp4",
        "endStill": "discovery-tree--pages-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.23,
        "beatNodes": [
          "page-a",
          "page-b"
        ]
      },
      {
        "id": "grow",
        "label": "台账长成树",
        "file": "discovery-tree--grow.mp4",
        "endStill": "discovery-tree--grow-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "root",
          "branch-a",
          "branch-b"
        ]
      },
      {
        "id": "interface",
        "label": "同一套决策接口",
        "file": "discovery-tree--interface.mp4",
        "endStill": "discovery-tree--interface-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "interface"
        ]
      }
    ]
  },
  "evidence-162x-caliber": {
    "slug": "evidence-162x-caliber",
    "type": "dataflow",
    "chapters": [
      {
        "id": "bars",
        "label": "三根柱子",
        "file": "evidence-162x-caliber--bars.mp4",
        "endStill": "evidence-162x-caliber--bars-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "ours",
          "controlled",
          "simples"
        ]
      },
      {
        "id": "ratio",
        "label": "约两个数量级",
        "file": "evidence-162x-caliber--ratio.mp4",
        "endStill": "evidence-162x-caliber--ratio-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "ratio"
        ]
      },
      {
        "id": "warn",
        "label": "口径警示",
        "file": "evidence-162x-caliber--warn.mp4",
        "endStill": "evidence-162x-caliber--warn-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "caliber-warn"
        ]
      },
      {
        "id": "split",
        "label": "拆开看",
        "file": "evidence-162x-caliber--split.mp4",
        "endStill": "evidence-162x-caliber--split-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "dataset-split"
        ]
      }
    ]
  },
  "expedition-setup": {
    "slug": "expedition-setup",
    "type": "architecture",
    "chapters": [
      {
        "id": "team",
        "label": "探险队与选路章程",
        "file": "expedition-setup--team.mp4",
        "endStill": "expedition-setup--team-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "expedition",
          "policy"
        ]
      },
      {
        "id": "ledger",
        "label": "台账：越铺越大的发现树",
        "file": "expedition-setup--ledger.mp4",
        "endStill": "expedition-setup--ledger-end.png",
        "beats": 1,
        "leadSec": 0.48,
        "storySec": 3.23,
        "beatNodes": [
          "ledger"
        ]
      },
      {
        "id": "sandbox",
        "label": "沙盘：翻旧账免费",
        "file": "expedition-setup--sandbox.mp4",
        "endStill": "expedition-setup--sandbox-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "sandbox"
        ]
      },
      {
        "id": "staff",
        "label": "幕僚长照推演改章程",
        "file": "expedition-setup--staff.mp4",
        "endStill": "expedition-setup--staff-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "dev",
          "policy"
        ]
      }
    ]
  },
  "four-charters": {
    "slug": "four-charters",
    "type": "dataflow",
    "chapters": [
      {
        "id": "one-tree",
        "label": "同一棵树，谁来做梦",
        "file": "four-charters--one-tree.mp4",
        "endStill": "four-charters--one-tree-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "tree"
        ]
      },
      {
        "id": "scores",
        "label": "四种章程四份成绩单",
        "file": "four-charters--scores.mp4",
        "endStill": "four-charters--scores-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "p-parallel",
          "p-adaptive",
          "p-early",
          "p-serial"
        ]
      },
      {
        "id": "takeaway",
        "label": "一次真实换无数次免费",
        "file": "four-charters--takeaway.mp4",
        "endStill": "four-charters--takeaway-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "takeaway"
        ]
      }
    ]
  },
  "history-as-simulator": {
    "slug": "history-as-simulator",
    "type": "dataflow",
    "chapters": [
      {
        "id": "origin",
        "label": "旧台账变免费试验场",
        "file": "history-as-simulator--origin.mp4",
        "endStill": "history-as-simulator--origin-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.26,
        "beatNodes": [
          "history",
          "simulator"
        ]
      },
      {
        "id": "specs",
        "label": "四块基石",
        "file": "history-as-simulator--specs.mp4",
        "endStill": "history-as-simulator--specs-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
        "beatNodes": [
          "spec-code",
          "spec-replay",
          "spec-bound",
          "spec-loop"
        ]
      },
      {
        "id": "cycle",
        "label": "回灌循环",
        "file": "history-as-simulator--cycle.mp4",
        "endStill": "history-as-simulator--cycle-end.png",
        "beats": 1,
        "leadSec": 0.56,
        "storySec": 3.3,
        "beatNodes": [
          "cycle"
        ]
      }
    ]
  },
  "proto-two-rounds": {
    "slug": "proto-two-rounds",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "t1",
        "label": "第一轮：并行铺满",
        "file": "proto-two-rounds--t1.mp4",
        "endStill": "proto-two-rounds--t1-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "round1"
        ]
      },
      {
        "id": "dream",
        "label": "做梦一轮：换章程",
        "file": "proto-two-rounds--dream.mp4",
        "endStill": "proto-two-rounds--dream-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "dream"
        ]
      },
      {
        "id": "t2",
        "label": "第二轮：新章程交卷",
        "file": "proto-two-rounds--t2.mp4",
        "endStill": "proto-two-rounds--t2-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.28,
        "beatNodes": [
          "round2",
          "combo"
        ]
      },
      {
        "id": "combo",
        "label": "收放批次：深挖+试探+开新根",
        "file": "proto-two-rounds--combo.mp4",
        "endStill": "proto-two-rounds--combo-end.png",
        "beats": 1,
        "leadSec": 0.48,
        "storySec": 3.22,
        "beatNodes": [
          "combo"
        ]
      },
      {
        "id": "frozen",
        "label": "变的只有章程",
        "file": "proto-two-rounds--frozen.mp4",
        "endStill": "proto-two-rounds--frozen-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "result"
        ]
      }
    ]
  },
  "replay-simulator": {
    "slug": "replay-simulator",
    "type": "workflow",
    "chapters": [
      {
        "id": "visible",
        "label": "只看已见的部分",
        "file": "replay-simulator--visible.mp4",
        "endStill": "replay-simulator--visible-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "obs",
          "elig"
        ]
      },
      {
        "id": "freedom",
        "label": "批次即全部自由度",
        "file": "replay-simulator--freedom.mp4",
        "endStill": "replay-simulator--freedom-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "elig",
          "batch"
        ]
      },
      {
        "id": "root-rule",
        "label": "选根：按建档序开枝",
        "file": "replay-simulator--root-rule.mp4",
        "endStill": "replay-simulator--root-rule-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "batch",
          "rootpick"
        ]
      },
      {
        "id": "chain-rule",
        "label": "选叶：唯一记录后继",
        "file": "replay-simulator--chain-rule.mp4",
        "endStill": "replay-simulator--chain-rule-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "batch",
          "chain"
        ]
      },
      {
        "id": "score-out",
        "label": "长大、终止、计分",
        "file": "replay-simulator--score-out.mp4",
        "endStill": "replay-simulator--score-out-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "newview",
          "term",
          "v"
        ]
      }
    ]
  },
  "teardown-d1-guard": {
    "slug": "teardown-d1-guard",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "intact",
        "label": "保险在：现任兜底",
        "file": "teardown-d1-guard--intact.mp4",
        "endStill": "teardown-d1-guard--intact-end.png",
        "beats": 1,
        "leadSec": 0.48,
        "storySec": 3.22,
        "beatNodes": [
          "intact"
        ]
      },
      {
        "id": "removed",
        "label": "拆掉：矮子拔将军",
        "file": "teardown-d1-guard--removed.mp4",
        "endStill": "teardown-d1-guard--removed-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "removed",
          "worse-wins",
          "degrade"
        ]
      },
      {
        "id": "insurance",
        "label": "教训",
        "file": "teardown-d1-guard--insurance.mp4",
        "endStill": "teardown-d1-guard--insurance-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "lesson"
        ]
      }
    ]
  },
  "teardown-d4-peek": {
    "slug": "teardown-d4-peek",
    "type": "dataflow",
    "chapters": [
      {
        "id": "legal",
        "label": "老实按页翻",
        "file": "teardown-d4-peek--legal.mp4",
        "endStill": "teardown-d4-peek--legal-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.23,
        "beatNodes": [
          "legal",
          "legal-score"
        ]
      },
      {
        "id": "cheat",
        "label": "越权抽最优页",
        "file": "teardown-d4-peek--cheat.mp4",
        "endStill": "teardown-d4-peek--cheat-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "peek",
          "peek-score"
        ]
      },
      {
        "id": "reversal",
        "label": "排名反转",
        "file": "teardown-d4-peek--reversal.mp4",
        "endStill": "teardown-d4-peek--reversal-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "reversal",
          "lesson"
        ]
      },
      {
        "id": "lesson",
        "label": "评估要对真实成本负责",
        "file": "teardown-d4-peek--lesson.mp4",
        "endStill": "teardown-d4-peek--lesson-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "lesson"
        ]
      }
    ]
  },
  "teardown-d5-lockin": {
    "slug": "teardown-d5-lockin",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "inject",
        "label": "把历史浓缩成一句建议",
        "file": "teardown-d5-lockin--inject.mp4",
        "endStill": "teardown-d5-lockin--inject-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.25,
        "beatNodes": [
          "inject",
          "locked"
        ]
      },
      {
        "id": "replay",
        "label": "做梦改进的对照组",
        "file": "teardown-d5-lockin--replay.mp4",
        "endStill": "teardown-d5-lockin--replay-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.27,
        "beatNodes": [
          "replay-path",
          "reached"
        ]
      },
      {
        "id": "diversity",
        "label": "洞见锁方向，重放保多样",
        "file": "teardown-d5-lockin--diversity.mp4",
        "endStill": "teardown-d5-lockin--diversity-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "verdict"
        ]
      }
    ]
  },
  "two-phase-loop": {
    "slug": "two-phase-loop",
    "type": "workflow",
    "chapters": [
      {
        "id": "online",
        "label": "白天进山：章程带队探索",
        "file": "two-phase-loop--online.mp4",
        "endStill": "two-phase-loop--online-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "policy",
          "workers",
          "tree"
        ]
      },
      {
        "id": "offline",
        "label": "夜里做梦：历史钉上沙盘",
        "file": "two-phase-loop--offline.mp4",
        "endStill": "two-phase-loop--offline-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.39,
        "beatNodes": [
          "history",
          "sim",
          "score"
        ]
      },
      {
        "id": "revise",
        "label": "做梦内环：幕僚长改章程",
        "file": "two-phase-loop--revise.mp4",
        "endStill": "two-phase-loop--revise-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "sim",
          "score",
          "dev"
        ]
      },
      {
        "id": "guard",
        "label": "防回退闸：候选含现任",
        "file": "two-phase-loop--guard.mp4",
        "endStill": "two-phase-loop--guard-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "score",
          "select"
        ]
      },
      {
        "id": "loop",
        "label": "递归闭环：新章程再上线",
        "file": "two-phase-loop--loop.mp4",
        "endStill": "two-phase-loop--loop-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.37,
        "beatNodes": [
          "tree",
          "history",
          "policy"
        ]
      }
    ]
  },
  "unproven-list": {
    "slug": "unproven-list",
    "type": "workflow",
    "chapters": [
      {
        "id": "head",
        "label": "论文没有证明的事",
        "file": "unproven-list--head.mp4",
        "endStill": "unproven-list--head-end.png",
        "beats": 1,
        "leadSec": 0.48,
        "storySec": 3.26,
        "beatNodes": [
          "frontier"
        ]
      },
      {
        "id": "gap-12",
        "label": "相关性与成本账",
        "file": "unproven-list--gap-12.mp4",
        "endStill": "unproven-list--gap-12-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.25,
        "beatNodes": [
          "gap-correlation",
          "gap-cost"
        ]
      },
      {
        "id": "gap-345",
        "label": "口径、方差与边界",
        "file": "unproven-list--gap-345.mp4",
        "endStill": "unproven-list--gap-345-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "gap-caliber",
          "gap-variance",
          "gap-fidelity"
        ]
      }
    ]
  },
  "v-three-terms": {
    "slug": "v-three-terms",
    "type": "dataflow",
    "chapters": [
      {
        "id": "quality",
        "label": "第一项：最好收获",
        "file": "v-three-terms--quality.mp4",
        "endStill": "v-three-terms--quality-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.27,
        "beatNodes": [
          "quality"
        ]
      },
      {
        "id": "cost",
        "label": "第二项：翻页工钱",
        "file": "v-three-terms--cost.mp4",
        "endStill": "v-three-terms--cost-end.png",
        "beats": 1,
        "leadSec": 0.48,
        "storySec": 3.25,
        "beatNodes": [
          "cost"
        ]
      },
      {
        "id": "parallel",
        "label": "第三项：并行奖励",
        "file": "v-three-terms--parallel.mp4",
        "endStill": "v-three-terms--parallel-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "parallel"
        ]
      },
      {
        "id": "total",
        "label": "性价比与它的另一副面孔",
        "file": "v-three-terms--total.mp4",
        "endStill": "v-three-terms--total-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "score",
          "average",
          "caliber-note"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
