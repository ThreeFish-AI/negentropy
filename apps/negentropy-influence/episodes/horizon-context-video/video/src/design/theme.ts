/**
 * 本集视觉契约：《AI 为什么答不对你公司的数据》（Horizon Context 上篇）。
 *
 * 底座常量四集通用、不要改；概念色映射本集三条主轴（见 script/planning.md §三）：
 *   - manual 琥珀金：受治理的「公司手册」——semantic view 定义、金标准、验证问答
 *   - engine  青碧：引擎与计算纪律——查询时重算、聚合安全、门禁在引擎里执行
 *   - dig     淡紫：从使用痕迹里「长出来的理解」——隐式挖掘、冲突、自纠环
 * 对 bg (#0E1116) 对比度 ≥ 4.5:1（qa_frames.py --check-theme 实测门）。
 */
export const theme = {
  // ── 底座（跨集通用，勿改）──
  bg: '#0E1116',
  panel: '#171C26',
  panelBorder: '#2A3242',
  text: '#F2F5FA',
  dim: '#9AA7B8',
  danger: '#FF5C5C',
  ok: '#7ED321',

  // ── 字体族（跨集通用，勿改）──
  serif: "'Songti SC', 'STSong', 'Noto Serif SC', serif",
  sans: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', sans-serif",
  mono: "'SF Mono', 'Menlo', 'JetBrains Mono', monospace",

  // ── 本集概念色 ──
  manual: '#E8C06A',   // 琥珀金 · 治理手册 / 金标准
  manualDeep: '#8A6A2E',
  engine: '#5CBFB0',   // 青碧 · 引擎 / 计算纪律 / 门禁
  dig: '#C9A0FF',      // 淡紫 · 隐式挖掘 / 自纠
} as const;
