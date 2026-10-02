/**
 * 本集视觉契约（seed —— scaffold 复制后**必须**按本集重写概念色）。
 *
 * 底座常量四集通用、不要改；概念色是每集独立设计的产物，规则见
 * references/08-remotion-implementation.md：
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
  ok: '#7ED321',

  // ── 字体族（跨集通用，勿改）──
  // **必须留在 theme 内**：frozen 档的 cards.tsx 与 Subtitle.tsx 读的是
  // `theme.serif` / `theme.sans`。拆成独立的 `font` 导出会让 scaffold 出的新集
  // 开箱即 6 个 TS2339 —— 而 theme.ts 属 seeded 档、不受 verify_skeleton 执法，
  // 漂移门报 0 处也证明不了新集可编译（判据见 tests/test_skeleton.py 的
  // test_template_theme_covers_frozen_component_tokens）。
  serif: "'Songti SC', 'STSong', 'Noto Serif SC', serif",
  sans: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', sans-serif",
  mono: "'SF Mono', 'Menlo', 'JetBrains Mono', monospace",

  // ── 本集概念色（重制种子：沿用系列维度色系，Stage ② 策划时终定并复算对比度）──
  // 语义：陶土橙=循环内核（系列恒定锚）；鸢紫=本集机制维度（规划与协调五装置）
  concept: '#D97757',
  conceptDeep: '#B45A3C',
  accent: '#9C90EE',

  // ── 系列语义键（V3D 3D 层读；HarnessStack/motifs 消费）──
  // core = 循环内核：**全系列恒定 #D97757**（「循环始终不变」主线的视觉锚）；
  // mech/mechDeep = 挂在内核外的机制：**每集维度色**（本集 #9C90EE 鸢紫）——
  // 「循环不变、机制每集不同」的语义分工。deny 复用 danger（拒绝/危险唯一语义）。
  // 对比度实测（对 bg #0E1116）：#9C90EE=6.88:1 · #7A72C4=4.53:1（qa --check-theme 复验）。
  core: '#D97757',
  coreDeep: '#B45A3C',
  deny: '#EF6461', // 拒绝/危险唯一语义（3D 层读；与 danger 同源）
  mech: '#9C90EE',
  mechDeep: '#7A72C4',
} as const;
