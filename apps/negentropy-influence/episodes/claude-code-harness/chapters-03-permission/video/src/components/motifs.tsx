/** chrome 层组件种子（seeded 档——scaffold 复制后完全自由，无门，随集演进）。
 *
 *  本文件从《拆开 Claude Code》集（claude-code-explained，已退役 2026-11）的 motifs.tsx
 *  抽出**通用排版/标注机械**，只读底座 token（panel/panelBorder/text/dim +
 *  字体三族）；概念色一律经 `accent` prop 由调用方注入。任何集的 theme.ts
 *  底座都齐，故 scaffold 后无需改动即可 tsc 通过。随集演进时直接改本集副本
 *  （复制适配、不做跨集 import——复用边界见 references/PIPELINE.md §四）。
 *
 *  刻意**不进模板**的是创作性母题（Terminal / LoopRing / DispatchTable /
 *  GateRouter / SlotRing）：它们承载各集的叙事隐喻，属于每集的创作产物。
 *  需要时从仍持有完整母题目录的分集副本复制对应段落后裁剪、追加到本文件
 *  （如 claude-code-memory 的 motifs.tsx；母题持有者随各集重制迁移，
 *  以 references/08 母题表的出处列为准）。
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

/** 底部角标——统一压在 bottom ≥ 150（避让字幕条，references/08 红线二） */
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

export {ease};

// ─────────────────────────────────────────────── 创作性母题（复制适配，
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop（2026-10-31 拷入本仓）、
// 经 ep2 chapters-02-tooluse 延续——LoopRing 描边色/线宽跨集恒定（theme.core =
// 陶土橙 #D97757 + RING_STROKE 6）= 逐字节拷贝的前提；Terminal 承终端窗）

export type TermLine = {text: string; color?: string; delay: number; prompt?: string};

