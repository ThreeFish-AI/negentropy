/** 全片视觉规范（见 script/planning.md 与 storyboard.md）
 *
 *  本集三色语义契约 + 系列底座。系列文法：陶土橙 core = 不变的循环内核；石青 mech
 *  = 机制（看板 / 信箱 / 握手 / 目录隔离的机械）；警示红 deny = 被挡的任务 / 拒绝
 *  关机 / 脏桌拒删。本集**己色** = 赭金 peer ——「同类」：与 core 相距约 23° 的同
 *  家族另一成员。领队环恒 #D97757；队友环一律 #D9B36B——**N 个队友绝不 N 色**
 *  （反枚举最难考验）：靠铭牌与位置区分，绝不靠色相。
 *
 *  对比度（对 bg #0E1116，qa_frames.py --check-theme 复验）：
 *    core 6.06:1 · peer ~9.6:1 · mech 9.18:1 · deny 6.00:1 —— 均须过 4.5:1。
 */
export const theme = {
  bg: '#0E1116',
  panel: '#171C26',
  panelBorder: '#2A3242',
  text: '#F2F5FA',
  dim: '#9AA7B8',
  /** 陶土橙 = 循环内核（领队；全片恒定） */
  core: '#D97757',
  coreDeep: '#5a2f1f',
  /** 赭金 = 本集己色：同类（队友环 / 队友工位）——同家族的另一个成员 */
  peer: '#D9B36B',
  peerDeep: '#5c471f',
  /** 石青 = 机制（看板 / 信箱 / 握手轨 / 目录抽屉） */
  mech: '#64C4C0',
  mechDeep: '#1d4a48',
  /** 警示红 = 被挡 / 拒绝关机 / 脏桌拒删 */
  deny: '#EF6461',
  denyDeep: '#5c2422',
  ok: '#7ED321',
  serif: "'Songti SC', 'STSong', 'Noto Serif SC', serif",
  sans: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', sans-serif",
  mono: "'SF Mono', 'Menlo', 'JetBrains Mono', monospace",
} as const;
