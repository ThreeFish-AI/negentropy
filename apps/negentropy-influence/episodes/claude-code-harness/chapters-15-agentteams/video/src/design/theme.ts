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
  // danger：反例/退化路径（共用对话渗染帧 / 双入口抓空帧 / 左轨「待处理」卡死帧）
  // （恒配 ✗ 与左红轨，仅失败态）
  danger: '#FF5C5C',
  // ok：机制在位/办成落定（右轨两单关机对号落定 / 权限放行一闪 / 办成状态格）
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

  // ── 本集概念色（planning §三；series.json accents 登记 [#D946EF, #3EB6E8]，
  //    2026-10-31 文案轮定稿值）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1–ep14 逐像素同值即「描边色/线宽承系列锁定值全片不变」的落地）。本集
  //    首次出现多枚同款环体并列：主代理橙环恒 core，队友环体为同尺寸同转速的
  //    品红副本（TeammateRing 读 mate）——「循环没换、只是多了几条」由同款
  //    几何 + 仅描边色区分承载（0-A 首亮 / 2-A 多环并列 / 3-C..3-E 迷你编队 /
  //    4-A 生产拓扑 / 5-A 环群收束 / 5-C 两环对望）
  core: '#D97757',
  // mate：本集主题色一 = 队友线程/并行身份品红——同款环体副本、并行身份牌
  //    （alice/bob 名牌）、审批冒泡回路、对照条右栏（对 bg 5.9:1）。撞色自证：
  //    色相 ≈300°，系列已用蓝紫族最近邻 ep12 mech #9B8CFF≈248°（差 52°），
  //    与同日兄弟集雾紫族（#8B7CF6 系 ≈253°）主动拉大色相距离（品红相 vs
  //    蓝紫相）——系列层文案轮定稿登值，按集独立语义不撞值。
  mate: '#D946EF',
  // inbox：本集主题色二 = 收件箱/消息流湛蓝——信箱文件、追加一行逐字落格 /
  //    整摞取走清空、每秒探测脉冲、消息注入流、总结信信流（对 bg 7.8:1）。
  //    撞色自证：色相 ≈197°，系列已用亮蓝族最近邻 ep14 queue #56C8FF≈203°
  //    （差 6°、本值偏青一档、亮度低一档）——系列层定稿登值，按集独立语义。
  inbox: '#3EB6E8',
  // mech：本集之物色位 = 信箱文件（湛蓝同值——scene 代码里以「本集主题物」
  //    语义引用处走本键，与 inbox 单一事实源；片头授色站 series-intro
  //    theme.mech 读本键 = 第五组图层以信箱湛蓝授色）
  mech: '#3EB6E8',
  // tool：工况伴色（青碧承 ep1–ep14 同语义——工况角标 / 终端窗 / 既有工具件）
  tool: '#64C4C0',
} as const;
