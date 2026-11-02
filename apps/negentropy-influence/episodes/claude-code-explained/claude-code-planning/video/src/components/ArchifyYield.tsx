/** 装置让位层：archify full 窗内淡出、窗外淡入（全屏切换的 b 模式）。
 *
 *  三分法里的默认档——装置有跨句连续状态（记忆柱攒满/扫描线相位/代码走廊
 *  阅读面）不能拆进嵌套子窗时，用 opacity 让位替代 unmount，状态帧驱动纯函数
 *  的性质使淡出淡入不重置装置进度。4-D②「画框不透明底直接遮」的平滑化。
 *
 *  契约：
 *  - 窗列表**与同镜 ArchifyRecap 的 cues 同步维护**（一条 cue 对一条窗），但必须是
 *    独立字面量（每条一行 `at('句id') - bX.from` / `dur('句id')` 表达式）——spread
 *    复用 cue 对象会让覆盖门 extract_cues 的计数断言碎裂（wrapper 数组无
 *    chapterId 不参与计数，spread 则把 chapterId 带进来）。漏一条只损失平滑
 *    （画框仍遮，退化为 c 模式），多一条让装置无谓隐身——review 时逐条对照。
 *  - 纯 effects 通道（铁律③）：只有 opacity，无位移无缩放 → progress 时长+缓动，
 *    不用弹簧、不加「让开感」位移（会与画框入场弹簧打架）。
 *  - z 序：wrapper 包住 Stage，ArchifyRecap 写在其后（4-D② 已立的纪律）。
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {DUR, progress} from '../motion';

export const ArchifyYield: React.FC<{
  /** 与同镜 ArchifyRecap cues 同源的（at, durationInFrames）窗列表 */
  cues: {at: number; durationInFrames: number}[];
  /** 交叉淡化帧数，默认 DUR.f3（5 帧） */
  fade?: number;
  children: React.ReactNode;
}> = ({cues, fade = DUR.f3, children}) => {
  const frame = useCurrentFrame();
  // 相邻窗先合并再取脉冲：句窗含句间 gap 严格相接，逐窗 max 在交界中点只有
  // 0.5（装置半透明闪现 ~5 帧）。窗内 cover=1（全让位）、窗外 cover=0（装置满可见）
  const wins = [...cues]
    .sort((a, b) => a.at - b.at)
    .reduce<{at: number; end: number}[]>((acc, c) => {
      const last = acc[acc.length - 1];
      const end = c.at + c.durationInFrames;
      if (last && last.end >= c.at) last.end = Math.max(last.end, end);
      else acc.push({at: c.at, end});
      return acc;
    }, []);
  const cover = Math.max(
    0,
    ...wins.map(({at, end}) => progress(frame, at, fade) * (1 - progress(frame, end, fade))),
  );
  return <AbsoluteFill style={{opacity: 1 - cover}}>{children}</AbsoluteFill>;
};
