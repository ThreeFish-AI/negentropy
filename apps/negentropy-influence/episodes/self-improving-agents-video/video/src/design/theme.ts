/** 全片视觉规范（见 script/planning.md 与 storyboard.md） */
export const theme = {
  bg: '#0E1116',
  panel: '#171C26',
  panelBorder: '#2A3242',
  text: '#F2F5FA',
  dim: '#9AA7B8',
  /** 蓝 = 改大脑（θ 通路） */
  brain: '#4A9EFF',
  brainDeep: '#1a3a5c',
  /** 橙 = 改装备（Σ 通路） */
  gear: '#FF9F45',
  gearDeep: '#5c3a1a',
  danger: '#FF5C5C',
  ok: '#7ED321',
  serif: "'Songti SC', 'STSong', 'Noto Serif SC', serif",
  sans: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', sans-serif",
  mono: "'SF Mono', 'Menlo', 'JetBrains Mono', monospace",
} as const;