/** 终端窗口 + 逐字打字机。cps = 每秒字数（帧驱动，可复现） */
export const Terminal: React.FC<{
  lines: TermLine[];
  width?: number;
  height?: number;
  cps?: number;
  /** 打完后光标是否停闪并变灰 */
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

// ─────────────────────────────────────────────── 母题：环形循环（恒定锚 M-001）

export type RingNode = {label: string; angle: number};

/** 环上节点的默认四站（12 点起顺时针）——本系列五站走 `nodes` prop 覆写 */
export const RING_NODES: RingNode[] = [
  {label: '问模型', angle: -90},
  {label: '看回答', angle: 0},
  {label: '执行工具', angle: 90},
  {label: '填回结果', angle: 180},
];

export const RING_STROKE = 6;

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

/**
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）。
 * - `draw` 0→1 描线进度；`dotProgress` 光点沿环位置（0–1，undefined 则不显示）
 * - `activeNode` 高亮某节点（mech 脉冲）；`exitPull` 光点滑出到「停机」出口的比例
 * - `nodes` 覆写站点集（本系列五步：5 节点 72° 均布由调用方传入）
 * - `nodeLabels` 覆写节点文案（翻牌用）
 */
export const LoopRing: React.FC<{
  size?: number;
  draw?: number;
  dotProgress?: number;
  activeNode?: number;
  exitPull?: number;
  dimNodes?: boolean;
  nodes?: RingNode[];
  nodeLabels?: string[];
  showExit?: boolean;
  /** 节点文案。size < 260 时必须关掉——两侧标签会在小尺寸下互相压字 */
  showLabels?: boolean;
}> = ({
  size = 460,
  draw = 1,
  dotProgress,
  activeNode,
  exitPull = 0,
  dimNodes = false,
  nodes,
  nodeLabels,
  showExit = true,
  showLabels,
}) => {
  const stationNodes = nodes ?? RING_NODES;
  const labelsOn = showLabels ?? size >= 260;
  const frame = useCurrentFrame();
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 46;
  const pulse = 0.55 + 0.45 * Math.sin(frame / 5);

  const dot = dotProgress === undefined ? null : polar(cx, cy, r, -90 + dotProgress * 360);
  const exitX = dot ? dot.x + exitPull * (size - cx + 90) : 0;
  const exitY = dot ? dot.y + exitPull * -18 : 0;

  return (
    <svg width={size} height={size} style={{overflow: 'visible'}}>
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
      {stationNodes.map((n, i) => {
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

/** 本系列五站（承 ep1 五步同构：进消息→调模型→存档·查→执行→回喂，-90 每 +72°）。
 *  「执行」= 站位 3（126°）——本集环上高亮段的锚。 */
export const LOOP_STATIONS: RingNode[] = [
  {label: '进消息', angle: -90},
  {label: '调模型', angle: -18},
  {label: '存档·查', angle: 54},
  {label: '执行', angle: 126},
  {label: '回喂', angle: 198},
];

/** 环体「执行」段弧角域（站位「执行」两侧中点 90°..162°）——本集 M-001 变奏锚 */
export const EXEC_ARC = {a0: 90, a1: 162} as const;

/** 执行段弧 path（d 值；p 由调用方接 pathLength 归一化描线） */
export const execArcPath = (cx: number, cy: number, r: number): string => {
  const a0 = polar(cx, cy, r, EXEC_ARC.a0);
  const a1 = polar(cx, cy, r, EXEC_ARC.a1);
  return `M ${a0.x.toFixed(1)} ${a0.y.toFixed(1)} A ${r} ${r} 0 0 1 ${a1.x.toFixed(1)} ${a1.y.toFixed(1)}`;
};

// ─────────────────────────────────────────────── 跨幕小件（ep3 Permission）

/** 决策脑图标（只归模型侧——执行侧绝无此件，Visual Lock；0-C/1-A/2-D/5-B） */
export const BrainGlyph: React.FC<{color?: string; s?: number}> = ({color, s = 1}) => (
  <svg width={64 * s} height={52 * s} viewBox="-32 -26 64 52" style={{overflow: 'visible'}}>
    <g stroke={color ?? theme.text} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-20 6 Q-27 -4 -18 -11 Q-17 -21 -5 -22 Q6 -23 10 -16 Q21 -14 21 -4 Q21 6 12 9 Q-4 15 -20 6 Z" />
      <path d="M0 -22 Q-3 -8 0 10" />
      <path d="M-12 -6 Q-7 -3 -10 4" />
      <path d="M11 -5 Q7 -1 9 5" />
    </g>
  </svg>
);

/** 代码之手（0-A/5-B 首尾同款拦截面——陶土橙 core 描边；press 0..1 拍下行程）。
 *  机械简笔：掌 + 四指 + 拇指（ep2 PalmHand 同构几何，描边色 = 系列环体橙）。 */
const HAND_FINGERS = [
  {x: -175, len: 185},
  {x: -75, len: 215},
  {x: 25, len: 190},
  {x: 125, len: 140},
] as const;

export const CodeHand: React.FC<{
  cx: number;
  cy: number;
  press?: number;
  opacity?: number;
  scale?: number;
}> = ({cx, cy, press = 0, opacity = 1, scale = 1}) => {
  const down = press * 64;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, opacity, pointerEvents: 'none'}}>
      <svg
        width={620}
        height={420}
        viewBox="-310 -170 620 420"
        style={{
          position: 'absolute',
          left: cx - 310,
          top: cy - 170,
          overflow: 'visible',
          transform: `translateY(${down}px) scale(${scale})`,
          transformOrigin: `${cx}px ${cy}px`,
        }}
      >
        <g transform={`translate(0 ${down * -0.25})`}>
          {/* 掌：圆角矩形描边（core 陶土橙——与环体同源的「代码之手」） */}
          <rect x={-240} y={-70} width={480} height={190} rx={40} fill={theme.bg} stroke={theme.core} strokeWidth={5} />
          {/* 四指：圆角竖条（拍下时指尖微屈——len 收一点） */}
          {HAND_FINGERS.map((f) => (
            <rect
              key={f.x}
              x={f.x - 23}
              y={-70 - f.len + press * 10}
              width={46}
              height={f.len + 44}
              rx={23}
              fill={theme.bg}
              stroke={theme.core}
              strokeWidth={5}
            />
          ))}
          {/* 拇指：左倾圆角条 */}
          <g transform={`translate(${-258} ${-16}) rotate(36)`}>
            <rect x={-25} y={-155} width={50} height={170} rx={25} fill={theme.bg} stroke={theme.core} strokeWidth={5} />
          </g>
        </g>
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep3 Permission）
// storyboard 实现映射登记：GateCard / GateChain / CallCard / DenyListTable /
// RuleLane / AskTerminal / SwitchPanel / VoteBoard / VerdictPanel / TribunalChain。
// 全片主装置 = 闸门链（三闸卡列队反复出场逐幕生长），跨幕身份恒常：闸卡轮廓、
// 裁决紫描边、三卡排布缩微前后不重绘（scale 整体变换，非重画）。
// 哑装置原则：动效参数（进度/状态）一律经 prop 由调用场景注入（progress/spring
// 归场景层持有），本段零 motion hooks——「怎么动」归场景，「画什么」归此处。

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 闸卡三 kind 的衬色/符号（口播次序：硬拒绝→规则→问人） */
const GATE_KIND_META = {
  deny: {zh: '硬拒绝', sub: 'DENY_LIST', stroke: theme.mech},
  rule: {zh: '规则', sub: 'PERMISSION_RULES', stroke: theme.edge},
  ask: {zh: '问人', sub: 'ASK', stroke: theme.mech},
} as const;

/**
 * 闸卡（本集主装置原子件）。拱形门 + kind 三态：
 * - deny 硬拒绝：裁决紫实心衬底（`${mech}2E`）+ ✕ 芯
 * - rule 规则：边界蓝衬底（`${edge}1E`）+ 关键词小格
 * - ask 问人：裁决紫描边问号门（无衬底）+ ? 芯
 * - `lit` 0..1 描线+显形；`ghost` 0..1 灰化空心（名存实亡/拆除态——描边转
 *   panelBorder、衬底清空，结构轮廓保留 = 身份线索不断〔QA-3〕）
 * - `hitFlash` 0..1 警示红描边脉冲（命中/否决方向动作一拍）
 * - `passMark` 0..1 绿边过痕（过关证据，门柱内侧小方点）
 */
export const GateCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  kind?: 'deny' | 'rule' | 'ask';
  lit?: number;
  ghost?: number;
  hitFlash?: number;
  passMark?: number;
  showName?: boolean;
}> = ({x, y, w = 170, h = 160, kind = 'deny', lit = 1, ghost = 0, hitFlash = 0, passMark = 0, showName = true}) => {
  const meta = GATE_KIND_META[kind];
  const stroke = ghost > 0.5 ? theme.panelBorder : meta.stroke;
  const litP = clamp01(lit);
  const arcTop = 26;
  const doorPath = `M 8 ${h - 8} L 8 ${arcTop + 16} Q 8 8 ${w / 2} ${arcTop - 16} Q ${w - 8} 8 ${w - 8} ${arcTop + 16} L ${w - 8} ${h - 8}`;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: 1 - 0.55 * ghost}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <path
          d={doorPath}
          fill={
            ghost > 0.5
              ? 'transparent'
              : kind === 'deny'
                ? withAlpha(theme.mech, 0.18 * litP)
                : kind === 'rule'
                  ? withAlpha(theme.edge, 0.12 * litP)
                  : 'transparent'
          }
          stroke={stroke}
          strokeWidth={3.5}
          opacity={0.3 + 0.7 * litP}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - litP}
        />
        {/* 灰化空心态：门内加一枚虚线内轮廓（结构在、权限空） */}
        {ghost > 0.5 ? (
          <path
            d={doorPath}
            fill="none"
            stroke={theme.panelBorder}
            strokeWidth={2}
            strokeDasharray="6 7"
            opacity={0.8 * ghost}
            transform={`translate(${w / 2} ${h / 2}) scale(0.78) translate(${-w / 2} ${-h / 2})`}
          />
        ) : null}
        {/* 命中/否决方向动作：警示红描边脉冲一拍（G1 定色——方向动作红） */}
        {hitFlash > 0.01 ? (
          <path d={doorPath} fill="none" stroke={theme.danger} strokeWidth={5} opacity={hitFlash} />
        ) : null}
        {/* 绿边过痕（过关证据） */}
        {passMark > 0.5 ? <rect x={w - 15} y={h - 28} width={11} height={11} rx={2} fill={theme.ok} opacity={0.9} /> : null}
      </svg>
      {/* 门芯符号（kind 语义）+ 名牌 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: h / 2 - 30,
          textAlign: 'center',
          opacity: litP * (1 - 0.5 * ghost),
        }}
      >
        {kind === 'ask' ? (
          <span style={{fontFamily: theme.serif, fontSize: 46, fontWeight: 700, color: ghost > 0.5 ? theme.dim : meta.stroke}}>
            ?
          </span>
        ) : kind === 'deny' ? (
          <svg width={44} height={30} viewBox="0 0 44 30" style={{overflow: 'visible'}}>
            {/* 硬拒绝芯：实心方块断路（拦截语义——非「已拦截标记」，是门本体） */}
            <rect x={14} y={7} width={16} height={16} rx={3} fill={ghost > 0.5 ? theme.dim : meta.stroke} />
            <line x1={4} y1={15} x2={10} y2={15} stroke={ghost > 0.5 ? theme.dim : meta.stroke} strokeWidth={3.5} strokeLinecap="round" />
            <line x1={34} y1={15} x2={40} y2={15} stroke={ghost > 0.5 ? theme.dim : meta.stroke} strokeWidth={3.5} strokeLinecap="round" />
          </svg>
        ) : (
          <svg width={52} height={30} viewBox="0 0 52 30" style={{overflow: 'visible'}}>
            {/* 规则芯：两枚关键词小格（检测语义） */}
            <rect x={6} y={8} width={18} height={13} rx={3} fill="none" stroke={ghost > 0.5 ? theme.dim : meta.stroke} strokeWidth={2.5} />
            <rect x={28} y={8} width={18} height={13} rx={3} fill="none" stroke={ghost > 0.5 ? theme.dim : meta.stroke} strokeWidth={2.5} />
          </svg>
        )}
        {showName ? (
          <>
            <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: ghost > 0.5 ? theme.dim : theme.text, marginTop: 4}}>
              {meta.zh}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 2}}>{meta.sub}</div>
          </>
        ) : null}
      </div>
    </div>
  );
};

