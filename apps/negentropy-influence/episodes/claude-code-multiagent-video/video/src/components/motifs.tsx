/** 本集视觉母题库（每集独有；复用边界见 pipeline/README.md §四——
 *  Remotion 原语复制适配、不做跨集共享包）。
 *
 *  五个母题，对应 script/storyboard.md 反复出现的画面语言：
 *    Terminal      终端窗口 + 打字机（P0 痛点、P2 命令拼接、P5 回照）
 *    LoopRing      环形循环 —— 全片恒定视觉锚（P1…P5 共五次出现）
 *    DispatchTable 字典分发表（P2 工具分发、P4 时机注册表）
 *    GateRouter    闸门路由（P3 三道闸门）
 *    SlotRing      插槽注册板（P4 四个插口挂在环外）
 *
 *  ★ LoopRing 的不变量：`stroke` 恒为 theme.core、`strokeWidth` 恒为绝对像素
 *  （不随 size 缩放）。「循环始终不变」这个主题靠它被**看见**而不是被听说，
 *  故任何调用点都不得覆写这两个值——只允许改 size / 位置 / 节点高亮。
 */
import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';

/** 环线宽（绝对像素，全片恒定，勿随 size 缩放） */
export const RING_STROKE = 6;

/** 缓入缓出：用于描线与推进，避免线性运动的机械感 */
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (1 - t) * (1 - t) * 2);

// ─────────────────────────────────────────────────────────── 通用容器

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

/** 幕标题条：左上角章号 + 标语（角标性质，不进口播） */
export const SceneTag: React.FC<{chapter: string; tagline: string}> = ({chapter, tagline}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [6, 24], [0, 1], {extrapolateRight: 'clamp'});
  // 右上：左上角让位给常驻 HarnessBadge（系列身份栈缩退位，harness-stack.tsx）
  return (
    <div style={{position: 'absolute', right: 72, top: 64, textAlign: 'right', opacity: o}}>
      <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.core, letterSpacing: 2}}>
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

// ─────────────────────────────────────────────────────────── 母题 1：终端

export type TermLine = {text: string; color?: string; delay: number; prompt?: string};

/** 终端窗口 + 逐字打字机。cps = 每秒字数（帧驱动，可复现） */
export const Terminal: React.FC<{
  lines: TermLine[];
  width?: number;
  height?: number;
  cps?: number;
  /** 打完后光标是否停闪并变灰（P0「它停在那儿了」的落点） */
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

// ─────────────────────────────────────────────────────────── 母题 2：环形循环

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
 * 全片恒定的环形循环。
 * - `draw` 0→1 描线进度；`dotProgress` 光点沿环位置（0–1，undefined 则不显示）
 * - `activeNode` 高亮某节点（石青脉冲）；`exitPull` 光点滑出到「停机」出口的比例
 * - `nodeLabels` 覆写节点文案（P5 执行节点翻牌用）
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

// ─────────────────────────────────────────────────────────── 母题 3：分发表

export type DispatchRow = {key: string; value: string};

/** 字典分发表：左键右值两列，命中行整行推入石青辉光 */
export const DispatchTable: React.FC<{
  rows: DispatchRow[];
  rowDelay?: number;
  /** 命中行下标（-1 不命中） */
  hit?: number;
  /** 末尾预留空槽（P2「多出一行空槽」） */
  emptySlot?: boolean;
  slotFilled?: boolean;
  width?: number;
  keyHeader?: string;
  valueHeader?: string;
}> = ({
  rows,
  rowDelay = 4,
  hit = -1,
  emptySlot = false,
  slotFilled = false,
  width = 720,
  keyHeader = '工具名',
  valueHeader = '处理函数',
}) => {
  const frame = useCurrentFrame();
  return (
    <Panel style={{width, padding: '18px 22px'}}>
      <div
        style={{
          display: 'flex',
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
          paddingBottom: 12,
          borderBottom: `2px solid ${theme.panelBorder}`,
        }}
      >
        <div style={{flex: 1}}>{keyHeader}</div>
        <div style={{flex: 1}}>{valueHeader}</div>
      </div>
      {rows.map((r, i) => {
        const on = frame >= i * rowDelay;
        const isHit = hit === i;
        return (
          <div
            key={r.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 54,
              opacity: on ? 1 : 0,
              background: isHit ? theme.mechDeep : 'transparent',
              boxShadow: isHit ? `inset 0 0 0 2px ${theme.mech}` : 'none',
              borderRadius: 8,
              paddingLeft: 8,
              fontFamily: theme.mono,
              fontSize: 27,
            }}
          >
            <div style={{flex: 1, color: isHit ? theme.mech : theme.text}}>{r.key}</div>
            <div style={{flex: 1, color: isHit ? theme.mech : theme.dim}}>{r.value}</div>
          </div>
        );
      })}
      {emptySlot ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 54,
            marginTop: 4,
            border: `2px dashed ${slotFilled ? theme.mech : theme.panelBorder}`,
            borderRadius: 8,
            paddingLeft: 8,
            fontFamily: theme.mono,
            fontSize: 27,
            color: theme.mech,
            opacity: slotFilled ? 1 : 0.6,
          }}
        >
          <div style={{flex: 1}}>{slotFilled ? 'new_tool' : ''}</div>
          <div style={{flex: 1}}>{slotFilled ? 'run_new' : ''}</div>
        </div>
      ) : null}
    </Panel>
  );
};

