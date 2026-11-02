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
  // danger：回传全史灌满 / 删盘反例 / 到点红线（恒配 ✗，仅失败态）
  danger: '#FF5C5C',
  // ok：消融在位侧 / 拦截成功 / 结论落账（确认绿）
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

  // ── 本集概念色（planning §三；series.json accents 登记 [#9B8AFB, #4EA8DE]，
  //    2026-10-31 文案轮定稿去撞色微调后值）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1–ep5 逐像素同值即「描边色/线宽承锁定值全片不变」的落地）
  core: '#D97757',
  // mech：本集主题色一 = 子代理隔离舱 / 新会议室（隔离紫）——全新消息列表、
  //    内部消息条、「用完清空」的归零语义（对 bg 6.7:1；「本集之物」授色，
  //    series-intro 孪生件的授色站直读本值）。色相自证：≈246°，与系列已用
  //    紫族（ep4 挂点 #8B7CF6≈247°）同域但亮度阶差可辨，且该集挂点为细线
  //    辅件非主装置；与 ep5 提醒紫 #B48CF2≈262° 差 ≥16°（更冷更蓝）。
  mech: '#9B8AFB',
  // steel：本集主题色二 = 主对话主线 / 结论回流通道（钢蓝）——单向通道、
  //    主会场消息条、「只多两条」落账（对 bg 7.2:1；色相 ≈202°，与 ep3 边界
  //    蓝 #4E9EFF≈213° / ep4 回调蓝 #58A6FF≈212° 差 ≥10°，明显更青更暗，
  //    非同槽）
  steel: '#4EA8DE',
  // tool：执行面/结果回喂流（青碧承 ep1–ep5 同语义——系列恒定环体伴色）
  tool: '#64C4C0',
} as const;
