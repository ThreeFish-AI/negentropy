import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {clamp01, progress} from '../motion';

/** recap 让位包装（P1/P2/P6/P7/P8 共用单一实现）：包装窗内图回放压到 `to`
 *  （默认 0.16，WP2a 抽帧证实的暗底档），窗外满亮——链内首句满亮、自第二条
 *  hold cue 起整框压暗，hold 重播由压暗一并掩掉。纯 effects 通道（铁律③）：
 *  句界 10 帧缓变、禁弹簧；cue 时序不受影响，仅显示层让位。z 序契约：wrapper
 *  包住 ArchifyRecap，装置 JSX 写在其后（装置落在画框区域内也可读，画框即装置暗底）。
 *  `recover`（默认 true）＝窗末前 12 帧缓回满亮（P6/P7/P8 形态）；false＝窗内保持
 *  暗底至窗口结束（P1/P2 形态：装置承担主叙事、不回亮）。 */
export const RecapDim: React.FC<{from: number; dur: number; to?: number; recover?: boolean; children: React.ReactNode}> = ({
  from,
  dur,
  to = 0.16,
  recover = true,
  children,
}) => {
  const frame = useCurrentFrame();
  const cover = progress(frame, from, 10) * (recover ? 1 - progress(frame, from + dur - 12, 12) : 1);
  return <AbsoluteFill style={{opacity: 1 - (1 - to) * clamp01(cover)}}>{children}</AbsoluteFill>;
};
