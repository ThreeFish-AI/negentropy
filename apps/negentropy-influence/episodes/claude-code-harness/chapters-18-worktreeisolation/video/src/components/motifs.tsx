/** chrome 层组件种子（seeded 档——scaffold 复制后完全自由，无门，随集演进）。
 *
 *  本文件从《拆开 Claude Code》集（claude-code-explained）的 motifs.tsx
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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2–ep17 延续——
// LoopRing 描边色/线宽跨集恒定（theme.core = 陶土橙 #D97757 + RING_STROKE 6）
// = 逐字节拷贝的前提。本集契约（storyboard 前言）：环体恒 core 描边，全片
// 场景一律 `nodes={[]}`（环体即循环本体，无站点标注态）；本集环侧「执行」
// 段挂工作目录指针（读写落在哪间房由绑定说了算）——指针为**外层 SegArc
// 类包装**（WorkRing，见本文件 bespoke 段），母题本体不动。

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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep17 逐字节
 * 拷贝（本集场景一律 `nodes={[]}`：环体即循环本体，无站点标注态；恒 core
 * 陶土橙描边——执行段指针走 WorkRing 外层包装，本组件不动）。
 * - `draw` 0→1 描线进度；`dotProgress` 光点沿环位置（0–1，undefined 则不显示）
 * - `activeNode` 高亮某节点（mech 脉冲）；`exitPull` 光点滑出到「停机」出口的比例
 * - `nodes` 覆写站点集；`nodeLabels` 覆写节点文案（翻牌用）
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

/** 环上坐标（-90 = 12 点；r 与 LoopRing 内圈同式 = size/2 - 46）——挂点位高亮、
 *  环外挂件的场景侧共用工式 */
export const ringPt = polar;

const clamp01v = (v: number) => Math.min(1, Math.max(0, v));

const withAlphaM = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01v(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 双 hex 线性插值（翻态描边 crossfade——ep12 同式） */
export const mixHex = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (x: number): string => Math.round(x).toString(16).padStart(2, '0');
  const mix = (sh: number): number => ((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * t;
  return `#${ch(mix(16))}${ch(mix(8))}${ch(mix(0))}`;
};

/** 弧 path（度数→SVG arc——SegArc 高亮段专用，起于 from 终于 to 顺时针） */
function describeArc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const a = (d: number) => {
    const rad = (d * Math.PI) / 180;
    return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
  };
  const s = a(fromDeg);
  const e = a(toDeg);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

/** 环上高亮一小段（与 LoopRing 同几何 r = size/2 - 46 叠放；from..to 为段位角
 *  （-90 = 12 点），`litP` 0..1 显形（一小段点亮 + 微辉光），tone 缺省 core。 */
export const SegArc: React.FC<{size: number; from: number; to: number; litP: number; tone?: string}> = ({
  size,
  from,
  to,
  litP,
  tone,
}) => {
  const on = tone ?? theme.core;
  const lit = clamp01v(litP);
  if (lit < 0.02) return null;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 46;
  return (
    <svg width={size} height={size} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <path
        d={describeArc(cx, cy, r, from, to)}
        fill="none"
        stroke={on}
        strokeWidth={10}
        strokeLinecap="round"
        opacity={lit}
      />
      <path
        d={describeArc(cx, cy, r, from, to)}
        fill="none"
        stroke={on}
        strokeWidth={22}
        strokeLinecap="round"
        opacity={0.22 * lit}
      />
    </svg>
  );
};

/** 消融双轨骨架（ep17 逐字节拷贝，源 ep16——3-C 全片张力峰值；左红右绿恒定，
 *  等高并置同题裁决）。轨内容（房 / 线 / 文件点 / 指令签 / 计数器）由调用
 *  场景按 CHECK_LANES 常量摆位——装置只承载轨道背板 + 轨头标签。 */
export const CHECK_LANES = {
  left: {x: 110, y: 150, w: 800, h: 690},
  right: {x: 1010, y: 150, w: 800, h: 690},
} as const;

export const AblationSplit: React.FC<{
  litP?: number;
  leftP?: number;
  rightP?: number;
  leftTitle: string;
  leftSub: string;
  rightTitle: string;
  rightSub: string;
}> = ({litP = 1, leftP = 0, rightP = 0, leftTitle, leftSub, rightTitle, rightSub}) => {
  const lit = clamp01v(litP);
  const lane = (
    geo: {x: number; y: number; w: number; h: number},
    p: number,
    tone: string,
    title: string,
    sub: string,
  ) => (
    <div
      style={{
        position: 'absolute',
        left: geo.x,
        top: geo.y,
        width: geo.w,
        height: geo.h,
        borderRadius: 16,
        border: `3px solid ${withAlphaM(tone, 0.35 + 0.5 * clamp01v(p))}`,
        background: withAlphaM(theme.panel, 0.9),
        opacity: lit,
        transform: `translateY(${(1 - clamp01v(p)) * 26}px)`,
      }}
    >
      <div style={{display: 'flex', alignItems: 'baseline', gap: 14, padding: '16px 24px 0'}}>
        <span style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 700, color: tone, whiteSpace: 'nowrap'}}>{title}</span>
        <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>{sub}</span>
      </div>
    </div>
  );
  return (
    <>
      {lane(CHECK_LANES.left, leftP, theme.danger, leftTitle, leftSub)}
      {lane(CHECK_LANES.right, rightP, theme.ok, rightTitle, rightSub)}
    </>
  );
};

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep18 Worktree Isolation）
// storyboard 实现映射登记：LedgerBlock（账本，含房槽挂靠拓扑）/ RoomCard
// （目录房，生长·完工·待清点·消融四态）/ BranchLine（分支线，抽线·生长·
// 抹除态）/ RoomNumberField（房号字段）/ TaskCard（任务卡+房号字段+「待领」灯）/
// NameGateCard（字符窗标尺 1..64+白名单带+路径穿越弹回）/ ExitGateCard
// （三出口门卡）/ CounterBar（清点计数器，含上游限定签）/ EventLogBand
// （事件日志条带）/ GuardBadge（守卫小签）/ WorkRing（环体+执行段工作目录
// 指针——LoopRing 外层包装）/ CursorArrow（光标箭头）。全片主装置 = 账本—
// 房间—分支线（兰紫线 / 钢青围挡两主题色语义全片不互换）；反例/退化走
// danger；机制在位/拦截成功走 ok。哑装置原则承 ep15–17：动效参数（进度/
// 状态/读数）一律经 prop 由调用场景注入，装置自身零 motion hook 调用
// （几何/条件内纯函数推进；唯一例外 useRingDot 族已在上）。

