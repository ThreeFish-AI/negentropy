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
  // danger：反例/退化路径（旁路强删的蒸发与连坐 / 路径签撞门红描边 /
  // 「自觉」小签划除 / 覆盖层的后写者红）——恒配左红轨与被挡形态
  danger: '#FF5C5C',
  // ok：机制在位/拦截成功（守卫拒绝报错条 / 完成灯 / 门③保留等审 /
  // 右轨三者俱在锁定 / 改动点的在位描边）
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

  // ── 本集概念色（planning §三；series.json ep18 accents 登记 [#C15AE8, #3FA4C4]，
  //    2026-10-31 文案轮定稿值）──
  // core：循环环体恒定锚〔M-001〕（陶土橙——LoopRing 描边色直读本值，与
  //    ep1–ep17 逐像素同值即「描边色/线宽承系列锁定值全片不变」的落地）。
  //    本集环侧「执行」段挂工作目录指针（WorkRing 外层包装，母题本体不动）：
  //    读写落在哪间房，由绑定说了算——1-A 旁挂亮出 → 1-C 指针摆向新房 →
  //    2-A 缩悬顶角 / 2-B 指针切向作业房 → P3 退场 → 4-A 深处暗层 → 5-A 回归。
  core: '#D97757',
  // line：本集主题色① = 分支线索/房号绑定 兰紫（对 bg ≈6.9:1）——wt/<name>
  //    分支线、房号绑定线、任务卡 worktree 字段值、房形轮廓（兰紫/钢青两
  //    主题色语义全片不互换：本键只走「同一账本挂出的独立空间」一侧）。
  //    撞色自证：色相 ≈284°（Stage ① 提案 #8B7CF6 右移——紫带 245–252° 五集
  //    扎堆已让开，ep17 mate 品红 291° 与本集同季不同集，装置域不重叠）
  line: '#C15AE8',
  // guard：本集主题色② = 施工面边界/围挡与守卫 钢青（对 bg ≈7.6:1）——
  //    .worktrees/ 目录围挡、名字门禁卡、默认拒绝守卫、路径穿越拦截框、
  //    拆房工具卡与清点计数器、任务卡钢青框、边界墙砖纹（「边界与护栏」
  //    的工程冷静感一侧）。撞色自证：色相 ≈194°（青碧 176° 与钢蓝 202°
  //    之间的空档，承 Stage ① 提案 #3E8ED0 左移定值）
  guard: '#3FA4C4',
  // mech：本集之物色位 = 账本/房（兰紫同值——scene 代码里以「本集主题物」
  //    语义引用处走本键，与 line 单一事实源；片头授色站 series-intro
  //    theme.mech 读本键 = 第五组图层以兰紫授色）
  mech: '#C15AE8',
} as const;
