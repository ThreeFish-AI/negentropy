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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2–ep16 延续——
// LoopRing 描边色/线宽跨集恒定（theme.core = 陶土橙 #D97757 + RING_STROKE 6）
// = 逐字节拷贝的前提。本集契约（storyboard 前言，G1 修 F1 后口径）：主代理
// 环体恒 core 描边；队友环体走 bespoke 件 TeammateRing（同尺寸同描边线宽
// 副本、基线转速承前集），**本集新增状态变速调制**（WORK 加速 / IDLE 减速 /
// SHUTDOWN 收拢静止、认领回 WORK 高亮一小段）——变速一律经调用侧 prop 包装
// （phasedRing 喂 dotProgress），母题本体不动；全片场景一律 `nodes={[]}`
// （环体即循环本体，无站点标注态）、状态色一律经容器透明度承载（描边契约
// 不动）。

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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep16 逐字节
 * 拷贝（本集场景一律 `nodes={[]}`：环体即循环本体，无站点标注态；主代理橙环
 * 恒 core 描边——队友同款副本走 TeammateRing，仅描边色区分）。
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

/** 分段匀速环相位（环体变速的调用侧 prop 包装——LoopRing/TeammateRing 本体
 *  不动）：segs 按 at 升序给出各时段每圈秒数（sec ≤ 0 视为停转），phase 为
 *  逐段积分的连续 0..1（单调无跳变），供 dotProgress 消费。基线转速承前集
 *  2.5s/圈；WORK ≈1.3s（加速）/ IDLE ≈2.5s（减速回基线，呼吸侧写）/
 *  SHUTDOWN 停转（收拢静止由 draw/透明度承载）。 */
export const phasedRing = (
  frame: number,
  fps: number,
  segs: readonly {at: number; sec: number}[],
): number => {
  if (segs.length === 0) return 0;
  let phase = 0;
  let prev = segs[0].at;
  let sec = segs[0].sec;
  for (let i = 1; i < segs.length; i += 1) {
    const s = segs[i];
    const span = Math.max(0, Math.min(frame, s.at) - prev);
    phase += sec > 0 ? span / (fps * sec) : 0;
    prev = s.at;
    sec = s.sec;
  }
  phase += sec > 0 ? Math.max(0, frame - prev) / (fps * sec) : 0;
  return ((phase % 1) + 1) % 1;
};

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

/** 队友环体（品红同款副本——ep16 逐字节拷贝：与 LoopRing 同几何（r = size/2
 *  - 46）、同线宽（RING_STROKE）、同光点（r 11），仅描边色换 `stroke`（默认
 *  theme.mate）。本集状态变速经调用侧 phasedRing 喂 dotProgress（节拍器契约，
 *  母题本体不动）；draw 0→1 描线进度 = 自坐席亮起。 */
export const TeammateRing: React.FC<{
  size?: number;
  draw?: number;
  dotProgress?: number;
  stroke?: string;
  opacity?: number;
}> = ({size = 460, draw = 1, dotProgress, stroke, opacity = 1}) => {
  const on = stroke ?? theme.mate;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 46;
  const dot = dotProgress === undefined ? null : polar(cx, cy, r, -90 + dotProgress * 360);
  return (
    <svg width={size} height={size} style={{overflow: 'visible', opacity: clamp01v(opacity)}}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={on}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - clamp01v(draw)}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {dot ? <circle cx={dot.x} cy={dot.y} r={11} fill={on} /> : null}
    </svg>
  );
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

/** 环上高亮一小段（认领回 WORK 的高亮段——**非整环**，2-C 契约）：与
 *  TeammateRing 同几何（r = size/2 - 46）叠放；from..to 为段位角（-90 = 12
 *  点），`litP` 0..1 显形（一小段点亮 + 微辉光），tone 缺省 mate。 */
export const SegArc: React.FC<{size: number; from: number; to: number; litP: number; tone?: string}> = ({
  size,
  from,
  to,
  litP,
  tone,
}) => {
  const on = tone ?? theme.mate;
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

/** 信箱文件（ep16 逐字节拷贝——承 ep15 同款签名：1-E「队长收件箱格口」跨集
 *  设施连续性件）。全片同形约束：文件体 + 文件名角标 + 湛蓝描边跨镜恒定。
 *  `litP` 显形；`rows` 箱内条目数；`appendP` 追加一行逐字落格（发信语义）；
 *  `takeP` 整摞打包升起离箱（收信语义）；`glowP` 待取辉光；`count` 计数角标
 *  （-1 不显）；`scanP` 探测光扫过箱面。 */
export const MailboxFile: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  name?: string;
  litP?: number;
  rows?: number;
  appendP?: number;
  appendText?: string;
  takeP?: number;
  glowP?: number;
  count?: number;
  lockP?: number;
  scanP?: number;
}> = ({
  x,
  y,
  w = 360,
  h = 300,
  name = 'lead.jsonl',
  litP = 1,
  rows = 0,
  appendP = 0,
  appendText = '{"from":"alice","say":"数据库·建好"}',
  takeP = 0,
  glowP = 0,
  count = -1,
  lockP = 0,
  scanP = 0,
}) => {
  const lit = clamp01v(litP);
  const take = clamp01v(takeP);
  const append = clamp01v(appendP);
  const lock = clamp01v(lockP);
  const scan = clamp01v(scanP);
  const bodyRows = rows;
  const shownRows = take > 0 ? 0 : bodyRows;
  const appendChars = Math.round(appendText.length * append);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: lit}}>
      <div
        style={{
          position: 'absolute',
          inset: -10,
          borderRadius: 20,
          boxShadow: glowP > 0.03 ? `0 0 ${26 * glowP}px ${withAlphaM(theme.inbox, 0.55 * glowP)}` : 'none',
          border: glowP > 0.03 ? `2px solid ${withAlphaM(theme.inbox, 0.5 * glowP)}` : '2px solid transparent',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          height: h,
          borderRadius: 14,
          border: `3px solid ${withAlphaM(theme.inbox, 0.85)}`,
          background: withAlphaM(theme.panel, 0.97),
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderBottom: `2px solid ${withAlphaM(theme.panelBorder, 0.9)}`,
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.inbox,
            letterSpacing: 0.5,
            whiteSpace: 'nowrap',
          }}
        >
          <svg width={20} height={20} viewBox="0 0 20 20">
            <path d="M3 2 h9 l4 4 v12 h-13 z" fill="none" stroke={theme.inbox} strokeWidth={2} />
            <path d="M12 2 v4 h4" fill="none" stroke={theme.inbox} strokeWidth={2} />
          </svg>
          {name}
        </div>
        {Array.from({length: shownRows}, (_, i) => (
          <div
            key={`mb-r${i}`}
            style={{
              margin: '10px 16px 0',
              height: 22,
              borderRadius: 5,
              background: withAlphaM(theme.inbox, 0.3),
              border: `2px solid ${withAlphaM(theme.inbox, 0.55)}`,
              opacity: 0.95,
            }}
          />
        ))}
        {append > 0.01 && take <= 0 ? (
          <div
            style={{
              margin: '10px 16px 0',
              padding: '5px 10px',
              minHeight: 22,
              borderRadius: 5,
              background: withAlphaM(theme.inbox, 0.14),
              border: `2px dashed ${withAlphaM(theme.inbox, 0.7)}`,
              fontFamily: theme.mono,
              fontSize: 15,
              color: theme.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {appendText.slice(0, appendChars)}
            <span style={{color: theme.inbox, opacity: append < 0.99 ? 1 : 0}}>{'▍'}</span>
          </div>
        ) : null}
        {take > 0.01 && take < 0.99 && bodyRows > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              top: 78,
              transform: `translateY(${-take * (h * 0.7)}px)`,
              opacity: 1 - take,
              pointerEvents: 'none',
            }}
          >
            {Array.from({length: bodyRows}, (_, i) => (
              <div
                key={`mb-t${i}`}
                style={{
                  height: 22,
                  margin: '10px 0 0',
                  borderRadius: 5,
                  background: withAlphaM(theme.inbox, 0.4),
                  border: `2px solid ${withAlphaM(theme.inbox, 0.8)}`,
                }}
              />
            ))}
          </div>
        ) : null}
        {scan > 0.02 && scan < 0.98 ? (
          <div
            style={{
              position: 'absolute',
              top: -6,
              bottom: -6,
              left: scan * (w + 40) - 20,
              width: 26,
              borderRadius: 8,
              background: `linear-gradient(90deg, transparent, ${withAlphaM(theme.inbox, 0.5)}, transparent)`,
              pointerEvents: 'none',
            }}
          />
        ) : null}
        {count >= 0 ? (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 14,
              fontFamily: theme.mono,
              fontSize: 20,
              fontVariantNumeric: 'tabular-nums',
              color: count === 0 ? theme.danger : theme.inbox,
              whiteSpace: 'nowrap',
            }}
          >
            {`${count} 条`}
          </div>
        ) : null}
        {lock > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              top: -20,
              left: -16,
              opacity: lock,
              transform: `translateY(${(1 - lock) * -14}px)`,
            }}
          >
            <svg width={44} height={44} viewBox="0 0 44 44">
              <rect x={8} y={18} width={28} height={20} rx={5} fill={theme.panel} stroke={theme.inbox} strokeWidth={3} />
              <path d="M14 18 v-5 a8 8 0 0 1 16 0 v5" fill="none" stroke={theme.inbox} strokeWidth={3} opacity={lock > 0.6 ? 1 : 0.4} />
              <circle cx={22} cy={28} r={3} fill={theme.inbox} opacity={lock} />
            </svg>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 消融双轨骨架（ep16 逐字节拷贝——3-C/3-D 全片张力峰值；左红右绿恒定，
 *  等高并置同题裁决）。轨内容（迷你钟 / 空卡 / 写名箭头 / 日志行 / 计数器）
 *  由调用场景按 CHECK_LANES 常量摆位——装置只承载轨道背板 + 轨头标签。 */
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

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep17 Autonomous Agents）
// storyboard 实现映射登记：DutyClock / StatusLightBar / ConditionLamps /
// IdentityCard / BeatCounterRing / WallTaskCard（卡面承 ep12 签名）/ DepArrow /
// TrapCard / ClaimPipeline / CrackGap / SeatPicker / AblationSplit（ep16 拷贝）/
// CriticalSectionFrame / TwoLatchDoor / FiveStepBracket / RetryBand / MsDial /
// BacktrackLoop / PaceContrastBar / BalanceScale / AgentBody / NameTag /
// LookLine / GhostPair / TallyCounter。全片主装置 = 值班钟（watch 天蓝：起摆/
// 两落点探查/停摆/定格/缩微——钟摆两落点次序全片恒定先信后墙）；认领临界区
// 走 lock 洋红；反例/被挡走 danger；机制在位/单成功走 ok。哑装置原则承
// ep15/16：动效参数（进度/状态/读数）一律经 prop 由调用场景注入，装置自身
// 零 motion hook 调用（几何/条件内纯函数推进；唯一例外 useRingDot 族已在上）。

