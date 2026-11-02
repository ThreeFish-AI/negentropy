import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';

/** 金句卡：衬线大字居中，可附英文原文与出处 */
export const QuoteCard: React.FC<{
  zh: string;
  en?: string;
  cite?: string;
  accent?: string;
}> = ({zh, en, cite, accent = theme.text}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 160px'}}>
      <div style={{textAlign: 'center', transform: `translateY(${(1 - enter) * 40}px)`, opacity: enter}}>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 64,
            fontWeight: 700,
            color: accent,
            lineHeight: 1.5,
          }}
        >
          {zh}
        </div>
        {en ? (
          <div
            style={{
              marginTop: 36,
              fontFamily: theme.serif,
              fontSize: 30,
              fontStyle: 'italic',
              color: theme.dim,
              opacity: interpolate(frame, [20, 45], [0, 1], {extrapolateRight: 'clamp'}),
            }}
          >
            {en}
          </div>
        ) : null}
        {cite ? (
          <div
            style={{
              marginTop: 24,
              fontFamily: theme.sans,
              fontSize: 26,
              color: theme.dim,
              opacity: interpolate(frame, [35, 60], [0, 1], {extrapolateRight: 'clamp'}),
            }}
          >
            —— {cite}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** 简单淡入上移容器 */
export const FadeUp: React.FC<{delay?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  delay = 0,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - delay, fps, config: {damping: 200}});
  return (
    <div style={{opacity: enter, transform: `translateY(${(1 - enter) * 30}px)`, ...style}}>{children}</div>
  );
};

/** 标签胶囊 */
export const Pill: React.FC<{color: string; children: React.ReactNode; style?: React.CSSProperties}> = ({
  color,
  children,
  style,
}) => (
  <span
    style={{
      display: 'inline-block',
      padding: '8px 22px',
      borderRadius: 999,
      border: `2px solid ${color}`,
      color,
      fontFamily: theme.sans,
      fontSize: 28,
      fontWeight: 600,
      ...style,
    }}
  >
    {children}
  </span>
);
