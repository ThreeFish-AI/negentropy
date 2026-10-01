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
  "dispatch-table": {
    "slug": "dispatch-table",
    "type": "dataflow",
    "chapters": [
      {
        "id": "order-in",
        "label": "① 单子进来：name + input",
        "file": "dispatch-table--order-in.mp4",
        "endStill": "dispatch-table--order-in-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "order",
          "tools"
        ]
      },
      {
        "id": "table-lookup",
        "label": "② 查表：TOOL_HANDLERS[name]",
        "file": "dispatch-table--table-lookup.mp4",
        "endStill": "dispatch-table--table-lookup-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "order",
          "registry"
        ]
      },
      {
        "id": "dept-exec",
        "label": "③ 科室执行：纯函数 **input",
        "file": "dispatch-table--dept-exec.mp4",
        "endStill": "dispatch-table--dept-exec-end.png",
        "beats": 3,
        "leadSec": 0.52,
        "storySec": 7.44,
        "beatNodes": [
          "safe",
          "filedesk",
          "bashdesk"
        ]
      },
      {
        "id": "feed-back",
        "label": "④ 结果包成 tool_result 回喂",
        "file": "dispatch-table--feed-back.mp4",
        "endStill": "dispatch-table--feed-back-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.28,
        "beatNodes": [
          "result",
          "ledger"
        ]
      },
      {
        "id": "grow-table",
        "label": "⑤ 加新本事 = 表上添两笔",
        "file": "dispatch-table--grow-table.mp4",
        "endStill": "dispatch-table--grow-table-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "tools",
          "newh",
          "registry"
        ]
      }
    ]
  },
  "five-layer-dependency": {
    "slug": "five-layer-dependency",
    "type": "architecture",
    "chapters": [
      {
        "id": "layer-flash",
        "label": "记忆层一闪",
        "file": "five-layer-dependency--layer-flash.mp4",
        "endStill": "five-layer-dependency--layer-flash-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.36,
        "beatNodes": [
          "layer-3",
          "layer-2",
          "layer-4"
        ]
      },
      {
        "id": "read-two-books",
        "label": "先分两本账",
        "file": "five-layer-dependency--read-two-books.mp4",
        "endStill": "five-layer-dependency--read-two-books-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "loop-core",
          "layer-3",
          "device-zones"
        ]
      },
      {
        "id": "two-dark-zones",
        "label": "两个区没开灯",
        "file": "five-layer-dependency--two-dark-zones.mp4",
        "endStill": "five-layer-dependency--two-dark-zones-end.png",
        "beats": 3,
        "leadSec": 0.4,
        "storySec": 3.38,
        "beatNodes": [
          "dim-zones",
          "layer-4",
          "layer-5"
        ]
      }
    ]
  },
  "four-version-ledger": {
    "slug": "four-version-ledger",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "v1-base",
        "label": "v1 · 102 行：循环 + 一把 bash",
        "file": "four-version-ledger--v1-base.mp4",
        "endStill": "four-version-ledger--v1-base-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "v1",
          "lp1"
        ]
      },
      {
        "id": "v2-table",
        "label": "v2 · 135 行：+开单表，循环只换一行",
        "file": "four-version-ledger--v2-table.mp4",
        "endStill": "four-version-ledger--v2-table-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.28,
        "beatNodes": [
          "v2",
          "lp2"
        ]
      },
      {
        "id": "v3-gates",
        "label": "v3 · 180 行：+三重把关进管线",
        "file": "four-version-ledger--v3-gates.mp4",
        "endStill": "four-version-ledger--v3-gates-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "v3",
          "lp3"
        ]
      },
      {
        "id": "v4-hooks",
        "label": "v4 · 232 行：+规程节点，把关搬家",
        "file": "four-version-ledger--v4-hooks.mp4",
        "endStill": "four-version-ledger--v4-hooks-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "v4",
          "lp4"
        ]
      },
      {
        "id": "ledger",
        "label": "对账：循环几乎没动",
        "file": "four-version-ledger--ledger.mp4",
        "endStill": "four-version-ledger--ledger-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.6,
        "beatNodes": [
          "v5",
          "lp1",
          "lp2",
          "lp3",
          "lp4"
        ]
      }
    ]
  },
  "gate-four-result": {
    "slug": "gate-four-result",
    "type": "architecture",
    "chapters": [
      {
        "id": "four-states",
        "label": "四态总览：多一个「不表态」",
        "file": "gate-four-result--four-states.mp4",
        "endStill": "gate-four-result--four-states-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.54,
        "beatNodes": [
          "merge",
          "res_allow",
          "res_deny",
          "res_ask",
          "res_pass"
        ]
      },
      {
        "id": "eight-sources",
        "label": "八来源分层合并",
        "file": "gate-four-result--eight-sources.mp4",
        "endStill": "gate-four-result--eight-sources-end.png",
        "beats": 9,
        "leadSec": 0.44,
        "storySec": 9.97,
        "beatNodes": [
          "src_user",
          "src_project",
          "src_local",
          "src_flag",
          "src_enterprise",
          "src_cli",
          "src_session",
          "src_inline",
          "merge"
        ]
      },
      {
        "id": "override",
        "label": "高优先级覆盖低优先级",
        "file": "gate-four-result--override.mp4",
        "endStill": "gate-four-result--override-end.png",
        "beats": 6,
        "leadSec": 0.48,
        "storySec": 6.68,
        "beatNodes": [
          "src_user",
          "src_project",
          "src_local",
          "src_flag",
          "src_enterprise",
          "merge"
        ]
      },
      {
        "id": "classifier",
        "label": "分类器代审：单子连同对话发判断模型",
        "file": "gate-four-result--classifier.mp4",
        "endStill": "gate-four-result--classifier-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "classifier",
          "merge",
          "res_allow"
        ]
      },
      {
        "id": "fallback-human",
        "label": "连拒多次回退人工",
        "file": "gate-four-result--fallback-human.mp4",
        "endStill": "gate-four-result--fallback-human-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "classifier",
          "fallback",
          "res_ask"
        ]
      }
    ]
  },
  "gate-order-ablation": {
    "slug": "gate-order-ablation",
    "type": "workflow",
    "chapters": [
      {
        "id": "normal-first",
        "label": "正常序：禁忌表最先拦下",
        "file": "gate-order-ablation--normal-first.mp4",
        "endStill": "gate-order-ablation--normal-first-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "n_order",
          "n_deny",
          "n_block"
        ]
      },
      {
        "id": "reorder-early",
        "label": "调序：规则与签字提前",
        "file": "gate-order-ablation--reorder-early.mp4",
        "endStill": "gate-order-ablation--reorder-early-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.37,
        "beatNodes": [
          "r_order",
          "r_allow",
          "r_ask"
        ]
      },
      {
        "id": "one-y-pass",
        "label": "一个 y 就通过签字关",
        "file": "gate-order-ablation--one-y-pass.mp4",
        "endStill": "gate-order-ablation--one-y-pass-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.23,
        "beatNodes": [
          "r_ask",
          "r_deny"
        ]
      },
      {
        "id": "wipe-zero",
        "label": "实测：4 个文件 → 0",
        "file": "gate-order-ablation--wipe-zero.mp4",
        "endStill": "gate-order-ablation--wipe-zero-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.37,
        "beatNodes": [
          "r_exec",
          "r_zero",
          "n_block"
        ]
      }
    ]
  },
  "gate-three-tier": {
    "slug": "gate-three-tier",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "arrive",
        "label": "一张单子到关前",
        "file": "gate-three-tier--arrive.mp4",
        "endStill": "gate-three-tier--arrive-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "in",
          "g1"
        ]
      },
      {
        "id": "hard-deny",
        "label": "禁忌表硬拒，翻不了案",
        "file": "gate-three-tier--hard-deny.mp4",
        "endStill": "gate-three-tier--hard-deny-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.27,
        "beatNodes": [
          "g1",
          "denied"
        ]
      },
      {
        "id": "rule-hit",
        "label": "按工具规则比对",
        "file": "gate-three-tier--rule-hit.mp4",
        "endStill": "gate-three-tier--rule-hit-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "g2",
          "g3"
        ]
      },
      {
        "id": "ask-sign",
        "label": "问人签字，默认拒",
        "file": "gate-three-tier--ask-sign.mp4",
        "endStill": "gate-three-tier--ask-sign-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.36,
        "beatNodes": [
          "g3",
          "ok",
          "denied"
        ]
      },
      {
        "id": "default-pass",
        "label": "三关皆空默认做＋被拒也有回执",
        "file": "gate-three-tier--default-pass.mp4",
        "endStill": "gate-three-tier--default-pass-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.38,
        "beatNodes": [
          "run",
          "denied",
          "fed"
        ]
      }
    ]
  },
  "hook-mount": {
    "slug": "hook-mount",
    "type": "dataflow",
    "chapters": [
      {
        "id": "four-mounts",
        "label": "四点位全景：挂点在哪",
        "file": "hook-mount--four-mounts.mp4",
        "endStill": "hook-mount--four-mounts-end.png",
        "beats": 4,
        "leadSec": 0.48,
        "storySec": 4.42,
        "beatNodes": [
          "ups",
          "pre",
          "post",
          "stop"
        ]
      },
      {
        "id": "registry",
        "label": "注册表：挂上=列表加一行",
        "file": "hook-mount--registry.mp4",
        "endStill": "hook-mount--registry-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.27,
        "beatNodes": [
          "ups"
        ]
      },
      {
        "id": "pre-intercept",
        "label": "执行前节点：拦下单子",
        "file": "hook-mount--pre-intercept.mp4",
        "endStill": "hook-mount--pre-intercept-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.5,
        "beatNodes": [
          "vitals",
          "pre",
          "perm"
        ]
      },
      {
        "id": "post-ledger",
        "label": "执行后节点：记账归档",
        "file": "hook-mount--post-ledger.mp4",
        "endStill": "hook-mount--post-ledger-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.49,
        "beatNodes": [
          "desk",
          "post",
          "ledger"
        ]
      },
      {
        "id": "stop-recall",
        "label": "结诊节点：拉回续跑",
        "file": "hook-mount--stop-recall.mp4",
        "endStill": "hook-mount--stop-recall-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.33,
        "beatNodes": [
          "vitals",
          "stop",
          "doctor"
        ]
      }
    ]
  },
  "hookresult-tri": {
    "slug": "hookresult-tri",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "tri-overview",
        "label": "三值：None / 意见 / False",
        "file": "hookresult-tri--tri-overview.mp4",
        "endStill": "hookresult-tri--tri-overview-end.png",
        "beats": 4,
        "leadSec": 0.48,
        "storySec": 4.46,
        "beatNodes": [
          "q2",
          "vNone",
          "vFalse",
          "q3"
        ]
      },
      {
        "id": "first-wins",
        "label": "首个非 None 短路",
        "file": "hookresult-tri--first-wins.mp4",
        "endStill": "hookresult-tri--first-wins-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "q1",
          "q3",
          "e1"
        ]
      },
      {
        "id": "false-trap",
        "label": "False 陷阱：它是有意见",
        "file": "hookresult-tri--false-trap.mp4",
        "endStill": "hookresult-tri--false-trap-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "q2",
          "vFalse",
          "q3"
        ]
      },
      {
        "id": "flip-zero-tools",
        "label": "反转实验：全失灵 0 工具",
        "file": "hookresult-tri--flip-zero-tools.mp4",
        "endStill": "hookresult-tri--flip-zero-tools-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "x1",
          "x2"
        ]
      },
      {
        "id": "flip-stop-hijack",
        "label": "反转实验：Stop 劫持到封顶",
        "file": "hookresult-tri--flip-stop-hijack.mp4",
        "endStill": "hookresult-tri--flip-stop-hijack-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "x1",
          "x3"
        ]
      }
    ]
  },
  "human-relay": {
    "slug": "human-relay",
    "type": "workflow",
    "chapters": [
      {
        "id": "manual-full",
        "label": "人肉往返全貌",
        "file": "human-relay--manual-full.mp4",
        "endStill": "human-relay--manual-full-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.7,
        "beatNodes": [
          "u_ask",
          "m_read",
          "m_say",
          "u_copy",
          "u_term",
          "u_back"
        ]
      },
      {
        "id": "talk-only",
        "label": "模型只说不干",
        "file": "human-relay--talk-only.mp4",
        "endStill": "human-relay--talk-only-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "m_say",
          "u_ask",
          "u_copy"
        ]
      },
      {
        "id": "your-hands",
        "label": "每轮交接都是你的手",
        "file": "human-relay--your-hands.mp4",
        "endStill": "human-relay--your-hands-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 6.73,
        "beatNodes": [
          "u_ask",
          "u_copy",
          "u_term",
          "u_back"
        ]
      },
      {
        "id": "loop-takes-over",
        "label": "循环接手",
        "file": "human-relay--loop-takes-over.mp4",
        "endStill": "human-relay--loop-takes-over-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.68,
        "beatNodes": [
          "c_ledger",
          "c_doctor",
          "c_desk"
        ]
      },
      {
        "id": "gap-preview",
        "label": "差距预告",
        "file": "human-relay--gap-preview.mp4",
        "endStill": "human-relay--gap-preview-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.31,
        "beatNodes": [
          "x_table",
          "x_gate",
          "x_hook"
        ]
      }
    ]
  },
  "intake-loop": {
    "slug": "intake-loop",
    "type": "architecture",
    "chapters": [
      {
        "id": "five-steps",
        "label": "五步一圈：调·落·判·执·回",
        "file": "intake-loop--five-steps.mp4",
        "endStill": "intake-loop--five-steps-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "doctor",
          "vitals",
          "desk",
          "ledger"
        ]
      },
      {
        "id": "full-reread",
        "label": "每一轮都是全量重读",
        "file": "intake-loop--full-reread.mp4",
        "endStill": "intake-loop--full-reread-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.44,
        "beatNodes": [
          "ledger",
          "doctor"
        ]
      },
      {
        "id": "two-signatures",
        "label": "病历本只认两种署名",
        "file": "intake-loop--two-signatures.mp4",
        "endStill": "intake-loop--two-signatures-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 7.08,
        "beatNodes": [
          "ledger",
          "doctor",
          "desk"
        ]
      },
      {
        "id": "order-or-done",
        "label": "续诊还是结诊，只看开没开单",
        "file": "intake-loop--order-or-done.mp4",
        "endStill": "intake-loop--order-or-done-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.27,
        "beatNodes": [
          "vitals",
          "desk"
        ]
      },
      {
        "id": "discharge-return",
        "label": "没开单→结诊交还",
        "file": "intake-loop--discharge-return.mp4",
        "endStill": "intake-loop--discharge-return-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.27,
        "beatNodes": [
          "vitals",
          "patient"
        ]
      }
    ]
  },
  "lookup-failure": {
    "slug": "lookup-failure",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "unknown-in",
        "label": "① 未知 name 进来",
        "file": "lookup-failure--unknown-in.mp4",
        "endStill": "lookup-failure--unknown-in-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "unknown",
          "lookup"
        ]
      },
      {
        "id": "hard-crash",
        "label": "② 硬索引：KeyError 当场崩",
        "file": "lookup-failure--hard-crash.mp4",
        "endStill": "lookup-failure--hard-crash-end.png",
        "beats": 2,
        "leadSec": 1.28,
        "storySec": 6.72,
        "beatNodes": [
          "lookup",
          "crash"
        ]
      },
      {
        "id": "soft-unknown",
        "label": "③ 软查表：Unknown 回喂",
        "file": "lookup-failure--soft-unknown.mp4",
        "endStill": "lookup-failure--soft-unknown-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.27,
        "beatNodes": [
          "lookup",
          "feed"
        ]
      },
      {
        "id": "self-fix",
        "label": "④ 医生看到 Unknown 自纠",
        "file": "lookup-failure--self-fix.mp4",
        "endStill": "lookup-failure--self-fix-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.35,
        "beatNodes": [
          "feed",
          "selffix",
          "resume"
        ]
      },
      {
        "id": "verdict",
        "label": "⑤ 失败形态由取值方式决定",
        "file": "lookup-failure--verdict.mp4",
        "endStill": "lookup-failure--verdict-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "lookup",
          "crash",
          "feed"
        ]
      }
    ]
  },
  "preflight-chain": {
    "slug": "preflight-chain",
    "type": "sequence",
    "chapters": [
      {
        "id": "full-chain",
        "label": "全链一镜：五道工序",
        "file": "preflight-chain--full-chain.mp4",
        "endStill": "preflight-chain--full-chain-end.png",
        "beats": 6,
        "leadSec": 0.48,
        "storySec": 6.66,
        "beatNodes": [
          "loop",
          "schema",
          "toolself",
          "hook",
          "perm",
          "desk"
        ]
      },
      {
        "id": "cheap-first",
        "label": "参数核对 · 最靠前",
        "file": "preflight-chain--cheap-first.mp4",
        "endStill": "preflight-chain--cheap-first-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.38,
        "beatNodes": [
          "loop",
          "schema"
        ]
      },
      {
        "id": "semantic-check",
        "label": "工具自检 validateInput",
        "file": "preflight-chain--semantic-check.mp4",
        "endStill": "preflight-chain--semantic-check-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.23,
        "beatNodes": [
          "schema",
          "toolself"
        ]
      },
      {
        "id": "mid-gate",
        "label": "前置节点把关居中",
        "file": "preflight-chain--mid-gate.mp4",
        "endStill": "preflight-chain--mid-gate-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "toolself",
          "hook",
          "perm"
        ]
      },
      {
        "id": "ask-last",
        "label": "签字最后 → 执行",
        "file": "preflight-chain--ask-last.mp4",
        "endStill": "preflight-chain--ask-last-end.png",
        "beats": 3,
        "leadSec": 0.52,
        "storySec": 3.37,
        "beatNodes": [
          "perm",
          "desk",
          "loop"
        ]
      }
    ]
  },
  "stop-guard": {
    "slug": "stop-guard",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "recall-loop",
        "label": "无防护：拉回再拉回",
        "file": "stop-guard--recall-loop.mp4",
        "endStill": "stop-guard--recall-loop-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 6.06,
        "beatNodes": [
          "pull",
          "run",
          "loop"
        ]
      },
      {
        "id": "cap-100",
        "label": "无防护：冲到 100 条封顶",
        "file": "stop-guard--cap-100.mp4",
        "endStill": "stop-guard--cap-100-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.23,
        "beatNodes": [
          "loop",
          "cap"
        ]
      },
      {
        "id": "guard-flag",
        "label": "保险一：标志位带标重入",
        "file": "stop-guard--guard-flag.mp4",
        "endStill": "stop-guard--guard-flag-end.png",
        "beats": 2,
        "leadSec": 0.64,
        "storySec": 3.74,
        "beatNodes": [
          "run",
          "flag"
        ]
      },
      {
        "id": "guard-cap8",
        "label": "保险二：8 次连续续跑硬停",
        "file": "stop-guard--guard-cap8.mp4",
        "endStill": "stop-guard--guard-cap8-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.28,
        "beatNodes": [
          "count",
          "hard8"
        ]
      },
      {
        "id": "stop-clean",
        "label": "对照：3 条内干净停机",
        "file": "stop-guard--stop-clean.mp4",
        "endStill": "stop-guard--stop-clean-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.34,
        "beatNodes": [
          "cap",
          "hard8",
          "clean"
        ]
      }
    ]
  },
  "stop-reason-race": {
    "slug": "stop-reason-race",
    "type": "sequence",
    "chapters": [
      {
        "id": "stream-order",
        "label": "① 内容块与停止标记不是同时到",
        "file": "stop-reason-race--stream-order.mp4",
        "endStill": "stop-reason-race--stream-order-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.96,
        "beatNodes": [
          "stream",
          "loopstop",
          "loopblock"
        ]
      },
      {
        "id": "stop-late",
        "label": "② 信标记侧：迟到当成没开单",
        "file": "stop-reason-race--stop-late.mp4",
        "endStill": "stop-reason-race--stop-late-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "stream",
          "loopstop"
        ]
      },
      {
        "id": "stop-die",
        "label": "③ 信标记侧：1 轮即停 0 工具",
        "file": "stop-reason-race--stop-die.mp4",
        "endStill": "stop-reason-race--stop-die-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "loopstop",
          "task"
        ]
      },
      {
        "id": "block-live",
        "label": "④ 看内容块侧：3 轮 2 工具跑完",
        "file": "stop-reason-race--block-live.mp4",
        "endStill": "stop-reason-race--block-live-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.71,
        "beatNodes": [
          "loopblock",
          "stream",
          "task"
        ]
      },
      {
        "id": "verdict",
        "label": "⑤ 判据要看不会迟到的事实",
        "file": "stop-reason-race--verdict.mp4",
        "endStill": "stop-reason-race--verdict-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.25,
        "beatNodes": [
          "stream",
          "loopblock"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
