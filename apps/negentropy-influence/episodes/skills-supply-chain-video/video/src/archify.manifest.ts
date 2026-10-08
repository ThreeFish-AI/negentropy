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
  "dual-harbor": {
    "slug": "dual-harbor",
    "type": "architecture",
    "chapters": [
      {
        "id": "dh-frozen",
        "label": "左港冻结",
        "file": "dual-harbor--dh-frozen.mp4",
        "endStill": "dual-harbor--dh-frozen-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "n1",
          "n2",
          "n3",
          "n4"
        ]
      },
      {
        "id": "dh-81",
        "label": "右港航线",
        "file": "dual-harbor--dh-81.mp4",
        "endStill": "dual-harbor--dh-81-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "m1",
          "m2"
        ]
      },
      {
        "id": "dh-veto",
        "label": "四理由否决",
        "file": "dual-harbor--dh-veto.mp4",
        "endStill": "dual-harbor--dh-veto-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "m2",
          "m3"
        ]
      },
      {
        "id": "dh-final",
        "label": "砍小定稿",
        "file": "dual-harbor--dh-final.mp4",
        "endStill": "dual-harbor--dh-final-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "m2",
          "m3",
          "m4"
        ]
      },
      {
        "id": "dh-bridge",
        "label": "唯一的桥",
        "file": "dual-harbor--dh-bridge.mp4",
        "endStill": "dual-harbor--dh-bridge-end.png",
        "beats": 4,
        "leadSec": 0.48,
        "storySec": 4.47,
        "beatNodes": [
          "bridge",
          "n2",
          "m1",
          "customs"
        ]
      }
    ]
  },
  "enforcement-gap": {
    "slug": "enforcement-gap",
    "type": "workflow",
    "chapters": [
      {
        "id": "eg-must",
        "label": "纸面条款",
        "file": "enforcement-gap--eg-must.mp4",
        "endStill": "enforcement-gap--eg-must-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "must",
          "ignore"
        ]
      },
      {
        "id": "eg-npm",
        "label": "保税仓解",
        "file": "enforcement-gap--eg-npm.mp4",
        "endStill": "enforcement-gap--eg-npm-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "ignore",
          "npmreg",
          "noreg"
        ]
      },
      {
        "id": "eg-chat",
        "label": "离港断链",
        "file": "enforcement-gap--eg-chat.mp4",
        "endStill": "enforcement-gap--eg-chat-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "paste",
          "chainlost",
          "onlypack"
        ]
      }
    ]
  },
  "four-cracks": {
    "slug": "four-cracks",
    "type": "dataflow",
    "chapters": [
      {
        "id": "fc-soft404",
        "label": "查无此货",
        "file": "four-cracks--fc-soft404.mp4",
        "endStill": "four-cracks--fc-soft404-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "leiruz",
          "soft404",
          "legal"
        ]
      },
      {
        "id": "fc-units",
        "label": "单位未定义",
        "file": "four-cracks--fc-units.mp4",
        "endStill": "four-cracks--fc-units-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "leiruz",
          "units",
          "emoji"
        ]
      },
      {
        "id": "fc-schema",
        "label": "三个答案",
        "file": "four-cracks--fc-schema.mp4",
        "endStill": "four-cracks--fc-schema-end.png",
        "beats": 5,
        "leadSec": 0.48,
        "storySec": 5.53,
        "beatNodes": [
          "idx",
          "cf",
          "p254",
          "vercel",
          "unsat"
        ]
      }
    ]
  },
  "four-gates": {
    "slug": "four-gates",
    "type": "workflow",
    "chapters": [
      {
        "id": "fg-gemini",
        "label": "唯一真卡",
        "file": "four-gates--fg-gemini.mp4",
        "endStill": "four-gates--fg-gemini-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "skill",
          "g1",
          "g2"
        ]
      },
      {
        "id": "fg-trust",
        "label": "信任不拦",
        "file": "four-gates--fg-trust.mp4",
        "endStill": "four-gates--fg-trust-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "skill",
          "c1"
        ]
      },
      {
        "id": "fg-chain",
        "label": "预授权直通",
        "file": "four-gates--fg-chain.mp4",
        "endStill": "four-gates--fg-chain-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "c1",
          "c2",
          "c3"
        ]
      },
      {
        "id": "fg-explicit",
        "label": "明文被拒",
        "file": "four-gates--fg-explicit.mp4",
        "endStill": "four-gates--fg-explicit-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "c2",
          "x1",
          "x2"
        ]
      }
    ]
  },
  "grep-verdict": {
    "slug": "grep-verdict",
    "type": "sequence",
    "chapters": [
      {
        "id": "gv-cmd",
        "label": "取规范",
        "file": "grep-verdict--gv-cmd.mp4",
        "endStill": "grep-verdict--gv-cmd-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "term",
          "spec"
        ]
      },
      {
        "id": "gv-stems",
        "label": "八词干",
        "file": "grep-verdict--gv-stems.mp4",
        "endStill": "grep-verdict--gv-stems-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "term",
          "grep"
        ]
      },
      {
        "id": "gv-hit",
        "label": "唯一命中",
        "file": "grep-verdict--gv-hit.mp4",
        "endStill": "grep-verdict--gv-hit-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "grep",
          "spec"
        ]
      },
      {
        "id": "gv-designed",
        "label": "藏在单词里",
        "file": "grep-verdict--gv-designed.mp4",
        "endStill": "grep-verdict--gv-designed-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "spec",
          "grep",
          "term"
        ]
      }
    ]
  },
  "history-cliff": {
    "slug": "history-cliff",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "hc-npm",
        "label": "npm 八年",
        "file": "history-cliff--hc-npm.mp4",
        "endStill": "history-cliff--hc-npm-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.31,
        "beatNodes": [
          "npm-start",
          "npm-eight",
          "event-stream"
        ]
      },
      {
        "id": "hc-six",
        "label": "六个月",
        "file": "history-cliff--hc-six.mp4",
        "endStill": "history-cliff--hc-six-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "skills-open",
          "cliff",
          "event-stream"
        ]
      },
      {
        "id": "hc-three",
        "label": "三场战争",
        "file": "history-cliff--hc-three.mp4",
        "endStill": "history-cliff--hc-three-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.47,
        "beatNodes": [
          "cliff",
          "war-dist",
          "war-sign",
          "war-ver"
        ]
      }
    ]
  },
  "honest-boundary": {
    "slug": "honest-boundary",
    "type": "dataflow",
    "chapters": [
      {
        "id": "hb-mustnot",
        "label": "自认边界",
        "file": "honest-boundary--hb-mustnot.mp4",
        "endStill": "honest-boundary--hb-mustnot-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "srv",
          "gw",
          "sep"
        ]
      },
      {
        "id": "hb-partial",
        "label": "三家部分",
        "file": "honest-boundary--hb-partial.mp4",
        "endStill": "honest-boundary--hb-partial-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.47,
        "beatNodes": [
          "matrix",
          "chatgpt",
          "fast",
          "insp"
        ]
      },
      {
        "id": "hb-proto",
        "label": "内部原型",
        "file": "honest-boundary--hb-proto.mp4",
        "endStill": "honest-boundary--hb-proto-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "sep",
          "proto"
        ]
      },
      {
        "id": "hb-546",
        "label": "报关无人签",
        "file": "honest-boundary--hb-546.mp4",
        "endStill": "honest-boundary--hb-546-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "sep",
          "pr546"
        ]
      }
    ]
  },
  "invisible-ink": {
    "slug": "invisible-ink",
    "type": "sequence",
    "chapters": [
      {
        "id": "ii-tag",
        "label": "隐形墨水",
        "file": "invisible-ink--ii-tag.mp4",
        "endStill": "invisible-ink--ii-tag-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "atk",
          "screen",
          "model"
        ]
      },
      {
        "id": "ii-calc",
        "label": "三分钟不修",
        "file": "invisible-ink--ii-calc.mp4",
        "endStill": "invisible-ink--ii-calc-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "model",
          "screen",
          "atk",
          "vrp"
        ]
      },
      {
        "id": "ii-replay",
        "label": "复刻实验",
        "file": "invisible-ink--ii-replay.mp4",
        "endStill": "invisible-ink--ii-replay-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "atk",
          "screen"
        ]
      },
      {
        "id": "ii-typo",
        "label": "一字母之差",
        "file": "invisible-ink--ii-typo.mp4",
        "endStill": "invisible-ink--ii-typo-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "atk",
          "model"
        ]
      }
    ]
  },
  "ious-route": {
    "slug": "ious-route",
    "type": "workflow",
    "chapters": [
      {
        "id": "ir-sign",
        "label": "签名欠条",
        "file": "ious-route--ir-sign.mp4",
        "endStill": "ious-route--ir-sign-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "s1",
          "st1"
        ]
      },
      {
        "id": "ir-stack",
        "label": "三层信任栈",
        "file": "ious-route--ir-stack.mp4",
        "endStill": "ious-route--ir-stack-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.37,
        "beatNodes": [
          "s1",
          "s2",
          "s3"
        ]
      },
      {
        "id": "ir-dist",
        "label": "分发欠条",
        "file": "ious-route--ir-dist.mp4",
        "endStill": "ious-route--ir-dist-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.34,
        "beatNodes": [
          "d1",
          "d2",
          "d3"
        ]
      },
      {
        "id": "ir-404",
        "label": "舱单实测",
        "file": "ious-route--ir-404.mp4",
        "endStill": "ious-route--ir-404-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "d2",
          "dcurl",
          "d3"
        ]
      },
      {
        "id": "ir-vers",
        "label": "版本欠条",
        "file": "ious-route--ir-vers.mp4",
        "endStill": "ious-route--ir-vers-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.42,
        "beatNodes": [
          "v1",
          "v2",
          "v3",
          "v4"
        ]
      }
    ]
  },
  "lockfile-orphan": {
    "slug": "lockfile-orphan",
    "type": "workflow",
    "chapters": [
      {
        "id": "lo-four",
        "label": "四件套",
        "file": "lockfile-orphan--lo-four.mp4",
        "endStill": "lockfile-orphan--lo-four-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "a1",
          "b1"
        ]
      },
      {
        "id": "lo-flip",
        "label": "自我推翻",
        "file": "lockfile-orphan--lo-flip.mp4",
        "endStill": "lockfile-orphan--lo-flip-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "a1",
          "a2"
        ]
      },
      {
        "id": "lo-rollback",
        "label": "回滚盲区",
        "file": "lockfile-orphan--lo-rollback.mp4",
        "endStill": "lockfile-orphan--lo-rollback-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "a2",
          "a3"
        ]
      },
      {
        "id": "lo-lock",
        "label": "锁文件",
        "file": "lockfile-orphan--lo-lock.mp4",
        "endStill": "lockfile-orphan--lo-lock-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "a3",
          "b1"
        ]
      },
      {
        "id": "lo-orphan",
        "label": "孤本",
        "file": "lockfile-orphan--lo-orphan.mp4",
        "endStill": "lockfile-orphan--lo-orphan-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.47,
        "beatNodes": [
          "b1",
          "b2",
          "c1",
          "c2"
        ]
      }
    ]
  },
  "lockstep-race": {
    "slug": "lockstep-race",
    "type": "sequence",
    "chapters": [
      {
        "id": "lr-t0",
        "label": "锁步竞态",
        "file": "lockstep-race--lr-t0.mp4",
        "endStill": "lockstep-race--lr-t0-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "client",
          "index"
        ]
      },
      {
        "id": "lr-race",
        "label": "阴阳舱单",
        "file": "lockstep-race--lr-race.mp4",
        "endStill": "lockstep-race--lr-race-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "server",
          "index",
          "client"
        ]
      },
      {
        "id": "lr-catch",
        "label": "摘要拦截",
        "file": "lockstep-race--lr-catch.mp4",
        "endStill": "lockstep-race--lr-catch-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "client",
          "index"
        ]
      }
    ]
  },
  "manifest-anatomy": {
    "slug": "manifest-anatomy",
    "type": "architecture",
    "chapters": [
      {
        "id": "ma-old",
        "label": "旧姿势",
        "file": "manifest-anatomy--ma-old.mp4",
        "endStill": "manifest-anatomy--ma-old-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "client",
          "old"
        ]
      },
      {
        "id": "ma-index",
        "label": "总舱单",
        "file": "manifest-anatomy--ma-index.mp4",
        "endStill": "manifest-anatomy--ma-index-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "client",
          "index"
        ]
      },
      {
        "id": "ma-fields",
        "label": "五字段",
        "file": "manifest-anatomy--ma-fields.mp4",
        "endStill": "manifest-anatomy--ma-fields-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "index",
          "fields"
        ]
      },
      {
        "id": "ma-seal",
        "label": "铅封",
        "file": "manifest-anatomy--ma-seal.mp4",
        "endStill": "manifest-anatomy--ma-seal-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "fields",
          "seal"
        ]
      },
      {
        "id": "ma-boxes",
        "label": "两种箱型",
        "file": "manifest-anatomy--ma-boxes.mp4",
        "endStill": "manifest-anatomy--ma-boxes-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "resolve",
          "skillmd",
          "archive"
        ]
      }
    ]
  },
  "port-no-customs": {
    "slug": "port-no-customs",
    "type": "architecture",
    "chapters": [
      {
        "id": "pn-46",
        "label": "箱体互认",
        "file": "port-no-customs--pn-46.mp4",
        "endStill": "port-no-customs--pn-46-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "fmt",
          "clients"
        ]
      },
      {
        "id": "pn-gap",
        "label": "刻意留白",
        "file": "port-no-customs--pn-gap.mp4",
        "endStill": "port-no-customs--pn-gap-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "spec",
          "iou-sign",
          "iou-dist",
          "iou-ver"
        ]
      },
      {
        "id": "pn-toxic",
        "label": "投毒到账",
        "file": "port-no-customs--pn-toxic.mp4",
        "endStill": "port-no-customs--pn-toxic-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "scan",
          "mal"
        ]
      },
      {
        "id": "pn-ious",
        "label": "三张欠条",
        "file": "port-no-customs--pn-ious.mp4",
        "endStill": "port-no-customs--pn-ious-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.53,
        "beatNodes": [
          "iou-sign",
          "iou-dist",
          "iou-ver",
          "mal",
          "clients"
        ]
      }
    ]
  },
  "sep-mechanism": {
    "slug": "sep-mechanism",
    "type": "workflow",
    "chapters": [
      {
        "id": "sm-list",
        "label": "逐文件清单",
        "file": "sep-mechanism--sm-list.mp4",
        "endStill": "sep-mechanism--sm-list-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "res",
          "list",
          "get"
        ]
      },
      {
        "id": "sm-approval",
        "label": "批准锁定",
        "file": "sep-mechanism--sm-approval.mp4",
        "endStill": "sep-mechanism--sm-approval-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "list",
          "approve"
        ]
      },
      {
        "id": "sm-detect",
        "label": "换货可测",
        "file": "sep-mechanism--sm-detect.mp4",
        "endStill": "sep-mechanism--sm-detect-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "swap",
          "get",
          "revoke",
          "consent"
        ]
      },
      {
        "id": "sm-identity",
        "label": "来源命名",
        "file": "sep-mechanism--sm-identity.mp4",
        "endStill": "sep-mechanism--sm-identity-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "list",
          "ident"
        ]
      },
      {
        "id": "sm-gate",
        "label": "预授权闸",
        "file": "sep-mechanism--sm-gate.mp4",
        "endStill": "sep-mechanism--sm-gate-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "tools",
          "consent"
        ]
      }
    ]
  },
  "sigstore-overlap": {
    "slug": "sigstore-overlap",
    "type": "architecture",
    "chapters": [
      {
        "id": "so-map",
        "label": "逐层对位",
        "file": "sigstore-overlap--so-map.mp4",
        "endStill": "sigstore-overlap--so-map-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.57,
        "beatNodes": [
          "l3",
          "rekor",
          "l2",
          "fulcio",
          "prov"
        ]
      },
      {
        "id": "so-reinvent",
        "label": "手工重造",
        "file": "sigstore-overlap--so-reinvent.mp4",
        "endStill": "sigstore-overlap--so-reinvent-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "l1",
          "l2",
          "l3"
        ]
      },
      {
        "id": "so-motive",
        "label": "替换动机",
        "file": "sigstore-overlap--so-motive.mp4",
        "endStill": "sigstore-overlap--so-motive-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "fulcio",
          "rekor",
          "prov"
        ]
      },
      {
        "id": "so-scale",
        "label": "量产对照",
        "file": "sigstore-overlap--so-scale.mp4",
        "endStill": "sigstore-overlap--so-scale-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "npm",
          "pypi",
          "tv",
          "l2"
        ]
      }
    ]
  },
  "three-objections": {
    "slug": "three-objections",
    "type": "workflow",
    "chapters": [
      {
        "id": "to-samedomain",
        "label": "同域质疑",
        "file": "three-objections--to-samedomain.mp4",
        "endStill": "three-objections--to-samedomain-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "prop",
          "o1",
          "c1"
        ]
      },
      {
        "id": "to-footgun",
        "label": "双处同步",
        "file": "three-objections--to-footgun.mp4",
        "endStill": "three-objections--to-footgun-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "o2",
          "c2"
        ]
      },
      {
        "id": "to-pipeline",
        "label": "流水线门槛",
        "file": "three-objections--to-pipeline.mp4",
        "endStill": "three-objections--to-pipeline-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.37,
        "beatNodes": [
          "o3",
          "c3",
          "stall"
        ]
      }
    ]
  },
  "toxic-funnel": {
    "slug": "toxic-funnel",
    "type": "dataflow",
    "chapters": [
      {
        "id": "tf-snyk",
        "label": "厂商扫描",
        "file": "toxic-funnel--tf-snyk.mp4",
        "endStill": "toxic-funnel--tf-snyk-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "snyk",
          "snyk-issue",
          "snyk-mal"
        ]
      },
      {
        "id": "tf-usenix",
        "label": "学术扫描",
        "file": "toxic-funnel--tf-usenix.mp4",
        "endStill": "toxic-funnel--tf-usenix-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "usenix",
          "usenix-mal",
          "brand"
        ]
      },
      {
        "id": "tf-installs",
        "label": "装机量",
        "file": "toxic-funnel--tf-installs.mp4",
        "endStill": "toxic-funnel--tf-installs-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "installer",
          "typo",
          "brand",
          "prereq"
        ]
      },
      {
        "id": "tf-tricks",
        "label": "老三样",
        "file": "toxic-funnel--tf-tricks.mp4",
        "endStill": "toxic-funnel--tf-tricks-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.44,
        "beatNodes": [
          "typo",
          "brand",
          "prereq",
          "malbench"
        ]
      }
    ]
  },
  "trust-stack": {
    "slug": "trust-stack",
    "type": "architecture",
    "chapters": [
      {
        "id": "ts-l1",
        "label": "舱单摘要",
        "file": "trust-stack--ts-l1.mp4",
        "endStill": "trust-stack--ts-l1-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "l1",
          "l1-proof"
        ]
      },
      {
        "id": "ts-l2",
        "label": "随箱签章",
        "file": "trust-stack--ts-l2.mp4",
        "endStill": "trust-stack--ts-l2-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "l2",
          "l2-impl"
        ]
      },
      {
        "id": "ts-proto",
        "label": "原型规模",
        "file": "trust-stack--ts-proto.mp4",
        "endStill": "trust-stack--ts-proto-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "l2-impl",
          "l2-proto"
        ]
      },
      {
        "id": "ts-l3",
        "label": "灯塔见证",
        "file": "trust-stack--ts-l3.mp4",
        "endStill": "trust-stack--ts-l3-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "l3",
          "l3-impl"
        ]
      },
      {
        "id": "ts-count",
        "label": "口径校准",
        "file": "trust-stack--ts-count.mp4",
        "endStill": "trust-stack--ts-count-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "l3-impl",
          "l3-count"
        ]
      }
    ]
  },
  "two-species": {
    "slug": "two-species",
    "type": "dataflow",
    "chapters": [
      {
        "id": "ts2-official",
        "label": "官方示例仓",
        "file": "two-species--ts2-official.mp4",
        "endStill": "two-species--ts2-official-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "std",
          "off-repo",
          "off-push",
          "off-art"
        ]
      },
      {
        "id": "ts2-supabase",
        "label": "逐版发布",
        "file": "two-species--ts2-supabase.mp4",
        "endStill": "two-species--ts2-supabase-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "std",
          "sup-repo",
          "sup-rel",
          "sup-art"
        ]
      }
    ]
  },
  "version-gates": {
    "slug": "version-gates",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "vg-nofield",
        "label": "无版本格",
        "file": "version-gates--vg-nofield.mp4",
        "endStill": "version-gates--vg-nofield-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.44,
        "beatNodes": [
          "spec",
          "layer",
          "computed"
        ]
      },
      {
        "id": "vg-pinned",
        "label": "门一写死",
        "file": "version-gates--vg-pinned.mp4",
        "endStill": "version-gates--vg-pinned-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "computed",
          "pinned",
          "stuck"
        ]
      },
      {
        "id": "vg-floating",
        "label": "门二省略",
        "file": "version-gates--vg-floating.mp4",
        "endStill": "version-gates--vg-floating-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "computed",
          "float",
          "jump"
        ]
      },
      {
        "id": "vg-test",
        "label": "双门实测",
        "file": "version-gates--vg-test.mp4",
        "endStill": "version-gates--vg-test-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.45,
        "beatNodes": [
          "stuck",
          "pintest",
          "jump",
          "floattest"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
