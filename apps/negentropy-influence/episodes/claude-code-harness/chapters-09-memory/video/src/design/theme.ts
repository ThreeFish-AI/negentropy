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
  // danger：对话清零淡扫 / 全量反例（额度撑满、缓存作废）/ 消融拆解侧 /
  // 归零碎裂 / 临时话拦下（恒配 ✗，仅失败态）
  danger: '#FF5C5C',
  // ok：机制在位 / 拦截弹回 / 校验放行 / 复原落定（确认绿）
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

  // ── 本集概念色（planning §三；series.json accents 登记 [#8B7EC8, #5FA8E0]，
  //    2026-10-31 文案轮定稿值）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1–ep8 逐像素同值即「描边色/线宽承锁定值全片不变」的落地）
  core: '#D97757',
  // mech：本集主题色 A = 记忆紫——记忆库体 / 记忆文件卡 / 四类型卡 / 五道写入门
  //    / 快照装置（「长期记忆」的直觉色相；对 bg 5.3:1）。色相自证：≈251°，
  //    系列已用紫族最近邻 ep8 archive #7C6BE8≈247°，差约 4°、亮度阶差可辨
  //    （本值更浅更灰），且为 series.json accents 正登值（撞值门按值精确比对）。
  mech: '#8B7EC8',
  // index：本集主题色 B = 索引蓝——索引页 / 选择清单 / 固定前缀段 / 按需召回
  //    链路（「目录常驻」的一侧；对 bg 7.4:1）。色相 ≈206°，系列已用蓝族最近邻
  //    ep3 边界蓝 #4E9EFF≈212°，差约 6°、亮度阶差可辨（本值更柔更浅），accents
  //    正登值不撞值；ep8 mech #4E9FFF 为上集专属、按集独立语义。
  index: '#5FA8E0',
  // tool：执行面伴色（青碧承 ep1–ep8 同语义——系列恒定环体伴色/工况角标）
  tool: '#64C4C0',
} as const;