/** 教学版节律：每五秒一拍（IDLE_POLL_INTERVAL=5.0；storyboard：五秒是教学
 *  取值不是性能参数——失配拦截随行）。一拍 = 钟摆完整一圈：先摆到第一落点
 *  （信，左），回中，再摆到第二落点（墙，右），回中。 */
export const BEAT_FRAMES = 150;

/** 连续钟摆位（-1..1：-1 = 第一落点〔信·收件箱〕极位 → 0 回中 → +1 = 第二
 *  落点〔墙·任务墙〕极位）。零强调动效的匀速节拍器节奏（0-C 契约）。 */
export const pendSwing = (frame: number, at = 0): number =>
  -Math.sin((2 * Math.PI * Math.max(0, frame - at)) / BEAT_FRAMES);

/** DutyClock 几何系数（size 归一——场景侧 overlay〔锁扣/挂点〕共用同一组数） */
export const DUTY_GEO = {
  faceR: 0.4, // 钟面半径
  armLen: 0.78, // 摆臂长（自轴心）
  bobR: 0.07, // 摆锤半径
  maxDeg: 26, // 极位摆角
  hK: 1.3, // SVG 高度系数（落点签区）
} as const;

/** 值班钟（本集主装置——天蓝描边全片唯一）。钟体 + 钟摆 + 两落点签跨镜恒定、
 *  缩微（micro）前后不重绘。`swing` -1..1（-1=第一落点 / +1=第二落点——先信
 *  后墙次序由调用侧保证）；`litP` 点亮（0-B 首亮 punch 配 `glow`）；`probe1P/
 *  probe2P` 落点探查辉光（impulse 包络值由场景喂）；`micro` 迷你档（轨头基线
 *  钟/快拍对照小样——无落点签无刻度）。 */
export const DutyClock: React.FC<{
  x: number;
  y: number;
  size?: number;
  litP?: number;
  swing?: number;
  landing1P?: number;
  landing2P?: number;
  probe1P?: number;
  probe2P?: number;
  micro?: boolean;
  glow?: number;
}> = ({x, y, size = 260, litP = 1, swing = 0, landing1P = 0, landing2P = 0, probe1P = 0, probe2P = 0, micro = false, glow = 0}) => {
  const lit = clamp01v(litP);
  const sw = Math.max(-1, Math.min(1, swing));
  const l1 = clamp01v(landing1P);
  const l2 = clamp01v(landing2P);
  const p1 = clamp01v(probe1P);
  const p2 = clamp01v(probe2P);
  const cx = size / 2;
  const cy = size / 2;
  const faceR = size * DUTY_GEO.faceR;
  const armL = size * DUTY_GEO.armLen;
  const bobR = size * DUTY_GEO.bobR;
  const strokeW = Math.max(4, size * 0.018);
  const h = size * DUTY_GEO.hK;
  // 落点签中心（摆锤极位正下方——两落点等距分列）
  const landY = cy + Math.cos((DUTY_GEO.maxDeg * Math.PI) / 180) * armL + size * 0.06;
  const landDX = Math.sin((DUTY_GEO.maxDeg * Math.PI) / 180) * armL;
  const tagW = size * 0.46;
  const tagH = size * 0.15;
  const tag = (cxT: number, litT: number, probe: number, icon: 'mail' | 'wall', label: string) => {
    const on = clamp01v(litT);
    const pr = clamp01v(probe);
    return (
      <div
        key={label}
        style={{
          position: 'absolute',
          left: cxT - tagW / 2,
          top: landY - tagH / 2,
          width: tagW,
          height: tagH,
          borderRadius: 10,
          border: `${on > 0.4 ? '2.5px solid' : '2px dashed'} ${on > 0.4 ? withAlphaM(theme.watch, 0.9) : withAlphaM(theme.dim, 0.6)}`,
          background: withAlphaM(theme.panel, 0.96),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: size * 0.035,
          opacity: 0.4 + 0.6 * on,
          boxShadow: pr > 0.04 ? `0 0 ${26 * pr}px ${withAlphaM(theme.watch, 0.7 * pr)}` : 'none',
          transform: `scale(${1 + 0.08 * pr})`,
        }}
      >
        <svg width={size * 0.085} height={size * 0.085} viewBox="0 0 24 24">
          {icon === 'mail' ? (
            <path d="M3 6 h18 v13 h-18 z M3 6 l9 8 l9 -8" fill="none" stroke={on > 0.4 ? theme.watch : theme.dim} strokeWidth={2.2} />
          ) : (
            <g stroke={on > 0.4 ? theme.watch : theme.dim} strokeWidth={2.2}>
              <line x1={4} y1={7} x2={20} y2={7} />
              <line x1={4} y1={12} x2={20} y2={12} />
              <line x1={4} y1={17} x2={14} y2={17} />
            </g>
          )}
        </svg>
        <span style={{fontFamily: theme.sans, fontSize: size * 0.062, fontWeight: 700, color: on > 0.4 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>
          {label}
        </span>
      </div>
    );
  };
  return (
    <div style={{position: 'absolute', left: x, top: y, width: size, height: h, opacity: lit}}>
      {glow > 0.03 ? (
        <div
          style={{
            position: 'absolute',
            left: cx - faceR - 14,
            top: cy - faceR - 14,
            width: faceR * 2 + 28,
            height: faceR * 2 + 28,
            borderRadius: '50%',
            boxShadow: `0 0 ${44 * glow}px ${withAlphaM(theme.watch, 0.55 * glow)}`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <svg width={size} height={h} style={{overflow: 'visible'}}>
        {/* 钟面（天蓝描边全片唯一——群像装置描边 ≥4px） */}
        <circle
          cx={cx}
          cy={cy}
          r={faceR}
          fill={withAlphaM(theme.panel, 0.92)}
          stroke={withAlphaM(theme.watch, 0.4 + 0.6 * lit)}
          strokeWidth={strokeW}
        />
        {/* 拍刻度（四象限小刻——每五秒一拍的节律记号；micro 档省） */}
        {!micro
          ? [0, 90, 180, 270].map((a) => {
              const p1p = polar(cx, cy, faceR, a);
              const p2p = polar(cx, cy, faceR - size * 0.055, a);
              return <line key={`tk${a}`} x1={p1p.x} y1={p1p.y} x2={p2p.x} y2={p2p.y} stroke={withAlphaM(theme.watch, 0.5)} strokeWidth={Math.max(2, size * 0.01)} />;
            })
          : null}
        {/* 摆臂 + 摆锤（轴心旋转——swing 驱动，零强调动效） */}
        <g transform={`rotate(${(sw * DUTY_GEO.maxDeg).toFixed(2)} ${cx} ${cy})`}>
          <line x1={cx} y1={cy} x2={cx} y2={cy + armL} stroke={theme.watch} strokeWidth={Math.max(3, size * 0.016)} strokeLinecap="round" opacity={0.85} />
          <circle cx={cx} cy={cy + armL} r={bobR} fill={theme.watch} />
        </g>
        {/* 转轴点 */}
        <circle cx={cx} cy={cy} r={Math.max(4, size * 0.028)} fill={withAlphaM(theme.watch, 0.9)} />
      </svg>
      {/* 两落点签（第一=收件箱格口〔信〕 / 第二=任务墙方向〔墙〕——暗态待摆起逐个点亮） */}
      {!micro ? (
        <>
          {tag(cx - landDX, l1, p1, 'mail', '收件箱')}
          {tag(cx + landDX, l2, p2, 'wall', '任务墙')}
        </>
      ) : null}
    </div>
  );
};

/** 三格状态灯（全片恒定三态色：干活=暖白高频 / 空闲=天蓝呼吸 / 关机=暗灰收束）。
 *  `lit` 三格依次点亮进度（1-A 全谱 stagger）；`hot` 当前态格 + `pulse` 活动
 *  强度（暖白高频闪/天蓝呼吸的包络值由场景喂帧算——哑装置）。 */
export const STATUS_LABELS = ['WORK', 'IDLE', 'SHUTDOWN'] as const;
export const STATUS_ZH = ['干活', '空闲', '关机'] as const;
export const STATUS_TONE = [theme.text, theme.watch, theme.dim] as const;

export const StatusLightBar: React.FC<{
  x: number;
  y: number;
  w?: number;
  cellH?: number;
  lit?: readonly [number, number, number];
  hot?: 0 | 1 | 2;
  pulse?: number;
  vertical?: boolean;
}> = ({x, y, w = 150, cellH = 18, lit = [1, 1, 1], hot, pulse = 0, vertical = false}) => {
  const cellW = vertical ? w : (w - 16) / 3;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        gap: 8,
      }}
    >
      {[0, 1, 2].map((i) => {
        const on = clamp01v(lit[i]);
        const isHot = hot === i;
        const tone = STATUS_TONE[i];
        return (
          <div
            key={`st${i}`}
            style={{
              width: vertical ? w : cellW,
              height: cellH,
              borderRadius: cellH / 2,
              border: `${Math.max(2.5, cellH * 0.16)}px solid ${withAlphaM(tone, 0.3 + 0.7 * on)}`,
              background: isHot ? withAlphaM(tone, 0.25 + 0.5 * pulse) : 'transparent',
              boxShadow: isHot && pulse > 0.25 ? `0 0 ${14 * pulse}px ${withAlphaM(tone, 0.7 * pulse)}` : 'none',
              opacity: 0.35 + 0.65 * on,
            }}
          />
        );
      })}
    </div>
  );
};

/** 三条件灯卡面（判据面：没人做 / 没归属 / 依赖全完成——齐亮才放行写名）。
 *  第三行角标 blockedBy。`compact` 卡内迷你档。 */
export const COND_LABELS = ['没人做', '没归属', '依赖全完成'] as const;

export const ConditionLamps: React.FC<{
  x: number;
  y: number;
  w?: number;
  rowH?: number;
  lamps?: readonly [number, number, number];
  compact?: boolean;
}> = ({x, y, w = 240, rowH = 44, lamps = [0, 0, 0], compact = false}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, display: 'flex', flexDirection: 'column', gap: compact ? 8 : rowH - 30}}>
    {COND_LABELS.map((lb, i) => {
      const on = clamp01v(lamps[i]);
      return (
        <div key={`cl${i}`} style={{display: 'flex', alignItems: 'center', gap: compact ? 8 : 12, height: compact ? 22 : 30}}>
          <span
            style={{
              width: compact ? 14 : 18,
              height: compact ? 14 : 18,
              borderRadius: '50%',
              border: `${compact ? 2.5 : 3}px solid ${withAlphaM(theme.watch, 0.3 + 0.7 * on)}`,
              background: on > 0.4 ? theme.watch : 'transparent',
              boxShadow: on > 0.4 ? `0 0 ${12 * on}px ${withAlphaM(theme.watch, 0.65 * on)}` : 'none',
              flexShrink: 0,
            }}
          />
          <span style={{fontFamily: theme.sans, fontSize: compact ? 16 : 21, fontWeight: 600, color: on > 0.4 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>
            {lb}
          </span>
          {i === 2 && !compact ? (
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.8}}>{'blockedBy'}</span>
          ) : null}
        </div>
      );
    })}
  </div>
);

/** 身份说明卡（天蓝同族——钟侧的身份维护件；两枚小签：我是谁 / 干什么活）。
 *  `injP` 自清单头注入（滑入）；`flashP` 重写刷新闪一拍。 */
export const IdentityCard: React.FC<{x: number; y: number; w?: number; injP?: number; flashP?: number}> = ({
  x,
  y,
  w = 380,
  injP = 0,
  flashP = 0,
}) => {
  const inj = clamp01v(injP);
  const fl = clamp01v(flashP);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        borderRadius: 12,
        border: `3px solid ${withAlphaM(theme.watch, 0.85)}`,
        background: withAlphaM(theme.panel, 0.97),
        padding: '12px 18px',
        opacity: inj,
        transform: `translateX(${(1 - inj) * -36}px)`,
        boxShadow: fl > 0.03 ? `0 0 ${26 * fl}px ${withAlphaM(theme.watch, 0.6 * fl)}` : 'none',
      }}
    >
      <div style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.watch, whiteSpace: 'nowrap'}}>身份说明</div>
      <div style={{display: 'flex', gap: 10, marginTop: 8}}>
        {['我是谁', '干什么活'].map((s) => (
          <span
            key={s}
            style={{
              padding: '4px 14px',
              borderRadius: 8,
              border: `2.5px solid ${withAlphaM(theme.watch, 0.75)}`,
              background: withAlphaM(theme.watch, 0.1),
              fontFamily: theme.sans,
              fontSize: 17,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: inj,
            }}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
};

/** 十二拍计数环 + 六十秒表盘（钟的纪律面——12 拍 × 5s = 60s 双口径同帧可对）。
 *  `beats` 离散 0..12（计数渲染红线：调用侧离散给值、禁连续滚动）；
 *  `dialP` 表针 0..1 走满；`doneP` 到点落定拍。 */
export const BeatCounterRing: React.FC<{
  x: number;
  y: number;
  size?: number;
  beats: number;
  dialP?: number;
  doneP?: number;
  litP?: number;
}> = ({x, y, size = 280, beats, dialP = 0, doneP = 0, litP = 1}) => {
  const lit = clamp01v(litP);
  const n = Math.max(0, Math.min(12, Math.round(beats)));
  const cx = size / 2;
  const cy = size / 2;
  const rSeg = size / 2 - 10;
  const dialR = size * 0.26;
  const done = clamp01v(doneP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: size, height: size, opacity: lit}}>
      <svg width={size} height={size} style={{overflow: 'visible'}}>
        {Array.from({length: 12}, (_, i) => {
          const on = i < n;
          return (
            <path
              key={`seg${i}`}
              d={describeArc(cx, cy, rSeg, -90 + i * 30 + 2.5, -90 + (i + 1) * 30 - 2.5)}
              fill="none"
              stroke={on ? theme.watch : withAlphaM(theme.dim, 0.4)}
              strokeWidth={9}
              strokeLinecap="round"
            />
          );
        })}
        {/* 六十秒表盘（内圈——表针待走 → 走满到点） */}
        <circle cx={cx} cy={cy} r={dialR} fill={withAlphaM(theme.panel, 0.95)} stroke={withAlphaM(theme.dim, 0.7)} strokeWidth={3} />
        <line x1={cx} y1={cy} x2={cx} y2={cy - dialR + 8} stroke={theme.dim} strokeWidth={2.5} transform={`rotate(${(clamp01v(dialP) * 360).toFixed(1)} ${cx} ${cy})`} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={4} fill={theme.dim} />
        {done > 0.03 ? (
          <circle cx={cx} cy={cy} r={dialR + 8} fill="none" stroke={theme.ok} strokeWidth={3.5} opacity={done} />
        ) : null}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: size / 2 - 14,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: Math.max(18, size * 0.085),
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: done > 0.5 ? theme.ok : theme.text,
          whiteSpace: 'nowrap',
          opacity: 0.95,
        }}
      >
        {done > 0.5 ? '到点' : '60s'}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: size + 10, textAlign: 'center', fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>
        {'12 拍 × 5s = 60s'}
      </div>
    </div>
  );
};

