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
  // danger：反例/退化路径（e3 改「且」漏触发帧 / e4 硬注入撞回合帧 / 锁占用红光）
  // （恒配 ✗ 与左红轨，仅失败态）
  danger: '#FF5C5C',
  // ok：机制在位/交付成功（OR 命中触发帧 / 五枚走开重看绿点 / 空闲注入帧）
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

  // ── 本集概念色（planning §三；series.json accents 登记 [#8B93F8, #56C8FF]，
  //    2026-10-31 文案轮定稿值）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1–ep13 逐像素同值即「描边色/线宽承锁定值全片不变」的落地）。本集环体
  //    不换装不高亮、环上没有任何指针——「循环里没有表」是 P0 的暗转建锚点；
  //    时间感全加在环外四层链上（sched/queue 双色轴），环体只承载「照常开工」
  //    的执行宿主语义（1-C / 2-B 转一圈、3-C 回合窗熄下才注入、4-B 缩微复亮、
  //    5-A 定格收束——状态色经容器透明度承载，描边契约不动）
  core: '#D97757',
  // sched：本集主题色一 = 判时调度线程长春花蓝——判时表盘（每秒一闪）/ 随行
  //    熄灭小签 / 生命线 / 夜语义微光（对 bg 6.9:1）。撞色自证：色相 ≈235°，
  //    系列已用蓝紫族最近邻 ep13 mech #7C9EFF≈227°（差 8°、本值偏紫一档）、
  //    ep12 mech #9B8CFF≈248°（差 13°）——本值是系列层文案轮定稿登值（ep13
  //    授蓝：片头授色站 series-intro theme.mech 不读本键），按集独立语义不撞值。
  sched: '#8B93F8',
  // queue：本集主题色二 = 队列与交付链路晴空蓝——队列账本条目 / 到点任务签 /
  //    走开-回来巡检 / 注入消息流（与长春花蓝构成「判时→交付」双色轴；对 bg
  //    8.6:1）。撞色自证：色相 ≈199°，系列已用亮蓝族最近邻 ep12 unlock
  //    #58B7FF≈203°（差 4°、亮度更亮一档）——系列层定稿登值，按集独立语义。
  queue: '#56C8FF',
  // mech：本集之物色位 = 判时表盘（长春花蓝同值——scene 代码里以「本集主题物」
  //    语义引用处走本键，与 sched 单一事实源；承 ep13「mech=主题色一」槽位）
  mech: '#8B93F8',
  // tool：工况伴色（青碧承 ep1–ep13 同语义——工况角标 / 终端窗 / 既有工具件）
  tool: '#64C4C0',
} as const;
