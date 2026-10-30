/** 系列身份数据面：五大组 × 20 章拆集（claude-code-chapters 系列适配层）。
 *
 * 片头组件 series-intro.tsx 是跨系列字节孪生件（种子在
 * series-assets/claude-code-explained/intro/，check_twin_files 执法），其
 * 「五站点 + 五进度点 + 标题卡」的词表以 5 为模数——而本系列 series.json 按
 * 集登记、20 集逐集增长，series-layers.json 的 layers（build_narration 从
 * series.json 派生）直接喂给片头会在第 6 集起越界（STATION_XS 固定 5 槽）。
 * 故本文件承担**集→组**的重塑：站点/点火/进度点 = 课程五大组（与片头音频
 * 「五种核心机制」逐词对位），标题卡与授色站取当前集的组与真实集题。
 *
 * 分组依据 = source-map/claude-code-chapters.md §三 的五大组归属表（唯一登记处）：
 *   工具与执行 s01–s04 · 规划与协调 s05–s07/s10/s11 · 记忆管理 s08/s09 ·
 *   并发 s13/s14 · 多 Agent s12/s15–s20。
 * 归属在集轴上不连续（s08/s09 记忆与 s10/s11 规划交错、s12 多 Agent 先于
 * s13/s14 并发），连续区间表达不了，按集号查表。改分组（章节增删）⇒ 只改
 * EPISODE_GROUPS（与登记表同步），series-layers 数据面同 build 重派生。
 */
import series from '../series-layers.json';

export type Layer = {index: number; layer: string; title: string; published: boolean};

/** 五大组名——与片头 NARRATION「工具与执行、规划与协调、记忆管理、并发，以及
 *  多 Agent」逐词对位（音频是系列级固定资产，组名不可擅改）。 */
const GROUP_NAMES = ['工具与执行', '规划与协调', '记忆管理', '并发', '多 Agent'] as const;

/** 各集所属组号（1 基，下标 = 集号-1；集号=章号 1:1，据五大组归属表查表）。 */
const EPISODE_GROUPS = [1, 1, 1, 1, 2, 2, 2, 3, 3, 2, 2, 5, 4, 4, 5, 5, 5, 5, 5, 5] as const;

/** 集号 → 组号（1 基）。越界（系列登记尚不齐时的高集号）钳到末组。 */
export const groupOf = (episode: number): number =>
  EPISODE_GROUPS[Math.min(Math.max(episode, 1), EPISODE_GROUPS.length) - 1];

/** 组内集号清单（升序，如组 2 → [5, 6, 7, 10, 11]）。 */
const episodesOf = (group: number): number[] => {
  const eps: number[] = [];
  for (let k = 0; k < EPISODE_GROUPS.length; k += 1) {
    if (EPISODE_GROUPS[k] === group) eps.push(k + 1);
  }
  return eps;
};

/** 集号清单折叠为区间串：[5,6,7,10,11] → 「5–7、10–11」。 */
const formatEps = (eps: number[]): string => {
  const runs: string[] = [];
  let start = eps[0];
  let prev = eps[0];
  for (const e of eps.slice(1)) {
    if (e === prev + 1) {
      prev = e;
      continue;
    }
    runs.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = e;
  }
  runs.push(start === prev ? `${start}` : `${start}–${prev}`);
  return runs.join('、');
};

const rawLayers = series.layers as Layer[];
const currentEp = series.activeIndex as number;
const currentLayer = rawLayers[currentEp - 1] ?? rawLayers[0];
const activeGroup = groupOf(currentEp);

/** 片头消费的层表：五组各一层。当前组携带真实集题（标题卡主/副段拆「：」）；
 *  其余组给集段说明（归属不连续时按区间串列全，片头不渲染非活动层标题，
 *  值仅保语义完整）。 */
export const LAYERS: Layer[] = GROUP_NAMES.map((name, i) => {
  const index = i + 1;
  return {
    index,
    layer: name,
    title: index === activeGroup && currentLayer ? currentLayer.title : `第 ${formatEps(episodesOf(index))} 集`,
    published: index === activeGroup ? (currentLayer?.published ?? false) : false,
  };
});

export const ACTIVE_INDEX = activeGroup;
/** P6 式下期预告在本系列由 P5 场景内联承载（无统一收尾装置），此导出仅为
 *  数据面完整；next = 下一集标题（series-layers 派生）。 */
export const NEXT_LAYER = series.next ?? null;