/** 光标箭头（灰白族异亮度——0-A 三支笔 / 1-C 领走 / 2-B 认领共用形） */
export const CursorArrow: React.FC<{
  x: number;
  y: number;
  tone?: string;
  size?: number;
  litP?: number;
  label?: string;
}> = ({x, y, tone, size = 54, litP = 1, label}) => {
  const on = tone ?? theme.text;
  const s = size / 54;
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: clamp01v(litP)}}>
      <svg width={size} height={size} viewBox="0 0 54 54" style={{overflow: 'visible'}}>
        <path
          d="M27 4 L27 46 M27 4 L14 19 M27 4 L40 19"
          stroke={on}
          strokeWidth={5 * s}
          strokeLinecap="round"
          fill="none"
          transform="rotate(180 27 25)"
        />
      </svg>
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: size * 0.62,
            top: -14,
            padding: '3px 12px',
            borderRadius: 8,
            border: `2.5px solid ${withAlphaM(on, 0.85)}`,
            background: withAlphaM(theme.panel, 0.96),
            fontFamily: theme.sans,
            fontSize: 18,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

/** 账本（本集主装置之「一本账」——standing book：封面 + 书脊 + 页行 + 侧沿
 *  房槽挂靠拓扑）。`riseP` 自底部立起（0 = 屏下 → 1 = 落定）；`slotsLitP`
 *  各房槽点亮进度（暗态 dashed dim → 兰紫描边）；`dimP` 暗层化（P3/4-A 深处
 *  静驻）。缩微前后不重绘（房槽/封面描边同形约束）。 */
export const LedgerBlock: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  riseP?: number;
  slots?: number;
  slotsLitP?: readonly number[];
  dimP?: number;
  ghost?: boolean;
}> = ({x, y, w = 240, h = 380, litP = 1, riseP = 1, slots = 3, slotsLitP = [], dimP = 0, ghost = false}) => {
  const lit = clamp01v(litP);
  const rise = clamp01v(riseP);
  const dim = clamp01v(dimP);
  const edge = ghost ? withAlphaM(theme.dim, 0.5) : withAlphaM(theme.text, 0.85);
  // 房槽：右缘竖排等距（首个槽中心 y = h*0.3，间距 h*0.28）——槽体 60×50
  const slotGeo = Array.from({length: slots}, (_, i) => ({
    cy: h * 0.3 + i * h * 0.28,
    cw: 60,
    ch: 50,
  }));
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + (1 - rise) * 300,
        width: w + 72,
        height: h,
        opacity: lit * (1 - 0.62 * dim),
        transform: `translateY(${(1 - rise) * -60}px)`,
      }}
    >
      {/* 本体（封面 + 书脊 + 页行） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: h,
          borderRadius: '10px 16px 16px 10px',
          border: `3.5px solid ${edge}`,
          background: withAlphaM(theme.panel, 0.96),
          boxShadow: ghost ? 'none' : `0 0 ${18 * (1 - dim)}px ${withAlphaM(theme.dim, 0.25)}`,
        }}
      >
        {/* 书脊（左缘加深条） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 8,
            bottom: 8,
            width: 16,
            borderRadius: '8px 0 0 8px',
            background: withAlphaM(theme.dim, 0.22),
            borderRight: `2px solid ${withAlphaM(theme.panelBorder, 0.9)}`,
          }}
        />
        {/* 页行（封面上的账目横行） */}
        {[0, 1, 2, 3].map((r) => (
          <div
            key={`lg${r}`}
            style={{
              position: 'absolute',
              left: 34,
              top: h * 0.16 + r * (h * 0.15),
              width: w - 74,
              height: 10,
              borderRadius: 3,
              background: withAlphaM(theme.dim, 0.3 - r * 0.04),
            }}
          />
        ))}
        {/* 账本签（封面顶部） */}
        <div
          style={{
            position: 'absolute',
            left: 34,
            top: h * 0.045,
            fontFamily: theme.sans,
            fontSize: Math.max(16, w * 0.085),
            fontWeight: 700,
            color: dim > 0.5 ? theme.dim : theme.text,
            whiteSpace: 'nowrap',
            opacity: 0.9,
          }}
        >
          账本
        </div>
      </div>
      {/* 侧沿房槽（兰紫房形轮廓——暗态 dashed dim，点亮后兰紫描边） */}
      {slotGeo.map((s, i) => {
        const on = clamp01v(slotsLitP[i] ?? 0);
        return (
          <div
            key={`ls${i}`}
            style={{
              position: 'absolute',
              left: w - 10,
              top: s.cy - s.ch / 2,
              width: s.cw,
              height: s.ch,
              opacity: 0.35 + 0.65 * on,
            }}
          >
            <svg width={s.cw} height={s.ch} viewBox={`0 0 ${s.cw} ${s.ch}`} style={{overflow: 'visible'}}>
              <path
                d={`M6 ${s.ch * 0.52} L ${s.cw / 2} 4 L ${s.cw - 6} ${s.ch * 0.52} Z`}
                fill="none"
                stroke={on > 0.3 ? theme.line : theme.dim}
                strokeWidth={3}
                strokeDasharray={on > 0.3 ? undefined : '5 5'}
                opacity={0.45 + 0.55 * on}
              />
              <rect
                x={10}
                y={s.ch * 0.52}
                width={s.cw - 20}
                height={s.ch * 0.44}
                rx={4}
                fill={on > 0.3 ? withAlphaM(theme.line, 0.14) : 'transparent'}
                stroke={on > 0.3 ? theme.line : theme.dim}
                strokeWidth={3}
                strokeDasharray={on > 0.3 ? undefined : '5 5'}
                opacity={0.45 + 0.55 * on}
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
};

/** 目录房（本集主装置之「房」——house 形：屋顶 + 房体 + 房门 + 名牌位）。
 *  `growP` 自账本侧沿生长（0 = 无 → 1 = 成型；scale 自 0.35 + 透明度，生长
 *  语义≠复制出现）；`fenceP` 钢青围挡亮出（.worktrees/ 角标随行）；`doorP`
 *  门框亮起（认领落房）；`doneP` 屋顶完成灯（确认绿）；`pendingP` 待清点
 *  暗态（2-C→3-A 完成灯转暗）；`vanishP` 蒸发虚化（3-C 左轨）；`flashP`
 *  描边一闪；`fileCardP` 房内文件卡亮出（P2 config.py 双份同形）。
 *  全片同形约束：房形轮廓缩微前后不重绘。 */
export const RoomCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  growP?: number;
  name?: string;
  nameLitP?: number;
  fenceP?: number;
  fenceTag?: string;
  doorP?: number;
  doneP?: number;
  pendingP?: number;
  vanishP?: number;
  flashP?: number;
  fileCardP?: number;
  fileName?: string;
  tone?: string;
}> = ({
  x,
  y,
  w = 220,
  h = 180,
  litP = 1,
  growP = 1,
  name,
  nameLitP = 0,
  fenceP = 0,
  fenceTag = '.worktrees/',
  doorP = 0,
  doneP = 0,
  pendingP = 0,
  vanishP = 0,
  flashP = 0,
  fileCardP = 0,
  fileName = 'config.py',
  tone,
}) => {
  const lit = clamp01v(litP);
  const grow = clamp01v(growP);
  const fence = clamp01v(fenceP);
  const door = clamp01v(doorP);
  const done = clamp01v(doneP);
  const pending = clamp01v(pendingP);
  const vanish = clamp01v(vanishP);
  const flash = clamp01v(flashP);
  const fc = clamp01v(fileCardP);
  const on = tone ?? theme.line;
  const roofH = h * 0.3;
  const bodyH = h - roofH;
  const nl = clamp01v(nameLitP);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w + 44,
        height: h + 40,
        opacity: lit * (1 - 0.9 * vanish) * (0.42 + 0.58 * grow) * (1 - 0.4 * pending),
        transform: `scale(${0.35 + 0.65 * grow - 0.04 * vanish})`,
        transformOrigin: '0% 50%',
        filter: vanish > 0.05 ? `blur(${vanish * 2.4}px)` : undefined,
      }}
    >
      {/* 围挡（钢青 dashed 外框——.worktrees/ 目录边界） */}
      {fence > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: -16,
            top: -14,
            width: w + 40,
            height: h + 34,
            borderRadius: 14,
            border: `3px dashed ${withAlphaM(theme.guard, 0.4 + 0.5 * fence)}`,
            background: withAlphaM(theme.guard, 0.05 * fence),
            opacity: fence,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 10,
              bottom: -30,
              fontFamily: theme.mono,
              fontSize: 15,
              color: theme.guard,
              whiteSpace: 'nowrap',
              opacity: 0.9,
            }}
          >
            {fenceTag}
          </div>
        </div>
      ) : null}
      {/* 屋顶 */}
      <svg width={w} height={roofH + 8} viewBox={`0 0 ${w} ${roofH + 8}`} style={{position: 'absolute', left: 4, top: -4, overflow: 'visible'}}>
        <path
          d={`M0 ${roofH + 2} L ${w / 2} 2 L ${w} ${roofH + 2} Z`}
          fill={withAlphaM(theme.panel, 0.96)}
          stroke={on}
          strokeWidth={4}
          strokeLinejoin="round"
          opacity={0.9}
        />
      </svg>
      {/* 房体 */}
      <div
        style={{
          position: 'absolute',
          left: 4,
          top: roofH,
          width: w - 8,
          height: bodyH,
          borderRadius: '4px 4px 12px 12px',
          border: `4px solid ${on}`,
          background: withAlphaM(theme.panel, 0.96),
          boxShadow: flash > 0.03 ? `0 0 ${26 * flash}px ${withAlphaM(on, 0.55 * flash)}` : 'none',
        }}
      >
        {/* 房门（门框亮起=认领落房） */}
        <div
          style={{
            position: 'absolute',
            left: w / 2 - 22,
            top: bodyH * 0.3,
            width: 44,
            height: bodyH * 0.66,
            borderRadius: '22px 22px 0 0',
            border: `3.5px solid ${door > 0.3 ? theme.guard : withAlphaM(theme.dim, 0.55)}`,
            background: door > 0.3 ? withAlphaM(theme.guard, 0.18) : 'transparent',
            boxShadow: door > 0.5 ? `0 0 ${16 * door}px ${withAlphaM(theme.guard, 0.55 * door)}` : 'none',
          }}
        />
        {/* 房内文件卡（P2 config.py 双份同形——文件体 + 文件名角标） */}
        {fc > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: 16,
              top: 12,
              width: (w - 8) * 0.44,
              height: bodyH * 0.42,
              borderRadius: 8,
              border: `2.5px solid ${withAlphaM(theme.dim, 0.85)}`,
              background: withAlphaM(theme.panel, 0.98),
              opacity: fc,
            }}
          >
            <div style={{padding: '6px 8px', fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>
              {fileName}
            </div>
            <div style={{margin: '0 8px', height: 6, borderRadius: 2, background: withAlphaM(theme.dim, 0.35)}} />
          </div>
        ) : null}
      </div>
      {/* 屋顶完成灯（确认绿一闪转常亮） */}
      {done > 0.02 ? (
        <span
          style={{
            position: 'absolute',
            left: w / 2 - 9,
            top: -26,
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: `3.5px solid ${withAlphaM(theme.ok, 0.5 + 0.5 * done)}`,
            background: done > 0.5 ? theme.ok : 'transparent',
            boxShadow: done > 0.5 ? `0 0 ${16 * done}px ${withAlphaM(theme.ok, 0.6 * done)}` : 'none',
            opacity: 1 - pending * 0.75,
          }}
        />
      ) : null}
      {/* 房名名牌（房顶上沿——「认证房」「界面房」「工作树」） */}
      {name && nl > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 4,
            top: -40,
            padding: '4px 16px',
            borderRadius: 9,
            border: `2.5px solid ${withAlphaM(on, 0.55 + 0.4 * nl)}`,
            background: withAlphaM(theme.panel, 0.97),
            fontFamily: theme.sans,
            fontSize: 20,
            fontWeight: 700,
            color: nl > 0.5 ? theme.text : theme.dim,
            whiteSpace: 'nowrap',
            opacity: nl,
            transform: `translateY(${(1 - nl) * -8}px)`,
          }}
        >
          {name}
        </div>
      ) : null}
    </div>
  );
};