/** 任务卡（卡面承 ep12 同款签名：编号签 + 状态徽点 + 任务名签 + 依赖小签 +
 *  serif 斜体名字签 + 完成对勾——跨集设施连续性形）。翻态：灰（dim 描边）→
 *  写名亮（claimP：描边→watch + 名字签写入）→ 进行中（activePillP 小签）→
 *  完成绿（greenP：描边→ok + 对勾）。`lamps` 三条件灯迷你列（P2 排版卡判据
 *  面）；`deps` 依赖小签（doneP 完成输入 / ghostP 幽灵编号）。 */
export const WallTaskCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  id: string;
  title: string;
  litP?: number;
  claimP?: number;
  signer?: string;
  greenP?: number;
  activePillP?: number;
  lamps?: readonly [number, number, number];
  deps?: readonly {id: string; doneP?: number; ghostP?: number}[];
  depsP?: number;
  hotP?: number;
  micro?: boolean;
}> = ({
  x,
  y,
  w = 340,
  h = 220,
  id,
  title,
  litP = 1,
  claimP = 0,
  signer,
  greenP = 0,
  activePillP = 0,
  lamps,
  deps,
  depsP = 0,
  hotP = 0,
  micro = false,
}) => {
  const lit = clamp01v(litP);
  const claim = clamp01v(claimP);
  const green = clamp01v(greenP);
  const hot = clamp01v(hotP);
  const edge = green > 0.02 ? mixHex(mixHex(theme.dim, theme.watch, claim), theme.ok, green) : mixHex(theme.dim, theme.watch, claim);
  const dot = green > 0.5 ? theme.ok : claim > 0.4 ? theme.watch : withAlphaM(theme.dim, 0.7);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          border: `${micro ? 2.5 : 3}px solid ${withAlphaM(edge, 0.55 + 0.45 * Math.max(claim, green))}`,
          background: withAlphaM(theme.panel, 0.94),
          boxShadow: green > 0.9 ? `0 0 ${16 * green}px ${withAlphaM(theme.ok, 0.35)}` : hot > 0.05 ? `0 0 ${20 * hot}px ${withAlphaM(theme.watch, 0.5 * hot)}` : 'none',
        }}
      >
        <div style={{position: 'absolute', left: micro ? 8 : 14, top: micro ? 7 : 12, fontFamily: theme.mono, fontSize: micro ? 11 : 16, color: theme.dim, whiteSpace: 'nowrap', letterSpacing: 1}}>
          {id}
        </div>
        <div style={{position: 'absolute', right: micro ? 9 : 16, top: micro ? 9 : 16, width: micro ? 10 : 16, height: micro ? 10 : 16, borderRadius: '50%', background: dot, opacity: 0.9}} />
        <div style={{position: 'absolute', left: micro ? 8 : 16, top: micro ? 26 : 44, fontFamily: theme.sans, fontSize: micro ? 17 : 30, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
          {title}
        </div>
        {lamps ? (
          <div style={{position: 'absolute', right: micro ? 8 : 16, top: micro ? 26 : 48}}>
            <ConditionLamps x={0} y={0} w={micro ? 120 : 170} lamps={lamps} compact />
          </div>
        ) : null}
        {deps && deps.length > 0 ? (
          <div style={{position: 'absolute', right: micro ? 8 : 14, bottom: micro ? 8 : 14, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', opacity: clamp01v(depsP)}}>
            {deps.map((d) => {
              const done = clamp01v(d.doneP ?? 0);
              const ghost = clamp01v(d.ghostP ?? 0);
              const edgeTone = ghost > 0.3 ? theme.danger : done > 0.4 ? theme.ok : theme.dim;
              return (
                <div
                  key={d.id}
                  style={{
                    width: micro ? 96 : 150,
                    padding: '3px 10px',
                    borderRadius: 7,
                    border: `2px ${ghost > 0.3 ? 'dashed' : 'solid'} ${withAlphaM(edgeTone, ghost > 0.3 ? 0.55 + 0.4 * ghost : 0.85)}`,
                    background: withAlphaM(theme.panel, 0.92),
                    fontFamily: theme.mono,
                    fontSize: micro ? 11 : 15,
                    color: ghost > 0.3 ? theme.danger : done > 0.4 ? theme.ok : theme.dim,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {ghost > 0.3 ? `${d.id.replace(/0+$/, '')}?` : d.id}
                </div>
              );
            })}
          </div>
        ) : null}
        {claim > 0.02 && signer ? (
          <div
            style={{
              position: 'absolute',
              left: micro ? 8 : 16,
              bottom: micro ? 8 : 14,
              fontFamily: theme.serif,
              fontSize: micro ? 15 : 24,
              fontStyle: 'italic',
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              width: `${claim * 46}%`,
            }}
          >
            {signer}
          </div>
        ) : null}
        {clamp01v(activePillP) > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: micro ? 8 : 16,
              bottom: micro ? 28 : 52,
              padding: micro ? '2px 8px' : '4px 12px',
              borderRadius: 8,
              border: `2.5px solid ${withAlphaM(theme.watch, 0.85)}`,
              background: withAlphaM(theme.watch, 0.12),
              fontFamily: theme.sans,
              fontSize: micro ? 12 : 16,
              fontWeight: 700,
              color: theme.watch,
              whiteSpace: 'nowrap',
              opacity: clamp01v(activePillP),
            }}
          >
            进行中
          </div>
        ) : null}
        {green > 0.5 ? (
          <svg width={micro ? 20 : 30} height={micro ? 20 : 30} viewBox="0 0 20 20" style={{position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', opacity: clamp01v(green * 2 - 1)}}>
            <path d="M 3 10.5 L 8 15.5 L 17 4.5" fill="none" stroke={theme.ok} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </div>
    </div>
  );
};

/** 依赖线（单向箭头——被依赖 → 依赖；箭头方向=依赖方向，场景侧保证单向）。
 *  `drawP` 描线；`litP` 依赖满足后的点亮（暗态 dim → 亮态 watch）。 */
export const DepArrow: React.FC<{x1: number; y1: number; x2: number; y2: number; drawP?: number; litP?: number}> = ({
  x1,
  y1,
  x2,
  y2,
  drawP = 0,
  litP = 0,
}) => {
  const d = clamp01v(drawP);
  const lit = clamp01v(litP);
  const hx = x1 + (x2 - x1) * d;
  const hy = y1 + (y2 - y1) * d;
  const tone = mixHex(theme.dim, theme.watch, lit);
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <line x1={x1} y1={y1} x2={hx} y2={hy} stroke={tone} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - d} opacity={0.55 + 0.45 * lit} />
      {d > 0.92 ? (
        <g transform={`translate(${x2} ${y2}) rotate(${ang})`}>
          <path d="M -16 -9 L 2 0 L -16 9 Z" fill={tone} />
        </g>
      ) : null}
    </svg>
  );
};

/** 陷阱卡（基线行为=纹丝不动：幽灵编号 task_999 显形 + 依赖红灯常亮〔非闪烁〕
 *  + 拦截绿灯〔按被挡算·机制在位〕双灯对照）。半悬墙角（微倾）。 */
export const TrapCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  ghostP?: number;
  redP?: number;
  gateP?: number;
  zoomP?: number;
}> = ({x, y, w = 300, h = 170, litP = 1, ghostP = 0, redP = 0, gateP = 0, zoomP = 0}) => {
  const lit = clamp01v(litP);
  const ghost = clamp01v(ghostP);
  const red = clamp01v(redP);
  const gate = clamp01v(gateP);
  const zoom = clamp01v(zoomP);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: lit,
        transform: `rotate(-4deg) scale(${1 + 0.3 * zoom})`,
        transformOrigin: '50% 50%',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          border: `3px solid ${withAlphaM(theme.panelBorder, 0.95)}`,
          background: withAlphaM(theme.panel, 0.94),
        }}
      >
        <div style={{position: 'absolute', left: 14, top: 12, fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap', letterSpacing: 1}}>
          task_013
        </div>
        <div style={{position: 'absolute', left: 14, top: 42, fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
          悬空依赖
        </div>
        {/* 依赖栏幽灵编号（不存在的编号——dashed danger 显形） */}
        <div
          style={{
            position: 'absolute',
            right: 14,
            top: 14,
            padding: '3px 10px',
            borderRadius: 7,
            border: `2px dashed ${withAlphaM(theme.danger, 0.55 + 0.4 * ghost)}`,
            background: withAlphaM(theme.panel, 0.92),
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.danger,
            whiteSpace: 'nowrap',
            opacity: 0.3 + 0.7 * ghost,
          }}
        >
          {ghost > 0.3 ? 'task_999?' : 'task_···'}
        </div>
        {/* 双灯对照：依赖红灯（常亮）↔ 拦截绿灯（机制在位） */}
        <div style={{position: 'absolute', left: 14, bottom: 12, display: 'flex', gap: 18}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 8, opacity: 0.25 + 0.75 * red}}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: `3px solid ${withAlphaM(theme.danger, 0.85)}`,
                background: red > 0.4 ? theme.danger : 'transparent',
                boxShadow: red > 0.4 ? `0 0 12px ${withAlphaM(theme.danger, 0.5)}` : 'none',
              }}
            />
            <span style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: red > 0.4 ? theme.danger : theme.dim, whiteSpace: 'nowrap'}}>依赖未满足</span>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 8, opacity: 0.25 + 0.75 * gate}}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: `3px solid ${withAlphaM(theme.ok, 0.85)}`,
                background: gate > 0.4 ? theme.ok : 'transparent',
                boxShadow: gate > 0.4 ? `0 0 ${16 * gate}px ${withAlphaM(theme.ok, 0.6 * gate)}` : 'none',
              }}
            />
            <span style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: gate > 0.4 ? theme.ok : theme.dim, whiteSpace: 'nowrap'}}>按被挡算</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/** 窗口裂缝（3-A 裂开 → 4-A 焊死愈合的同款同向件：竖向锯齿双线，张开量由
 *  openP 起、sealP 回收闭合 + 焊点显形；缝间洋红窗口辉光=查与写之间的窗口）。
 *  `bareP` 无护栏裸露态（3-B 教学版没有这把锁——窗口敞开、无任何包裹）。 */
