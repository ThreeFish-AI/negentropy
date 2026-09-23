// 本文件由 scripts/archify_manifest.py 从 public/archify/*.json 生成——请勿手改。
// 数据来源：to-video skill 的 pipeline/scripts/record_archify.py --mode chapter（逐章录制）
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
  "architecture": {
    "slug": "architecture",
    "type": "architecture",
    "chapters": [
      {
        "id": "overview",
        "label": "五正交层总览",
        "file": "architecture--overview.mp4",
        "endStill": "architecture--overview-end.png",
        "beats": 8,
        "leadSec": 0.48,
        "storySec": 8.86,
        "beatNodes": [
          "store",
          "catalog",
          "explicit",
          "implicit",
          "eval",
          "gate",
          "rank",
          "mcp"
        ]
      },
      {
        "id": "store",
        "label": "对象层·放什么",
        "file": "architecture--store.mp4",
        "endStill": "architecture--store-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "store"
        ]
      },
      {
        "id": "catalog",
        "label": "目录层·怎么找",
        "file": "architecture--catalog.mp4",
        "endStill": "architecture--catalog-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "catalog"
        ]
      },
      {
        "id": "explicit",
        "label": "显式编纂轨",
        "file": "architecture--explicit.mp4",
        "endStill": "architecture--explicit-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "explicit"
        ]
      },
      {
        "id": "implicit",
        "label": "隐式编纂轨",
        "file": "architecture--implicit.mp4",
        "endStill": "architecture--implicit-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "implicit"
        ]
      },
      {
        "id": "eval",
        "label": "eval 自纠环",
        "file": "architecture--eval.mp4",
        "endStill": "architecture--eval-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "eval"
        ]
      },
      {
        "id": "gate",
        "label": "治理出口",
        "file": "architecture--gate.mp4",
        "endStill": "architecture--gate-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "gate",
          "human"
        ]
      },
      {
        "id": "activate",
        "label": "激活与插座",
        "file": "architecture--activate.mp4",
        "endStill": "architecture--activate-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "rank",
          "mcp",
          "consumers"
        ]
      }
    ]
  },
  "assembler-planner": {
    "slug": "assembler-planner",
    "type": "workflow",
    "chapters": [
      {
        "id": "router",
        "label": "统一入口",
        "file": "assembler-planner--router.mp4",
        "endStill": "assembler-planner--router-end.png",
        "beats": 2,
        "leadSec": 0.2,
        "storySec": 3.24,
        "beatNodes": [
          "request",
          "router"
        ]
      },
      {
        "id": "assembler",
        "label": "自动通道升级",
        "file": "assembler-planner--assembler.mp4",
        "endStill": "assembler-planner--assembler-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "assembler"
        ]
      },
      {
        "id": "grounding",
        "label": "KB 接地片段",
        "file": "assembler-planner--grounding.mp4",
        "endStill": "assembler-planner--grounding-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "kb_grounding"
        ]
      },
      {
        "id": "planner",
        "label": "记忆种子源",
        "file": "assembler-planner--planner.mp4",
        "endStill": "assembler-planner--planner-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "planner",
          "memory_seed"
        ]
      },
      {
        "id": "fusion",
        "label": "统一融合排名",
        "file": "assembler-planner--fusion.mp4",
        "endStill": "assembler-planner--fusion-end.png",
        "beats": 1,
        "leadSec": 0.48,
        "storySec": 3.23,
        "beatNodes": [
          "fusion"
        ]
      },
      {
        "id": "guard",
        "label": "出口守卫",
        "file": "assembler-planner--guard.mp4",
        "endStill": "assembler-planner--guard-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "guard",
          "llm"
        ]
      }
    ]
  },
  "auto-channel": {
    "slug": "auto-channel",
    "type": "workflow",
    "chapters": [
      {
        "id": "auto",
        "label": "自动注入通道",
        "file": "auto-channel--auto.mp4",
        "endStill": "auto-channel--auto-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "ca",
          "prefix"
        ]
      },
      {
        "id": "window",
        "label": "记忆窗口与 KG",
        "file": "auto-channel--window.mp4",
        "endStill": "auto-channel--window-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "window",
          "kg"
        ]
      },
      {
        "id": "gap1",
        "label": "缺口·无 KB 接地",
        "file": "auto-channel--gap1.mp4",
        "endStill": "auto-channel--gap1-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "auto_gap"
        ]
      },
      {
        "id": "od",
        "label": "按需检索通道",
        "file": "auto-channel--od.mp4",
        "endStill": "auto-channel--od-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "hp",
          "seed",
          "fuse"
        ]
      },
      {
        "id": "gap2",
        "label": "缺口·不含 Memory",
        "file": "auto-channel--gap2.mp4",
        "endStill": "auto-channel--gap2-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "od_gap"
        ]
      }
    ]
  },
  "collect-phase": {
    "slug": "collect-phase",
    "type": "dataflow",
    "chapters": [
      {
        "id": "collect",
        "label": "汇聚元数据",
        "file": "collect-phase--collect.mp4",
        "endStill": "collect-phase--collect-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "conn",
          "lineage"
        ]
      },
      {
        "id": "open",
        "label": "开放互换",
        "file": "collect-phase--open.mp4",
        "endStill": "collect-phase--open-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "osi"
        ]
      },
      {
        "id": "catalog",
        "label": "统一目录",
        "file": "collect-phase--catalog.mp4",
        "endStill": "collect-phase--catalog-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "catalog"
        ]
      },
      {
        "id": "semview",
        "label": "语义视图",
        "file": "collect-phase--semview.mp4",
        "endStill": "collect-phase--semview-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "semview"
        ]
      },
      {
        "id": "enrich",
        "label": "富化信号",
        "file": "collect-phase--enrich.mp4",
        "endStill": "collect-phase--enrich-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "docsignal"
        ]
      },
      {
        "id": "ctx",
        "label": "受治理上下文",
        "file": "collect-phase--ctx.mp4",
        "endStill": "collect-phase--ctx-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "ctx",
          "mcp"
        ]
      },
      {
        "id": "search",
        "label": "检索与发现",
        "file": "collect-phase--search.mp4",
        "endStill": "collect-phase--search-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "usearch",
          "coco"
        ]
      }
    ]
  },
  "dual-track-roadmap": {
    "slug": "dual-track-roadmap",
    "type": "architecture",
    "chapters": [
      {
        "id": "design",
        "label": "共享设计层",
        "file": "dual-track-roadmap--design.mp4",
        "endStill": "dual-track-roadmap--design-end.png",
        "beats": 1,
        "leadSec": 0.4,
        "storySec": 3.24,
        "beatNodes": [
          "design"
        ]
      },
      {
        "id": "p0",
        "label": "样板间 P0",
        "file": "dual-track-roadmap--p0.mp4",
        "endStill": "dual-track-roadmap--p0-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "p0"
        ]
      },
      {
        "id": "p123",
        "label": "样板间 P1–P3",
        "file": "dual-track-roadmap--p123.mp4",
        "endStill": "dual-track-roadmap--p123-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "p1",
          "p2",
          "p3"
        ]
      },
      {
        "id": "ph1",
        "label": "本楼 Phase 1",
        "file": "dual-track-roadmap--ph1.mp4",
        "endStill": "dual-track-roadmap--ph1-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "ph1"
        ]
      },
      {
        "id": "ph23",
        "label": "本楼 Phase 2–3",
        "file": "dual-track-roadmap--ph23.mp4",
        "endStill": "dual-track-roadmap--ph23-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "ph2",
          "ph3"
        ]
      }
    ]
  },
  "evolution-levers": {
    "slug": "evolution-levers",
    "type": "architecture",
    "chapters": [
      {
        "id": "six-a",
        "label": "杠杆·检索与策略",
        "file": "evolution-levers--six-a.mp4",
        "endStill": "evolution-levers--six-a-end.png",
        "beats": 2,
        "leadSec": 0.64,
        "storySec": 3.24,
        "beatNodes": [
          "retrieval",
          "kstrategy"
        ]
      },
      {
        "id": "six-b",
        "label": "杠杆·模板与提示",
        "file": "evolution-levers--six-b.mp4",
        "endStill": "evolution-levers--six-b-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "skilltpl",
          "toolcfg",
          "mempipe",
          "agentpr"
        ]
      },
      {
        "id": "seventh",
        "label": "第 7 杠杆",
        "file": "evolution-levers--seventh.mp4",
        "endStill": "evolution-levers--seventh-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "ctxstrat"
        ]
      },
      {
        "id": "sm",
        "label": "统一状态机",
        "file": "evolution-levers--sm.mp4",
        "endStill": "evolution-levers--sm-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "sm"
        ]
      },
      {
        "id": "orch",
        "label": "编排与护栏",
        "file": "evolution-levers--orch.mp4",
        "endStill": "evolution-levers--orch-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "orch",
          "decision"
        ]
      }
    ]
  },
  "industry-landscape": {
    "slug": "industry-landscape",
    "type": "architecture",
    "chapters": [
      {
        "id": "embedded",
        "label": "路线一·平台内嵌",
        "file": "industry-landscape--embedded.mp4",
        "endStill": "industry-landscape--embedded-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "dbx",
          "sf",
          "mf",
          "lkr"
        ]
      },
      {
        "id": "code",
        "label": "路线二·定义即代码",
        "file": "industry-landscape--code.mp4",
        "endStill": "industry-landscape--code-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "dbt"
        ]
      },
      {
        "id": "independent",
        "label": "路线三·独立可执行层",
        "file": "industry-landscape--independent.mp4",
        "endStill": "industry-landscape--independent-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "cube",
          "ats"
        ]
      },
      {
        "id": "meta",
        "label": "路线四·元数据平面",
        "file": "industry-landscape--meta.mp4",
        "endStill": "industry-landscape--meta-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "atl"
        ]
      },
      {
        "id": "palantir",
        "label": "异类·Palantir",
        "file": "industry-landscape--palantir.mp4",
        "endStill": "industry-landscape--palantir-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "palantir"
        ]
      },
      {
        "id": "bp",
        "label": "蓝图落位",
        "file": "industry-landscape--bp.mp4",
        "endStill": "industry-landscape--bp-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "bp",
          "agents"
        ]
      }
    ]
  },
  "layer-mechanism-map": {
    "slug": "layer-mechanism-map",
    "type": "architecture",
    "chapters": [
      {
        "id": "obj",
        "label": "对象层·M1",
        "file": "layer-mechanism-map--obj.mp4",
        "endStill": "layer-mechanism-map--obj-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "obj-m",
          "obj-i"
        ]
      },
      {
        "id": "cat",
        "label": "目录层·M5",
        "file": "layer-mechanism-map--cat.mp4",
        "endStill": "layer-mechanism-map--cat-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "cat-m",
          "cat-i"
        ]
      },
      {
        "id": "enr",
        "label": "富化层·双轨",
        "file": "layer-mechanism-map--enr.mp4",
        "endStill": "layer-mechanism-map--enr-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "enr-m",
          "enr-i"
        ]
      },
      {
        "id": "gov",
        "label": "治理层·四机构",
        "file": "layer-mechanism-map--gov.mp4",
        "endStill": "layer-mechanism-map--gov-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "gov-m",
          "gov-i"
        ]
      },
      {
        "id": "act",
        "label": "激活层·锚定",
        "file": "layer-mechanism-map--act.mp4",
        "endStill": "layer-mechanism-map--act-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "act-m",
          "act-i"
        ]
      }
    ]
  },
  "mcp-threat-model": {
    "slug": "mcp-threat-model",
    "type": "architecture",
    "chapters": [
      {
        "id": "chain",
        "label": "三级攻击链",
        "file": "mcp-threat-model--chain.mp4",
        "endStill": "mcp-threat-model--chain-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "ag",
          "mcp",
          "ex"
        ]
      },
      {
        "id": "poison",
        "label": "工具描述投毒",
        "file": "mcp-threat-model--poison.mp4",
        "endStill": "mcp-threat-model--poison-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "tp"
        ]
      },
      {
        "id": "inject",
        "label": "间接注入",
        "file": "mcp-threat-model--inject.mp4",
        "endStill": "mcp-threat-model--inject-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "ti"
        ]
      },
      {
        "id": "deputy",
        "label": "confused deputy 与 token",
        "file": "mcp-threat-model--deputy.mp4",
        "endStill": "mcp-threat-model--deputy-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "td",
          "tt"
        ]
      },
      {
        "id": "controls",
        "label": "拦截位",
        "file": "mcp-threat-model--controls.mp4",
        "endStill": "mcp-threat-model--controls-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "cg",
          "con"
        ]
      },
      {
        "id": "data",
        "label": "数据平面",
        "file": "mcp-threat-model--data.mp4",
        "endStill": "mcp-threat-model--data-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "da"
        ]
      }
    ]
  },
  "object-lifecycle": {
    "slug": "object-lifecycle",
    "chapters": [
      {
        "id": "draft",
        "label": "draft 起点",
        "file": "object-lifecycle--draft.mp4",
        "endStill": "object-lifecycle--draft-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "draft"
        ]
      },
      {
        "id": "governed",
        "label": "governed 转正",
        "file": "object-lifecycle--governed.mp4",
        "endStill": "object-lifecycle--governed-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "governed"
        ]
      },
      {
        "id": "conflict",
        "label": "conflict 岔道",
        "file": "object-lifecycle--conflict.mp4",
        "endStill": "object-lifecycle--conflict-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "conflict"
        ]
      },
      {
        "id": "superseded",
        "label": "superseded 让位",
        "file": "object-lifecycle--superseded.mp4",
        "endStill": "object-lifecycle--superseded-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "superseded"
        ]
      },
      {
        "id": "rejected",
        "label": "rejected 拒收",
        "file": "object-lifecycle--rejected.mp4",
        "endStill": "object-lifecycle--rejected-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "rejected"
        ]
      },
      {
        "id": "full",
        "label": "词条一生",
        "file": "object-lifecycle--full.mp4",
        "endStill": "object-lifecycle--full-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.52,
        "beatNodes": [
          "draft",
          "governed",
          "conflict",
          "superseded",
          "rejected"
        ]
      }
    ]
  },
  "request-injection": {
    "slug": "request-injection",
    "type": "workflow",
    "chapters": [
      {
        "id": "resolve",
        "label": "指令解析链",
        "file": "request-injection--resolve.mp4",
        "endStill": "request-injection--resolve-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.31,
        "beatNodes": [
          "request",
          "provider",
          "resolver"
        ]
      },
      {
        "id": "inject",
        "label": "渐进注入",
        "file": "request-injection--inject.mp4",
        "endStill": "request-injection--inject-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "injector",
          "llmreq"
        ]
      },
      {
        "id": "preload",
        "label": "预载与回退",
        "file": "request-injection--preload.mp4",
        "endStill": "request-injection--preload-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "preload",
          "fallback"
        ]
      },
      {
        "id": "planner",
        "label": "检索侧",
        "file": "request-injection--planner.mp4",
        "endStill": "request-injection--planner-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "planner"
        ]
      },
      {
        "id": "tables",
        "label": "数据侧四表",
        "file": "request-injection--tables.mp4",
        "endStill": "request-injection--tables-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "memories",
          "agents_row",
          "skills_tables",
          "kb"
        ]
      }
    ]
  },
  "runtime-layering": {
    "slug": "runtime-layering",
    "type": "architecture",
    "chapters": [
      {
        "id": "collect",
        "label": "① Collect",
        "file": "runtime-layering--collect.mp4",
        "endStill": "runtime-layering--collect-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "collect"
        ]
      },
      {
        "id": "enrich",
        "label": "② Enrich",
        "file": "runtime-layering--enrich.mp4",
        "endStill": "runtime-layering--enrich-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "enrich"
        ]
      },
      {
        "id": "activate",
        "label": "③ Activate",
        "file": "runtime-layering--activate.mp4",
        "endStill": "runtime-layering--activate-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "activate"
        ]
      },
      {
        "id": "memkb",
        "label": "记忆与知识库",
        "file": "runtime-layering--memkb.mp4",
        "endStill": "runtime-layering--memkb-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "memory",
          "kb"
        ]
      },
      {
        "id": "kgtools",
        "label": "图谱与工具技能",
        "file": "runtime-layering--kgtools.mp4",
        "endStill": "runtime-layering--kgtools-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "kg",
          "tools",
          "skills"
        ]
      },
      {
        "id": "pg",
        "label": "持久化底座",
        "file": "runtime-layering--pg.mp4",
        "endStill": "runtime-layering--pg-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "runtime",
          "pg"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