/** 分支线（本集主装置之「线」——账本侧沿 ↔ 房，兰紫）。`drawP` 自账本抽出
 *  （描线）；`litP` 增亮一档（dim → line + 辉光）；`eraseP` 抹除（自房端向
 *  账本端回吞 + 红闪——连坐删除的轨迹）；`dashed` 待接虚线态（1-B 绑定线）；
 *  `label` 线身角标（wt/<name>——英文机制词只进角标）。 */
export const BranchLine: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  drawP?: number;
  litP?: number;
  eraseP?: number;
  dashed?: boolean;
  label?: string;
  labelP?: number;
  flashP?: number;
}> = ({x1, y1, x2, y2, drawP = 0, litP = 0, eraseP = 0, dashed = false, label, labelP = 0, flashP = 0}) => {
  const draw = clamp01v(drawP);
  const lit = clamp01v(litP);
  const erase = clamp01v(eraseP);
  const flash = clamp01v(flashP);
  const tone = mixHex(theme.dim, theme.line, Math.max(lit, draw * 0.8));
  const shown = draw * (1 - erase);
  const lp = clamp01v(labelP);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={erase > 0.05 ? mixHex(tone, theme.danger, erase) : tone}
        strokeWidth={4 + 2 * lit}
        strokeLinecap="round"
        strokeDasharray={dashed ? '10 9' : undefined}
        pathLength={dashed ? undefined : 1}
        strokeDashoffset={dashed ? undefined : 1 - shown}
        opacity={(0.5 + 0.5 * lit) * (1 - erase * 0.85)}
      />
      {flash > 0.03 ? (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={theme.line}
          strokeWidth={8}
          strokeLinecap="round"
          opacity={0.6 * flash}
        />
      ) : null}
      {label && lp > 0.02 ? (
        <text
          x={mx}
          y={my - 12}
          textAnchor="middle"
          fontFamily={theme.mono}
          fontSize={15}
          fill={theme.line}
          opacity={lp * 0.95}
        >
          {label}
        </text>
      ) : null}
    </svg>
  );
};

