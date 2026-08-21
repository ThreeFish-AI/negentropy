/** 全片视觉规范（见 script/planning.md 与 storyboard.md）
 *
 *  本集三色语义契约 + 系列底座。系列文法：陶土橙 core = 不变的循环内核（每集终幕
 *  同色同宽出场）；石青 mech = 挂在内核外面的机制；警示红 deny = 阻断与失败。
 *  本集**己色** = 鸢紫 view —— 「被安排给模型看的视野」：计划卡、目录卡、拼装出的
 *  提示段、副桌桌面的内容，一律 view。五章不给五色（反枚举）：s05–s11 的内容统一
 *  是「视野」，用桌面上的**位置**区分，不用色相区分。
 *
 *  对比度（对 bg #0E1116，qa_frames.py --check-theme 复验）：
 *    core 6.06:1 · view ~6.5:1 · mech 9.18:1 · deny 6.00:1 —— 均须过 4.5:1。
 */
export const theme = {
  bg: '#0E1116',
  panel: '#171C26',
  panelBorder: '#2A3242',
  text: '#F2F5FA',
  dim: '#9AA7B8',
  /** 陶土橙 = 循环内核（全片恒定，「循环不变」的视觉锚；环在桌后） */
  core: '#D97757',
  coreDeep: '#5a2f1f',
  /** 鸢紫 = 本集己色：被安排给模型看的视野（计划 / 目录卡 / 提示段 / 副桌内容） */
  view: '#9C90EE',
  viewDeep: '#332e5e',
  /** 石青 = 挂在视野之外的机制（取手册的手、拼垫纸的机械） */
  mech: '#64C4C0',
  mechDeep: '#1d4a48',
  /** 警示红 = 阻断与失败（补救梯子的熔断、错过的信号） */
  deny: '#EF6461',
  denyDeep: '#5c2422',
  ok: '#7ED321',
  serif: "'Songti SC', 'STSong', 'Noto Serif SC', serif",
  sans: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', sans-serif",
  mono: "'SF Mono', 'Menlo', 'JetBrains Mono', monospace",
} as const;
