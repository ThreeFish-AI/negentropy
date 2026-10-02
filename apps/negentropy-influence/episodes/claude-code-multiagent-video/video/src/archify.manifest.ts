// 占位 manifest——由 to-video scripts/archify_manifest.py 在录制后覆写（请勿手改）。
// 本占位仅解 tsc：slug/type/章节 id/beatNodes 与 views/*.json 一致；leadSec/storySec 为口径估值。

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

export const ARCHIFY = {
  "claim-guards-break": {
    "slug": "claim-guards-break",
    "type": "dataflow",
    "chapters": [
      {
        "id": "three-gates",
        "label": "三守卫",
        "file": "claim-guards-break--three-gates.mp4",
        "endStill": "claim-guards-break--three-gates-end.png",
        "beats": 5,
        "leadSec": 1.6,
        "storySec": 5.5,
        "beatNodes": [
          "scan",
          "g-status",
          "g-owner",
          "g-deps",
          "write-name"
        ]
      },
      {
        "id": "b1",
        "label": "拆守卫三",
        "file": "claim-guards-break--b1.mp4",
        "endStill": "claim-guards-break--b1-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "b1-lane",
          "g-deps"
        ]
      },
      {
        "id": "b2-b2v",
        "label": "拆守卫一二",
        "file": "claim-guards-break--b2-b2v.mp4",
        "endStill": "claim-guards-break--b2-b2v-end.png",
        "beats": 4,
        "leadSec": 1.6,
        "storySec": 4.4,
        "beatNodes": [
          "b2-lane",
          "b2v-lane",
          "g-owner",
          "g-status"
        ]
      },
      {
        "id": "ok",
        "label": "对照：在位",
        "file": "claim-guards-break--ok.mp4",
        "endStill": "claim-guards-break--ok-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "ok-lane",
          "reject"
        ]
      }
    ]
  },
  "claim-race-window": {
    "slug": "claim-race-window",
    "type": "sequence",
    "chapters": [
      {
        "id": "two-lifelines",
        "label": "双生命线",
        "file": "claim-race-window--two-lifelines.mp4",
        "endStill": "claim-race-window--two-lifelines-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "alice",
          "bob"
        ]
      },
      {
        "id": "interleaved",
        "label": "交错检查",
        "file": "claim-race-window--interleaved.mp4",
        "endStill": "claim-race-window--interleaved-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "alice",
          "bob"
        ]
      },
      {
        "id": "overwrite",
        "label": "落笔重叠",
        "file": "claim-race-window--overwrite.mp4",
        "endStill": "claim-race-window--overwrite-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "bob",
          "board"
        ]
      },
      {
        "id": "window",
        "label": "竞争窗口",
        "file": "claim-race-window--window.mp4",
        "endStill": "claim-race-window--window-end.png",
        "beats": 3,
        "leadSec": 1.6,
        "storySec": 3.3,
        "beatNodes": [
          "alice",
          "bob",
          "board"
        ]
      }
    ]
  },
  "collab-panorama": {
    "slug": "collab-panorama",
    "type": "dataflow",
    "chapters": [
      {
        "id": "four-prep",
        "label": "调模型前四道准备",
        "file": "collab-panorama--four-prep.mp4",
        "endStill": "collab-panorama--four-prep-end.png",
        "beats": 4,
        "leadSec": 1.6,
        "storySec": 4.4,
        "beatNodes": [
          "input",
          "inject",
          "compact",
          "assemble"
        ]
      },
      {
        "id": "llm-judge",
        "label": "单岔口判据",
        "file": "collab-panorama--llm-judge.mp4",
        "endStill": "collab-panorama--llm-judge-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "llm",
          "decide"
        ]
      },
      {
        "id": "dispatch",
        "label": "权限与三分发",
        "file": "collab-panorama--dispatch.mp4",
        "endStill": "collab-panorama--dispatch-end.png",
        "beats": 4,
        "leadSec": 1.6,
        "storySec": 4.4,
        "beatNodes": [
          "gate",
          "dispatch",
          "writeback",
          "stop"
        ]
      },
      {
        "id": "externals",
        "label": "循环外的外部状态",
        "file": "collab-panorama--externals.mp4",
        "endStill": "collab-panorama--externals-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "background",
          "shared"
        ]
      }
    ]
  },
  "dependency-failclosed": {
    "slug": "dependency-failclosed",
    "type": "workflow",
    "chapters": [
      {
        "id": "four-cards",
        "label": "四卡上墙",
        "file": "dependency-failclosed--four-cards.mp4",
        "endStill": "dependency-failclosed--four-cards-end.png",
        "beats": 4,
        "leadSec": 1.6,
        "storySec": 4.4,
        "beatNodes": [
          "t-build",
          "t-api",
          "t-test",
          "t-doc"
        ]
      },
      {
        "id": "walkthrough",
        "label": "走查",
        "file": "dependency-failclosed--walkthrough.mp4",
        "endStill": "dependency-failclosed--walkthrough-end.png",
        "beats": 3,
        "leadSec": 1.6,
        "storySec": 3.3,
        "beatNodes": [
          "guard",
          "t-build",
          "unlock"
        ]
      },
      {
        "id": "blocked",
        "label": "被阻塞",
        "file": "dependency-failclosed--blocked.mp4",
        "endStill": "dependency-failclosed--blocked-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "t-test",
          "guard"
        ]
      },
      {
        "id": "failclosed",
        "label": "失败关闭",
        "file": "dependency-failclosed--failclosed.mp4",
        "endStill": "dependency-failclosed--failclosed-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "ghost-ref",
          "guard"
        ]
      }
    ]
  },
  "duty-clock-loop": {
    "slug": "duty-clock-loop",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "three-states",
        "label": "三态节奏",
        "file": "duty-clock-loop--three-states.mp4",
        "endStill": "duty-clock-loop--three-states-end.png",
        "beats": 3,
        "leadSec": 1.6,
        "storySec": 3.3,
        "beatNodes": [
          "work",
          "idle",
          "shutdown"
        ]
      },
      {
        "id": "tick-order",
        "label": "先口后墙",
        "file": "duty-clock-loop--tick-order.mp4",
        "endStill": "duty-clock-loop--tick-order-end.png",
        "beats": 3,
        "leadSec": 1.6,
        "storySec": 3.3,
        "beatNodes": [
          "tick",
          "look-slot",
          "look-wall"
        ]
      },
      {
        "id": "timeout",
        "label": "超时收工",
        "file": "duty-clock-loop--timeout.mp4",
        "endStill": "duty-clock-loop--timeout-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "timeout",
          "shutdown"
        ]
      },
      {
        "id": "b5",
        "label": "拆超时",
        "file": "duty-clock-loop--b5.mp4",
        "endStill": "duty-clock-loop--b5-end.png",
        "beats": 1,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "b5-spin"
        ]
      }
    ]
  },
  "five-layer-dependency": {
    "slug": "five-layer-dependency",
    "type": "architecture",
    "chapters": [
      {
        "id": "five-lit-finale",
        "label": "五层全亮",
        "file": "five-layer-dependency--five-lit-finale.mp4",
        "endStill": "five-layer-dependency--five-lit-finale-end.png",
        "beats": 6,
        "leadSec": 1.6,
        "storySec": 6.6,
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
  "mailslot-consume": {
    "slug": "mailslot-consume",
    "type": "workflow",
    "chapters": [
      {
        "id": "append",
        "label": "追加一行",
        "file": "mailslot-consume--append.mp4",
        "endStill": "mailslot-consume--append-end.png",
        "beats": 4,
        "leadSec": 1.6,
        "storySec": 4.4,
        "beatNodes": [
          "sender",
          "slot-door",
          "inbox-file",
          "append"
        ]
      },
      {
        "id": "take-all",
        "label": "整摞取走",
        "file": "mailslot-consume--take-all.mp4",
        "endStill": "mailslot-consume--take-all-end.png",
        "beats": 3,
        "leadSec": 1.6,
        "storySec": 3.3,
        "beatNodes": [
          "take-all",
          "peek",
          "inbox-file"
        ]
      },
      {
        "id": "wake",
        "label": "楼替人盯口",
        "file": "mailslot-consume--wake.mp4",
        "endStill": "mailslot-consume--wake-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "wake",
          "queue-merge"
        ]
      },
      {
        "id": "b3",
        "label": "拆消费语义",
        "file": "mailslot-consume--b3.mp4",
        "endStill": "mailslot-consume--b3-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "b3-loop",
          "ok-lane"
        ]
      }
    ]
  },
  "receipt-fsm": {
    "slug": "receipt-fsm",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "approve-reject",
        "label": "一套状态机",
        "file": "receipt-fsm--approve-reject.mp4",
        "endStill": "receipt-fsm--approve-reject-end.png",
        "beats": 4,
        "leadSec": 1.6,
        "storySec": 4.4,
        "beatNodes": [
          "pending",
          "approved",
          "rejected",
          "type-check"
        ]
      }
    ]
  },
  "receipt-ledger": {
    "slug": "receipt-ledger",
    "type": "sequence",
    "chapters": [
      {
        "id": "roundtrip",
        "label": "单号往返",
        "file": "receipt-ledger--roundtrip.mp4",
        "endStill": "receipt-ledger--roundtrip-end.png",
        "beats": 3,
        "leadSec": 1.6,
        "storySec": 3.3,
        "beatNodes": [
          "requester",
          "responder",
          "ledger-book"
        ]
      },
      {
        "id": "three-checks",
        "label": "三道核验",
        "file": "receipt-ledger--three-checks.mp4",
        "endStill": "receipt-ledger--three-checks-end.png",
        "beats": 3,
        "leadSec": 1.6,
        "storySec": 3.3,
        "beatNodes": [
          "v-id",
          "v-type",
          "v-pending"
        ]
      },
      {
        "id": "settle",
        "label": "销账",
        "file": "receipt-ledger--settle.mp4",
        "endStill": "receipt-ledger--settle-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "ledger-book",
          "requester"
        ]
      },
      {
        "id": "b4",
        "label": "拆核验",
        "file": "receipt-ledger--b4.mp4",
        "endStill": "receipt-ledger--b4-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "responder",
          "ledger-book"
        ]
      }
    ]
  },
  "room-ledger-bind": {
    "slug": "room-ledger-bind",
    "type": "architecture",
    "chapters": [
      {
        "id": "ledger",
        "label": "中央账本",
        "file": "room-ledger-bind--ledger.mp4",
        "endStill": "room-ledger-bind--ledger-end.png",
        "beats": 3,
        "leadSec": 1.6,
        "storySec": 3.3,
        "beatNodes": [
          "repo-ledger",
          "history",
          "commit"
        ]
      },
      {
        "id": "branches",
        "label": "各改各的线",
        "file": "room-ledger-bind--branches.mp4",
        "endStill": "room-ledger-bind--branches-end.png",
        "beats": 4,
        "leadSec": 1.6,
        "storySec": 4.4,
        "beatNodes": [
          "branch-line",
          "room-1",
          "room-2",
          "room-3"
        ]
      },
      {
        "id": "bind",
        "label": "房号绑定",
        "file": "room-ledger-bind--bind.mp4",
        "endStill": "room-ledger-bind--bind-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "bind-field",
          "task-card"
        ]
      },
      {
        "id": "namecheck",
        "label": "名字校验",
        "file": "room-ledger-bind--namecheck.mp4",
        "endStill": "room-ledger-bind--namecheck-end.png",
        "beats": 1,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "name-check"
        ]
      }
    ]
  },
  "room-teardown": {
    "slug": "room-teardown",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "entry",
        "label": "默认不拆",
        "file": "room-teardown--entry.mp4",
        "endStill": "room-teardown--entry-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "teardown-entry",
          "count-check"
        ]
      },
      {
        "id": "refuse",
        "label": "拒拆",
        "file": "room-teardown--refuse.mp4",
        "endStill": "room-teardown--refuse-end.png",
        "beats": 3,
        "leadSec": 1.6,
        "storySec": 3.3,
        "beatNodes": [
          "dirty",
          "unknown",
          "refuse"
        ]
      },
      {
        "id": "force-keep",
        "label": "强删或保留",
        "file": "room-teardown--force-keep.mp4",
        "endStill": "room-teardown--force-keep-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "force-del",
          "keep"
        ]
      },
      {
        "id": "audit",
        "label": "事件日志",
        "file": "room-teardown--audit.mp4",
        "endStill": "room-teardown--audit-end.png",
        "beats": 1,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "audit-log"
        ]
      }
    ]
  },
  "seven-artifacts": {
    "slug": "seven-artifacts",
    "type": "architecture",
    "chapters": [
      {
        "id": "overview",
        "label": "一栋小楼总览",
        "file": "seven-artifacts--overview.mp4",
        "endStill": "seven-artifacts--overview-end.png",
        "beats": 3,
        "leadSec": 1.6,
        "storySec": 3.3,
        "beatNodes": [
          "building",
          "masters",
          "captain"
        ]
      },
      {
        "id": "public-five",
        "label": "楼下五设施",
        "file": "seven-artifacts--public-five.mp4",
        "endStill": "seven-artifacts--public-five-end.png",
        "beats": 6,
        "leadSec": 1.6,
        "storySec": 6.6,
        "beatNodes": [
          "floor-public",
          "wall",
          "slot",
          "ledger",
          "clock",
          "socket"
        ]
      },
      {
        "id": "private-rooms",
        "label": "楼上房带",
        "file": "seven-artifacts--private-rooms.mp4",
        "endStill": "seven-artifacts--private-rooms-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "floor-private",
          "rooms"
        ]
      },
      {
        "id": "corridor",
        "label": "第七件：走廊",
        "file": "seven-artifacts--corridor.mp4",
        "endStill": "seven-artifacts--corridor-end.png",
        "beats": 1,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "corridor"
        ]
      }
    ]
  },
  "socket-pool": {
    "slug": "socket-pool",
    "type": "dataflow",
    "chapters": [
      {
        "id": "connect-discover",
        "label": "连接与发现",
        "file": "socket-pool--connect-discover.mp4",
        "endStill": "socket-pool--connect-discover-end.png",
        "beats": 4,
        "leadSec": 1.6,
        "storySec": 4.4,
        "beatNodes": [
          "ext-docs",
          "ext-deploy",
          "connect",
          "discover"
        ]
      },
      {
        "id": "prefix",
        "label": "挂牌防撞",
        "file": "socket-pool--prefix.mp4",
        "endStill": "socket-pool--prefix-end.png",
        "beats": 5,
        "leadSec": 1.6,
        "storySec": 5.5,
        "beatNodes": [
          "prefix-rule",
          "tool-docs",
          "tool-status",
          "tool-trigger",
          "pool"
        ]
      },
      {
        "id": "rebuild",
        "label": "每轮重组",
        "file": "socket-pool--rebuild.mp4",
        "endStill": "socket-pool--rebuild-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "rebuild",
          "pool"
        ]
      },
      {
        "id": "stale",
        "label": "旧清单叫空",
        "file": "socket-pool--stale.mp4",
        "endStill": "socket-pool--stale-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "stale-call",
          "cache-note"
        ]
      }
    ]
  },
  "task-card-anatomy": {
    "slug": "task-card-anatomy",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "card-fields",
        "label": "六字段",
        "file": "task-card-anatomy--card-fields.mp4",
        "endStill": "task-card-anatomy--card-fields-end.png",
        "beats": 7,
        "leadSec": 1.6,
        "storySec": 7.7,
        "beatNodes": [
          "card",
          "f-id",
          "f-title",
          "f-desc",
          "f-status",
          "f-owner",
          "f-blockedby"
        ]
      },
      {
        "id": "three-states",
        "label": "三态",
        "file": "task-card-anatomy--three-states.mp4",
        "endStill": "task-card-anatomy--three-states-end.png",
        "beats": 3,
        "leadSec": 1.6,
        "storySec": 3.3,
        "beatNodes": [
          "st-pending",
          "st-progress",
          "st-done"
        ]
      },
      {
        "id": "two-actions",
        "label": "两动作",
        "file": "task-card-anatomy--two-actions.mp4",
        "endStill": "task-card-anatomy--two-actions-end.png",
        "beats": 2,
        "leadSec": 1.6,
        "storySec": 3.2,
        "beatNodes": [
          "act-claim",
          "act-complete"
        ]
      }
    ]
  }
} as const;

export type ArchifySlug = keyof typeof ARCHIFY;