// ─────────────────────────────────────────────────────────── 母题 4：闸门路由

/** 三道竖闸 + 请求光点。gates: 每道闸的落下进度 0–1；verdict 决定光点走向 */
export const GateRouter: React.FC<{
  gates: number[];
  /** 请求推进进度 0–1（沿水平轴） */
  travel: number;
  /** 被第几道闸拦下（-1 = 全过） */
  blockedBy?: number;
  labels?: string[];
  width?: number;
  height?: number;
}> = ({gates, travel, blockedBy = -1, labels = ['拒绝表', '规则匹配', '问你'], width = 1120, height = 330}) => {
  const gateX = [0.3, 0.52, 0.74].map((f) => f * width);
  const stopX = blockedBy >= 0 ? gateX[blockedBy] - 26 : width - 40;
  const x = 60 + Math.min(travel, 1) * (stopX - 60);
  const bounced = blockedBy >= 0 && travel >= 1;
  const y = height / 2;
  const colorOf = (i: number) => (i === 0 ? theme.deny : theme.mech);
  return (
    <svg width={width} height={height} style={{overflow: 'visible'}}>
      <line x1={40} y1={y} x2={width - 20} y2={y} stroke={theme.panelBorder} strokeWidth={4} />
      {gateX.map((gx, i) => {
        const p = Math.max(0, Math.min(1, gates[i] ?? 0));
        const h = 118 * ease(p);
        return (
          <g key={i} opacity={p > 0 ? 1 : 0}>
            <rect
              x={gx - 9}
              y={y - h}
              width={18}
              height={h}
              rx={5}
              fill={i === 2 ? 'none' : colorOf(i)}
              stroke={colorOf(i)}
              strokeWidth={3}
              strokeDasharray={i === 2 ? '9 7' : undefined}
            />
            <text
              x={gx}
              y={y - h - 18}
              textAnchor="middle"
              fontFamily={theme.sans}
              fontSize={23}
              fontWeight={600}
              fill={colorOf(i)}
            >
              {labels[i]}
            </text>
            <text
              x={gx}
              y={y + 44}
              textAnchor="middle"
              fontFamily={theme.mono}
              fontSize={20}
              fill={theme.dim}
            >
              {i + 1}
            </text>
          </g>
        );
      })}
      <circle
        cx={bounced ? x - 34 : x}
        cy={y}
        r={13}
        fill={blockedBy === 0 ? theme.deny : theme.core}
        opacity={bounced && blockedBy === 0 ? 0.35 : 1}
      />
      {blockedBy < 0 && travel >= 1 ? (
        <text
          x={width - 20}
          y={y - 26}
          textAnchor="end"
          fontFamily={theme.sans}
          fontSize={24}
          fontWeight={700}
          fill={theme.core}
        >
          放行
        </text>
      ) : null}
    </svg>
  );
};

// ─────────────────────────────────────────────────────────── 母题 5：插槽注册板

