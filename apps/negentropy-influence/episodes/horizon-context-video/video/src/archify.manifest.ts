// 【占位】本文件由 to-video skill 的 scripts/archify_manifest.py 从 public/archify/*.json 生成——录制前占位，真值版勿手改。

// 数据来源：scripts/record_archify.py --mode chapter + scripts/archify_lead.py

export type ArchifyChapter = {
  id: string; label: string; file: string; endStill: string;
  beats: number; leadSec: number; storySec: number; beatNodes: string[];
};
export type ArchifyDiagram = {slug: string; type?: string; chapters: ArchifyChapter[]};

export const ARCHIFY = {
  "agent-identity": {
    "slug": "agent-identity",
    "chapters": [
      {"id": "ceiling", "label": "权限天花板只减不增", "file": "agent-identity--ceiling.mp4", "endStill": "agent-identity--ceiling-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["user", "agent", "ceil", "sess"]},
      {"id": "audit", "label": "刷卡可归因", "file": "agent-identity--audit.mp4", "endStill": "agent-identity--audit-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["sess", "qh"]},
      {"id": "strict", "label": "供策略叠加严拒面", "file": "agent-identity--strict.mp4", "endStill": "agent-identity--strict-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["sess", "pol"]},
      {"id": "snapshot-vs-live", "label": "快照 vs 实时双钟", "file": "agent-identity--snapshot-vs-live.mp4", "endStill": "agent-identity--snapshot-vs-live-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["user", "ceil", "sess"]},
    ],
  },
  "autopilot-loop": {
    "slug": "autopilot-loop",
    "chapters": [
      {"id": "inputs", "label": "六路输入面", "file": "autopilot-loop--inputs.mp4", "endStill": "autopilot-loop--inputs-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["in_zero", "in_bi", "in_pairs"]},
      {"id": "valgate", "label": "验证门与入库", "file": "autopilot-loop--valgate.mp4", "endStill": "autopilot-loop--valgate-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["validate", "discard", "sv", "vqr"]},
    ],
  },
  "bare-key-baseline": {
    "slug": "bare-key-baseline",
    "chapters": [
      {"id": "whole-key", "label": "整库钥匙直连", "file": "bare-key-baseline--whole-key.mp4", "endStill": "bare-key-baseline--whole-key-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["keyHandover", "bareAgent", "rawTable"]},
      {"id": "blind-wrong", "label": "认得出答不对", "file": "bare-key-baseline--blind-wrong.mp4", "endStill": "bare-key-baseline--blind-wrong-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["rawTable", "wrongAnswer"]},
      {"id": "baseline-two", "label": "两成多双口径对撞", "file": "bare-key-baseline--baseline-two.mp4", "endStill": "bare-key-baseline--baseline-two-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["wrongAnswer", "vendorBench", "thirdPartyBench", "sameOrder"]},
    ],
  },
  "calc-discipline-matrix": {
    "slug": "calc-discipline-matrix",
    "chapters": [
      {"id": "agg-before-join", "label": "先聚后联铁律", "file": "calc-discipline-matrix--agg-before-join.mp4", "endStill": "calc-discipline-matrix--agg-before-join-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["handbook", "rule-agg-before-join", "trap-fanout", "recompute"]},
      {"id": "divide-after-agg", "label": "先聚后除", "file": "calc-discipline-matrix--divide-after-agg.mp4", "endStill": "calc-discipline-matrix--divide-after-agg-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["rule-divide-after-agg", "trap-avg-of-avg", "recompute"]},
    ],
  },
  "caliber-clash": {
    "slug": "caliber-clash",
    "chapters": [
      {"id": "three-dashboards", "label": "三看板三种数", "file": "caliber-clash--three-dashboards.mp4", "endStill": "caliber-clash--three-dashboards-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["netRevenue", "salesBoard", "finBoard", "opsBoard", "clash"]},
      {"id": "twenty-algorithms", "label": "二十看板二十算法", "file": "caliber-clash--twenty-algorithms.mp4", "endStill": "caliber-clash--twenty-algorithms-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["spread", "netRevenue"]},
    ],
  },
  "classification-tagging": {
    "slug": "classification-tagging",
    "chapters": [
      {"id": "tag-driven", "label": "分类到自动纳管", "file": "classification-tagging--tag-driven.mp4", "endStill": "classification-tagging--tag-driven-end.png", "beats": 3, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["new", "cls", "map", "tag", "pol", "out"]},
      {"id": "honest-limit", "label": "能力边界如实", "file": "classification-tagging--honest-limit.mp4", "endStill": "classification-tagging--honest-limit-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["pol", "limit"]},
      {"id": "explicit-gap", "label": "未映射显式缺口", "file": "classification-tagging--explicit-gap.mp4", "endStill": "classification-tagging--explicit-gap-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["map", "gap"]},
    ],
  },
  "collect-enrich-activate": {
    "slug": "collect-enrich-activate",
    "chapters": [
      {"id": "collect", "label": "三路元数据汇聚", "file": "collect-enrich-activate--collect.mp4", "endStill": "collect-enrich-activate--collect-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["s1", "s2", "s3", "c"]},
      {"id": "activate", "label": "排序后激活", "file": "collect-enrich-activate--activate.mp4", "endStill": "collect-enrich-activate--activate-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["r", "a1", "a2", "a3"]},
    ],
  },
  "compile-time-block": {
    "slug": "compile-time-block",
    "chapters": [
      {"id": "no-backdoor", "label": "不成后门", "file": "compile-time-block--no-backdoor.mp4", "endStill": "compile-time-block--no-backdoor-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["semantic", "caller", "engine"]},
    ],
  },
  "component-panorama": {
    "slug": "component-panorama",
    "chapters": [
      {"id": "caliber-spine", "label": "口径主线", "file": "component-panorama--caliber-spine.mp4", "endStill": "component-panorama--caliber-spine-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["ap", "sv", "gov", "pol"]},
      {"id": "consumer-feed", "label": "消费端五路汇入", "file": "component-panorama--consumer-feed.mp4", "endStill": "component-panorama--consumer-feed-end.png", "beats": 3, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["vqr", "us", "mcp", "el", "grd", "agents"]},
      {"id": "reserved-supply", "label": "降级保留区", "file": "component-panorama--reserved-supply.mp4", "endStill": "component-panorama--reserved-supply-end.png", "beats": 3, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["ap", "cs", "us", "oss", "mcp", "ada", "grd"]},
    ],
  },
  "declaration-execution": {
    "slug": "declaration-execution",
    "chapters": [
      {"id": "declare", "label": "五段式声明", "file": "declaration-execution--declare.mp4", "endStill": "declaration-execution--declare-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["tables", "rels", "facts", "metrics", "fivePart"]},
      {"id": "switch-divergence", "label": "执行开关分化", "file": "declaration-execution--switch-divergence.mp4", "endStill": "declaration-execution--switch-divergence-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["fivePart", "rbac", "agg", "result"]},
    ],
  },
  "definition-registration": {
    "slug": "definition-registration",
    "chapters": [
      {"id": "strict-gate", "label": "极严校验门", "file": "definition-registration--strict-gate.mp4", "endStill": "definition-registration--strict-gate-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["validating", "rule_fk", "rule_cycle", "rule_grain"]},
      {"id": "nonkey-rejected", "label": "指向非键列被拒", "file": "definition-registration--nonkey-rejected.mp4", "endStill": "definition-registration--nonkey-rejected-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["bad_fk", "validating", "rejected"]},
    ],
  },
  "dictionary-drift": {
    "slug": "dictionary-drift",
    "chapters": [
      {"id": "stale-manual", "label": "按旧手册猜", "file": "dictionary-drift--stale-manual.mp4", "endStill": "dictionary-drift--stale-manual-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["stale-dict", "ai-stale-manual", "wrong-answers"]},
    ],
  },
  "dual-baseline-evidence": {
    "slug": "dual-baseline-evidence",
    "chapters": [
      {"id": "two-benchmarks", "label": "两成多双口径", "file": "dual-baseline-evidence--two-benchmarks.mp4", "endStill": "dual-baseline-evidence--two-benchmarks-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["snowflakeInternal", "internal25", "anthropicRetest", "retest21"]},
    ],
  },
  "engine-governance": {
    "slug": "engine-governance",
    "chapters": [
      {"id": "sign-vs-wall", "label": "木牌 vs 承重墙", "file": "engine-governance--sign-vs-wall.mp4", "endStill": "engine-governance--sign-vs-wall-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["byp", "rb"]},
      {"id": "governed-path", "label": "治理主路径", "file": "engine-governance--governed-path.mp4", "endStill": "engine-governance--governed-path-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["cal", "flt", "def", "rb", "out"]},
      {"id": "two-layer-defense", "label": "双层防线剖面", "file": "engine-governance--two-layer-defense.mp4", "endStill": "engine-governance--two-layer-defense-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["cal", "flt", "rb", "out"]},
    ],
  },
  "event-fanout": {
    "slug": "event-fanout",
    "chapters": [
      {"id": "hundred-three", "label": "一百块三次事件", "file": "event-fanout--hundred-three.mp4", "endStill": "event-fanout--hundred-three-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["order100", "evt-1", "evt-2", "evt-3"]},
    ],
  },
  "evidence-grading": {
    "slug": "evidence-grading",
    "chapters": [
      {"id": "vendor-claim", "label": "厂商自报无复测", "file": "evidence-grading--vendor-claim.mp4", "endStill": "evidence-grading--vendor-claim-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["benchSource", "gradeCard", "vendorClaim", "retestGap"]},
    ],
  },
  "evolution-timeline": {
    "slug": "evolution-timeline",
    "chapters": [
      {"id": "stage-objects", "label": "阶段一 · 对象化", "file": "evolution-timeline--stage-objects.mp4", "endStill": "evolution-timeline--stage-objects-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["ms1", "ms2"]},
      {"id": "stage-governed-enrich", "label": "阶段二 · 通道与富化", "file": "evolution-timeline--stage-governed-enrich.mp4", "endStill": "evolution-timeline--stage-governed-enrich-end.png", "beats": 5, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["ms3", "ms4", "ms5", "ms6", "ms7a", "ms7b", "ms8", "ms9", "ms10", "ms11"]},
      {"id": "stage-ecosystem", "label": "阶段三 · 生态开放", "file": "evolution-timeline--stage-ecosystem.mp4", "endStill": "evolution-timeline--stage-ecosystem-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["ms12", "ms13", "ms14"]},
    ],
  },
  "fan-trap": {
    "slug": "fan-trap",
    "chapters": [
      {"id": "copy-inflate", "label": "复印放大 100→300", "file": "fan-trap--copy-inflate.mp4", "endStill": "fan-trap--copy-inflate-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["order100", "rawJoin", "inflated300"]},
      {"id": "aggregate-first", "label": "先聚后联铁律", "file": "fan-trap--aggregate-first.mp4", "endStill": "fan-trap--aggregate-first-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["order100", "aggFirst", "safeJoin"]},
      {"id": "measured-440", "label": "实测 200 vs 440", "file": "fan-trap--measured-440.mp4", "endStill": "fan-trap--measured-440-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["inflated300", "measured"]},
    ],
  },
  "five-laws": {
    "slug": "five-laws",
    "chapters": [
      {"id": "laws-overview", "label": "五规律总览", "file": "five-laws--laws-overview.mp4", "endStill": "five-laws--laws-overview-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["fiveLaws", "overview"]},
      {"id": "law-execution-half", "label": "执行半边与执行点", "file": "five-laws--law-execution-half.mp4", "endStill": "five-laws--law-execution-half-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["defCommodity", "execPoint"]},
      {"id": "law-two-insurance", "label": "双保险与冲突浮出", "file": "five-laws--law-two-insurance.mp4", "endStill": "five-laws--law-two-insurance-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["registerCheck", "queryRecompute", "conflictSurface"]},
      {"id": "law-trinity", "label": "声明背书审计三件套", "file": "five-laws--law-trinity.mp4", "endStill": "five-laws--law-trinity-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["declare", "endorse", "audit"]},
    ],
  },
  "forced-query-intercept": {
    "slug": "forced-query-intercept",
    "chapters": [
      {"id": "guessed-name", "label": "猜出指标名", "file": "forced-query-intercept--guessed-name.mp4", "endStill": "forced-query-intercept--guessed-name-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["retrieval", "intern", "exec"]},
    ],
  },
  "formula-vs-total": {
    "slug": "formula-vs-total",
    "chapters": [
      {"id": "declare-execute-split", "label": "声明半边×执行半边", "file": "formula-vs-total--declare-execute-split.mp4", "endStill": "formula-vs-total--declare-execute-split-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["manual", "fiveDecl", "calc", "moneyDouble"]},
    ],
  },
  "four-factor-ranking": {
    "slug": "four-factor-ranking",
    "chapters": [
      {"id": "topk", "label": "合成与显式裁决", "file": "four-factor-ranking--topk.mp4", "endStill": "four-factor-ranking--topk-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["score", "tie", "topk"]},
      {"id": "factors", "label": "四因子称重", "file": "four-factor-ranking--factors.mp4", "endStill": "four-factor-ranking--factors-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["rel", "aut", "pop", "fre"]},
      {"id": "signals", "label": "四路信号来源", "file": "four-factor-ranking--signals.mp4", "endStill": "four-factor-ranking--signals-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["q", "gov", "inf", "use", "tm"]},
    ],
  },
  "ghost-edge-pollution": {
    "slug": "ghost-edge-pollution",
    "chapters": [
      {"id": "fake-event", "label": "故意推虚构流水", "file": "ghost-edge-pollution--fake-event.mp4", "endStill": "ghost-edge-pollution--fake-event-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["ghost-push", "ingest-endpoint", "resolve-gate"]},
      {"id": "rejected", "label": "当场拒收", "file": "ghost-edge-pollution--rejected.mp4", "endStill": "ghost-edge-pollution--rejected-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["resolve-gate", "gate-reject", "ledger-clean"]},
      {"id": "gate-removed", "label": "拆掉解析闸", "file": "ghost-edge-pollution--gate-removed.mp4", "endStill": "ghost-edge-pollution--gate-removed-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["resolve-gate", "gate-stripped", "ghost-in-ledger"]},
    ],
  },
  "govern-vs-verify": {
    "slug": "govern-vs-verify",
    "chapters": [
      {"id": "third-party-critique", "label": "第三方批判", "file": "govern-vs-verify--third-party-critique.mp4", "endStill": "govern-vs-verify--third-party-critique-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["thirdPartyCritique", "agentCalc", "wrongResult"]},
      {"id": "upstream-collapse", "label": "上游提前汇总塌陷", "file": "govern-vs-verify--upstream-collapse.mp4", "endStill": "govern-vs-verify--upstream-collapse-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["rawDetail", "upstreamRollup", "semanticView"]},
    ],
  },
  "grain-collapse": {
    "slug": "grain-collapse",
    "chapters": [
      {"id": "day-pack-collapse", "label": "按天打包 · grain 塌缩", "file": "grain-collapse--day-pack-collapse.mp4", "endStill": "grain-collapse--day-pack-collapse-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["rawGrain", "dayPack", "grainCollapse"]},
      {"id": "legal-but-wrong", "label": "图纸合法 · 总数仍错", "file": "grain-collapse--legal-but-wrong.mp4", "endStill": "grain-collapse--legal-but-wrong-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["pillarLights", "blueprintLegal", "wrongTotal"]},
      {"id": "measured-477-48", "label": "477 vs 48 对撞", "file": "grain-collapse--measured-477-48.mp4", "endStill": "grain-collapse--measured-477-48-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["wrongTotal", "crash477", "verdictGovernVerify"]},
    ],
  },
  "hidden-vs-blocked": {
    "slug": "hidden-vs-blocked",
    "chapters": [
      {"id": "teardown-leak", "label": "拆除即泄露", "file": "hidden-vs-blocked--teardown-leak.mp4", "endStill": "hidden-vs-blocked--teardown-leak-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["internQuery", "teardownFlag", "leakOutcome"]},
      {"id": "hide-not-block", "label": "藏≠拦", "file": "hidden-vs-blocked--hide-not-block.mp4", "endStill": "hidden-vs-blocked--hide-not-block-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["hideSeal", "directBypass", "blockSeal", "blockedOutcome"]},
    ],
  },
  "injection-threat": {
    "slug": "injection-threat",
    "chapters": [
      {"id": "badge-question", "label": "工牌怎么发", "file": "injection-threat--badge-question.mp4", "endStill": "injection-threat--badge-question-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["bizAgent", "keyDesk"]},
      {"id": "master-key", "label": "注入即失守", "file": "injection-threat--master-key.mp4", "endStill": "injection-threat--master-key-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["masterKey", "inject", "sevenLocks", "collapse"]},
    ],
  },
  "last-snapshot-gate": {
    "slug": "last-snapshot-gate",
    "chapters": [
      {"id": "semi-additive", "label": "半可加：跨账户 vs 跨时间", "file": "last-snapshot-gate--semi-additive.mp4", "endStill": "last-snapshot-gate--semi-additive-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["weekGrid", "semiNote"]},
    ],
  },
  "lineage-ledger": {
    "slug": "lineage-ledger",
    "chapters": [
      {"id": "engine-lane", "label": "引擎执行", "file": "lineage-ledger--engine-lane.mp4", "endStill": "lineage-ledger--engine-lane-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["sql", "edg", "ledger"]},
      {"id": "ingest-lane", "label": "外部摄取", "file": "lineage-ledger--ingest-lane.mp4", "endStill": "lineage-ledger--ingest-lane-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["evt", "gate", "rej", "ledger"]},
      {"id": "ledger-and-blind", "label": "账本与盲区", "file": "lineage-ledger--ledger-and-blind.mp4", "endStill": "lineage-ledger--ledger-and-blind-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["ledger", "q", "blind"]},
    ],
  },
  "majority-shortcut": {
    "slug": "majority-shortcut",
    "chapters": [
      {"id": "popularity-wins", "label": "热度裁决错误多数胜出", "file": "majority-shortcut--popularity-wins.mp4", "endStill": "majority-shortcut--popularity-wins-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["inferredDef", "autoPick", "wrongWins", "rightAnswer"]},
    ],
  },
  "mean-of-means": {
    "slug": "mean-of-means",
    "chapters": [
      {"id": "wrong-avg-of-avg", "label": "班级平均分类比", "file": "mean-of-means--wrong-avg-of-avg.mp4", "endStill": "mean-of-means--wrong-avg-of-avg-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["divideFirst", "avgOfAvg", "classAnalogy"]},
    ],
  },
  "mechanism-experiment-matrix": {
    "slug": "mechanism-experiment-matrix",
    "chapters": [
      {"id": "three-lesions", "label": "三病灶爆发", "file": "mechanism-experiment-matrix--three-lesions.mp4", "endStill": "mechanism-experiment-matrix--three-lesions-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["naive-guess", "lesion-caliber", "lesion-drift", "lesion-pierce"]},
      {"id": "ten-teardowns", "label": "十次拆坏预告", "file": "mechanism-experiment-matrix--ten-teardowns.mp4", "endStill": "mechanism-experiment-matrix--ten-teardowns-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["lab-code", "mech-rows", "exp-cols", "verdict"]},
    ],
  },
  "multi-entry-single-truth": {
    "slug": "multi-entry-single-truth",
    "chapters": [
      {"id": "single-point-bind", "label": "单点×重算绑定", "file": "multi-entry-single-truth--single-point-bind.mp4", "endStill": "multi-entry-single-truth--single-point-bind-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["salesLead", "finAnalyst", "agentIntern", "manual"]},
      {"id": "whoever-asks", "label": "谁来问都唯一", "file": "multi-entry-single-truth--whoever-asks.mp4", "endStill": "multi-entry-single-truth--whoever-asks-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["manual", "recompute", "singleAnswer"]},
    ],
  },
  "on-demand-recompute": {
    "slug": "on-demand-recompute",
    "chapters": [
      {"id": "frozen-widetable", "label": "宽表死数字", "file": "on-demand-recompute--frozen-widetable.mp4", "endStill": "on-demand-recompute--frozen-widetable-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["ledger", "widetable", "asker"]},
      {"id": "formula-only", "label": "只存算式", "file": "on-demand-recompute--formula-only.mp4", "endStill": "on-demand-recompute--formula-only-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["widetable", "asker", "manual"]},
      {"id": "grain-recompute", "label": "按粒度翻凭证", "file": "on-demand-recompute--grain-recompute.mp4", "endStill": "on-demand-recompute--grain-recompute-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["asker", "manual", "ledger"]},
    ],
  },
  "one-checkpoint": {
    "slug": "one-checkpoint",
    "chapters": [
      {"id": "sign-vs-wall", "label": "木牌vs承重墙", "file": "one-checkpoint--sign-vs-wall.mp4", "endStill": "one-checkpoint--sign-vs-wall-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["woodSign", "sideDoor", "engineGate"]},
      {"id": "shared-checkpoint", "label": "共用执法点", "file": "one-checkpoint--shared-checkpoint.mp4", "endStill": "one-checkpoint--shared-checkpoint-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["humanReport", "appQuery", "aiReasoning", "engineGate"]},
    ],
  },
  "open-interop": {
    "slug": "open-interop",
    "chapters": [
      {"id": "portable", "label": "定义可携带", "file": "open-interop--portable.mp4", "endStill": "open-interop--portable-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["oss", "sys", "sv", "dbt"]},
      {"id": "feedback", "label": "反馈回流", "file": "open-interop--feedback.mp4", "endStill": "open-interop--feedback-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["fb", "sv", "ada"]},
      {"id": "socket", "label": "受控工具面开放", "file": "open-interop--socket.mp4", "endStill": "open-interop--socket-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["sv", "mcp", "ext", "rbx"]},
    ],
  },
  "perimeter-loss": {
    "slug": "perimeter-loss",
    "chapters": [
      {"id": "inside-effective", "label": "楼内治理全亮", "file": "perimeter-loss--inside-effective.mp4", "endStill": "perimeter-loss--inside-effective-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["insideQuery", "gateCheck", "tagBinding", "ledgerTrace", "insideEffective"]},
      {"id": "outside-void", "label": "出楼即失效", "file": "perimeter-loss--outside-void.mp4", "endStill": "perimeter-loss--outside-void-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["insideEffective", "externalModel", "voidKit", "perimeterLoss"]},
    ],
  },
  "problem-to-mechanisms": {
    "slug": "problem-to-mechanisms",
    "chapters": [
      {"id": "cause-chain", "label": "病因链", "file": "problem-to-mechanisms--cause-chain.mp4", "endStill": "problem-to-mechanisms--cause-chain-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["sym-gap", "sym-acc", "sym-col", "verdict"]},
      {"id": "encircle-pierce", "label": "病灶③合围", "file": "problem-to-mechanisms--encircle-pierce.mp4", "endStill": "problem-to-mechanisms--encircle-pierce-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["pierce", "m2", "m3", "m6"]},
      {"id": "engine-cast", "label": "铸入引擎", "file": "problem-to-mechanisms--engine-cast.mp4", "endStill": "problem-to-mechanisms--engine-cast-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["m1", "m2", "m3", "m6"]},
      {"id": "answer-ledger", "label": "应答与纳管", "file": "problem-to-mechanisms--answer-ledger.mp4", "endStill": "problem-to-mechanisms--answer-ledger-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["m4", "m5", "m7"]},
      {"id": "downgraded-lane", "label": "降级专章", "file": "problem-to-mechanisms--downgraded-lane.mp4", "endStill": "problem-to-mechanisms--downgraded-lane-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["f10", "f11", "f12"]},
    ],
  },
  "query-time-policy": {
    "slug": "query-time-policy",
    "chapters": [
      {"id": "instant-inspection", "label": "查询瞬间审查", "file": "query-time-policy--instant-inspection.mp4", "endStill": "query-time-policy--instant-inspection-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["asker", "gate", "policy"]},
      {"id": "agent-recognized", "label": "认得出代理", "file": "query-time-policy--agent-recognized.mp4", "endStill": "query-time-policy--agent-recognized-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["agent", "gate", "policy"]},
    ],
  },
  "resolve-activation": {
    "slug": "resolve-activation",
    "chapters": [
      {"id": "hit-reconcile", "label": "命中与对账", "file": "resolve-activation--hit-reconcile.mp4", "endStill": "resolve-activation--hit-reconcile-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["ag", "vq", "en"]},
      {"id": "miss-fallback", "label": "未命中回退", "file": "resolve-activation--miss-fallback.mp4", "endStill": "resolve-activation--miss-fallback-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["ag", "vq"]},
      {"id": "outside-eval", "label": "墙外评测闭环", "file": "resolve-activation--outside-eval.mp4", "endStill": "resolve-activation--outside-eval-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["ev"]},
    ],
  },
  "revocation-timeline": {
    "slug": "revocation-timeline",
    "chapters": [
      {"id": "realtime-ceiling", "label": "天花板实时求值", "file": "revocation-timeline--realtime-ceiling.mp4", "endStill": "revocation-timeline--realtime-ceiling-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["badge-live", "realtime-eval", "instant-loss", "no-stale-window"]},
      {"id": "static-snapshot", "label": "启动拍静态快照", "file": "revocation-timeline--static-snapshot.mp4", "endStill": "revocation-timeline--static-snapshot-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["badge-live", "snap-frozen", "copy-static"]},
    ],
  },
  "row-column-policy": {
    "slug": "row-column-policy",
    "chapters": [
      {"id": "perpage", "label": "逐页验放", "file": "row-column-policy--perpage.mp4", "endStill": "row-column-policy--perpage-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["cal", "po", "msk", "rap"]},
      {"id": "family", "label": "同族策略对象", "file": "row-column-policy--family.mp4", "endStill": "row-column-policy--family-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["po", "agp", "out"]},
      {"id": "agentface", "label": "代理叠加更严拒绝面", "file": "row-column-policy--agentface.mp4", "endStill": "row-column-policy--agentface-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["aid", "po", "cls"]},
    ],
  },
  "tag-gate-linkage": {
    "slug": "tag-gate-linkage",
    "chapters": [
      {"id": "intake-test", "label": "进楼考验", "file": "tag-gate-linkage--intake-test.mp4", "endStill": "tag-gate-linkage--intake-test-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["newBatch", "manualCount", "unmapped"]},
      {"id": "seventh-mechanism", "label": "第七大机制", "file": "tag-gate-linkage--seventh-mechanism.mp4", "endStill": "tag-gate-linkage--seventh-mechanism-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["newBatch", "classifier", "sysTag"]},
    ],
  },
  "three-claims-stack": {
    "slug": "three-claims-stack",
    "chapters": [
      {"id": "guess-only", "label": "没有上下文只能瞎猜", "file": "three-claims-stack--guess-only.mp4", "endStill": "three-claims-stack--guess-only-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["threeClaims", "noCtx", "agentGuess"]},
      {"id": "governed-trust", "label": "严格治理才值得信任", "file": "three-claims-stack--governed-trust.mp4", "endStill": "three-claims-stack--governed-trust-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["agentAct", "governedCtx", "agentTrusted"]},
    ],
  },
  "upstream-traceback": {
    "slug": "upstream-traceback",
    "chapters": [
      {"id": "living-ledger", "label": "台账活的可信", "file": "upstream-traceback--living-ledger.mp4", "endStill": "upstream-traceback--living-ledger-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["ol-evt", "ingest-gate", "rejected", "ledger"]},
      {"id": "three-seconds", "label": "三秒定位源头", "file": "upstream-traceback--three-seconds.mp4", "endStill": "upstream-traceback--three-seconds-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["question", "get-lineage", "ledger", "src-col"]},
    ],
  },
  "valid-sql-wrong-answer": {
    "slug": "valid-sql-wrong-answer",
    "chapters": [
      {"id": "syntax-pass", "label": "语法检查通过", "file": "valid-sql-wrong-answer--syntax-pass.mp4", "endStill": "valid-sql-wrong-answer--syntax-pass-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["queryCard", "syntaxPass", "disciplineGuard"]},
      {"id": "business-fail", "label": "业务语义错误", "file": "valid-sql-wrong-answer--business-fail.mp4", "endStill": "valid-sql-wrong-answer--business-fail-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["bizFail", "verdict"]},
    ],
  },
  "venn-intersection": {
    "slug": "venn-intersection",
    "chapters": [
      {"id": "two-iron-rules", "label": "两大核心铁律", "file": "venn-intersection--two-iron-rules.mp4", "endStill": "venn-intersection--two-iron-rules-end.png", "beats": 2, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["badge", "intersect", "swipe", "audit"]},
    ],
  },
  "vqr-lifecycle": {
    "slug": "vqr-lifecycle",
    "chapters": [
      {"id": "signed-stamped", "label": "签字盖章", "file": "vqr-lifecycle--signed-stamped.mp4", "endStill": "vqr-lifecycle--signed-stamped-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["draft", "stamped", "asset"]},
    ],
  },
  "zero-window-sequence": {
    "slug": "zero-window-sequence",
    "chapters": [
      {"id": "experiment-risk", "label": "实验展示风险", "file": "zero-window-sequence--experiment-risk.mp4", "endStill": "zero-window-sequence--experiment-risk-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["experimenter", "snap", "orders"]},
      {"id": "dynamic-intersect", "label": "动态交集求值", "file": "zero-window-sequence--dynamic-intersect.mp4", "endStill": "zero-window-sequence--dynamic-intersect-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["live", "mentor", "orders"]},
      {"id": "zero-window", "label": "零越权窗口", "file": "zero-window-sequence--zero-window.mp4", "endStill": "zero-window-sequence--zero-window-end.png", "beats": 1, "leadSec": 0.44, "storySec": 1.0, "beatNodes": ["mentor", "snap", "live"]},
    ],
  },
} as const;

export type ArchifySlug = keyof typeof ARCHIFY;
