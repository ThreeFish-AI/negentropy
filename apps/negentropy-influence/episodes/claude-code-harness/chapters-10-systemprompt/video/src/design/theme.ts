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
  // danger：反例 / 退化路径（欠债清单描边 / 消融左轨 / 缓存失效闪断 / 报错波形）
  // （恒配 ✗，仅失败态）
  danger: '#FF5C5C',
  // ok：机制在位 / 缓存命中（徽标命中态 / 消融右轨 / 双栏绿框）（确认绿）
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

  // ── 本集概念色（planning §三；series.json accents 登记 [#A78BFA, #5CA8FF]，
  //    2026-10-31 文案轮定稿值）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1–ep9 逐像素同值即「描边色/线宽承锁定值全片不变」的落地；本集环上
  //    高亮「调用模型前」的组装时点）
  core: '#D97757',
  // mech：本集主题色一 = 分段紫罗兰——身份/工具/工作目录/记忆四块分段卡、
  //    P4 七段卡阵列（「按主题维护的分段模块」；对 bg 6.0:1）。撞色自证（⑨ QA
  //    勘误后的实测口径）：与系列已用紫族最近邻 ep9 mech #8B7EC8 的色相距实测
  //    ΔH≈4.6°（HLS）/ Δhab≈3.3°（CIE）——色相单独不足以区分，主判据 = 亮度 +
  //    饱和度阶差（本值明显更浅更亮的薰衣草紫 vs ep9 更深更灰紫，肉眼阶差可辨）
  //    与 series.json accents 正登值（撞值门按值精确比对）；片头授色站
  //    （theme.mech）同源本值。
  mech: '#A78BFA',
  // sky：本集主题色二 = 装配天蓝——状态清单卡、拼装流向、缓存命中/失效状态色
  //    （「按真实状态组装」的判据侧；对 bg 6.4:1）。撞色自证（⑨ QA 勘误后的
  //    实测口径）：色相 ≈217°，系列已用蓝族最近邻 ep9 index #5FA8E0≈206°——
  //    Lab 色相距 ≈11° 为主判据之一；亮度实测本值 +1.3L* **更浅**（非更深），
  //    区分靠色相距 + 更高饱和度（更鲜的天蓝 vs 更灰的浅湖蓝）；accents 正登值
  //    不撞值，按集独立语义（ep9 index 为上集专属）。
  sky: '#5CA8FF',
  // tool：消息条/状态变化流伴色（青碧承 ep1–ep9 同语义——闲聊消息条/工况角标）
  tool: '#64C4C0',
} as const;