export const CrackGap: React.FC<{
  x: number;
  y: number;
  h: number;
  openP?: number;
  sealP?: number;
  bareP?: number;
  tone?: string;
}> = ({x, y, h, openP = 0, sealP = 0, bareP = 0, tone}) => {
  const open = clamp01v(openP) * (1 - clamp01v(sealP));
  const seal = clamp01v(sealP);
  const bare = clamp01v(bareP);
  const on = tone ?? theme.lock;
  const gap = open * 34;
  const W = 150;
  const H = h + 16;
  const cx = W / 2;
  const jag = (dx: number) =>
    `M ${(cx + dx).toFixed(1)} 8 l 5 ${h * 0.22} l -8 ${h * 0.2} l 7 ${h * 0.22} l -6 ${h * 0.2} l 6 ${h * 0.16}`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: x - W / 2, top: y - 8, overflow: 'visible', pointerEvents: 'none'}}>
      {/* 窗口辉光（缝间——查与写之间的窗口；bare 态更敞更裸） */}
      {open > 0.03 ? (
        <rect
          x={cx - gap / 2 - 7}
          y={2}
          width={gap + 14}
          height={h + 12}
          rx={6}
          fill={withAlphaM(on, (0.16 + 0.22 * bare) * open)}
          stroke={withAlphaM(on, 0.5 * open)}
          strokeWidth={2}
        />
      ) : null}
      {/* 锯齿双线（左右两半——张开/闭合） */}
      <path d={jag(-gap / 2)} fill="none" stroke={on} strokeWidth={3.5} strokeLinecap="round" opacity={0.35 + 0.65 * open} />
      <path d={jag(gap / 2)} fill="none" stroke={on} strokeWidth={3.5} strokeLinecap="round" opacity={0.35 + 0.65 * open} />
      {/* 焊点（愈合后——三枚焊疤跨缝钉死） */}
      {seal > 0.4
        ? [0.22, 0.5, 0.78].map((f, i) => (
            <g key={`weld${i}`} opacity={clamp01v((seal - 0.4) * 1.6)}>
              <line x1={cx - 14} y1={8 + h * f} x2={cx + 14} y2={8 + h * f} stroke={on} strokeWidth={4} strokeLinecap="round" />
              <line x1={cx - 7} y1={8 + h * f - 6} x2={cx + 7} y2={8 + h * f + 6} stroke={on} strokeWidth={3} strokeLinecap="round" />
            </g>
          ))
        : null}
    </svg>
  );
};

/** 认领三步流水条（读卡 → 查归属 → 写名字；第二、三节点之间=窗口裂缝位）。
 *  `stepsP` 三节点 stagger 铺出；`snapP` 快照定格框闪一拍（扫描帧冻结）；
 *  `crackP` 裂缝裂开（洋红窗口色亮出）；`sealP` 焊死愈合（4-A 前后呼应件）；
 *  `bareP` 无护栏裸露（3-B 碎散后）。 */
