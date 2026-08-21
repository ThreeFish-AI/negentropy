/** chrome 层组件种子（seeded 档——scaffold 复制后完全自由，无门，随集演进）。
 *
 *  本文件从《拆开 Claude Code》集（claude-code-explained-video）的 motifs.tsx
 *  抽出**通用排版/标注机械**，只读底座 token（panel/panelBorder/text/dim +
 *  字体三族）；概念色一律经 `accent` prop 由调用方注入。任何集的 theme.ts
 *  底座都齐，故 scaffold 后无需改动即可 tsc 通过。随集演进时直接改本集副本
 *  （复制适配、不做跨集 import——复用边界见 pipeline/README.md §四）。
 *
 *  刻意**不进模板**的是创作性母题（Terminal / LoopRing / DispatchTable /
 *  GateRouter / SlotRing）：它们承载各集的叙事隐喻，属于每集的创作产物。
 *  需要时从 claude-code-explained-video 的 motifs.tsx 复制对应段落后裁剪、
 *  追加到本文件；母题目录与适用场景见 pipeline/skills/06 的母题表。
 */
import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';

/** 缓入缓出：用于描线与推进，避免线性运动的机械感 */
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (1 - t) * (1 - t) * 2);

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

// ─────────────────────────────────────────────────────────── 本集母题
// 从《拆开 Claude Code》集（claude-code-explained-video）motifs.tsx 复制裁剪：
// Terminal / LoopRing 族（系列同款终端 + 恒定视觉锚环）；另新增本集三件——
// Desk（视野台面：全片主舞台）、Chip（对话流色块行）、Stamp（印章：催更 / SAVE /
// cache hit / 停 / 职责）。复制适配、不做跨集 import（pipeline/README.md §四）。

/** 环线宽（绝对像素，全片恒定，勿随 size 缩放） */
export const RING_STROKE = 6;

// ─────────────────────────────────────────────── 母题：终端（复制自 ep1 后扩展）

export type TermLine = {text: string; color?: string; delay: number; prompt?: string};

/** 终端窗口 + 逐字打字机。cps = 每秒字数（帧驱动，可复现）。
 *  本集扩展：scrollShift（行区整体上移——首行被工具输出顶出可视区）与
 *  ghostLine / ghostAt（滚出后停在顶端的 dim 残影，P0「被挤走」要被看见）。 */
