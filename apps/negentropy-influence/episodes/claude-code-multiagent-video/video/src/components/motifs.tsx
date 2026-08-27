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

// ─────────────────────────────────────────────────────────── 本集创作母题
// 六母题（script/planning.md §三）：RingHerd / TaskBoard / Mailboxes /
// HandshakeRail / SeparateDesks / FullTurn。环形母题自系列首集
// claude-code-explained-video 的 motifs.tsx 复制裁剪——复用边界：不做跨集
// import（pipeline/README §四），本集副本自由演进。
//
// ★ LoopRing 双色不变量：strokeWidth 恒为 RING_STROKE（6 绝对像素，不随
//   size 缩放）；领队环恒 core、队友环恒 peer——**N 个队友绝不 N 色**，
//   靠铭牌与位置区分（反枚举最难考验）。节点文案恒
//   问模型 / 看回答 / 执行工具 / 填回结果；size < 260 时标签自动关闭
//   （0°/180° 两侧标签会在小尺寸下互相压字——系列首集实测教训）。

export const RING_STROKE = 6;

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

/** 帧驱动的 0→1 段进度（起 start、长 dur 帧，两端 clamp；dur 下限 1 防退化区间） */
export const phase = (frame: number, start: number, dur: number): number =>
  interpolate(frame - start, [0, Math.max(1, dur)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** 二次贝塞尔取点（消息飞行弧线 / 解锁波光点共用的轨迹数学） */
export const qBezier = (
  p0: {x: number; y: number},
  c: {x: number; y: number},
  p1: {x: number; y: number},
  t: number,
) => ({
  x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * c.x + t * t * p1.x,
  y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * c.y + t * t * p1.y,
});

/** 全片恒定的环形循环（本集双色：领队 core / 队友 peer，线宽与节点恒定） */
export const LoopRing: React.FC<{
  size?: number;
  draw?: number;
  dotProgress?: number;
  activeNode?: number;
  dimNodes?: boolean;
  /** 领队 core（默认）/ 队友 peer——双色不变量仅此一处开关 */
  tone?: 'core' | 'peer';
  showLabels?: boolean;
}> = ({
  size = 460,
  draw = 1,
  dotProgress,
  activeNode,
  dimNodes = false,
  tone = 'core',
  showLabels,
}) => {
  const labelsOn = showLabels ?? size >= 260;
  const frame = useCurrentFrame();
  const color = tone === 'peer' ? theme.peer : theme.core;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 46;
  const pulse = 0.55 + 0.45 * Math.sin(frame / 5);

  const dot =
    dotProgress === undefined ? null : polar(cx, cy, r, -90 + dotProgress * 360);

  return (
    <svg width={size} height={size} style={{overflow: 'visible'}}>
      {/* 环本体：pathLength 归一化描线（红线三：不与像素 dasharray 混用） */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
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
              stroke={on ? theme.mech : color}
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
                {n.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {dot ? <circle cx={dot.x} cy={dot.y} r={11} fill={color} /> : null}
    </svg>
  );
};

/** 环的匀速巡游进度（周期 secPerLap 秒），供各幕共用系列首集同一节律 */
export const useRingDot = (secPerLap = 2.5, offset = 0) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return ((frame - offset) / (fps * secPerLap)) % 1;
};

/** 铭牌（铭牌/标签牌）：N 个队友绝不 N 色的区分装置——peer 色边、mono 字 */
export const NamePlate: React.FC<{
  name: string;
  sub?: string;
  tone?: 'core' | 'peer' | 'mech';
  style?: React.CSSProperties;
}> = ({name, sub, tone = 'peer', style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const drop = spring({frame, fps, config: {damping: 200}});
  const color = tone === 'core' ? theme.core : tone === 'mech' ? theme.mech : theme.peer;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 8,
        padding: '5px 14px',
        background: theme.panel,
        border: `2px solid ${color}`,
        borderRadius: 8,
        fontFamily: theme.mono,
        fontSize: 22,
        color,
        opacity: drop,
        transform: `translateY(${(1 - drop) * -16}px)`,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {name}
      {sub ? (
        <span style={{fontSize: 17, color: theme.dim, fontFamily: theme.sans}}>{sub}</span>
      ) : null}
    </div>
  );
};

/** 队友：peer 环 + 下方铭牌（RingHerd 的成员单元；全部同色同宽同节点） */
export const Teammate: React.FC<{name: string; size?: number; dot?: boolean; dim?: boolean}> = ({
  name,
  size = 220,
  dot = true,
  dim = false,
}) => {
  const dotP = useRingDot(2.5);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
      <LoopRing
        size={size}
        draw={1}
        dotProgress={dot ? dotP : undefined}
        tone="peer"
        dimNodes={dim}
        showLabels={false}
      />
      <NamePlate name={name} />
    </div>
  );
};

export {ease};
