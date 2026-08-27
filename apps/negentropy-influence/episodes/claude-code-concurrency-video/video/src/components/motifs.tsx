/** chrome 层组件种子（seeded 档——scaffold 复制后完全自由，无门，随集演进）。
 *
 *  通用排版/标注机械只读底座 token；概念色一律经 `accent` prop 注入。
 *  创作性母题已按 skills/06 母题表从《拆开 Claude Code》集复制裁剪至本文件
 *  （复制适配、不做跨集 import——复用边界见 pipeline/README.md §四）：
 *    Terminal 终端窗口 + 打字机（P0 痛点开场）
 *    LoopRing 环形循环 —— 本集题眼：环一秒不停（恒定视觉锚）
 */
import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';

/** 缓入缓出：用于描线与推进，避免线性运动的机械感 */
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (1 - t) * (1 - t) * 2);

/** 环线宽（绝对像素，全片恒定，勿随 size 缩放） */
export const RING_STROKE = 6;

// ─────────────────────────────────────────────────────────── chrome 组件

export const Panel: React.FC<{
  style?: React.CSSProperties;
  children?: React.ReactNode;
  accent?: string;
}> = ({style, children, accent}) => (
  <div
    style={{
      background: theme.panel,
      border: `2px solid ${accent ?? theme.panelBorder}`,
      borderRadius: 14,
      ...style,
    }}
  >
    {children}
  </div>
);

/** 底部角标——统一压在 bottom ≥ 150（避让字幕条，skills/06 红线二） */
export const Footnote: React.FC<{children: React.ReactNode; delay?: number}> = ({
  children,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame - delay, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 168,
        textAlign: 'center',
        fontFamily: theme.mono,
        fontSize: 24,
        color: theme.dim,
        opacity: o,
      }}
    >
      {children}
    </div>
  );
};

/** 幕标题条：左上角章号 + 标语（角标性质，不进口播）。章号默认 text，
 *  各集常换成本集概念色（ep1 即是 core）——这是 chrome 层少数的「随集演进」点 */
export const SceneTag: React.FC<{
  chapter: string;
  tagline: string;
  accent?: string;
}> = ({chapter, tagline, accent}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [6, 24], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', left: 72, top: 64, opacity: o}}>
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: 26,
          color: accent ?? theme.text,
          letterSpacing: 2,
        }}
      >
        {chapter}
      </div>
      <div style={{fontFamily: theme.serif, fontSize: 22, color: theme.dim, marginTop: 6}}>
        {tagline}
      </div>
    </div>
  );
};

/** 幕级常驻抬头带（2026-08 品控改造）——修复「顶部 1/3 全片闲置」的构图缺陷。
 *
 *  实测动机：五集 3×3 宫格抽样显示顶带 ink 仅 0.4–2.0%，而 SceneTag 的
 *  Sequence 覆盖率只有 7–59%。本组件由**幕**（而非镜）挂载一次，全幕常驻，
 *  一次性补齐顶部信息层：左＝幕序与幕名，右＝本幕机制英文名（角标层，不进口播）。
 *
 *  纪律：只读底座 token 与传入的 accent；不参与句锚动画（避免与镜内动效抢注意力），
 *  仅在幕首 12 帧淡入；高度锁死 ≤96px，不侵占镜内主体区。 */
export const SceneHeader: React.FC<{
  index: string;
  title: string;
  meta?: string;
  accent?: string;
}> = ({index, title, meta, accent}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 12], [0, 1], {extrapolateRight: 'clamp'});
  const c = accent ?? theme.core;
  return (
    <div
      style={{
        position: 'absolute',
        left: 72,
        right: 72,
        top: 52,
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        opacity: o * 0.92,
        pointerEvents: 'none',
      }}
    >
      <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 22,
            color: c,
            letterSpacing: 3,
            borderLeft: `3px solid ${c}`,
            paddingLeft: 12,
          }}
        >
          {index}
        </span>
        <span style={{fontFamily: theme.serif, fontSize: 27, color: theme.text, letterSpacing: 1}}>
          {title}
        </span>
      </div>
      {meta ? (
        <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, letterSpacing: 1}}>
          {meta}
        </span>
      ) : null}
    </div>
  );
};