/**
 * 闸门链（三卡列队串联——全片主装置）。跨幕身份恒常：三卡排布 + 裁决紫主调，
 * 缩微前后不重绘（外层 scale）。`spread` 0..1 列队展开度（1-A morph 分裂用：
 * 0 = 三卡聚拢读作一枚，1 = 列队展开）；`connect` 0..1 卡间串联线；`dim` 整体
 * 压暗（缩微驻位 ≥0.35——QA-3 断 morph 身份线索即违）。
 */
export const GateChain: React.FC<{
  x: number;
  y: number;
  cardW?: number;
  cardH?: number;
  spacing?: number;
  spread?: number;
  connect?: number;
  lit?: readonly number[];
  ghost?: readonly number[];
  hit?: readonly number[];
  pass?: readonly number[];
  showNames?: boolean;
  dim?: number;
  scale?: number;
}> = ({
  x,
  y,
  cardW = 170,
  cardH = 160,
  spacing = 212,
  spread = 1,
  connect = 1,
  lit = [1, 1, 1],
  ghost = [0, 0, 0],
  hit = [0, 0, 0],
  pass = [0, 0, 0],
  showNames = true,
  dim = 0,
  scale = 1,
}) => {
  const kinds: ('deny' | 'rule' | 'ask')[] = ['deny', 'rule', 'ask'];
  const chainW = spacing * 2 + cardW;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: chainW,
        height: cardH,
        // ⑨ QA RISKY-1：撤聚拢压暗（原 (1-0.72*(1-spread)) 把聚拢单卡压到 0.28
        // 近隐——morph 位移期主体不可见即身份线索断裂）；容器透明度只由 dim 承载
        opacity: 1 - dim,
        transform: `scale(${scale})`,
        transformOrigin: 'left top',
      }}
    >
      {/* 卡间串联线（列队语义；spread 未展开时隐去） */}
      {connect > 0.01 && spread > 0.6
        ? [0, 1].map((i) => (
            <svg
              key={i}
              width={spacing - cardW}
              height={8}
              style={{position: 'absolute', left: cardW + i * spacing, top: cardH / 2 - 4, overflow: 'visible'}}
            >
              <line
                x1={2}
                y1={4}
                x2={spacing - cardW - 2}
                y2={4}
                stroke={theme.mech}
                strokeWidth={3}
                opacity={0.55 * connect}
                strokeDasharray="7 6"
              />
            </svg>
          ))
        : null}
      {kinds.map((k, i) => {
        const off = (i - 1) * spacing * clamp01(spread);
        // ⑨ QA RISKY-1：sideFade 偏置 i=0——聚拢态（spread<0.25）唯一可见主卡 =
        // deny（裁决紫），morph 身份线索「裁决紫描边」全程成立（原 i===1 偏置
        // 让聚拢可见卡是 rule 边界蓝——身份色漂移，盲读判「新主体」）；rule/ask
        // 两卡随展开渐次显形，展开完成（spread→1）三卡全可见
        const sideFade = i === 0 ? 1 : clamp01((spread - (i === 1 ? 0.25 : 0.55)) / 0.3);
        return (
          <div key={k} style={{position: 'absolute', left: off, top: 0, opacity: sideFade}}>
            <GateCard
              x={0}
              y={0}
              w={cardW}
              h={cardH}
              kind={k}
              lit={lit[i]}
              ghost={ghost[i]}
              hitFlash={hit[i]}
              passMark={pass[i]}
              showName={showNames}
            />
          </div>
        );
      })}
    </div>
  );
};

/**
 * 调用卡（走查主角——`rm old-notes.txt` 角标同签贯穿 P2 全程、sudo 卡 2-E→3-A
 * 同签名回归）。`marked` 0..1「潜在破坏性」警示红标贴上卡角（弹入由调用方
 * spring 驱动）；`tag` 任务签（「旧笔记」）；`accent` 描边（默认 tool 青碧 =
 * 调用语义；sudo 危险卡传 danger——同签名=同形同描边）。
 */
