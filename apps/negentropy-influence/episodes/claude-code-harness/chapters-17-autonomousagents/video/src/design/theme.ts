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
  // danger：反例/退化路径（撤锁双写帧 / 终值被后写覆盖 / 陷阱卡依赖红灯 /
  // 天平「怕空转」计价器——恒配左红轨与被挡路径，仅失败态）
  danger: '#FF5C5C',
  // ok：机制在位/单成功（装回锁仅一人成功 / 四卡全部落地 / 按被挡算的拦截灯）
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

  // ── 本集概念色（planning §三；series.json accents 登记 [#38BDF8, #E879F9]，
  //    2026-10-31 文案轮定稿值）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1–ep16 逐像素同值即「描边色/线宽承系列锁定值全片不变」的落地）。
  //    本集环体退居背景节拍器：队长=主代理橙环挂侧（0-A 派活瓶颈现场）。
  core: '#D97757',
  // mate：队友环体品红——同尺寸同转速副本（TeammateRing 读 mate，承 ep15/
  //    ep16 已建设施：0-A 编队 / 1-A 随三状态变速 / 2-C 认领回 WORK 加速+
  //    高亮一小段 / 5-A 同形回归缩悬钟侧）
  mate: '#D946EF',
  // watch：本集主题色① = 值班钟/空闲轮询节律 天蓝（对 bg ≈8.8:1）——值班钟
  //    装置、五秒钟摆两落点、十二拍计数环、IDLE 呼吸态、身份说明卡、三条件
  //    判据灯。撞色自证：色相 ≈199° 偏青侧（planning Stage ① 微调换轨——同日
  //    18 集并行撰稿紫簇已密，取偏青侧拉开与钢蓝族距离）；与 inbox 湛蓝
  //    （ep15 承袭设施色）近邻但装置域不重叠（钟体=圆形节律件 / 信箱=文件卡）
  watch: '#38BDF8',
  // lock：本集主题色② = 认领临界区/锁窗口 洋红（对 bg ≈7.4:1）——一次只许
  //    一个人进的代码段、双重锁两道闩、锁内重读提示牌、五步一口气括弧、
  //    窗口裂缝的排他色。撞色自证：色相 ≈291° 洋红带全系未占（「排他窗口」
  //    闪断语义最强、与警示红族色相拉开 ≥40°）
  lock: '#E879F9',
  // inbox：信箱湛蓝——承 ep15/ep16 信箱同款签名（1-E「队长收件箱格口」跨集
  //    设施连续性色，非本集主题色；MailboxFile 直读本值，值承 ep15 逐像素）
  inbox: '#3EB6E8',
  // mech：本集之物色位 = 值班钟（天蓝同值——scene 代码里以「本集主题物」语义
  //    引用处走本键，与 watch 单一事实源；片头授色站 series-intro theme.mech
  //    读本键 = 第五组图层以值班钟天蓝授色）
  mech: '#38BDF8',
} as const;
