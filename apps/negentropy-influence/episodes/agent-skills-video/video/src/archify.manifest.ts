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
  "box-anatomy": {
    "slug": "box-anatomy",
    "chapters": [
      {
        "id": "ba-box",
        "label": "箱体解剖",
        "file": "box-anatomy--ba-box.mp4",
        "endStill": "box-anatomy--ba-box-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "folder",
          "skillmd"
        ]
      },
      {
        "id": "ba-corner",
        "label": "六字段角件",
        "file": "box-anatomy--ba-corner.mp4",
        "endStill": "box-anatomy--ba-corner-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.52,
        "beatNodes": [
          "skillmd",
          "f-name",
          "f-desc",
          "f-opt",
          "metadata"
        ]
      },
      {
        "id": "ba-name",
        "label": "箱号 = 登记名",
        "file": "box-anatomy--ba-name.mp4",
        "endStill": "box-anatomy--ba-name-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "f-name",
          "dirname"
        ]
      },
      {
        "id": "ba-body",
        "label": "正文与附件",
        "file": "box-anatomy--ba-body.mp4",
        "endStill": "box-anatomy--ba-body-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "skillmd",
          "body",
          "annex"
        ]
      },
      {
        "id": "ba-extra",
        "label": "选填与验箱",
        "file": "box-anatomy--ba-extra.mp4",
        "endStill": "box-anatomy--ba-extra-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "f-opt",
          "metadata",
          "validator"
        ]
      }
    ]
  },
  "box-history-rhyme": {
    "slug": "box-history-rhyme",
    "chapters": [
      {
        "id": "hr-mclean",
        "label": "卡车司机",
        "file": "box-history-rhyme--hr-mclean.mp4",
        "endStill": "box-history-rhyme--hr-mclean-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "s-launch",
          "s-donate"
        ]
      },
      {
        "id": "hr-csi",
        "label": "事故倒逼",
        "file": "box-history-rhyme--hr-csi.mp4",
        "endStill": "box-history-rhyme--hr-csi-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "s-gap",
          "s-csi"
        ]
      },
      {
        "id": "hr-rhyme",
        "label": "先事实后条文",
        "file": "box-history-rhyme--hr-rhyme.mp4",
        "endStill": "box-history-rhyme--hr-rhyme-end.png",
        "beats": 7,
        "leadSec": 0.44,
        "storySec": 7.74,
        "beatNodes": [
          "s-iso",
          "s-gap",
          "s-csi",
          "k-fact",
          "k-blank",
          "k-rule",
          "v-rhyme"
        ]
      }
    ]
  },
  "budget-flipboard": {
    "slug": "budget-flipboard",
    "type": "dataflow",
    "chapters": [
      {
        "id": "bf-toy",
        "label": "玩具实测",
        "file": "budget-flipboard--bf-toy.mp4",
        "endStill": "budget-flipboard--bf-toy-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.53,
        "beatNodes": [
          "lib",
          "ledger",
          "full",
          "ledgerCost",
          "fullCost"
        ]
      },
      {
        "id": "bf-times",
        "label": "十七倍",
        "file": "budget-flipboard--bf-times.mp4",
        "endStill": "budget-flipboard--bf-times-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.38,
        "beatNodes": [
          "ledgerCost",
          "fullCost",
          "ratio"
        ]
      },
      {
        "id": "bf-openai",
        "label": "对岸红线",
        "file": "budget-flipboard--bf-openai.mp4",
        "endStill": "budget-flipboard--bf-openai-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "ledgerCost",
          "redline"
        ]
      }
    ]
  },
  "craft-real-tasks": {
    "slug": "craft-real-tasks",
    "type": "workflow",
    "chapters": [
      {
        "id": "cr-grow",
        "label": "真实任务",
        "file": "craft-real-tasks--cr-grow.mp4",
        "endStill": "craft-real-tasks--cr-grow-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "t1",
          "t2"
        ]
      },
      {
        "id": "cr-gotchas",
        "label": "坑点上册",
        "file": "craft-real-tasks--cr-gotchas.mp4",
        "endStill": "craft-real-tasks--cr-gotchas-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.25,
        "beatNodes": [
          "t2",
          "b1"
        ]
      },
      {
        "id": "cr-rerun",
        "label": "跑了再改",
        "file": "craft-real-tasks--cr-rerun.mp4",
        "endStill": "craft-real-tasks--cr-rerun-end.png",
        "beats": 3,
        "leadSec": 0.52,
        "storySec": 4.56,
        "beatNodes": [
          "b1",
          "t3",
          "b2"
        ]
      },
      {
        "id": "cr-lean",
        "label": "会的别写",
        "file": "craft-real-tasks--cr-lean.mp4",
        "endStill": "craft-real-tasks--cr-lean-end.png",
        "beats": 2,
        "leadSec": 0.52,
        "storySec": 3.27,
        "beatNodes": [
          "b2",
          "t3"
        ]
      }
    ]
  },
  "disclosure-lifecycle": {
    "slug": "disclosure-lifecycle",
    "type": "workflow",
    "chapters": [
      {
        "id": "dl-discover",
        "label": "发现与解析",
        "file": "disclosure-lifecycle--dl-discover.mp4",
        "endStill": "disclosure-lifecycle--dl-discover-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.34,
        "beatNodes": [
          "discover",
          "parse",
          "resolve"
        ]
      },
      {
        "id": "dl-catalog",
        "label": "台账常驻",
        "file": "disclosure-lifecycle--dl-catalog.mp4",
        "endStill": "disclosure-lifecycle--dl-catalog-end.png",
        "beats": 1,
        "leadSec": 0.28,
        "storySec": 3.26,
        "beatNodes": [
          "catalog"
        ]
      },
      {
        "id": "dl-activate",
        "label": "提箱整载",
        "file": "disclosure-lifecycle--dl-activate.mp4",
        "endStill": "disclosure-lifecycle--dl-activate-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "route",
          "activate"
        ]
      },
      {
        "id": "dl-tier3",
        "label": "隔层按需",
        "file": "disclosure-lifecycle--dl-tier3.mp4",
        "endStill": "disclosure-lifecycle--dl-tier3-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "interpret",
          "resources"
        ]
      },
      {
        "id": "dl-rewrite",
        "label": "改写账本",
        "file": "disclosure-lifecycle--dl-rewrite.mp4",
        "endStill": "disclosure-lifecycle--dl-rewrite-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "exempt",
          "dedupe"
        ]
      }
    ]
  },
  "eval-twin-runs": {
    "slug": "eval-twin-runs",
    "type": "workflow",
    "chapters": [
      {
        "id": "et-blind",
        "label": "同单两跑 · 盲评",
        "file": "eval-twin-runs--et-blind.mp4",
        "endStill": "eval-twin-runs--et-blind-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
        "beatNodes": [
          "task",
          "run_a",
          "run_b",
          "judge"
        ]
      },
      {
        "id": "et-assert",
        "label": "断言记账",
        "file": "eval-twin-runs--et-assert.mp4",
        "endStill": "eval-twin-runs--et-assert-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "judge",
          "checklist",
          "ledger",
          "verdict"
        ]
      }
    ]
  },
  "experiment-label-injection": {
    "slug": "experiment-label-injection",
    "type": "sequence",
    "chapters": [
      {
        "id": "xi-smuggle",
        "label": "缩进伪字段",
        "file": "experiment-label-injection--xi-smuggle.mp4",
        "endStill": "experiment-label-injection--xi-smuggle-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.28,
        "beatNodes": [
          "author",
          "label"
        ]
      },
      {
        "id": "xi-leak",
        "label": "混入元数据",
        "file": "experiment-label-injection--xi-leak.mp4",
        "endStill": "experiment-label-injection--xi-leak-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "label",
          "parser",
          "meta"
        ]
      },
      {
        "id": "xi-authorize",
        "label": "预授权风险",
        "file": "experiment-label-injection--xi-authorize.mp4",
        "endStill": "experiment-label-injection--xi-authorize-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "meta",
          "client",
          "author"
        ]
      },
      {
        "id": "xi-truthiness",
        "label": "false 彩蛋",
        "file": "experiment-label-injection--xi-truthiness.mp4",
        "endStill": "experiment-label-injection--xi-truthiness-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "parser",
          "meta",
          "client"
        ]
      }
    ]
  },
  "experiment-scan-order": {
    "slug": "experiment-scan-order",
    "type": "workflow",
    "chapters": [
      {
        "id": "xo-priority",
        "label": "拆掉优先级",
        "file": "experiment-scan-order--xo-priority.mp4",
        "endStill": "experiment-scan-order--xo-priority-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "a-first",
          "b-first"
        ]
      },
      {
        "id": "xo-drift",
        "label": "两港漂移",
        "file": "experiment-scan-order--xo-drift.mp4",
        "endStill": "experiment-scan-order--xo-drift-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "a-hit",
          "b-hit"
        ]
      },
      {
        "id": "xo-silent",
        "label": "无报错",
        "file": "experiment-scan-order--xo-silent.mp4",
        "endStill": "experiment-scan-order--xo-silent-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "a-ident",
          "b-ident"
        ]
      }
    ]
  },
  "four-ports-charter": {
    "slug": "four-ports-charter",
    "type": "architecture",
    "chapters": [
      {
        "id": "fp-quartet",
        "label": "四联章程",
        "file": "four-ports-charter--fp-quartet.mp4",
        "endStill": "four-ports-charter--fp-quartet-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.56,
        "beatNodes": [
          "spec",
          "gemini",
          "cc",
          "openai",
          "vscode"
        ]
      },
      {
        "id": "fp-ports",
        "label": "四港画像",
        "file": "four-ports-charter--fp-ports.mp4",
        "endStill": "four-ports-charter--fp-ports-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.42,
        "beatNodes": [
          "gemini",
          "cc",
          "openai",
          "vscode"
        ]
      },
      {
        "id": "fp-paths",
        "label": "堆场与锚点",
        "file": "four-ports-charter--fp-paths.mp4",
        "endStill": "four-ports-charter--fp-paths-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "yard",
          "anchor"
        ]
      },
      {
        "id": "fp-ref",
        "label": "验箱师",
        "file": "four-ports-charter--fp-ref.mp4",
        "endStill": "four-ports-charter--fp-ref-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "ref",
          "spec"
        ]
      },
      {
        "id": "fp-vacuum",
        "label": "签名真空",
        "file": "four-ports-charter--fp-vacuum.mp4",
        "endStill": "four-ports-charter--fp-vacuum-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "vacuum",
          "spec"
        ]
      }
    ]
  },
  "governance-layers": {
    "slug": "governance-layers",
    "type": "architecture",
    "chapters": [
      {
        "id": "gl-three",
        "label": "三层治理",
        "file": "governance-layers--gl-three.mp4",
        "endStill": "governance-layers--gl-three-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "must",
          "advise",
          "blank"
        ]
      },
      {
        "id": "gl-algo",
        "label": "极简算法",
        "file": "governance-layers--gl-algo.mp4",
        "endStill": "governance-layers--gl-algo-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "blank",
          "guide-trust"
        ]
      },
      {
        "id": "gl-verdict",
        "label": "判词",
        "file": "governance-layers--gl-verdict.mp4",
        "endStill": "governance-layers--gl-verdict-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "pr254",
          "pr573",
          "pr546"
        ]
      }
    ]
  },
  "identity-registry": {
    "slug": "identity-registry",
    "type": "sequence",
    "chapters": [
      {
        "id": "ir-nocenter",
        "label": "无注册中心",
        "file": "identity-registry--ir-nocenter.mp4",
        "endStill": "identity-registry--ir-nocenter-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "author",
          "fs"
        ]
      },
      {
        "id": "ir-deal",
        "label": "登记处交易",
        "file": "identity-registry--ir-deal.mp4",
        "endStill": "identity-registry--ir-deal-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "author",
          "fs",
          "client"
        ]
      }
    ]
  },
  "label-good-bad": {
    "slug": "label-good-bad",
    "type": "architecture",
    "chapters": [
      {
        "id": "lb-pair",
        "label": "两张货签",
        "file": "label-good-bad--lb-pair.mp4",
        "endStill": "label-good-bad--lb-pair-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "router",
          "good",
          "bad"
        ]
      },
      {
        "id": "lb-silent",
        "label": "静默退化",
        "file": "label-good-bad--lb-silent.mp4",
        "endStill": "label-good-bad--lb-silent-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "bad",
          "silent"
        ]
      },
      {
        "id": "lb-intent",
        "label": "没说关键词",
        "file": "label-good-bad--lb-intent.mp4",
        "endStill": "label-good-bad--lb-intent-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
        "beatNodes": [
          "user",
          "router",
          "good",
          "hit"
        ]
      }
    ]
  },
  "lenient-vs-strict": {
    "slug": "lenient-vs-strict",
    "type": "workflow",
    "chapters": [
      {
        "id": "ls-warnload",
        "label": "警告照放",
        "file": "lenient-vs-strict--ls-warnload.mp4",
        "endStill": "lenient-vs-strict--ls-warnload-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "arrival",
          "lenient_gate",
          "loaded"
        ]
      },
      {
        "id": "ls-x2",
        "label": "实测门",
        "file": "lenient-vs-strict--ls-x2.mp4",
        "endStill": "lenient-vs-strict--ls-x2-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "lenient_gate",
          "strict_gate",
          "lenient_tally",
          "strict_tally"
        ]
      }
    ]
  },
  "pending-wars": {
    "slug": "pending-wars",
    "type": "dataflow",
    "chapters": [
      {
        "id": "pw-stall",
        "label": "停摆七个月",
        "file": "pending-wars--pw-stall.mp4",
        "endStill": "pending-wars--pw-stall-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "p-distro",
          "queue",
          "pr254",
          "out-stall"
        ]
      },
      {
        "id": "pw-clash",
        "label": "对冲无裁决",
        "file": "pending-wars--pw-clash.mp4",
        "endStill": "pending-wars--pw-clash-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.47,
        "beatNodes": [
          "p-schema",
          "queue",
          "pr57520",
          "out-clash"
        ]
      },
      {
        "id": "pw-interop",
        "label": "最先落地",
        "file": "pending-wars--pw-interop.mp4",
        "endStill": "pending-wars--pw-interop-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "p-interop",
          "queue",
          "pr546",
          "out-land"
        ]
      }
    ]
  },
  "port-46-adoption": {
    "slug": "port-46-adoption",
    "chapters": [
      {
        "id": "pa-open",
        "label": "捐出开放",
        "file": "port-46-adoption--pa-open.mp4",
        "endStill": "port-46-adoption--pa-open-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "anthropic",
          "open-std"
        ]
      },
      {
        "id": "pa-harbor",
        "label": "竞对全接",
        "file": "port-46-adoption--pa-harbor.mp4",
        "endStill": "port-46-adoption--pa-harbor-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.57,
        "beatNodes": [
          "open-std",
          "openai",
          "google",
          "microsoft",
          "cursor"
        ]
      },
      {
        "id": "pa-table",
        "label": "整张牌桌",
        "file": "port-46-adoption--pa-table.mp4",
        "endStill": "port-46-adoption--pa-table-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.64,
        "beatNodes": [
          "showcase",
          "gate",
          "openai",
          "google",
          "microsoft",
          "cursor"
        ]
      }
    ]
  },
  "routing-eval-protocol": {
    "slug": "routing-eval-protocol",
    "type": "workflow",
    "chapters": [
      {
        "id": "re-nearmiss",
        "label": "近失配",
        "file": "routing-eval-protocol--re-nearmiss.mp4",
        "endStill": "routing-eval-protocol--re-nearmiss-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "near",
          "outer"
        ]
      },
      {
        "id": "re-protocol",
        "label": "一套卷子",
        "file": "routing-eval-protocol--re-protocol.mp4",
        "endStill": "routing-eval-protocol--re-protocol-end.png",
        "beats": 4,
        "leadSec": 0.48,
        "storySec": 4.47,
        "beatNodes": [
          "exam",
          "sched",
          "rate",
          "gate"
        ]
      },
      {
        "id": "re-holdout",
        "label": "六四分",
        "file": "routing-eval-protocol--re-holdout.mp4",
        "endStill": "routing-eval-protocol--re-holdout-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "split",
          "exam",
          "rewrite"
        ]
      },
      {
        "id": "re-interview",
        "label": "一秒面试",
        "file": "routing-eval-protocol--re-interview.mp4",
        "endStill": "routing-eval-protocol--re-interview-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "sched"
        ]
      }
    ]
  },
  "script-craft": {
    "slug": "script-craft",
    "type": "workflow",
    "chapters": [
      {
        "id": "sc-pin",
        "label": "钉死版本",
        "file": "script-craft--sc-pin.mp4",
        "endStill": "script-craft--sc-pin-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "script",
          "upstream",
          "pin"
        ]
      },
      {
        "id": "sc-rules",
        "label": "四条家规",
        "file": "script-craft--sc-rules.mp4",
        "endStill": "script-craft--sc-rules-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.53,
        "beatNodes": [
          "r1",
          "r2",
          "r3",
          "r4",
          "deliver"
        ]
      }
    ]
  },
  "shadow-warning": {
    "slug": "shadow-warning",
    "chapters": [
      {
        "id": "sw-copy",
        "label": "复制自用",
        "file": "shadow-warning--sw-copy.mp4",
        "endStill": "shadow-warning--sw-copy-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.28,
        "beatNodes": [
          "s-live",
          "s-copy"
        ]
      },
      {
        "id": "sw-shadow",
        "label": "静默遮蔽",
        "file": "shadow-warning--sw-shadow.mp4",
        "endStill": "shadow-warning--sw-shadow-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "s-copy",
          "s-shadow"
        ]
      },
      {
        "id": "sw-warn",
        "label": "告警义务",
        "file": "shadow-warning--sw-warn.mp4",
        "endStill": "shadow-warning--sw-warn-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "s-shadow",
          "s-warn",
          "s-blind"
        ]
      }
    ]
  },
  "two-old-roads": {
    "slug": "two-old-roads",
    "type": "workflow",
    "chapters": [
      {
        "id": "or-two",
        "label": "两条老路",
        "file": "two-old-roads--or-two.mp4",
        "endStill": "two-old-roads--or-two-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "g1",
          "s1"
        ]
      },
      {
        "id": "or-guess",
        "label": "盲航",
        "file": "two-old-roads--or-guess.mp4",
        "endStill": "two-old-roads--or-guess-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "g1",
          "g2"
        ]
      },
      {
        "id": "or-stuff",
        "label": "超载",
        "file": "two-old-roads--or-stuff.mp4",
        "endStill": "two-old-roads--or-stuff-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "s1",
          "s2",
          "s3"
        ]
      },
      {
        "id": "or-ledger",
        "label": "一笔账",
        "file": "two-old-roads--or-ledger.mp4",
        "endStill": "two-old-roads--or-ledger-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "q",
          "g2",
          "s3"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
