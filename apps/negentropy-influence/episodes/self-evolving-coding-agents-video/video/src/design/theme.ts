/** 全片视觉规范（见 script/planning.md 与 storyboard.md）
 *  本集双色语义契约：
 *  终端绿 = 可执行证据（测试/编译器反馈、SWE-bench 执行验证、可信进化守门——全片主色）
 *  洋红 = 进化动作（自我修改/变异，五对象被"改"时的辉光与箭头）
 *  注意：本集将底座确认绿 ok 覆写为终端绿 #4ADE80（测试通过=证据成立，语义合一；
 *  避免与 #7ED321 双绿打架）。覆写决策记录于 theme.ts / planning.md / README 三处。 */
export const theme = {
  bg: '#0E1116',
  panel: '#171C26',
  panelBorder: '#2A3242',
  text: '#F2F5FA',
  dim: '#9AA7B8',
  /** 终端绿 = 可执行证据（全片主线） */
  code: '#4ADE80',
  codeDeep: '#173B26',
  /** 洋红 = 进化动作（自我修改/变异） */
  evo: '#FF6EC7',
  evoDeep: '#4A1B38',
  danger: '#FF5C5C',
  /** 本集覆写：确认绿与证据主色合一（测试通过=证据成立） */
  ok: '#4ADE80',
  serif: "'Songti SC', 'STSong', 'Noto Serif SC', serif",
  sans: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', sans-serif",
  mono: "'SF Mono', 'Menlo', 'JetBrains Mono', monospace",
} as const;
