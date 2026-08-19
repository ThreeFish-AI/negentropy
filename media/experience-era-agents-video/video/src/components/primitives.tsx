import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';

/**
 * 本集视觉原语（按集复制、不共享；cards.tsx 为跨集冻结文件不改动，新原语落此）。
 * 设计动机见 media/pipeline/skills/06-remotion-implementation.md 渲染缺陷清单：
 * CornerLabel 把「角标底部留白 ≥150px」从人工 QA 规则变成默认值；Panel 消灭
 * 复制粘贴的重复样式对象（清单第 7 条）；Meter/AxisBar/RingFlow 均已达到第 3
 * 个调用点才提取。全部帧驱动（无 Date.now/Math.random）。
 */

/** 角标：底部安全带之上的小字标注（英文专名/公式彩蛋）。默认贴底居中或左下，
 *  bottom 硬下限 150px——字幕带安全区（清单第 2 条）。 */
export const CornerLabel: React.FC<{
  children: React.ReactNode;
  frame?: number; // 局部帧；不传则内部取
  appearAt?: number; // 出现帧（默认 12）
  side?: 'left' | 'right';
  color?: string;
}> = ({children, frame: f, appearAt = 12, side = 'left', color = theme.dim}) => {
  const hookFrame = useCurrentFrame();
  const frame = f ?? hookFrame;
  const opacity = interpolate(frame, [appearAt, appearAt + 10], [0, 1], {
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 158, // ≥150 字幕安全带（清单第 2 条的默认值化）
        [side]: 64,
        fontFamily: theme.mono,
        fontSize: 18,
        color,
        opacity,
        letterSpacing: 0.4,
      }}
    >
      {children}
    </div>
  );
};

/** 面板容器：统一圆角/描边/内边距，可选强调色与辉光（克制使用——box-shadow 是
 *  官方点名的 GPU 瓶颈，见 skills/06 性能注记）。 */
export const Panel: React.FC<{
  accent?: string;
  glow?: boolean;
  width?: number | string;
  padding?: number | string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({accent, glow, width, padding = '28px 30px', style, children}) => (
  <div
    style={{
      width,
      padding,
      borderRadius: 16,
      background: theme.panel,
      border: `2px solid ${accent ?? theme.panelBorder}`,
      boxShadow: glow && accent ? `0 0 44px ${accent}22` : 'none',
      ...style,
    }}
  >
    {children}
  </div>
);

/** 轴条：标签 + 轨道 + 填充（可带天花板虚线）。EnvCeilingAxes/爬坡图/双柱图共用。 */
export const AxisBar: React.FC<{
  label: string;
  fill: number; // 0–1 目标填充（自行 clamp 由调用方负责）
  frame: number;
  delay?: number;
  color?: string;
  width?: number;
}> = ({label, fill, frame, delay = 0, color = theme.exp, width = 560}) => {
  const {fps} = useVideoConfig();
  const grow = spring({frame: frame - delay, fps, config: {damping: 200}});
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
      <div style={{width: 150, textAlign: 'right', fontFamily: theme.sans, fontSize: 24, color: theme.text}}>
        {label}
      </div>
      <div
        style={{
          width,
          height: 26,
          borderRadius: 13,
          background: theme.panel,
          border: `1.5px solid ${theme.panelBorder}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(1, fill)) * grow * 100}%`,
            height: '100%',
            background: color,
            opacity: 0.85,
          }}
        />
      </div>
    </div>
  );
};

/** 仪表：弧形表盘 + 指针 + 可选阈值刻度。P4 四仪表/P5 表盘/PromotionGate 共用。 */
export const Meter: React.FC<{
  label: string;
  value: number; // 0–1
  threshold?: number; // 阈值刻度（虚线，不标注数值）
  size?: number;
  color?: string;
}> = ({label, value, threshold, size = 120, color = theme.harness}) => {
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const angle = -Math.PI + Math.max(0, Math.min(1, value)) * Math.PI;
  // 弧：从 180° 到 0°（上半圆）
  const arc = (a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  return (
    <div style={{textAlign: 'center'}}>
      <svg width={size} height={size / 2 + 20}>
        <path
          d={`M ${arc(-Math.PI)} A ${r} ${r} 0 0 1 ${arc(0)}`}
          fill="none"
          stroke={theme.panelBorder}
          strokeWidth={6}
          strokeLinecap="round"
        />
        {threshold !== undefined ? (
          <line
            x1={cx + (r - 9) * Math.cos(-Math.PI + threshold * Math.PI)}
            y1={cy + (r - 9) * Math.sin(-Math.PI + threshold * Math.PI)}
            x2={cx + (r + 9) * Math.cos(-Math.PI + threshold * Math.PI)}
            y2={cy + (r + 9) * Math.sin(-Math.PI + threshold * Math.PI)}
            stroke={theme.dim}
            strokeWidth={2}
            strokeDasharray="3 3"
          />
        ) : null}
        <line
          x1={cx}
          y1={cy}
          x2={cx + r * 0.86 * Math.cos(angle)}
          y2={cy + r * 0.86 * Math.sin(angle)}
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={5} fill={color} />
      </svg>
      <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, marginTop: 2}}>{label}</div>
    </div>
  );
};

/** 环形流程：圆环描线生长 + 弧上巡游点。LoopRecap/LifecycleRing 共用。
 *  描画用 pathLength={1} + strokeDashoffset——与 px 版 strokeDasharray 互斥
 *  （清单第 3 条），线型样式须另置静态叠加路径。 */
export const RingFlow: React.FC<{
  progress: number; // 0–1 描画进度（调用方由帧驱动）
  cursorAt?: number; // 0–1 巡游点位置；不传则跟 progress
  size?: number;
  color?: string;
  children?: React.ReactNode; // 环心内容
}> = ({progress, cursorAt, size = 300, color = theme.exp, children}) => {
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const cursor = cursorAt ?? progress;
  const a = -Math.PI / 2 + cursor * 2 * Math.PI;
  return (
    <div style={{position: 'relative', width: size, height: size}}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.panelBorder} strokeWidth={2} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - Math.max(0, Math.min(1, progress))}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <circle cx={cx + r * Math.cos(a)} cy={cy + r * Math.sin(a)} r={7} fill={color} />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
};
