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
  "ablation-panel": {
    "slug": "ablation-panel",
    "type": "architecture",
    "chapters": [
      {
        "id": "bench-open",
        "label": "实验台·五开关",
        "file": "ablation-panel--bench-open.mp4",
        "endStill": "ablation-panel--bench-open-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.65,
        "beatNodes": [
          "machine",
          "sw-guard",
          "sw-date",
          "sw-or",
          "sw-lock",
          "sw-heuristic"
        ]
      },
      {
        "id": "kill-thread",
        "label": "拆兜错·线程死",
        "file": "ablation-panel--kill-thread.mp4",
        "endStill": "ablation-panel--kill-thread-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "sw-guard"
        ]
      },
      {
        "id": "silent-miss",
        "label": "改且·静默漏",
        "file": "ablation-panel--silent-miss.mp4",
        "endStill": "ablation-panel--silent-miss-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "sw-or"
        ]
      },
      {
        "id": "burn-wait",
        "label": "拔兜底·干等六百秒",
        "file": "ablation-panel--burn-wait.mp4",
        "endStill": "ablation-panel--burn-wait-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "sw-heuristic"
        ]
      },
      {
        "id": "date-slip",
        "label": "拆记号·次日哑火",
        "file": "ablation-panel--date-slip.mp4",
        "endStill": "ablation-panel--date-slip-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "sw-date",
          "machine"
        ]
      },
      {
        "id": "timeout-crash",
        "label": "两处照写翻车",
        "file": "ablation-panel--timeout-crash.mp4",
        "endStill": "ablation-panel--timeout-crash-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.27,
        "beatNodes": [
          "sw-heuristic",
          "machine"
        ]
      }
    ]
  },
  "bg-tasks-loop": {
    "slug": "bg-tasks-loop",
    "type": "workflow",
    "chapters": [
      {
        "id": "gate-dispatch",
        "label": "双闸分派",
        "file": "bg-tasks-loop--gate-dispatch.mp4",
        "endStill": "bg-tasks-loop--gate-dispatch-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "model",
          "gate",
          "bg",
          "sync"
        ]
      },
      {
        "id": "placeholder-hand",
        "label": "占位回执三件事",
        "file": "bg-tasks-loop--placeholder-hand.mp4",
        "endStill": "bg-tasks-loop--placeholder-hand-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "gate",
          "bg",
          "placeholder",
          "cont"
        ]
      },
      {
        "id": "notify-merge",
        "label": "通知合流一条消息",
        "file": "bg-tasks-loop--notify-merge.mp4",
        "endStill": "bg-tasks-loop--notify-merge-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "bg",
          "collect",
          "read"
        ]
      },
      {
        "id": "two-round-script",
        "label": "两回合剧本",
        "file": "bg-tasks-loop--two-round-script.mp4",
        "endStill": "bg-tasks-loop--two-round-script-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.66,
        "beatNodes": [
          "gate",
          "bg",
          "placeholder",
          "cont",
          "collect",
          "read"
        ]
      }
    ]
  },
  "cron-dom-dow-or": {
    "slug": "cron-dom-dow-or",
    "type": "workflow",
    "chapters": [
      {
        "id": "five-fields",
        "label": "五段·分时日月星期",
        "file": "cron-dom-dow-or--five-fields.mp4",
        "endStill": "cron-dom-dow-or--five-fields-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.63,
        "beatNodes": [
          "expr-in",
          "f-min",
          "f-hour",
          "f-dom",
          "f-month",
          "f-dow"
        ]
      },
      {
        "id": "and-or",
        "label": "三段全中·这对任一",
        "file": "cron-dom-dow-or--and-or.mp4",
        "endStill": "cron-dom-dow-or--and-or-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "and-gate",
          "or-gate",
          "fire"
        ]
      },
      {
        "id": "both-ways",
        "label": "9·28 与每月一号都响",
        "file": "cron-dom-dow-or--both-ways.mp4",
        "endStill": "cron-dom-dow-or--both-ways-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "ex-928",
          "ex-month1",
          "or-gate"
        ]
      }
    ]
  },
  "cron-four-layers": {
    "slug": "cron-four-layers",
    "type": "workflow",
    "chapters": [
      {
        "id": "four-roles",
        "label": "四层各司其职",
        "file": "cron-four-layers--four-roles.mp4",
        "endStill": "cron-four-layers--four-roles-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.55,
        "beatNodes": [
          "ticker",
          "queue",
          "lock",
          "inject",
          "work"
        ]
      },
      {
        "id": "yield-loop",
        "label": "让行回环",
        "file": "cron-four-layers--yield-loop.mp4",
        "endStill": "cron-four-layers--yield-loop-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "lock",
          "queue"
        ]
      },
      {
        "id": "full-cycle",
        "label": "全周期走查",
        "file": "cron-four-layers--full-cycle.mp4",
        "endStill": "cron-four-layers--full-cycle-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.68,
        "beatNodes": [
          "disk",
          "ticker",
          "queue",
          "lock",
          "inject",
          "work"
        ]
      },
      {
        "id": "durable-side",
        "label": "存档旁挂",
        "file": "cron-four-layers--durable-side.mp4",
        "endStill": "cron-four-layers--durable-side-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "disk",
          "ticker"
        ]
      }
    ]
  },
  "disk-not-alive": {
    "slug": "disk-not-alive",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "two-lives",
        "label": "两档·内存与磁盘",
        "file": "disk-not-alive--two-lives.mp4",
        "endStill": "disk-not-alive--two-lives-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "register",
          "in-memory",
          "persist-file"
        ]
      },
      {
        "id": "shutdown",
        "label": "一关就停 vs 文件仍亮",
        "file": "disk-not-alive--shutdown.mp4",
        "endStill": "disk-not-alive--shutdown-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.37,
        "beatNodes": [
          "shutdown",
          "gone",
          "file-alive"
        ]
      },
      {
        "id": "restore",
        "label": "重启恢复·补一次",
        "file": "disk-not-alive--restore.mp4",
        "endStill": "disk-not-alive--restore-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "load-restore",
          "catch-up",
          "list-only",
          "exceptions-gone"
        ]
      },
      {
        "id": "escape-routes",
        "label": "无人值守三条路",
        "file": "disk-not-alive--escape-routes.mp4",
        "endStill": "disk-not-alive--escape-routes-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "persist-file",
          "load-restore"
        ]
      }
    ]
  },
  "dispatch-two-gates": {
    "slug": "dispatch-two-gates",
    "type": "workflow",
    "chapters": [
      {
        "id": "gate-one",
        "label": "第一道·拨杆",
        "file": "dispatch-two-gates--gate-one.mp4",
        "endStill": "dispatch-two-gates--gate-one-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "cmd-in",
          "gate-explicit",
          "bg-out"
        ]
      },
      {
        "id": "gate-two",
        "label": "第二道·筛网",
        "file": "dispatch-two-gates--gate-two.mp4",
        "endStill": "dispatch-two-gates--gate-two-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "gate-explicit",
          "gate-heuristic",
          "bg-out",
          "sync-out"
        ]
      },
      {
        "id": "false-slip",
        "label": "说不要也拦不住",
        "file": "dispatch-two-gates--false-slip.mp4",
        "endStill": "dispatch-two-gates--false-slip-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "note-false",
          "gate-heuristic",
          "bg-out"
        ]
      }
    ]
  },
  "knock-walk-away": {
    "slug": "knock-walk-away",
    "type": "sequence",
    "chapters": [
      {
        "id": "loop-wake",
        "label": "六行循环",
        "file": "knock-walk-away--loop-wake.mp4",
        "endStill": "knock-walk-away--loop-wake-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "pipeline",
          "queue"
        ]
      },
      {
        "id": "door-busy",
        "label": "敲门·有动静·走开",
        "file": "knock-walk-away--door-busy.mp4",
        "endStill": "knock-walk-away--door-busy-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.36,
        "beatNodes": [
          "pipeline",
          "lock",
          "queue"
        ]
      },
      {
        "id": "door-open",
        "label": "门开·再确认·执行",
        "file": "knock-walk-away--door-open.mp4",
        "endStill": "knock-walk-away--door-open-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "lock",
          "master"
        ]
      }
    ]
  },
  "one-call-one-receipt": {
    "slug": "one-call-one-receipt",
    "type": "sequence",
    "chapters": [
      {
        "id": "pair-rule",
        "label": "一次调用一个结果",
        "file": "one-call-one-receipt--pair-rule.mp4",
        "endStill": "one-call-one-receipt--pair-rule-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "shifu",
          "mainloop",
          "slot"
        ]
      },
      {
        "id": "reject-second",
        "label": "补发被弹开",
        "file": "one-call-one-receipt--reject-second.mp4",
        "endStill": "one-call-one-receipt--reject-second-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "shifu",
          "slot"
        ]
      },
      {
        "id": "notify-new-msg",
        "label": "真结果走新消息",
        "file": "one-call-one-receipt--notify-new-msg.mp4",
        "endStill": "one-call-one-receipt--notify-new-msg-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "pipeline",
          "mainloop",
          "shifu"
        ]
      }
    ]
  },
  "recon-verdicts": {
    "slug": "recon-verdicts",
    "type": "dataflow",
    "chapters": [
      {
        "id": "green-list",
        "label": "获印证",
        "file": "recon-verdicts--green-list.mp4",
        "endStill": "recon-verdicts--green-list-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "teach-src",
          "recon",
          "verdict-green"
        ]
      },
      {
        "id": "red-jitter",
        "label": "硬分歧·抖动",
        "file": "recon-verdicts--red-jitter.mp4",
        "endStill": "recon-verdicts--red-jitter-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "verdict-red"
        ]
      },
      {
        "id": "gray-extra",
        "label": "教学没讲的三条路",
        "file": "recon-verdicts--gray-extra.mp4",
        "endStill": "recon-verdicts--gray-extra-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "verdict-gray",
          "apprentice"
        ]
      }
    ]
  },
  "spec-two-promises": {
    "slug": "spec-two-promises",
    "type": "architecture",
    "chapters": [
      {
        "id": "spec-one",
        "label": "规格一·异步回来",
        "file": "spec-two-promises--spec-one.mp4",
        "endStill": "spec-two-promises--spec-one-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "sink",
          "receipt",
          "bell"
        ]
      },
      {
        "id": "spec-two",
        "label": "规格二·定时解耦",
        "file": "spec-two-promises--spec-two.mp4",
        "endStill": "spec-two-promises--spec-two-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "clock",
          "ledger",
          "lock"
        ]
      },
      {
        "id": "two-devices",
        "label": "两台装置登场",
        "file": "spec-two-promises--two-devices.mp4",
        "endStill": "spec-two-promises--two-devices-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "sink",
          "clock"
        ]
      },
      {
        "id": "map-back",
        "label": "全片地图",
        "file": "spec-two-promises--map-back.mp4",
        "endStill": "spec-two-promises--map-back-end.png",
        "beats": 7,
        "leadSec": 0.44,
        "storySec": 7.75,
        "beatNodes": [
          "belt",
          "sink",
          "receipt",
          "bell",
          "clock",
          "ledger",
          "lock"
        ]
      }
    ]
  },
  "three-safeguards": {
    "slug": "three-safeguards",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "mark-date",
        "label": "保险一·带日期记号",
        "file": "three-safeguards--mark-date.mp4",
        "endStill": "three-safeguards--mark-date-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "dated-mark",
          "fire"
        ]
      },
      {
        "id": "per-task-guard",
        "label": "保险二·单任务兜错",
        "file": "three-safeguards--per-task-guard.mp4",
        "endStill": "three-safeguards--per-task-guard-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "guard-error",
          "tick"
        ]
      },
      {
        "id": "double-check",
        "label": "保险三·双重校验",
        "file": "three-safeguards--double-check.mp4",
        "endStill": "three-safeguards--double-check-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "reject-invalid",
          "skip-bad-save"
        ]
      }
    ]
  },
  "two-round-script": {
    "slug": "two-round-script",
    "type": "sequence",
    "chapters": [
      {
        "id": "turn-one",
        "label": "第一回合·占位",
        "file": "two-round-script--turn-one.mp4",
        "endStill": "two-round-script--turn-one-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "shifu",
          "mainloop",
          "pipeline"
        ]
      },
      {
        "id": "turn-two",
        "label": "第二回合·同框",
        "file": "two-round-script--turn-two.mp4",
        "endStill": "two-round-script--turn-two-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.47,
        "beatNodes": [
          "shifu",
          "mainloop",
          "pipeline",
          "config"
        ]
      },
      {
        "id": "zero-wait",
        "label": "零干等",
        "file": "two-round-script--zero-wait.mp4",
        "endStill": "two-round-script--zero-wait-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "shifu",
          "pipeline",
          "config"
        ]
      }
    ]
  },
  "two-waiting-deaths": {
    "slug": "two-waiting-deaths",
    "type": "workflow",
    "chapters": [
      {
        "id": "belt-anatomy",
        "label": "传送带一问一答",
        "file": "two-waiting-deaths--belt-anatomy.mp4",
        "endStill": "two-waiting-deaths--belt-anatomy-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.39,
        "beatNodes": [
          "ask",
          "belt-core",
          "fast-cmd"
        ]
      },
      {
        "id": "slow-death",
        "label": "慢活堵路",
        "file": "two-waiting-deaths--slow-death.mp4",
        "endStill": "two-waiting-deaths--slow-death-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.58,
        "beatNodes": [
          "belt-core",
          "slow-cmd",
          "stall",
          "idle",
          "billing"
        ]
      },
      {
        "id": "manual-death",
        "label": "到点没人推",
        "file": "two-waiting-deaths--manual-death.mp4",
        "endStill": "two-waiting-deaths--manual-death-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "manual",
          "calendar",
          "no-push"
        ]
      },
      {
        "id": "one-root",
        "label": "一个病根两种表现",
        "file": "two-waiting-deaths--one-root.mp4",
        "endStill": "two-waiting-deaths--one-root-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "stall",
          "no-push",
          "belt-core"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