export const ClaimPipeline: React.FC<{
  x: number;
  y: number;
  w?: number;
  stepsP?: readonly [number, number, number];
  snapP?: number;
  crackP?: number;
  sealP?: number;
  bareP?: number;
  litP?: number;
}> = ({x, y, w = 1180, stepsP = [0, 0, 0], snapP = 0, crackP = 0, sealP = 0, bareP = 0, litP = 1}) => {
  const lit = clamp01v(litP);
  const snap = clamp01v(snapP);
  const labels = ['读卡', '查归属', '写名字'];
  const nodeW = 250;
  const gapN = (w - nodeW * 3) / 2;
  const barY = 42;
  const barH = 10;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: 96, opacity: lit}}>
      {/* 快照定格框（扫描帧冻结—— dashed 框套前两步一拍） */}
      {snap > 0.03 ? (
        <div
          style={{
            position: 'absolute',
            left: -18,
            top: -16,
            width: nodeW * 2 + gapN + 36,
            height: 128,
            borderRadius: 12,
            border: `3px dashed ${withAlphaM(theme.text, 0.85 * snap)}`,
            boxShadow: snap > 0.2 ? `0 0 ${22 * snap}px ${withAlphaM(theme.text, 0.35 * snap)}` : 'none',
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {/* 连接杆（前段整杆；后段被裂缝隔开） */}
      <div style={{position: 'absolute', left: nodeW, top: barY, width: gapN, height: barH, borderRadius: 5, background: withAlphaM(theme.dim, 0.55)}} />
      <div style={{position: 'absolute', left: nodeW * 2 + gapN, top: barY, width: gapN, height: barH, borderRadius: 5, background: withAlphaM(theme.dim, 0.55)}} />
      {labels.map((lb, i) => {
        const on = clamp01v(stepsP[i]);
        return (
          <div
            key={`cp${i}`}
            style={{
              position: 'absolute',
              left: i * (nodeW + gapN),
              top: 0,
              width: nodeW,
              height: 96,
              borderRadius: 12,
              border: `3px solid ${on > 0.4 ? withAlphaM(theme.watch, 0.9) : withAlphaM(theme.panelBorder, 0.95)}`,
              background: withAlphaM(theme.panel, 0.96),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              opacity: 0.4 + 0.6 * on,
              transform: `translateY(${(1 - on) * 14}px)`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 26, color: on > 0.4 ? theme.watch : theme.dim}}>{`①②③`[i]}</span>
            <span style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 700, color: on > 0.4 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{lb}</span>
          </div>
        );
      })}
      {/* 裂缝（第二、三节点之间——杆中竖裂，禁止出现在第一、二步之间） */}
      <CrackGap x={nodeW * 2 + gapN - gapN / 2} y={14} h={68} openP={crackP} sealP={sealP} bareP={bareP} />
      {/* 角标 */}
      <div style={{position: 'absolute', left: 0, top: -34, fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>
        {'claim · 查与写之间的窗口'}
      </div>
    </div>
  );
};

/** 选座界面（电影院类比——3-B 即收镜）：座格网格 + 一个空座高亮 + 双光标同悬
 *  + 锁座/下单两按钮融合成一枚不可分割按钮。落位-点亮解耦：`seatIn` 座格
 *  stagger 落位（暗态），`emptyLitP` 空座后点亮；`mergeP` 融合动画；`settleP`
 *  落定一拍；`shatterP` 碎散（教学版没有这把锁）。 */
export const SeatPicker: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  seatIn?: readonly number[];
  emptyLitP?: number;
  hoverP?: number;
  mergeP?: number;
  settleP?: number;
  shatterP?: number;
}> = ({x, y, w = 820, h = 560, litP = 1, seatIn = [], emptyLitP = 0, hoverP = 0, mergeP = 0, settleP = 0, shatterP = 0}) => {
  const lit = clamp01v(litP);
  const empty = clamp01v(emptyLitP);
  const hover = clamp01v(hoverP);
  const merge = clamp01v(mergeP);
  const settle = clamp01v(settleP);
  const shatter = clamp01v(shatterP);
  const cols = 8;
  const rows = 4;
  const seatW = 62;
  const seatH = 48;
  const gap = 16;
  const gridW = cols * (seatW + gap) - gap;
  const gridH = rows * (seatH + gap) - gap;
  const gx = (w - gridW) / 2;
  const gy = 70;
  const emptyIdx = 1 * cols + 4; // 第二行第五座（网格中部的空座）
  const emptyX = gx + (emptyIdx % cols) * (seatW + gap) + seatW / 2;
  const emptyY = gy + Math.floor(emptyIdx / cols) * (seatH + gap) + seatH / 2;
  const btnY = gy + gridH + 56;
  const cursor = (dx: number, tone: string, k: string) => (
    <svg key={k} width={64} height={64} viewBox="0 0 64 64" style={{position: 'absolute', left: emptyX - 32 + dx, top: emptyY - 78 + (1 - hover) * -46, opacity: hover, overflow: 'visible'}}>
      <path d="M32 6 L32 46 M32 6 L18 22 M32 6 L46 22" stroke={tone} strokeWidth={5.5} strokeLinecap="round" fill="none" transform="rotate(180 32 26)" />
    </svg>
  );
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 16,
        border: `3px solid ${withAlphaM(theme.panelBorder, 0.95)}`,
        background: withAlphaM(theme.panel, 0.95),
        opacity: lit,
      }}
    >
      <div style={{padding: '18px 26px 0', fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
        选座
        <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginLeft: 14}}>{'atomic'}</span>
      </div>
      {/* 座格网格（落位先于点亮——暗态落座、空座后亮） */}
      {Array.from({length: cols * rows}, (_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const isIn = clamp01v(seatIn[i] ?? 0);
        const isEmpty = i === emptyIdx;
        return (
          <div
            key={`seat${i}`}
            style={{
              position: 'absolute',
              left: gx + col * (seatW + gap),
              top: gy + row * (seatH + gap),
              width: seatW,
              height: seatH,
              borderRadius: 9,
              border: `${isEmpty ? 3.5 : 2.5}px solid ${isEmpty ? withAlphaM(theme.watch, 0.5 + 0.5 * empty) : withAlphaM(theme.dim, 0.55)}`,
              background: isEmpty ? withAlphaM(theme.watch, 0.1 + 0.18 * empty) : withAlphaM(theme.dim, 0.16),
              opacity: isIn * (isEmpty ? 1 : 0.85),
              transform: `translateY(${(1 - isIn) * 16}px)`,
              boxShadow: isEmpty && empty > 0.5 ? `0 0 ${18 * empty}px ${withAlphaM(theme.watch, 0.55 * empty)}` : 'none',
            }}
          />
        );
      })}
      {/* 双光标（两队友品红系色——同时悬停不分先后） */}
      {hover > 0.02 ? (
        <>
          {cursor(-20, theme.mate, 'c1')}
          {cursor(20, mixHex(theme.mate, '#FFFFFF', 0.42), 'c2')}
        </>
      ) : null}
      {/* 锁座 + 下单 → 合成一枚不可分割按钮（融合动画——原子性具象） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: btnY, display: 'flex', justifyContent: 'center', gap: 22 - 22 * merge}}>
        <div
          style={{
            padding: '12px 30px',
            borderRadius: 11,
            border: `3px solid ${withAlphaM(theme.watch, 0.85)}`,
            background: withAlphaM(theme.panel, 0.97),
            fontFamily: theme.sans,
            fontSize: 24,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            transform: `translateX(${-merge * 108}px) scaleX(${1 - 0.12 * merge})`,
            opacity: 1 - merge,
          }}
        >
          锁座
        </div>
        <div
          style={{
            padding: '12px 30px',
            borderRadius: 11,
            border: `3px solid ${withAlphaM(theme.watch, 0.85)}`,
            background: withAlphaM(theme.panel, 0.97),
            fontFamily: theme.sans,
            fontSize: 24,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            transform: `translateX(${merge * 108}px) scaleX(${1 - 0.12 * merge})`,
            opacity: 1 - merge,
          }}
        >
          下单
        </div>
      </div>
      {merge > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: w / 2 - 170,
            top: btnY,
            width: 340,
            padding: '12px 0',
            textAlign: 'center',
            borderRadius: 12,
            border: `${4.5 + 1.5 * settle}px solid ${withAlphaM(theme.watch, 0.9)}`,
            background: withAlphaM(theme.watch, 0.14),
            fontFamily: theme.sans,
            fontSize: 24,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: merge,
            transform: `scale(${0.8 + 0.2 * merge + 0.05 * settle})`,
            boxShadow: settle > 0.03 ? `0 0 ${30 * settle}px ${withAlphaM(theme.watch, 0.6 * settle)}` : 'none',
          }}
        >
          锁座下单 · 一步
        </div>
      ) : null}
      {/* 碎散（教学版恰恰没有这把锁——合成按钮位碎散、窗口裸露） */}
      {shatter > 0.02
        ? [0, 1, 2, 3].map((i) => {
            const ang = [(-Math.PI / 3), (-Math.PI / 6), Math.PI / 6, Math.PI / 3][i];
            return (
              <div
                key={`sh${i}`}
                style={{
                  position: 'absolute',
                  left: w / 2 - 60 + Math.cos(ang) * shatter * 210,
                  top: btnY + 12 + Math.sin(ang) * shatter * 120,
                  width: 110,
                  height: 40,
                  borderRadius: 8,
                  border: `3px solid ${withAlphaM(theme.dim, 0.8 * (1 - shatter * 0.7))}`,
                  background: withAlphaM(theme.panel, 0.95),
                  transform: `rotate(${shatter * (i % 2 === 0 ? 14 : -11)}deg)`,
                  opacity: (1 - shatter) * merge,
                }}
              />
            );
          })
        : null}
    </div>
  );
};

/** 洋红临界区框（一次只许一个人进的代码段——排他窗口）。`laneP` 单人通道宽度
 *  图示（括口 + 一人宽剪影）；`runningP` 运行中内辉光；`cap` 容量读出
 *  （框内至多一人）。 */
export const CriticalSectionFrame: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  litP?: number;
  laneP?: number;
  runningP?: number;
}> = ({x, y, w, h, litP = 1, laneP = 0, runningP = 0}) => {
  const lit = clamp01v(litP);
  const lane = clamp01v(laneP);
  const run = clamp01v(runningP);
  const c = 26;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: `4px solid ${withAlphaM(theme.lock, 0.55 + 0.45 * Math.max(lane, run))}`,
          background: withAlphaM(theme.lock, 0.05 + 0.09 * run),
          boxShadow: run > 0.05 ? `0 0 ${30 * run}px ${withAlphaM(theme.lock, 0.4 * run)}` : 'none',
        }}
      />
      {/* 四角强标记（临界区框的「代码段」读感） */}
      <svg width={w} height={h} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        {[
          `M 4 ${c} L 4 4 L ${c} 4`,
          `M ${w - c} 4 L ${w - 4} 4 L ${w - 4} ${c}`,
          `M ${w - 4} ${h - c} L ${w - 4} ${h - 4} L ${w - c} ${h - 4}`,
          `M ${c} ${h - 4} L 4 ${h - 4} L 4 ${h - c}`,
        ].map((d, i) => (
          <path key={`cc${i}`} d={d} fill="none" stroke={theme.lock} strokeWidth={5} strokeLinecap="round" opacity={0.9} />
        ))}
      </svg>
      <div style={{position: 'absolute', left: 18, top: -34, display: 'flex', alignItems: 'baseline', gap: 12}}>
        <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.lock, whiteSpace: 'nowrap'}}>写名 · 一次一人</span>
        <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>{'critical section'}</span>
      </div>
      {/* 单人通道（门口宽度括口 + 一人宽剪影——同时只容一人宽度可读） */}
      {lane > 0.02 ? (
        <div style={{position: 'absolute', left: w / 2 - 44, top: -12, opacity: lane, display: 'flex', alignItems: 'flex-end', gap: 10}}>
          <svg width={88} height={78} viewBox="0 0 88 78">
            <path d="M2 8 L2 70" stroke={theme.lock} strokeWidth={4} strokeLinecap="round" />
            <path d="M86 8 L86 70" stroke={theme.lock} strokeWidth={4} strokeLinecap="round" />
            <rect x={30} y={22} width={28} height={44} rx={7} fill="none" stroke={withAlphaM(theme.dim, 0.9)} strokeWidth={3} />
          </svg>
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap', marginBottom: 8}}>单人通道</span>
        </div>
      ) : null}
    </div>
  );
};

/** 写名间门（两道闩：进程锁闩落机体内部位 / 文件锁闩落磁盘文件位——两把锁
 *  各管一层、非重复元素）+ 门内「重读一遍卡」提示牌 + 底部单人通道。
 *  `latchAP/latchBP` 两闩先后扣上（p4-03 前禁预扣）；`hintP` 提示牌亮出；
 *  `laneP` 单人通道。 */
