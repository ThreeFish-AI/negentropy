/** ClockFace——定时钟面母题（storyboard 实现映射：本集新建母题候选四件之一）。
 *
 *  定位线装置族的头牌：上缘墙面 mech 蓝钟盘。**秒针不在此组件内自转**——
 *  运动量一律由调用方以 prop 注入（调用点顶层 `useTravel` 换算角度），
 *  组件本身零 motion hook、纯帧驱动确定性渲染。
 *
 *  色彩契约：面圈/针恒 mech；`dead`（0..1 停摆系数）把 mech 确定性线性混入
 *  deny（「进程死了钟停摆」的唯一语义色）——token 派生而非光积，可 grep。
 */
import React from 'react';
import {theme} from '../design/theme';

/** 确定性 token 混色（hex 线性插值；非光照乘积） */
export const mixHex = (a: string, b: string, t: number): string => {
  const x = Math.max(0, Math.min(1, t));
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 0xff) * (1 - x) + ((pb >> 16) & 0xff) * x);
  const g = Math.round(((pa >> 8) & 0xff) * (1 - x) + ((pb >> 8) & 0xff) * x);
  const bl = Math.round((pa & 0xff) * (1 - x) + (pb & 0xff) * x);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
};

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

export const ClockFace: React.FC<{
  /** 钟心（画布绝对坐标） */
  cx: number;
  cy: number;
  r?: number;
  /** 时位针停位（缺省 7:00——七点闹钟叙事） */
  hour?: number;
  minute?: number;
  /** 秒针角度（度，0=12 点方向顺时针；undefined 不画秒针） */
  secDeg?: number;
  /** 停摆系数 0..1：mech → deny 混色 + 整体压暗（P5 打烊） */
  dead?: number;
  opacity?: number;
}> = ({cx, cy, r = 110, hour = 7, minute = 0, secDeg, dead = 0, opacity = 1}) => {
  const face = mixHex(theme.mech, theme.deny, dead);
  const deep = mixHex(theme.mechDeep, theme.deny, dead);
  const pad = 22;
  const size = 2 * (r + pad);
  const hourDeg = ((hour % 12) + minute / 60) * 30 - 90;
  const minDeg = minute * 6 - 90;
  const hourTip = polar(cx, cy, r * 0.52, hourDeg);
  const minTip = polar(cx, cy, r * 0.78, minDeg);
  return (
    <svg
      width={size}
      height={size}
      style={{position: 'absolute', left: cx - r - pad, top: cy - r - pad, opacity, overflow: 'visible'}}
      viewBox={`0 0 ${size} ${size}`}
    >
      <g transform={`translate(${pad} ${pad})`}>
        {/* 面圈：绝对线宽（M-001 同纪律：不随 r 缩放）。DIAL_FACE 底色与 frozen
            ArchifyClip 画框底（ArchifyClip.tsx BOX 背景）刻意同值——钟面读作
            「挂进画框的表盘」，色随画框底走不随 theme 走（有注释的确定性派生豁免） */}
        <circle cx={r} cy={r} r={r} fill="#0B0E13" stroke={face} strokeWidth={6} />
        {/* 12 刻度：四正位长刻度 mech，其余 deep */}
        {Array.from({length: 12}, (_, i) => {
          const a = i * 30 - 90;
          const major = i % 3 === 0;
          const p1 = polar(r, r, r - (major ? 20 : 12), a);
          const p2 = polar(r, r, r - 4, a);
          return (
            <line
              key={i}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={major ? face : deep}
              strokeWidth={major ? 5 : 3}
            />
          );
        })}
        {/* 时/分针（静态停位） */}
        <line x1={r} y1={r} x2={hourTip.x} y2={hourTip.y} stroke={face} strokeWidth={9} strokeLinecap="round" />
        <line x1={r} y1={r} x2={minTip.x} y2={minTip.y} stroke={deep} strokeWidth={6} strokeLinecap="round" />
        {/* 秒针（调用方注入角度） */}
        {secDeg !== undefined ? (
          <line
            x1={r}
            y1={r}
            x2={polar(r, r, r * 0.9, secDeg - 90).x}
            y2={polar(r, r, r * 0.9, secDeg - 90).y}
            stroke={face}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ) : null}
        <circle cx={r} cy={r} r={7} fill={face} />
      </g>
    </svg>
  );
};
