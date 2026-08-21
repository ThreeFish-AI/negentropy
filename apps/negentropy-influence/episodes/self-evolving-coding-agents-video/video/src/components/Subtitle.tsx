import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {fitText} from '@remotion/layout-utils';
import {theme} from '../design/theme';
import type {TimedSentence} from '../types';

const MAX_WIDTH = 1600;
const PADDING_X = 36;
/** Remotion 默认样式表为 box-sizing: border-box，内容预算须减去左右 padding */
const CONTENT_WIDTH = MAX_WIDTH - PADDING_X * 2;
const MAX_FONT_SIZE = 44;
const MIN_FONT_SIZE = 30;

/** 全片底部字幕条：一句一条，与配音逐句同步（storyboard.md 字幕规范）。
 *  字号用 @remotion/layout-utils 的 fitText 真实测量（替代此前手写的全角 1.0/半角
 *  0.55 宽度估算与魔法阈值）。validateFontIsLoaded 保持 4.x 默认 false——系统字体
 *  栈无 loadFont() promise 可等；⚠️ Remotion 5.0 起该开关默认翻 true，届时若仍未
 *  内嵌字体会开始抛错（重启触发器见 pipeline/README 字体约束节）。 */
export const Subtitle: React.FC<{timed: TimedSentence[]}> = ({timed}) => {
  const frame = useCurrentFrame();
  const current = timed.find((s) => frame >= s.from && frame < s.from + s.durationInFrames);
  if (!current) {
    return null;
  }
  const local = frame - current.from;
  const opacity = interpolate(local, [0, 4], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const fitted = fitText({
    text: current.text,
    withinWidth: CONTENT_WIDTH,
    fontFamily: theme.sans,
    fontWeight: 500, // 须与下方 div 的 fontWeight 一致，否则测量偏小
  }).fontSize;
  const fontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, fitted));
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'none'}}>
      <div
        style={{
          marginBottom: 54,
          maxWidth: MAX_WIDTH,
          padding: `12px ${PADDING_X}px`,
          borderRadius: 12,
          background: 'rgba(6, 8, 12, 0.68)',
          color: theme.text,
          fontFamily: theme.sans,
          fontSize,
          fontWeight: 500,
          lineHeight: 1.35,
          whiteSpace: 'nowrap',
          opacity,
        }}
      >
        {current.text}
      </div>
    </AbsoluteFill>
  );
};