export const TwoLatchDoor: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  latchAP?: number;
  latchBP?: number;
  hintP?: number;
  laneP?: number;
}> = ({x, y, w = 150, h = 340, litP = 1, latchAP = 0, latchBP = 0, hintP = 0, laneP = 0}) => {
  const lit = clamp01v(litP);
  const la = clamp01v(latchAP);
  const lb = clamp01v(latchBP);
  const hint = clamp01v(hintP);
  const lane = clamp01v(laneP);
  const latch = (topY: number, p: number, fromLeft: boolean, label: string, icon: 'chip' | 'disk') => {
    const slide = (1 - p) * (fromLeft ? -1 : 1) * 64;
    return (
      <div style={{position: 'absolute', left: -34, top: topY, width: w + 68, height: 74, opacity: 0.3 + 0.7 * p}}>
        {/* 闩槽（两侧托座） */}
        <div style={{position: 'absolute', left: 0, top: 26, width: 20, height: 22, borderRadius: 4, border: `3px solid ${withAlphaM(theme.lock, 0.8)}`}} />
        <div style={{position: 'absolute', right: 0, top: 26, width: 20, height: 22, borderRadius: 4, border: `3px solid ${withAlphaM(theme.lock, 0.8)}`}} />
        {/* 闩条（滑入扣上） */}
        <div
          style={{
            position: 'absolute',
            left: 14 + slide,
            right: 14 - slide,
            top: 30,
            height: 14,
            borderRadius: 7,
            background: theme.lock,
            opacity: 0.4 + 0.6 * p,
          }}
        />
        {/* 标签（闩落位侧——机体内部位 / 磁盘文件位） */}
        <div
          style={{
            position: 'absolute',
            left: fromLeft ? w + 40 : -30,
            top: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            transform: `translateX(${fromLeft ? 0 : -100}%)`,
          }}
        >
          <svg width={22} height={22} viewBox="0 0 24 24">
            {icon === 'chip' ? (
              <g stroke={theme.lock} strokeWidth={2.2} fill="none">
                <rect x={6} y={6} width={12} height={12} rx={2} />
                <line x1={10} y1={2} x2={10} y2={6} />
                <line x1={14} y1={2} x2={14} y2={6} />
                <line x1={10} y1={18} x2={10} y2={22} />
                <line x1={14} y1={18} x2={14} y2={22} />
              </g>
            ) : (
              <g stroke={theme.lock} strokeWidth={2.2} fill="none">
                <path d="M4 3 h11 l5 5 v13 h-16 z" />
                <path d="M15 3 v5 h5" />
              </g>
            )}
          </svg>
          <span style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.lock, whiteSpace: 'nowrap'}}>{label}</span>
        </div>
      </div>
    );
  };
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          border: `4px solid ${withAlphaM(theme.lock, 0.85)}`,
          background: withAlphaM(theme.panel, 0.96),
          boxShadow: la > 0.5 && lb > 0.5 ? `0 0 ${26 * Math.min(la, lb)}px ${withAlphaM(theme.lock, 0.35)}` : 'none',
        }}
      >
        <div style={{position: 'absolute', left: 0, right: 0, top: 12, textAlign: 'center', fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
          写名间
        </div>
        {/* 门内提示牌（进门先重读一遍卡——锁内重读防 TOCTOU） */}
        {hint > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: 14,
              right: 14,
              top: h / 2 - 6,
              padding: '10px 10px',
              borderRadius: 9,
              border: `2.5px dashed ${withAlphaM(theme.lock, 0.85)}`,
              background: withAlphaM(theme.panel, 0.98),
              fontFamily: theme.sans,
              fontSize: 17,
              fontWeight: 700,
              color: theme.lock,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              opacity: hint,
              transform: `translateY(${(1 - hint) * 10}px)`,
            }}
          >
            重读一遍卡
          </div>
        ) : null}
      </div>
      {/* 两道闩（上=进程锁〔机体内部位〕/ 下=文件锁〔磁盘文件位〕——上下分位不叠放） */}
      {latch(64, la, true, '进程锁 · RLock', 'chip')}
      {latch(h - 84, lb, false, '文件锁 · flock', 'disk')}
      {/* 底部单人通道 */}
      {lane > 0.02 ? (
        <div style={{position: 'absolute', left: w / 2 - 30, top: h + 14, opacity: lane, display: 'flex', alignItems: 'center', gap: 8}}>
          <svg width={60} height={44} viewBox="0 0 60 44">
            <path d="M2 4 L2 40" stroke={theme.lock} strokeWidth={3.5} strokeLinecap="round" />
            <path d="M58 4 L58 40" stroke={theme.lock} strokeWidth={3.5} strokeLinecap="round" />
            <rect x={20} y={10} width={20} height={30} rx={5} fill="none" stroke={withAlphaM(theme.dim, 0.9)} strokeWidth={2.5} />
          </svg>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>一次一人</span>
        </div>
      ) : null}
    </div>
  );
};

/** 五步流程条 + 一口气括弧（真实版认领：重读/查归属/查完成/查依赖/写名字，
 *  外围文件锁包裹框 + 右侧洋红括弧一次性整体框住=一口气语义非逐段）。
 *  `stepsP` 五步逐节点亮（次序=口播点名次序，禁一次全亮）；`wrapP` 文件锁
 *  包裹框先落；`bracketP` 括弧一笔框住；`docP` 官方文档页角标亮起；
 *  `docHitP` 双箭头相撞小图一闪。 */
export const FiveStepBracket: React.FC<{
  x: number;
  y: number;
  w?: number;
  nodeH?: number;
  gap?: number;
  stepsP?: readonly number[];
  wrapP?: number;
  bracketP?: number;
  docP?: number;
  docHitP?: number;
  litP?: number;
}> = ({x, y, w = 620, nodeH = 88, gap = 18, stepsP = [0, 0, 0, 0, 0], wrapP = 0, bracketP = 0, docP = 0, docHitP = 0, litP = 1}) => {
  const lit = clamp01v(litP);
  const wrap = clamp01v(wrapP);
  const bracket = clamp01v(bracketP);
  const doc = clamp01v(docP);
  const docHit = clamp01v(docHitP);
  const labels = ['重读', '查归属', '查完成', '查依赖', '写名字'];
  const totalH = labels.length * nodeH + (labels.length - 1) * gap;
  const brW = 64;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w + brW + 40, height: totalH, opacity: lit}}>
      {/* 文件锁包裹框（先落——真实版认领也包在文件锁里） */}
      <div
        style={{
          position: 'absolute',
          left: -22,
          top: -18,
          width: w + brW + 34,
          height: totalH + 36,
          borderRadius: 16,
          border: `${3.5}px dashed ${withAlphaM(theme.lock, 0.75 * wrap)}`,
          background: withAlphaM(theme.lock, 0.05 * wrap),
        }}
      />
      {labels.map((lb, i) => {
        const on = clamp01v(stepsP[i]);
        return (
          <div
            key={`fs${i}`}
            style={{
              position: 'absolute',
              left: 0,
              top: i * (nodeH + gap),
              width: w,
              height: nodeH,
              borderRadius: 12,
              border: `3px solid ${on > 0.4 ? withAlphaM(theme.lock, 0.9) : withAlphaM(theme.panelBorder, 0.95)}`,
              background: withAlphaM(theme.panel, 0.96),
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '0 24px',
              opacity: 0.4 + 0.6 * on,
              transform: `translateX(${(1 - on) * -18}px)`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 28, color: on > 0.4 ? theme.lock : theme.dim}}>{`${'①②③④⑤'[i]}`}</span>
            <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 700, color: on > 0.4 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{lb}</span>
            <span
              style={{
                marginLeft: 'auto',
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: `3px solid ${withAlphaM(theme.lock, 0.3 + 0.7 * on)}`,
                background: on > 0.4 ? theme.lock : 'transparent',
              }}
            />
          </div>
        );
      })}
      {/* 一口气括弧（右侧——一次性整体框住：单 path 一笔描成，禁逐段分框） */}
      <svg width={brW + 40} height={totalH} style={{position: 'absolute', left: w, top: 0, overflow: 'visible'}}>
        <path
          d={`M ${brW} 6 L 14 6 L 14 ${totalH - 6} L ${brW} ${totalH - 6}`}
          fill="none"
          stroke={theme.lock}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - bracket}
        />
      </svg>
      {/* 官方文档页角标（右上——文档页小卡+锁形图标，归属随口播） */}
      <div
        style={{
          position: 'absolute',
          left: w + brW + 60,
          top: -14,
          width: 240,
          borderRadius: 10,
          border: `2.5px solid ${withAlphaM(theme.dim, 0.4 + 0.5 * doc)}`,
          background: withAlphaM(theme.panel, 0.96),
          padding: '10px 14px',
          opacity: 0.35 + 0.65 * doc,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <svg width={20} height={20} viewBox="0 0 20 20">
            <path d="M3 2 h9 l4 4 v12 h-13 z" fill="none" stroke={theme.dim} strokeWidth={2} />
            <path d="M12 2 v4 h4" fill="none" stroke={theme.dim} strokeWidth={2} />
          </svg>
          <span style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: doc > 0.4 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>官方文档</span>
        </div>
        {/* 锁形图标 */}
        <svg width={26} height={26} viewBox="0 0 26 26" style={{marginTop: 6}}>
          <rect x={5} y={11} width={16} height={11} rx={3} fill="none" stroke={theme.lock} strokeWidth={2.4} />
          <path d="M9 11 v-3 a4 4 0 0 1 8 0 v3" fill="none" stroke={theme.lock} strokeWidth={2.4} />
        </svg>
        {/* 双箭头相撞小图（防的就是同时抢任务——一闪） */}
        {docHit > 0.03 ? (
          <svg width={120} height={26} viewBox="0 0 120 26" style={{position: 'absolute', left: 14, top: 34, opacity: docHit}}>
            <path d="M6 13 L52 13 M52 13 l-9 -6 M52 13 l-9 6" stroke={theme.danger} strokeWidth={3} fill="none" strokeLinecap="round" />
            <path d="M114 13 L68 13 M68 13 l9 -6 M68 13 l9 6" stroke={theme.danger} strokeWidth={3} fill="none" strokeLinecap="round" />
            <circle cx={60} cy={13} r={6} fill={theme.danger} />
          </svg>
        ) : null}
      </div>
    </div>
  );
};

/** 三十格重试刻度带（基线标尺：30 格上限 + 工况角标·真实版——未重试满 30 次
 *  禁亮满，`lit` 离散给值）。 */
