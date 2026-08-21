/** 全片视觉规范（见 script/planning.md 与 storyboard.md）
 *
 *  本集三色语义契约 + 系列底座。系列文法：陶土橙 core = 不变的循环内核；石青 mech
 *  = 机制；警示红 deny = 熔断与报错。本集**己色** = 苔绿 keep —— 「不许丢的那一层」
 *  （记忆文件、索引、登记簿）。
 *
 *  ★ 本集特有纪律：**丢失不用颜色画**。被压缩的内容向 dim/panel **褪色**——褪色即
 *  遗忘；两章（压缩 / 记忆）不给两色，它们是同一色块的**两种命运**：要么淡出视野，
 *  要么飞进 keep 登记簿。
 *
 *  对比度（对 bg #0E1116，qa_frames.py --check-theme 复验）：
 *    core 6.06:1 · keep ~7:1 · deny 6.00:1 —— 均须过 4.5:1。
 */
export const theme = {
  bg: '#0E1116',
  panel: '#171C26',
  panelBorder: '#2A3242',
  text: '#F2F5FA',
  dim: '#9AA7B8',
  /** 陶土橙 = 循环内核（全片恒定） */
  core: '#D97757',
  coreDeep: '#5a2f1f',
  /** 苔绿 = 本集己色：恒存层（记忆文件 / 索引 / 登记簿）——氧化后固定下来的铜绿 */
  keep: '#A9C46C',
  keepDeep: '#3d4a1f',
  /** 石青 = 机制（腾位梯 / 摘要者 / 旁路挑选） */
  mech: '#64C4C0',
  mechDeep: '#1d4a48',
  /** 警示红 = 熔断与报错（连败三次即停、窗口拒收） */
  deny: '#EF6461',
  denyDeep: '#5c2422',
  ok: '#7ED321',
  serif: "'Songti SC', 'STSong', 'Noto Serif SC', serif",
  sans: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', sans-serif",
  mono: "'SF Mono', 'Menlo', 'JetBrains Mono', monospace",
} as const;
