// 本文件由 to-video skill 的 pipeline/scripts/archify_manifest.py 从 public/archify/*.json 生成——请勿手改。
// 数据来源：pipeline/scripts/record_archify.py --mode chapter（逐章录制）
//         + pipeline/scripts/archify_lead.py（场记板白闪测定真实 leadSec）。

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
  "authority-and-controversies": {
    "slug": "authority-and-controversies",
    "type": "architecture",
    "chapters": [
      {
        "id": "authority",
        "label": "权威天平",
        "file": "authority-and-controversies--authority.mp4",
        "endStill": "authority-and-controversies--authority-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "spec",
          "ref"
        ]
      },
      {
        "id": "diff-13",
        "label": "十三处分歧",
        "file": "authority-and-controversies--diff-13.mp4",
        "endStill": "authority-and-controversies--diff-13-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.37,
        "beatNodes": [
          "spec",
          "ref",
          "diff"
        ]
      },
      {
        "id": "realrun",
        "label": "六处真跑",
        "file": "authority-and-controversies--realrun.mp4",
        "endStill": "authority-and-controversies--realrun-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "diff",
          "realrun"
        ]
      },
      {
        "id": "strict",
        "label": "严格只退回",
        "file": "authority-and-controversies--strict.mp4",
        "endStill": "authority-and-controversies--strict-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "strict",
          "diff"
        ]
      },
      {
        "id": "lenient",
        "label": "宽容照上架",
        "file": "authority-and-controversies--lenient.mp4",
        "endStill": "authority-and-controversies--lenient-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "lenient",
          "strict"
        ]
      },
      {
        "id": "trust",
        "label": "极简与信任",
        "file": "authority-and-controversies--trust.mp4",
        "endStill": "authority-and-controversies--trust-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "trust"
        ]
      }
    ]
  },
  "cost-structure": {
    "slug": "cost-structure",
    "type": "dataflow",
    "chapters": [
      {
        "id": "ledger",
        "label": "玩具库账本",
        "file": "cost-structure--ledger.mp4",
        "endStill": "cost-structure--ledger-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "toy-library",
          "on-demand",
          "preload-all"
        ]
      },
      {
        "id": "wall-vs-pay",
        "label": "书脊墙与按次",
        "file": "cost-structure--wall-vs-pay.mp4",
        "endStill": "cost-structure--wall-vs-pay-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "on-demand",
          "spine-wall",
          "pay-per-use"
        ]
      },
      {
        "id": "caveat",
        "label": "倍数只说明方向",
        "file": "cost-structure--caveat.mp4",
        "endStill": "cost-structure--caveat-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "preload-all",
          "direction-only"
        ]
      }
    ]
  },
  "description-eval": {
    "slug": "description-eval",
    "type": "workflow",
    "chapters": [
      {
        "id": "queries",
        "label": "二十条提问",
        "file": "description-eval--queries.mp4",
        "endStill": "description-eval--queries-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "queries",
          "run3x"
        ]
      },
      {
        "id": "groups",
        "label": "练习与考核",
        "file": "description-eval--groups.mp4",
        "endStill": "description-eval--groups-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.35,
        "beatNodes": [
          "run3x",
          "practice_set",
          "exam_set"
        ]
      },
      {
        "id": "pick",
        "label": "考核组裁决",
        "file": "description-eval--pick.mp4",
        "endStill": "description-eval--pick-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.34,
        "beatNodes": [
          "edit_desc",
          "exam_set",
          "pick_best"
        ]
      },
      {
        "id": "cap",
        "label": "1024 红线",
        "file": "description-eval--cap.mp4",
        "endStill": "description-eval--cap-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "pick_best",
          "char_cap"
        ]
      }
    ]
  },
  "description-routing": {
    "slug": "description-routing",
    "type": "workflow",
    "chapters": [
      {
        "id": "judge",
        "label": "模型自己判断",
        "file": "description-routing--judge.mp4",
        "endStill": "description-routing--judge-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "task",
          "judge"
        ]
      },
      {
        "id": "good-desc",
        "label": "好描述",
        "file": "description-routing--good-desc.mp4",
        "endStill": "description-routing--good-desc-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "judge",
          "good_desc"
        ]
      },
      {
        "id": "bad-desc",
        "label": "差描述",
        "file": "description-routing--bad-desc.mp4",
        "endStill": "description-routing--bad-desc-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "judge",
          "bad_desc"
        ]
      },
      {
        "id": "hit-miss",
        "label": "命中与落空",
        "file": "description-routing--hit-miss.mp4",
        "endStill": "description-routing--hit-miss-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.24,
        "beatNodes": [
          "hit",
          "miss"
        ]
      }
    ]
  },
  "distill-loop": {
    "slug": "distill-loop",
    "type": "lifecycle",
    "chapters": [
      {
        "id": "generic-trap",
        "label": "空泛陷阱",
        "file": "distill-loop--generic-trap.mp4",
        "endStill": "distill-loop--generic-trap-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "generic_trap"
        ]
      },
      {
        "id": "hands-on",
        "label": "真实任务提炼",
        "file": "distill-loop--hands-on.mp4",
        "endStill": "distill-loop--hands-on-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "hands_on_task",
          "generic_trap"
        ]
      },
      {
        "id": "four-notes",
        "label": "四格便签",
        "file": "distill-loop--four-notes.mp4",
        "endStill": "distill-loop--four-notes-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "four_notes",
          "skill_draft"
        ]
      },
      {
        "id": "synthesize",
        "label": "资料合成",
        "file": "distill-loop--synthesize.mp4",
        "endStill": "distill-loop--synthesize-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.26,
        "beatNodes": [
          "artifact_synth",
          "skill_draft"
        ]
      },
      {
        "id": "edit-cut",
        "label": "编辑台删减",
        "file": "distill-loop--edit-cut.mp4",
        "endStill": "distill-loop--edit-cut-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "skill_draft",
          "edit_desk"
        ]
      },
      {
        "id": "gotchas",
        "label": "坑点清单",
        "file": "distill-loop--gotchas.mp4",
        "endStill": "distill-loop--gotchas-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "gotcha_list"
        ]
      },
      {
        "id": "execute-revise",
        "label": "执行回灌修订",
        "file": "distill-loop--execute-revise.mp4",
        "endStill": "distill-loop--execute-revise-end.png",
        "beats": 3,
        "leadSec": 0.52,
        "storySec": 3.36,
        "beatNodes": [
          "real_run",
          "skill_draft",
          "final_skill"
        ]
      }
    ]
  },
  "eval-twin-runs": {
    "slug": "eval-twin-runs",
    "type": "dataflow",
    "chapters": [
      {
        "id": "twin",
        "label": "同一张工单",
        "file": "eval-twin-runs--twin.mp4",
        "endStill": "eval-twin-runs--twin-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "ticket"
        ]
      },
      {
        "id": "with-without",
        "label": "带与不带",
        "file": "eval-twin-runs--with-without.mp4",
        "endStill": "eval-twin-runs--with-without-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.26,
        "beatNodes": [
          "with_manual",
          "without_manual"
        ]
      },
      {
        "id": "pass-evidence",
        "label": "打勾贴证据",
        "file": "eval-twin-runs--pass-evidence.mp4",
        "endStill": "eval-twin-runs--pass-evidence-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "qc_gate"
        ]
      },
      {
        "id": "both-pass",
        "label": "都过即删",
        "file": "eval-twin-runs--both-pass.mp4",
        "endStill": "eval-twin-runs--both-pass-end.png",
        "beats": 2,
        "leadSec": 0.4,
        "storySec": 3.27,
        "beatNodes": [
          "qc_gate",
          "both_pass"
        ]
      },
      {
        "id": "only-with",
        "label": "手册真价值",
        "file": "eval-twin-runs--only-with.mp4",
        "endStill": "eval-twin-runs--only-with-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "only_with",
          "revise_next"
        ]
      }
    ]
  },
  "handbook-cabinet": {
    "slug": "handbook-cabinet",
    "type": "architecture",
    "chapters": [
      {
        "id": "expert",
        "label": "经验孤岛",
        "file": "handbook-cabinet--expert.mp4",
        "endStill": "handbook-cabinet--expert-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "expert-know-how",
          "ai-assistant"
        ]
      },
      {
        "id": "old-empty",
        "label": "什么都不给",
        "file": "handbook-cabinet--old-empty.mp4",
        "endStill": "handbook-cabinet--old-empty-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "road-empty",
          "ai-assistant"
        ]
      },
      {
        "id": "old-stuff",
        "label": "全塞开场白",
        "file": "handbook-cabinet--old-stuff.mp4",
        "endStill": "handbook-cabinet--old-stuff-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.34,
        "beatNodes": [
          "road-stuff",
          "ai-assistant"
        ]
      },
      {
        "id": "third-road",
        "label": "打包成文件夹",
        "file": "handbook-cabinet--third-road.mp4",
        "endStill": "handbook-cabinet--third-road-end.png",
        "beats": 2,
        "leadSec": 0.88,
        "storySec": 3.27,
        "beatNodes": [
          "expert-know-how",
          "skill-folder"
        ]
      },
      {
        "id": "light-distill",
        "label": "轻量蒸馏",
        "file": "handbook-cabinet--light-distill.mp4",
        "endStill": "handbook-cabinet--light-distill-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.33,
        "beatNodes": [
          "skill-folder",
          "light-distill",
          "ai-assistant"
        ]
      }
    ]
  },
  "package-and-validation": {
    "slug": "package-and-validation",
    "type": "architecture",
    "chapters": [
      {
        "id": "package",
        "label": "一个抽屉",
        "file": "package-and-validation--package.mp4",
        "endStill": "package-and-validation--package-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.36,
        "beatNodes": [
          "skill-dir",
          "skill-md",
          "optional-dirs"
        ]
      },
      {
        "id": "required",
        "label": "两项必填",
        "file": "package-and-validation--required.mp4",
        "endStill": "package-and-validation--required-end.png",
        "beats": 1,
        "leadSec": 0.48,
        "storySec": 3.24,
        "beatNodes": [
          "skill-md"
        ]
      },
      {
        "id": "name-rule",
        "label": "名字即标签",
        "file": "package-and-validation--name-rule.mp4",
        "endStill": "package-and-validation--name-rule-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "skill-dir",
          "skill-md"
        ]
      },
      {
        "id": "optional",
        "label": "选填与附录",
        "file": "package-and-validation--optional.mp4",
        "endStill": "package-and-validation--optional-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.25,
        "beatNodes": [
          "skill-md",
          "optional-dirs"
        ]
      },
      {
        "id": "validate-gap",
        "label": "上架检查",
        "file": "package-and-validation--validate-gap.mp4",
        "endStill": "package-and-validation--validate-gap-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.26,
        "beatNodes": [
          "cmd-validate",
          "spec-gap"
        ]
      },
      {
        "id": "to-prompt-gap",
        "label": "整体失败",
        "file": "package-and-validation--to-prompt-gap.mp4",
        "endStill": "package-and-validation--to-prompt-gap-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.41,
        "beatNodes": [
          "cmd-read-props",
          "cmd-to-prompt",
          "spec-gap"
        ]
      }
    ]
  },
  "progressive-disclosure": {
    "slug": "progressive-disclosure",
    "type": "workflow",
    "chapters": [
      {
        "id": "tier1",
        "label": "书脊常驻",
        "file": "progressive-disclosure--tier1.mp4",
        "endStill": "progressive-disclosure--tier1-end.png",
        "beats": 4,
        "leadSec": 0.44,
        "storySec": 4.43,
        "beatNodes": [
          "scan_scopes",
          "parse_skill",
          "skill_registry",
          "skill_catalog"
        ]
      },
      {
        "id": "tier2",
        "label": "整本按需",
        "file": "progressive-disclosure--tier2.mp4",
        "endStill": "progressive-disclosure--tier2-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "activation_gate",
          "load_body"
        ]
      },
      {
        "id": "tier3",
        "label": "附录按页",
        "file": "progressive-disclosure--tier3.mp4",
        "endStill": "progressive-disclosure--tier3-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "read_resources"
        ]
      },
      {
        "id": "contract",
        "label": "目录契约",
        "file": "progressive-disclosure--contract.mp4",
        "endStill": "progressive-disclosure--contract-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.25,
        "beatNodes": [
          "skill_catalog",
          "activation_gate"
        ]
      }
    ]
  },
  "teardown-identity-budget": {
    "slug": "teardown-identity-budget",
    "type": "dataflow",
    "chapters": [
      {
        "id": "impostor",
        "label": "冒名手册",
        "file": "teardown-identity-budget--impostor.mp4",
        "endStill": "teardown-identity-budget--impostor-end.png",
        "beats": 4,
        "leadSec": 0.48,
        "storySec": 4.46,
        "beatNodes": [
          "name-rule",
          "impostor",
          "scan-order",
          "identity-drift"
        ]
      },
      {
        "id": "bloat",
        "label": "超长描述",
        "file": "teardown-identity-budget--bloat.mp4",
        "endStill": "teardown-identity-budget--bloat-end.png",
        "beats": 3,
        "leadSec": 0.44,
        "storySec": 3.32,
        "beatNodes": [
          "char-cap",
          "bloat",
          "catalog-cost"
        ]
      },
      {
        "id": "share",
        "label": "2.4 倍于其余总和",
        "file": "teardown-identity-budget--share.mp4",
        "endStill": "teardown-identity-budget--share-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.26,
        "beatNodes": [
          "catalog-cost",
          "share"
        ]
      }
    ]
  },
  "teardown-parse-escape": {
    "slug": "teardown-parse-escape",
    "type": "dataflow",
    "chapters": [
      {
        "id": "dash",
        "label": "三条短横线",
        "file": "teardown-parse-escape--dash.mp4",
        "endStill": "teardown-parse-escape--dash-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "lab",
          "dash"
        ]
      },
      {
        "id": "cut",
        "label": "拦腰截断",
        "file": "teardown-parse-escape--cut.mp4",
        "endStill": "teardown-parse-escape--cut-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.27,
        "beatNodes": [
          "cut",
          "drop"
        ]
      },
      {
        "id": "drop",
        "label": "静默消失",
        "file": "teardown-parse-escape--drop.mp4",
        "endStill": "teardown-parse-escape--drop-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.21,
        "beatNodes": [
          "drop"
        ]
      },
      {
        "id": "forge",
        "label": "伪造目录段",
        "file": "teardown-parse-escape--forge.mp4",
        "endStill": "teardown-parse-escape--forge-end.png",
        "beats": 1,
        "leadSec": 0.44,
        "storySec": 3.24,
        "beatNodes": [
          "forge"
        ]
      },
      {
        "id": "view",
        "label": "多出一本",
        "file": "teardown-parse-escape--view.mp4",
        "endStill": "teardown-parse-escape--view-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.23,
        "beatNodes": [
          "view",
          "fake"
        ]
      },
      {
        "id": "fake",
        "label": "第二张书脊",
        "file": "teardown-parse-escape--fake.mp4",
        "endStill": "teardown-parse-escape--fake-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.22,
        "beatNodes": [
          "fake",
          "shield"
        ]
      }
    ]
  },
  "unproven-list": {
    "slug": "unproven-list",
    "type": "workflow",
    "chapters": [
      {
        "id": "five",
        "label": "五件事清单",
        "file": "unproven-list--five.mp4",
        "endStill": "unproven-list--five-end.png",
        "beats": 2,
        "leadSec": 0.6,
        "storySec": 3.5,
        "beatNodes": [
          "saving_q",
          "saving_gap"
        ]
      },
      {
        "id": "hundreds",
        "label": "几百本没人讨论",
        "file": "unproven-list--hundreds.mp4",
        "endStill": "unproven-list--hundreds-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.26,
        "beatNodes": [
          "hundreds_q",
          "hundreds_gap"
        ]
      },
      {
        "id": "trigger",
        "label": "触发无达标标准",
        "file": "unproven-list--trigger.mp4",
        "endStill": "unproven-list--trigger-end.png",
        "beats": 2,
        "leadSec": 0.44,
        "storySec": 3.28,
        "beatNodes": [
          "trigger_q",
          "trigger_gap"
        ]
      },
      {
        "id": "trust",
        "label": "无签名无版本",
        "file": "unproven-list--trust.mp4",
        "endStill": "unproven-list--trust-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.22,
        "beatNodes": [
          "trust_q",
          "trust_gap"
        ]
      },
      {
        "id": "check",
        "label": "过检查≠合规≠好用",
        "file": "unproven-list--check.mp4",
        "endStill": "unproven-list--check-end.png",
        "beats": 2,
        "leadSec": 0.48,
        "storySec": 3.24,
        "beatNodes": [
          "check_q",
          "check_gap"
        ]
      }
    ]
  }
} as const satisfies Record<string, ArchifyDiagram>;

export type ArchifySlug = keyof typeof ARCHIFY;
