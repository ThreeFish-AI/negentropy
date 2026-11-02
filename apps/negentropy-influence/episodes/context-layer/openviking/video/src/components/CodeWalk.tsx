/** 代码走廊（v2 母题）：mono 代码卡 + 帧驱动的行级高亮。
 *  高亮时刻用纯帧算术（progress 助手），不进 hooks——时点完全由分镜锚定句驱动。 */
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {DUR, progress, useProgress} from '../motion';

export type CodeHi = {line: number; at: number; color: string};

export const CodeWalk: React.FC<{
  title?: string;
  lines: string[];
  /** 行高亮：line 从 0 起；at 为 beat 内帧 */
  hi?: CodeHi[];
  caption?: string;
  width?: number;
}> = ({title, lines, hi = [], caption, width = 1060}) => {
  const frame = useCurrentFrame();
  const card = useProgress(2, DUR.f5);
  return (
    <div style={{opacity: card, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div
        style={{
          width,
          background: theme.panel,
          border: `2.5px solid ${theme.panelBorder}`,
          borderRadius: 12,
          padding: '22px 30px',
          position: 'relative',
        }}
      >
        {title ? (
          <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginBottom: 12}}>{title}</div>
        ) : null}
        {lines.map((l, i) => {
          const shown = progress(frame, 4 + i * 3, DUR.f3);
          const h = hi.find((x) => x.line === i);
          const hl = h ? progress(frame, h.at, DUR.f4) : 0;
          return (
            <div
              key={i}
              style={{
                fontFamily: theme.mono,
                fontSize: 22,
                lineHeight: 1.75,
                color: hl > 0.35 ? h!.color : theme.text,
                background: h && hl > 0.25 ? `${h.color}1A` : 'transparent',
                borderLeft: h && hl > 0.25 ? `3px solid ${h.color}` : '3px solid transparent',
                paddingLeft: 10,
                opacity: shown,
                whiteSpace: 'pre',
              }}
            >
              {l}
            </div>
          );
        })}
        {caption ? (
          <div
            style={{
              position: 'absolute',
              right: 16,
              top: -34,
              fontFamily: theme.sans,
              fontSize: 17,
              color: theme.dim,
              background: '#0B0E13',
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 8,
              padding: '4px 12px',
            }}
          >
            {caption}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 终端日志卡：行按帧上滚浮现（v2 母题，真实 selftest 输出专用）。 */
export const TerminalLog: React.FC<{
  prompt?: string;
  lines: {text: string; color?: string; bold?: boolean; at?: number}[];
  caption?: string;
  width?: number;
  lineEvery?: number;
}> = ({prompt, lines, caption, width = 1060, lineEvery = 16}) => {
  const frame = useCurrentFrame();
  const card = useProgress(2, DUR.f5);
  return (
    <div style={{opacity: card, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div
        style={{
          width,
          background: '#0B0E13',
          border: `2.5px solid ${theme.panelBorder}`,
          borderRadius: 12,
          padding: '20px 28px',
          position: 'relative',
        }}
      >
        {prompt ? (
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginBottom: 12}}>{`$ ${prompt}`}</div>
        ) : null}
        {lines.map((l, i) => {
          const at = l.at ?? 10 + i * lineEvery;
          const shown = progress(frame, at, DUR.f3);
          return (
            <div
              key={i}
              style={{
                fontFamily: theme.mono,
                fontSize: 21,
                lineHeight: 1.7,
                color: l.color ?? theme.dim,
                fontWeight: l.bold ? 700 : 400,
                opacity: shown,
                transform: `translateY(${(1 - shown) * 8}px)`,
                whiteSpace: 'pre-wrap',
              }}
            >
              {l.text}
            </div>
          );
        })}
        {caption ? (
          <div
            style={{
              position: 'absolute',
              right: 16,
              top: -34,
              fontFamily: theme.sans,
              fontSize: 17,
              color: theme.dim,
              background: '#0B0E13',
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 8,
              padding: '4px 12px',
            }}
          >
            {caption}
          </div>
        ) : null}
      </div>
    </div>
  );
};
