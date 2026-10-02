// STUB：14 图 47 章占位（slug/章 id/label 与分镜契约一致，时序为占位值）。
// 录制后由 to-video skill 的 scripts/archify_manifest.py 从 public/archify/*.json 重生成——请勿手改。

export type ArchifyChapter = {
  id: string;
  label: string;
  file: string;
  endStill: string;
  beats: number;
  leadSec: number;
  storySec: number;
  beatNodes: string[];
};

export type ArchifyDiagram = {slug: string; type?: string; chapters: ArchifyChapter[]};

/** 全部可用图 slug（场景 cue 的 slug prop 类型） */
export type ArchifySlug = keyof typeof ARCHIFY;

export const ARCHIFY = {
  "pc2-panorama": {
    "slug": "pc2-panorama",
    "type": "workflow",
    "chapters": [
      {
        "id": "pan-loop",
        "label": "全景总览 · 循环四步",
        "file": "pc2-panorama--pan-loop.mp4",
        "endStill": "pc2-panorama--pan-loop-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "pan-m1",
        "label": "挂点① 唠叨计数器",
        "file": "pc2-panorama--pan-m1.mp4",
        "endStill": "pc2-panorama--pan-m1-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "pan-m2",
        "label": "挂点② 副台派单",
        "file": "pc2-panorama--pan-m2.mp4",
        "endStill": "pc2-panorama--pan-m2-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "pan-m3",
        "label": "挂点③ 技能进场",
        "file": "pc2-panorama--pan-m3.mp4",
        "endStill": "pc2-panorama--pan-m3-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "pan-m4",
        "label": "挂点④ 指令组装",
        "file": "pc2-panorama--pan-m4.mp4",
        "endStill": "pc2-panorama--pan-m4-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
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
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "fail-flood",
        "label": "过程淹没主线",
        "file": "pc2-failures--fail-flood.mp4",
        "endStill": "pc2-failures--fail-flood-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "fail-carry",
        "label": "知识全带太贵",
        "file": "pc2-failures--fail-carry.mp4",
        "endStill": "pc2-failures--fail-carry-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "fail-clash",
        "label": "指令堆积打架",
        "file": "pc2-failures--fail-clash.mp4",
        "endStill": "pc2-failures--fail-clash-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "fail-crash",
        "label": "故障即崩",
        "file": "pc2-failures--fail-crash.mp4",
        "endStill": "pc2-failures--fail-crash-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
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
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "nag-count",
        "label": "计数器爬格",
        "file": "pc2-todo-nag--nag-count.mp4",
        "endStill": "pc2-todo-nag--nag-count-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "nag-fire",
        "label": "满三注入",
        "file": "pc2-todo-nag--nag-fire.mp4",
        "endStill": "pc2-todo-nag--nag-fire-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "nag-ablate",
        "label": "拆掉清零",
        "file": "pc2-todo-nag--nag-ablate.mp4",
        "endStill": "pc2-todo-nag--nag-ablate-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
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
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "guard-notask",
        "label": "工具表无 task",
        "file": "pc2-sub-guard--guard-notask.mp4",
        "endStill": "pc2-sub-guard--guard-notask-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "guard-fallback",
        "label": "三十轮上限",
        "file": "pc2-sub-guard--guard-fallback.mp4",
        "endStill": "pc2-sub-guard--guard-fallback-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
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
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "lanes-receipt",
        "label": "一句结论回主线",
        "file": "pc2-sub-lanes--lanes-receipt.mp4",
        "endStill": "pc2-sub-lanes--lanes-receipt-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "lanes-contrast",
        "label": "两条 ↔ 十九条",
        "file": "pc2-sub-lanes--lanes-contrast.mp4",
        "endStill": "pc2-sub-lanes--lanes-contrast-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
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
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "levels-cost",
        "label": "两级成本",
        "file": "pc2-skill-levels--levels-cost.mp4",
        "endStill": "pc2-skill-levels--levels-cost-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "levels-lifecycle",
        "label": "两种命运",
        "file": "pc2-skill-levels--levels-lifecycle.mp4",
        "endStill": "pc2-skill-levels--levels-lifecycle-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      }
    ]
  },
  "pc2-skill-cost": {
    "slug": "pc2-skill-cost",
    "type": "dataflow",
    "chapters": [
      {
        "id": "cost-ablation",
        "label": "128 → 5981",
        "file": "pc2-skill-cost--cost-ablation.mp4",
        "endStill": "pc2-skill-cost--cost-ablation-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "cost-ruling",
        "label": "常驻只能是索引",
        "file": "pc2-skill-cost--cost-ruling.mp4",
        "endStill": "pc2-skill-cost--cost-ruling-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
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
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "shelf-state",
        "label": "只认真实状态",
        "file": "pc2-prompt-shelf--shelf-state.mp4",
        "endStill": "pc2-prompt-shelf--shelf-state-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "shelf-split",
        "label": "各段独立",
        "file": "pc2-prompt-shelf--shelf-split.mp4",
        "endStill": "pc2-prompt-shelf--shelf-split-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
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
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "cache-fingerprint",
        "label": "拼串做键",
        "file": "pc2-prompt-cache--cache-fingerprint.mp4",
        "endStill": "pc2-prompt-cache--cache-fingerprint-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "cache-dirty",
        "label": "键被污染",
        "file": "pc2-prompt-cache--cache-dirty.mp4",
        "endStill": "pc2-prompt-cache--cache-dirty-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
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
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "triage-trunc",
        "label": "输出截断",
        "file": "pc2-triage-map--triage-trunc.mp4",
        "endStill": "pc2-triage-map--triage-trunc-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "triage-overflow",
        "label": "上下文超限",
        "file": "pc2-triage-map--triage-overflow.mp4",
        "endStill": "pc2-triage-map--triage-overflow-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "triage-transient",
        "label": "限流与过载",
        "file": "pc2-triage-map--triage-transient.mp4",
        "endStill": "pc2-triage-map--triage-transient-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
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
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "backoff-jitter",
        "label": "加一点抖动",
        "file": "pc2-backoff-scale--backoff-jitter.mp4",
        "endStill": "pc2-backoff-scale--backoff-jitter-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
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
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "ledger-ablate",
        "label": "拆掉记账",
        "file": "pc2-recovery-ledger--ledger-ablate.mp4",
        "endStill": "pc2-recovery-ledger--ledger-ablate-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "ledger-ruling",
        "label": "不记账吃掉病人",
        "file": "pc2-recovery-ledger--ledger-ruling.mp4",
        "endStill": "pc2-recovery-ledger--ledger-ruling-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
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
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "rule-state",
        "label": "判定只认真实状态",
        "file": "pc2-rules--rule-state.mp4",
        "endStill": "pc2-rules--rule-state-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "rule-lossy",
        "label": "隔离是有损压缩",
        "file": "pc2-rules--rule-lossy.mp4",
        "endStill": "pc2-rules--rule-lossy-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "rule-ledger",
        "label": "恢复必须记账",
        "file": "pc2-rules--rule-ledger.mp4",
        "endStill": "pc2-rules--rule-ledger-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "rule-structure",
        "label": "结构防线优于嘱咐",
        "file": "pc2-rules--rule-structure.mp4",
        "endStill": "pc2-rules--rule-structure-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      }
    ]
  },
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
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      },
      {
        "id": "ablation-ruling",
        "label": "分开看",
        "file": "pc2-ablation-bar--ablation-ruling.mp4",
        "endStill": "pc2-ablation-bar--ablation-ruling-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 0.0,
        "beatNodes": []
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;