/** 数字滚动计数器（帧驱动，无随机） */
export const Counter: React.FC<{
  from: number;
  to: number;
  start: number;
  frames?: number;
  style?: React.CSSProperties;
}> = ({from, to, start, frames = 24, style}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - start, [0, frames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <span style={{fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', ...style}}>
      {Math.round(from + (to - from) * ease(t))}
    </span>
  );
};

/** 代码卡：逐行渲染（每行 framesPerLine 帧），可高亮/压暗指定行。
 *  高亮行与行号辉光统一走 `accent`（默认 text）——各集传本集概念色 */
export const CodeCard: React.FC<{
  lines: string[];
  framesPerLine?: number;
  highlight?: number[];
  dimOthers?: boolean;
  width?: number;
  showLineNumbers?: boolean;
  glowLineNumbersAt?: number;
  accent?: string;
}> = ({
  lines,
  framesPerLine = 3,
  highlight = [],
  dimOthers = false,
  width = 900,
  showLineNumbers = true,
  glowLineNumbersAt,
  accent,
}) => {
  const frame = useCurrentFrame();
  const hot = accent ?? theme.text;
  const glow =
    glowLineNumbersAt !== undefined
      ? interpolate(frame - glowLineNumbersAt, [0, 8, 22], [0, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0;
  return (
    <Panel accent={accent} style={{width, padding: '20px 24px'}}>
      {lines.map((ln, i) => {
        const shown = frame >= i * framesPerLine;
        const isHot = highlight.includes(i);
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 16,
              fontFamily: theme.mono,
              fontSize: 25,
              lineHeight: 1.62,
              opacity: shown ? (dimOthers && !isHot ? 0.4 : 1) : 0,
              background: isHot ? `${hot}26` : 'transparent',
              borderLeft: isHot ? `4px solid ${hot}` : '4px solid transparent',
              paddingLeft: 8,
              borderRadius: 5,
            }}
          >
            {showLineNumbers ? (
              <span
                style={{
                  width: 34,
                  textAlign: 'right',
                  color: glow > 0 ? hot : theme.panelBorder,
                  textShadow: glow > 0 ? `0 0 ${10 * glow}px ${hot}` : 'none',
                }}
              >
                {i + 1}
              </span>
            ) : null}
            <span style={{color: theme.text, whiteSpace: 'pre'}}>{ln}</span>
          </div>
        );
      })}
    </Panel>
  );
};

/** 反枚举原则的并列项：panel 底 + 编号，激活时才染色。
 *  概念色经 `accent` 注入（默认 text 中性；各集传本集概念色） */
export const NumberedCard: React.FC<{
  index: number;
  label: string;
  active?: boolean;
  sub?: string;
  width?: number;
  delay?: number;
  accent?: string;
}> = ({index, label, active = false, sub, width = 210, delay = 0, accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - delay, fps, config: {damping: 200}});
  const on = accent ?? theme.text;
  return (
    <div
      style={{
        width,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 26}px)`,
      }}
    >
      <Panel
        accent={active ? on : theme.panelBorder}
        style={{padding: '16px 18px', minHeight: 104}}
      >
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 22,
            color: active ? on : theme.dim,
          }}
        >
          {String(index).padStart(2, '0')}
        </div>
        <div
          style={{
            fontFamily: theme.sans,
            fontSize: 27,
            fontWeight: 600,
            color: theme.text,
            marginTop: 4,
          }}
        >
          {label}
        </div>
        {sub ? (
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 4}}>
            {sub}
          </div>
        ) : null}
      </Panel>
    </div>
  );
};

// ─────────────────────────────────────────────────────── 创作母题 1：终端（复制自 ep1 裁剪）

export type TermLine = {text: string; color?: string; delay: number; prompt?: string};

/** 终端窗口 + 逐字打字机。cps = 每秒字数（帧驱动，可复现） */
export const Terminal: React.FC<{
  lines: TermLine[];
  width?: number;
  height?: number;
  cps?: number;
  freezeCursorAt?: number;
  title?: string;
}> = ({lines, width = 1180, height = 470, cps = 26, freezeCursorAt, title = 'zsh'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const frozen = freezeCursorAt !== undefined && frame >= freezeCursorAt;
  const blink = frozen ? 0.35 : Math.floor((frame / fps) * 2) % 2 === 0 ? 1 : 0.15;
  return (
    <Panel style={{width, height, padding: 0, overflow: 'hidden'}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 44,
          padding: '0 18px',
          borderBottom: `2px solid ${theme.panelBorder}`,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{width: 12, height: 12, borderRadius: 999, background: theme.panelBorder}}
          />
        ))}
        <div style={{marginLeft: 10, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
          {title}
        </div>
      </div>
      <div style={{padding: '22px 26px', fontFamily: theme.mono, fontSize: 27, lineHeight: 1.65}}>
        {lines.map((ln, i) => {
          const shown = Math.max(0, Math.floor(((frame - ln.delay) / fps) * cps));
          if (shown <= 0) return null;
          const isLast = i === lines.length - 1;
          const done = shown >= ln.text.length;
          return (
            <div key={i} style={{color: ln.color ?? theme.text, whiteSpace: 'pre'}}>
              {ln.prompt ? <span style={{color: theme.core}}>{ln.prompt} </span> : null}
              {ln.text.slice(0, shown)}
              {isLast && done ? (
                <span style={{opacity: blink, color: frozen ? theme.dim : theme.core}}>▍</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

// ─────────────────────────────────────────────────────── 创作母题 2：环形循环（复制自 ep1 裁剪）

export type RingNode = {label: string; angle: number};

/** 环上四个节点的固定角度（12 点起顺时针）——各幕一致，位置即语义 */
export const RING_NODES: RingNode[] = [
  {label: '问模型', angle: -90},
  {label: '看回答', angle: 0},
  {label: '执行工具', angle: 90},
  {label: '填回结果', angle: 180},
];

export const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

/**
 * 全片恒定的环形循环。★本集题眼：环一秒不停——`dotProgress` 用 useRingDot
 * 匀速驱动，环速不因任何旁轨/队列事件而变化；`stroke` 恒 core、`strokeWidth`
 * 恒绝对像素（不随 size 缩放），调用点不得覆写（复用 ep1 不变量）。
 * `ringOffset` 平移相位起点，用于跨镜衔接时保持光点连续。
 */
export const LoopRing: React.FC<{
  size?: number;
  draw?: number;
  dotProgress?: number;
  activeNode?: number;
  dimNodes?: boolean;
  nodeLabels?: string[];
  /** 节点文案。size < 260 时必须关掉——0°/180° 两侧的标签会在小尺寸下互相压字 */
  showLabels?: boolean;
}> = ({size = 460, draw = 1, dotProgress, activeNode, dimNodes = false, nodeLabels, showLabels}) => {
  const labelsOn = showLabels ?? size >= 260;
  const frame = useCurrentFrame();
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 46;
  const pulse = 0.55 + 0.45 * Math.sin(frame / 5);
  const dot = dotProgress === undefined ? null : polar(cx, cy, r, -90 + dotProgress * 360);
  return (
    <svg width={size} height={size} style={{overflow: 'visible'}}>
      {/* 环本体：pathLength 归一化描线（红线三：不与像素 dasharray 混用） */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={theme.core}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - Math.max(0, Math.min(1, draw))}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {RING_NODES.map((n, i) => {
        const p = polar(cx, cy, r, n.angle);
        const on = activeNode === i;
        const o = draw > 0.85 ? 1 : 0;
        return (
          <g key={n.label} opacity={o}>
            <circle
              cx={p.x}
              cy={p.y}
              r={on ? 16 + 5 * pulse : 13}
              fill={theme.bg}
              stroke={on ? theme.mech : theme.core}
              strokeWidth={4}
              opacity={dimNodes && !on ? 0.4 : 1}
            />
            {labelsOn ? (
              <text
                x={p.x}
                y={p.y + (n.angle === 90 ? 46 : n.angle === -90 ? -28 : 6)}
                textAnchor={n.angle === 0 ? 'start' : n.angle === 180 ? 'end' : 'middle'}
                dx={n.angle === 0 ? 26 : n.angle === 180 ? -26 : 0}
                fontFamily={theme.sans}
                fontSize={24}
                fontWeight={600}
                fill={on ? theme.mech : dimNodes ? theme.dim : theme.text}
              >
                {nodeLabels?.[i] ?? n.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {dot ? <circle cx={dot.x} cy={dot.y} r={11} fill={theme.core} /> : null}
    </svg>
  );
};

/** 环的匀速巡游进度（周期 secPerLap 秒）。offset 平移相位（帧），跨镜衔接用 */
export const useRingDot = (secPerLap = 2.5, offset = 0) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (((frame - offset) / (fps * secPerLap)) % 1 + 1) % 1;
};

export {ease};