export const CallCard: React.FC<{
  x: number;
  y: number;
  en?: string;
  w?: number;
  h?: number;
  accent?: string;
  tag?: string;
  tagShow?: number;
  marked?: number;
  stampMark?: number;
  landed?: number;
}> = ({x, y, en = 'rm old-notes.txt', w = 330, h = 86, accent, tag, tagShow = 0, marked = 0, stampMark = 0, landed = 0}) => {
  const color = accent ?? theme.tool;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        boxSizing: 'border-box',
        borderRadius: 11,
        border: `2.5px solid ${color}`,
        background: withAlpha(color, 0.12 + 0.1 * landed),
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 18px',
      }}
    >
      <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.text, whiteSpace: 'nowrap'}}>{en}</span>
      {/* 任务签（删掉一份旧笔记——同签可追） */}
      {tag && tagShow > 0.01 ? (
        <span
          style={{
            fontFamily: theme.sans,
            fontSize: 18,
            fontWeight: 600,
            color: theme.dim,
            border: `2px solid ${withAlpha(theme.dim, 0.6)}`,
            borderRadius: 6,
            padding: '1px 9px',
            whiteSpace: 'nowrap',
            opacity: tagShow,
          }}
        >
          {tag}
        </span>
      ) : null}
      {/* 命中打标流转标记（交第三道——mono 小签） */}
      {stampMark > 0.01 ? (
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.edge,
            border: `2px solid ${theme.edge}`,
            borderRadius: 6,
            padding: '1px 8px',
            whiteSpace: 'nowrap',
            opacity: stampMark,
          }}
        >
          {'→ ask'}
        </span>
      ) : null}
      {/* 「潜在破坏性」警示红标（2-B 命中后贴上卡角，全程随卡） */}
      {marked > 0.01 ? (
        <span
          style={{
            position: 'absolute',
            right: -18,
            top: -26,
            fontFamily: theme.sans,
            fontSize: 18,
            fontWeight: 700,
            color: theme.danger,
            background: theme.bg,
            border: `2px solid ${theme.danger}`,
            borderRadius: 7,
            padding: '2px 10px',
            whiteSpace: 'nowrap',
            opacity: clamp01(marked),
            transform: `scale(${0.85 + 0.15 * clamp01(marked)}) rotate(-6deg)`,
          }}
        >
          {'潜在破坏性'}
        </span>
      ) : null}
      {/* 落地帧（3-A/3-C 警示红落地——命令已成事实） */}
      {landed > 0.5 ? (
        <span
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            height: 4,
            background: theme.danger,
            opacity: 0.85,
          }}
        />
      ) : null}
    </div>
  );
};

/** 黑名单七行（1-B 表体常量：行内容=命令字面，zh=口播白话对位小签） */
export const DENY_ROWS = [
  {cmd: 'rm -rf /', zh: '删根目录'},
  {cmd: 'sudo', zh: '借管理员身份'},
  {cmd: 'shutdown', zh: '关机'},
  {cmd: 'reboot', zh: '重启'},
  {cmd: 'mkfs', zh: '格式化'},
  {cmd: 'dd if=', zh: '整盘复制'},
  {cmd: '> /dev/sda', zh: '直写磁盘底层'},
] as const;

/**
 * 黑名单表（DENY_LIST·警示红描边七行表）。`litRows` 各行点亮（次序=口播白话
 * 次序）；`scan` 0..1 扫描线自上而下；`hitRow` 命中行（sudo）高亮沿；`count`
 * 0..7 计数角标；`dim` 整体压暗（缩微驻位 ≥0.35）。
 */
export const DenyListTable: React.FC<{
  x: number;
  y: number;
  scale?: number;
  litRows?: readonly number[];
  scan?: number;
  hitRow?: number;
  hitFlash?: number;
  count?: number;
  dim?: number;
  width?: number;
}> = ({x, y, scale = 1, litRows = [0, 0, 0, 0, 0, 0, 0], scan = 0, hitRow = -1, hitFlash = 0, count = 7, dim = 0, width = 640}) => {
  const HEAD = 54;
  const RH = 52;
  const GAP = 8;
  const H = HEAD + 7 * RH + 6 * GAP + 20;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        opacity: 1 - dim,
        transform: `scale(${scale})`,
        transformOrigin: 'left top',
      }}
    >
      <Panel accent={theme.danger} style={{width: '100%', boxSizing: 'border-box', padding: 0, position: 'relative'}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: HEAD,
            padding: '0 22px',
            borderBottom: `2px solid ${withAlpha(theme.danger, 0.4)}`,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.danger, letterSpacing: 1}}>{'DENY_LIST'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, fontVariantNumeric: 'tabular-nums'}}>
            {`${Math.round(count)} / 7 条`}
          </span>
        </div>
        <div style={{padding: 10, position: 'relative'}}>
          {DENY_ROWS.map((r, i) => {
            const lit = clamp01(litRows[i]);
            const isHit = i === hitRow;
            return (
              <div
                key={r.cmd}
                style={{
                  position: 'relative',
                  height: RH,
                  marginTop: i === 0 ? 0 : GAP,
                  borderRadius: 7,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '0 16px',
                  border: `2px solid ${isHit ? theme.danger : 'transparent'}`,
                  background: lit > 0.5 ? withAlpha(theme.danger, 0.14) : isHit ? withAlpha(theme.danger, 0.08 * hitFlash) : 'transparent',
                  opacity: 0.5 + 0.5 * Math.max(lit, isHit ? hitFlash : 0),
                }}
              >
                <span style={{fontFamily: theme.mono, fontSize: 23, color: lit > 0.5 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>
                  {r.cmd}
                </span>
                {/* 口播白话对位小签（口播白话、画面命令字面一一对位；点亮才显） */}
                <span
                  style={{
                    fontFamily: theme.sans,
                    fontSize: 18,
                    color: theme.dim,
                    marginLeft: 'auto',
                    whiteSpace: 'nowrap',
                    opacity: lit,
                  }}
                >
                  {r.zh}
                </span>
                {/* 行命中高亮沿（sudo 撞行） */}
                {isHit && hitFlash > 0.01 ? (
                  <span
                    style={{
                      position: 'absolute',
                      inset: -3,
                      borderRadius: 9,
                      border: `2.5px solid ${theme.danger}`,
                      opacity: hitFlash,
                      pointerEvents: 'none',
                    }}
                  />
                ) : null}
              </div>
            );
          })}
          {/* 扫描线（自上而下逐行扫过——横线 + 上侧 18px 渐变拖尾） */}
          {scan > 0.001 && scan < 0.999 ? (
            <div
              style={{
                position: 'absolute',
                left: 6,
                right: 6,
                top: 10 + (H - HEAD - 20 - 6) * scan,
                height: 3,
                background: theme.text,
                opacity: 0.9,
                boxShadow: `0 -14px 18px -6px ${withAlpha(theme.text, 0.45)}`,
              }}
            />
          ) : null}
        </div>
      </Panel>
    </div>
  );
};

