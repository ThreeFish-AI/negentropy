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
  // danger：警示红——消融左轨（沿用旧池）/ Unknown tool 回执条（与 coral
  // 同族不同帧并用，同帧对比以描边/填充区分——storyboard 前言登记）
  danger: '#FF5C5C',
  // ok：机制在位/恢复/拦截/实测在案（「在案」戳 / 重建后结果回流 / 名单 allow 档）
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

  // ── 本集概念色（planning §三；series.json ep19 accents 登记同值
  //    [#A855F7, #3B82F6]，2026-10-31 文案轮定稿值）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1–ep18 逐像素同值即「描边色/线宽承系列锁定值全片不变」的落地）。
  //    本集环上高亮「调模型」段（全集唯一环上高亮段——每轮组装正发生在环上
  //    这一步）经 SegArc 同族橙加宽叠放（WorkRing 先例的外层包装形态）。
  core: '#D97757',
  // svc：本集主题色① = 外部服务/协议通道 兰紫（对 bg ≈5.2:1）——外部服务卡、
  //    清单卷轴报文、连接通道、前缀挂牌、传输通道族。撞色自证：色相 ≈271°
  //    （Stage ① 提案 #8B7CF6 加深提饱——同季兄弟集 ep18 兰紫 #C15AE8 色相
  //    284° 已让开，装置域不重叠）
  svc: '#A855F7',
  // pool：本集主题色② = 统一工具池/组装 深空蓝（对 bg ≈5.6:1）——内外工具
  //    同池（池内卡片同色同池、不分内外层色）、每轮重灌动画、对照表（左全名
  //    右原始名）、主程序块。撞色自证：色相 ≈217°（青碧 176° 与 ep18 钢青
  //    194° 之间的深空档，承 Stage ① 提案 #5CA8FF 加深定值）
  pool: '#3B82F6',
  // exec：执行面/结果回喂流 青碧（承 ep1/ep2 同语义）——执行流、回执回流
  exec: '#64C4C0',
  // coral：反例/越界 珊瑚红（承 ep1/ep2，与警示红同族不同帧并用）——裸名相撞
  //    反例帧、报错弹回帧、「>64 拒收」红牌
  coral: '#EF6461',
  // warn：琥珀黄——宿主名单 confirm 档（三绿一黄的黄；系列既有色值，planning
  //    §三色表在册）
  warn: '#EFB13C',
  // mech：本集之物色位 = 工具池（深空蓝同值——scene 代码里以「本集主题物」
  //    语义引用处走本键，与 pool 单一事实源；片头授色站 series-intro
  //    theme.mech 读本键 = 第五组图层以深空蓝授色）
  mech: '#3B82F6',
} as const;
