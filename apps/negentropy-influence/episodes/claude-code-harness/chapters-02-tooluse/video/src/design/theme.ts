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

  // ── 本集概念色（2026-10-29 定：承系列契约——环体恒定锚陶土橙继续出场（本集
  //    高亮「执行」段）；本集主题色换琥珀=查表分发/工具卡；warn 承系列反例语义。
  //    决策记录三处同步：theme.ts / planning.md §三 / README；series.json accents
  //    同步登记 [#EFB13C, #EF6461]）──
  // loop：循环环体恒定锚〔M-001〕（陶土橙，系列恒定色，非本集 accents——ep1 持有）
  loop: '#D97757',
  // core：本集主题色——查表分发/工具卡（琥珀，on #0E1116 对比度 9.9:1）
  core: '#EFB13C',
  // tool：执行面/结果回喂流（青碧，承 ep1 同语义；非本集 accents——ep1 持有）
  tool: '#64C4C0',
  // warn：错绑反例/越界（珊瑚红，与底座 danger 同族强调档，本集 accents 第二色）
  warn: '#EF6461',
  // mech：片头「本集之物」授色档（series-intro.tsx 逐字孪生件直读 theme.mech；
  //    按系列规约 = 本集 accents 第二色 #EF6461）
  mech: '#EF6461',
} as const;
