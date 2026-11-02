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
  // danger：漂移反例/吸收窗口/轮数耗尽（恒配 ✗，仅失败态）
  danger: '#FF5C5C',
  // ok：机制在位/任务收尾（确认绿）
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

  // ── 本集概念色（planning §三；series.json accents 登记 [#6E9BFF, #B48CF2]，
  //    2026-10-31 文案轮定稿去撞色微调后值）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1/ep2/ep3/ep4 逐像素同值即「描边色/线宽承锁定值全片不变」的落地）
  core: '#D97757',
  // mech：本集之物 = 待办清单（规划蓝）——todo 清单卡、三态行、「摆在眼前的
  //    计划」常驻可见语义（对 bg 6.0:1；「本集之物」授色，series-intro 孪生件
  //    的授色站直读本值）。色相自证：≈221°，与系列已用蓝 #4E9EFF≈213°（ep3
  //    边界蓝）/ #58A6FF≈212°（ep4 回调蓝）均差 ≥8°、亮度阶差可辨，非同槽。
  mech: '#6E9BFF',
  // nag：提醒注入/外力顶回（提醒紫）——计数器刻度、数到 3 的注入瞬间、顶回
  //    动作、环上「调用前」挂点（注入时点=挂点，挂点色与计数器同源）
  //    （对 bg 5.6:1；色相 ≈262°，与 ep3 裁决紫 #7C6FF0≈249°/ep4 挂点紫
  //    #8B7CF6≈247° 差 ≥13°，更冷更蓝的紫、非同槽）
  nag: '#B48CF2',
  // tool：执行面/结果回喂流（青碧承 ep1–ep4 同语义——系列恒定环体伴色）
  tool: '#64C4C0',
  // warn 槽位不设：漂移/耗尽/越界等反例统一走底座 danger（承 ep3 G1 定色
  //    先例）；机制在位/三勾全亮/收尾走底座 ok。
} as const;
