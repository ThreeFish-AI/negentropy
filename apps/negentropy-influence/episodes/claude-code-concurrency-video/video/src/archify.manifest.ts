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
  "apprentice-watch": {
    "slug": "apprentice-watch",
    "type": "workflow",
    "chapters": [
      {
        "id": "teach-zero",
        "label": "教学版零落地",
        "file": "apprentice-watch--teach-zero.mp4",
        "endStill": "apprentice-watch--teach-zero-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "teach-page",
          "empty"
        ]
      },
      {
        "id": "watch-only",
        "label": "只看不动手",
        "file": "apprentice-watch--watch-only.mp4",
        "endStill": "apprentice-watch--watch-only-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "apprentice",
          "sink-row"
        ]
      },
      {
        "id": "growth-not-age",
        "label": "增量非时长",
        "file": "apprentice-watch--growth-not-age.mp4",
        "endStill": "apprentice-watch--growth-not-age-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "output-meter",
          "clock-x"
        ]
      },
      {
        "id": "forty-five-sec",
        "label": "四十五秒凑近",
        "file": "apprentice-watch--forty-five-sec.mp4",
        "endStill": "apprentice-watch--forty-five-sec-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "output-meter",
          "threshold-45"
        ]
      },
      {
        "id": "yn-sniff",
        "label": "停在问话上",
        "file": "apprentice-watch--yn-sniff.mp4",
        "endStill": "apprentice-watch--yn-sniff-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "prompt-yn",
          "wait-key"
        ]
      },
      {
        "id": "side-model-slip",
        "label": "小模型写字条",
        "file": "apprentice-watch--side-model-slip.mp4",
        "endStill": "apprentice-watch--side-model-slip-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "slip",
          "side-model",
          "main-stream"
        ]
      },
      {
        "id": "official-monitor",
        "label": "官方监视工具",
        "file": "apprentice-watch--official-monitor.mp4",
        "endStill": "apprentice-watch--official-monitor-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "monitor-tool",
          "stream-rows",
          "timeout-collect"
        ]
      }
    ]
  },
  "bg-board-and-lock": {
    "slug": "bg-board-and-lock",
    "type": "architecture",
    "chapters": [
      {
        "id": "registry-board",
        "label": "登记板三栏",
        "file": "bg-board-and-lock--registry-board.mp4",
        "endStill": "bg-board-and-lock--registry-board-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "registry",
          "id-col",
          "cmd-col",
          "status-col"
        ]
      },
      {
        "id": "daemon-thread",
        "label": "独立线程",
        "file": "bg-board-and-lock--daemon-thread.mp4",
        "endStill": "bg-board-and-lock--daemon-thread-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "worker-thread",
          "registry",
          "belt-core"
        ]
      },
      {
        "id": "lock-critical",
        "label": "一把锁",
        "file": "bg-board-and-lock--lock-critical.mp4",
        "endStill": "bg-board-and-lock--lock-critical-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.34,
        "beatNodes": [
          "lock",
          "master-side",
          "sink-side"
        ]
      },
      {
        "id": "lock-before-write",
        "label": "先立锁再动手",
        "file": "bg-board-and-lock--lock-before-write.mp4",
        "endStill": "bg-board-and-lock--lock-before-write-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "lock",
          "registry"
        ]
      }
    ]
  },
  "bg-placeholder-receipt": {
    "slug": "bg-placeholder-receipt",
    "type": "sequence",
    "chapters": [
      {
        "id": "sink-in-trade",
        "label": "活进槽换什么",
        "file": "bg-placeholder-receipt--sink-in-trade.mp4",
        "endStill": "bg-placeholder-receipt--sink-in-trade-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "master",
          "sink",
          "return-lane"
        ]
      },
      {
        "id": "ticket-first",
        "label": "号牌当场返回",
        "file": "bg-placeholder-receipt--ticket-first.mp4",
        "endStill": "bg-placeholder-receipt--ticket-first-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "sink",
          "ticket",
          "master"
        ]
      },
      {
        "id": "belt-unpaused",
        "label": "带一拍不停",
        "file": "bg-placeholder-receipt--belt-unpaused.mp4",
        "endStill": "bg-placeholder-receipt--belt-unpaused-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "belt-core",
          "sink"
        ]
      },
      {
        "id": "four-digit-id",
        "label": "四位编号",
        "file": "bg-placeholder-receipt--four-digit-id.mp4",
        "endStill": "bg-placeholder-receipt--four-digit-id-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "ticket",
          "bg-id-0001"
        ]
      }
    ]
  },
  "bg-two-verdicts": {
    "slug": "bg-two-verdicts",
    "type": "workflow",
    "chapters": [
      {
        "id": "two-roads",
        "label": "判定分两级",
        "file": "bg-two-verdicts--two-roads.mp4",
        "endStill": "bg-two-verdicts--two-roads-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "verdict-node",
          "sync-lane",
          "bg-lane"
        ]
      },
      {
        "id": "explicit-switch",
        "label": "主路显式开关",
        "file": "bg-two-verdicts--explicit-switch.mp4",
        "endStill": "bg-two-verdicts--explicit-switch-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "checkbox-on",
          "bg-lane"
        ]
      },
      {
        "id": "keyword-fallback",
        "label": "关键词兜底",
        "file": "bg-two-verdicts--keyword-fallback.mp4",
        "endStill": "bg-two-verdicts--keyword-fallback-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "keyword-scan",
          "slow-guess",
          "bg-lane"
        ]
      },
      {
        "id": "primary-vs-fallback",
        "label": "主次定死",
        "file": "bg-two-verdicts--primary-vs-fallback.mp4",
        "endStill": "bg-two-verdicts--primary-vs-fallback-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "verdict-node",
          "checkbox-on",
          "keyword-scan"
        ]
      }
    ]
  },
  "clock-bad-jobs": {
    "slug": "clock-bad-jobs",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "validate-first",
        "label": "注册先验表",
        "file": "clock-bad-jobs--validate-first.mp4",
        "endStill": "clock-bad-jobs--validate-first-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "validate",
          "reject"
        ]
      },
      {
        "id": "quarantine-bad",
        "label": "单独兜住",
        "file": "clock-bad-jobs--quarantine-bad.mp4",
        "endStill": "clock-bad-jobs--quarantine-bad-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "runtime-error",
          "quarantine",
          "wall-clock"
        ]
      },
      {
        "id": "fire-and-delete",
        "label": "响完即删",
        "file": "clock-bad-jobs--fire-and-delete.mp4",
        "endStill": "clock-bad-jobs--fire-and-delete-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "one-shot",
          "delete",
          "recurring"
        ]
      }
    ]
  },
  "clock-dedupe": {
    "slug": "clock-dedupe",
    "type": "dataflow",
    "chapters": [
      {
        "id": "sixty-glances",
        "label": "六十来次表",
        "file": "clock-dedupe--sixty-glances.mp4",
        "endStill": "clock-dedupe--sixty-glances-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "second-hand",
          "minute-cell",
          "repeat-fire"
        ]
      },
      {
        "id": "date-plus-minute",
        "label": "日期加时分",
        "file": "clock-dedupe--date-plus-minute.mp4",
        "endStill": "clock-dedupe--date-plus-minute-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "minute-marker",
          "date-field",
          "time-field"
        ]
      },
      {
        "id": "hhmm-trap",
        "label": "只记时分的错",
        "file": "clock-dedupe--hhmm-trap.mp4",
        "endStill": "clock-dedupe--hhmm-trap-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "minute-marker",
          "next-day-miss"
        ]
      },
      {
        "id": "one-key-two-errors",
        "label": "一键挡两错",
        "file": "clock-dedupe--one-key-two-errors.mp4",
        "endStill": "clock-dedupe--one-key-two-errors-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "minute-marker",
          "repeat-fire",
          "next-day-miss"
        ]
      }
    ]
  },
  "clock-four-layers": {
    "slug": "clock-four-layers",
    "type": "architecture",
    "chapters": [
      {
        "id": "clock-blind",
        "label": "钟不认识师傅",
        "file": "clock-four-layers--clock-blind.mp4",
        "endStill": "clock-four-layers--clock-blind-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.37,
        "beatNodes": [
          "wall-clock",
          "master-silhouette",
          "back-to-back"
        ]
      },
      {
        "id": "four-roles",
        "label": "四层各一事",
        "file": "clock-four-layers--four-roles.mp4",
        "endStill": "clock-four-layers--four-roles-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "layer-clock",
          "layer-slot",
          "layer-sentry",
          "layer-belt"
        ]
      },
      {
        "id": "tick-keeper",
        "label": "第一层判时",
        "file": "clock-four-layers--tick-keeper.mp4",
        "endStill": "clock-four-layers--tick-keeper-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "wall-clock",
          "layer-clock"
        ]
      },
      {
        "id": "slot-keeper",
        "label": "第二层存条",
        "file": "clock-four-layers--slot-keeper.mp4",
        "endStill": "clock-four-layers--slot-keeper-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "entry-slot",
          "layer-slot"
        ]
      },
      {
        "id": "lock-is-state",
        "label": "锁即状态",
        "file": "clock-four-layers--lock-is-state.mp4",
        "endStill": "clock-four-layers--lock-is-state-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "layer-sentry",
          "agent-lock"
        ]
      },
      {
        "id": "same-stream",
        "label": "同一条流",
        "file": "clock-four-layers--same-stream.mp4",
        "endStill": "clock-four-layers--same-stream-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "layer-belt",
          "messages-stream"
        ]
      }
    ]
  },
  "durable-lifecycle": {
    "slug": "durable-lifecycle",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "alarm-not-fires",
        "label": "存的是闹钟",
        "file": "durable-lifecycle--alarm-not-fires.mp4",
        "endStill": "durable-lifecycle--alarm-not-fires-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "disk-file",
          "alarm-def",
          "missed-fires-x"
        ]
      },
      {
        "id": "definition-on-disk",
        "label": "盘上只有定义",
        "file": "durable-lifecycle--definition-on-disk.mp4",
        "endStill": "durable-lifecycle--definition-on-disk-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "disk-file",
          "time-field",
          "action-field"
        ]
      },
      {
        "id": "restart-from-now",
        "label": "从当下看起",
        "file": "durable-lifecycle--restart-from-now.mp4",
        "endStill": "durable-lifecycle--restart-from-now-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "restart",
          "clock-remount",
          "missed-grey"
        ]
      },
      {
        "id": "boundary-verbatim",
        "label": "边界原话",
        "file": "durable-lifecycle--boundary-verbatim.mp4",
        "endStill": "durable-lifecycle--boundary-verbatim-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "quote-card",
          "system-cron"
        ]
      },
      {
        "id": "no-catchup",
        "label": "不按次数补",
        "file": "durable-lifecycle--no-catchup.mp4",
        "endStill": "durable-lifecycle--no-catchup-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "idle-catchup-once",
          "missed-grey"
        ]
      }
    ]
  },
  "notify-merge": {
    "slug": "notify-merge",
    "type": "dataflow",
    "chapters": [
      {
        "id": "delivery-when",
        "label": "何时送到",
        "file": "notify-merge--delivery-when.mp4",
        "endStill": "notify-merge--delivery-when-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "call-board",
          "master"
        ]
      },
      {
        "id": "ride-along",
        "label": "搭顺风车",
        "file": "notify-merge--ride-along.mp4",
        "endStill": "notify-merge--ride-along-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.32,
        "beatNodes": [
          "notification-slip",
          "tool-result",
          "merge-node"
        ]
      },
      {
        "id": "passive-board",
        "label": "等人路过",
        "file": "notify-merge--passive-board.mp4",
        "endStill": "notify-merge--passive-board-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "call-board",
          "tag"
        ]
      },
      {
        "id": "next-lap-glance",
        "label": "下趟看见",
        "file": "notify-merge--next-lap-glance.mp4",
        "endStill": "notify-merge--next-lap-glance-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "master",
          "call-board",
          "tag"
        ]
      },
      {
        "id": "closing-loss",
        "label": "打烊即永失",
        "file": "notify-merge--closing-loss.mp4",
        "endStill": "notify-merge--closing-loss-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.27,
        "beatNodes": [
          "call-board",
          "dim-fade"
        ]
      }
    ]
  },
  "notify-protocol": {
    "slug": "notify-protocol",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "hang-the-tag",
        "label": "只挂牌不拍肩",
        "file": "notify-protocol--hang-the-tag.mp4",
        "endStill": "notify-protocol--hang-the-tag-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.37,
        "beatNodes": [
          "sink",
          "call-board",
          "tag"
        ]
      },
      {
        "id": "one-to-one",
        "label": "一问一答",
        "file": "notify-protocol--one-to-one.mp4",
        "endStill": "notify-protocol--one-to-one-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "tool-use",
          "tool-result"
        ]
      },
      {
        "id": "receipt-spent",
        "label": "回执已交过",
        "file": "notify-protocol--receipt-spent.mp4",
        "endStill": "notify-protocol--receipt-spent-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "tool-result",
          "ticket"
        ]
      },
      {
        "id": "no-second-receipt",
        "label": "不能补发",
        "file": "notify-protocol--no-second-receipt.mp4",
        "endStill": "notify-protocol--no-second-receipt-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "tool-use",
          "x-mark"
        ]
      },
      {
        "id": "own-doorway",
        "label": "另立门户",
        "file": "notify-protocol--own-doorway.mp4",
        "endStill": "notify-protocol--own-doorway-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "task-notification",
          "call-board"
        ]
      }
    ]
  },
  "schedule-three-tiers": {
    "slug": "schedule-three-tiers",
    "type": "architecture",
    "chapters": [
      {
        "id": "three-tiers",
        "label": "三档阶梯",
        "file": "schedule-three-tiers--three-tiers.mp4",
        "endStill": "schedule-three-tiers--three-tiers-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "tier-loop",
          "tier-desktop",
          "tier-cloud"
        ]
      },
      {
        "id": "session-loop",
        "label": "会话内最快",
        "file": "schedule-three-tiers--session-loop.mp4",
        "endStill": "schedule-three-tiers--session-loop-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.24,
        "beatNodes": [
          "tier-loop",
          "loop-cmd"
        ]
      },
      {
        "id": "desktop-tier",
        "label": "桌面档",
        "file": "schedule-three-tiers--desktop-tier.mp4",
        "endStill": "schedule-three-tiers--desktop-tier-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "tier-desktop",
          "min-1min",
          "survive-restart"
        ]
      },
      {
        "id": "cloud-tier",
        "label": "云端档",
        "file": "schedule-three-tiers--cloud-tier.mp4",
        "endStill": "schedule-three-tiers--cloud-tier-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "tier-cloud",
          "no-session"
        ]
      },
      {
        "id": "same-edge-two-ways",
        "label": "同界两走法",
        "file": "schedule-three-tiers--same-edge-two-ways.mp4",
        "endStill": "schedule-three-tiers--same-edge-two-ways-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.42,
        "beatNodes": [
          "boundary-line",
          "tier-loop",
          "tier-desktop",
          "tier-cloud"
        ]
      }
    ]
  },
  "timing-panorama": {
    "slug": "timing-panorama",
    "type": "architecture",
    "chapters": [
      {
        "id": "two-kinds-of-time",
        "label": "两种时间（预告）",
        "file": "timing-panorama--two-kinds-of-time.mp4",
        "endStill": "timing-panorama--two-kinds-of-time-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "belt-core",
          "slow-lane",
          "due-lane"
        ]
      },
      {
        "id": "two-devices-lit",
        "label": "两装置点亮",
        "file": "timing-panorama--two-devices-lit.mp4",
        "endStill": "timing-panorama--two-devices-lit-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "bg-branch",
          "clock-branch"
        ]
      },
      {
        "id": "panorama-live",
        "label": "全景在动带仍一条",
        "file": "timing-panorama--panorama-live.mp4",
        "endStill": "timing-panorama--panorama-live-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "bg-branch",
          "notify-lane",
          "clock-branch",
          "belt-core"
        ]
      },
      {
        "id": "serial-trays",
        "label": "托盘串行",
        "file": "timing-panorama--serial-trays.mp4",
        "endStill": "timing-panorama--serial-trays-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "tray-queue",
          "belt-core"
        ]
      },
      {
        "id": "threads-not-tools",
        "label": "线程不执行工具",
        "file": "timing-panorama--threads-not-tools.mp4",
        "endStill": "timing-panorama--threads-not-tools-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "worker-thread",
          "scheduler-thread",
          "delivery-thread"
        ]
      },
      {
        "id": "one-belt-close",
        "label": "一条带收束",
        "file": "timing-panorama--one-belt-close.mp4",
        "endStill": "timing-panorama--one-belt-close-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "belt-core",
          "bg-branch",
          "clock-branch"
        ]
      },
      {
        "id": "where-waiting-goes",
        "label": "等待放哪里",
        "file": "timing-panorama--where-waiting-goes.mp4",
        "endStill": "timing-panorama--where-waiting-goes-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "wait-handoff",
          "start-trigger",
          "belt-core"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