/**
 * 规则双通道（第二道门内部）：上通道文件工具·路径越界检测框（边界蓝虚线框 +
 * 框内绿沿=界内）；下通道 bash·三关键词标签（待点亮）。`bounce` 0..1 越出签
 * 撞框弹回行程（段1 进逼 0..0.5、段2 弹回 0.5..1 由调用方折算）；`tagLit`
 * 三标签点亮；`flow` 流转线（命中交第三道）。
 */
export const RuleLane: React.FC<{
  x: number;
  y: number;
  w?: number;
  lit?: number;
  boxLit?: number;
  greenEdge?: number;
  bounce?: number;
  tagsShow?: number;
  tagLit?: readonly number[];
  flow?: number;
}> = ({x, y, w = 880, lit = 1, boxLit = 0, greenEdge = 0, bounce = 0, tagsShow = 0, tagLit = [0, 0, 0], flow = 0}) => {
  const TAGS = ['rm', '> /etc/', 'chmod 777'];
  const cardH = 300;
  // 越出签行程：进逼（0..0.5）撞框右缘 → 弹回（0.5..1）退向框外右下
  const inbound = Math.min(1, bounce * 2);
  const rebound = clamp01(bounce * 2 - 1);
  const signX = 700 + (452 - 700) * inbound + 120 * rebound;
  const signY = 60 + 26 * rebound;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: cardH,
        opacity: lit,
      }}
    >
      <Panel accent={theme.edge} style={{width: '100%', height: '100%', boxSizing: 'border-box', padding: '20px 26px'}}>
        {/* 上通道：文件工具 · 路径越界检测 */}
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.edge}}>{'文件工具 · file'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim}}>{'查路径越界'}</span>
        </div>
        <div style={{position: 'relative', width: 620, height: 92, marginTop: 10}}>
          {/* 越界检测框（边界蓝虚线；点亮收拢 draw） */}
          <svg width={620} height={92} style={{position: 'absolute', inset: 0}}>
            <rect
              x={3}
              y={3}
              width={452}
              height={86}
              rx={14}
              fill={withAlpha(theme.edge, 0.06 * boxLit)}
              stroke={theme.edge}
              strokeWidth={3}
              strokeDasharray="14 11"
              opacity={0.35 + 0.65 * boxLit}
              pathLength={1}
              strokeDashoffset={1 - boxLit}
            />
          </svg>
          {/* 框内路径（工作目录内——绿沿=界内语义；唯一确认绿元素之一） */}
          <div style={{position: 'absolute', left: 26, top: 30, display: 'flex', alignItems: 'center', gap: 12, opacity: boxLit}}>
            <span style={{fontFamily: theme.mono, fontSize: 21, color: theme.text}}>{'./docs/plan.md'}</span>
            <span
              style={{
                width: 64,
                height: 5,
                borderRadius: 3,
                background: theme.ok,
                opacity: greenEdge,
              }}
            />
          </div>
          {/* 框外「越出」路径小签（撞框弹回——永不入框内） */}
          <div style={{position: 'absolute', left: signX, top: signY, opacity: bounce > 0.01 ? 1 : 0}}>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 18,
                color: theme.danger,
                border: `2px solid ${withAlpha(theme.danger, 0.8)}`,
                borderRadius: 7,
                padding: '3px 10px',
                background: theme.bg,
                whiteSpace: 'nowrap',
              }}
            >
              {'../../etc/越出'}
            </span>
          </div>
        </div>
        {/* 下通道：bash · 关键词 */}
        <div style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 22}}>
          <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.edge}}>{'bash · 关键词'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim}}>{'查三类'}</span>
        </div>
        <div style={{display: 'flex', gap: 18, marginTop: 10, opacity: tagsShow}}>
          {TAGS.map((t, i) => {
            const on = clamp01(tagLit[i]);
            return (
              <div
                key={t}
                style={{
                  fontFamily: theme.mono,
                  fontSize: 21,
                  color: on > 0.5 ? theme.danger : theme.dim,
                  border: `2.5px solid ${on > 0.5 ? theme.danger : theme.panelBorder}`,
                  background: on > 0.5 ? withAlpha(theme.danger, 0.14) : 'transparent',
                  borderRadius: 9,
                  padding: '10px 18px',
                  whiteSpace: 'nowrap',
                  opacity: 0.5 + 0.5 * on,
                  boxShadow: on > 0.5 ? `0 0 ${14 * on}px ${withAlpha(theme.danger, 0.7)}` : 'none',
                }}
              >
                {t}
              </div>
            );
          })}
        </div>
        {/* 流转线（命中交第三道——底部 mech 虚线箭头） */}
        <svg width={w - 60} height={30} style={{marginTop: 16, overflow: 'visible', opacity: flow}}>
          <line x1={0} y1={15} x2={(w - 96) * flow} y2={15} stroke={theme.mech} strokeWidth={3} strokeDasharray="9 8" />
          {flow > 0.9 ? <path d={`M ${w - 104} 7 L ${w - 88} 15 L ${w - 104} 23 Z`} fill={theme.mech} /> : null}
        </svg>
      </Panel>
    </div>
  );
};

