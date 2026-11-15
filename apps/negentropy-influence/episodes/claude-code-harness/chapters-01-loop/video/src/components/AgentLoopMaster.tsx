import React from 'react';
import {theme} from '../design/theme';
import {LoopRing, RING_STROKE, type RingNode} from './motifs';

export const polar = (cx: number, cy: number, r: number, deg: number): {x: number; y: number} => {
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

/** 贯穿全片的五步节点与明确主语（与 P2 STATIONS 同构：-90° 起每 +72°） */
export const AGENT_LOOP_STATIONS: (RingNode & {subject: string; sub: string})[] = [
  {label: 's1', subject: 'User', sub: '目标种子', angle: -90},
  {label: 's2', subject: 'Harness', sub: '底座装配', angle: -18},
  {label: 's3', subject: 'LLM', sub: '认知决策', angle: 54},
  {label: 's4', subject: 'Tool', sub: '终端执行', angle: 126},
  {label: 's5', subject: 'Context', sub: '观察回填', angle: 198},
];

/** 全片一以贯之的宏大 Harness 大圈几何参数 */
export const AGENT_LOOP_RING = {
  size: 780,
  left: 570,
  top: 140,
  cx: 960,
  cy: 530,
  r: 350,
} as const;

export interface AgentLoopMasterProps {
  /** 整体不透明度 */
  opacity?: number;
  /** 顶部母体大铭牌不透明度/显隐 */
  headerOpacity?: number;
  /** 环内双核心（LLM 与 TOOL）不透明度 */
  coreOpacity?: number;
  /** 环体画圆进度 (0 ~ 1) */
  drawProgress?: number;
  /** 环外 5 大主语节点不透明度（可按数组逐个控制或整体控制） */
  stationOpacities?: number[];
  /** 底部 while True 铭文不透明度 */
  footnoteOpacity?: number;
  /** 结果巡游光点进度 (0 ~ 1) */
  dotProgress?: number;
  /** 结果巡游光点不透明度 */
  dotOpacity?: number;
  /** 当前高亮/微转的行进光点角度增量 (deg) */
  spinDeg?: number;
  /** 调工具就继续高亮脉冲 (0 ~ 1) */
  goImpulse?: number;
  /** 不调就停制动脉冲 (0 ~ 1) */
  stopImpulse?: number;
  /** 整体微推缩放 */
  transform?: string;
}

export const AgentLoopMaster: React.FC<AgentLoopMasterProps> = ({
  opacity = 1,
  headerOpacity = 1,
  coreOpacity = 1,
  drawProgress = 1,
  stationOpacities = [1, 1, 1, 1, 1],
  footnoteOpacity = 1,
  dotProgress,
  dotOpacity = 0,
  spinDeg = 0,
  goImpulse = 0,
  stopImpulse = 0,
  transform,
}) => {
  const {cx, cy, r, size, left, top} = AGENT_LOOP_RING;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        transform,
        pointerEvents: 'none',
      }}
    >
      {/* 顶部 Harness 宏观母体发光铭牌 */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 270,
          top: 54,
          width: 540,
          textAlign: 'center',
          opacity: headerOpacity,
          zIndex: 20,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(10, 16, 26, 0.94)',
            padding: '8px 24px',
            borderRadius: 20,
            border: `2px solid ${theme.core}`,
            boxShadow: `0 0 28px ${theme.core}50, inset 0 0 12px ${theme.core}20`,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: theme.core,
              boxShadow: `0 0 10px ${theme.core}`,
            }}
          />
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 16,
              fontWeight: 800,
              color: theme.core,
              letterSpacing: 2,
            }}
          >
            {'[ HARNESS : AGENT LOOP & CONTEXT BUS ]'}
          </span>
        </div>
      </div>

      {/* 环内左腹：LLM 认知中枢（被大圈包容在其内） */}
      <div
        style={{
          position: 'absolute',
          left: 710,
          top: 450,
          width: 210,
          height: 160,
          borderRadius: 14,
          background: '#080E18',
          border: `2px solid ${theme.core}`,
          boxShadow: `0 0 24px ${theme.core}30`,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          opacity: coreOpacity,
          zIndex: 8,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: theme.core,
              boxShadow: `0 0 8px ${theme.core}`,
            }}
          />
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 16,
              fontWeight: 700,
              color: theme.core,
            }}
          >
            {'LLM · 认知大脑'}
          </span>
        </div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 13,
            color: theme.dim,
            lineHeight: 1.5,
          }}
        >
          {'Claude 3.5 Sonnet'}
          <br />
          <span style={{color: theme.text}}>{'读取 Context 决策'}</span>
        </div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 12,
            color: theme.tool,
            background: `${theme.tool}18`,
            padding: '4px 8px',
            borderRadius: 6,
            border: `1px solid ${theme.tool}40`,
          }}
        >
          {'签发: tool_use block'}
        </div>
      </div>

      {/* 环内右腹：TOOL 终端执行（被大圈包容在其内） */}
      <div
        style={{
          position: 'absolute',
          left: 1000,
          top: 450,
          width: 210,
          height: 160,
          borderRadius: 14,
          background: '#060B12',
          border: `2px solid ${theme.tool}`,
          boxShadow: `0 0 24px ${theme.tool}30`,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          opacity: coreOpacity,
          zIndex: 8,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: theme.tool,
              boxShadow: `0 0 8px ${theme.tool}`,
            }}
          />
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 16,
              fontWeight: 700,
              color: theme.tool,
            }}
          >
            {'TOOL · 物理终端'}
          </span>
        </div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 13,
            color: theme.dim,
            lineHeight: 1.5,
          }}
        >
          {'Local Bash Sandbox'}
          <br />
          <span style={{color: theme.text}}>{'$ run_bash(command)'}</span>
        </div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 12,
            color: theme.ok,
            background: `${theme.ok}18`,
            padding: '4px 8px',
            borderRadius: 6,
            border: `1px solid ${theme.ok}40`,
          }}
        >
          {'产生: stdout / stderr'}
        </div>
      </div>

      {/* 环体本尊（LoopRing） */}
      <div
        style={{
          position: 'absolute',
          left,
          top,
          opacity: Math.min(1, drawProgress > 0.05 ? 1 : 0),
        }}
      >
        <LoopRing
          size={size}
          draw={drawProgress}
          nodes={AGENT_LOOP_STATIONS}
          showLabels={false}
          showExit={false}
          dotProgress={dotProgress}
          dotOpacity={dotOpacity}
        />
      </div>

      {/* 五大主语外环节点牌（User, Harness, LLM, Tool, Context） */}
      {AGENT_LOOP_STATIONS.map((s, i) => {
        const p = polar(cx, cy, r + 42, s.angle);
        const nodeOpacity = (stationOpacities[i] ?? 1) * Math.min(1, drawProgress * 1.5);
        return (
          <div
            key={s.label}
            style={{
              position: 'absolute',
              left: p.x - 55,
              top: p.y - 18,
              width: 110,
              textAlign: 'center',
              opacity: nodeOpacity,
              zIndex: 12,
            }}
          >
            <div
              style={{
                background: 'rgba(8, 14, 22, 0.94)',
                border: `1.5px solid ${
                  i === 0
                    ? theme.text
                    : i === 1
                      ? theme.core
                      : i === 2
                        ? theme.core
                        : i === 3
                          ? theme.tool
                          : theme.ok
                }`,
                borderRadius: 8,
                padding: '3px 8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.6)',
              }}
            >
              <div
                style={{
                  fontFamily: theme.mono,
                  fontSize: 13,
                  fontWeight: 700,
                  color: theme.text,
                }}
              >
                {s.subject}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 11, color: theme.dim}}>
                {s.sub}
              </div>
            </div>
          </div>
        );
      })}

      {/* 动态双轨加速外环与稳定内环 SVG */}
      <svg
        width={1920}
        height={1080}
        style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}
      >
        {/* 外加速虚线环 */}
        <circle
          cx={cx}
          cy={cy}
          r={r + 28}
          fill="none"
          stroke={theme.core}
          strokeWidth={2.5}
          strokeDasharray="12 16"
          opacity={0.55 * drawProgress}
        />
        {/* 内稳定虚线环 */}
        <circle
          cx={cx}
          cy={cy}
          r={r - 28}
          fill="none"
          stroke={theme.core}
          strokeWidth={1.8}
          strokeDasharray="6 10"
          opacity={0.45 * drawProgress}
        />

        {/* 调工具就继续弧段高亮 */}
        {goImpulse > 0.01 ? (
          <path
            d={`M ${polar(cx, cy, r, -90).x.toFixed(1)} ${polar(cx, cy, r, -90).y.toFixed(1)} A ${r} ${r} 0 0 1 ${polar(cx, cy, r, -18).x.toFixed(1)} ${polar(cx, cy, r, -18).y.toFixed(1)}`}
            fill="none"
            stroke={theme.core}
            strokeWidth={RING_STROKE + 6}
            strokeLinecap="round"
            opacity={0.9 * goImpulse}
            filter="drop-shadow(0 0 12px #D97757)"
          />
        ) : null}

        {/* 不调就停制动脉冲闪烁 */}
        {stopImpulse > 0.01 ? (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={theme.dim}
            strokeWidth={RING_STROKE}
            opacity={0.5 * stopImpulse}
          />
        ) : null}

        {/* 微转光点示活 */}
        {spinDeg > 0 ? (
          <>
            <circle
              cx={polar(cx, cy, r, -90 + spinDeg).x}
              cy={polar(cx, cy, r, -90 + spinDeg).y}
              r={13}
              fill={theme.core}
              opacity={spinDeg > 0 && spinDeg < 36 ? 1 : 0}
              filter="drop-shadow(0 0 8px #D97757)"
            />
            <circle
              cx={polar(cx, cy, r + 28, -90 + spinDeg * 1.5).x}
              cy={polar(cx, cy, r + 28, -90 + spinDeg * 1.5).y}
              r={6}
              fill={theme.tool}
              opacity={spinDeg > 0 && spinDeg < 36 ? 0.9 : 0}
            />
          </>
        ) : null}
      </svg>

      {/* 底部循环铭文：while True */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 70,
          textAlign: 'center',
          opacity: footnoteOpacity,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 22,
            letterSpacing: 4,
            color: theme.dim,
          }}
        >
          {/* caption-dup-ok: 编程语法标准结构标记 */}
          {'— while True —'}
        </span>
      </div>
    </div>
  );
};
