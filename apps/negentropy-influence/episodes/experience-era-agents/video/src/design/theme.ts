/** 全片视觉规范（见 script/planning.md 与 storyboard.md）
 *  本集三色语义契约：
 *  金 = 经验流（trace → 可用经验 z，全片主色）
 *  青 = Harness 运行时（快时标外部更新面）
 *  紫 = 参数内化（慢时标权重巩固） */
export const theme = {
  bg: '#0E1116',
  panel: '#171C26',
  panelBorder: '#2A3242',
  text: '#F2F5FA',
  dim: '#9AA7B8',
  /** 金 = 经验流（trace→z，全片主线） */
  exp: '#F5C542',
  expDeep: '#5c4a1a',
  /** 青 = Harness 运行时（快时标外部更新） */
  harness: '#2DD4BF',
  harnessDeep: '#134a44',
  /** 紫 = 参数内化（慢时标巩固进模型权重） */
  params: '#B78CFF',
  paramsDeep: '#3d2a5c',
  danger: '#FF5C5C',
  ok: '#7ED321',
  serif: "'Songti SC', 'STSong', 'Noto Serif SC', serif",
  sans: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', sans-serif",
  mono: "'SF Mono', 'Menlo', 'JetBrains Mono', monospace",
} as const;