/** 房号字段（兰紫描边+兰紫值——「绑定只加房号」的落点件；G1 R1 裁决：字段
 *  值/描边=兰紫〔绑定语义〕、所在任务卡卡体=钢青〔任务侧〕，两者分色不互换）。
 *  `writeP` 值逐字写入（宽度裁切显形）；空态 dashed 内槽。`micro` 嵌入任务卡
 *  的紧凑档。 */
export const RoomNumberField: React.FC<{
  x: number;
  y: number;
  w?: number;
  litP?: number;
  writeP?: number;
  value?: string;
  label?: string;
  micro?: boolean;
  glowP?: number;
}> = ({x, y, w = 300, litP = 1, writeP = 0, value = '', label = 'worktree', micro = false, glowP = 0}) => {
  const lit = clamp01v(litP);
  const wr = clamp01v(writeP);
  const glow = clamp01v(glowP);
  const h = micro ? 30 : 40;
  const chars = Math.round(value.length * wr);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: lit}}>
      <div
        style={{
          position: 'relative',
          height: h,
          borderRadius: 8,
          border: `${micro ? 2.5 : 3}px solid ${withAlphaM(theme.line, 0.55 + 0.45 * Math.max(wr, glow))}`,
          background: withAlphaM(theme.panel, 0.98),
          boxShadow: glow > 0.03 ? `0 0 ${18 * glow}px ${withAlphaM(theme.line, 0.5 * glow)}` : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 12px',
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: micro ? 12 : 14, color: theme.dim, whiteSpace: 'nowrap'}}>
          {label}
        </span>
        {wr > 0.01 ? (
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: micro ? 15 : 18,
              fontWeight: 700,
              color: theme.line,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              display: 'inline-block',
              width: `${wr * (w - (micro ? 90 : 108))}px`,
              verticalAlign: 'bottom',
            }}
          >
            {value.slice(0, Math.max(1, chars))}
          </span>
        ) : (
          <span
            style={{
              flex: 1,
              height: micro ? 12 : 16,
              borderRadius: 4,
              border: `2px dashed ${withAlphaM(theme.dim, 0.45)}`,
            }}
          />
        )}
      </div>
    </div>
  );
};

/** 任务卡（钢青框——任务级绑定的挂点：编号签 + 任务名 + 房号字段（内嵌
 *  RoomNumberField）+ 状态角「待领」灯 + 认领/完成/结果翻态）。机制红线：
 *  「待领」灯恒色（绑定只写房号、不动状态——pendingLitP 只控制灯的亮起、
 *  不改色）；`claimP` 认领签（领走就带房）；`takeP`+`takeDx/Dy` 被接走位移
 *  （房随卡同移由场景侧成对调用）；`greenP` 完成绿；`resultP` 结果小签。 */
export const TaskCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  id: string;
  title: string;
  litP?: number;
  fieldWriteP?: number;
  fieldValue?: string;
  fieldGlowP?: number;
  pendingLitP?: number;
  claimP?: number;
  claimer?: string;
  takeP?: number;
  takeDx?: number;
  takeDy?: number;
  greenP?: number;
  resultP?: number;
  micro?: boolean;
}> = ({
  x,
  y,
  w = 420,
  h = 260,
  id,
  title,
  litP = 1,
  fieldWriteP = 0,
  fieldValue = '',
  fieldGlowP = 0,
  pendingLitP = 0,
  claimP = 0,
  claimer,
  takeP = 0,
  takeDx = -160,
  takeDy = -120,
  greenP = 0,
  resultP = 0,
  micro = false,
}) => {
  const lit = clamp01v(litP);
  const claim = clamp01v(claimP);
  const take = clamp01v(takeP);
  const green = clamp01v(greenP);
  const result = clamp01v(resultP);
  const pend = clamp01v(pendingLitP);
  const edge = green > 0.02 ? mixHex(theme.guard, theme.ok, green) : withAlphaM(theme.guard, 0.5 + 0.5 * Math.max(claim, pend));
  return (
    <div
      style={{
        position: 'absolute',
        left: x + take * takeDx,
        top: y + take * takeDy,
        width: w,
        height: h,
        opacity: lit * (1 - take * 0.9),
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          border: `${micro ? 2.5 : 3.5}px solid ${edge}`,
          background: withAlphaM(theme.panel, 0.96),
          boxShadow: green > 0.9 ? `0 0 ${16 * green}px ${withAlphaM(theme.ok, 0.35)}` : 'none',
        }}
      >
        <div style={{position: 'absolute', left: micro ? 10 : 16, top: micro ? 8 : 12, fontFamily: theme.mono, fontSize: micro ? 12 : 15, color: theme.dim, whiteSpace: 'nowrap', letterSpacing: 1}}>
          {id}
        </div>
        <div style={{position: 'absolute', left: micro ? 10 : 16, top: micro ? 26 : 44, fontFamily: theme.sans, fontSize: micro ? 17 : 26, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
          {title}
        </div>
        {/* 状态角「待领」灯（恒色 dim——绑定不改状态的红线：pend 只控亮起） */}
        <div style={{position: 'absolute', right: micro ? 9 : 14, top: micro ? 8 : 12, display: 'flex', alignItems: 'center', gap: 7, opacity: 0.3 + 0.7 * pend}}>
          <span
            style={{
              width: micro ? 11 : 15,
              height: micro ? 11 : 15,
              borderRadius: '50%',
              border: `${micro ? 2.5 : 3}px solid ${withAlphaM(theme.dim, 0.9)}`,
              background: 'transparent',
            }}
          />
          <span style={{fontFamily: theme.sans, fontSize: micro ? 12 : 15, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
            待领
          </span>
        </div>
        {/* 房号字段（内嵌——create_worktree 第三件的落点） */}
        <RoomNumberField
          x={micro ? 10 : 16}
          y={h - (micro ? 44 : 62)}
          w={w - (micro ? 20 : 32)}
          writeP={fieldWriteP}
          value={fieldValue}
          micro={micro}
          glowP={fieldGlowP}
        />
        {/* 认领签（领走就带房） */}
        {claim > 0.02 && claimer ? (
          <div
            style={{
              position: 'absolute',
              left: micro ? 10 : 16,
              bottom: micro ? 40 : 56,
              padding: micro ? '2px 8px' : '4px 12px',
              borderRadius: 8,
              border: `2.5px solid ${withAlphaM(theme.text, 0.85)}`,
              background: withAlphaM(theme.panel, 0.97),
              fontFamily: theme.sans,
              fontSize: micro ? 12 : 16,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: claim,
            }}
          >
            {`${claimer} · 认领`}
          </div>
        ) : null}
        {/* 结果小签（任务完成只把结果记在卡上） */}
        {result > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              right: micro ? 9 : 14,
              bottom: micro ? 40 : 58,
              padding: micro ? '2px 8px' : '4px 12px',
              borderRadius: 8,
              border: `2.5px solid ${withAlphaM(theme.ok, 0.8)}`,
              background: withAlphaM(theme.ok, 0.12),
              fontFamily: theme.sans,
              fontSize: micro ? 12 : 16,
              fontWeight: 700,
              color: theme.ok,
              whiteSpace: 'nowrap',
              opacity: result,
              transform: `translateY(${(1 - result) * 8}px)`,
            }}
          >
            结果已记
          </div>
        ) : null}
        {green > 0.5 ? (
          <svg width={micro ? 20 : 30} height={micro ? 20 : 30} viewBox="0 0 20 20" style={{position: 'absolute', left: '50%', top: '42%', transform: 'translate(-50%, -50%)', opacity: clamp01v(green * 2 - 1)}}>
            <path d="M 3 10.5 L 8 15.5 L 17 4.5" fill="none" stroke={theme.ok} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </div>
    </div>
  );
};

/** 守卫小签（钢青盾形徽——0-C 拆房侧位半句钩 / P3 默认拒绝守卫位）。
 *  `flashP` 钢青描边一闪（p0-07 半句钩兑现前的预告）；`voidP` 旁路虚化
 *  （3-C 左轨：守卫被绕开——dashed 空槽、非删除）。 */
export const GuardBadge: React.FC<{
  x: number;
  y: number;
  size?: number;
  litP?: number;
  flashP?: number;
  voidP?: number;
  label?: string;
}> = ({x, y, size = 120, litP = 1, flashP = 0, voidP = 0, label = '守卫'}) => {
  const lit = clamp01v(litP);
  const flash = clamp01v(flashP);
  const voidPv = clamp01v(voidP);
  const on = theme.guard;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        opacity: lit * (1 - 0.55 * voidPv),
      }}
    >
      <div
        style={{
          position: 'relative',
          padding: '10px 16px',
          borderRadius: 12,
          border: `3px ${voidPv > 0.3 ? 'dashed' : 'solid'} ${withAlphaM(on, 0.4 + 0.6 * (1 - voidPv))}`,
          background: withAlphaM(theme.panel, 0.96),
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: flash > 0.03 ? `0 0 ${26 * flash}px ${withAlphaM(on, 0.6 * flash)}` : 'none',
        }}
      >
        <svg width={26} height={30} viewBox="0 0 26 30">
          <path
            d="M13 2 L24 7 V15 C24 22 19 26 13 28 C7 26 2 22 2 15 V7 Z"
            fill={voidPv > 0.3 ? 'transparent' : withAlphaM(on, 0.2)}
            stroke={on}
            strokeWidth={2.6}
            strokeDasharray={voidPv > 0.3 ? '4 4' : undefined}
            opacity={0.55 + 0.45 * (1 - voidPv)}
          />
          <path d="M8.5 14.5 L12 18 L18 10.5" fill="none" stroke={on} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" opacity={(1 - voidPv) * 0.95} />
        </svg>
        <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: voidPv > 0.3 ? theme.dim : theme.text, whiteSpace: 'nowrap'}}>
          {label}
        </span>
      </div>
    </div>
  );
};

