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
  "assembly-economics": {
    "slug": "assembly-economics",
    "type": "workflow",
    "chapters": [
      {
        "id": "ae-k1",
        "label": "预算分配",
        "file": "assembly-economics--ae-k1.mp4",
        "endStill": "assembly-economics--ae-k1-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.25,
        "beatNodes": [
          "k1"
        ]
      },
      {
        "id": "ae-k2",
        "label": "渐进披露",
        "file": "assembly-economics--ae-k2.mp4",
        "endStill": "assembly-economics--ae-k2-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.21,
        "beatNodes": [
          "k2"
        ]
      },
      {
        "id": "ae-k3",
        "label": "JIT 边界",
        "file": "assembly-economics--ae-k3.mp4",
        "endStill": "assembly-economics--ae-k3-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.25,
        "beatNodes": [
          "k3"
        ]
      },
      {
        "id": "ae-k4",
        "label": "缓存排序",
        "file": "assembly-economics--ae-k4.mp4",
        "endStill": "assembly-economics--ae-k4-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.24,
        "beatNodes": [
          "k4"
        ]
      },
      {
        "id": "ae-k5",
        "label": "压缩分级",
        "file": "assembly-economics--ae-k5.mp4",
        "endStill": "assembly-economics--ae-k5-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.26,
        "beatNodes": [
          "k5"
        ]
      },
      {
        "id": "ae-ch",
        "label": "双通道",
        "file": "assembly-economics--ae-ch.mp4",
        "endStill": "assembly-economics--ae-ch-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.22,
        "beatNodes": [
          "ch1",
          "ch2"
        ]
      },
      {
        "id": "ae-guard",
        "label": "出口守卫",
        "file": "assembly-economics--ae-guard.mp4",
        "endStill": "assembly-economics--ae-guard-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.25,
        "beatNodes": [
          "fuse",
          "guard"
        ]
      },
      {
        "id": "ae-llm",
        "label": "入窗",
        "file": "assembly-economics--ae-llm.mp4",
        "endStill": "assembly-economics--ae-llm-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.25,
        "beatNodes": [
          "llm"
        ]
      },
      {
        "id": "ae-knobs",
        "label": "五旋钮全景",
        "file": "assembly-economics--ae-knobs.mp4",
        "endStill": "assembly-economics--ae-knobs-end.png",
        "beats": 5,
        "leadSec": 0.0,
        "storySec": 5.56,
        "beatNodes": [
          "k1",
          "k2",
          "k3",
          "k4",
          "k5"
        ]
      }
    ]
  },
  "blueprint--architecture": {
    "slug": "blueprint--architecture",
    "type": "architecture",
    "chapters": [
      {
        "id": "ax-obj",
        "label": "对象轴",
        "file": "blueprint--architecture--ax-obj.mp4",
        "endStill": "blueprint--architecture--ax-obj-end.png",
        "beats": 5,
        "leadSec": 0.0,
        "storySec": 5.52,
        "beatNodes": [
          "src-instruction",
          "src-memory",
          "src-knowledge",
          "src-tools",
          "src-session"
        ]
      },
      {
        "id": "ax-struct",
        "label": "结构轴",
        "file": "blueprint--architecture--ax-struct.mp4",
        "endStill": "blueprint--architecture--ax-struct-end.png",
        "beats": 5,
        "leadSec": 0.0,
        "storySec": 5.57,
        "beatNodes": [
          "layer-object",
          "layer-catalog",
          "layer-enrich",
          "layer-govern",
          "layer-activate"
        ]
      },
      {
        "id": "ax-time",
        "label": "时间轴",
        "file": "blueprint--architecture--ax-time.mp4",
        "endStill": "blueprint--architecture--ax-time-end.png",
        "beats": 5,
        "leadSec": 0.0,
        "storySec": 5.54,
        "beatNodes": [
          "ph-collect",
          "ph-govern",
          "ph-activate",
          "ph-verify",
          "ph-evolve"
        ]
      },
      {
        "id": "ax-accept",
        "label": "验收面",
        "file": "blueprint--architecture--ax-accept.mp4",
        "endStill": "blueprint--architecture--ax-accept-end.png",
        "beats": 10,
        "leadSec": 0.0,
        "storySec": 11.08,
        "beatNodes": [
          "layer-object",
          "layer-catalog",
          "layer-enrich",
          "layer-govern",
          "layer-activate",
          "ph-collect",
          "ph-govern",
          "ph-activate",
          "ph-verify",
          "ph-evolve"
        ]
      }
    ]
  },
  "blueprint--dual-track-roadmap": {
    "slug": "blueprint--dual-track-roadmap",
    "type": "architecture",
    "chapters": [
      {
        "id": "dt-design",
        "label": "共享设计层",
        "file": "blueprint--dual-track-roadmap--dt-design.mp4",
        "endStill": "blueprint--dual-track-roadmap--dt-design-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.24,
        "beatNodes": [
          "design"
        ]
      },
      {
        "id": "dt-show",
        "label": "样板间",
        "file": "blueprint--dual-track-roadmap--dt-show.mp4",
        "endStill": "blueprint--dual-track-roadmap--dt-show-end.png",
        "beats": 4,
        "leadSec": 0.0,
        "storySec": 4.44,
        "beatNodes": [
          "p0",
          "p1",
          "p2",
          "p3"
        ]
      },
      {
        "id": "dt-main",
        "label": "本楼改造",
        "file": "blueprint--dual-track-roadmap--dt-main.mp4",
        "endStill": "blueprint--dual-track-roadmap--dt-main-end.png",
        "beats": 3,
        "leadSec": 0.0,
        "storySec": 3.37,
        "beatNodes": [
          "ph1",
          "ph2",
          "ph3"
        ]
      },
      {
        "id": "dt-p0",
        "label": "P0 已验证",
        "file": "blueprint--dual-track-roadmap--dt-p0.mp4",
        "endStill": "blueprint--dual-track-roadmap--dt-p0-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.21,
        "beatNodes": [
          "p0"
        ]
      }
    ]
  },
  "blueprint--industry-landscape": {
    "slug": "blueprint--industry-landscape",
    "type": "architecture",
    "chapters": [
      {
        "id": "il-routes",
        "label": "四路线",
        "file": "blueprint--industry-landscape--il-routes.mp4",
        "endStill": "blueprint--industry-landscape--il-routes-end.png",
        "beats": 6,
        "leadSec": 0.0,
        "storySec": 6.64,
        "beatNodes": [
          "sf",
          "dbt",
          "cube",
          "atl",
          "bp",
          "palantir"
        ]
      },
      {
        "id": "il-gap",
        "label": "落地断层",
        "file": "blueprint--industry-landscape--il-gap.mp4",
        "endStill": "blueprint--industry-landscape--il-gap-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.24,
        "beatNodes": [
          "gap",
          "agents"
        ]
      }
    ]
  },
  "blueprint--layer-mechanism-map": {
    "slug": "blueprint--layer-mechanism-map",
    "type": "architecture",
    "chapters": [
      {
        "id": "lm-obj",
        "label": "对象层席",
        "file": "blueprint--layer-mechanism-map--lm-obj.mp4",
        "endStill": "blueprint--layer-mechanism-map--lm-obj-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.23,
        "beatNodes": [
          "obj-m",
          "obj-i"
        ]
      },
      {
        "id": "lm-cat",
        "label": "目录层席",
        "file": "blueprint--layer-mechanism-map--lm-cat.mp4",
        "endStill": "blueprint--layer-mechanism-map--lm-cat-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.22,
        "beatNodes": [
          "cat-m",
          "cat-i"
        ]
      },
      {
        "id": "lm-enr",
        "label": "富化层席",
        "file": "blueprint--layer-mechanism-map--lm-enr.mp4",
        "endStill": "blueprint--layer-mechanism-map--lm-enr-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.26,
        "beatNodes": [
          "enr-m",
          "enr-i"
        ]
      },
      {
        "id": "lm-gov",
        "label": "治理层席",
        "file": "blueprint--layer-mechanism-map--lm-gov.mp4",
        "endStill": "blueprint--layer-mechanism-map--lm-gov-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.23,
        "beatNodes": [
          "gov-m",
          "gov-i"
        ]
      },
      {
        "id": "lm-act",
        "label": "激活层席",
        "file": "blueprint--layer-mechanism-map--lm-act.mp4",
        "endStill": "blueprint--layer-mechanism-map--lm-act-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.22,
        "beatNodes": [
          "act-m",
          "act-i"
        ]
      },
      {
        "id": "lm-spine",
        "label": "全脊柱",
        "file": "blueprint--layer-mechanism-map--lm-spine.mp4",
        "endStill": "blueprint--layer-mechanism-map--lm-spine-end.png",
        "beats": 5,
        "leadSec": 0.0,
        "storySec": 5.57,
        "beatNodes": [
          "obj-m",
          "cat-m",
          "enr-m",
          "gov-m",
          "act-m"
        ]
      }
    ]
  },
  "blueprint--mcp-threat-model": {
    "slug": "blueprint--mcp-threat-model",
    "type": "architecture",
    "chapters": [
      {
        "id": "tm-client",
        "label": "客户端环境",
        "file": "blueprint--mcp-threat-model--tm-client.mp4",
        "endStill": "blueprint--mcp-threat-model--tm-client-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.29,
        "beatNodes": [
          "con",
          "agent"
        ]
      },
      {
        "id": "tm-poison",
        "label": "描述投毒",
        "file": "blueprint--mcp-threat-model--tm-poison.mp4",
        "endStill": "blueprint--mcp-threat-model--tm-poison-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.24,
        "beatNodes": [
          "tool-poison"
        ]
      },
      {
        "id": "tm-inject",
        "label": "间接注入",
        "file": "blueprint--mcp-threat-model--tm-inject.mp4",
        "endStill": "blueprint--mcp-threat-model--tm-inject-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.23,
        "beatNodes": [
          "response-injection"
        ]
      },
      {
        "id": "tm-deputy",
        "label": "混淆代理",
        "file": "blueprint--mcp-threat-model--tm-deputy.mp4",
        "endStill": "blueprint--mcp-threat-model--tm-deputy-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.25,
        "beatNodes": [
          "confused-deputy"
        ]
      },
      {
        "id": "tm-token",
        "label": "令牌透传",
        "file": "blueprint--mcp-threat-model--tm-token.mp4",
        "endStill": "blueprint--mcp-threat-model--tm-token-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.23,
        "beatNodes": [
          "token-theft"
        ]
      },
      {
        "id": "tm-gate",
        "label": "治理门与执行",
        "file": "blueprint--mcp-threat-model--tm-gate.mp4",
        "endStill": "blueprint--mcp-threat-model--tm-gate-end.png",
        "beats": 4,
        "leadSec": 0.0,
        "storySec": 4.42,
        "beatNodes": [
          "mcp",
          "gate",
          "execution",
          "data-plane"
        ]
      },
      {
        "id": "tm-full",
        "label": "供给面全景",
        "file": "blueprint--mcp-threat-model--tm-full.mp4",
        "endStill": "blueprint--mcp-threat-model--tm-full-end.png",
        "beats": 10,
        "leadSec": 0.0,
        "storySec": 11.08,
        "beatNodes": [
          "con",
          "agent",
          "tool-poison",
          "response-injection",
          "confused-deputy",
          "token-theft",
          "mcp",
          "gate",
          "execution",
          "data-plane"
        ]
      }
    ]
  },
  "blueprint--object-lifecycle": {
    "slug": "blueprint--object-lifecycle",
    "chapters": [
      {
        "id": "ol-draft",
        "label": "起草",
        "file": "blueprint--object-lifecycle--ol-draft.mp4",
        "endStill": "blueprint--object-lifecycle--ol-draft-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.22,
        "beatNodes": [
          "draft"
        ]
      },
      {
        "id": "ol-gov",
        "label": "受治理",
        "file": "blueprint--object-lifecycle--ol-gov.mp4",
        "endStill": "blueprint--object-lifecycle--ol-gov-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.25,
        "beatNodes": [
          "governed"
        ]
      },
      {
        "id": "ol-conflict",
        "label": "冲突",
        "file": "blueprint--object-lifecycle--ol-conflict.mp4",
        "endStill": "blueprint--object-lifecycle--ol-conflict-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.24,
        "beatNodes": [
          "conflict"
        ]
      },
      {
        "id": "ol-super",
        "label": "被取代",
        "file": "blueprint--object-lifecycle--ol-super.mp4",
        "endStill": "blueprint--object-lifecycle--ol-super-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.26,
        "beatNodes": [
          "superseded"
        ]
      },
      {
        "id": "ol-full",
        "label": "生命周期全流",
        "file": "blueprint--object-lifecycle--ol-full.mp4",
        "endStill": "blueprint--object-lifecycle--ol-full-end.png",
        "beats": 5,
        "leadSec": 0.0,
        "storySec": 5.57,
        "beatNodes": [
          "draft",
          "governed",
          "superseded",
          "conflict",
          "rejected"
        ]
      }
    ]
  },
  "evolution-levers": {
    "slug": "evolution-levers",
    "type": "architecture",
    "chapters": [
      {
        "id": "el-six",
        "label": "六面杠杆",
        "file": "evolution-levers--el-six.mp4",
        "endStill": "evolution-levers--el-six-end.png",
        "beats": 6,
        "leadSec": 0.0,
        "storySec": 6.64,
        "beatNodes": [
          "retrieval",
          "kstrategy",
          "skilltpl",
          "toolcfg",
          "mempipe",
          "agentpr"
        ]
      },
      {
        "id": "el-ctx",
        "label": "第七面提案",
        "file": "evolution-levers--el-ctx.mp4",
        "endStill": "evolution-levers--el-ctx-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.22,
        "beatNodes": [
          "ctxstrat"
        ]
      },
      {
        "id": "el-sm",
        "label": "状态机",
        "file": "evolution-levers--el-sm.mp4",
        "endStill": "evolution-levers--el-sm-end.png",
        "beats": 7,
        "leadSec": 0.0,
        "storySec": 7.77,
        "beatNodes": [
          "draft",
          "shadow",
          "pending",
          "canary",
          "promoted",
          "rejected",
          "rollback"
        ]
      }
    ]
  },
  "failure-map": {
    "slug": "failure-map",
    "type": "architecture",
    "chapters": [
      {
        "id": "fm-stale",
        "label": "过期供给",
        "file": "failure-map--fm-stale.mp4",
        "endStill": "failure-map--fm-stale-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.24,
        "beatNodes": [
          "F2"
        ]
      },
      {
        "id": "fm-conflict",
        "label": "口径打架",
        "file": "failure-map--fm-conflict.mp4",
        "endStill": "failure-map--fm-conflict-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.25,
        "beatNodes": [
          "F1"
        ]
      },
      {
        "id": "fm-auth",
        "label": "代理越权",
        "file": "failure-map--fm-auth.mp4",
        "endStill": "failure-map--fm-auth-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.21,
        "beatNodes": [
          "F5"
        ]
      },
      {
        "id": "fm-breach",
        "label": "权限穿透",
        "file": "failure-map--fm-breach.mp4",
        "endStill": "failure-map--fm-breach-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.24,
        "beatNodes": [
          "F4"
        ]
      },
      {
        "id": "fm-unverified",
        "label": "未验证断言",
        "file": "failure-map--fm-unverified.mp4",
        "endStill": "failure-map--fm-unverified-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.21,
        "beatNodes": [
          "F6"
        ]
      },
      {
        "id": "fm-poison",
        "label": "供给面投毒",
        "file": "failure-map--fm-poison.mp4",
        "endStill": "failure-map--fm-poison-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.22,
        "beatNodes": [
          "F7"
        ]
      },
      {
        "id": "fm-split",
        "label": "检索割裂",
        "file": "failure-map--fm-split.mp4",
        "endStill": "failure-map--fm-split-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.25,
        "beatNodes": [
          "F3"
        ]
      },
      {
        "id": "fm-silent",
        "label": "静默退化",
        "file": "failure-map--fm-silent.mp4",
        "endStill": "failure-map--fm-silent-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.25,
        "beatNodes": [
          "F8"
        ]
      },
      {
        "id": "fm-obj",
        "label": "对象层堵截",
        "file": "failure-map--fm-obj.mp4",
        "endStill": "failure-map--fm-obj-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.22,
        "beatNodes": [
          "F1",
          "L4"
        ]
      },
      {
        "id": "fm-cat",
        "label": "目录层堵截",
        "file": "failure-map--fm-cat.mp4",
        "endStill": "failure-map--fm-cat-end.png",
        "beats": 3,
        "leadSec": 0.0,
        "storySec": 3.35,
        "beatNodes": [
          "F2",
          "F3",
          "L5"
        ]
      },
      {
        "id": "fm-gov",
        "label": "治理层堵截",
        "file": "failure-map--fm-gov.mp4",
        "endStill": "failure-map--fm-gov-end.png",
        "beats": 4,
        "leadSec": 0.0,
        "storySec": 4.43,
        "beatNodes": [
          "F4",
          "F5",
          "F7",
          "L7"
        ]
      },
      {
        "id": "fm-act",
        "label": "激活层堵截",
        "file": "failure-map--fm-act.mp4",
        "endStill": "failure-map--fm-act-end.png",
        "beats": 3,
        "leadSec": 0.0,
        "storySec": 3.33,
        "beatNodes": [
          "F6",
          "F8",
          "L8"
        ]
      },
      {
        "id": "fm-all",
        "label": "八失效全景",
        "file": "failure-map--fm-all.mp4",
        "endStill": "failure-map--fm-all-end.png",
        "beats": 8,
        "leadSec": 0.0,
        "storySec": 8.84,
        "beatNodes": [
          "F1",
          "F2",
          "F3",
          "F4",
          "F5",
          "F6",
          "F7",
          "F8"
        ]
      }
    ]
  },
  "five-sources": {
    "slug": "five-sources",
    "type": "architecture",
    "chapters": [
      {
        "id": "fs-instr",
        "label": "身份与规程",
        "file": "five-sources--fs-instr.mp4",
        "endStill": "five-sources--fs-instr-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.23,
        "beatNodes": [
          "src-instruction"
        ]
      },
      {
        "id": "fs-mem",
        "label": "记忆",
        "file": "five-sources--fs-mem.mp4",
        "endStill": "five-sources--fs-mem-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.25,
        "beatNodes": [
          "src-memory",
          "sig-memory"
        ]
      },
      {
        "id": "fs-know",
        "label": "知识",
        "file": "five-sources--fs-know.mp4",
        "endStill": "five-sources--fs-know-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.25,
        "beatNodes": [
          "src-knowledge",
          "sig-knowledge"
        ]
      },
      {
        "id": "fs-tools",
        "label": "能力",
        "file": "five-sources--fs-tools.mp4",
        "endStill": "five-sources--fs-tools-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.22,
        "beatNodes": [
          "src-tools",
          "sig-tools"
        ]
      },
      {
        "id": "fs-session",
        "label": "会话",
        "file": "five-sources--fs-session.mp4",
        "endStill": "five-sources--fs-session-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.24,
        "beatNodes": [
          "src-session"
        ]
      },
      {
        "id": "fs-gov",
        "label": "治理面",
        "file": "five-sources--fs-gov.mp4",
        "endStill": "five-sources--fs-gov-end.png",
        "beats": 3,
        "leadSec": 0.0,
        "storySec": 3.33,
        "beatNodes": [
          "gov-privacy",
          "gov-access",
          "gov-exec"
        ]
      },
      {
        "id": "fs-out",
        "label": "五源汇流",
        "file": "five-sources--fs-out.mp4",
        "endStill": "five-sources--fs-out-end.png",
        "beats": 6,
        "leadSec": 0.0,
        "storySec": 6.66,
        "beatNodes": [
          "src-instruction",
          "src-memory",
          "src-knowledge",
          "src-tools",
          "src-session",
          "ctx-output"
        ]
      }
    ]
  },
  "injection-points": {
    "slug": "injection-points",
    "type": "workflow",
    "chapters": [
      {
        "id": "ip-nine",
        "label": "九路来源",
        "file": "injection-points--ip-nine.mp4",
        "endStill": "injection-points--ip-nine-end.png",
        "beats": 8,
        "leadSec": 0.0,
        "storySec": 8.88,
        "beatNodes": [
          "r1_identity",
          "r2_skills",
          "r3_tools",
          "r4_model",
          "r5_memory",
          "r6_session",
          "r7_defs",
          "r8_prefs"
        ]
      },
      {
        "id": "ip-hooks",
        "label": "五挂点",
        "file": "injection-points--ip-hooks.mp4",
        "endStill": "injection-points--ip-hooks-end.png",
        "beats": 5,
        "leadSec": 0.0,
        "storySec": 5.54,
        "beatNodes": [
          "h1_instruction",
          "h2_before_model",
          "h3_tool_registry",
          "h4_tool_callbacks",
          "h5_sub_agents"
        ]
      },
      {
        "id": "ip-memory",
        "label": "记忆真锚",
        "file": "injection-points--ip-memory.mp4",
        "endStill": "injection-points--ip-memory-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.23,
        "beatNodes": [
          "r5_memory",
          "h3_tool_registry"
        ]
      },
      {
        "id": "ip-assembler",
        "label": "参考实现未接线",
        "file": "injection-points--ip-assembler.mp4",
        "endStill": "injection-points--ip-assembler-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.25,
        "beatNodes": [
          "ref_assembler"
        ]
      },
      {
        "id": "ip-out",
        "label": "汇入请求",
        "file": "injection-points--ip-out.mp4",
        "endStill": "injection-points--ip-out-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.25,
        "beatNodes": [
          "out_llm"
        ]
      },
      {
        "id": "ip-auth",
        "label": "身份与定义",
        "file": "injection-points--ip-auth.mp4",
        "endStill": "injection-points--ip-auth-end.png",
        "beats": 3,
        "leadSec": 0.0,
        "storySec": 3.37,
        "beatNodes": [
          "r1_identity",
          "r7_defs",
          "h1_instruction"
        ]
      },
      {
        "id": "ip-full",
        "label": "装配面全景",
        "file": "injection-points--ip-full.mp4",
        "endStill": "injection-points--ip-full-end.png",
        "beats": 15,
        "leadSec": 0.0,
        "storySec": 16.59,
        "beatNodes": [
          "r1_identity",
          "r2_skills",
          "r3_tools",
          "r4_model",
          "r5_memory",
          "r6_session",
          "r7_defs",
          "r8_prefs",
          "h1_instruction",
          "h2_before_model",
          "h3_tool_registry",
          "h4_tool_callbacks",
          "h5_sub_agents",
          "ref_assembler",
          "out_llm"
        ]
      }
    ]
  },
  "lifecycle": {
    "slug": "lifecycle",
    "type": "dataflow",
    "chapters": [
      {
        "id": "lc-collect",
        "label": "采集",
        "file": "lifecycle--lc-collect.mp4",
        "endStill": "lifecycle--lc-collect-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.21,
        "beatNodes": [
          "sources",
          "collect"
        ]
      },
      {
        "id": "lc-govern",
        "label": "治理",
        "file": "lifecycle--lc-govern.mp4",
        "endStill": "lifecycle--lc-govern-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.21,
        "beatNodes": [
          "govern"
        ]
      },
      {
        "id": "lc-activate",
        "label": "激活",
        "file": "lifecycle--lc-activate.mp4",
        "endStill": "lifecycle--lc-activate-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.23,
        "beatNodes": [
          "activate"
        ]
      },
      {
        "id": "lc-verify",
        "label": "验证",
        "file": "lifecycle--lc-verify.mp4",
        "endStill": "lifecycle--lc-verify-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.24,
        "beatNodes": [
          "verify"
        ]
      },
      {
        "id": "lc-evolve",
        "label": "进化",
        "file": "lifecycle--lc-evolve.mp4",
        "endStill": "lifecycle--lc-evolve-end.png",
        "beats": 2,
        "leadSec": 0.0,
        "storySec": 3.23,
        "beatNodes": [
          "evolve",
          "delivery"
        ]
      },
      {
        "id": "lc-loop",
        "label": "大回路",
        "file": "lifecycle--lc-loop.mp4",
        "endStill": "lifecycle--lc-loop-end.png",
        "beats": 5,
        "leadSec": 0.0,
        "storySec": 5.57,
        "beatNodes": [
          "collect",
          "govern",
          "activate",
          "verify",
          "evolve"
        ]
      }
    ]
  },
  "runtime-layering": {
    "slug": "runtime-layering",
    "type": "architecture",
    "chapters": [
      {
        "id": "rl-cgave",
        "label": "五段内环",
        "file": "runtime-layering--rl-cgave.mp4",
        "endStill": "runtime-layering--rl-cgave-end.png",
        "beats": 5,
        "leadSec": 0.0,
        "storySec": 5.52,
        "beatNodes": [
          "cl_collect",
          "cl_govern",
          "cl_activate",
          "cl_verify",
          "cl_evolve"
        ]
      },
      {
        "id": "rl-sys",
        "label": "五子系统",
        "file": "runtime-layering--rl-sys.mp4",
        "endStill": "runtime-layering--rl-sys-end.png",
        "beats": 5,
        "leadSec": 0.0,
        "storySec": 5.55,
        "beatNodes": [
          "sys_memory",
          "sys_kb",
          "sys_kg",
          "sys_tools",
          "sys_skills"
        ]
      },
      {
        "id": "rl-store",
        "label": "单库持久",
        "file": "runtime-layering--rl-store.mp4",
        "endStill": "runtime-layering--rl-store-end.png",
        "beats": 1,
        "leadSec": 0.0,
        "storySec": 3.26,
        "beatNodes": [
          "pg_store"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
