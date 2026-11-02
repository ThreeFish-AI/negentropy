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
  // danger：反例/退化路径（「行」红晕 / 误批红沉 / 翻案帧 / 抓空红闪 / 左轨退化）
  // （恒配左红轨与已拒绝态，仅失败态）
  danger: '#FF5C5C',
  // ok：机制在位/拦截成功/办成落定（右轨弹开 / 状态翻绿 / 单点入口闸门）
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

  // ── 本集概念色（planning §三；series.json accents 登记 [#7D91FF, #C792EA]，
  //    2026-10-31 文案轮定稿值）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1–ep15 逐像素同值即「描边色/线宽承系列锁定值全片不变」的落地）。
  //    本集高亮环上「轮末查信」挂点段（4-B 点亮、5-A 收束定格，自此镜起锁定）。
  core: '#D97757',
  // mate：队友环体品红——同尺寸同转速副本（TeammateRing 读 mate，承 ep15
  //    已建设施：0-A 编队 / 0-B 被硬掐 / 2-A 队友甲 / 5-B 参与者分立）
  mate: '#D946EF',
  // req：本集主题色一 = 请求流转/登记表靛蓝——带编号请求单的开单与投递链路
  //    （request_id 贯穿四步的视觉主线）、登记表行与表头、142 号徽章对签
  //    （对 bg 6.2:1）。撞色自证：色相 ≈231°，系列已用蓝簇最近邻 ep14 queue
  //    #56C8FF≈203°、ep15 inbox #3EB6E8≈197°（差 ≥28°，承文案轮去撞色微调）
  req: '#7D91FF',
  // receipt：本集主题色二 = 回执落定/销账拍兰紫——对号销账动作与状态翻转的
  //    落定瞬间（待处理→已批准/已拒绝 的决议拍、回执卡回流，对 bg 7.1:1）。
  //    撞色自证：色相 ≈280°，与 ep15/ep17 雾紫族 #8B7CF6≈253° 拉开色相距
  receipt: '#C792EA',
  // inbox：信箱湛蓝——承 ep15 信箱同款签名（4-A「队友甲的收件箱格」跨集设施
  //    连续性色，非本集主题色；MailboxFile 直读本值，值承 ep15 逐像素）
  inbox: '#3EB6E8',
  // mech：本集之物色位 = 登记表（靛蓝同值——scene 代码里以「本集主题物」语义
  //    引用处走本键，与 req 单一事实源；片头授色站 series-intro theme.mech
  //    读本键 = 第五组图层以登记表靛蓝授色）
  mech: '#7D91FF',
  // tool：工况伴色（青碧承 ep1–ep15 同语义——工况角标 / 查信工具卡）
  tool: '#64C4C0',
} as const;
