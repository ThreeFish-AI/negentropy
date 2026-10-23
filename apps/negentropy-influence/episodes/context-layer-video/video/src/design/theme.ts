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

  // ── 本集概念色（MRO 机务剧场三色：钢蓝=受治理供给主轴 / 工业橙=治理与失效警示 / 校准绿=验证与放行）──
  // 与 E1（#E8C06A/#5CBFB0/#C9A0FF）、E3（#FF6F91/#3DDC97/#8C9EFF）零撞车；对 #0E1116 对比度均 ≥4.5:1（QA 期 --check-theme 复测）。
  concept: '#5B8DC9',      // 钢蓝：工卡/装配/五源主结构
  conceptDeep: '#F5A623',  // 工业橙：会签/失效/越权警示
  // （deny 已删：与 ok 同值的纯别名、全仓 0 引用——「验证通过」语义统一走 ok）

  // ── 本集物料面色（纸面工卡/底稿与终端黑；收口既往散写值，数值不变）──
  paper: '#F2F5FA',       // 纸面（工卡纸/带版次底稿）——与 text 同值、语义槽独立
  paperInk: '#171C26',    // 纸面主墨（纸上正文）——与 panel 同值
  paperInkDim: '#5a6472', // 纸面次墨（纸上注释/小字）
  terminalBg: '#0B0E14',  // 终端黑（代码走廊/技术请示单内嵌终端底）

  // ── 五源流光（1-A「一扇窗」涌入条；品红替换 E1 概念紫 #C9A0FF——玫红系与 E3 #FF6F91
  //    色相仅差 6° 亦弃，取 ~300° 全系列空槽）──
  sourceFlows: ['#5B8DC9', '#F5A623', '#7ED321', '#D65DB1', '#FF9F6B'],
} as const;

/** hex alpha 派生：withAlpha(theme.ok, 0.08) → '#7ED32114'（a∈[0,1]，替代散写 rgba 手抄）。 */
export const withAlpha = (hex: string, a: number): string =>
  hex + Math.round(a * 255).toString(16).padStart(2, '0');
