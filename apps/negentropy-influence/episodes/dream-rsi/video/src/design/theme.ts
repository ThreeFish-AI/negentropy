/**
 * 本集视觉契约（seed —— scaffold 复制后**必须**按本集重写概念色）。
 *
 * 底座常量四集通用、不要改；概念色是每集独立设计的产物，规则见
 * pipeline/skills/06-remotion-implementation.md：
 *   - 2–3 个概念色，映射「深度轴」而非枚举条目
 *   - 对 bg (#0E1116) 对比度 ≥ 4.5:1（用 `qa_frames.py --check-theme` 实测）
 *   - 色相不得与已用色撞车（各集 theme.ts 实占色值见 `check_series.py`
 *     运行时打印的 occupied-hex INFO 行）
 *   - 覆写任何底座 token 须在 theme.ts / planning.md / README 三处留决策记录
 */
export const theme = {
  // ── 底座（跨集通用，勿改）──
  bg: '#0E1116',
  panel: '#171C26',
  panelBorder: '#2A3242',
  text: '#F2F5FA',
  dim: '#9AA7B8',
  // danger 曾缺席本 seed（既有四集 theme.ts 全都有、场景代码读 theme.danger，
  // scaffold 出的新集开箱即 TS2339）——补齐即与四集现状对齐。
  danger: '#FF5C5C',
  // ok 覆写决策（仿 EP3 先例，底座值 #7ED321 → grow 绿）：argmax 胜出=通过防回退闸，
  // 语义合一避免片内双绿打架；决策记录同步落 planning.md 与 README。
  ok: '#A3E635',

  // ── 字体族（跨集通用，勿改）──
  // **必须留在 theme 内**：frozen 档的 cards.tsx 与 Subtitle.tsx 读的是
  // `theme.serif` / `theme.sans`。拆成独立的 `font` 导出会让 scaffold 出的新集
  // 开箱即 6 个 TS2339 —— 而 theme.ts 属 seeded 档、不受 verify_skeleton 执法，
  // 漂移门报 0 处也证明不了新集可编译（判据见 tests/test_skeleton.py 的
  // test_template_theme_covers_frozen_component_tokens）。
  serif: "'Songti SC', 'STSong', 'Noto Serif SC', serif",
  sans: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', sans-serif",
  mono: "'SF Mono', 'Menlo', 'JetBrains Mono', monospace",

  // ── 本集概念色（《翻旧账不花钱：AI 在梦里改章程》）──
  // 三条深层轴 + 昼夜二元母题：白天进山（暖白·贵·随机）vs 夜里做梦（冰蓝·免费·确定），
  // 改进/胜出恒为嫩绿。语义细则见 script/planning.md 视觉契约节。
  // 系列内已用色核对（check_series 规则 4 INFO 行，2026-09-22）：三值均无精确撞车；
  // sun #FFE3B3 与 EP1 金 #F5C542 同色相族不同明度/饱和——草渲目检若违和切钢灰中性备选。
  dream: '#7DD3FC', // 离线/免费/确定/可反复——做梦·重放模拟器·历史池（主色）
  dreamDeep: '#0F3244',
  sun: '#FFE3B3', // 在线/贵/随机/一次性——真实进山·在线推演·烧钱
  sunDeep: '#4A3B1F',
  grow: '#A3E635', // 改进/胜出/章程演进——πt→πt+1·argmax 胜出·V 上升
  growDeep: '#2E4210',
} as const;
