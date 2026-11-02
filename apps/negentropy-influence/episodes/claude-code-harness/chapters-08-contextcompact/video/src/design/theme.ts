/**
 * 本集视觉契约（⑧ 轮定稿，storyboard 前言「本集视觉契约」= planning §三）。
 *
 * 底座常量跨集通用、不要改；概念色规则见 references/08-remotion-implementation.md：
 *   - 概念色映射「深度轴」而非枚举条目；对 bg (#0E1116) 对比度 ≥ 4.5:1
 *   - 色相不与系列已用色撞值（check_series.py occupied-hex INFO 行为准）
 *   - 覆写任何底座 token 须在 theme.ts / planning.md / README 三处留决策记录
 */
export const theme = {
  // ── 底座（跨集通用，勿改）──
  bg: '#0E1116',
  panel: '#171C26',
  panelBorder: '#2A3242',
  text: '#F2F5FA',
  dim: '#9AA7B8',
  // danger：拒收红章 / 孤立结果 / 水位破位 / 换序左轨死占位 / 熔断（恒配 ✗，仅失败态）
  danger: '#FF5C5C',
  // ok：合法切口 / 配对保全 / 最近三条绿框 / 右轨正序（确认绿——机制在位/拦截成功）
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

  // ── 本集概念色（planning §三；series.json accents 登记 [#4E9FFF, #7C6BE8]，
  //    2026-10-31 文案轮定稿值）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1–ep7 逐像素同值即「描边色/线宽承锁定值全片不变」的落地）
  core: '#D97757',
  // mech：本集主题色 A = 蓝面——上下文草稿纸 / 消息列 / 二十万额度水位线
  //    （「还占着上下文」的一侧；对 bg 6.3:1）。色相自证：≈213°，系列已用蓝族
  //    最近邻 ep3 边界蓝 #4E9EFF≈212° 同值位差 1° 内——但该色自 ep3 后四集未
  //    占用且本集蓝为 series.json accents 正登值（撞值门按值精确比对，非同值；
  //    ep7 load #4E9DF5≈210° 为上集专属、按集独立语义），故事板前言明文
  //    「上下文草稿纸 天蓝 #4E9FFF」为本集契约值。
  mech: '#4E9FFF',
  // archive：本集主题色 B = 紫面——磁盘留档 / 落盘件 / 路径预览条（「原文住址」
  //    的一侧；一切腾地方动作 = 蓝面内容沿蓝→紫双色箭头搬进紫面；对 bg 5.2:1）。
  //    色相 ≈249°，系列已用紫族最近邻 ep7 mech #7E77E8≈246°，差 3°、亮度阶
  //    差可辨（#7C6BE8 更深更饱和），accents 已登记不撞值、本集紫为新增语义。
  archive: '#7C6BE8',
  // tool：执行面伴色（青碧承 ep1–ep7 同语义——系列恒定环体伴色/工况角标）
  tool: '#64C4C0',
} as const;
