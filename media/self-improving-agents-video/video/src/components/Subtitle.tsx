import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import type {TimedSentence} from '../types';

const CJK = /[⺀-鿿豈-﫿]/;
/** 全角标点与 CJK 同宽（1em），不满足 CJK 区间，须并列判定；
 *  ASCII 引号 (U+0022/27) 字形实为半宽，不入此类、按 0.55 桶计 */
const FULLWIDTH_PUNCT = /[，。！？：；、“”‘’（）——…·《》「」]/;

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
  // 长句防御性收缩：估算宽度超限时缩小字号，保证单行不溢出（全角≈1 字宽，半角≈0.55）。
  // 内容预算 = maxWidth 1600 − 左右 padding 72 = 1528，估算含 ~2% 字距余量故用 1500 触发
  const estWidth =
    current.text.split('').reduce(
      (w, ch) => w + (CJK.test(ch) || FULLWIDTH_PUNCT.test(ch) ? 1 : 0.55),
      0,
    ) * 44;
  const fontSize = estWidth > 1500 ? Math.max(30, 44 - (estWidth - 1500) / 25) : 44;
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
