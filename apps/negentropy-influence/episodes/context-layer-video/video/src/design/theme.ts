/**
 * 本集视觉契约：《自己动手，给 AI 搭一个上下文层》（Context Layer 下篇）。
 *
 * 底座常量四集通用、不要改；概念色映射本集三条主轴（见 script/planning.md §三）：
 *   - blueprint 工程蓝：蓝图与五正交层——对象 / 目录 / 富化 / 治理 / 激活的架构线
 *   - grown     苔绿：对象的「生长」——生命周期状态机（draft→governed）、eval 自纠
 *   - activate  暖橙：激活与接线——resolve 契约、四因子排序、MCP 标准插头
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
  blueprint: '#6FB1E8',  // 工程蓝 · 蓝图五层
  blueprintDeep: '#3D6E9E',
  grown: '#A3D977',      // 苔绿 · 生命周期 / 自纠
  activate: '#FF9F6B',   // 暖橙 · 激活 / MCP 插头
} as const;
