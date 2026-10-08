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
  "checkchain-order": {
    "slug": "checkchain-order",
    "type": "workflow",
    "chapters": [
      {
        "id": "scan-form",
        "label": "第一道扫外形",
        "file": "checkchain-order--scan-form.mp4",
        "endStill": "checkchain-order--scan-form-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "scan-a",
          "workpiece"
        ]
      },
      {
        "id": "scan-claim",
        "label": "第二道扫认领",
        "file": "checkchain-order--scan-claim.mp4",
        "endStill": "checkchain-order--scan-claim-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "scan-b",
          "machine"
        ]
      },
      {
        "id": "scan-permit",
        "label": "第三道扫许可",
        "file": "checkchain-order--scan-permit.mp4",
        "endStill": "checkchain-order--scan-permit-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "scan-c1",
          "scan-c2"
        ]
      },
      {
        "id": "green-relay",
        "label": "全绿电门合闸",
        "file": "checkchain-order--green-relay.mp4",
        "endStill": "checkchain-order--green-relay-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "green-lamps",
          "power-relay",
          "machine"
        ]
      },
      {
        "id": "red-halt",
        "label": "任一红灯不通电",
        "file": "checkchain-order--red-halt.mp4",
        "endStill": "checkchain-order--red-halt-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "red-lamp",
          "power-relay",
          "workpiece"
        ]
      },
      {
        "id": "order-stable",
        "label": "稳定的是顺序",
        "file": "checkchain-order--order-stable.mp4",
        "endStill": "checkchain-order--order-stable-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.54,
        "beatNodes": [
          "scan-a",
          "scan-b",
          "scan-c1",
          "scan-c2",
          "power-relay"
        ]
      }
    ]
  },
  "dispatch-map": {
    "slug": "dispatch-map",
    "type": "dataflow",
    "chapters": [
      {
        "id": "switch-line",
        "label": "执行行换成查表",
        "file": "dispatch-map--switch-line.mp4",
        "endStill": "dispatch-map--switch-line-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "loop-core",
          "execute-line",
          "registry"
        ]
      },
      {
        "id": "name-handler",
        "label": "左名右函数",
        "file": "dispatch-map--name-handler.mp4",
        "endStill": "dispatch-map--name-handler-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "registry",
          "tool-name",
          "handler-fn"
        ]
      },
      {
        "id": "four-new-tools",
        "label": "一次注册四工具",
        "file": "dispatch-map--four-new-tools.mp4",
        "endStill": "dispatch-map--four-new-tools-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.57,
        "beatNodes": [
          "tool-read",
          "tool-write",
          "tool-edit",
          "tool-glob",
          "registry"
        ]
      },
      {
        "id": "ledger-grows",
        "label": "簿厚了带没动",
        "file": "dispatch-map--ledger-grows.mp4",
        "endStill": "dispatch-map--ledger-grows-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "registry",
          "loop-core"
        ]
      },
      {
        "id": "belt-still",
        "label": "改簿不改带",
        "file": "dispatch-map--belt-still.mp4",
        "endStill": "dispatch-map--belt-still-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "loop-core",
          "registry"
        ]
      }
    ]
  },
  "execution-panorama": {
    "slug": "execution-panorama",
    "chapters": [
      {
        "id": "belt-lap",
        "label": "工具执行一圈",
        "file": "execution-panorama--belt-lap.mp4",
        "endStill": "execution-panorama--belt-lap-end.png",
        "beats": 5,
        "leadSec": 0.48,
        "storySec": 5.52,
        "beatNodes": [
          "belt",
          "verify",
          "gates",
          "execute",
          "feed-back"
        ]
      },
      {
        "id": "recount",
        "label": "回头对账",
        "file": "execution-panorama--recount.mp4",
        "endStill": "execution-panorama--recount-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "belt",
          "debt-capability",
          "debt-security",
          "debt-extension"
        ]
      },
      {
        "id": "debt-ledger",
        "label": "三债各归其位",
        "file": "execution-panorama--debt-ledger.mp4",
        "endStill": "execution-panorama--debt-ledger-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.66,
        "beatNodes": [
          "debt-capability",
          "registry-port",
          "debt-security",
          "gate-port",
          "debt-extension",
          "hook-port"
        ]
      },
      {
        "id": "device-per-chapter",
        "label": "每章都在加装置",
        "file": "execution-panorama--device-per-chapter.mp4",
        "endStill": "execution-panorama--device-per-chapter-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.47,
        "beatNodes": [
          "registry-port",
          "gate-port",
          "hook-port",
          "belt"
        ]
      },
      {
        "id": "skeleton-verbatim",
        "label": "骨架逐字没变",
        "file": "execution-panorama--skeleton-verbatim.mp4",
        "endStill": "execution-panorama--skeleton-verbatim-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "skeleton",
          "belt"
        ]
      },
      {
        "id": "vow-cashed",
        "label": "立碑兑现",
        "file": "execution-panorama--vow-cashed.mp4",
        "endStill": "execution-panorama--vow-cashed-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.53,
        "beatNodes": [
          "vow-stone",
          "belt",
          "registry-port",
          "gate-port",
          "hook-port"
        ]
      }
    ]
  },
  "fence-to-intercom": {
    "slug": "fence-to-intercom",
    "type": "architecture",
    "chapters": [
      {
        "id": "quiet-big-day",
        "label": "安静的大事",
        "file": "fence-to-intercom--quiet-big-day.mp4",
        "endStill": "fence-to-intercom--quiet-big-day-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "fence",
          "gate-set"
        ]
      },
      {
        "id": "fence-removed",
        "label": "围墙整个拆掉",
        "file": "fence-to-intercom--fence-removed.mp4",
        "endStill": "fence-to-intercom--fence-removed-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.34,
        "beatNodes": [
          "fence",
          "file-tools",
          "workdir"
        ]
      },
      {
        "id": "downgrade-ask",
        "label": "报错降级为问人",
        "file": "fence-to-intercom--downgrade-ask.mp4",
        "endStill": "fence-to-intercom--downgrade-ask-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "outside-path",
          "hard-error",
          "ask-user"
        ]
      },
      {
        "id": "wall-to-intercom",
        "label": "墙换成对讲机",
        "file": "fence-to-intercom--wall-to-intercom.mp4",
        "endStill": "fence-to-intercom--wall-to-intercom-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "fence",
          "ask-user"
        ]
      },
      {
        "id": "net-effect",
        "label": "按净效应算账",
        "file": "fence-to-intercom--net-effect.mp4",
        "endStill": "fence-to-intercom--net-effect-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "gate-set",
          "ask-user",
          "net-effect"
        ]
      },
      {
        "id": "denied-receipt",
        "label": "被拒也给回执",
        "file": "fence-to-intercom--denied-receipt.mp4",
        "endStill": "fence-to-intercom--denied-receipt-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "denied-result",
          "dialogue"
        ]
      }
    ]
  },
  "five-layer-dependency": {
    "slug": "five-layer-dependency",
    "type": "architecture",
    "chapters": [
      {
        "id": "layer-preview",
        "label": "装置预告一闪",
        "file": "five-layer-dependency--layer-preview.mp4",
        "endStill": "five-layer-dependency--layer-preview-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "layer-1",
          "layer-2",
          "layer-3"
        ]
      },
      {
        "id": "debt-chain",
        "label": "五层还债链",
        "file": "five-layer-dependency--debt-chain.mp4",
        "endStill": "five-layer-dependency--debt-chain-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.56,
        "beatNodes": [
          "layer-1",
          "layer-2",
          "layer-3",
          "layer-4",
          "layer-5"
        ]
      },
      {
        "id": "one-loop",
        "label": "机制很多循环一个",
        "file": "five-layer-dependency--one-loop.mp4",
        "endStill": "five-layer-dependency--one-loop-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.66,
        "beatNodes": [
          "loop-core",
          "layer-1",
          "layer-2",
          "layer-3",
          "layer-4",
          "layer-5"
        ]
      },
      {
        "id": "grown-where",
        "label": "长在表里门上插口上",
        "file": "five-layer-dependency--grown-where.mp4",
        "endStill": "five-layer-dependency--grown-where-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
        "beatNodes": [
          "layer-1",
          "registry-face",
          "gate-face",
          "hook-face"
        ]
      },
      {
        "id": "read-map",
        "label": "先找循环再看装置",
        "file": "five-layer-dependency--read-map.mp4",
        "endStill": "five-layer-dependency--read-map-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "loop-core",
          "device-zones"
        ]
      },
      {
        "id": "four-dark-zones",
        "label": "四个区没开灯",
        "file": "five-layer-dependency--four-dark-zones.mp4",
        "endStill": "five-layer-dependency--four-dark-zones-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.57,
        "beatNodes": [
          "dim-zones",
          "layer-2",
          "layer-3",
          "layer-4",
          "layer-5"
        ]
      }
    ]
  },
  "hook-channels": {
    "slug": "hook-channels",
    "type": "dataflow",
    "chapters": [
      {
        "id": "four-event-sockets",
        "label": "四个事件口",
        "file": "hook-channels--four-event-sockets.mp4",
        "endStill": "hook-channels--four-event-sockets-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "evt-user-prompt",
          "evt-pre",
          "evt-post",
          "evt-stop"
        ]
      },
      {
        "id": "two-functions",
        "label": "循环只认两个函数",
        "file": "hook-channels--two-functions.mp4",
        "endStill": "hook-channels--two-functions-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "register-fn",
          "trigger-fn"
        ]
      },
      {
        "id": "return-channel",
        "label": "返回值唯一信道",
        "file": "hook-channels--return-channel.mp4",
        "endStill": "hook-channels--return-channel-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "ret-none",
          "ret-object"
        ]
      },
      {
        "id": "none-vs-object",
        "label": "空没意见非空干预",
        "file": "hook-channels--none-vs-object.mp4",
        "endStill": "hook-channels--none-vs-object-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "ret-none",
          "ret-object",
          "evt-pre"
        ]
      },
      {
        "id": "brake-gas",
        "label": "刹车与油门",
        "file": "hook-channels--brake-gas.mp4",
        "endStill": "hook-channels--brake-gas-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "evt-pre",
          "evt-stop",
          "brake",
          "gas"
        ]
      },
      {
        "id": "parallel-merge",
        "label": "产品并行拒绝优先",
        "file": "hook-channels--parallel-merge.mp4",
        "endStill": "hook-channels--parallel-merge-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "parallel-hooks",
          "merge-deny-first"
        ]
      }
    ]
  },
  "loop-anatomy": {
    "slug": "loop-anatomy",
    "chapters": [
      {
        "id": "belt-turn",
        "label": "传送带一圈三件事",
        "file": "loop-anatomy--belt-turn.mp4",
        "endStill": "loop-anatomy--belt-turn-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
        "beatNodes": [
          "loop-core",
          "ledger",
          "tool-use-block",
          "tool-result"
        ]
      },
      {
        "id": "append-first",
        "label": "师傅先落账",
        "file": "loop-anatomy--append-first.mp4",
        "endStill": "loop-anatomy--append-first-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "assistant-msg",
          "ledger"
        ]
      },
      {
        "id": "hand-check",
        "label": "看手里有没有调用",
        "file": "loop-anatomy--hand-check.mp4",
        "endStill": "loop-anatomy--hand-check-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "content-blocks",
          "tool-use-block"
        ]
      },
      {
        "id": "no-tool-exit",
        "label": "没递就收圈",
        "file": "loop-anatomy--no-tool-exit.mp4",
        "endStill": "loop-anatomy--no-tool-exit-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "tool-use-block",
          "stop-exit",
          "loop-core"
        ]
      },
      {
        "id": "pair-backfill",
        "label": "按编号配对回填",
        "file": "loop-anatomy--pair-backfill.mp4",
        "endStill": "loop-anatomy--pair-backfill-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.42,
        "beatNodes": [
          "executor",
          "tool-result",
          "pairing",
          "ledger"
        ]
      }
    ]
  },
  "loop-verdict": {
    "slug": "loop-verdict",
    "type": "workflow",
    "chapters": [
      {
        "id": "two-revisions",
        "label": "两个修订判据相反",
        "file": "loop-verdict--two-revisions.mp4",
        "endStill": "loop-verdict--two-revisions-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "rev-mouth",
          "rev-hand"
        ]
      },
      {
        "id": "trust-mouth",
        "label": "一版信嘴上",
        "file": "loop-verdict--trust-mouth.mp4",
        "endStill": "loop-verdict--trust-mouth-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "rev-mouth",
          "stop-marker"
        ]
      },
      {
        "id": "trust-hand",
        "label": "一版信手里",
        "file": "loop-verdict--trust-hand.mp4",
        "endStill": "loop-verdict--trust-hand-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "rev-hand",
          "tool-use-block"
        ]
      },
      {
        "id": "official-silent",
        "label": "官方不披露实现层",
        "file": "loop-verdict--official-silent.mp4",
        "endStill": "loop-verdict--official-silent-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "official-doc",
          "undecidable"
        ]
      },
      {
        "id": "flag-flips",
        "label": "流式即置真",
        "file": "loop-verdict--flag-flips.mp4",
        "endStill": "loop-verdict--flag-flips-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "stream-response",
          "independent-flag",
          "tool-use-block"
        ]
      }
    ]
  },
  "registry-contract": {
    "slug": "registry-contract",
    "type": "dataflow",
    "chapters": [
      {
        "id": "two-step-signup",
        "label": "注册两步",
        "file": "registry-contract--two-step-signup.mp4",
        "endStill": "registry-contract--two-step-signup-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "signup-flow",
          "schema-card",
          "handler-def"
        ]
      },
      {
        "id": "hidden-third-boom",
        "label": "第三处暗契约",
        "file": "registry-contract--hidden-third-boom.mp4",
        "endStill": "registry-contract--hidden-third-boom-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.56,
        "beatNodes": [
          "schema-card",
          "handler-def",
          "kwarg-unpack",
          "name-mismatch",
          "runtime-boom"
        ]
      },
      {
        "id": "unknown-fallback",
        "label": "查不到不崩",
        "file": "registry-contract--unknown-fallback.mp4",
        "endStill": "registry-contract--unknown-fallback-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "unknown-name",
          "fallback-string"
        ]
      },
      {
        "id": "per-tool-try",
        "label": "每台机器自己兜故障",
        "file": "registry-contract--per-tool-try.mp4",
        "endStill": "registry-contract--per-tool-try-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "try-except",
          "error-note"
        ]
      },
      {
        "id": "loop-immune",
        "label": "伤不到循环分毫",
        "file": "registry-contract--loop-immune.mp4",
        "endStill": "registry-contract--loop-immune-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "try-except",
          "error-note",
          "shielded-loop"
        ]
      }
    ]
  },
  "stop-veto": {
    "slug": "stop-veto",
    "chapters": [
      {
        "id": "stop-not-solo",
        "label": "收工非独断",
        "file": "stop-veto--stop-not-solo.mp4",
        "endStill": "stop-veto--stop-not-solo-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "stop-moment",
          "loop-core"
        ]
      },
      {
        "id": "message-yank",
        "label": "递消息拽回续跑",
        "file": "stop-veto--message-yank.mp4",
        "endStill": "stop-veto--message-yank-end.png",
        "beats": 4,
        "leadSec": 0.48,
        "storySec": 4.46,
        "beatNodes": [
          "hook-msg",
          "inject-user",
          "rerun",
          "loop-core"
        ]
      },
      {
        "id": "master-overruled",
        "label": "师傅说不算",
        "file": "stop-veto--master-overruled.mp4",
        "endStill": "stop-veto--master-overruled-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "master-says",
          "pulled-back",
          "rerun"
        ]
      }
    ]
  },
  "three-gates": {
    "slug": "three-gates",
    "chapters": [
      {
        "id": "welded-gate",
        "label": "焊死的铁门",
        "file": "three-gates--welded-gate.mp4",
        "endStill": "three-gates--welded-gate-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "gate-deny",
          "deny-list"
        ]
      },
      {
        "id": "bash-scope",
        "label": "只盯命令行",
        "file": "three-gates--bash-scope.mp4",
        "endStill": "three-gates--bash-scope-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "deny-list",
          "bash-machine"
        ]
      },
      {
        "id": "rule-gate",
        "label": "规则匹配门",
        "file": "three-gates--rule-gate.mp4",
        "endStill": "three-gates--rule-gate-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "gate-rule",
          "rule-table"
        ]
      },
      {
        "id": "intercom-gate",
        "label": "对讲机默认拒绝",
        "file": "three-gates--intercom-gate.mp4",
        "endStill": "three-gates--intercom-gate-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "gate-ask",
          "user",
          "default-deny"
        ]
      },
      {
        "id": "order-locked",
        "label": "次序焊死",
        "file": "three-gates--order-locked.mp4",
        "endStill": "three-gates--order-locked-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "gate-deny",
          "gate-rule",
          "gate-ask"
        ]
      },
      {
        "id": "one-line-join",
        "label": "接进循环只加一行",
        "file": "three-gates--one-line-join.mp4",
        "endStill": "three-gates--one-line-join-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.31,
        "beatNodes": [
          "one-line-hook",
          "gate-deny",
          "loop-core"
        ]
      }
    ]
  },
  "tool-batch-layers": {
    "slug": "tool-batch-layers",
    "type": "workflow",
    "chapters": [
      {
        "id": "one-tray",
        "label": "一口气一托盘",
        "file": "tool-batch-layers--one-tray.mp4",
        "endStill": "tool-batch-layers--one-tray-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "tray",
          "multi-calls"
        ]
      },
      {
        "id": "teach-serial",
        "label": "教学版一件一件上",
        "file": "tool-batch-layers--teach-serial.mp4",
        "endStill": "tool-batch-layers--teach-serial-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "serial-exec",
          "tray"
        ]
      },
      {
        "id": "index-promises",
        "label": "索引承诺了并发",
        "file": "tool-batch-layers--index-promises.mp4",
        "endStill": "tool-batch-layers--index-promises-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "chapter-index",
          "concurrency-keyword",
          "code-probe"
        ]
      },
      {
        "id": "official-parallel",
        "label": "官方确认并行与批",
        "file": "tool-batch-layers--official-parallel.mp4",
        "endStill": "tool-batch-layers--official-parallel-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "official-doc",
          "parallel-batch"
        ]
      },
      {
        "id": "author-schedule",
        "label": "批内并行批间排队",
        "file": "tool-batch-layers--author-schedule.mp4",
        "endStill": "tool-batch-layers--author-schedule-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "author-analysis",
          "batch-parallel",
          "batch-queue"
        ]
      },
      {
        "id": "args-decide",
        "label": "看实参不看名",
        "file": "tool-batch-layers--args-decide.mp4",
        "endStill": "tool-batch-layers--args-decide-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "args-decide",
          "parallel-batch"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