/** 名字门禁卡（钢青描边——名字校验装置：1..64 刻度字符窗标尺 + 白名单滚动
 *  带 + 路径穿越签撞门弹回）。`rulerP` 标尺立起（示例名恰落窗内）；`bandP`
 *  白名单带亮起滚动；`ejectP` 非白名单字符被剔出；`hitP`「..」撞门弹回
 *  （有轨迹：进抵→弹回）；`hit2P`「../evil」同型二次；`sinkP` 挡死一沉定格。
 *  刻度与口播一致：1..64（小刻每 4、标数 1/16/32/48/64）。 */
export const NameGateCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  rulerP?: number;
  bandP?: number;
  bandShift?: number;
  ejectP?: number;
  hitP?: number;
  hit2P?: number;
  sinkP?: number;
  sample?: string;
}> = ({x, y, w = 620, h = 420, litP = 1, rulerP = 0, bandP = 0, bandShift = 0, ejectP = 0, hitP = 0, hit2P = 0, sinkP = 0, sample = 'auth-refactor'}) => {
  const lit = clamp01v(litP);
  const ruler = clamp01v(rulerP);
  const band = clamp01v(bandP);
  const eject = clamp01v(ejectP);
  const hit = clamp01v(hitP);
  const hit2 = clamp01v(hit2P);
  const sink = clamp01v(sinkP);
  const rulerW = w - 96;
  // 撞门轨迹（纯函数：0..0.5 进抵 → 0.5..1 弹回；弹回不进门内）
  const hitTrack = (p: number) => {
    const t = p < 0.5 ? p / 0.5 : 1 - (p - 0.5) / 0.5;
    return t;
  };
  const hitX = x + w - 30 - hitTrack(hit) * 240;
  const hit2X = x + w - 30 - hitTrack(hit2) * 300;
  const bandChars = 'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('');
  const bandW = rulerW;
  const shift = bandShift % 40;
  return (
    <div style={{position: 'absolute', left: x, top: y + sink * 12, width: w, height: h, opacity: lit}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          border: `${3.5 + 1.5 * sink}px solid ${withAlphaM(theme.guard, 0.55 + 0.45 * Math.max(ruler, sink))}`,
          background: withAlphaM(theme.panel, 0.96),
          boxShadow: sink > 0.5 ? `0 0 ${24 * sink}px ${withAlphaM(theme.guard, 0.35)}` : 'none',
          transform: `translateY(${sink * 8}px)`,
        }}
      >
        {/* 卡头（名字门禁 + 门柱图标） */}
        <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '18px 26px 0'}}>
          <svg width={24} height={24} viewBox="0 0 24 24">
            <path d="M4 3 h9 l5 5 v13 h-14 z" fill="none" stroke={theme.guard} strokeWidth={2.2} />
            <path d="M13 3 v5 h5" fill="none" stroke={theme.guard} strokeWidth={2.2} />
          </svg>
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>名字门禁</span>
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap', marginLeft: 8}}>{'1..64'}</span>
        </div>
        {/* 白名单滚动带（标尺上方流动——字母/数字/数种符号；一枚非白名单字符被剔出） */}
        <div style={{position: 'absolute', left: 48, top: 92, width: bandW, height: 44, opacity: 0.25 + 0.75 * band, overflow: 'hidden'}}>
          <div
            style={{
              display: 'flex',
              gap: 0,
              width: bandW,
              transform: `translateX(${-shift}px)`,
              opacity: band,
            }}
          >
            {bandChars.concat(bandChars.slice(0, 8)).map((c, i) => (
              <span
                key={`bc${i}`}
                style={{
                  width: 40,
                  textAlign: 'center',
                  fontFamily: theme.mono,
                  fontSize: 22,
                  color: theme.text,
                  opacity: 0.85,
                  flexShrink: 0,
                }}
              >
                {c}
              </span>
            ))}
          </div>
          {/* 被剔出的非白名单字符（自带内坠落出带—— '*' 不在白名单） */}
          {eject > 0.02 ? (
            <span
              style={{
                position: 'absolute',
                left: bandW * 0.62,
                top: eject * 56,
                fontFamily: theme.mono,
                fontSize: 22,
                color: theme.danger,
                opacity: 1 - eject,
              }}
            >
              ✕
            </span>
          ) : null}
          <div style={{position: 'absolute', left: 0, right: 0, bottom: -6, height: 2, background: withAlphaM(theme.dim, 0.4), opacity: band}} />
        </div>
        {/* 字符窗标尺（1..64 基线刻度——小刻每 4、标数 1/16/32/48/64） */}
        <div style={{position: 'absolute', left: 48, top: 178, width: rulerW, height: 90, opacity: ruler}}>
          <svg width={rulerW} height={36} viewBox={`0 0 ${rulerW} 36`}>
            {Array.from({length: 17}, (_, i) => {
              const tx = (i / 16) * rulerW;
              const major = i % 4 === 0;
              return (
                <line
                  key={`tk${i}`}
                  x1={tx}
                  y1={0}
                  x2={tx}
                  y2={major ? 16 : 9}
                  stroke={withAlphaM(theme.dim, major ? 0.9 : 0.5)}
                  strokeWidth={major ? 2.5 : 1.8}
                />
              );
            })}
            <line x1={0} y1={0} x2={rulerW} y2={0} stroke={withAlphaM(theme.dim, 0.9)} strokeWidth={2.5} />
            {[1, 16, 32, 48, 64].map((n) => (
              <text
                key={`lb${n}`}
                x={((n - 1) / 63) * rulerW}
                y={34}
                textAnchor={n === 1 ? 'start' : n === 64 ? 'end' : 'middle'}
                fontFamily={theme.mono}
                fontSize={15}
                fill={theme.dim}
              >
                {n}
              </text>
            ))}
          </svg>
          {/* 示例名落窗（长度条恰在窗内——14 字符 ≤ 64） */}
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              opacity: ruler,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.line, whiteSpace: 'nowrap'}}>{sample}</span>
            <span
              style={{
                width: (sample.length / 64) * rulerW,
                height: 12,
                borderRadius: 3,
                background: withAlphaM(theme.line, 0.4),
                border: `2px solid ${withAlphaM(theme.line, 0.8)}`,
              }}
            />
            <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>{`${sample.length}/64`}</span>
          </div>
        </div>
        {/* 撞门弹回注记（卡内底部——「向上溜一层」被挡在创建这一步） */}
        <div style={{position: 'absolute', left: 48, bottom: 16, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: sink > 0.5 ? theme.guard : theme.dim, whiteSpace: 'nowrap', opacity: 0.55 + 0.45 * sink}}>
          {sink > 0.5 ? '两个点 · 进不来' : '创建这一步 · 先验名字'}
        </div>
      </div>
      {/* 「..」路径签（自右撞门弹回——警示红描边；轨迹在卡外右缘） */}
      {hit > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: hitX,
            top: 70,
            padding: '5px 14px',
            borderRadius: 9,
            border: `2.5px solid ${withAlphaM(theme.danger, 0.9)}`,
            background: withAlphaM(theme.panel, 0.97),
            fontFamily: theme.mono,
            fontSize: 19,
            fontWeight: 700,
            color: theme.danger,
            whiteSpace: 'nowrap',
            opacity: hit < 0.98 ? 1 : 0.35,
          }}
        >
          ..
        </div>
      ) : null}
      {hit2 > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: hit2X,
            top: 130,
            padding: '5px 14px',
            borderRadius: 9,
            border: `2.5px solid ${withAlphaM(theme.danger, 0.9)}`,
            background: withAlphaM(theme.panel, 0.97),
            fontFamily: theme.mono,
            fontSize: 19,
            fontWeight: 700,
            color: theme.danger,
            whiteSpace: 'nowrap',
            opacity: hit2 < 0.98 ? 1 : 0.35,
          }}
        >
          ../evil
        </div>
      ) : null}
    </div>
  );
};

