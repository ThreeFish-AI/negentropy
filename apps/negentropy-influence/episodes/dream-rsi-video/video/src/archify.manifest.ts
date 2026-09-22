// ⚠️ 一次性 dev 占位（仅供场景开发期 tsc）——录制完成后由 scripts/archify_manifest.py
// 整体重写为真实 leadSec/storySec/endStill，请勿在手改后忘记重跑生成器。
// 数据来源（真实版）：pipeline/scripts/record_archify.py --mode chapter + scripts/archify_lead.py。

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

const D = (slug: string, type: string, chapters: [string, string, string[]][]): ArchifyDiagram => ({
  slug,
  type,
  chapters: chapters.map(([id, label, nodes]) => ({
    id,
    label,
    file: `${slug}--${id}.mp4`,
    endStill: `${slug}--${id}-end.png`,
    beats: nodes.length,
    leadSec: 0.5,
    storySec: 4,
    beatNodes: nodes,
  })),
});

export const ARCHIFY = {
  'two-phase-loop': D('two-phase-loop', 'workflow', [
    ['online', '白天进山：章程带队探索', ['policy', 'workers', 'tree']],
    ['offline', '夜里做梦：历史钉上沙盘', ['history', 'sim', 'score']],
    ['revise', '做梦内环：幕僚长改章程', ['sim', 'score', 'dev']],
    ['guard', '防回退闸：候选含现任', ['score', 'select']],
    ['loop', '递归闭环：新章程再上线', ['tree', 'history', 'policy']],
  ]),
  'replay-simulator': D('replay-simulator', 'workflow', [
    ['visible', '只看已见的部分', ['obs', 'elig']],
    ['freedom', '批次即全部自由度', ['elig', 'batch']],
    ['root-rule', '选根：按建档序开枝', ['batch', 'rootpick']],
    ['chain-rule', '选叶：唯一记录后继', ['batch', 'chain']],
    ['score-out', '长大、终止、计分', ['newview', 'term', 'v']],
  ]),
  'expedition-setup': D('expedition-setup', 'architecture', [
    ['team', '探险队与选路章程', ['expedition', 'policy']],
    ['ledger', '台账：越铺越大的发现树', ['ledger']],
    ['sandbox', '沙盘：翻旧账免费', ['sandbox']],
    ['staff', '幕僚长照推演改章程', ['dev', 'policy']],
  ]),
  'dilemma-cost': D('dilemma-cost', 'workflow', [
    ['dilemma', '两条路都堵', ['rsi', 'fixed', 'online']],
    ['stuck', '写死砸空转 vs 改不起', ['fixed-harm', 'online-cost']],
    ['verdict', '成本结构的死结', ['verdict']],
    ['breakthrough', '破局：历史已是模拟器', ['breakthrough']],
  ]),
  'history-as-simulator': D('history-as-simulator', 'dataflow', [
    ['origin', '旧台账变免费试验场', ['history', 'simulator']],
    ['specs', '四块基石', ['spec-code', 'spec-replay', 'spec-bound', 'spec-loop']],
    ['cycle', '回灌循环', ['cycle']],
  ]),
  'discovery-tree': D('discovery-tree', 'dataflow', [
    ['grow', '台账长成树', ['root', 'branch-a', 'branch-b']],
    ['pages', '新页的出身与身价', ['page-a', 'page-b']],
    ['interface', '同一套决策接口', ['interface']],
  ]),
  'determinism-proof': D('determinism-proof', 'lifecycle', [
    ['reset', '重置到根再出发', ['reset', 'pick']],
    ['nonroot', '老节点：唯一后继', ['reveal-child']],
    ['root', '树根：建档序开枝', ['reveal-earliest']],
    ['end', '长大与终止', ['grow', 'terminate']],
  ]),
  'four-charters': D('four-charters', 'dataflow', [
    ['one-tree', '同一棵树，谁来做梦', ['tree']],
    ['scores', '四种章程四份成绩单', ['p-parallel', 'p-adaptive', 'p-early', 'p-serial']],
    ['takeaway', '一次真实换无数次免费', ['takeaway']],
  ]),
  'v-three-terms': D('v-three-terms', 'dataflow', [
    ['quality', '第一项：最好收获', ['quality']],
    ['cost', '第二项：翻页工钱', ['cost']],
    ['parallel', '第三项：并行奖励', ['parallel']],
    ['total', '性价比与它的另一副面孔', ['score', 'average', 'caliber-note']],
  ]),
  'proto-two-rounds': D('proto-two-rounds', 'lifecycle', [
    ['t1', '第一轮：并行铺满', ['round1']],
    ['dream', '做梦一轮：换章程', ['dream']],
    ['t2', '第二轮：新章程交卷', ['round2', 'combo']],
    ['frozen', '变的只有章程', ['result']],
    ['combo', '收放批次', ['combo']],
  ]),
  'teardown-d1-guard': D('teardown-d1-guard', 'lifecycle', [
    ['intact', '保险在：现任兜底', ['intact']],
    ['removed', '拆掉：矮子拔将军', ['removed', 'worse-wins', 'degrade']],
    ['insurance', '零成本防回退保险', ['lesson']],
  ]),
  'teardown-d4-peek': D('teardown-d4-peek', 'dataflow', [
    ['legal', '老实按页翻', ['legal', 'legal-score']],
    ['cheat', '越权抽最优页', ['peek', 'peek-score']],
    ['reversal', '排名反转', ['reversal', 'lesson']],
    ['lesson', '评估要对成本负责', ['lesson']],
  ]),
  'teardown-d5-lockin': D('teardown-d5-lockin', 'lifecycle', [
    ['inject', '把历史浓缩成一句建议', ['inject', 'locked']],
    ['replay', '做梦改进的对照组', ['replay-path', 'reached']],
    ['diversity', '洞见锁方向，重放保多样', ['verdict']],
  ]),
  'evidence-162x-caliber': D('evidence-162x-caliber', 'dataflow', [
    ['bars', '三根柱子', ['ours', 'controlled', 'simples']],
    ['ratio', '约两个数量级', ['ratio']],
    ['warn', '口径警示', ['caliber-warn']],
    ['split', '拆开看', ['dataset-split']],
  ]),
  'behavior-adaptive': D('behavior-adaptive', 'lifecycle', [
    ['early', '起步：满编探索', ['early']],
    ['save', '顺境：主动省钱', ['economize', 'stalled']],
    ['re-explore', '停滞：加码再探', ['re-explore']],
    ['perf', '成绩单', ['performance', 'lesson']],
  ]),
  'unproven-list': D('unproven-list', 'workflow', [
    ['head', '论文没有证明的事', ['frontier']],
    ['gap-12', '相关性与成本账', ['gap-correlation', 'gap-cost']],
    ['gap-345', '口径、方差与边界', ['gap-caliber', 'gap-variance', 'gap-fidelity']],
  ]),
} as const;

export type ArchifySlug = keyof typeof ARCHIFY;
