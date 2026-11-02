/**
 * 本集视觉契约（⑧ 轮定稿，storyboard 前言「本集视觉契约」= planning §三）。
 *
 * 底座常量跨集通用、不要改；概念色规则见 references/08-remotion-implementation.md：
 *   - 概念色映射「深度轴」而非枚举条目；对 bg (#0E1116) 对比度 ≥ 4.5:1
 *   - 色相不与系列已用色撞值（check_series.py occupied-hex INFO 行为准）
 *   - 覆写任何底座 token 须在 theme.ts / planning.md / README 三处留决策记录
 *
 * 本集终章双主题色（series.json ep20 accents 登记同值 [#9074EE, #5B8DEF]，
 * 2026-10-31 文案轮定稿——合流紫 255° / 恒定蓝 220° 两空段中点值，与系列
 * 已用四色（陶土橙 ≈20°、青碧 ≈176°、琥珀 ≈40°、珊瑚红 ≈2°）色相全错开）。
 */
export const theme = {
  // ── 底座（跨集通用，勿改）──
  bg: '#0E1116',
  panel: '#171C26',
  panelBorder: '#2A3242',
  text: '#F2F5FA',
  dim: '#9AA7B8',
  // danger：警示红——权限弹开帧 / E5 左轨 / 测试失败行（拦截·报错·失败行恒红）
  danger: '#FF5C5C',
  // ok：确认绿——放行 / 恢复 / 自检全绿 / E5 右轨（放行·恢复·全绿恒绿）
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

  // ── 本集概念色（planning §三；storyboard 前言登记）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1–ep19 逐像素同值即「描边色/线宽承系列锁定值全片不变」的落地）。
  //    本集双态画法共用此线：远景=环体细线四拍、近景=走廊中线（同一主体
  //    两种分辨率，走廊与环体并用不替换——全片同形约束）。
  core: '#D97757',
  // loop：本集主题色① = 循环恒定蓝（对 bg ≈5.0:1）——循环不变性的常驻标色：
  //    走廊墙体描边、收尾轨、四句收束块（while True 卡）、单岔口判据高亮、
  //    后台轨。撞色自证：色相 220°（Stage ① 提案原值——兄弟集蓝簇 216°/225°
  //    两簇间空段中点，装置域不重叠）
  loop: '#5B8DEF',
  // merge：本集主题色② = 终章合流紫（对 bg ≈5.3:1）——汇入的机制设施格、
  //    挂点槽、挂点图例、归位动画、终幕设施层（「多机制汇聚一环」的合流
  //    高亮与收束语义）。撞色自证：色相 255°（提案 #8B7CF6 深化——避开四
  //    兄弟集逐字沿用的浅紫 247° 明度带，落浅紫族与兰紫族之间空段中点）
  merge: '#9074EE',
  // exec：执行面/结果回流 青碧（承 ep1/ep2 同语义）——3-C 测试日志回流带、
  //    回填流（G1 核注：4-A 对照卡/4-B 两扇门走中性描边不占此色）
  exec: '#64C4C0',
  // mech：本集之物色位 = 走廊/环体（循环恒定蓝同值——本集主题物即循环本体
  //    的可行走形态；片头授色站 series-intro theme.mech 读本键 = 第五组图层
  //    以恒定蓝授色，与 loop 单一事实源同值）
  mech: '#5B8DEF',
} as const;
