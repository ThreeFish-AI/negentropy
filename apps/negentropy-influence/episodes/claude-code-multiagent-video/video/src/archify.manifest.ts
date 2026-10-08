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
  "board-vs-todo": {
    "slug": "board-vs-todo",
    "type": "architecture",
    "chapters": [
      {
        "id": "todo-vanishes",
        "label": "待办断电即失",
        "file": "board-vs-todo--todo-vanishes.mp4",
        "endStill": "board-vs-todo--todo-vanishes-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "session-todo",
          "power-off",
          "vanish"
        ]
      },
      {
        "id": "two-layers",
        "label": "两层账本",
        "file": "board-vs-todo--two-layers.mp4",
        "endStill": "board-vs-todo--two-layers-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "session-todo",
          "task-graph"
        ]
      },
      {
        "id": "crash-resume",
        "label": "重扫即恢复",
        "file": "board-vs-todo--crash-resume.mp4",
        "endStill": "board-vs-todo--crash-resume-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "disk-dir",
          "rescan",
          "progress-back"
        ]
      }
    ]
  },
  "collab-panorama": {
    "slug": "collab-panorama",
    "type": "dataflow",
    "chapters": [
      {
        "id": "one-to-many",
        "label": "从一个到一群",
        "file": "collab-panorama--one-to-many.mp4",
        "endStill": "collab-panorama--one-to-many-end.png",
        "beats": 4,
        "leadSec": 0.48,
        "storySec": 4.44,
        "beatNodes": [
          "loop",
          "wait",
          "shift",
          "tools"
        ]
      },
      {
        "id": "mech-homecoming",
        "label": "机制归位",
        "file": "collab-panorama--mech-homecoming.mp4",
        "endStill": "collab-panorama--mech-homecoming-end.png",
        "beats": 10,
        "leadSec": 0.36,
        "storySec": 11.38,
        "beatNodes": [
          "post",
          "claim",
          "fetch",
          "match",
          "worktree",
          "wait",
          "gate",
          "shift",
          "tools",
          "loop"
        ]
      },
      {
        "id": "tool-belt-27",
        "label": "二十七件工具",
        "file": "collab-panorama--tool-belt-27.mp4",
        "endStill": "collab-panorama--tool-belt-27-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "tools",
          "loop"
        ]
      },
      {
        "id": "identity-message",
        "label": "身份一：注入的消息",
        "file": "collab-panorama--identity-message.mp4",
        "endStill": "collab-panorama--identity-message-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "fetch",
          "wait",
          "loop"
        ]
      },
      {
        "id": "identity-tool",
        "label": "身份二：架上的工具",
        "file": "collab-panorama--identity-tool.mp4",
        "endStill": "collab-panorama--identity-tool-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "tools",
          "claim",
          "gate"
        ]
      },
      {
        "id": "no-branch",
        "label": "没单开分支",
        "file": "collab-panorama--no-branch.mp4",
        "endStill": "collab-panorama--no-branch-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "loop"
        ]
      },
      {
        "id": "gate-three-beats",
        "label": "计划门三拍",
        "file": "collab-panorama--gate-three-beats.mp4",
        "endStill": "collab-panorama--gate-three-beats-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.25,
        "beatNodes": [
          "gate",
          "loop"
        ]
      },
      {
        "id": "all-lit-map",
        "label": "工坊地图全亮",
        "file": "collab-panorama--all-lit-map.mp4",
        "endStill": "collab-panorama--all-lit-map-end.png",
        "beats": 10,
        "leadSec": 0.44,
        "storySec": 11.54,
        "beatNodes": [
          "post",
          "claim",
          "fetch",
          "match",
          "worktree",
          "wait",
          "gate",
          "shift",
          "tools",
          "loop"
        ]
      }
    ]
  },
  "dependency-unlock": {
    "slug": "dependency-unlock",
    "type": "workflow",
    "chapters": [
      {
        "id": "gate-before-start",
        "label": "依赖坎",
        "file": "dependency-unlock--gate-before-start.mp4",
        "endStill": "dependency-unlock--gate-before-start-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "deps-check",
          "upstream",
          "downstream"
        ]
      },
      {
        "id": "missing-blocked",
        "label": "缺失即被挡",
        "file": "dependency-unlock--missing-blocked.mp4",
        "endStill": "dependency-unlock--missing-blocked-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "missing-dep",
          "blocked"
        ]
      },
      {
        "id": "bad-premise",
        "label": "坏前提不放行",
        "file": "dependency-unlock--bad-premise.mp4",
        "endStill": "dependency-unlock--bad-premise-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.43,
        "beatNodes": [
          "missing-dep",
          "blocked",
          "gate"
        ]
      },
      {
        "id": "unlock-broadcast",
        "label": "解锁即播报",
        "file": "dependency-unlock--unlock-broadcast.mp4",
        "endStill": "dependency-unlock--unlock-broadcast-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 4.08,
        "beatNodes": [
          "completed",
          "unlocked",
          "broadcast"
        ]
      },
      {
        "id": "lag-livelock",
        "label": "忘结单活锁",
        "file": "dependency-unlock--lag-livelock.mp4",
        "endStill": "dependency-unlock--lag-livelock-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.38,
        "beatNodes": [
          "done-unmarked",
          "waiting",
          "loop-edge"
        ]
      }
    ]
  },
  "five-layer-dependency": {
    "slug": "five-layer-dependency",
    "type": "architecture",
    "chapters": [
      {
        "id": "series-vow",
        "label": "系列立碑一闪",
        "file": "five-layer-dependency--series-vow.mp4",
        "endStill": "five-layer-dependency--series-vow-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.24,
        "beatNodes": [
          "loop-core",
          "layer-5"
        ]
      },
      {
        "id": "five-lit-finale",
        "label": "五层全亮",
        "file": "five-layer-dependency--five-lit-finale.mp4",
        "endStill": "five-layer-dependency--five-lit-finale-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.64,
        "beatNodes": [
          "loop-core",
          "layer-1",
          "layer-2",
          "layer-3",
          "layer-4",
          "layer-5"
        ]
      }
    ]
  },
  "idle-claim-loop": {
    "slug": "idle-claim-loop",
    "type": "dataflow",
    "chapters": [
      {
        "id": "three-conditions",
        "label": "三条件合取",
        "file": "idle-claim-loop--three-conditions.mp4",
        "endStill": "idle-claim-loop--three-conditions-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "pending",
          "no-owner",
          "deps-done"
        ]
      },
      {
        "id": "conj-check",
        "label": "三条全中",
        "file": "idle-claim-loop--conj-check.mp4",
        "endStill": "idle-claim-loop--conj-check-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "cond-a",
          "cond-b",
          "cond-c",
          "claim"
        ]
      },
      {
        "id": "deps-read",
        "label": "有依赖不算不合格",
        "file": "idle-claim-loop--deps-read.mp4",
        "endStill": "idle-claim-loop--deps-read-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "deps-list",
          "readable"
        ]
      },
      {
        "id": "blocked-only",
        "label": "只看被挡",
        "file": "idle-claim-loop--blocked-only.mp4",
        "endStill": "idle-claim-loop--blocked-only-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "uncompleted-dep",
          "blocked",
          "free"
        ]
      },
      {
        "id": "verify-receipt",
        "label": "验回执",
        "file": "idle-claim-loop--verify-receipt.mp4",
        "endStill": "idle-claim-loop--verify-receipt-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "claim-call",
          "receipt",
          "inject"
        ]
      },
      {
        "id": "lead-two-jobs",
        "label": "领队两件事",
        "file": "idle-claim-loop--lead-two-jobs.mp4",
        "endStill": "idle-claim-loop--lead-two-jobs-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.47,
        "beatNodes": [
          "lead",
          "create",
          "launch",
          "no-assign"
        ]
      }
    ]
  },
  "mailbox-consume": {
    "slug": "mailbox-consume",
    "type": "workflow",
    "chapters": [
      {
        "id": "inbox-per-seat",
        "label": "门口收件格",
        "file": "mailbox-consume--inbox-per-seat.mp4",
        "endStill": "mailbox-consume--inbox-per-seat-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.27,
        "beatNodes": [
          "seat",
          "inbox-slot"
        ]
      },
      {
        "id": "jsonl-append",
        "label": "添一行即投递",
        "file": "mailbox-consume--jsonl-append.mp4",
        "endStill": "mailbox-consume--jsonl-append-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "inbox-file",
          "append-line"
        ]
      },
      {
        "id": "take-all-clear",
        "label": "整摞拿走",
        "file": "mailbox-consume--take-all-clear.mp4",
        "endStill": "mailbox-consume--take-all-clear-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "inbox-file",
          "consume",
          "emptied"
        ]
      },
      {
        "id": "peek-probe",
        "label": "只看不取",
        "file": "mailbox-consume--peek-probe.mp4",
        "endStill": "mailbox-consume--peek-probe-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "peek",
          "inbox-slot"
        ]
      },
      {
        "id": "host-polling",
        "label": "工坊替他盯",
        "file": "mailbox-consume--host-polling.mp4",
        "endStill": "mailbox-consume--host-polling-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "poller",
          "event-queue",
          "wake"
        ]
      }
    ]
  },
  "mcp-toolpool": {
    "slug": "mcp-toolpool",
    "type": "dataflow",
    "chapters": [
      {
        "id": "standard-socket",
        "label": "标准协议",
        "file": "mcp-toolpool--standard-socket.mp4",
        "endStill": "mcp-toolpool--standard-socket-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "mcp-socket",
          "external"
        ]
      },
      {
        "id": "connect-discover",
        "label": "连接发现两步",
        "file": "mcp-toolpool--connect-discover.mp4",
        "endStill": "mcp-toolpool--connect-discover-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "connect",
          "tools-list"
        ]
      },
      {
        "id": "namespace-rename",
        "label": "统一重新起名",
        "file": "mcp-toolpool--namespace-rename.mp4",
        "endStill": "mcp-toolpool--namespace-rename-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "tool",
          "prefix",
          "renamed"
        ]
      },
      {
        "id": "no-collision",
        "label": "互不冲撞",
        "file": "mcp-toolpool--no-collision.mp4",
        "endStill": "mcp-toolpool--no-collision-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "sanitize",
          "name-a",
          "name-b"
        ]
      },
      {
        "id": "rebuild-each-round",
        "label": "每轮重装",
        "file": "mcp-toolpool--rebuild-each-round.mp4",
        "endStill": "mcp-toolpool--rebuild-each-round-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "pool",
          "assemble",
          "round"
        ]
      },
      {
        "id": "new-machine-next-round",
        "label": "下一轮自然可用",
        "file": "mcp-toolpool--new-machine-next-round.mp4",
        "endStill": "mcp-toolpool--new-machine-next-round-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "new-machine",
          "pool",
          "loop"
        ]
      },
      {
        "id": "stale-list-miss",
        "label": "旧清单叫空",
        "file": "mcp-toolpool--stale-list-miss.mp4",
        "endStill": "mcp-toolpool--stale-list-miss-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "cache-list",
          "call",
          "miss"
        ]
      }
    ]
  },
  "protocol-fsm": {
    "slug": "protocol-fsm",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "one-fsm-two-protocols",
        "label": "一套机制两协议",
        "file": "protocol-fsm--one-fsm-two-protocols.mp4",
        "endStill": "protocol-fsm--one-fsm-two-protocols-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.38,
        "beatNodes": [
          "fsm",
          "shutdown",
          "plan-approval"
        ]
      },
      {
        "id": "plan-handshake",
        "label": "计划递单",
        "file": "protocol-fsm--plan-handshake.mp4",
        "endStill": "protocol-fsm--plan-handshake-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "submit-plan",
          "pending",
          "response"
        ]
      },
      {
        "id": "not-a-gate",
        "label": "不是代码层的门",
        "file": "protocol-fsm--not-a-gate.mp4",
        "endStill": "protocol-fsm--not-a-gate-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "request",
          "note-gate"
        ]
      },
      {
        "id": "self-discipline",
        "label": "靠自觉",
        "file": "protocol-fsm--self-discipline.mp4",
        "endStill": "protocol-fsm--self-discipline-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "waiting",
          "agent"
        ]
      }
    ]
  },
  "protocol-roundtrip": {
    "slug": "protocol-roundtrip",
    "type": "sequence",
    "chapters": [
      {
        "id": "two-copies",
        "label": "一式两份",
        "file": "protocol-roundtrip--two-copies.mp4",
        "endStill": "protocol-roundtrip--two-copies-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.41,
        "beatNodes": [
          "lead",
          "teammate",
          "slip-a",
          "slip-b"
        ]
      },
      {
        "id": "id-roundtrip",
        "label": "编号往返",
        "file": "protocol-roundtrip--id-roundtrip.mp4",
        "endStill": "protocol-roundtrip--id-roundtrip-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "request-id",
          "out",
          "back"
        ]
      },
      {
        "id": "three-checks",
        "label": "三道验证",
        "file": "protocol-roundtrip--three-checks.mp4",
        "endStill": "protocol-roundtrip--three-checks-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "check-id",
          "check-type",
          "check-open"
        ]
      },
      {
        "id": "stale-immune",
        "label": "结案免疫",
        "file": "protocol-roundtrip--stale-immune.mp4",
        "endStill": "protocol-roundtrip--stale-immune-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "closed-slip",
          "dup-reply",
          "reject"
        ]
      },
      {
        "id": "route-before-return",
        "label": "先翻账再交消息",
        "file": "protocol-roundtrip--route-before-return.mp4",
        "endStill": "protocol-roundtrip--route-before-return-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "protocol-ledger",
          "inbox",
          "lead"
        ]
      }
    ]
  },
  "shift-three-beats": {
    "slug": "shift-three-beats",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "three-beats",
        "label": "三拍班次",
        "file": "shift-three-beats--three-beats.mp4",
        "endStill": "shift-three-beats--three-beats-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "work",
          "idle",
          "shutdown"
        ]
      },
      {
        "id": "work-cap",
        "label": "轮数上限",
        "file": "shift-three-beats--work-cap.mp4",
        "endStill": "shift-three-beats--work-cap-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "work",
          "turns-counter"
        ]
      },
      {
        "id": "idle-order",
        "label": "先格子后板",
        "file": "shift-three-beats--idle-order.mp4",
        "endStill": "shift-three-beats--idle-order-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "inbox",
          "board",
          "poll-arrow"
        ]
      },
      {
        "id": "instruction-first",
        "label": "指令在前",
        "file": "shift-three-beats--instruction-first.mp4",
        "endStill": "shift-three-beats--instruction-first-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "inbox",
          "shutdown-request",
          "priority"
        ]
      },
      {
        "id": "timeout-leave",
        "label": "超时下班",
        "file": "shift-three-beats--timeout-leave.mp4",
        "endStill": "shift-three-beats--timeout-leave-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "idle",
          "timeout",
          "summary-slip"
        ]
      },
      {
        "id": "no-fixed-timeout",
        "label": "产品不赶人",
        "file": "shift-three-beats--no-fixed-timeout.mp4",
        "endStill": "shift-three-beats--no-fixed-timeout-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "idle",
          "manual-shutdown"
        ]
      },
      {
        "id": "done-two-ways",
        "label": "报信两数法",
        "file": "shift-three-beats--done-two-ways.mp4",
        "endStill": "shift-three-beats--done-two-ways-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "result-message",
          "idle-notification"
        ]
      }
    ]
  },
  "task-board": {
    "slug": "task-board",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "file-per-task",
        "label": "一文件一活",
        "file": "task-board--file-per-task.mp4",
        "endStill": "task-board--file-per-task-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "task-file",
          "board"
        ]
      },
      {
        "id": "six-fields",
        "label": "六字段齐活",
        "file": "task-board--six-fields.mp4",
        "endStill": "task-board--six-fields-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.68,
        "beatNodes": [
          "id-field",
          "title-field",
          "desc-field",
          "status-field",
          "owner-field",
          "deps-field"
        ]
      },
      {
        "id": "three-states",
        "label": "三态两动作",
        "file": "task-board--three-states.mp4",
        "endStill": "task-board--three-states-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.57,
        "beatNodes": [
          "pending",
          "in-progress",
          "completed",
          "claim",
          "complete"
        ]
      },
      {
        "id": "claim-owner",
        "label": "认领写归属",
        "file": "task-board--claim-owner.mp4",
        "endStill": "task-board--claim-owner-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.37,
        "beatNodes": [
          "claim",
          "owner-field",
          "file-lock"
        ]
      }
    ]
  },
  "worktree-bind": {
    "slug": "worktree-bind",
    "type": "architecture",
    "chapters": [
      {
        "id": "booth-per-task",
        "label": "带门牌隔间",
        "file": "worktree-bind--booth-per-task.mp4",
        "endStill": "worktree-bind--booth-per-task-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "main-repo",
          "booth",
          "nameplate"
        ]
      },
      {
        "id": "copies-branches",
        "label": "副本各挂分支",
        "file": "worktree-bind--copies-branches.mp4",
        "endStill": "worktree-bind--copies-branches-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.47,
        "beatNodes": [
          "worktree-a",
          "branch-a",
          "worktree-b",
          "branch-b"
        ]
      },
      {
        "id": "id-rope",
        "label": "编号绳",
        "file": "worktree-bind--id-rope.mp4",
        "endStill": "worktree-bind--id-rope-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "task-card",
          "rope",
          "booth"
        ]
      },
      {
        "id": "bind-no-status",
        "label": "绑定不改状态",
        "file": "worktree-bind--bind-no-status.mp4",
        "endStill": "worktree-bind--bind-no-status-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "bind-record",
          "pending"
        ]
      },
      {
        "id": "pre-arrange",
        "label": "提前备料",
        "file": "worktree-bind--pre-arrange.mp4",
        "endStill": "worktree-bind--pre-arrange-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "board",
          "booths",
          "prepare"
        ]
      },
      {
        "id": "auto-switch",
        "label": "认领即切目录",
        "file": "worktree-bind--auto-switch.mp4",
        "endStill": "worktree-bind--auto-switch-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "claim",
          "cwd-switch",
          "public-area"
        ]
      }
    ]
  },
  "worktree-teardown": {
    "slug": "worktree-teardown",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "default-keep",
        "label": "默认不拆",
        "file": "worktree-teardown--default-keep.mp4",
        "endStill": "worktree-teardown--default-keep-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "remove-call",
          "refuse"
        ]
      },
      {
        "id": "dirty-refuse",
        "label": "有账拒绝",
        "file": "worktree-teardown--dirty-refuse.mp4",
        "endStill": "worktree-teardown--dirty-refuse-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "uncommitted",
          "unpushed",
          "refuse"
        ]
      },
      {
        "id": "unknown-refuse",
        "label": "查不动也拒",
        "file": "worktree-teardown--unknown-refuse.mp4",
        "endStill": "worktree-teardown--unknown-refuse-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "status-unknown",
          "refuse"
        ]
      },
      {
        "id": "discard-with-branch",
        "label": "强删连分支",
        "file": "worktree-teardown--discard-with-branch.mp4",
        "endStill": "worktree-teardown--discard-with-branch-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "discard",
          "branch",
          "gone"
        ]
      },
      {
        "id": "keep-for-review",
        "label": "保留等审",
        "file": "worktree-teardown--keep-for-review.mp4",
        "endStill": "worktree-teardown--keep-for-review-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "keep",
          "branch",
          "review"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