export const RetryBand: React.FC<{x: number; y: number; cells?: number; lit?: number; bandP?: number; litP?: number}> = ({
  x,
  y,
  cells = 30,
  lit = 0,
  bandP = 0,
  litP = 1,
}) => {
  const band = clamp01v(bandP);
  const on = clamp01v(litP);
  const n = Math.max(0, Math.min(cells, Math.round(lit)));
  const cw = 30;
  const gap = 6;
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: on, transform: `translateY(${(1 - band) * 26}px)`}}>
      <div style={{display: 'flex', gap}}>
        {Array.from({length: cells}, (_, i) => (
          <span
            key={`rb${i}`}
            style={{
              width: cw,
              height: 26,
              borderRadius: 4,
              border: `2px solid ${i < n ? theme.watch : withAlphaM(theme.dim, 0.55)}`,
              background: i < n ? withAlphaM(theme.watch, 0.5) : 'transparent',
              opacity: band,
            }}
          />
        ))}
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 8, whiteSpace: 'nowrap'}}>
        {'重试上限 30 次 · 退避 5–100ms · 真实版'}
      </div>
    </div>
  );
};

/** 5–100ms 表盘刻度（退避区间档位——弧 + 两端刻度 + 针在区间内摆） */
export const MsDial: React.FC<{x: number; y: number; size?: number; litP?: number; dialP?: number; fadeP?: number}> = ({
  x,
  y,
  size = 150,
  litP = 1,
  dialP = 0,
  fadeP = 0,
}) => {
  const lit = clamp01v(litP);
  const d = clamp01v(dialP);
  const fade = clamp01v(fadeP);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;
  const ang = -210 + clamp01v(dialP) * 240;
  const p = polar(cx, cy, r, ang);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: size, height: size, opacity: lit * (1 - 0.75 * fade)}}>
      <svg width={size} height={size} style={{overflow: 'visible'}}>
        <path d={describeArc(cx, cy, r, -210, -210 + 240)} fill="none" stroke={withAlphaM(theme.dim, 0.6)} strokeWidth={5} strokeLinecap="round" strokeDasharray={fade > 0.3 ? '6 8' : undefined} />
        <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={theme.watch} strokeWidth={4} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={4} fill={theme.watch} />
      </svg>
      <span style={{position: 'absolute', left: -8, bottom: -4, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>5ms</span>
      <span style={{position: 'absolute', right: -16, bottom: -4, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>100ms</span>
    </div>
  );
};

/** 退避回环（写名箭头撞闩弹回沿回环绕行——撞→弹→绕→再试一拍可读）。
 *  `p` 0..1 四段：0..0.25 撞（进抵闩）/ 0.25..0.5 弹（回退）/ 0.5..0.85 绕
 *  （回环一周）/ 0.85..1 再试（再次进抵）。 */
export const BacktrackLoop: React.FC<{x: number; y: number; w?: number; loopR?: number; p: number; litP?: number}> = ({
  x,
  y,
  w = 560,
  loopR = 88,
  p,
  litP = 1,
}) => {
  const pr = clamp01v(p);
  const lit = clamp01v(litP);
  const latchX = x + w;
  const startY = y;
  // 分段位置（纯函数帧算）
  let px = x;
  let py = startY;
  let rot = 0;
  if (pr < 0.25) {
    const t = pr / 0.25;
    px = x + t * (w - 26);
    py = startY;
    rot = 0;
  } else if (pr < 0.5) {
    const t = (pr - 0.25) / 0.25;
    px = latchX - 26 - t * (w * 0.34);
    py = startY - Math.sin(Math.PI * t) * -26 + t * 26;
    rot = -t * 12;
  } else if (pr < 0.85) {
    const t = (pr - 0.5) / 0.35;
    const cxL = x + w * 0.42;
    const cyL = startY + loopR + 26;
    const a = -Math.PI / 2 + t * 2 * Math.PI;
    px = cxL + loopR * Math.cos(a);
    py = cyL + loopR * Math.sin(a);
    rot = 90 + (a * 180) / Math.PI;
  } else {
    const t = (pr - 0.85) / 0.15;
    px = x + w * 0.42 - loopR + t * (w - 26 - (x + w * 0.42 - loopR - x));
    py = startY;
    rot = 0;
  }
  const hit = pr > 0.22 && pr < 0.32 ? Math.sin(Math.PI * ((pr - 0.22) / 0.1)) : 0;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, pointerEvents: 'none', opacity: lit}}>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {/* 退避回环导轨（虚线椭圆——单向） */}
        <ellipse
          cx={x + w * 0.42}
          cy={startY + loopR + 26}
          rx={loopR}
          ry={loopR}
          fill="none"
          stroke={withAlphaM(theme.dim, 0.5)}
          strokeWidth={3}
          strokeDasharray="9 9"
          opacity={pr > 0.4 ? 1 : 0.4}
        />
        {/* 主轨（起点 → 闩） */}
        <line x1={x} y1={startY} x2={latchX - 26} y2={startY} stroke={withAlphaM(theme.dim, 0.4)} strokeWidth={2.5} strokeDasharray="7 9" />
        {/* 闩（撞 target——洋红闩条） */}
        <rect x={latchX - 14} y={startY - 44} width={14} height={88} rx={4} fill={withAlphaM(theme.lock, 0.9)} />
        {hit > 0.03 ? <circle cx={latchX - 20} cy={startY} r={20 + 14 * hit} fill="none" stroke={withAlphaM(theme.lock, 0.8 * hit)} strokeWidth={4} /> : null}
        {/* 写名箭头（当前位置） */}
        <g transform={`translate(${px} ${py}) rotate(${rot})`}>
          <path d="M -34 -11 L 4 0 L -34 11 Z" fill={theme.text} opacity={0.9} />
          <rect x={-92} y={-4} width={54} height={8} rx={4} fill={withAlphaM(theme.text, 0.55)} />
        </g>
      </svg>
    </div>
  );
};

/** 快拍对照条（教学版五秒一拍慢摆 ↔ 真实版约五百毫秒一轮快闪——两版钟样
 *  同款异速、唯一差异=节奏；「约」数角标 ~500ms；右端超时表盘虚化成无上限）。
 *  `slowSwing` 慢摆值（-1..1，场景喂 pendSwing）；`fastTick` 快闪 0..1（场景
 *  喂高频脉冲）；`noLimitP` 超时位虚化。 */
export const PaceContrastBar: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  slowSwing?: number;
  fastTick?: number;
  noLimitP?: number;
}> = ({x, y, w = 1240, h = 96, litP = 1, slowSwing = 0, fastTick = 0, noLimitP = 0}) => {
  const lit = clamp01v(litP);
  const fast = clamp01v(fastTick);
  const noLim = clamp01v(noLimitP);
  const half = (w - 60) / 2;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit, display: 'flex', alignItems: 'center', gap: 60}}>
      {/* 教学版（值班钟小样慢摆——每五秒一拍） */}
      <div style={{width: half, display: 'flex', alignItems: 'center', gap: 20}}>
        <DutyClock x={0} y={-22} size={76} micro swing={slowSwing} />
        <div>
          <div style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>教学版</div>
          <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>{'5s 一拍'}</div>
        </div>
      </div>
      {/* 分隔箭头（同款异速——唯一差异=节奏） */}
      <svg width={44} height={40} viewBox="0 0 44 40">
        <path d="M4 20 L36 20 M36 20 l-10 -7 M36 20 l-10 7" stroke={withAlphaM(theme.dim, 0.8)} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      </svg>
      {/* 真实版（快闪钟样——约五百毫秒一轮；超时表盘位虚化成 ∞） */}
      <div style={{width: half, display: 'flex', alignItems: 'center', gap: 20}}>
        <div style={{position: 'relative'}}>
          <DutyClock x={0} y={-22} size={76} micro swing={fast > 0.5 ? 0.8 : -0.8} />
        </div>
        <div>
          <div style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.watch, whiteSpace: 'nowrap'}}>真实版</div>
          <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>{'~500ms 一轮'}</div>
        </div>
        {/* 超时表盘位（虚化成无上限符号——两版纪律差） */}
        <div style={{position: 'relative', marginLeft: 'auto', width: 92, height: 76, opacity: 0.9}}>
          <svg width={92} height={76} viewBox="0 0 92 76" style={{opacity: 1 - 0.72 * noLim}}>
            <circle cx={38} cy={38} r={28} fill="none" stroke={withAlphaM(theme.dim, 0.6)} strokeWidth={3} strokeDasharray={noLim > 0.2 ? '5 7' : undefined} />
            <line x1={38} y1={38} x2={38} y2={16} stroke={theme.dim} strokeWidth={2.5} transform={`rotate(${noLim > 0.2 ? 140 : 200} 38 38)`} />
          </svg>
          <span
            style={{
              position: 'absolute',
              right: 0,
              top: 14,
              fontFamily: theme.serif,
              fontSize: 44,
              fontWeight: 700,
              color: theme.dim,
              opacity: noLim,
              whiteSpace: 'nowrap',
            }}
          >
            ∞
          </span>
          <span style={{position: 'absolute', left: 0, bottom: -8, fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>{'超时'}</span>
        </div>
      </div>
    </div>
  );
};

/** 天平两端对照（不裁决——恒平不打摆：beam 全程水平静止）。左盘「六十秒
 *  收工」小钟+计价器（`meterP` 滴答走字一拍、`meterVal` 离散读数）；右盘
 *  「长驻等待」常亮灯（`lampP`）+ 积木堆（`blocks` 离散块数、`blockDropP`
 *  再摞一块落位；记忆体量、越摞越高）。短语签 ≤6 字（`labelP`）。 */
