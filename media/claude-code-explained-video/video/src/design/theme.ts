/** 全片视觉规范（见 script/planning.md 与 storyboard.md）
 *
 *  本集三色语义契约。反枚举原则：四个章节**不给四色**——四章讲的不是四个并列
 *  概念，而是「一个不变的内核 + 三层可拆卸的外挂」，色彩映射的是这个深层轴：
 *
 *    陶土橙 core   = 循环内核（s01）。全片**恒定不变**，是「循环始终不变」这个
 *                    主题的视觉载体：每次画面上出现循环，它都是这个颜色、这个粗细。
 *    石青   mech   = 挂在内核外面的机制（s02 分发表 / s04 钩子插槽）。可增可减、
 *                    可插拔，视觉上永远「附着」在 core 之外。
 *    警示红 deny   = 拒绝与危险（s03 闸门的硬拒绝、DENY_LIST、rm -rf /）。
 *                    语义唯一，不做装饰用途——出现即代表「这条路被挡住了」。
 *
 *  s03 的三种权限结果不各占一色：allow 走 core（放行 = 回到主干）、
 *  ask 走 mech（需要一次外部介入）、deny 走 danger。
 *
 *  对比度（对 bg #0E1116，WCAG 2.x 相对亮度法，qa_frames.py --check-theme 复验）：
 *    core 6.06:1 · mech 9.18:1 · deny 6.00:1 —— 均过 4.5:1。
 */
export const theme = {
  bg: '#0E1116',
  panel: '#171C26',
  panelBorder: '#2A3242',
  text: '#F2F5FA',
  dim: '#9AA7B8',
  /** 陶土橙 = 循环内核（全片恒定，「循环不变」的视觉锚） */
  core: '#D97757',
  coreDeep: '#5a2f1f',
  /** 石青 = 外挂机制（分发表 / 钩子插槽，可插拔） */
  mech: '#64C4C0',
  mechDeep: '#1d4a48',
  /** 警示红 = 拒绝与危险（语义唯一，不作装饰） */
  deny: '#EF6461',
  denyDeep: '#5c2422',
  ok: '#7ED321',
  serif: "'Songti SC', 'STSong', 'Noto Serif SC', serif",
  sans: "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', sans-serif",
  mono: "'SF Mono', 'Menlo', 'JetBrains Mono', monospace",
} as const;
