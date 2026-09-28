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
  "plan-panorama": {
    "slug": "plan-panorama",
    "type": "architecture",
    "chapters": [
      {
        "id": "desk-reread",
        "label": "每轮从头读台面",
        "file": "plan-panorama--desk-reread.mp4",
        "endStill": "plan-panorama--desk-reread-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "desk",
          "read-sweep",
          "five-devices"
        ]
      },
      {
        "id": "five-devices",
        "label": "五件东西总览",
        "file": "plan-panorama--five-devices.mp4",
        "endStill": "plan-panorama--five-devices-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "desk",
          "five-devices"
        ]
      },
      {
        "id": "tool-fade",
        "label": "能力留 · 工具退",
        "file": "plan-panorama--tool-fade.mp4",
        "endStill": "plan-panorama--tool-fade-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.22,
        "beatNodes": [
          "device-todo",
          "fade-mark"
        ]
      },
      {
        "id": "question-return",
        "label": "开头之问",
        "file": "plan-panorama--question-return.mp4",
        "endStill": "plan-panorama--question-return-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "desk",
          "question-mark"
        ]
      },
      {
        "id": "workshop-answers",
        "label": "工坊的安排",
        "file": "plan-panorama--workshop-answers.mp4",
        "endStill": "plan-panorama--workshop-answers-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "desk",
          "five-devices",
          "answer-glow"
        ]
      },
      {
        "id": "m1-pinned",
        "label": "工序卡：钉回可见",
        "file": "plan-panorama--m1-pinned.mp4",
        "endStill": "plan-panorama--m1-pinned-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "device-todo",
          "desk"
        ]
      },
      {
        "id": "m2-isolated",
        "label": "副台：隔走过程",
        "file": "plan-panorama--m2-isolated.mp4",
        "endStill": "plan-panorama--m2-isolated-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "device-side",
          "desk"
        ]
      },
      {
        "id": "m3-two-books",
        "label": "抽屉：两笔账",
        "file": "plan-panorama--m3-two-books.mp4",
        "endStill": "plan-panorama--m3-two-books-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "device-drawer",
          "desk"
        ]
      },
      {
        "id": "m4-relaid",
        "label": "垫纸：按状态重铺",
        "file": "plan-panorama--m4-relaid.mp4",
        "endStill": "plan-panorama--m4-relaid-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "device-pad",
          "desk"
        ]
      },
      {
        "id": "m5-protected",
        "label": "补救梯：保住台面",
        "file": "plan-panorama--m5-protected.mp4",
        "endStill": "plan-panorama--m5-protected-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "device-ladder",
          "desk"
        ]
      },
      {
        "id": "visibility-only",
        "label": "只改看得见什么",
        "file": "plan-panorama--visibility-only.mp4",
        "endStill": "plan-panorama--visibility-only-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "five-devices",
          "desk",
          "visibility-beam"
        ]
      }
    ]
  },
  "plan-prompt-cache": {
    "slug": "plan-prompt-cache",
    "type": "workflow",
    "chapters": [
      {
        "id": "re-eval-per-turn",
        "label": "回合后重算",
        "file": "plan-prompt-cache--re-eval-per-turn.mp4",
        "endStill": "plan-prompt-cache--re-eval-per-turn-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "state-recompute",
          "cache-hit"
        ]
      },
      {
        "id": "deterministic-key",
        "label": "排序序列化作钥匙",
        "file": "plan-prompt-cache--deterministic-key.mp4",
        "endStill": "plan-prompt-cache--deterministic-key-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 5.86,
        "beatNodes": [
          "sorted-serialize",
          "key-slot"
        ]
      },
      {
        "id": "no-builtin-hash",
        "label": "不用自带哈希",
        "file": "plan-prompt-cache--no-builtin-hash.mp4",
        "endStill": "plan-prompt-cache--no-builtin-hash-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "builtin-hash",
          "crossed",
          "list-dict"
        ]
      }
    ]
  },
  "plan-prompt-sections": {
    "slug": "plan-prompt-sections",
    "type": "architecture",
    "chapters": [
      {
        "id": "sectioned-define",
        "label": "分段各改各的",
        "file": "plan-prompt-sections--sectioned-define.mp4",
        "endStill": "plan-prompt-sections--sectioned-define-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 4.16,
        "beatNodes": [
          "section-dict",
          "topic-blocks"
        ]
      },
      {
        "id": "always-sections",
        "label": "常铺三段",
        "file": "plan-prompt-sections--always-sections.mp4",
        "endStill": "plan-prompt-sections--always-sections-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 5.84,
        "beatNodes": [
          "sec-identity",
          "sec-tools",
          "sec-workdir",
          "always-bus"
        ]
      },
      {
        "id": "conditional-memory",
        "label": "记忆段看文件",
        "file": "plan-prompt-sections--conditional-memory.mp4",
        "endStill": "plan-prompt-sections--conditional-memory-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "sec-memory",
          "file-check",
          "conditional-bus"
        ]
      }
    ]
  },
  "plan-recovery-ladder": {
    "slug": "plan-recovery-ladder",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "ladder-mounted",
        "label": "三级梯挂上传送带",
        "file": "plan-recovery-ladder--ladder-mounted.mp4",
        "endStill": "plan-recovery-ladder--ladder-mounted-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.31,
        "beatNodes": [
          "belt",
          "ladder",
          "three-levels"
        ]
      },
      {
        "id": "snap-truncated",
        "label": "摔法一话被掐断",
        "file": "plan-recovery-ladder--snap-truncated.mp4",
        "endStill": "plan-recovery-ladder--snap-truncated-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "level-truncation",
          "half-sentence"
        ]
      },
      {
        "id": "snap-overflow",
        "label": "摔法二台面撑爆",
        "file": "plan-recovery-ladder--snap-overflow.mp4",
        "endStill": "plan-recovery-ladder--snap-overflow-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "level-overflow",
          "desk-full"
        ]
      },
      {
        "id": "snap-transient",
        "label": "摔法三外部抖动",
        "file": "plan-recovery-ladder--snap-transient.mp4",
        "endStill": "plan-recovery-ladder--snap-transient-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "level-transient",
          "shake-wave"
        ]
      },
      {
        "id": "three-catches",
        "label": "三摔三接不同层",
        "file": "plan-recovery-ladder--three-catches.mp4",
        "endStill": "plan-recovery-ladder--three-catches-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.37,
        "beatNodes": [
          "level-truncation",
          "level-overflow",
          "level-transient"
        ]
      },
      {
        "id": "layer-split",
        "label": "里层重试外层兜",
        "file": "plan-recovery-ladder--layer-split.mp4",
        "endStill": "plan-recovery-ladder--layer-split-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "inner-retry",
          "outer-catch"
        ]
      },
      {
        "id": "truncation-last",
        "label": "截断最晚判断",
        "file": "plan-recovery-ladder--truncation-last.mp4",
        "endStill": "plan-recovery-ladder--truncation-last-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "stop-reason",
          "response-first"
        ]
      },
      {
        "id": "compact-then-retry",
        "label": "应急压缩清台",
        "file": "plan-recovery-ladder--compact-then-retry.mp4",
        "endStill": "plan-recovery-ladder--compact-then-retry-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "level-overflow",
          "compact-wave",
          "retry-loop"
        ]
      },
      {
        "id": "compact-once-gate",
        "label": "一次性闸 · 只压一次",
        "file": "plan-recovery-ladder--compact-once-gate.mp4",
        "endStill": "plan-recovery-ladder--compact-once-gate-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "one-shot-gate",
          "locked"
        ]
      },
      {
        "id": "give-up-oversize",
        "label": "再压也不变小",
        "file": "plan-recovery-ladder--give-up-oversize.mp4",
        "endStill": "plan-recovery-ladder--give-up-oversize-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "give-up",
          "still-oversize"
        ]
      },
      {
        "id": "backoff-with-jitter",
        "label": "越等越久掺随机",
        "file": "plan-recovery-ladder--backoff-with-jitter.mp4",
        "endStill": "plan-recovery-ladder--backoff-with-jitter-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "level-transient",
          "backoff-timeline",
          "jitter-dots"
        ]
      },
      {
        "id": "jitter-anti-avalanche",
        "label": "打散同刻重试",
        "file": "plan-recovery-ladder--jitter-anti-avalanche.mp4",
        "endStill": "plan-recovery-ladder--jitter-anti-avalanche-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "jitter-dots",
          "spread-clock"
        ]
      },
      {
        "id": "official-ten-retries",
        "label": "官方最多十次",
        "file": "plan-recovery-ladder--official-ten-retries.mp4",
        "endStill": "plan-recovery-ladder--official-ten-retries-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "cap-ten",
          "backoff-timeline"
        ]
      },
      {
        "id": "fallback-chain",
        "label": "备用切换与清零",
        "file": "plan-recovery-ladder--fallback-chain.mp4",
        "endStill": "plan-recovery-ladder--fallback-chain-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "fallback-model",
          "counter-reset"
        ]
      },
      {
        "id": "exit-protocol",
        "label": "救不回也有收场",
        "file": "plan-recovery-ladder--exit-protocol.mp4",
        "endStill": "plan-recovery-ladder--exit-protocol-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "log-line",
          "write-back",
          "exit-door"
        ]
      }
    ]
  },
  "plan-side-desk": {
    "slug": "plan-side-desk",
    "type": "architecture",
    "chapters": [
      {
        "id": "three-borders",
        "label": "三条边界划清",
        "file": "plan-side-desk--three-borders.mp4",
        "endStill": "plan-side-desk--three-borders-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.33,
        "beatNodes": [
          "side-desk",
          "main-desk",
          "border-frame"
        ]
      },
      {
        "id": "border-world",
        "label": "隔对话不隔世界",
        "file": "plan-side-desk--border-world.mp4",
        "endStill": "plan-side-desk--border-world-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "shared-workdir",
          "file-lands",
          "cmd-lands"
        ]
      },
      {
        "id": "border-gate",
        "label": "隔台面不隔门禁",
        "file": "plan-side-desk--border-gate.mp4",
        "endStill": "plan-side-desk--border-gate-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 6.32,
        "beatNodes": [
          "gate",
          "tool-call",
          "deny-reason"
        ]
      },
      {
        "id": "no-sub-desk",
        "label": "副台无副台工具",
        "file": "plan-side-desk--no-sub-desk.mp4",
        "endStill": "plan-side-desk--no-sub-desk-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "side-desk",
          "tool-belt",
          "no-task-slot"
        ]
      },
      {
        "id": "recursion-capability",
        "label": "能力里防递归",
        "file": "plan-side-desk--recursion-capability.mp4",
        "endStill": "plan-side-desk--recursion-capability-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "tool-belt",
          "capability-note"
        ]
      }
    ]
  },
  "plan-side-guards": {
    "slug": "plan-side-guards",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "turn-cap",
        "label": "轮数有上限",
        "file": "plan-side-guards--turn-cap.mp4",
        "endStill": "plan-side-guards--turn-cap-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "turn-meter",
          "cap-line"
        ]
      },
      {
        "id": "backward-scan",
        "label": "倒序找最近一段话",
        "file": "plan-side-guards--backward-scan.mp4",
        "endStill": "plan-side-guards--backward-scan-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "history",
          "backward-arrow",
          "nearest-text"
        ]
      },
      {
        "id": "same-shape",
        "label": "两条路同一形态",
        "file": "plan-side-guards--same-shape.mp4",
        "endStill": "plan-side-guards--same-shape-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "receipt-a",
          "receipt-b",
          "same-shape"
        ]
      },
      {
        "id": "receipt-blind",
        "label": "回执不写干没干完",
        "file": "plan-side-guards--receipt-blind.mp4",
        "endStill": "plan-side-guards--receipt-blind-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "receipt",
          "blind-spot"
        ]
      }
    ]
  },
  "plan-skill-layers": {
    "slug": "plan-skill-layers",
    "type": "dataflow",
    "chapters": [
      {
        "id": "drawer-labels",
        "label": "抽屉贴标签",
        "file": "plan-skill-layers--drawer-labels.mp4",
        "endStill": "plan-skill-layers--drawer-labels-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "cabinet",
          "drawer",
          "label"
        ]
      },
      {
        "id": "manual-inside",
        "label": "手册躺抽屉里",
        "file": "plan-skill-layers--manual-inside.mp4",
        "endStill": "plan-skill-layers--manual-inside-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "drawer",
          "manual"
        ]
      },
      {
        "id": "cheap-catalog",
        "label": "标签常驻垫纸",
        "file": "plan-skill-layers--cheap-catalog.mp4",
        "endStill": "plan-skill-layers--cheap-catalog-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "labels-strip",
          "system-prompt",
          "cheap-mark"
        ]
      },
      {
        "id": "costly-fulltext",
        "label": "手册按需上台面",
        "file": "plan-skill-layers--costly-fulltext.mp4",
        "endStill": "plan-skill-layers--costly-fulltext-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "manual",
          "lift-path",
          "desk-surface",
          "costly-mark"
        ]
      },
      {
        "id": "split-in-time",
        "label": "知道与读到拆开",
        "file": "plan-skill-layers--split-in-time.mp4",
        "endStill": "plan-skill-layers--split-in-time-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.33,
        "beatNodes": [
          "labels-strip",
          "manual",
          "time-split"
        ]
      }
    ]
  },
  "plan-skill-lifespan": {
    "slug": "plan-skill-lifespan",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "lifespan-split",
        "label": "两层寿命分岔",
        "file": "plan-skill-lifespan--lifespan-split.mp4",
        "endStill": "plan-skill-lifespan--lifespan-split-end.png",
        "beats": 2,
        "leadSec": 0.6,
        "storySec": 3.26,
        "beatNodes": [
          "label-track",
          "manual-track"
        ]
      },
      {
        "id": "manual-in-history",
        "label": "手册随历史走",
        "file": "plan-skill-lifespan--manual-in-history.mp4",
        "endStill": "plan-skill-lifespan--manual-in-history-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "tool-result",
          "history-flow"
        ]
      },
      {
        "id": "compact-sweeps",
        "label": "清台时逃不掉",
        "file": "plan-skill-lifespan--compact-sweeps.mp4",
        "endStill": "plan-skill-lifespan--compact-sweeps-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "compact-wave",
          "manual"
        ]
      },
      {
        "id": "label-stays",
        "label": "标签每轮都在",
        "file": "plan-skill-lifespan--label-stays.mp4",
        "endStill": "plan-skill-lifespan--label-stays-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "labels-strip",
          "system-prompt"
        ]
      },
      {
        "id": "re-paste-budget",
        "label": "重贴留头有封顶",
        "file": "plan-skill-lifespan--re-paste-budget.mp4",
        "endStill": "plan-skill-lifespan--re-paste-budget-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.78,
        "beatNodes": [
          "re-paste",
          "cap-mark"
        ]
      },
      {
        "id": "pair-not-either",
        "label": "配套不是二选一",
        "file": "plan-skill-lifespan--pair-not-either.mp4",
        "endStill": "plan-skill-lifespan--pair-not-either-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "load-on-demand",
          "cleanup",
          "pair-bond"
        ]
      }
    ]
  },
  "plan-skill-registry": {
    "slug": "plan-skill-registry",
    "type": "workflow",
    "chapters": [
      {
        "id": "name-only",
        "label": "只按名字查册",
        "file": "plan-skill-registry--name-only.mp4",
        "endStill": "plan-skill-registry--name-only-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "name-input",
          "registry"
        ]
      },
      {
        "id": "startup-scan",
        "label": "启动扫描登记",
        "file": "plan-skill-registry--startup-scan.mp4",
        "endStill": "plan-skill-registry--startup-scan-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "cabinet",
          "scan-beam",
          "registry"
        ]
      },
      {
        "id": "name-for-fulltext",
        "label": "以名取全文",
        "file": "plan-skill-registry--name-for-fulltext.mp4",
        "endStill": "plan-skill-registry--name-for-fulltext-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.37,
        "beatNodes": [
          "name-input",
          "registry",
          "manual-out"
        ]
      },
      {
        "id": "no-path-to-forge",
        "label": "没有路径可拼",
        "file": "plan-skill-registry--no-path-to-forge.mp4",
        "endStill": "plan-skill-registry--no-path-to-forge-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "registry",
          "no-path-branch",
          "blocked-path"
        ]
      },
      {
        "id": "designed-away",
        "label": "顺带消掉非补丁",
        "file": "plan-skill-registry--designed-away.mp4",
        "endStill": "plan-skill-registry--designed-away-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "design-note",
          "registry"
        ]
      }
    ]
  },
  "plan-todo-states": {
    "slug": "plan-todo-states",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "three-states",
        "label": "三态各配各图标",
        "file": "plan-todo-states--three-states.mp4",
        "endStill": "plan-todo-states--three-states-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.42,
        "beatNodes": [
          "state-pending",
          "state-progress",
          "state-done",
          "terminal-icons"
        ]
      }
    ]
  },
  "plan-todo-swap": {
    "slug": "plan-todo-swap",
    "type": "workflow",
    "chapters": [
      {
        "id": "whole-swap",
        "label": "整张换新无补丁",
        "file": "plan-todo-swap--whole-swap.mp4",
        "endStill": "plan-todo-swap--whole-swap-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "old-card",
          "new-card",
          "replace-arrow"
        ]
      },
      {
        "id": "validate-first",
        "label": "验货不过整单废",
        "file": "plan-todo-swap--validate-first.mp4",
        "endStill": "plan-todo-swap--validate-first-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "checklist",
          "validate-step",
          "fail-x"
        ]
      },
      {
        "id": "no-half-card",
        "label": "失败不留半张卡",
        "file": "plan-todo-swap--no-half-card.mp4",
        "endStill": "plan-todo-swap--no-half-card-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "fail-x",
          "old-card",
          "state-unchanged"
        ]
      },
      {
        "id": "nag-counter",
        "label": "计数递增递条子",
        "file": "plan-todo-swap--nag-counter.mp4",
        "endStill": "plan-todo-swap--nag-counter-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "counter",
          "reminder-note",
          "user-voice"
        ]
      },
      {
        "id": "reset-on-send",
        "label": "一发即归零",
        "file": "plan-todo-swap--reset-on-send.mp4",
        "endStill": "plan-todo-swap--reset-on-send-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "reminder-note",
          "counter",
          "reset-zero"
        ]
      }
    ]
  },
  "plan-truncation-order": {
    "slug": "plan-truncation-order",
    "type": "sequence",
    "chapters": [
      {
        "id": "raise-budget",
        "label": "先抬一大截预算",
        "file": "plan-truncation-order--raise-budget.mp4",
        "endStill": "plan-truncation-order--raise-budget-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "loop",
          "budget-raise"
        ]
      },
      {
        "id": "resend-verbatim",
        "label": "原样重发不落账",
        "file": "plan-truncation-order--resend-verbatim.mp4",
        "endStill": "plan-truncation-order--resend-verbatim-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.31,
        "beatNodes": [
          "budget-raise",
          "api",
          "messages"
        ]
      },
      {
        "id": "judge-before-write",
        "label": "判断抢在落笔前",
        "file": "plan-truncation-order--judge-before-write.mp4",
        "endStill": "plan-truncation-order--judge-before-write-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "loop",
          "judge-step",
          "messages"
        ]
      },
      {
        "id": "order-is-correctness",
        "label": "顺序即正确性",
        "file": "plan-truncation-order--order-is-correctness.mp4",
        "endStill": "plan-truncation-order--order-is-correctness-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "messages",
          "api",
          "judge-step"
        ]
      },
      {
        "id": "continuation-capped",
        "label": "续写次数有限",
        "file": "plan-truncation-order--continuation-capped.mp4",
        "endStill": "plan-truncation-order--continuation-capped-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "messages",
          "continuation-note",
          "api"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
