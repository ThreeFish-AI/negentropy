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
  "batch-walkthrough": {
    "slug": "batch-walkthrough",
    "type": "dataflow",
    "chapters": [
      {
        "id": "three-big",
        "label": "三个大结果进队",
        "file": "batch-walkthrough--three-big.mp4",
        "endStill": "batch-walkthrough--three-big-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "input-batch"
        ]
      },
      {
        "id": "budget-pass",
        "label": "逐个落盘换收据",
        "file": "batch-walkthrough--budget-pass.mp4",
        "endStill": "batch-walkthrough--budget-pass-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "spill-320",
          "spill-170"
        ]
      },
      {
        "id": "fit-fallback",
        "label": "未读批兜底落盘",
        "file": "batch-walkthrough--fit-fallback.mp4",
        "endStill": "batch-walkthrough--fit-fallback-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "address-layer",
          "fallback"
        ]
      },
      {
        "id": "final-zero",
        "label": "终态六千字 · 零次摘要",
        "file": "batch-walkthrough--final-zero.mp4",
        "endStill": "batch-walkthrough--final-zero-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.2,
        "beatNodes": [
          "final"
        ]
      }
    ]
  },
  "cache-economics": {
    "slug": "cache-economics",
    "type": "dataflow",
    "chapters": [
      {
        "id": "prefix-hit",
        "label": "前缀相同按缓存价",
        "file": "cache-economics--prefix-hit.mp4",
        "endStill": "cache-economics--prefix-hit-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.57,
        "beatNodes": [
          "manuscript",
          "compare",
          "cacheHit",
          "fullPrice",
          "bill"
        ]
      },
      {
        "id": "one-char",
        "label": "改一字全部重算",
        "file": "cache-economics--one-char.mp4",
        "endStill": "cache-economics--one-char-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "edit",
          "compare",
          "reprice"
        ]
      },
      {
        "id": "two-lanes",
        "label": "目录常驻 vs 正文按需",
        "file": "cache-economics--two-lanes.mp4",
        "endStill": "cache-economics--two-lanes-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.54,
        "beatNodes": [
          "toc",
          "memory",
          "cacheHit",
          "fullPrice",
          "bill"
        ]
      }
    ]
  },
  "compact-pipeline": {
    "slug": "compact-pipeline",
    "type": "workflow",
    "chapters": [
      {
        "id": "cheap-first",
        "label": "便宜的先跑四层",
        "file": "compact-pipeline--cheap-first.mp4",
        "endStill": "compact-pipeline--cheap-first-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.65,
        "beatNodes": [
          "messages",
          "l1",
          "l2",
          "l3",
          "l4",
          "call"
        ]
      },
      {
        "id": "bypass",
        "label": "未超限旁路直达",
        "file": "compact-pipeline--bypass.mp4",
        "endStill": "compact-pipeline--bypass-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "l2",
          "call"
        ]
      },
      {
        "id": "reactive",
        "label": "报错后应急裁剪",
        "file": "compact-pipeline--reactive.mp4",
        "endStill": "compact-pipeline--reactive-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "call",
          "trim"
        ]
      },
      {
        "id": "batch-wait",
        "label": "主动压缩等批次完成",
        "file": "compact-pipeline--batch-wait.mp4",
        "endStill": "compact-pipeline--batch-wait-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.52,
        "beatNodes": [
          "call",
          "tools",
          "compact",
          "l1"
        ]
      }
    ]
  },
  "consolidation-txn": {
    "slug": "consolidation-txn",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "trigger-snapshot",
        "label": "满十条先快照",
        "file": "consolidation-txn--trigger-snapshot.mp4",
        "endStill": "consolidation-txn--trigger-snapshot-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.22,
        "beatNodes": [
          "trigger",
          "snapshot"
        ]
      },
      {
        "id": "swap-write",
        "label": "删旧写新至多三十条",
        "file": "consolidation-txn--swap-write.mp4",
        "endStill": "consolidation-txn--swap-write-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "delete-old",
          "write-new",
          "done"
        ]
      },
      {
        "id": "fail-rollback",
        "label": "失败即恢复原样",
        "file": "consolidation-txn--fail-rollback.mp4",
        "endStill": "consolidation-txn--fail-rollback-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "failed",
          "rollback",
          "trigger"
        ]
      },
      {
        "id": "no-snapshot",
        "label": "拆掉快照：十条变零条",
        "file": "consolidation-txn--no-snapshot.mp4",
        "endStill": "consolidation-txn--no-snapshot-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.55,
        "beatNodes": [
          "skip-snapshot",
          "write-crash",
          "memory-zero"
        ]
      }
    ]
  },
  "memory-file-anatomy": {
    "slug": "memory-file-anatomy",
    "type": "architecture",
    "chapters": [
      {
        "id": "one-file",
        "label": "一记忆一文件",
        "file": "memory-file-anatomy--one-file.mp4",
        "endStill": "memory-file-anatomy--one-file-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "memory-file"
        ]
      },
      {
        "id": "frontmatter",
        "label": "开头三元元信息",
        "file": "memory-file-anatomy--frontmatter.mp4",
        "endStill": "memory-file-anatomy--frontmatter-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "frontmatter"
        ]
      },
      {
        "id": "index-rebuild",
        "label": "写入后索引自动重建",
        "file": "memory-file-anatomy--index-rebuild.mp4",
        "endStill": "memory-file-anatomy--index-rebuild-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "memory-file",
          "index"
        ]
      },
      {
        "id": "four-types",
        "label": "四类各答一个问题",
        "file": "memory-file-anatomy--four-types.mp4",
        "endStill": "memory-file-anatomy--four-types-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.48,
        "beatNodes": [
          "type-user",
          "type-feedback",
          "type-project",
          "type-reference"
        ]
      }
    ]
  },
  "memory-gates": {
    "slug": "memory-gates",
    "type": "workflow",
    "chapters": [
      {
        "id": "three-in",
        "label": "三句候选进队",
        "file": "memory-gates--three-in.mp4",
        "endStill": "memory-gates--three-in-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "sent1",
          "sent2",
          "sent3"
        ]
      },
      {
        "id": "first-pass",
        "label": "句①三门全过落库",
        "file": "memory-gates--first-pass.mp4",
        "endStill": "memory-gates--first-pass-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.56,
        "beatNodes": [
          "sent1",
          "scope",
          "tempgate",
          "dedupgate",
          "cardfile"
        ]
      },
      {
        "id": "second-block",
        "label": "句②撞临时词门",
        "file": "memory-gates--second-block.mp4",
        "endStill": "memory-gates--second-block-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.22,
        "beatNodes": [
          "sent2",
          "tempgate"
        ]
      },
      {
        "id": "third-block",
        "label": "句③被 Scope 门挡回",
        "file": "memory-gates--third-block.mp4",
        "endStill": "memory-gates--third-block-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "sent3",
          "scope"
        ]
      },
      {
        "id": "one-of-three",
        "label": "只入库一条",
        "file": "memory-gates--one-of-three.mp4",
        "endStill": "memory-gates--one-of-three-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.22,
        "beatNodes": [
          "cardfile",
          "reject"
        ]
      }
    ]
  },
  "pairing-interlock": {
    "slug": "pairing-interlock",
    "type": "sequence",
    "chapters": [
      {
        "id": "paired-ok",
        "label": "编号互锁常态",
        "file": "pairing-interlock--paired-ok.mp4",
        "endStill": "pairing-interlock--paired-ok-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.33,
        "beatNodes": [
          "assistant",
          "tool",
          "validator"
        ]
      },
      {
        "id": "torn-reject",
        "label": "拆散即黑单",
        "file": "pairing-interlock--torn-reject.mp4",
        "endStill": "pairing-interlock--torn-reject-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "validator",
          "assistant"
        ]
      },
      {
        "id": "retreat-fix",
        "label": "切点回退整对越过",
        "file": "pairing-interlock--retreat-fix.mp4",
        "endStill": "pairing-interlock--retreat-fix-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.27,
        "beatNodes": [
          "assistant",
          "validator"
        ]
      }
    ]
  },
  "recall-loop": {
    "slug": "recall-loop",
    "type": "workflow",
    "chapters": [
      {
        "id": "two-channels",
        "label": "目录常驻 · 正文按需",
        "file": "recall-loop--two-channels.mp4",
        "endStill": "recall-loop--two-channels-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "idx",
          "sys",
          "sel",
          "load"
        ]
      },
      {
        "id": "extract-gates",
        "label": "会话尾提取过三门",
        "file": "recall-loop--extract-gates.mp4",
        "endStill": "recall-loop--extract-gates-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.24,
        "beatNodes": [
          "ext",
          "gate"
        ]
      },
      {
        "id": "write-rebuild",
        "label": "写文件重建索引",
        "file": "recall-loop--write-rebuild.mp4",
        "endStill": "recall-loop--write-rebuild-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "write"
        ]
      },
      {
        "id": "consolidate",
        "label": "满十条低频整理",
        "file": "recall-loop--consolidate.mp4",
        "endStill": "recall-loop--consolidate-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "tidy"
        ]
      }
    ]
  },
  "scratchpad-anatomy": {
    "slug": "scratchpad-anatomy",
    "type": "architecture",
    "chapters": [
      {
        "id": "full-resend",
        "label": "每次调用全量重发",
        "file": "scratchpad-anatomy--full-resend.mp4",
        "endStill": "scratchpad-anatomy--full-resend-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.66,
        "beatNodes": [
          "api",
          "sys-prompt",
          "user-ask",
          "assistant-call-1",
          "result-1",
          "heavy-result"
        ]
      },
      {
        "id": "fixed-prefix",
        "label": "开头固定的指令区",
        "file": "scratchpad-anatomy--fixed-prefix.mp4",
        "endStill": "scratchpad-anatomy--fixed-prefix-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "sys-prompt"
        ]
      },
      {
        "id": "pair-interlock",
        "label": "调用与结果编号互锁",
        "file": "scratchpad-anatomy--pair-interlock.mp4",
        "endStill": "scratchpad-anatomy--pair-interlock-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "assistant-call-1",
          "result-1",
          "assistant-call-2",
          "result-2"
        ]
      },
      {
        "id": "heavy-results",
        "label": "工具结果是大头",
        "file": "scratchpad-anatomy--heavy-results.mp4",
        "endStill": "scratchpad-anatomy--heavy-results-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "heavy-result",
          "heavy-log",
          "search-hits"
        ]
      }
    ]
  },
  "sidecar-selection": {
    "slug": "sidecar-selection",
    "type": "sequence",
    "chapters": [
      {
        "id": "sidecar-pick",
        "label": "一次轻量旁路调用",
        "file": "sidecar-selection--sidecar-pick.mp4",
        "endStill": "sidecar-selection--sidecar-pick-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "sidecar"
        ]
      },
      {
        "id": "budget-funnel",
        "label": "输入与挑回都被掐小（≤5 条）",
        "file": "sidecar-selection--budget-funnel.mp4",
        "endStill": "sidecar-selection--budget-funnel-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "main",
          "sidecar"
        ]
      },
      {
        "id": "fallback-valve",
        "label": "降级与安全阀",
        "file": "sidecar-selection--fallback-valve.mp4",
        "endStill": "sidecar-selection--fallback-valve-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "main",
          "index",
          "files"
        ]
      }
    ]
  },
  "summary-surgery": {
    "slug": "summary-surgery",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "four-steps",
        "label": "四件事按序",
        "file": "summary-surgery--four-steps.mp4",
        "endStill": "summary-surgery--four-steps-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 3.72,
        "beatNodes": [
          "transcript",
          "distill",
          "pin-request",
          "compacted"
        ]
      },
      {
        "id": "anti-inject",
        "label": "不执行历史指令",
        "file": "summary-surgery--anti-inject.mp4",
        "endStill": "summary-surgery--anti-inject-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "compacted",
          "no-exec"
        ]
      },
      {
        "id": "fuse-3",
        "label": "连错三次熔断（讲义口径）",
        "file": "summary-surgery--fuse-3.mp4",
        "endStill": "summary-surgery--fuse-3-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "distill",
          "fuse"
        ]
      }
    ]
  },
  "unseen-guard": {
    "slug": "unseen-guard",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "unseen-safe",
        "label": "未读受保护",
        "file": "unseen-guard--unseen-safe.mp4",
        "endStill": "unseen-guard--unseen-safe-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "unread",
          "read"
        ]
      },
      {
        "id": "old-swap",
        "label": "旧账先落盘再换地址",
        "file": "unseen-guard--old-swap.mp4",
        "endStill": "unseen-guard--old-swap-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "old",
          "persist",
          "swap"
        ]
      },
      {
        "id": "guard-off",
        "label": "拆保护：九千字变一行地址",
        "file": "unseen-guard--guard-off.mp4",
        "endStill": "unseen-guard--guard-off-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "judge",
          "swaplost",
          "never"
        ]
      },
      {
        "id": "two-guards",
        "label": "两道独立保险",
        "file": "unseen-guard--two-guards.mp4",
        "endStill": "unseen-guard--two-guards-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "unread",
          "tail"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
