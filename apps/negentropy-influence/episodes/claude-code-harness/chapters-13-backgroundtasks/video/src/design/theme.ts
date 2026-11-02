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
  // danger：反例/退化路径（消融左轨 / 教学版超时帧 / 违规红叉 / 补写箭头被掐断）
  // （恒配 ✗，仅失败态）
  danger: '#FF5C5C',
  // ok：机制在位/拦截成功（兜底在位右轨 / 同框兑现 / durable 拾起）（确认绿）
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

  // ── 本集概念色（planning §三；series.json accents 登记 [#7C9EFF, #C084FC]，
  //    2026-10-31 文案轮定稿值）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1–ep12 逐像素同值即「描边色/线宽承锁定值全片不变」的落地；本集环上
  //    「执行」段是被「等待」砖压停/解放的时点段——P0 压停、P2 起解放、P5 定格收束）
  core: '#D97757',
  // mech：本集主题色一 = 后台执行蓝（雾蓝）——后台执行线全体（后台线程轨/
  //    登记表描边/bg_0001 编号签/后台侧命令卡）（「正在后台跑」的元素；对 bg
  //    7.4:1）。撞色自证：色相 ≈224°，系列已用蓝族最近邻 ep11 mech #6C8CFF≈226°
  //    （差 2°、亮度更亮的一档）与 ep12 unlock #58B7FF≈206°（差 18°）——本值是
  //    系列层文案轮定稿登值（ep13 授蓝：片头授色站 series-intro theme.mech 同源
  //    本值），按集独立语义不撞值；与青碧 tool #64C4C0≈178° 拉开蓝相/青绿相。
  mech: '#7C9EFF',
  // notify：本集主题色二 = 通知注入兰紫——通知注入流全体（独立通知卡描边/
  //    通知合入的新消息事件）（与雾蓝构成「发出→回注」时间轴对照；对 bg 7.1:1）。
  //    撞色自证：色相 ≈270°，系列已用紫族最近邻 ep10 mech #A78BFA≈262°（差 8°）、
  //    ep11 backoff #B48EF5≈275°（差 5°）、ep12 mech #9B8CFF≈248°（差 22°）——
  //    兰紫一档系列层定稿登值，按集独立语义不撞值。
  notify: '#C084FC',
  // tool：工况伴色（青碧承 ep1–ep12 同语义——工况角标 / 终端窗 / 既有工具件）
  tool: '#64C4C0',
} as const;
