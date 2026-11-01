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
  // danger：全量内联反例 / 爆涨带警示描边 / 计费帧红（恒配 ✗，仅失败态）
  danger: '#FF5C5C',
  // ok：两级加载在位 / 按需命中 / 预算闸放行（确认绿）
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

  // ── 本集概念色（planning §三；series.json accents 登记 [#7E77E8, #4E9DF5]，
  //    2026-10-31 文案轮定稿值）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1–ep6 逐像素同值即「描边色/线宽承锁定值全片不变」的落地）
  core: '#D97757',
  // mech：本集主题色 A = 目录常驻层 / 注册表 / 开场白带目录态（紫）——书目行、
  //    名字↔技能登记表、注入开场白的常驻带（对 bg 5.9:1）。色相自证：≈244°，
  //    系列已用紫族最近邻 ep6 mech #9B8AFB≈246° 同域亮度阶差可辨，且本集紫为
  //    新增语义、按集独立（storyboard 前言明文）；accents 已登记不撞值。
  mech: '#7E77E8',
  // load：本集主题色 B = 全文按需加载通道与全文卡（蓝）——加载调用、全文卡
  //    一次性进场（对 bg 6.1:1；色相 ≈210°，与 ep3 边界蓝 #4E9EFF≈213° /
  //    ep4 回调蓝 #58A6FF≈212° 差 ≥2° 非同值，accents 已登记、本集语义独立）
  load: '#4E9DF5',
  // tool：执行面伴色（青碧承 ep1–ep6 同语义——系列恒定环体伴色）
  tool: '#64C4C0',
} as const;