/**
 * 问人终端（裁决紫描边终端窗——第三道门）。`printP` 0..1 警示行打印进度（三段
 * 折算由调用方）；`cursorOn` 光标呼吸（帧驱动内联闪烁——哑装置零 hooks）；
 * `keysLit` 是/否双键虚影各闪；`still` 定格（2-C 暂停帧）。双键恒虚影等高，
 * 无回车确认态（表态是 2-D 事件——Visual Lock）。
 */
export const AskTerminal: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  scale?: number;
  printP?: number;
  keysLit?: readonly number[];
  still?: number;
  dim?: number;
}> = ({x, y, w = 760, h = 340, scale = 1, printP = 0, keysLit = [0, 0], still = 0, dim = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 光标呼吸：等输入的悬置感（2+3×still 周期呼吸；still→定格后仅低亮缓闪）
  const breathe = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 2 * (2.2 - 1.2 * still)));
  const lines = [
    {t: '⚠ 检测到删除命令: rm old-notes.txt', color: theme.danger, seg: [0, 0.4]},
    {t: '理由: 潜在破坏性 · 需要你的确认', color: theme.text, seg: [0.4, 0.75]},
  ];
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity: 1 - dim,
        transform: `scale(${scale})`,
        transformOrigin: 'left top',
      }}
    >
      <Panel accent={theme.mech} style={{width: w, height: h, padding: 0, overflow: 'hidden'}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 44,
            padding: '0 18px',
            borderBottom: `2px solid ${withAlpha(theme.mech, 0.45)}`,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} style={{width: 12, height: 12, borderRadius: 999, background: theme.panelBorder}} />
          ))}
          <div style={{marginLeft: 10, fontFamily: theme.mono, fontSize: 20, color: theme.mech}}>{'ask'}</div>
        </div>
        <div style={{padding: '22px 26px', fontFamily: theme.mono, fontSize: 24, lineHeight: 1.8}}>
          {lines.map((ln) => {
            const p = clamp01((printP - ln.seg[0]) / (ln.seg[1] - ln.seg[0]));
            const n = Math.round(ln.t.length * p);
            return (
              <div key={ln.t} style={{color: ln.color, whiteSpace: 'nowrap', opacity: p > 0 ? 1 : 0}}>
                {ln.t.slice(0, n)}
              </div>
            );
          })}
          {/* 输入行 + 光标呼吸（停下等一个字） */}
          <div style={{color: theme.text, whiteSpace: 'pre', opacity: printP > 0.75 ? 1 : 0}}>
            <span style={{color: theme.mech}}>{'❯ '}</span>
            <span style={{opacity: breathe, color: theme.mech}}>{'▍'}</span>
          </div>
          {/* 是/否双键虚影（等高；各闪一次——待击态，无回车） */}
          <div style={{display: 'flex', gap: 26, marginTop: 22, opacity: printP > 0.75 ? 1 : 0}}>
            {[
              {k: '是', s: 'Y', i: 0},
              {k: '否', s: 'N', i: 1},
            ].map((key) => {
              const on = clamp01(keysLit[key.i]);
              return (
                <div
                  key={key.k}
                  style={{
                    width: 150,
                    height: 58,
                    borderRadius: 10,
                    border: `2.5px dashed ${on > 0.4 ? theme.text : withAlpha(theme.dim, 0.55)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    opacity: 0.6 + 0.4 * on,
                    boxShadow: on > 0.4 ? `0 0 ${16 * on}px ${withAlpha(theme.text, 0.5)}` : 'none',
                  }}
                >
                  <span style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 700, color: theme.text}}>{key.k}</span>
                  <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{key.s}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
    </div>
  );
};

/**
 * 实验 3 开关面板（「放行 > 硬拒绝」拨杆）。`lit` 面板亮起；`closed` 拨杆自
 * deny 位拨向 allow 位（0..1）；`wireRed` 接线自裁决紫转警示红（权限改写
 * 进度）；`punch` 开关闭合弹一下。
 */
export const SwitchPanel: React.FC<{x: number; y: number; lit?: number; closed?: number; wireRed?: number; punch?: number}> = ({
  x,
  y,
  lit = 0,
  closed = 0,
  wireRed = 0,
  punch = 0,
}) => {
  const knobX = 20 + 120 * clamp01(closed);
  const wireColor = wireRed > 0.5 ? theme.danger : theme.mech;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 420, height: 190, opacity: lit}}>
      <Panel style={{width: '100%', height: '100%', boxSizing: 'border-box', padding: '20px 24px'}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
          <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.text}}>{'allow > deny'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim}}>{'放行压过硬拒绝'}</span>
        </div>
        {/* 拨杆槽（deny → allow） */}
        <svg width={372} height={74} viewBox="0 0 372 74" style={{marginTop: 16}}>
          <rect x={8} y={26} width={196} height={22} rx={11} fill="none" stroke={theme.panelBorder} strokeWidth={3} />
          <text x={16} y={18} fontFamily={theme.mono} fontSize={15} fill={theme.dim}>
            deny
          </text>
          <text x={172} y={18} fontFamily={theme.mono} fontSize={15} fill={theme.dim}>
            allow
          </text>
          {/* 滑块（闭合拨到 allow 位；punch 落定弹一下） */}
          <g transform={`translate(${knobX + punch * 8} 0)`}>
            <circle cx={0} cy={37} r={16} fill={theme.bg} stroke={wireRed > 0.5 ? theme.danger : theme.mech} strokeWidth={4} />
            <circle cx={0} cy={37} r={5} fill={wireRed > 0.5 ? theme.danger : theme.mech} />
          </g>
          {/* 接线：自开关右侧出（颜色随 wireRed 紫→红改写） */}
          <path d={`M 224 37 C 268 37, 262 60, 306 60`} fill="none" stroke={wireColor} strokeWidth={3.5} strokeDasharray="8 7" />
          <path d="M 300 52 L 316 60 L 300 68 Z" fill={wireColor} />
        </svg>
      </Panel>
    </div>
  );
};

/**
 * 裁决不变式投票装置（主体裁决紫）。点头签（ok「允」）×5 与摇头签（danger
 * 「否」）×1 分列；计票器居间；「一票否决」章悬顶。`press` 摇头签沉压行程
 * （自上压过整排点头签——重者在下压〔X-001〕）；`kill` 点头签全灭；
 * `counterRetire` 计票器划掉退役；`stamp` 红章砸落行程（0..1，含落定定格）。
 */
export const VoteBoard: React.FC<{
  x: number;
  y: number;
  lit?: number;
  nods?: readonly number[];
  press?: number;
  kill?: number;
  counterRetire?: number;
  stamp?: number;
}> = ({x, y, lit = 0, nods = [0, 0, 0, 0, 0], press = 0, kill = 0, counterRetire = 0, stamp = 0}) => {
  const stampY = -160 + 400 * clamp01(stamp);
  const stampS = 1.25 - 0.25 * clamp01(stamp);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 900, height: 560, opacity: lit}}>
      {/* 点头签横排（确认绿「允」；kill 全灭 + 沉压下弯） */}
      <div style={{position: 'absolute', left: 120, top: 210, display: 'flex', gap: 26}}>
        {nods.map((n, i) => {
          const on = clamp01(n) * (1 - clamp01(kill));
          const sag = clamp01(press) * 14;
          return (
            <div
              key={i}
              style={{
                width: 74,
                height: 74,
                borderRadius: 999,
                border: `3px solid ${on > 0.4 ? theme.ok : theme.panelBorder}`,
                background: on > 0.4 ? withAlpha(theme.ok, 0.16) : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.sans,
                fontSize: 30,
                fontWeight: 700,
                color: on > 0.4 ? theme.ok : theme.dim,
                opacity: 0.45 + 0.55 * Math.max(on, 1 - clamp01(kill) * 0.0),
                transform: `translateY(${sag}px)`,
              }}
            >
              {'允'}
            </div>
          );
        })}
      </div>
      {/* 摇头签两枚（警示红「否」；一枚自上沉压） */}
      <div
        style={{
          position: 'absolute',
          left: 430,
          top: 40 + 170 * clamp01(press),
          width: 92,
          height: 92,
          borderRadius: 999,
          border: `4px solid ${theme.danger}`,
          background: withAlpha(theme.danger, 0.2),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: 38,
          fontWeight: 700,
          color: theme.danger,
          boxShadow: `0 ${10 * clamp01(press)}px ${26 * clamp01(press)}px ${withAlpha(theme.danger, 0.5)}`,
        }}
      >
        {'否'}
      </div>
      {/* 计票器（票数累加器——居间；「不是计票」划掉退役） */}
      <div
        style={{
          position: 'absolute',
          left: 330,
          top: 350,
          padding: '10px 22px',
          borderRadius: 10,
          border: `2.5px solid ${theme.mech}`,
          background: theme.panel,
          fontFamily: theme.mono,
          fontSize: 22,
          color: theme.text,
          opacity: 1 - 0.55 * clamp01(counterRetire),
        }}
      >
        <span style={{position: 'relative'}}>
          {/* ⑨ QA N2：5 : 1 与「一方摇头就拦下」对齐（摇头签一枚——上方压签即
              「一方」，不再有第二枚造成数字错位） */}
          {'计票 5 : 1'}
          <span
            style={{
              position: 'absolute',
              left: -6,
              right: -6,
              top: '52%',
              height: 4,
              background: theme.danger,
              transform: `scaleX(${clamp01(counterRetire)})`,
              transformOrigin: 'left center',
              borderRadius: 2,
            }}
          />
        </span>
      </div>
      {/* 「一票否决」章（警示红；悬顶砸落定格——否决方向动作=G1 定色） */}
      <div
        style={{
          position: 'absolute',
          left: 340,
          top: stampY,
          width: 220,
          height: 220,
          borderRadius: 999,
          border: `6px solid ${theme.danger}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${stampS}) rotate(-10deg)`,
          opacity: stamp > 0.02 ? 1 : 0,
          boxShadow: `0 0 ${34 * clamp01(stamp)}px ${withAlpha(theme.danger, 0.65)}`,
        }}
      >
        <div style={{transform: 'rotate(10deg)', textAlign: 'center'}}>
          <div style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.danger, letterSpacing: 6}}>一票</div>
          <div style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.danger, letterSpacing: 6}}>否决</div>
        </div>
      </div>
    </div>
  );
};

/**
 * 生产裁决面板（四格答案卡 + 右缘八层规则来源层叠）。`lit` 四格（allow/deny/
 * ask/passthrough）；`link` 第四格短接常规流细线；`stackLit` 0..8 八层展开
 * （stagger）；`press` 顶层「用户设置」下压、其下各层依次压暗一档。
 */
export const VerdictPanel: React.FC<{
  x: number;
  y: number;
  frameLit?: number;
  lit?: readonly number[];
  link?: number;
  stackLit?: number;
  press?: number;
}> = ({x, y, frameLit = 0, lit = [0, 0, 0, 0], link = 0, stackLit = 0, press = 0}) => {
  const CELLS = [
    {zh: '放行', en: 'allow', c: theme.ok},
    {zh: '拒绝', en: 'deny', c: theme.danger},
    {zh: '问人', en: 'ask', c: theme.mech},
    {zh: '不表态', en: 'passthrough', c: theme.dim},
  ];
  const LAYERS = ['用户设置', '来源 07', '来源 06', '来源 05', '来源 04', '来源 03', '来源 02', '来源 01'];
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 1500, height: 640, opacity: frameLit}}>
      {/* 四格答案卡横列（PermissionResult） */}
      <div style={{position: 'absolute', left: 60, top: 120, display: 'flex', gap: 30}}>
        {CELLS.map((c, i) => {
          const on = clamp01(lit[i]);
          return (
            <div
              key={c.en}
              style={{
                width: 218,
                height: 168,
                boxSizing: 'border-box',
                borderRadius: 14,
                border: `3px solid ${on > 0.4 ? c.c : theme.panelBorder}`,
                background: on > 0.4 ? withAlpha(c.c, 0.1) : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                opacity: 0.5 + 0.5 * on,
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: on > 0.4 ? theme.text : theme.dim}}>{c.zh}</span>
              <span style={{fontFamily: theme.mono, fontSize: 19, color: on > 0.4 ? c.c : theme.dim}}>{c.en}</span>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 60, top: 60, fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 1}}>
        {'PermissionResult · 裁决答案'}
      </div>
      {/* 第四格「不表态」短接常规流（细线——不表态≠放行的空间陈述；不接执行区） */}
      <svg width={1500} height={360} style={{position: 'absolute', left: 0, top: 250, overflow: 'visible', opacity: link}}>
        <path
          d="M 962 128 Q 1030 128, 1058 178 L 1058 216"
          fill="none"
          stroke={theme.dim}
          strokeWidth={2.5}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - clamp01(link)}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 990,
          top: 420,
          padding: '8px 18px',
          borderRadius: 9,
          border: `2px solid ${theme.panelBorder}`,
          fontFamily: theme.sans,
          fontSize: 21,
          color: theme.dim,
          opacity: link,
        }}
      >
        {'常规流程'}
      </div>
      {/* 右缘八层规则来源层叠（顶层「用户设置」；其余 dim 编号语言——反枚举） */}
      <div style={{position: 'absolute', left: 1170, top: 40}}>
        <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginBottom: 10}}>{'8 rule sources'}</div>
        {LAYERS.map((name, i) => {
          const on = clamp01(stackLit * 8 - (7 - i));
          const dimStep = clamp01(press) * (i * 0.13);
          const topPad = (7 - i) * 12;
          return (
            <div
              key={name}
              style={{
                position: 'absolute',
                right: 0,
                top: topPad,
                width: 300,
                height: 56,
                borderRadius: 10,
                border: `2.5px solid ${i === 7 ? theme.mech : theme.panelBorder}`,
                background: i === 7 ? withAlpha(theme.mech, 0.14) : theme.panel,
                display: 'flex',
                alignItems: 'center',
                padding: '0 18px',
                fontFamily: i === 7 ? theme.sans : theme.mono,
                fontSize: i === 7 ? 24 : 19,
                fontWeight: i === 7 ? 700 : 400,
                color: i === 7 ? theme.text : theme.dim,
                opacity: (0.4 + 0.6 * on) * (1 - dimStep),
                transform: `translateY(${i === 7 ? 4 * clamp01(press) : 0}px)`,
                zIndex: i,
              }}
            >
              {name}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 四级判案子链（「问人」环内部——装置最深层）。`open` 子链铺开；`step` 0..4
 * 调用过级（acceptEdits → 白名单 → 安全分类器 → 回退人工）；`trip` 第四级
 * 触发一拍；`verdict` 链末判决卡特写（理由栏空白+斜线划过——无强制解释）。
 * 子链闸卡与三道主闸卡同拱形语言、小一号（子链属问人环内部，非新主体）。
 */
export const TribunalChain: React.FC<{x: number; y: number; open?: number; step?: number; trip?: number; verdict?: number}> = ({
  x,
  y,
  open = 0,
  step = 0,
  trip = 0,
  verdict = 0,
}) => {
  const NODES = [
    {zh: '自动放行', en: 'acceptEdits'},
    {zh: '白名单', en: 'allowlist'},
    {zh: '安全分类器', en: 'classifier'},
    {zh: '回退人工', en: 'fallback'},
  ];
  const cl = (v: number) => clamp01(v);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 1500, height: 480, opacity: cl(open)}}>
      {/* 四级子链横列（mech 描边小闸卡；第四级 trip 触发加重） */}
      {NODES.map((n, i) => {
        const litN = cl(step - i);
        const isTrip = i === 3 && trip > 0.01;
        return (
          <div key={n.en} style={{position: 'absolute', left: 60 + i * 360, top: 60, width: 280}}>
            <div
              style={{
                width: 280,
                height: 130,
                boxSizing: 'border-box',
                borderRadius: '60px 60px 12px 12px',
                border: `3px solid ${isTrip ? theme.danger : litN > 0.4 ? theme.mech : theme.panelBorder}`,
                background: litN > 0.4 ? withAlpha(theme.mech, 0.12) : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: 0.45 + 0.55 * litN,
                boxShadow: isTrip ? `0 0 ${22 * trip}px ${withAlpha(theme.danger, 0.7)}` : 'none',
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: litN > 0.4 ? theme.text : theme.dim}}>{n.zh}</span>
              <span style={{fontFamily: theme.mono, fontSize: 16, color: litN > 0.4 ? theme.mech : theme.dim}}>{n.en}</span>
            </div>
            {/* 级间串联线（步进点亮） */}
            {i < 3 ? (
              <svg width={80} height={8} style={{position: 'absolute', left: 284, top: 61, overflow: 'visible'}}>
                <line
                  x1={2}
                  y1={4}
                  x2={78}
                  y2={4}
                  stroke={theme.mech}
                  strokeWidth={3}
                  opacity={0.25 + 0.6 * cl(step - i - 0.5)}
                  strokeDasharray="7 6"
                />
              </svg>
            ) : null}
          </div>
        );
      })}
      {/* 判决卡（链末：理由栏空白划斜线——「不写判决书」） */}
      <div
        style={{
          position: 'absolute',
          left: 430,
          top: 270,
          width: 640,
          opacity: cl(verdict),
        }}
      >
        <Panel style={{padding: '18px 26px', position: 'relative'}}>
          <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'verdict · 判决'}</div>
          <div
            style={{
              marginTop: 10,
              marginBottom: 4,
              fontFamily: theme.sans,
              fontSize: 22,
              color: theme.text,
              display: 'flex',
              alignItems: 'baseline',
              gap: 18,
            }}
          >
            <span>{'结论'}</span>
            <span style={{color: theme.mech}}>{'ask → 人工'}</span>
          </div>
          {/* 理由栏：恒空白（空白划斜线——理由没有强制解释） */}
          <div style={{position: 'relative', marginTop: 8, height: 54, borderRadius: 8, border: `2px dashed ${theme.panelBorder}`}}>
            <span style={{position: 'absolute', left: 12, top: 14, fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>
              {'理由'}
            </span>
            <span
              style={{
                position: 'absolute',
                left: 10,
                right: 10,
                top: '50%',
                height: 3.5,
                background: theme.dim,
                borderRadius: 2,
                transform: `scaleX(${cl(verdict)})`,
                transformOrigin: 'left center',
                opacity: 0.75,
              }}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
};
