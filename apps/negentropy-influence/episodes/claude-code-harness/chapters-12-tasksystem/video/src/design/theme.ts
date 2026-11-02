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
  // danger：关卡拦截／翻车／幽灵态（左红挡 / 编号闪错 / 幽灵签名描边 / 悬空断头）（恒配 ✗，仅失败态）
  danger: '#FF5C5C',
  // ok：完成翻绿／关卡放行／机制在位（完成态 / 绿灯 / 校验绿点 / 基线闸门）（确认绿）
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

  // ── 本集概念色（planning §三；series.json accents 登记 [#9B8CFF, #58B7FF]，
  //    2026-10-31 文案轮定稿值）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1–ep11 逐像素同值即「描边色/线宽承锁定值全片不变」的落地；本集环侧
  //    亮「工具池」挂面——3→8 加挂，机制逐层加挂、循环不变）
  core: '#D97757',
  // mech：本集主题色一 = 任务卡紫——任务墙墙体／六字段卡／认领签名态
  //    （「板上待领的活」；对 bg 6.9:1）。撞色自证：色相 ≈248°，系列已用
  //    紫族最近邻 ep10 mech #A78BFA≈262°（差 14°）、ep11 backoff #B48EF5≈275°
  //    ——本值更偏蓝紫、亮度更亮，accents 正登值不撞值、按集独立语义；
  //    片头授色站（series-intro theme.mech）同源本值（ep12 授紫）。
  mech: '#9B8CFF',
  // unlock：本集主题色二 = 解锁蓝——blockedBy 依赖连线／完成→解锁的播报
  //    信号流（「依赖凑齐、下游放行」；对 bg 7.9:1）。撞色自证：色相 ≈206°，
  //    系列已用蓝族最近邻 ep10 sky #5CA8FF≈217°（差 11°）、ep11 mech
  //    #6C8CFF≈226°（差 20°）——本值是天蓝偏青的一档、与青碧 tool #64C4C0
  //    ≈178° 拉开蓝相/青绿相（planning §三明文），accents 正登值不撞值。
  unlock: '#58B7FF',
  // tool：工况伴色（青碧承 ep1–ep11 同语义——工况角标 / 既有工具卡 / 会话窗）
  tool: '#64C4C0',
} as const;
