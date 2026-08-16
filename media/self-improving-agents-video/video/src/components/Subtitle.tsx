import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import type {TimedSentence} from '../types';

const CJK = /[⺀-鿿豈-﫿]/;

/** 全片底部字幕条：一句一条，与配音逐句同步（storyboard.md 字幕规范） */
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
  // 长句防御性收缩：估算宽度超限时缩小字号，保证单行不溢出（全角≈1 字宽，半角≈0.55）
  const estWidth =
    current.text.split('').reduce((w, ch) => w + (CJK.test(ch) ? 1 : 0.55), 0) * 44;
  const fontSize = estWidth > 1560 ? Math.max(30, 44 - (estWidth - 1560) / 25) : 44;
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'none'}}>
      <div
        style={{
          marginBottom: 54,
          maxWidth: 1600,
          padding: '12px 36px',
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
