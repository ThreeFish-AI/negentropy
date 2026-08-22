/** 全片视觉规范（见 script/planning.md 与 storyboard.md）
 *
 *  本集三色语义契约 + 系列底座。系列文法：陶土橙 core = 不变的循环内核——本集的
 *  题眼：环**一秒都不停**，工作块沿环外轨道走。石青 mech = 把活挪出循环的机制；
 *  警示红 deny = 卡住 / 看门狗 / 上限。本集**己色** = 霜蓝 later ——「不发生在这一
 *  轮里的事」：后台工作块、通知队列、调度秒摆、被推迟的卡。
 *
 *  两章不给两色：「谁按的开始」用**三段位置**编码（人在环上 / 人在环外 / 没有人），
 *  不用色相。
 *
 *  对比度（对 bg #0E1116，qa_frames.py --check-theme 复验）：
 *    core 6.06:1 · later ~8.4:1 · mech 9.18:1 · deny 6.00:1 —— 均须过 4.5:1。
 */
export const theme = {
  bg: '#0E1116',
  panel: '#171C26',
  panelBorder: '#2A3242',
  text: '#F2F5FA',
  dim: '#9AA7B8',
  /** 陶土橙 = 循环内核（本集一秒不停——「按下的不一定是它」的对照锚） */
  core: '#D97757',
  coreDeep: '#5a2f1f',
  /** 霜蓝 = 本集己色：不发生在这一轮里的事（后台块 / 队列 / 秒摆 / 被推迟的卡） */
  later: '#7FB2E0',
  laterDeep: '#1e3a56',
  /** 石青 = 把活挪出循环的机制（丢后台 / 接回 / 定时表） */
  mech: '#64C4C0',
  mechDeep: '#1d4a48',
  /** 警示红 = 卡住 / 看门狗咬住 / 上限与退休 */
  deny: '#EF6461',
  denyDeep: '#5c2422',
  ok: '#7ED321',
  serif: "'Songti SC', 'STSong', 'Noto Serif SC', serif",
  sans: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', sans-serif",
  mono: "'SF Mono', 'Menlo', 'JetBrains Mono', monospace",
} as const;