export type Slot = {name: string; when: string; callbacks: string[]};

/**
 * 环外四个插槽，按一整轮的时间顺序排在**四个角**（左上→右上→右下→左下）。
 *
 * 定位契约：本组件用 `position:absolute`，故调用方必须给一个
 * `position:relative` 的容器，且容器尺寸至少为 `size + 2*(SLOT_W + SLOT_GAP)`
 * 宽、`size + 220` 高 —— 否则卡片会压到环上或互相重叠（4-D 曾踩：卡片盖住环、
 * 「工具执行之后」被完全遮住）。环应居中于该容器。
 */
export const SLOT_W = 330;
export const SLOT_GAP = 40;

export const SlotRing: React.FC<{
  slots: Slot[];
  /** 已点亮到第几个（-1 全暗） */
  lit: number;
  /** 环直径——用于推导容器尺寸，须与同容器内 LoopRing 的 size 一致 */
  size?: number;
}> = ({slots, lit, size = 430}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const W = size + 2 * (SLOT_W + SLOT_GAP);
  const right = W - SLOT_W;
  // 四角：上排贴顶、下排贴底，横向让出环的直径
  const pos = [
    {left: 0, top: 0},
    {left: right, top: 0},
    {left: right, top: undefined as number | undefined, bottom: 0},
    {left: 0, top: undefined as number | undefined, bottom: 0},
  ];
  return (
    <>
      {slots.map((s, i) => {
        const on = i <= lit;
        const enter = spring({frame: frame - i * 6, fps, config: {damping: 200}});
        const p = pos[i];
        return (
          <div
            key={s.name}
            style={{
              position: 'absolute',
              left: p.left,
              top: p.top,
              bottom: p.bottom,
              width: SLOT_W,
              opacity: on ? enter : 0.22,
              transform: `translateX(${on ? 0 : i === 1 || i === 2 ? 18 : -18}px)`,
            }}
          >
            <Panel
              accent={on ? theme.mech : theme.panelBorder}
              style={{padding: '12px 16px', background: on ? theme.mechDeep : theme.panel}}
            >
              <div style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 700, color: on ? theme.mech : theme.dim}}>
                {s.name}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim, marginTop: 3}}>
                {s.when}
              </div>
              {on
                ? s.callbacks.map((c) => (
                    <div
                      key={c}
                      style={{fontFamily: theme.mono, fontSize: 20, color: theme.text, marginTop: 5}}
                    >
                      {'▸ '}
                      {c}
                    </div>
                  ))
                : null}
            </Panel>
          </div>
        );
      })}
    </>
  );
};

// ─────────────────────────────────────────────────────────── 代码卡

/** 代码卡：逐行渲染（每行 framesPerLine 帧），可高亮/压暗指定行 */
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
        const hot = highlight.includes(i);
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 16,
              fontFamily: theme.mono,
              fontSize: 25,
              lineHeight: 1.62,
              opacity: shown ? (dimOthers && !hot ? 0.4 : 1) : 0,
              background: hot ? theme.coreDeep : 'transparent',
              borderLeft: hot ? `4px solid ${theme.mech}` : '4px solid transparent',
              paddingLeft: 8,
              borderRadius: 5,
            }}
          >
            {showLineNumbers ? (
              <span
                style={{
                  width: 34,
                  textAlign: 'right',
                  color: glow > 0 ? theme.core : theme.panelBorder,
                  textShadow: glow > 0 ? `0 0 ${10 * glow}px ${theme.core}` : 'none',
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

/** 反枚举原则的并列项：panel 底 + 编号，激活时才染色 */
export const NumberedCard: React.FC<{
  index: number;
  label: string;
  active?: boolean;
  sub?: string;
  width?: number;
  delay?: number;
}> = ({index, label, active = false, sub, width = 210, delay = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - delay, fps, config: {damping: 200}});
  return (
    <div
      style={{
        width,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 26}px)`,
      }}
    >
      <Panel
        accent={active ? theme.mech : theme.panelBorder}
        style={{padding: '16px 18px', minHeight: 104}}
      >
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 22,
            color: active ? theme.mech : theme.dim,
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
