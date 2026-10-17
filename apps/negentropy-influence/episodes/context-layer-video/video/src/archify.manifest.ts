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
        "leadSec": 0.48,
        "storySec": 3.22,
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
        "leadSec": 0.52,
        "storySec": 3.25,
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
        "leadSec": 0.52,
        "storySec": 3.23,
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
        "leadSec": 0.52,
        "storySec": 3.2,
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
        "leadSec": 0.52,
        "storySec": 3.23,
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
        "leadSec": 0.68,
        "storySec": 3.2,
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
        "leadSec": 0.48,
        "storySec": 3.26,
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
        "leadSec": 0.48,
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
        "leadSec": 0.48,
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
        "id": "arc-facets",
        "label": "三面各答一问",
        "file": "blueprint--architecture--arc-facets.mp4",
        "endStill": "blueprint--architecture--arc-facets-end.png",
        "beats": 12,
        "leadSec": 0.44,
        "storySec": 13.29,
        "beatNodes": [
          "registry",
          "axisAsset",
          "axisAuth",
          "axisAssembly",
          "axisRetrieval",
          "axisCompounding",
          "stageL1",
          "stageL2",
          "stageL3",
          "stageL4",
          "stageL5",
          "stageL6"
        ]
      },
      {
        "id": "arc-axes",
        "label": "五轴与独立性",
        "file": "blueprint--architecture--arc-axes.mp4",
        "endStill": "blueprint--architecture--arc-axes-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.53,
        "beatNodes": [
          "axisAsset",
          "axisAuth",
          "axisAssembly",
          "axisRetrieval",
          "axisCompounding"
        ]
      },
      {
        "id": "arc-seams",
        "label": "机制即接缝",
        "file": "blueprint--architecture--arc-seams.mp4",
        "endStill": "blueprint--architecture--arc-seams-end.png",
        "beats": 5,
        "leadSec": 0.44,
        "storySec": 5.54,
        "beatNodes": [
          "chipM1M5",
          "chipM2M6",
          "chipM3",
          "chipM4",
          "chipM7"
        ]
      },
      {
        "id": "arc-stages",
        "label": "时间面六段",
        "file": "blueprint--architecture--arc-stages.mp4",
        "endStill": "blueprint--architecture--arc-stages-end.png",
        "beats": 6,
        "leadSec": 0.44,
        "storySec": 6.65,
        "beatNodes": [
          "stageL1",
          "stageL2",
          "stageL3",
          "stageL4",
          "stageL5",
          "stageL6"
        ]
      }
    ]
  },
  "blueprint--first-class-object": {
    "slug": "blueprint--first-class-object",
    "type": "dataflow",
    "chapters": [
      {
        "id": "fco-objects",
        "label": "研究对象",
        "file": "blueprint--first-class-object--fco-objects.mp4",
        "endStill": "blueprint--first-class-object--fco-objects-end.png",
        "beats": 5,
        "leadSec": 0.52,
        "storySec": 5.55,
        "beatNodes": [
          "espace",
          "erel",
          "charfn",
          "rawctx",
          "taskdom"
        ]
      },
      {
        "id": "fco-txn",
        "label": "装配事务",
        "file": "blueprint--first-class-object--fco-txn.mp4",
        "endStill": "blueprint--first-class-object--fco-txn-end.png",
        "beats": 4,
        "leadSec": 0.48,
        "storySec": 4.42,
        "beatNodes": [
          "operators",
          "txn",
          "answer",
          "symptoms"
        ]
      }
    ]
  },
  "blueprint--layer-mechanism-map": {
    "slug": "blueprint--layer-mechanism-map",
    "type": "architecture",
    "chapters": [
      {
        "id": "lmm-open",
        "label": "矩阵总览",
        "file": "blueprint--layer-mechanism-map--lmm-open.mp4",
        "endStill": "blueprint--layer-mechanism-map--lmm-open-end.png",
        "beats": 12,
        "leadSec": 0.52,
        "storySec": 13.29,
        "beatNodes": [
          "axis_asset",
          "axis_authority",
          "axis_assembly",
          "axis_retrieval",
          "axis_compounding",
          "m1_semantic_view",
          "m2_row_policy",
          "m3_semantic_gov",
          "m4_vqr",
          "m5_lineage",
          "m6_agent_identity",
          "m7_tagging"
        ]
      },
      {
        "id": "lmm-single",
        "label": "单轴全落权威",
        "file": "blueprint--layer-mechanism-map--lmm-single.mp4",
        "endStill": "blueprint--layer-mechanism-map--lmm-single-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.26,
        "beatNodes": [
          "m2_row_policy",
          "m6_agent_identity"
        ]
      },
      {
        "id": "lmm-seam",
        "label": "跨轴接缝",
        "file": "blueprint--layer-mechanism-map--lmm-seam.mp4",
        "endStill": "blueprint--layer-mechanism-map--lmm-seam-end.png",
        "beats": 5,
        "leadSec": 0.52,
        "storySec": 5.56,
        "beatNodes": [
          "m1_semantic_view",
          "m3_semantic_gov",
          "m4_vqr",
          "m5_lineage",
          "m7_tagging"
        ]
      }
    ]
  },
  "blueprint--mcp-threat-model": {
    "slug": "blueprint--mcp-threat-model",
    "type": "architecture",
    "chapters": [
      {
        "id": "tm2-open",
        "label": "供给面全景",
        "file": "blueprint--mcp-threat-model--tm2-open.mp4",
        "endStill": "blueprint--mcp-threat-model--tm2-open-end.png",
        "beats": 11,
        "leadSec": 0.52,
        "storySec": 12.15,
        "beatNodes": [
          "host-client",
          "mcp-surface",
          "compile-gate",
          "governed-exec",
          "data-plane",
          "token-theft",
          "desc-poison",
          "deputy",
          "handle-spoof",
          "injection",
          "legitimation"
        ]
      },
      {
        "id": "tm2-surface",
        "label": "供给边界",
        "file": "blueprint--mcp-threat-model--tm2-surface.mp4",
        "endStill": "blueprint--mcp-threat-model--tm2-surface-end.png",
        "beats": 3,
        "leadSec": 0.52,
        "storySec": 3.33,
        "beatNodes": [
          "host-client",
          "mcp-surface",
          "compile-gate"
        ]
      },
      {
        "id": "tm2-plane",
        "label": "数据与执行",
        "file": "blueprint--mcp-threat-model--tm2-plane.mp4",
        "endStill": "blueprint--mcp-threat-model--tm2-plane-end.png",
        "beats": 2,
        "leadSec": 0.52,
        "storySec": 3.24,
        "beatNodes": [
          "governed-exec",
          "data-plane"
        ]
      },
      {
        "id": "tm2-threats",
        "label": "六类威胁",
        "file": "blueprint--mcp-threat-model--tm2-threats.mp4",
        "endStill": "blueprint--mcp-threat-model--tm2-threats-end.png",
        "beats": 6,
        "leadSec": 0.52,
        "storySec": 6.66,
        "beatNodes": [
          "token-theft",
          "desc-poison",
          "deputy",
          "handle-spoof",
          "injection",
          "legitimation"
        ]
      }
    ]
  },
  "blueprint--object-lifecycle": {
    "slug": "blueprint--object-lifecycle",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "ol-draft",
        "label": "起草",
        "file": "blueprint--object-lifecycle--ol-draft.mp4",
        "endStill": "blueprint--object-lifecycle--ol-draft-end.png",
        "beats": 1,
        "leadSec": 0.48,
        "storySec": 3.25,
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
        "leadSec": 0.52,
        "storySec": 3.21,
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
        "leadSec": 0.52,
        "storySec": 3.25,
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
        "leadSec": 0.52,
        "storySec": 3.25,
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
        "leadSec": 0.52,
        "storySec": 5.55,
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
        "leadSec": 0.52,
        "storySec": 6.67,
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
        "leadSec": 0.52,
        "storySec": 3.26,
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
        "leadSec": 0.52,
        "storySec": 7.72,
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
        "id": "fm2-open",
        "label": "九簇总览",
        "file": "failure-map--fm2-open.mp4",
        "endStill": "failure-map--fm2-open-end.png",
        "beats": 9,
        "leadSec": 0.76,
        "storySec": 9.95,
        "beatNodes": [
          "c1_koujing",
          "c2_zhixing",
          "c3_menjin",
          "c4_yanzheng",
          "c5_gongji",
          "c6_yunhangshi",
          "c7_jiexian",
          "c8_jiyi",
          "c9_zuzhi"
        ]
      },
      {
        "id": "fm2-def",
        "label": "定义执法三簇",
        "file": "failure-map--fm2-def.mp4",
        "endStill": "failure-map--fm2-def-end.png",
        "beats": 3,
        "leadSec": 0.48,
        "storySec": 3.34,
        "beatNodes": [
          "c1_koujing",
          "c2_zhixing",
          "c3_menjin"
        ]
      },
      {
        "id": "fm2-supply",
        "label": "背书接入四簇",
        "file": "failure-map--fm2-supply.mp4",
        "endStill": "failure-map--fm2-supply-end.png",
        "beats": 4,
        "leadSec": 0.48,
        "storySec": 4.46,
        "beatNodes": [
          "c4_yanzheng",
          "c5_gongji",
          "c6_yunhangshi",
          "c7_jiexian"
        ]
      },
      {
        "id": "fm2-ends",
        "label": "两端两簇",
        "file": "failure-map--fm2-ends.mp4",
        "endStill": "failure-map--fm2-ends-end.png",
        "beats": 2,
        "leadSec": 0.56,
        "storySec": 3.22,
        "beatNodes": [
          "c8_jiyi",
          "c9_zuzhi"
        ]
      }
    ]
  },
  "ingest-pipeline": {
    "slug": "ingest-pipeline",
    "type": "workflow",
    "chapters": [
      {
        "id": "ig-open",
        "label": "总览",
        "file": "ingest-pipeline--ig-open.mp4",
        "endStill": "ingest-pipeline--ig-open-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "ingest",
          "tag_index"
        ]
      },
      {
        "id": "ig-ingest",
        "label": "Ingest 登记",
        "file": "ingest-pipeline--ig-ingest.mp4",
        "endStill": "ingest-pipeline--ig-ingest-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "ingest"
        ]
      },
      {
        "id": "ig-normalize",
        "label": "Normalize 归一",
        "file": "ingest-pipeline--ig-normalize.mp4",
        "endStill": "ingest-pipeline--ig-normalize-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "normalize"
        ]
      },
      {
        "id": "ig-classify",
        "label": "Classify 分类",
        "file": "ingest-pipeline--ig-classify.mp4",
        "endStill": "ingest-pipeline--ig-classify-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "classify"
        ]
      },
      {
        "id": "ig-tier",
        "label": "Tier 分级",
        "file": "ingest-pipeline--ig-tier.mp4",
        "endStill": "ingest-pipeline--ig-tier-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.46,
        "beatNodes": [
          "tier",
          "l0",
          "l1",
          "l2"
        ]
      },
      {
        "id": "ig-tag",
        "label": "Tag/Index 入册",
        "file": "ingest-pipeline--ig-tag.mp4",
        "endStill": "ingest-pipeline--ig-tag-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "tag_index"
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
        "leadSec": 0.48,
        "storySec": 8.82,
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
        "leadSec": 0.52,
        "storySec": 5.51,
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
        "leadSec": 0.52,
        "storySec": 3.21,
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
        "leadSec": 0.48,
        "storySec": 3.21,
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
        "leadSec": 0.48,
        "storySec": 3.21,
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
        "leadSec": 0.52,
        "storySec": 3.33,
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
        "leadSec": 0.52,
        "storySec": 16.57,
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
        "id": "lc2-open",
        "label": "六段两环总览",
        "file": "lifecycle--lc2-open.mp4",
        "endStill": "lifecycle--lc2-open-end.png",
        "beats": 6,
        "leadSec": 0.52,
        "storySec": 6.65,
        "beatNodes": [
          "l1",
          "l2",
          "l3",
          "l4",
          "l5",
          "l6"
        ]
      },
      {
        "id": "lc2-l1",
        "label": "L1 采集纳管",
        "file": "lifecycle--lc2-l1.mp4",
        "endStill": "lifecycle--lc2-l1-end.png",
        "beats": 1,
        "leadSec": 0.52,
        "storySec": 3.22,
        "beatNodes": [
          "l1"
        ]
      },
      {
        "id": "lc2-l2",
        "label": "L2 铸形裁决",
        "file": "lifecycle--lc2-l2.mp4",
        "endStill": "lifecycle--lc2-l2-end.png",
        "beats": 1,
        "leadSec": 0.52,
        "storySec": 3.24,
        "beatNodes": [
          "l2"
        ]
      },
      {
        "id": "lc2-l3",
        "label": "L3 装配执法",
        "file": "lifecycle--lc2-l3.mp4",
        "endStill": "lifecycle--lc2-l3-end.png",
        "beats": 1,
        "leadSec": 0.52,
        "storySec": 3.23,
        "beatNodes": [
          "l3"
        ]
      },
      {
        "id": "lc2-l4",
        "label": "L4 应答锚定",
        "file": "lifecycle--lc2-l4.mp4",
        "endStill": "lifecycle--lc2-l4-end.png",
        "beats": 1,
        "leadSec": 0.52,
        "storySec": 3.25,
        "beatNodes": [
          "l4"
        ]
      },
      {
        "id": "lc2-l5",
        "label": "L5 沉淀回灌",
        "file": "lifecycle--lc2-l5.mp4",
        "endStill": "lifecycle--lc2-l5-end.png",
        "beats": 1,
        "leadSec": 0.52,
        "storySec": 3.25,
        "beatNodes": [
          "l5"
        ]
      },
      {
        "id": "lc2-l6",
        "label": "L6 衰减退役",
        "file": "lifecycle--lc2-l6.mp4",
        "endStill": "lifecycle--lc2-l6-end.png",
        "beats": 1,
        "leadSec": 0.52,
        "storySec": 3.22,
        "beatNodes": [
          "l6"
        ]
      },
      {
        "id": "lc2-loops",
        "label": "验证与进化环",
        "file": "lifecycle--lc2-loops.mp4",
        "endStill": "lifecycle--lc2-loops-end.png",
        "beats": 3,
        "leadSec": 0.52,
        "storySec": 3.32,
        "beatNodes": [
          "l2",
          "l4",
          "l5"
        ]
      }
    ]
  },
  "read-pipeline": {
    "slug": "read-pipeline",
    "type": "workflow",
    "chapters": [
      {
        "id": "rp-open",
        "label": "总览",
        "file": "read-pipeline--rp-open.mp4",
        "endStill": "read-pipeline--rp-open-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "req",
          "bundle",
          "dropped"
        ]
      },
      {
        "id": "rp-resolve",
        "label": "Resolve 主体",
        "file": "read-pipeline--rp-resolve.mp4",
        "endStill": "read-pipeline--rp-resolve-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "req",
          "resolve"
        ]
      },
      {
        "id": "rp-plan",
        "label": "Plan 计划",
        "file": "read-pipeline--rp-plan.mp4",
        "endStill": "read-pipeline--rp-plan-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "plan"
        ]
      },
      {
        "id": "rp-retrieve",
        "label": "Retrieve 双范式",
        "file": "read-pipeline--rp-retrieve.mp4",
        "endStill": "read-pipeline--rp-retrieve-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.29,
        "beatNodes": [
          "retrieve_exact",
          "retrieve_recall"
        ]
      },
      {
        "id": "rp-fuse",
        "label": "Fuse 融合",
        "file": "read-pipeline--rp-fuse.mp4",
        "endStill": "read-pipeline--rp-fuse-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "fuse"
        ]
      },
      {
        "id": "rp-guard",
        "label": "Guard 检查",
        "file": "read-pipeline--rp-guard.mp4",
        "endStill": "read-pipeline--rp-guard-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "guard",
          "dropped"
        ]
      },
      {
        "id": "rp-compose",
        "label": "Compose 裁剪",
        "file": "read-pipeline--rp-compose.mp4",
        "endStill": "read-pipeline--rp-compose-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "compose"
        ]
      },
      {
        "id": "rp-emit",
        "label": "Emit 交付",
        "file": "read-pipeline--rp-emit.mp4",
        "endStill": "read-pipeline--rp-emit-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "bundle"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