/** 三出口门卡（拆房裁决面——①默认拒绝 钢青 / ②强拆 警示红（角标
 *  discard_changes，确认开关默认未拨）/ ③保留等审 确认绿（角标 keep_worktree，
 *  卡内房+线小图整条保留））。`which` 出口序号；`litP` 亮出；`numP` 序号签
 *  点亮；`confirmP` 门②确认开关弹出（默认未拨——须显式丢弃的红线）；
 *  `keepP` 门③房线小图显形；`sinkP` 描边一沉（门①落定）。 */
export const ExitGateCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  which: 1 | 2 | 3;
  litP?: number;
  numP?: number;
  confirmP?: number;
  keepP?: number;
  sinkP?: number;
  micro?: boolean;
}> = ({x, y, w = 300, h = 300, which, litP = 1, numP = 0, confirmP = 0, keepP = 0, sinkP = 0, micro = false}) => {
  const lit = clamp01v(litP);
  const num = clamp01v(numP);
  const confirm = clamp01v(confirmP);
  const keep = clamp01v(keepP);
  const sink = clamp01v(sinkP);
  const tone = which === 1 ? theme.guard : which === 2 ? theme.danger : theme.ok;
  const label = which === 1 ? '默认拒绝' : which === 2 ? '强拆' : '保留等审';
  const tag = which === 1 ? 'remove_worktree' : which === 2 ? 'discard_changes' : 'keep_worktree';
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + sink * 10,
        width: w,
        height: h,
        opacity: lit * (0.4 + 0.6 * num),
        transform: `translateY(${sink * 8}px)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: `${(micro ? 2.5 : 3.5) + 1.5 * sink}px solid ${withAlphaM(tone, 0.4 + 0.6 * num)}`,
          background: withAlphaM(theme.panel, 0.96),
          boxShadow: sink > 0.5 ? `0 0 ${20 * sink}px ${withAlphaM(tone, 0.35)}` : 'none',
        }}
      >
        {/* 序号签（1/2/3——点亮次序=口播次序） */}
        <div
          style={{
            position: 'absolute',
            left: micro ? 8 : 14,
            top: micro ? 6 : 10,
            width: micro ? 26 : 34,
            height: micro ? 26 : 34,
            borderRadius: '50%',
            border: `${micro ? 2.5 : 3}px solid ${withAlphaM(tone, 0.35 + 0.65 * num)}`,
            background: num > 0.5 ? withAlphaM(tone, 0.22) : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: micro ? 15 : 19,
            fontWeight: 700,
            color: num > 0.4 ? tone : theme.dim,
          }}
        >
          {which}
        </div>
        {/* 出口名 */}
        <div style={{position: 'absolute', left: 0, right: 0, top: micro ? 38 : 52, textAlign: 'center', fontFamily: theme.sans, fontSize: micro ? 18 : 25, fontWeight: 700, color: num > 0.4 ? tone : theme.dim, whiteSpace: 'nowrap'}}>
          {label}
        </div>
        {/* 门洞（arched doorway） */}
        <svg width={w} height={h * 0.44} viewBox={`0 0 ${w} ${h * 0.44}`} style={{position: 'absolute', left: 0, top: h * 0.32}}>
          <path
            d={`M${w / 2 - 52} ${h * 0.44} V ${h * 0.2} A 52 52 0 0 1 ${w / 2 + 52} ${h * 0.2} V ${h * 0.44}`}
            fill={num > 0.4 ? withAlphaM(tone, 0.12) : 'transparent'}
            stroke={withAlphaM(tone, 0.4 + 0.6 * num)}
            strokeWidth={3.5}
          />
        </svg>
        {/* 门②确认开关（默认未拨——须显式说一句丢弃） */}
        {which === 2 && confirm > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: micro ? 12 : 20,
              bottom: micro ? 10 : 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              opacity: confirm,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: micro ? 12 : 15, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>显式丢弃</span>
            <span
              style={{
                width: 46,
                height: 24,
                borderRadius: 12,
                border: `3px solid ${withAlphaM(theme.danger, 0.7)}`,
                position: 'relative',
                background: withAlphaM(theme.panel, 0.98),
              }}
            >
              {/* 开关柄恒停未拨位（默认拒绝态）——本镜不演示拨动 */}
              <span
                style={{
                  position: 'absolute',
                  left: 2,
                  top: 2,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: theme.dim,
                }}
              />
            </span>
          </div>
        ) : null}
        {/* 门③房+线小图（整条留下等人审——与门②删除态对照） */}
        {which === 3 && keep > 0.02 ? (
          <div style={{position: 'absolute', left: 0, right: 0, bottom: micro ? 10 : 16, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 0, opacity: keep}}>
            <svg width={130} height={52} viewBox="0 0 130 52">
              <line x1={4} y1={46} x2={70} y2={34} stroke={theme.line} strokeWidth={3.5} strokeLinecap="round" />
              <path d="M70 30 L84 18 L98 30 Z" fill="none" stroke={theme.line} strokeWidth={3} />
              <rect x={72} y={30} width={24} height={18} rx={3} fill={withAlphaM(theme.line, 0.16)} stroke={theme.line} strokeWidth={3} />
              <line x1={104} y1={46} x2={126} y2={46} stroke={withAlphaM(theme.dim, 0.8)} strokeWidth={3} strokeLinecap="round" strokeDasharray="5 5" />
            </svg>
          </div>
        ) : null}
        {/* 角标 */}
        <div style={{position: 'absolute', right: micro ? 8 : 12, top: micro ? 8 : 12, fontFamily: theme.mono, fontSize: micro ? 10 : 12, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.8}}>
          {tag}
        </div>
      </div>
    </div>
  );
};

/** 清点计数器（拆前清点——动态数字条 + 工况角标 + 上游限定签）。`value`
 *  离散给值（计数渲染红线：禁连续滚动——0→1 跳格由场景侧在词窗沿离散给）；
 *  `cells` 上限格；`capP` 限定签「须线连上游」（右计数必带——防「未推送恒
 *  为 0」的误导口径）；`capVoidP` 左计数限定签空缺（两维前提差异对照）；
 *  `flashP` 闪一拍；`micro` 镜缘小窗档（3-B 常驻——不显格只显数）。 */
export const CounterBar: React.FC<{
  x: number;
  y: number;
  w?: number;
  label: string;
  value: number;
  cells?: number;
  litP?: number;
  capP?: number;
  capVoidP?: number;
  cond?: string;
  flashP?: number;
  micro?: boolean;
  tone?: string;
}> = ({x, y, w = 330, label, value, cells = 6, litP = 1, capP = 0, capVoidP = 0, cond = '', flashP = 0, micro = false, tone}) => {
  const lit = clamp01v(litP);
  const cap = clamp01v(capP);
  const capVoid = clamp01v(capVoidP);
  const flash = clamp01v(flashP);
  const n = Math.max(0, Math.min(cells, Math.round(value)));
  const on = tone ?? theme.guard;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        opacity: lit,
        transform: `translateY(${(1 - lit) * 22}px)`,
      }}
    >
      <div
        style={{
          borderRadius: 12,
          border: `3px solid ${withAlphaM(on, 0.5 + 0.5 * flash)}`,
          background: withAlphaM(theme.panel, 0.96),
          padding: micro ? '8px 14px' : '14px 20px',
          boxShadow: flash > 0.05 ? `0 0 ${22 * flash}px ${withAlphaM(on, 0.5 * flash)}` : 'none',
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
          <span style={{fontFamily: theme.sans, fontSize: micro ? 17 : 21, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{label}</span>
          <span style={{fontFamily: theme.mono, fontSize: micro ? 24 : 34, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: n > 0 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>
            {n}
          </span>
          {cond ? (
            <span style={{fontFamily: theme.mono, fontSize: micro ? 10 : 12, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>{cond}</span>
          ) : null}
        </div>
        {!micro ? (
          <div style={{display: 'flex', gap: 6, marginTop: 10}}>
            {Array.from({length: cells}, (_, i) => (
              <span
                key={`cb${i}`}
                style={{
                  width: (w - 40 - (cells - 1) * 6) / cells,
                  height: 20,
                  borderRadius: 4,
                  border: `2px solid ${i < n ? on : withAlphaM(theme.dim, 0.5)}`,
                  background: i < n ? withAlphaM(on, 0.45) : 'transparent',
                }}
              />
            ))}
          </div>
        ) : null}
        {/* 限定签（须线连上游——右计数必带；左计数空缺对照） */}
        {cap > 0.02 ? (
          <div
            style={{
              marginTop: 10,
              padding: '3px 10px',
              borderRadius: 7,
              border: `2px solid ${withAlphaM(on, 0.8)}`,
              background: withAlphaM(on, 0.1),
              fontFamily: theme.sans,
              fontSize: 14,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              display: 'inline-block',
              opacity: cap,
            }}
          >
            须线连上游 · upstream
          </div>
        ) : null}
        {capVoid > 0.02 ? (
          <div
            style={{
              marginTop: 10,
              padding: '3px 10px',
              borderRadius: 7,
              border: `2px dashed ${withAlphaM(theme.dim, 0.5)}`,
              fontFamily: theme.sans,
              fontSize: 14,
              fontWeight: 700,
              color: theme.dim,
              whiteSpace: 'nowrap',
              display: 'inline-block',
              opacity: capVoid,
            }}
          >
            不看这条前提
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 事件日志条带（建/拆/留三色小事件签逐条入带——只增不改的追加语义）。
 *  `events` 各事件签的显形进度（kind: build=兰紫 / remove=警示红 / keep=
 *  确认绿——与 3-B 门卡色族对应）；`scanP` 放大镜扫过（0..1 → 0..带宽，
 *  命中事件高亮 `scanIdx`）；条带头端角标 events.jsonl。 */
export const EventLogBand: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  events: readonly {kind: 'build' | 'remove' | 'keep'; p: number}[];
  scanP?: number;
  scanIdx?: number;
}> = ({x, y, w = 1600, h = 130, litP = 1, events, scanP = 0, scanIdx = -1}) => {
  const lit = clamp01v(litP);
  const scan = clamp01v(scanP);
  const toneOf = (k: 'build' | 'remove' | 'keep') => (k === 'build' ? theme.line : k === 'remove' ? theme.danger : theme.ok);
  const charOf = (k: 'build' | 'remove' | 'keep') => (k === 'build' ? '建' : k === 'remove' ? '拆' : '留');
  const evW = 76;
  const evGap = 14;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: lit,
        transform: `translateY(${(1 - lit) * 26}px)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: `3px solid ${withAlphaM(theme.panelBorder, 0.95)}`,
          background: withAlphaM(theme.panel, 0.95),
        }}
      >
        {/* 条带头端角标 */}
        <div style={{position: 'absolute', left: 20, top: -34, display: 'flex', alignItems: 'baseline', gap: 12}}>
          <span style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>流水账</span>
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>{'events.jsonl · 只追加'}</span>
        </div>
        {/* 事件签列（左起逐条入带——追加语义：只增不改） */}
        <div style={{position: 'absolute', left: 24, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: evGap}}>
          {events.map((e, i) => {
            const p = clamp01v(e.p);
            const hot = i === scanIdx && scan > 0.05;
            return (
              <div
                key={`ev${i}`}
                style={{
                  width: evW,
                  height: 62,
                  borderRadius: 10,
                  border: `2.5px solid ${withAlphaM(toneOf(e.kind), 0.4 + 0.6 * p)}`,
                  background: withAlphaM(toneOf(e.kind), 0.1 + 0.1 * p),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.sans,
                  fontSize: 22,
                  fontWeight: 700,
                  color: p > 0.4 ? toneOf(e.kind) : theme.dim,
                  whiteSpace: 'nowrap',
                  opacity: p,
                  transform: `translateY(${(1 - p) * 18}px)`,
                  boxShadow: hot ? `0 0 ${20 * scan}px ${withAlphaM(theme.text, 0.55 * scan)}` : 'none',
                }}
              >
                {charOf(e.kind)}
              </div>
            );
          })}
        </div>
        {/* 放大镜扫过（可查的具象——扫中一条事件高亮） */}
        {scan > 0.02 && scan < 0.98 ? (
          <div
            style={{
              position: 'absolute',
              left: 40 + scan * (w - 160),
              top: h / 2 - 40,
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: `3.5px solid ${withAlphaM(theme.text, 0.8)}`,
              pointerEvents: 'none',
              boxShadow: `0 0 ${18 * scan}px ${withAlphaM(theme.text, 0.3 * scan)}`,
            }}
          >
            <div style={{position: 'absolute', right: -14, bottom: -10, width: 26, height: 4, borderRadius: 2, background: theme.text, transform: 'rotate(40deg)'}} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 环体 + 执行段工作目录指针（LoopRing 外层 SegArc 类包装——母题本体不动）。
 *  本集判定性契约：读写落在哪间房，由绑定说了算。`arcP` 执行段点亮（90°±26°
 *  底弧段）；`ptA/ptB` 指针两端靶点（绝对画布坐标——主目录 / 新房）；`swingP`
 *  0..1 自 A 摆向 B（单次摆动，指针摆角插值）；`ptrP` 指针线显形；`tagP`
 *  「工作目录」小签亮出。 */
export const WorkRing: React.FC<{
  x: number;
  y: number;
  size?: number;
  litP?: number;
  drawP?: number;
  dotProgress?: number;
  arcP?: number;
  ptA: {x: number; y: number};
  ptB: {x: number; y: number};
  swingP?: number;
  ptrP?: number;
  tagP?: number;
  dimP?: number;
}> = ({x, y, size = 250, litP = 1, drawP = 1, dotProgress, arcP = 0, ptA, ptB, swingP = 0, ptrP = 0, tagP = 0, dimP = 0}) => {
  const lit = clamp01v(litP);
  const arc = clamp01v(arcP);
  const swing = clamp01v(swingP);
  const ptr = clamp01v(ptrP);
  const tag = clamp01v(tagP);
  const dim = clamp01v(dimP);
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2 - 46;
  const from = {x: cx, y: cy + r}; // 执行段中点（90° 底位）
  const tx = ptA.x + (ptB.x - ptA.x) * swing;
  const ty = ptA.y + (ptB.y - ptA.y) * swing;
  const hx = from.x + (tx - from.x) * ptr;
  const hy = from.y + (ty - from.y) * ptr;
  const ang = (Math.atan2(ty - from.y, tx - from.x) * 180) / Math.PI;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, opacity: lit * (1 - 0.65 * dim), pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: x, top: y}}>
        <LoopRing size={size} draw={drawP} nodes={[]} showExit={false} showLabels={false} dotProgress={dotProgress} />
        <SegArc size={size} from={64} to={116} litP={arc} />
      </div>
      {/* 工作目录指针（执行段 → 当前绑定房——单次摆动） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <line
          x1={from.x}
          y1={from.y}
          x2={hx}
          y2={hy}
          stroke={theme.core}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray="12 8"
          opacity={0.9 * ptr}
        />
        {ptr > 0.9 ? (
          <>
            <g transform={`translate(${hx} ${hy}) rotate(${ang})`}>
              <path d="M -4 -12 L 16 0 L -4 12 Z" fill={theme.core} />
            </g>
            <circle cx={hx} cy={hy} r={22 + 5 * Math.sin(Math.PI * tag)} fill="none" stroke={theme.core} strokeWidth={3} opacity={0.35 + 0.4 * tag} />
          </>
        ) : null}
        {tag > 0.02 ? (
          <text
            x={from.x + 18}
            y={from.y + 34}
            fontFamily={theme.sans}
            fontSize={17}
            fontWeight={700}
            fill={theme.core}
            opacity={tag}
          >
            工作目录
          </text>
        ) : null}
      </svg>
    </div>
  );
};
