/**
 * 本集视觉契约（seed —— scaffold 复制后**必须**按本集重写概念色）。
 *
 * 底座常量四集通用、不要改；概念色是每集独立设计的产物，规则见
 * references/08-remotion-implementation.md：
 *   - 2–3 个概念色，映射「深度轴」而非枚举条目
 *   - 对 bg (#0E1116) 对比度 ≥ 4.5:1（用 `qa_frames.py --check-theme` 实测）
 *   - 色相不得与已用色撞车（各集 theme.ts 实占色值见 `check_series.py`
 *     运行时打印的 occupied-hex INFO 行）
 *   - 覆写任何底座 token 须在 theme.ts / planning.md / README 三处留决策记录
 */
export const theme = {
  // ── 底座（跨集通用，勿改）──
  bg: '#0E1116',
  panel: '#171C26',
  panelBorder: '#2A3242',
  text: '#F2F5FA',
  dim: '#9AA7B8',
  // danger 曾缺席本 seed（既有四集 theme.ts 全都有、场景代码读 theme.danger，
  // scaffold 出的新集开箱即 TS2339）——补齐即与四集现状对齐。
  danger: '#FF5C5C',
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

  // ── 本集概念色（⑧ 轮定稿，storyboard「本集视觉契约」= planning §三）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1/ep2/ep3 逐像素同值即「描边色/线宽承锁定值全片不变」的落地）
  core: '#D97757',
  // mech：本集之物 = HOOKS 注册表（挂点紫）——事件挂点/注册表/挂钩/保险徽记
  //    的装置结构色（对 bg 5.2:1；「本集之物」授色，series-intro 孪生件直读）
  mech: '#8B7CF6',
  // hook：回调蓝 = 回调/触发信号流（回调卡、触发线、注入消息条、续跑指令；
  //    对 bg 7.3:1）。命名承本集机制词（hooks），非通用 hook 语义。
  hook: '#58A6FF',
  // tool：执行面/结果回喂流（青碧承 ep1/ep2/ep3 同语义——系列恒定环体伴色）
  tool: '#64C4C0',
  // warn 槽位不设：消融反例/越界/拔钩退化/裂纹等反例动作统一走底座 danger
  //    #FF5C5C（承 ep3 G1 定色先例——警示红即底座常量，不再造同族第二红）；
  //    检查点全过/放行等确认态走底座 ok #7ED321。
  // series.json accents = [#8B7CF6, #58A6FF]（mech + hook；check_series 规则 4
  // 执法），core/tool 为系列恒定色不占本集 accents 槽。
  //
  // ── 跨集签名色只读登记（G1 对抗核验 2026-11-01；色值跨集回溯、语义不歧义，
  //    常量落 motifs.tsx 模块内、不进本表——同 3D 面色常量先例，自证与全系列
  //    已用色的色相距离：#7C6FF0 为 ep3 实占裁决紫原值（同语义回溯非撞色）、
  //    #4E9EFF 为 ep2 实占边界蓝原值）──
  // 裁决紫 #7C6FF0 = ep3 闸卡签名：1-C 降格迁移动画的同形签名本体（跨集视觉
  //    记忆）、0-A 剪影一闪、5-A 闸卡小影同签回归；
  // 边界蓝 #4E9EFF = ep2 工作区范围框签名：3-B 越界冲出的框界在画。
} as const;