export const BalanceScale: React.FC<{
  x: number;
  y: number;
  size?: number;
  litP?: number;
  meterP?: number;
  meterVal?: number;
  lampP?: number;
  blocks?: number;
  blockDropP?: number;
  labelP?: number;
}> = ({x, y, size = 560, litP = 1, meterP = 0, meterVal = 0, lampP = 0, blocks = 3, blockDropP = 0, labelP = 0}) => {
  const lit = clamp01v(litP);
  const meter = clamp01v(meterP);
  const mv = Math.max(0, Math.round(meterVal));
  const lamp = clamp01v(lampP);
  const nb = Math.max(1, Math.round(blocks));
  const drop = clamp01v(blockDropP);
  const lb = clamp01v(labelP);
  const beamY = y;
  const panY = y + size * 0.5;
  const panX = size * 0.42;
  const blockW = 54;
  return (
    <div style={{position: 'absolute', left: x - size / 2, top: y, width: size, height: size * 1.15, opacity: lit}}>
      <svg width={size} height={size * 1.15} style={{overflow: 'visible'}}>
        {/* 恒平梁（全程水平——不打摆=不裁决） */}
        <line x1={0} y1={beamY - y} x2={size} y2={beamY - y} stroke={withAlphaM(theme.dim, 0.9)} strokeWidth={7} strokeLinecap="round" />
        {/* 支柱 + 底座 */}
        <line x1={size / 2} y1={beamY - y} x2={size / 2} y2={panY - y + 130} stroke={withAlphaM(theme.panelBorder, 0.95)} strokeWidth={8} />
        <line x1={size / 2 - 70} y1={panY - y + 130} x2={size / 2 + 70} y2={panY - y + 130} stroke={withAlphaM(theme.panelBorder, 0.95)} strokeWidth={8} strokeLinecap="round" />
        {/* 吊索 + 盘（左右等重同构） */}
        {[panX, size - panX].map((px, i) => (
          <g key={`pan${i}`}>
            <line x1={px} y1={beamY - y} x2={px} y2={panY - y - 16} stroke={withAlphaM(theme.dim, 0.6)} strokeWidth={3} />
            <path d={`M ${px - 92} ${panY - y - 14} Q ${px} ${panY - y + 34} ${px + 92} ${panY - y - 14}`} fill={withAlphaM(theme.panel, 0.96)} stroke={withAlphaM(theme.dim, 0.85)} strokeWidth={4} />
          </g>
        ))}
      </svg>
      {/* 左盘：小钟 + 计价器（空转烧钱具象——滴答走字离散读数） */}
      <div style={{position: 'absolute', left: panX - 92, top: panY - y - 118}}>
        <DutyClock x={-14} y={0} size={66} micro swing={Math.sin((mv % 2) * Math.PI) * 0.5} litP={meter} />
        <div
          style={{
            position: 'absolute',
            left: 52,
            top: 8,
            padding: '6px 12px',
            borderRadius: 8,
            border: `2.5px solid ${withAlphaM(theme.danger, 0.4 + 0.55 * meter)}`,
            background: withAlphaM(theme.panel, 0.97),
            fontFamily: theme.mono,
            fontSize: 20,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: meter > 0.4 ? theme.danger : theme.dim,
            whiteSpace: 'nowrap',
            opacity: 0.45 + 0.55 * meter,
          }}
        >
          {`¥ ${mv}`}
        </div>
      </div>
      {/* 右盘：常亮灯 + 积木堆（越摞越高——不倒塌） */}
      <div style={{position: 'absolute', left: size - panX - 92, top: panY - y - 118}}>
        <span
          style={{
            position: 'absolute',
            left: -6,
            top: 14,
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: `4px solid ${withAlphaM(theme.ok, 0.4 + 0.6 * lamp)}`,
            background: lamp > 0.4 ? theme.ok : 'transparent',
            boxShadow: lamp > 0.4 ? `0 0 ${20 * lamp}px ${withAlphaM(theme.ok, 0.6 * lamp)}` : 'none',
            display: 'inline-block',
          }}
        />
        <div style={{position: 'absolute', left: 44, top: 0}}>
          {Array.from({length: nb}, (_, i) => {
            const isLast = i === nb - 1;
            const dropY = isLast ? (1 - drop) * -52 : 0;
            const wobble = isLast && drop > 0.02 && drop < 1 ? Math.sin(drop * Math.PI) * 3 : 0;
            return (
              <div
                key={`bk${i}`}
                style={{
                  position: 'absolute',
                  left: (i % 2 === 0 ? 0 : 8) + wobble,
                  top: 44 - i * 26 + dropY,
                  width: blockW - (i % 2 === 0 ? 0 : 10),
                  height: 22,
                  borderRadius: 4,
                  border: `2.5px solid ${withAlphaM(theme.dim, 0.85)}`,
                  background: withAlphaM(theme.panel, 0.96),
                }}
              />
            );
          })}
        </div>
      </div>
      {/* 两端短语签（≤6 字——两难选址、不裁决） */}
      {lb > 0.02 ? (
        <>
          {['六十秒收工', '长驻等待'].map((s, i) => (
            <div
              key={`lb${i}`}
              style={{
                position: 'absolute',
                left: i === 0 ? panX - 110 : size - panX - 110,
                top: panY - y + 52,
                width: 220,
                textAlign: 'center',
                padding: '8px 0',
                borderRadius: 10,
                border: `2.5px solid ${withAlphaM(theme.dim, 0.8)}`,
                background: withAlphaM(theme.panel, 0.97),
                fontFamily: theme.sans,
                fontSize: 22,
                fontWeight: 700,
                color: theme.text,
                whiteSpace: 'nowrap',
                opacity: lb,
                transform: `translateY(${(1 - lb) * 12}px)`,
              }}
            >
              {s}
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
};

/** 机体（队友/队长——rounded 方体，胸口件〔值班钟/三格灯〕由 children 叠放）。
 *  `droopP` 睡眠半收拢微降（半收拢≠暗灰收束——非关机）；`foldP` 收拢成暗灰
 *  （SHUTDOWN：scale 收小 + 描边转 dim + 压暗）。 */
export const AgentBody: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  tone?: string;
  litP?: number;
  droopP?: number;
  foldP?: number;
  children?: React.ReactNode;
}> = ({x, y, w = 110, h = 150, tone, litP = 1, droopP = 0, foldP = 0, children}) => {
  const lit = clamp01v(litP);
  const droop = clamp01v(droopP);
  const fold = clamp01v(foldP);
  const edge = mixHex(tone ?? theme.mate, theme.dim, fold);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + droop * 14 + fold * 10,
        width: w,
        height: h,
        opacity: lit * (1 - 0.25 * fold),
        transform: `scale(${(1 - 0.1 * droop) * (1 - 0.26 * fold)})`,
        transformOrigin: '50% 100%',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: Math.round(w * 0.22),
          border: `${3.5 - fold}px solid ${withAlphaM(edge, 0.9)}`,
          background: withAlphaM(fold > 0.4 ? theme.panel : theme.panel, 0.95),
        }}
      >
        {/* 顶部状态条占位（胸口件由 children 叠放——钟/灯的挂点） */}
        {children}
      </div>
    </div>
  );
};

/** 名字签（serif 斜体——写名认领的落卡证据；`writeP` 宽度显形写入；
 *  `strikeP` 被后写者划掉——覆盖轨迹可追）。 */
export const NameTag: React.FC<{x: number; y: number; label: string; writeP?: number; tone?: string; strikeP?: number; size?: number}> = ({
  x,
  y,
  label,
  writeP = 1,
  tone,
  strikeP,
  size = 26,
}) => {
  const w = clamp01v(writeP);
  const strike = clamp01v(strikeP ?? 0);
  return (
    <div style={{position: 'absolute', left: x, top: y, whiteSpace: 'nowrap'}}>
      <span
        style={{
          fontFamily: theme.serif,
          fontSize: size,
          fontStyle: 'italic',
          fontWeight: 700,
          color: tone ?? theme.text,
          overflow: 'hidden',
          display: 'inline-block',
          width: `${w * 100}%`,
          verticalAlign: 'bottom',
        }}
      >
        {label}
      </span>
      {strike > 0.02 ? (
        <span
          style={{
            position: 'absolute',
            left: -3,
            top: '50%',
            width: strike * (label.length * size * 0.72 + 6),
            height: 3,
            background: theme.danger,
            transform: 'rotate(-7deg)',
          }}
        />
      ) : null}
    </div>
  );
};

/** 视线连线（双视线同帧到达=同一拍语义——dashed 细线描线） */
export const LookLine: React.FC<{x1: number; y1: number; x2: number; y2: number; drawP?: number; tone?: string}> = ({
  x1,
  y1,
  x2,
  y2,
  drawP = 0,
  tone,
}) => {
  const d = clamp01v(drawP);
  const hx = x1 + (x2 - x1) * d;
  const hy = y1 + (y2 - y1) * d;
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <line x1={x1} y1={y1} x2={hx} y2={hy} stroke={withAlphaM(tone ?? theme.dim, 0.85)} strokeWidth={3.5} strokeDasharray="10 9" pathLength={1} strokeDashoffset={1 - d} />
      {d > 0.96 ? <circle cx={x2} cy={y2} r={6} fill={tone ?? theme.dim} /> : null}
    </svg>
  );
};

/** 双影（「同一拍、同一张卡」——两枚半透队友影自画面边缘渗入悬停；P3 接棒
 *  位，禁显出机制细节）。`p` 0..1 渗入（位移+显形）；`fromX` 渗入起点 x。 */
export const GhostPair: React.FC<{x: number; y: number; p: number; fromX?: number}> = ({x, y, p, fromX = -240}) => {
  const pr = clamp01v(p);
  if (pr < 0.02) return null;
  const dx = (1 - pr) * (fromX - x);
  return (
    <div style={{position: 'absolute', left: x + dx, top: y, opacity: pr * 0.55, display: 'flex', gap: 90}}>
      {[0, 1].map((i) => (
        <div key={`gh${i}`} style={{position: 'relative', width: 130, height: 150}}>
          <svg width={130} height={130} style={{overflow: 'visible'}}>
            <circle cx={65} cy={65} r={65 - 20} fill="none" stroke={theme.mate} strokeWidth={5} opacity={0.5} />
          </svg>
          <div
            style={{
              position: 'absolute',
              left: 35,
              top: 46,
              width: 60,
              height: 80,
              borderRadius: 13,
              border: `3px solid ${withAlphaM(theme.mate, 0.7)}`,
              background: withAlphaM(theme.panel, 0.7),
            }}
          />
        </div>
      ))}
    </div>
  );
};

/** 计数角标（离散——计数渲染红线：value 由调用侧离散给值，组件直取禁滚动） */
export const TallyCounter: React.FC<{x: number; y: number; value: number; label: string; tone?: string; litP?: number}> = ({
  x,
  y,
  value,
  label,
  tone,
  litP = 1,
}) => {
  const lit = clamp01v(litP);
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: lit}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
        <span style={{fontFamily: theme.mono, fontSize: 42, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: tone ?? theme.text, whiteSpace: 'nowrap'}}>
          {Math.round(value)}
        </span>
        <span style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>{label}</span>
      </div>
    </div>
  );
};
