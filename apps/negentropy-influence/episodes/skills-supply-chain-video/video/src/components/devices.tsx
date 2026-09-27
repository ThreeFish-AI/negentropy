/** 本集共享装置（seeded 档，复制源 agent-skills-video 后整体重写为本集词汇）。
 *
 *  只放跨幕复用的机械装置：舞台居中、终端走廊、账柱对、计数环、归属角标。
 *  幕内一次性装置一律 scene-local（复用边界：Remotion 原语复制不共享）。
 *  运动层铁律：hooks 只在组件顶层；effects 不吃弹簧；时长取 DUR token。
 */
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {DUR, progress, useStagger} from '../motion';

/** 舞台：内容居中 + 顶部安全带（y≥56 起步，章节条占 y14–42）。 */
export const Stage: React.FC<{children: React.ReactNode; top?: number}> = ({children, top = 56}) => (
  <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: top}}>
    {children}
  </div>
);

/** 终端走廊：逐行滚入的日志（原型实测输出用，danger 行红显）。 */
export const TerminalFeed: React.FC<{
  lines: {text: string; danger?: boolean; ok?: boolean}[];
  at: number;
  title?: string;
}> = ({lines, at, title}) => {
  const st = useStagger(lines.length, {at, dur: DUR.f3, stride: 4});
  return (
    <div
      style={{
        width: 1180,
        borderRadius: 12,
        border: `2px solid ${theme.panelBorder}`,
        background: '#0B0E13',
        padding: '18px 26px',
        fontFamily: theme.mono,
        fontSize: 22,
        lineHeight: 1.75,
        color: theme.dim,
      }}
    >
      {title ? (
        <div style={{color: theme.text, fontSize: 20, marginBottom: 8, letterSpacing: 1}}>
          {'$ ' + title}
        </div>
      ) : null}
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            opacity: st[i],
            transform: `translateY(${(1 - st[i]) * 10}px)`,
            color: l.danger ? theme.danger : l.ok ? theme.ok : theme.dim,
            whiteSpace: 'pre',
          }}
        >
          {l.text}
        </div>
      ))}
    </div>
  );
};

/** 账柱对（组）：数值滚数生长的对比柱。 */
export const LedgerBars: React.FC<{
  items: {label: string; value: number; color: string; note?: string}[];
  at: number;
  unit?: string;
  max?: number;
}> = ({items, at, unit = '', max}) => {
  const frame = useCurrentFrame();
  const m = max ?? Math.max(...items.map((i) => i.value));
  return (
    <div style={{display: 'flex', gap: 70, alignItems: 'flex-end', height: 420}}>
      {items.map((it) => {
        // 铁律①：map 内只用纯函数派生（progress + 取整），不调 hook
        const p = progress(frame, at, DUR.f5);
        const count = Math.round(it.value * p);
        return (
          <div key={it.label} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
            <div style={{fontFamily: theme.mono, fontSize: 30, color: it.color}}>
              {count.toLocaleString('zh-CN')}
              {unit}
            </div>
            <div
              style={{
                width: 130,
                height: Math.max(10, 300 * (it.value / m) * p),
                borderRadius: '8px 8px 0 0',
                background: `${it.color}30`,
                border: `2.5px solid ${it.color}`,
                borderBottom: 'none',
              }}
            />
            <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>{it.label}</div>
            {it.note ? (
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{it.note}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};


/** 计数环：比例/计数的目标环。 */
export const StatRing: React.FC<{
  value: number;
  at: number;
  label: string;
  color: string;
  suffix?: string;
  size?: number;
}> = ({value, at, label, color, suffix = '', size = 240}) => {
  const frame = useCurrentFrame();
  const p = progress(frame, at, DUR.f5);
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
      <div style={{position: 'relative', width: size, height: size}}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={theme.panelBorder} strokeWidth={10} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${c * value * p} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: size / 5,
            color: theme.text,
          }}
        >
          {Math.round(value * 100 * p)}
          {suffix || '%'}
        </div>
      </div>
      <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{label}</div>
    </div>
  );
};

/** 归属角标：证据来源徽章（厂商自报/第三方实测/简化原型）。 */
export const EvidenceBadge: React.FC<{text: string; at: number}> = ({text, at}) => {
  const frame = useCurrentFrame();
  const p = progress(frame, at, DUR.f3);
  return (
    <div
      style={{
        position: 'absolute',
        right: 60,
        top: 96,
        opacity: p,
        padding: '8px 18px',
        borderRadius: 8,
        border: `1.5px solid ${theme.panelBorder}`,
        background: `${theme.panel}E6`,
        fontFamily: theme.sans,
        fontSize: 19,
        color: theme.dim,
      }}
    >
      {text}
    </div>
  );
};
