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
  // danger：出错／消融反例（报错帧 / 一刀切单行道 / 撞墙帧 / 判停签）（恒配 ✗，仅失败态）
  danger: '#FF5C5C',
  // ok：恢复成功／对照组（第四次放行 / 0.0s 恢复钟 / 画廊全绿 / ok=True 结局签）（确认绿）
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

  // ── 本集概念色（planning §三；series.json accents 登记 [#6C8CFF, #B48EF5]，
  //    2026-10-31 文案轮定稿值）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1–ep10 逐像素同值即「描边色/线宽承锁定值全片不变」的落地；本集环上
  //    高亮「调用模型」段——正是被保护壳包住的那一步，报错压黑／恢复回橙的
  //    契约色事件由场景层 opacity/状态色承载，不改本值）
  core: '#D97757',
  // mech：本集主题色一 = 恢复蓝——分类恢复／三路径分发（分类表描边、保护壳、
  //    切换帧、判定全表网格；对 bg 6.5:1）。撞色自证：色相 ≈226°，系列已用
  //    蓝族最近邻 ep10 sky #5CA8FF≈217°——Lab 色相距 ≈9°，亮度本值更暗更沉
  //    （恢复蓝 vs 更浅的天蓝），accents 正登值不撞值、按集独立语义（ep10
  //    sky 为上集专属槽）；片头授色站（series-intro theme.mech）同源本值。
  mech: '#6C8CFF',
  // backoff：本集主题色二 = 退避紫——等待曲线／时间维（指数退避阶梯、32s 封顶
  //    虚线、抖动细齿、Retry-After 旗标、虚拟时钟、175.6s 白等烧尽条、时间
  //    沙漏；对 bg 6.8:1）。撞色自证：色相 ≈275°，系列已用紫族最近邻 ep10
  //    mech #A78BFA≈262°——色相距 ≈13° 且本值更暗（深紫罗兰 vs 浅薰衣草），
  //    肉眼阶差可辨；accents 正登值不撞值。
  backoff: '#B48EF5',
  // tool：工况伴色（青碧承 ep1–ep10 同语义——请求帧/消息条/工况角标）
  tool: '#64C4C0',
} as const;