export const Terminal: React.FC<{
  lines: TermLine[];
  width?: number;
  height?: number;
  cps?: number;
  /** 打完后光标是否停闪并变灰 */
  freezeCursorAt?: number;
  title?: string;
  scrollShift?: number;
  ghostLine?: string;
  ghostAt?: number;
  promptColor?: string;
}> = ({
  lines,
  width = 1180,
  height = 470,
  cps = 26,
  freezeCursorAt,
  title = 'zsh',
  scrollShift = 0,
  ghostLine,
  ghostAt,
  promptColor,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const frozen = freezeCursorAt !== undefined && frame >= freezeCursorAt;
  const blink = frozen ? 0.35 : Math.floor((frame / fps) * 2) % 2 === 0 ? 1 : 0.15;
  const ghostO =
    ghostAt !== undefined
      ? interpolate(frame - ghostAt, [0, 12], [0, 0.55], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0;
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
      <div
        style={{
          position: 'relative',
          padding: '22px 26px',
          fontFamily: theme.mono,
          fontSize: 27,
          lineHeight: 1.65,
        }}
      >
        {/* 残影：滚出可视区的行停在顶端变 dim（0-A 的「被挤走」） */}
        {ghostO > 0 && ghostLine ? (
          <div
            style={{
              position: 'absolute',
              left: 26,
              top: 10,
              color: theme.dim,
              opacity: ghostO,
              whiteSpace: 'pre',
            }}
          >
            {ghostLine}
          </div>
        ) : null}
        <div style={{transform: `translateY(${-scrollShift}px)`}}>
          {lines.map((ln, i) => {
            const shown = Math.max(0, Math.floor(((frame - ln.delay) / fps) * cps));
            if (shown <= 0) return null;
            const isLast = i === lines.length - 1;
            const done = shown >= ln.text.length;
            return (
              <div key={i} style={{color: ln.color ?? theme.text, whiteSpace: 'pre'}}>
                {ln.prompt ? (
                  <span style={{color: promptColor ?? theme.dim}}>{ln.prompt} </span>
                ) : null}
                {ln.text.slice(0, shown)}
                {isLast && done ? (
                  <span style={{opacity: blink, color: frozen ? theme.dim : theme.mech}}>▍</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
};

// ─────────────────────────────────────────────── 母题：环形循环（复制自 ep1，逐字）

export type RingNode = {label: string; angle: number};

/** 环上四个节点的固定角度（12 点起顺时针）——各幕一致，位置即语义 */
export const RING_NODES: RingNode[] = [
  {label: '问模型', angle: -90},
  {label: '看回答', angle: 0},
  {label: '执行工具', angle: 90},
  {label: '填回结果', angle: 180},
];

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

/**
 * 全片恒定的环形循环（系列锚：同色 core 同线宽 6px，绝不覆写）。
 * - `draw` 0→1 描线进度；`dotProgress` 光点沿环位置（0–1，undefined 则不显示）
 * - `activeNode` 高亮某节点（石青脉冲）；`exitPull` 光点滑出到「停机」出口的比例
 * - `nodeLabels` 覆写节点文案
 */
export const LoopRing: React.FC<{
  size?: number;
  draw?: number;
  dotProgress?: number;
  activeNode?: number;
  exitPull?: number;
  dimNodes?: boolean;
  nodeLabels?: string[];
  showExit?: boolean;
  /** 节点文案。size < 260 时必须关掉——0°/180° 两侧的标签会在小尺寸下互相压字 */
  showLabels?: boolean;
}> = ({
  size = 460,
  draw = 1,
  dotProgress,
  activeNode,
  exitPull = 0,
  dimNodes = false,
  nodeLabels,
  showExit = true,
  showLabels,
}) => {
  const labelsOn = showLabels ?? size >= 260;
  const frame = useCurrentFrame();
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 46;
  const pulse = 0.55 + 0.45 * Math.sin(frame / 5);

  // 光点位置：沿环 + 可选地向右侧「停机」出口外拉
  const dot = dotProgress === undefined ? null : polar(cx, cy, r, -90 + dotProgress * 360);
  const exitX = dot ? dot.x + exitPull * (size - cx + 90) : 0;
  const exitY = dot ? dot.y + exitPull * -18 : 0;

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
      {showExit ? (
        <line
          x1={cx + r}
          y1={cy}
          x2={cx + r + 78}
          y2={cy - 14}
          stroke={theme.core}
          strokeWidth={RING_STROKE - 2}
          strokeDasharray="8 8"
          opacity={0.5 * draw}
        />
      ) : null}
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
      {dot ? (
        <circle
          cx={exitPull > 0 ? exitX : dot.x}
          cy={exitPull > 0 ? exitY : dot.y}
          r={11}
          fill={theme.core}
          opacity={exitPull > 0.9 ? 0.5 : 1}
        />
      ) : null}
    </svg>
  );
};

/** 环的匀速巡游进度（周期 secPerLap 秒），供各幕共用同一节律 */
export const useRingDot = (secPerLap = 2.5, offset = 0) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return ((frame - offset) / (fps * secPerLap)) % 1;
};

// ─────────────────────────────────────────────── 母题：视野台面（本集新增）

/**
 * Desk —— 全片主舞台：一张亮面桌子。物件进出都在这张桌面上发生。
 * - `outline` 0→1 线稿化（5-B 桌子退后：描边保留、填充淡出）
 * - `fillOpacity` 半透明填充（0-C 环在桌后，需透出环的弧线）
 */
export const Desk: React.FC<{
  width: number;
  height: number;
  outline?: number;
  fillOpacity?: number;
  accent?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({width, height, outline = 0, fillOpacity = 1, accent, style, children}) => (
  <div
    style={{
      position: 'relative',
      width,
      height,
      borderRadius: 20,
      border: `3px solid ${accent ?? theme.panelBorder}`,
      ...style,
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 17,
        background: theme.panel,
        opacity: (1 - outline * 0.94) * fillOpacity,
      }}
    />
    {/* 亮面高光条 */}
    <div
      style={{
        position: 'absolute',
        left: 10,
        right: 10,
        top: 3,
        height: 4,
        borderRadius: 2,
        background: 'rgba(255,255,255,0.06)',
        opacity: 1 - outline,
      }}
    />
    {children}
  </div>
);

// ─────────────────────────────────────────────── 母题：对话流色块行（本集新增）

/**
 * Chip —— 对话内容的色块行：全部对话平铺在桌上的最小单位。
 * 色彩契约：用户句 dim / 模型句 text / 工具输出 mech / 任务单·视野内容 view。
 * （任务单 storyboard 原文写 core 描边；本集 core 收敛为环/循环锚专用，
 * 「进它视野的东西」一律 view——与 planning.md §三的深层轴一致。）
 */
export const Chip: React.FC<{
  kind: 'user' | 'model' | 'tool' | 'task' | 'summary';
  label: string;
  width: number;
  height?: number;
  style?: React.CSSProperties;
}> = ({kind, label, width, height = 30, style}) => {
  const conf = {
    user: {bg: theme.panel, bd: theme.panelBorder, fg: theme.dim},
    model: {bg: theme.panel, bd: theme.panelBorder, fg: theme.text},
    tool: {bg: theme.mechDeep, bd: `${theme.mech}66`, fg: theme.mech},
    task: {bg: theme.panel, bd: theme.view, fg: theme.view},
    summary: {bg: theme.viewDeep, bd: theme.view, fg: theme.view},
  }[kind];
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 7,
        background: conf.bg,
        border: `2px solid ${conf.bd}`,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 8,
        boxSizing: 'border-box',
        fontFamily: theme.mono,
        fontSize: 19,
        color: conf.fg,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        ...style,
      }}
    >
      {label}
    </div>
  );
};

// ─────────────────────────────────────────────── 母题：印章（本集新增）

/**
 * Stamp —— 印章：spring 落下（过冲）+ 涟漪扩散 + 轻微旋转。
 * 用途：催更提醒（1-D）/ SAVE（2-E）/ cache hit（3-E）/ 停（4-E）/ 职责（5-A）。
 * 调用方以 style 定位（须在 position:relative 容器内）。
 */
export const Stamp: React.FC<{
  text: string;
  color: string;
  at: number;
  size?: number;
  rotate?: number;
  fontSize?: number;
  style?: React.CSSProperties;
}> = ({text, color, at, size = 120, rotate = -12, fontSize, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < at) return null;
  const drop = spring({frame: frame - at, fps, config: {damping: 12}});
  const rippleT = interpolate(frame - at, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rippleO = frame - at < 20 ? 1 - rippleT : 0;
  const fs = fontSize ?? size * (text.length > 3 ? 0.22 : 0.3);
  return (
    <div style={{position: 'relative', width: size, height: size, ...style}}>
      {rippleO > 0 ? (
        <div
          style={{
            position: 'absolute',
            inset: -6 - 20 * rippleT,
            border: `3px solid ${color}`,
            borderRadius: 999,
            opacity: rippleO * 0.7,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 999,
          border: `4px solid ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.serif,
          fontWeight: 700,
          fontSize: fs,
          color,
          background: `${color}14`,
          opacity: 0.5 + 0.5 * drop,
          transform: `rotate(${rotate * drop}deg) scale(${1.9 - 0.9 * drop})`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export {ease};
