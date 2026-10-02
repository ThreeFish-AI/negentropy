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
  "pc2-ablation-bar": {
    "slug": "pc2-ablation-bar",
    "type": "dataflow",
    "chapters": [
      {
        "id": "ablation-scale",
        "label": "两种口径",
        "file": "pc2-ablation-bar--ablation-scale.mp4",
        "endStill": "pc2-ablation-bar--ablation-scale-end.png",
        "beats": 2,
        "leadSec": 0.52,
        "storySec": 11.05,
        "beatNodes": [
          "m-nums",
          "e-nums"
        ]
      },
      {
        "id": "ablation-ruling",
        "label": "分开看",
        "file": "pc2-ablation-bar--ablation-ruling.mp4",
        "endStill": "pc2-ablation-bar--ablation-ruling-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 8.68,
        "beatNodes": [
          "rule-direct",
          "rule-attr"
        ]
      }
    ]
  },
  "pc2-backoff-scale": {
    "slug": "pc2-backoff-scale",
    "type": "dataflow",
    "chapters": [
      {
        "id": "backoff-seq",
        "label": "三连等",
        "file": "pc2-backoff-scale--backoff-seq.mp4",
        "endStill": "pc2-backoff-scale--backoff-seq-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.5,
        "beatNodes": [
          "wait-1",
          "wait-2",
          "wait-3",
          "model-switch"
        ]
      },
      {
        "id": "backoff-jitter",
        "label": "加一点抖动",
        "file": "pc2-backoff-scale--backoff-jitter.mp4",
        "endStill": "pc2-backoff-scale--backoff-jitter-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 21.98,
        "beatNodes": [
          "jitter"
        ]
      }
    ]
  },
  "pc2-failures": {
    "slug": "pc2-failures",
    "type": "workflow",
    "chapters": [
      {
        "id": "fail-plan",
        "label": "长任务丢计划",
        "file": "pc2-failures--fail-plan.mp4",
        "endStill": "pc2-failures--fail-plan-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.37,
        "beatNodes": [
          "task",
          "msgs",
          "f1"
        ]
      },
      {
        "id": "fail-flood",
        "label": "过程淹没主线",
        "file": "pc2-failures--fail-flood.mp4",
        "endStill": "pc2-failures--fail-flood-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "toolres",
          "f2"
        ]
      },
      {
        "id": "fail-carry",
        "label": "知识全带太贵",
        "file": "pc2-failures--fail-carry.mp4",
        "endStill": "pc2-failures--fail-carry-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.27,
        "beatNodes": [
          "pack",
          "f3"
        ]
      },
      {
        "id": "fail-clash",
        "label": "指令堆积打架",
        "file": "pc2-failures--fail-clash.mp4",
        "endStill": "pc2-failures--fail-clash-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 29.97,
        "beatNodes": [
          "pack",
          "f4"
        ]
      },
      {
        "id": "fail-crash",
        "label": "故障即崩",
        "file": "pc2-failures--fail-crash.mp4",
        "endStill": "pc2-failures--fail-crash-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 20.99,
        "beatNodes": [
          "call",
          "f5"
        ]
      }
    ]
  },
  "pc2-panorama": {
    "slug": "pc2-panorama",
    "type": "workflow",
    "chapters": [
      {
        "id": "pan-loop",
        "label": "全景总览 · 循环四步",
        "file": "pc2-panorama--pan-loop.mp4",
        "endStill": "pc2-panorama--pan-loop-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 8.51,
        "beatNodes": [
          "u",
          "l0",
          "l1",
          "l2",
          "l3"
        ]
      },
      {
        "id": "pan-m1",
        "label": "挂点① 唠叨计数器",
        "file": "pc2-panorama--pan-m1.mp4",
        "endStill": "pc2-panorama--pan-m1-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "l0",
          "m1"
        ]
      },
      {
        "id": "pan-m2",
        "label": "挂点② 副台派单",
        "file": "pc2-panorama--pan-m2.mp4",
        "endStill": "pc2-panorama--pan-m2-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.31,
        "beatNodes": [
          "l2",
          "sub"
        ]
      },
      {
        "id": "pan-m3",
        "label": "挂点③ 技能进场",
        "file": "pc2-panorama--pan-m3.mp4",
        "endStill": "pc2-panorama--pan-m3-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.27,
        "beatNodes": [
          "l3",
          "m3"
        ]
      },
      {
        "id": "pan-m4",
        "label": "挂点④ 指令组装",
        "file": "pc2-panorama--pan-m4.mp4",
        "endStill": "pc2-panorama--pan-m4-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "m4",
          "l1"
        ]
      }
    ]
  },
  "pc2-prompt-cache": {
    "slug": "pc2-prompt-cache",
    "type": "dataflow",
    "chapters": [
      {
        "id": "cache-hit",
        "label": "状态没变就复用",
        "file": "pc2-prompt-cache--cache-hit.mp4",
        "endStill": "pc2-prompt-cache--cache-hit-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "assemble",
          "cache",
          "prompt",
          "memfile"
        ]
      },
      {
        "id": "cache-fingerprint",
        "label": "拼串做键",
        "file": "pc2-prompt-cache--cache-fingerprint.mp4",
        "endStill": "pc2-prompt-cache--cache-fingerprint-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.83,
        "beatNodes": [
          "statedict",
          "key",
          "tools",
          "cwd",
          "memfile"
        ]
      },
      {
        "id": "cache-dirty",
        "label": "键被污染",
        "file": "pc2-prompt-cache--cache-dirty.mp4",
        "endStill": "pc2-prompt-cache--cache-dirty-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 14.7,
        "beatNodes": [
          "dirty",
          "key",
          "cache"
        ]
      }
    ]
  },
  "pc2-prompt-shelf": {
    "slug": "pc2-prompt-shelf",
    "type": "workflow",
    "chapters": [
      {
        "id": "shelf-sections",
        "label": "四段货架",
        "file": "pc2-prompt-shelf--shelf-sections.mp4",
        "endStill": "pc2-prompt-shelf--shelf-sections-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 6.4,
        "beatNodes": [
          "seg-id",
          "seg-tools",
          "seg-ws",
          "seg-mem"
        ]
      },
      {
        "id": "shelf-state",
        "label": "只认真实状态",
        "file": "pc2-prompt-shelf--shelf-state.mp4",
        "endStill": "pc2-prompt-shelf--shelf-state-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.52,
        "beatNodes": [
          "registry",
          "cwd",
          "memfile",
          "statedict"
        ]
      },
      {
        "id": "shelf-split",
        "label": "各段独立",
        "file": "pc2-prompt-shelf--shelf-split.mp4",
        "endStill": "pc2-prompt-shelf--shelf-split-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.52,
        "beatNodes": [
          "seg-id",
          "seg-tools"
        ]
      }
    ]
  },
  "pc2-recovery-ledger": {
    "slug": "pc2-recovery-ledger",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "ledger-book",
        "label": "五项记账",
        "file": "pc2-recovery-ledger--ledger-book.mp4",
        "endStill": "pc2-recovery-ledger--ledger-book-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 9.23,
        "beatNodes": [
          "led-upgrade",
          "led-continue",
          "led-compact",
          "led-overload",
          "led-model"
        ]
      },
      {
        "id": "ledger-ablation",
        "label": "拆掉记账",
        "file": "pc2-recovery-ledger--ledger-ablation.mp4",
        "endStill": "pc2-recovery-ledger--ledger-ablation-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 4.17,
        "beatNodes": [
          "led-compact",
          "exit-grace",
          "runaway"
        ]
      },
      {
        "id": "ledger-ruling",
        "label": "不记账会吃掉病人",
        "file": "pc2-recovery-ledger--ledger-ruling.mp4",
        "endStill": "pc2-recovery-ledger--ledger-ruling-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 13.4,
        "beatNodes": [
          "overlong",
          "runaway"
        ]
      }
    ]
  },
  "pc2-rules": {
    "slug": "pc2-rules",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "rule-position",
        "label": "注入位置定生命周期",
        "file": "pc2-rules--rule-position.mp4",
        "endStill": "pc2-rules--rule-position-end.png",
        "beats": 4,
        "leadSec": 0.48,
        "storySec": 19.68,
        "beatNodes": [
          "pos-system",
          "pos-history",
          "pos-sub",
          "assemble"
        ]
      },
      {
        "id": "rule-state",
        "label": "判定只认真实状态",
        "file": "pc2-rules--rule-state.mp4",
        "endStill": "pc2-rules--rule-state-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.5,
        "beatNodes": [
          "sig-counter",
          "sig-file",
          "sig-error",
          "loop-start"
        ]
      },
      {
        "id": "rule-lossy",
        "label": "隔离是有损压缩",
        "file": "pc2-rules--rule-lossy.mp4",
        "endStill": "pc2-rules--rule-lossy-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 21.83,
        "beatNodes": [
          "dispatch",
          "pos-sub",
          "pos-history"
        ]
      },
      {
        "id": "rule-ledger",
        "label": "恢复必须记账",
        "file": "pc2-rules--rule-ledger.mp4",
        "endStill": "pc2-rules--rule-ledger-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.54,
        "beatNodes": [
          "sig-error",
          "led-spend",
          "led-retry",
          "led-out",
          "led-broken"
        ]
      },
      {
        "id": "rule-structure",
        "label": "结构防线优于嘱咐",
        "file": "pc2-rules--rule-structure.mp4",
        "endStill": "pc2-rules--rule-structure-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.53,
        "beatNodes": [
          "struct-tool",
          "struct-word",
          "dispatch"
        ]
      }
    ]
  },
  "pc2-skill-cost": {
    "slug": "pc2-skill-cost",
    "type": "dataflow",
    "chapters": [
      {
        "id": "cost-ablation",
        "label": "一百二十八 → 五千九百八十一",
        "file": "pc2-skill-cost--cost-ablation.mp4",
        "endStill": "pc2-skill-cost--cost-ablation-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "catalog",
          "ablation"
        ]
      },
      {
        "id": "cost-ruling",
        "label": "常驻的只能是索引",
        "file": "pc2-skill-cost--cost-ruling.mp4",
        "endStill": "pc2-skill-cost--cost-ruling-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "catalog",
          "fulltext"
        ]
      }
    ]
  },
  "pc2-skill-levels": {
    "slug": "pc2-skill-levels",
    "type": "architecture",
    "chapters": [
      {
        "id": "levels-two",
        "label": "两级结构",
        "file": "pc2-skill-levels--levels-two.mp4",
        "endStill": "pc2-skill-levels--levels-two-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 4.58,
        "beatNodes": [
          "catalog",
          "loader",
          "manual"
        ]
      },
      {
        "id": "levels-cost",
        "label": "两级成本",
        "file": "pc2-skill-levels--levels-cost.mp4",
        "endStill": "pc2-skill-levels--levels-cost-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "catalog",
          "manual"
        ]
      },
      {
        "id": "levels-lifecycle",
        "label": "两种命运",
        "file": "pc2-skill-levels--levels-lifecycle.mp4",
        "endStill": "pc2-skill-levels--levels-lifecycle-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 12.75,
        "beatNodes": [
          "catalog",
          "history"
        ]
      }
    ]
  },
  "pc2-sub-guard": {
    "slug": "pc2-sub-guard",
    "type": "architecture",
    "chapters": [
      {
        "id": "guard-three",
        "label": "隔离三不",
        "file": "pc2-sub-guard--guard-three.mp4",
        "endStill": "pc2-sub-guard--guard-three-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 12.98,
        "beatNodes": [
          "sub",
          "hook",
          "fs"
        ]
      },
      {
        "id": "guard-notask",
        "label": "工具表无 task",
        "file": "pc2-sub-guard--guard-notask.mp4",
        "endStill": "pc2-sub-guard--guard-notask-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 5.65,
        "beatNodes": [
          "tools"
        ]
      },
      {
        "id": "guard-fallback",
        "label": "三十轮上限",
        "file": "pc2-sub-guard--guard-fallback.mp4",
        "endStill": "pc2-sub-guard--guard-fallback-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "cap",
          "pick"
        ]
      }
    ]
  },
  "pc2-sub-lanes": {
    "slug": "pc2-sub-lanes",
    "type": "sequence",
    "chapters": [
      {
        "id": "lanes-walk",
        "label": "两轮调查",
        "file": "pc2-sub-lanes--lanes-walk.mp4",
        "endStill": "pc2-sub-lanes--lanes-walk-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.9,
        "beatNodes": [
          "main",
          "sub",
          "hook",
          "fs"
        ]
      },
      {
        "id": "lanes-receipt",
        "label": "一句结论回主线",
        "file": "pc2-sub-lanes--lanes-receipt.mp4",
        "endStill": "pc2-sub-lanes--lanes-receipt-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 24.04,
        "beatNodes": [
          "sub",
          "main",
          "stream"
        ]
      },
      {
        "id": "lanes-contrast",
        "label": "不隔离的代价",
        "file": "pc2-sub-lanes--lanes-contrast.mp4",
        "endStill": "pc2-sub-lanes--lanes-contrast-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "sub",
          "fs",
          "stream"
        ]
      }
    ]
  },
  "pc2-todo-nag": {
    "slug": "pc2-todo-nag",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "nag-device",
        "label": "三态工序卡",
        "file": "pc2-todo-nag--nag-device.mp4",
        "endStill": "pc2-todo-nag--nag-device-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "td-pending",
          "td-progress",
          "td-done"
        ]
      },
      {
        "id": "nag-count",
        "label": "计数器爬格",
        "file": "pc2-todo-nag--nag-count.mp4",
        "endStill": "pc2-todo-nag--nag-count-end.png",
        "beats": 4,
        "leadSec": 0.48,
        "storySec": 11.3,
        "beatNodes": [
          "ct-clear",
          "ct-1",
          "ct-2",
          "ct-3"
        ]
      },
      {
        "id": "nag-fire",
        "label": "满三注入",
        "file": "pc2-todo-nag--nag-fire.mp4",
        "endStill": "pc2-todo-nag--nag-fire-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "ct-3",
          "rm-msg",
          "ct-clear"
        ]
      },
      {
        "id": "nag-ablate",
        "label": "拆掉清零",
        "file": "pc2-todo-nag--nag-ablate.mp4",
        "endStill": "pc2-todo-nag--nag-ablate-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.41,
        "beatNodes": [
          "td-done",
          "ab-keep",
          "ab-drop"
        ]
      }
    ]
  },
  "pc2-triage-map": {
    "slug": "pc2-triage-map",
    "type": "workflow",
    "chapters": [
      {
        "id": "triage-mount",
        "label": "包住调用步",
        "file": "pc2-triage-map--triage-mount.mp4",
        "endStill": "pc2-triage-map--triage-mount-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 16.87,
        "beatNodes": [
          "call",
          "gate",
          "ledger"
        ]
      },
      {
        "id": "triage-trunc",
        "label": "输出截断",
        "file": "pc2-triage-map--triage-trunc.mp4",
        "endStill": "pc2-triage-map--triage-trunc-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "raiscap",
          "resume"
        ]
      },
      {
        "id": "triage-overflow",
        "label": "上下文超限",
        "file": "pc2-triage-map--triage-overflow.mp4",
        "endStill": "pc2-triage-map--triage-overflow-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "compact"
        ]
      },
      {
        "id": "triage-transient",
        "label": "限流与过载",
        "file": "pc2-triage-map--triage-transient.mp4",
        "endStill": "pc2-triage-map--triage-transient-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "backoff",
          "failover"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
