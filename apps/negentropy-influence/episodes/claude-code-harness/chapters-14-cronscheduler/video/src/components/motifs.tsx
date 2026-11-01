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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2–ep13 延续——
// LoopRing 描边色/线宽跨集恒定（theme.core = 陶土橙 #D97757 + RING_STROKE 6）
// = 逐字节拷贝的前提。本集契约（storyboard 前言）：环体不换装不高亮、环上
// 没有任何指针——「循环里没有表」；全片场景一律 `nodes={[]}`（环体即循环
// 本体，无站点标注态）、状态色一律经容器透明度承载（描边契约不动）。

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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep13 逐字节
 * 拷贝（本集场景一律 `nodes={[]}`：环体即循环本体，无站点标注态；环上无指针、
 * 不换装不高亮——时间感全在环外四层链上）。
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
 *  环外挂件（注入口 / 回合窗）的场景侧共用工式 */
export const ringPt = polar;

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep14 Cron Scheduler）
// storyboard 实现映射登记：TimeChain / WatchFaceCard / LedgerCard / DeliveryProbe /
// CronFieldCard / DowntimeTimeline / CapacityRuler ＋ 契约小件 LockBadge /
// StepWindow / TaskChip / TokenChip / ConditionSigns。
// 全片主装置 = 四层时间链（sched 长春花蓝：判时表盘每秒一闪；queue 晴空蓝：
// 队列账本 + 交付探针 + 注入消息流）＋ 环体契约件 LoopRing（core 陶土橙、
// 无指针不换装）。反例/退化走 danger（e3 且门哑帧 / e4 硬注入撞回合窗 / 锁
// 占用红光）；机制在位/交付成功走 ok（OR 命中 / 走开重看绿点 / 空闲注入帧）。
// 哑装置原则承 ep4–ep13：动效参数（进度/状态/读数）一律经 prop 由调用场景
// 注入，装置自身零 motion hook 调用（map/条件内纯函数推进；唯一例外是
// useSecondTick 节律相位 hook——与 useRingDot 同属「共用药水」位）。

const clamp01v = (v: number) => Math.min(1, Math.max(0, v));

const withAlphaM = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01v(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 判时表盘的「每秒一闪」节律相位（0..1，fps=30 一周期）——调用侧
 *  `(frame % 30) / 30` 喂 flashT，闪峰落在整秒处（判时线程每秒醒一次） */
export const useSecondTick = (offset = 0) => {
  const frame = useCurrentFrame();
  return (((frame - offset) % 30) + 30) % 30 / 30;
};

/** 四层链舞台全局位（1-A 首亮 / 2-A、3-A 开帧坐标锚共用——跨镜同位即
 *  continuity）：环体居左 · 四层链纵列右侧 · 注入口接环右缘 */
export const STAGE = {
  ring: {x: 170, y: 300, size: 440},
  chain: {x: 900, y: 150, w: 470, cardH: 150, gap: 26},
} as const;

/** 判时表盘（长春花蓝 sched——本集「时间感」的唯一居所：刻度环 + 秒针 +
 *  每秒一闪辉光。指针只长在表盘上，环体〔M-001〕上没有任何指针——本集
 *  判定性契约）。`litP` 显形；`flashT` 每秒闪烁相位（调用侧喂
 *  useSecondTick）；`glow` 基础辉光（0=暗态轮廓 1=在班常亮；5-A 夜语义
 *  微光长明 = 低 glow + flashT）；`needleT` 秒针角度 0..1（2-B 判时命中
 *  到位一闪、0-B 闹钟指针爬行走场景内闹钟件不走本件） */
export const WatchFaceCard: React.FC<{
  size?: number;
  litP?: number;
  flashT?: number;
  glow?: number;
  needleT?: number;
  flashP?: number;
}> = ({size = 200, litP = 1, flashT = 0, glow = 0.55, needleT, flashP = 1}) => {
  const lit = clamp01v(litP);
  const flash = Math.sin(Math.PI * clamp01v(flashT));
  const on = theme.sched;
  const c = size / 2;
  const r = size / 2 - 14;
  const ticks = 12;
  const needle = needleT ?? flashT;
  const np = polar(c, c, r - 22, -90 + needle * 360);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{opacity: lit, overflow: 'visible'}}>
      {/* 表盘外圈（sched 描边——暗态轮廓 0.3 档 → 在班常亮） */}
      <circle cx={c} cy={c} r={r} fill={withAlphaM(theme.panel, 0.96)} stroke={on} strokeWidth={4} opacity={0.3 + 0.7 * clamp01v(glow)} />
      {/* 十二刻度（每秒醒一次的秒表读法） */}
      {Array.from({length: ticks}, (_, i) => {
        const a = (i / ticks) * 360 - 90;
        const p0 = polar(c, c, r - 10, a);
        const p1 = polar(c, c, r - 3, a);
        return <line key={`tk${i}`} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={on} strokeWidth={i % 3 === 0 ? 4 : 2.5} opacity={0.45 + 0.55 * clamp01v(glow)} />;
      })}
      {/* 秒针（每秒一格——needleT 由调用侧喂整点/爬行；指针只在表盘上） */}
      <line x1={c} y1={c} x2={np.x} y2={np.y} stroke={on} strokeWidth={5} strokeLinecap="round" opacity={0.55 + 0.45 * clamp01v(glow)} />
      <circle cx={c} cy={c} r={6} fill={on} opacity={0.55 + 0.45 * clamp01v(glow)} />
      {/* 每秒一闪（表心辉光——判时线程醒来的节律；flashP 供整帧增益/关断） */}
      <circle cx={c} cy={c} r={r * 0.52} fill={withAlphaM(on, 0.22 * flash * clamp01v(flashP))} />
      <circle cx={c} cy={c} r={r} fill="none" stroke={on} strokeWidth={2.5} opacity={0.5 * flash * clamp01v(flashP)} />
    </svg>
  );
};

/** 四层时间链（本集主装置——对照表之于 ep2 的地位）。环体右侧纵列四卡，
 *  次序恒定（判时→队列→交付→执行接驳——storyboard 全片同形约束）；缩微
 *  前后不重绘（`mini` 档）。`outlineP` 四卡暗态轮廓浮出（1-A 首亮）；
 *  `lits` 四卡各自点火度 [判时, 队列, 交付, 执行]；`flowP` 链内连线流光强度；
 *  `dimP` 压暗（缩驻暗层）；`deadP` 熄灭（4-A 随进程框熄灭——判时线程活在
 *  进程里的空间陈述）；`hot` 高亮卡序号（3-A 开帧回看交付卡位） */
export const TimeChain: React.FC<{
  x: number;
  y: number;
  w?: number;
  cardH?: number;
  gap?: number;
  mini?: boolean;
  outlineP?: number;
  lits?: [number, number, number, number];
  flowP?: number;
  dimP?: number;
  deadP?: number;
  hot?: number;
}> = ({x, y, w = 470, cardH = 150, gap = 26, mini = false, outlineP = 0, lits = [0, 0, 0, 0], flowP = 0, dimP = 0, deadP = 0, hot = -1}) => {
  const outline = clamp01v(outlineP);
  const dim = clamp01v(dimP);
  const dead = clamp01v(deadP);
  const flow = clamp01v(flowP);
  const cards = [
    {name: '判时', sub: 'Scheduler · daemon', color: theme.sched},
    {name: '队列', sub: 'Queue', color: theme.queue},
    {name: '交付', sub: 'Queue Processor', color: theme.queue},
    {name: '执行接驳', sub: 'Consumer → 循环', color: theme.core},
  ] as const;
  const nameFs = mini ? 17 : 24;
  const subFs = mini ? 10 : 13;
  const totalH = cards.length * (mini ? cardH * 0.52 : cardH) + (cards.length - 1) * (mini ? gap * 0.6 : gap);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: totalH, opacity: 1 - 0.72 * dim}}>
      {/* 链内连线（卡间竖向连线 + 流光——链成形后消息沿链下行） */}
      <svg width={w} height={totalH} viewBox={`0 0 ${w} ${totalH}`} style={{position: 'absolute', inset: 0}}>
        {cards.slice(0, -1).map((_, i) => {
          const cH = mini ? cardH * 0.52 : cardH;
          const g = mini ? gap * 0.6 : gap;
          const y0 = (i + 1) * cH + i * g;
          const y1 = y0 + g;
          return (
            <g key={`cn${i}`}>
              <line x1={w / 2} y1={y0} x2={w / 2} y2={y1} stroke={withAlphaM(theme.dim, 0.5)} strokeWidth={mini ? 2.5 : 3.5} />
              {flow > 0.03 ? (
                <circle cx={w / 2} cy={y0 + g * flow} r={mini ? 4 : 6} fill={theme.queue} opacity={0.85} />
              ) : null}
            </g>
          );
        })}
      </svg>
      {cards.map((card, i) => {
        const cH = mini ? cardH * 0.52 : cardH;
        const g = mini ? gap * 0.6 : gap;
        const top = i * (cH + g);
        const lit = clamp01v(lits[i]);
        const isHot = hot === i;
        return (
          <div
            key={card.name}
            style={{
              position: 'absolute',
              left: 0,
              top,
              width: w,
              height: cH,
              borderRadius: mini ? 8 : 13,
              border: `${mini ? 2 : 3}px ${lit > 0.3 ? 'solid' : 'dashed'} ${lit > 0.3 ? withAlphaM(card.color, 0.9) : withAlphaM(theme.dim, 0.55)}`,
              background: lit > 0.3 ? withAlphaM(theme.panel, 0.96) : 'transparent',
              opacity: outline * (lit > 0.3 ? 1 : 0.55),
              boxShadow: isHot ? `0 0 ${mini ? 8 : 16}px ${withAlphaM(card.color, 0.5)}` : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: mini ? 10 : 18,
              padding: mini ? '4px 12px' : '12px 20px',
            }}
          >
            {/* 卡内小图腾（各角色一眼可辨——判时小表盘 / 队列账本行 / 交付探针 / 执行注入口） */}
            <svg width={mini ? 30 : 52} height={mini ? 30 : 52} viewBox="0 0 52 52" style={{flexShrink: 0}}>
              {i === 0 ? (
                <>
                  <circle cx={26} cy={26} r={20} fill="none" stroke={card.color} strokeWidth={4} opacity={0.35 + 0.65 * lit} />
                  <line x1={26} y1={26} x2={26} y2={12} stroke={card.color} strokeWidth={4} strokeLinecap="round" opacity={0.35 + 0.65 * lit} />
                </>
              ) : i === 1 ? (
                <>
                  <rect x={10} y={12} width={32} height={7} rx={3} fill={card.color} opacity={0.35 + 0.65 * lit} />
                  <rect x={10} y={23} width={32} height={7} rx={3} fill={card.color} opacity={(0.35 + 0.65 * lit) * 0.55} />
                  <rect x={10} y={34} width={32} height={7} rx={3} fill={card.color} opacity={(0.35 + 0.65 * lit) * 0.3} />
                </>
              ) : i === 2 ? (
                <>
                  <circle cx={20} cy={26} r={7} fill="none" stroke={card.color} strokeWidth={4} opacity={0.35 + 0.65 * lit} />
                  <line x1={27} y1={26} x2={44} y2={26} stroke={card.color} strokeWidth={4} strokeLinecap="round" opacity={0.35 + 0.65 * lit} />
                </>
              ) : (
                <>
                  <path d="M 8 26 Q 26 6 44 26" fill="none" stroke={card.color} strokeWidth={4} strokeLinecap="round" opacity={0.35 + 0.65 * lit} />
                  <circle cx={26} cy={27} r={4} fill={card.color} opacity={0.35 + 0.65 * lit} />
                </>
              )}
            </svg>
            <div style={{minWidth: 0}}>
              <div style={{fontFamily: theme.sans, fontSize: nameFs, fontWeight: 700, color: lit > 0.3 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{card.name}</div>
              <div style={{fontFamily: theme.mono, fontSize: subFs, color: lit > 0.3 ? card.color : theme.dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{card.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** 队列账本卡（晴空蓝 queue——1-B 特写放大态 / 链内缩微态同件）。`litP` 显形；
 *  `rowP` 到点任务签滑入、账本添一行墨迹落定（墨迹 = 行底渐显 + 左侧重墨点）；
 *  `sealP` 封条横贯卡下缘（「只记账不执行」的封条态——〔M-003〕持续陈述配
 *  持续态）；`rows` 空架行数；`mini` 缩微 */
export const LedgerCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  rowP?: number;
  rowText?: string;
  sealP?: number;
  glowP?: number;
  rows?: number;
  mini?: boolean;
}> = ({x, y, w = 640, h = 420, litP = 1, rowP = 0, rowText = '09:00 · 跑测试', sealP = 0, glowP = 0, rows = 4, mini = false}) => {
  const lit = clamp01v(litP);
  const row = clamp01v(rowP);
  const seal = clamp01v(sealP);
  const glow = clamp01v(glowP);
  const headH = mini ? 34 : 56;
  const rowH = mini ? 30 : 52;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: mini ? 9 : 14,
          border: `${mini ? 2.5 : 3.5}px solid ${withAlphaM(theme.queue, 0.9)}`,
          background: withAlphaM(theme.panel, 0.96),
          boxShadow: glow > 0.05 ? `0 0 ${18 * glow}px ${withAlphaM(theme.queue, 0.4)}` : 'none',
          overflow: 'hidden',
        }}
      >
        {/* 卡头：队列 · queue（账本身份签） */}
        <div style={{display: 'flex', alignItems: 'center', gap: mini ? 8 : 12, height: headH, padding: `0 ${mini ? 12 : 20}px`, borderBottom: `2px solid ${withAlphaM(theme.panelBorder, 0.9)}`}}>
          <span style={{fontFamily: theme.sans, fontSize: mini ? 15 : 21, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'队列'}</span>
          <span style={{fontFamily: theme.mono, fontSize: mini ? 10 : 13, color: theme.queue, whiteSpace: 'nowrap'}}>{'queue · 账本'}</span>
        </div>
        {/* 账本行位（空架行——记账位虚线轮廓） */}
        <div style={{padding: mini ? '8px 12px' : '14px 20px', display: 'flex', flexDirection: 'column', gap: mini ? 6 : 12}}>
          {Array.from({length: rows}, (_, i) => {
            const filled = i === rows - 1 && row > 0.05;
            return (
              <div
                key={`lr${i}`}
                style={{
                  height: rowH,
                  borderRadius: mini ? 5 : 8,
                  border: `2px ${filled ? 'solid' : 'dashed'} ${filled ? withAlphaM(theme.queue, 0.85) : withAlphaM(theme.dim, 0.4)}`,
                  background: filled ? withAlphaM(theme.queue, 0.1 * row + 0.04) : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: mini ? 6 : 12,
                  padding: `0 ${mini ? 8 : 14}px`,
                  opacity: filled ? row : 0.6,
                }}
              >
                {filled ? (
                  <>
                    {/* 墨迹重墨点（墨迹落定的笔触起点） */}
                    <span style={{width: mini ? 7 : 11, height: mini ? 7 : 11, borderRadius: '50%', background: theme.queue, opacity: row, flexShrink: 0}} />
                    <span style={{fontFamily: theme.mono, fontSize: mini ? 12 : 20, color: theme.text, whiteSpace: 'nowrap', opacity: row}}>{rowText}</span>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
        {/* 封条（横贯卡下缘——只记账不执行；封条态持续可读，句中点抽帧仍见「账本不执行」） */}
        {seal > 0.03 ? (
          <div
            style={{
              position: 'absolute',
              left: -8,
              right: -8,
              bottom: mini ? 8 : 16,
              height: mini ? 20 : 30,
              background: `repeating-linear-gradient(135deg, ${withAlphaM(theme.queue, 0.75)}, ${withAlphaM(theme.queue, 0.75)} 12px, ${withAlphaM(theme.panel, 0.98)} 12px, ${withAlphaM(theme.panel, 0.98)} 24px)`,
              borderRadius: 4,
              opacity: 0.55 * seal + 0.35,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `rotate(${(1 - seal) * -4}deg) scale(${0.8 + 0.2 * seal})`,
            }}
          >
            <span style={{fontFamily: mini ? theme.mono : theme.sans, fontSize: mini ? 10 : 15, fontWeight: 700, letterSpacing: 3, color: theme.text, background: withAlphaM(theme.panel, 0.92), padding: '1px 10px', borderRadius: 4, whiteSpace: 'nowrap'}}>{'不执行 · 只记账'}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 交付卡（晴空蓝 queue——1-C 试探锁中景 / 3-A ECU 深潜 / 缩微态同件，morph
 *  跨镜恒定件：卡轮廓＋晴空蓝描边＋「有空」检查框三身份线索恒在）。
 *  `litP` 显形；`probeP` 探针自卡左缘伸出（试探环体上的锁）；`retractP` 探针
 *  收回复位（抢不到走开）；`check1P`/`check2P` 两枚检查签先后亮出（签文去问词
 *  「队列有活」「程序有空」——词窗时序挂口播问句，次序=口播）；`idleP`
 *  「走开—计时—回来」小计时环显形；`idleT` 计时环相位（零点二秒巡检节律）；
 *  `msgP` 消息条持有（交付线程持消息条待注入）；六行代码窗由 StepWindow 独立
 *  承载（3-A 深潜时卡缩位、窗占屏——morph 注记见场景头） */
export const DeliveryProbe: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  probeP?: number;
  retractP?: number;
  check1P?: number;
  check2P?: number;
  idleP?: number;
  idleT?: number;
  msgP?: number;
  mini?: boolean;
}> = ({x, y, w = 520, h = 300, litP = 1, probeP = 0, retractP = 0, check1P = 0, check2P = 0, idleP = 0, idleT = 0, msgP = 0, mini = false}) => {
  const lit = clamp01v(litP);
  const probe = clamp01v(probeP) * (1 - clamp01v(retractP));
  const c1 = clamp01v(check1P);
  const c2 = clamp01v(check2P);
  const idle = clamp01v(idleP);
  const msg = clamp01v(msgP);
  const headH = mini ? 32 : 52;
  const probeLen = (mini ? 60 : 150) * probe;
  const idleR = mini ? 12 : 21;
  const idleC = mini ? 16 : 28;
  const idleNX = idleC + idleR * Math.sin(clamp01v(idleT) * Math.PI * 2);
  const idleNY = idleC - idleR * Math.cos(clamp01v(idleT) * Math.PI * 2);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: mini ? 9 : 14,
          border: `${mini ? 2.5 : 3.5}px solid ${withAlphaM(theme.queue, 0.9)}`,
          background: withAlphaM(theme.panel, 0.96),
        }}
      >
        {/* 卡头：交付 · QueueProcessor（链路身份签） */}
        <div style={{display: 'flex', alignItems: 'center', gap: mini ? 8 : 12, height: headH, padding: `0 ${mini ? 10 : 18}px`, borderBottom: `2px solid ${withAlphaM(theme.panelBorder, 0.9)}`}}>
          <span style={{fontFamily: theme.sans, fontSize: mini ? 15 : 21, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'交付'}</span>
          <span style={{fontFamily: theme.mono, fontSize: mini ? 10 : 13, color: theme.queue, whiteSpace: 'nowrap'}}>{'Queue Processor'}</span>
        </div>
        {/* 探针（卡左缘水平伸出——试探环体上的锁；收回由 probe 联动 retract 归零） */}
        <svg width={w} height={h - headH} viewBox={`0 0 ${w} ${h - headH}`} style={{position: 'absolute', left: 0, top: headH, overflow: 'visible'}}>
          {probe > 0.02 ? (
            <>
              <line x1={2} y1={(h - headH) / 2} x2={2 + probeLen} y2={(h - headH) / 2} stroke={theme.queue} strokeWidth={mini ? 3 : 5} strokeLinecap="round" />
              <circle cx={8 + probeLen} cy={(h - headH) / 2} r={mini ? 5 : 8} fill={theme.panel} stroke={theme.queue} strokeWidth={mini ? 2.5 : 3.5} />
            </>
          ) : null}
          {/* 「走开—计时—回来」小计时环（卡右下角——零点二秒巡检节律的读数位） */}
          {idle > 0.03 ? (
            <g opacity={idle} transform={`translate(${w - (mini ? 46 : 84)}, ${h - headH - (mini ? 40 : 72)})`}>
              <circle cx={idleC} cy={idleC} r={idleR} fill="none" stroke={withAlphaM(theme.queue, 0.8)} strokeWidth={mini ? 2.5 : 3.5} />
              <line x1={idleC} y1={idleC} x2={idleNX} y2={idleNY} stroke={theme.queue} strokeWidth={mini ? 2 : 3} strokeLinecap="round" />
              <text x={mini ? 34 : 58} y={mini ? 20 : 33} fontFamily={theme.mono} fontSize={mini ? 8 : 12} fill={theme.dim}>0.2s</text>
            </g>
          ) : null}
        </svg>
        {/* 双检查签（卡面上部——签文去问词，次序=口播：队列有活 → 程序有空） */}
        <div style={{position: 'absolute', left: mini ? 10 : 18, top: headH + (mini ? 6 : 12), display: 'flex', gap: mini ? 6 : 12}}>
          {[
            {t: '队列有活', p: c1},
            {t: '程序有空', p: c2},
          ].map((chk) => (
            <div
              key={chk.t}
              style={{
                padding: mini ? '2px 8px' : '5px 14px',
                borderRadius: mini ? 5 : 8,
                border: `2px solid ${chk.p > 0.35 ? theme.ok : withAlphaM(theme.dim, 0.5)}`,
                fontFamily: theme.sans,
                fontSize: mini ? 11 : 17,
                fontWeight: 600,
                color: chk.p > 0.35 ? theme.ok : theme.dim,
                background: chk.p > 0.35 ? withAlphaM(theme.ok, 0.1) : 'transparent',
                opacity: 0.45 + 0.55 * chk.p,
                whiteSpace: 'nowrap',
              }}
            >
              {chk.t}
            </div>
          ))}
        </div>
        {/* 持有的消息条（交付线程持消息条待注入——1-D 待发 / 3-C 静候） */}
        {msg > 0.03 ? (
          <div
            style={{
              position: 'absolute',
              left: mini ? 12 : 22,
              bottom: mini ? 10 : 18,
              padding: mini ? '3px 9px' : '6px 16px',
              borderRadius: mini ? 5 : 8,
              border: `2.5px solid ${theme.queue}`,
              background: withAlphaM(theme.panel, 0.98),
              fontFamily: theme.sans,
              fontSize: mini ? 11 : 18,
              fontWeight: 700,
              color: theme.queue,
              whiteSpace: 'nowrap',
              opacity: msg,
              boxShadow: `0 0 ${10 * msg}px ${withAlphaM(theme.queue, 0.4)}`,
            }}
          >
            {'到点消息'}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 锁徽章（红/绿互斥——占用红光 / 释放绿光，同帧只准一色：tone 由调用侧
 *  状态机喂，装置不持态）。`tone` 'red'|'green'|'off'；`glowP` 辉光（特写
 *  定格一拍 / 交替演示的闪峰） */
export const LockBadge: React.FC<{x: number; y: number; size?: number; tone?: 'red' | 'green' | 'off'; glowP?: number; label?: boolean}> = ({x, y, size = 90, tone = 'off', glowP = 0, label = true}) => {
  const on = tone === 'red' ? theme.danger : tone === 'green' ? theme.ok : theme.dim;
  const lit = tone !== 'off';
  const glow = clamp01v(glowP);
  const s = size;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: s, height: s + (label ? 30 : 0)}}>
      <svg width={s} height={s} viewBox="0 0 100 100">
        {/* 锁体（方锁 + 锁梁） */}
        <path d="M 32 46 L 32 34 Q 32 16 50 16 Q 68 16 68 34 L 68 46" fill="none" stroke={on} strokeWidth={lit ? 8 : 5} opacity={lit ? 0.9 : 0.5} strokeLinecap="round" />
        <rect x={26} y={44} width={48} height={40} rx={8} fill={withAlphaM(theme.panel, 0.98)} stroke={on} strokeWidth={lit ? 7 : 5} opacity={lit ? 1 : 0.6} />
        <circle cx={50} cy={62} r={7} fill={lit ? on : withAlphaM(theme.dim, 0.5)} opacity={lit ? 1 : 0.6} />
        <line x1={50} y1={62} x2={50} y2={74} stroke={lit ? on : withAlphaM(theme.dim, 0.5)} strokeWidth={lit ? 6 : 4} strokeLinecap="round" opacity={lit ? 1 : 0.6} />
        {glow > 0.03 ? <rect x={26} y={44} width={48} height={40} rx={8} fill="none" stroke={on} strokeWidth={3} opacity={glow} /> : null}
      </svg>
      {label ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: s + 2, textAlign: 'center', fontFamily: theme.mono, fontSize: 13, color: lit ? on : theme.dim, whiteSpace: 'nowrap', opacity: lit ? 1 : 0.6}}>
          {tone === 'red' ? 'agent_lock · 占用' : tone === 'green' ? 'agent_lock · 释放' : 'agent_lock'}
        </div>
      ) : null}
    </div>
  );
};

/** 六行代码窗（3-A ECU——交付线程循环的行骨架＋关键词位，行数可数不多不少
 *  六行；禁完整源码文本）。`litP` 显形；`linePs` 各行点亮度（六元组——
 *  自上而下逐行点亮）；`branchPs` 分支行闪（行 1 队列空走 / 行 2 锁抢不到走）；
 *  `confirmP` 拿到锁再确认的二次检查框（行 4 尾） */
export const StepWindow: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  linePs?: [number, number, number, number, number, number];
  branchPs?: [number, number];
  confirmP?: number;
  redP?: number;
}> = ({x, y, w = 760, h = 380, litP = 1, linePs = [0, 0, 0, 0, 0, 0], branchPs = [0, 0], confirmP = 0, redP = 0}) => {
  const lit = clamp01v(litP);
  const rowKeys = ['queue?', 'lock?', 'sleep 0.2', 'confirm', 'deliver', 'loop'];
  const lineH = (h - 64) / 6;
  const red = clamp01v(redP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 12, border: `3px solid ${withAlphaM(theme.queue, 0.85)}`, background: withAlphaM(theme.panel, 0.97)}}>
        {/* 窗头：step()（六行循环的身份签——行骨架，非源码） */}
        <div style={{display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 18px', borderBottom: `2px solid ${withAlphaM(theme.panelBorder, 0.9)}`}}>
          <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.queue, whiteSpace: 'nowrap'}}>{'QueueProcessor.step · 六行'}</span>
        </div>
        <div style={{position: 'relative', padding: '10px 18px'}}>
          {rowKeys.map((k, i) => {
            const p = clamp01v(linePs[i]);
            const br = i < 2 ? clamp01v(branchPs[i]) : 0;
            return (
              <div
                key={`sw${i}`}
                style={{
                  position: 'relative',
                  height: lineH,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  opacity: p,
                }}
              >
                {/* 行号（行数可数——不多不少六行） */}
                <span style={{width: 26, textAlign: 'right', fontFamily: theme.mono, fontSize: 21, color: withAlphaM(theme.dim, 0.75), flexShrink: 0}}>{i + 1}</span>
                {/* 行骨架（灰阶条——非源码文本） */}
                <span style={{position: 'relative', width: w * 0.42, height: 12, borderRadius: 6, background: withAlphaM(theme.dim, 0.28), flexShrink: 0}}>
                  <span style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${0.35 + 0.3 * ((i * 37) % 10) / 10}%`, borderRadius: 6, background: withAlphaM(theme.dim, 0.5)}} />
                </span>
                {/* 关键词位（mono 关键词——判读锚） */}
                <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.text, whiteSpace: 'nowrap'}}>{k}</span>
                {/* 分支行闪（走——行 1/2 的分支出口闪峰） */}
                {br > 0.03 ? (
                  <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: i === 1 && red > 0.3 ? theme.danger : theme.dim, opacity: br, whiteSpace: 'nowrap'}}>{'→ 走'}</span>
                ) : null}
                {/* 行 4 尾：二次检查框（拿到锁再确认） */}
                {i === 3 && confirmP > 0.03 ? (
                  <span
                    style={{
                      padding: '2px 10px',
                      borderRadius: 6,
                      border: `2px solid ${theme.ok}`,
                      fontFamily: theme.sans,
                      fontSize: 16,
                      fontWeight: 700,
                      color: theme.ok,
                      opacity: clamp01v(confirmP),
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {'再确认'}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** 到点任务签（晴空蓝——账本行/注册位/消息条/两档命运/周期任务签同件可追：
 *  2-B 四段旅程同签同形即本件不动。`tone` 'queue'|'dim'|'danger'——4-A 内存档
 *  淡出走 dim、4-D 无人认领走 danger 微染） */
export const TaskChip: React.FC<{
  x: number;
  y: number;
  label?: string;
  litP?: number;
  tone?: 'queue' | 'dim' | 'danger';
  mini?: boolean;
}> = ({x, y, label = '取日期', litP = 1, tone = 'queue', mini = false}) => {
  const lit = clamp01v(litP);
  const on = tone === 'queue' ? theme.queue : tone === 'danger' ? theme.danger : theme.dim;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        padding: mini ? '4px 12px' : '8px 20px',
        borderRadius: mini ? 7 : 10,
        border: `${mini ? 2 : 3}px solid ${withAlphaM(on, 0.9)}`,
        background: withAlphaM(theme.panel, 0.97),
        fontFamily: theme.sans,
        fontSize: mini ? 15 : 22,
        fontWeight: 700,
        color: on,
        whiteSpace: 'nowrap',
        opacity: lit,
      }}
    >
      {label}
    </div>
  );
};

/** 「一次只许一方持有」令牌小片（1-C 出场 / 3-B 裂开两半——p1-06 伏笔回收
 *  同件承载）。`litP` 显形；`holderT` 归属位移 0..1（0=环侧 1=探针侧——
 *  独占语义：同一时刻只在一方）；`splitP` 裂开两半（3-B 规矩破了） */
export const TokenChip: React.FC<{x: number; y: number; litP?: number; holderT?: number; splitP?: number}> = ({x, y, litP = 1, holderT = 0.5, splitP = 0}) => {
  const lit = clamp01v(litP);
  const hold = clamp01v(holderT);
  const split = clamp01v(splitP);
  const w = 120;
  const h = 52;
  const half = split * 26;
  return (
    <div style={{position: 'absolute', left: x - (hold - 0.5) * -140, top: y, width: w, height: h, opacity: lit, pointerEvents: 'none'}}>
      {/* 两半（splitP 裂开——左半左移 + 旋、右半右移 + 旋） */}
      {[0, 1].map((side) => {
        const dir = side === 0 ? -1 : 1;
        return (
          <div
            key={`tc${side}`}
            style={{
              position: 'absolute',
              left: side === 0 ? 0 : w / 2,
              top: 0,
              width: w / 2,
              height: h,
              overflow: 'hidden',
              transform: `translateX(${dir * half}px) rotate(${dir * split * 10}deg)`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: side === 0 ? 0 : -w / 2,
                top: 0,
                width: w,
                height: h,
                borderRadius: 10,
                border: `3px solid ${split > 0.3 ? theme.danger : theme.ok}`,
                background: withAlphaM(theme.panel, 0.97),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span style={{width: 10, height: 10, borderRadius: '50%', background: split > 0.3 ? theme.danger : theme.ok, flexShrink: 0}} />
              <span style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>一次一方</span>
            </div>
          </div>
        );
      })}
      {split > 0.55 ? (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
          <path d={`M ${w / 2 - 20} ${h / 2 - 4} L ${w / 2 - 6} ${h / 2 + 4}`} stroke={theme.danger} strokeWidth={3.5} strokeLinecap="round" opacity={split} />
        </svg>
      ) : null}
    </div>
  );
};

/** 镜尾并列条件签对（1-D 焊死 → 3-C 崩开——「到点」「有空」两枚关键词签的
 *  分/合生命周期同件）。`litP` 显形；`weldP` 焊点烫在一块（+ 裂纹一拍由
 *  crackP）；`crackP` 焊点裂纹（1-D 伏笔——P3 崩开的前兆）；`burstP` 崩开
 *  弹开分立（3-C 幕点收束位——两签分立 + 中间队列带由场景侧另行承载） */
export const ConditionSigns: React.FC<{
  x: number;
  y: number;
  litP?: number;
  weldP?: number;
  crackP?: number;
  burstP?: number;
}> = ({x, y, litP = 1, weldP = 0, crackP = 0, burstP = 0}) => {
  const lit = clamp01v(litP);
  const weld = clamp01v(weldP);
  const crack = clamp01v(crackP);
  const burst = clamp01v(burstP);
  const sep = 90 + burst * 150;
  const signW = 190;
  return (
    <div style={{position: 'absolute', left: x - signW - sep / 2, top: y, width: signW * 2 + sep, height: 86, opacity: lit, pointerEvents: 'none'}}>
      {['到点', '有空'].map((t, i) => {
        const dir = i === 0 ? -1 : 1;
        return (
          <div
            key={`cs${t}`}
            style={{
              position: 'absolute',
              left: i === 0 ? 0 : signW + sep,
              top: 0,
              width: signW,
              height: 66,
              borderRadius: 11,
              border: `3px solid ${i === 0 ? withAlphaM(theme.sched, 0.9) : withAlphaM(theme.queue, 0.9)}`,
              background: withAlphaM(theme.panel, 0.97),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 27,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              transform: `translateX(${(1 - lit) * dir * -18}px) rotate(${dir * burst * 3}deg)`,
            }}
          >
            {t}
            {/* 签内小签（角色锚——到点=判时针 / 有空=交付锁） */}
            <span style={{position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)', fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>
              {i === 0 ? 'minute match' : 'lock free'}
            </span>
          </div>
        );
      })}
      {/* 焊点（两签中间——weldP 烫在一块：红热圆点 + 迸裂纹） */}
      {weld > 0.03 ? (
        <div style={{position: 'absolute', left: signW + sep / 2 - 26, top: 14, width: 52, height: 52}}>
          <svg width={52} height={52} viewBox="0 0 52 52">
            <circle cx={26} cy={26} r={11 + 4 * weld} fill={withAlphaM(theme.danger, 0.55 * weld)} stroke={theme.danger} strokeWidth={3} opacity={weld} />
            {crack > 0.03
              ? [0, 1, 2].map((k) => {
                  const a = (k / 3) * Math.PI * 2 + 0.5;
                  return (
                    <line
                      key={`ck${k}`}
                      x1={26 + 12 * Math.cos(a)}
                      y1={26 + 12 * Math.sin(a)}
                      x2={26 + (12 + 14 * crack) * Math.cos(a)}
                      y2={26 + (12 + 14 * crack) * Math.sin(a)}
                      stroke={theme.danger}
                      strokeWidth={3}
                      strokeLinecap="round"
                      opacity={crack}
                    />
                  );
                })
              : null}
          </svg>
        </div>
      ) : null}
    </div>
  );
};

/** 五槽位任务卡（2-A 特写主角：分/时/日/月/星期 五字段槽位纵列 + 提示词条 +
 *  双开关（周期/写盘——4-A 回指伏笔位）+ 表达式打字机行；中性装置默认色
 *  通则——中性件用 dim 系中性描边，点缀不占双主题色（星号微光 sched／或签
 *  ok／且签 danger／写盘 durable 高亮 ok）。`litP` 显形；`slotPs` 五槽各自
 *  点亮度（自上而下——分→时→日→月→星期）；`typedN` 表达式已敲字符数（打字机
 *  由调用侧 useReveal 喂）；`exprText` 表达式字面；`hintP` 提示词条；
 *  `switchPs` 双开关轮廓点亮；`starGlowP` 星号槽微光；`hlP` 日·星期两槽高亮
 *  圈定度（2-D 边界裁决——sched 圈定）；`andP` 分/时/月 三槽且门小签（2-D）；
 *  `diskHLP` 写盘开关角标高亮（4-A 回指） */
export const CronFieldCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  slotPs?: [number, number, number, number, number];
  typedN?: number;
  exprText?: string;
  hintP?: number;
  switchPs?: [number, number];
  starGlowP?: number;
  hlP?: number;
  andP?: number;
  diskHLP?: number;
}> = ({
  x,
  y,
  w = 620,
  h = 560,
  litP = 1,
  slotPs = [0, 0, 0, 0, 0],
  typedN = 0,
  exprText = '*/2 * * * *',
  hintP = 0,
  switchPs = [0, 0],
  starGlowP = 0,
  hlP = 0,
  andP = 0,
  diskHLP = 0,
}) => {
  const lit = clamp01v(litP);
  const slots = ['分', '时', '日', '月', '星期'];
  const vals = ['*/2', '*', '*', '*', '*'];
  const headH = 96;
  const slotH = (h - headH - 120) / 5;
  const typed = exprText.slice(0, Math.max(0, Math.round(typedN)));
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 15, border: `3.5px solid ${withAlphaM(theme.dim, 0.75)}`, background: withAlphaM(theme.panel, 0.96)}}>
        {/* 卡头：表达式打字机行 + 任务定义签 */}
        <div style={{height: headH, padding: '14px 24px 0'}}>
          <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, letterSpacing: 1, whiteSpace: 'nowrap'}}>{'cron · 任务定义'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 34, color: theme.text, marginTop: 6, whiteSpace: 'nowrap'}}>
            {typed}
            <span style={{color: theme.dim, opacity: 0.8}}>{typedN > 0 && typed.length < exprText.length ? '▍' : ''}</span>
          </div>
        </div>
        {/* 五槽位纵列（各带暗态刻度——段名可数；星号=任意的槽位语义） */}
        <div style={{position: 'absolute', left: 24, right: 24, top: headH + 4, bottom: 116}}>
          {slots.map((s, i) => {
            const p = clamp01v(slotPs[i]);
            const isStar = vals[i] === '*';
            const inHL = (i === 2 || i === 4) && hlP > 0.03;
            const inAnd = (i === 0 || i === 1 || i === 3) && andP > 0.03;
            return (
              <div key={`sl${s}`} style={{position: 'absolute', left: 0, right: 0, top: i * slotH, height: slotH - 8, display: 'flex', alignItems: 'center', gap: 16}}>
                <div
                  style={{
                    position: 'relative',
                    flex: 1,
                    height: slotH - 12,
                    borderRadius: 9,
                    border: `2.5px ${p > 0.3 ? 'solid' : 'dashed'} ${inHL ? withAlphaM(theme.sched, 0.9) : p > 0.3 ? withAlphaM(theme.text, 0.55) : withAlphaM(theme.dim, 0.45)}`,
                    background: p > 0.3 ? withAlphaM(theme.dim, 0.09 + 0.05 * p) : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '0 16px',
                    opacity: 0.45 + 0.55 * p,
                    boxShadow: inHL ? `0 0 ${12 * clamp01v(hlP)}px ${withAlphaM(theme.sched, 0.4)}` : 'none',
                  }}
                >
                  <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.text, width: 62, flexShrink: 0}}>{s}</span>
                  <span style={{fontFamily: theme.mono, fontSize: 26, color: isStar && starGlowP > 0.3 ? theme.sched : theme.dim, textShadow: isStar && starGlowP > 0.3 ? `0 0 ${10 * clamp01v(starGlowP)}px ${withAlphaM(theme.sched, 0.6)}` : 'none'}}>{vals[i]}</span>
                  {/* 且门小签（分/时/月——全点接通的对照图标） */}
                  {inAnd ? (
                    <span
                      style={{
                        marginLeft: 'auto',
                        padding: '3px 12px',
                        borderRadius: 7,
                        border: `2.5px solid ${theme.danger}`,
                        fontFamily: theme.sans,
                        fontSize: 17,
                        fontWeight: 700,
                        color: theme.danger,
                        opacity: clamp01v(andP),
                        whiteSpace: 'nowrap',
                      }}
                    >
                      且
                    </span>
                  ) : null}
                  {/* 日·星期 OR 桥签（高亮圈定时——或=命中绿，与 2-C/2-D 左绿右红镜像同源） */}
                  {inHL ? (
                    <span
                      style={{
                        marginLeft: 'auto',
                        padding: '3px 12px',
                        borderRadius: 7,
                        border: `2.5px solid ${theme.ok}`,
                        fontFamily: theme.sans,
                        fontSize: 17,
                        fontWeight: 700,
                        color: theme.ok,
                        opacity: clamp01v(hlP),
                        whiteSpace: 'nowrap',
                      }}
                    >
                      或
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {/* 卡尾：提示词条 + 双开关（周期/写盘——写盘 4-A 回指高亮） */}
        <div style={{position: 'absolute', left: 24, right: 24, bottom: 16, height: 92, display: 'flex', alignItems: 'flex-end', gap: 14}}>
          <div
            style={{
              flex: 1,
              height: 56,
              borderRadius: 9,
              border: `2.5px ${clamp01v(hintP) > 0.3 ? 'solid' : 'dashed'} ${clamp01v(hintP) > 0.3 ? withAlphaM(theme.text, 0.75) : withAlphaM(theme.dim, 0.45)}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 14px',
              opacity: 0.45 + 0.55 * clamp01v(hintP),
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, flexShrink: 0}}>{'要办'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>{'取日期'}</span>
          </div>
          {[
            {t: '周期', p: switchPs[0]},
            {t: '写盘', p: switchPs[1]},
          ].map((sw, i) => {
            const p = clamp01v(sw.p);
            const disk = i === 1 && diskHLP > 0.03;
            return (
              <div
                key={`sw${sw.t}`}
                style={{
                  position: 'relative',
                  width: 118,
                  height: 56,
                  borderRadius: 9,
                  border: `2.5px ${p > 0.3 ? 'solid' : 'dashed'} ${disk ? theme.ok : p > 0.3 ? withAlphaM(theme.text, 0.75) : withAlphaM(theme.dim, 0.45)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: 0.45 + 0.55 * p,
                  boxShadow: disk ? `0 0 ${14 * clamp01v(diskHLP)}px ${withAlphaM(theme.ok, 0.5)}` : 'none',
                }}
              >
                <span style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, flexShrink: 0}}>{sw.t}</span>
                <span
                  style={{
                    width: 34,
                    height: 19,
                    borderRadius: 10,
                    border: `2.5px solid ${p > 0.5 ? theme.text : withAlphaM(theme.dim, 0.6)}`,
                    position: 'relative',
                  }}
                >
                  <span style={{position: 'absolute', left: p > 0.5 ? 16 : 2, top: 2, width: 11, height: 11, borderRadius: '50%', background: p > 0.5 ? theme.text : withAlphaM(theme.dim, 0.7)}} />
                </span>
                {disk ? (
                  <span style={{position: 'absolute', top: -24, left: '50%', transform: 'translateX(-50%)', padding: '1px 8px', borderRadius: 5, border: `2px solid ${theme.ok}`, fontFamily: theme.mono, fontSize: 11, color: theme.ok, whiteSpace: 'nowrap', opacity: clamp01v(diskHLP)}}>{'durable'}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** 进程边界框（4-A 拉远重锚——框内=运行中的程序：四层链与环体罩在框内；
 *  框外=磁盘文件持久层）。`litP` 框显形；`offP` 框内整体熄灭（程序关掉——
 *  框内三卡随熄、框体轮廓驻留）；`badgeP` 运行徽章（框缘——呼吸由调用侧
 *  喂 breathe 值）；`lifeP` 判时卡与框间生命线（框熄=线断的预演） */
export const ProcessFrame: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  litP?: number;
  offP?: number;
  badgeP?: number;
  badgeBreathe?: number;
  lifeP?: number;
  label?: string;
}> = ({x, y, w, h, litP = 1, offP = 0, badgeP = 0, badgeBreathe = 0, lifeP = 0, label = '进程 · 运行中的程序'}) => {
  const lit = clamp01v(litP);
  const off = clamp01v(offP);
  const badge = clamp01v(badgeP);
  const life = clamp01v(lifeP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit, pointerEvents: 'none'}}>
      {/* 框体（粗描边圆角框——框内明暗分工的容器） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 22,
          border: `${4 + 2 * off}px dashed ${withAlphaM(off > 0.5 ? theme.dim : theme.tool, off > 0.5 ? 0.5 : 0.7)}`,
          boxShadow: off < 0.5 ? `0 0 ${26 * (1 - off)}px ${withAlphaM(theme.tool, 0.12)}` : 'none',
        }}
      />
      {/* 框名签（左上角） */}
      <div style={{position: 'absolute', left: 24, top: -34, display: 'flex', alignItems: 'center', gap: 10}}>
        <span style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: off > 0.5 ? theme.dim : theme.tool, whiteSpace: 'nowrap'}}>{label}</span>
        <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>{'process boundary'}</span>
      </div>
      {/* 运行徽章（框右上缘——呼吸一拍；框熄后暗态） */}
      {badge > 0.03 ? (
        <div
          style={{
            position: 'absolute',
            right: 26,
            top: -18,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 14px',
            borderRadius: 12,
            border: `2.5px solid ${off > 0.5 ? withAlphaM(theme.dim, 0.5) : theme.ok}`,
            background: theme.panel,
            opacity: badge,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{width: 11, height: 11, borderRadius: '50%', background: off > 0.5 ? withAlphaM(theme.dim, 0.6) : theme.ok, boxShadow: off > 0.5 ? 'none' : `0 0 ${8 + 8 * badgeBreathe}px ${withAlphaM(theme.ok, 0.8)}`}} />
          <span style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: off > 0.5 ? theme.dim : theme.ok}}>{'运行中'}</span>
        </div>
      ) : null}
      {/* 生命线（判时卡 ↔ 框缘——判时线程活在进程里；框熄=线断的预演：虚线+断口） */}
      {life > 0.03 ? (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          <line
            x1={w - 150}
            y1={86}
            x2={w - 34}
            y2={86}
            stroke={off > 0.5 ? withAlphaM(theme.dim, 0.5) : theme.sched}
            strokeWidth={4}
            strokeDasharray={off > 0.5 ? '6 10' : undefined}
            strokeLinecap="round"
            opacity={life}
          />
        </svg>
      ) : null}
    </div>
  );
};

/** 停机时间轴（4-B——横贯时间轴自左向右推进：正常段 → 停机区间整段灰掉 →
 *  重启线竖起 → 其后下一个匹配分钟亮起；全程无回拨箭头。时间感载体归
 *  长春花蓝 sched 系（中性装置默认色通则）；划灰弃置走 danger、下一匹配
 *  分钟点亮走 ok（机制在位）。`litP` 显形；`sweepP` 时间轴推进（刻度行进）；
 *  `grayP` 停机区间灰掉；`dropPs` 两枚到点标记相继划灰弃置；`restartP` 重启线
 *  竖起；`nextP` 下一匹配分钟点亮 */
export const DowntimeAxis: React.FC<{
  x: number;
  y: number;
  w?: number;
  litP?: number;
  sweepP?: number;
  grayP?: number;
  dropPs?: [number, number];
  restartP?: number;
  nextP?: number;
}> = ({x, y, w = 1440, litP = 1, sweepP = 0, grayP = 0, dropPs = [0, 0], restartP = 0, nextP = 0}) => {
  const lit = clamp01v(litP);
  const sweep = clamp01v(sweepP);
  const gray = clamp01v(grayP);
  const drop1 = clamp01v(dropPs[0]);
  const drop2 = clamp01v(dropPs[1]);
  const restart = clamp01v(restartP);
  const next = clamp01v(nextP);
  const axY = 120;
  // 停机区间（时间轴中段——两枚到点标记落位）
  const stallFrom = w * 0.42;
  const stallTo = w * 0.68;
  const markXs = [stallFrom + (stallTo - stallFrom) * 0.32, stallFrom + (stallTo - stallFrom) * 0.72];
  const nextX = stallTo + (w - stallTo) * 0.34;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: 300, opacity: lit}}>
      <svg width={w} height={300} viewBox={`0 0 ${w} 300`} style={{overflow: 'visible'}}>
        {/* 主轴（自左向右推进——sweepP 描线；sched 时间感载体） */}
        <line x1={0} y1={axY} x2={w * sweep} y2={axY} stroke={withAlphaM(theme.sched, 0.8)} strokeWidth={5} strokeLinecap="round" />
        {/* 停机区间（整段灰掉——底灰带 + 端点垂线） */}
        {gray > 0.03 ? (
          <>
            <rect x={stallFrom} y={axY - 44} width={stallTo - stallFrom} height={88} rx={10} fill={withAlphaM(theme.dim, 0.16 * gray + 0.05)} opacity={gray} />
            <line x1={stallFrom} y1={axY - 44} x2={stallFrom} y2={axY + 44} stroke={withAlphaM(theme.dim, 0.6)} strokeWidth={3} strokeDasharray="8 7" />
            <line x1={stallTo} y1={axY - 44} x2={stallTo} y2={axY + 44} stroke={withAlphaM(theme.dim, 0.6)} strokeWidth={3} strokeDasharray="8 7" />
            <text x={(stallFrom + stallTo) / 2} y={axY - 58} textAnchor="middle" fontFamily={theme.sans} fontSize={19} fontWeight={700} fill={theme.dim} opacity={gray}>
              停机区间
            </text>
          </>
        ) : null}
        {/* 两枚到点标记（停机区间内——相继划灰弃置：到点位先亮后划掉） */}
        {markXs.map((mx, i) => {
          const dp = i === 0 ? drop1 : drop2;
          const shown = sweep * w > mx - 4;
          if (!shown) return null;
          return (
            <g key={`mk${i}`} opacity={1 - 0.15 * dp}>
              <circle cx={mx} cy={axY} r={13} fill={dp > 0.4 ? 'transparent' : withAlphaM(theme.sched, 0.85)} stroke={withAlphaM(theme.sched, 0.9)} strokeWidth={3.5} />
              {dp > 0.05 ? (
                <>
                  <line x1={mx - 15} y1={axY - 15} x2={mx + 15} y2={axY + 15} stroke={theme.danger} strokeWidth={4} strokeLinecap="round" opacity={dp} />
                  <line x1={mx + 15} y1={axY - 15} x2={mx - 15} y2={axY + 15} stroke={theme.danger} strokeWidth={4} strokeLinecap="round" opacity={dp} />
                </>
              ) : null}
            </g>
          );
        })}
        {/* 重启线（竖起——进程回来了；sched 系时间事件线） */}
        {restart > 0.03 ? (
          <line x1={stallTo} y1={axY - 84 * restart} x2={stallTo} y2={axY + 84 * restart} stroke={theme.sched} strokeWidth={5} strokeLinecap="round" opacity={restart} />
        ) : null}
        {/* 下一匹配分钟（重启线后——点亮不回补） */}
        {next > 0.03 ? (
          <>
            <circle cx={nextX} cy={axY} r={16} fill={withAlphaM(theme.ok, 0.25 * next)} stroke={theme.ok} strokeWidth={4} opacity={next} />
            <circle cx={nextX} cy={axY} r={6} fill={theme.ok} opacity={next} />
            <text x={nextX} y={axY - 34} textAnchor="middle" fontFamily={theme.sans} fontSize={18} fontWeight={700} fill={theme.ok} opacity={next}>
              下一个匹配分钟
            </text>
          </>
        ) : null}
        {/* 轴刻度（分钟格——时间读数，sched 弱档） */}
        {Array.from({length: 9}, (_, i) => {
          const tx = (i / 8) * w;
          const shown = sweep * w > tx;
          return shown ? <line key={`ax${i}`} x1={tx} y1={axY - 9} x2={tx} y2={axY + 9} stroke={withAlphaM(theme.sched, 0.55)} strokeWidth={2.5} /> : null;
        })}
      </svg>
      {/* 轴两端读数（mono——时间方向） */}
      <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 96, whiteSpace: 'nowrap'}}>
        <span>{'时间 →'}</span>
        <span>{'不回拨 · 不补跑'}</span>
      </div>
    </div>
  );
};

/** 五十格上限刻度尺（4-C 上半——格位可数与口播数字一致（50），逐格点亮至满格
 *  基线。中性装置默认色通则：中性描边 + 警示红满格基线点缀（限额语义），
 *  不占用双主题色）。`litP` 显形；`fillP` 整幅铺开；`cellsP` 格位逐格点亮 0..1 */
export const CapacityRuler: React.FC<{
  x: number;
  y: number;
  w?: number;
  litP?: number;
  fillP?: number;
  cellsP?: number;
}> = ({x, y, w = 1180, litP = 1, fillP = 0, cellsP = 0}) => {
  const lit = clamp01v(litP);
  const fill = clamp01v(fillP);
  const cells = clamp01v(cellsP);
  const n = 50;
  const gap = 4;
  const cw = (w - (n - 1) * gap) / n;
  const litCount = Math.round(cells * n);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: lit}}>
      <div style={{position: 'relative'}}>
        <div style={{display: 'flex', gap, height: 44, transform: `scaleX(${0.86 + 0.14 * fill})`, transformOrigin: '0% 50%', opacity: fill}}>
          {Array.from({length: n}, (_, i) => {
            const on = i < litCount;
            return (
              <span
                key={`cap${i}`}
                style={{
                  width: cw,
                  height: 44,
                  borderRadius: 3,
                  background: on ? withAlphaM(theme.dim, 0.55) : 'transparent',
                  border: `2px solid ${on ? withAlphaM(theme.dim, 0.8) : withAlphaM(theme.dim, 0.38)}`,
                }}
              />
            );
          })}
        </div>
        {/* 满格基线（右端竖线——警示红点缀：限额越线即拒） */}
        {cells > 0.85 ? (
          <div style={{position: 'absolute', right: -2, top: -8, bottom: -8, borderRight: `3.5px dashed ${withAlphaM(theme.danger, 0.85)}`, opacity: clamp01v((cells - 0.85) / 0.15)}} />
        ) : null}
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginTop: 8, whiteSpace: 'nowrap'}}>
        <span>{'0'}</span>
        <span style={{color: cells > 0.9 ? theme.danger : theme.dim}}>{'上限 50 · 满格基线'}</span>
        <span>{'50'}</span>
      </div>
    </div>
  );
};

/** 七天倒计时条（4-C 落定 / 4-D 烧蚀特写——自满格起算。中性装置默认色通则：
 *  中性描边 + 警示红烧蚀/费用点缀（到期语义），不占用双主题色；烧蚀全程
 *  静默——无警报元素，「悄悄」语义）。`litP` 显形；`walkP` 自满格开始走
 *  （0..1 剩余量：1=满格 → 0=烧尽）；`burnP` 条身烧蚀（右端烧蚀缘 + 灰烬色
 *  推进——与 walkP 同步或快于）；`feeP` 费用刻度爬升（单调升 0..1）；
 *  `hangP` 无人认领任务签悬空；`outP` 任务签自动出列退场（条烧尽后——出列
 *  即「防住了」） */
export const WeekBar: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  walkP?: number;
  burnP?: number;
  feeP?: number;
  hangP?: number;
  outP?: number;
}> = ({x, y, w = 980, h = 56, litP = 1, walkP = 1, burnP = 0, feeP = 0, hangP = 0, outP = 0}) => {
  const lit = clamp01v(litP);
  const walk = clamp01v(walkP);
  const burn = clamp01v(burnP);
  const fee = clamp01v(feeP);
  const hang = clamp01v(hangP);
  const out = clamp01v(outP);
  const remainW = w * walk;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: lit}}>
      {/* 无人认领的周期任务签（悬在条上空——悬空位、无人接手；条烧尽后自动出列） */}
      {hang > 0.03 ? (
        <div
          style={{
            position: 'absolute',
            left: w * 0.44,
            top: -66 - 6 * Math.sin(hang * Math.PI),
            padding: '6px 18px',
            borderRadius: 9,
            border: `2.5px solid ${theme.danger}`,
            background: withAlphaM(theme.panel, 0.97),
            fontFamily: theme.sans,
            fontSize: 19,
            fontWeight: 700,
            color: theme.danger,
            whiteSpace: 'nowrap',
            opacity: hang * (1 - out),
            transform: `translateY(${out * -80}px) rotate(${out * 6}deg)`,
          }}
        >
          {'没人认领'}
        </div>
      ) : null}
      {/* 条体（七天满格 → 烧蚀推进：中性剩余段 + 警示红烧蚀缘 + 灰烬段） */}
      <div style={{position: 'relative', height: h, borderRadius: 10, border: `3px solid ${withAlphaM(theme.dim, 0.65)}`, background: withAlphaM(theme.panel, 0.92), overflow: 'hidden'}}>
        {/* 满格刻度段（七格分度——满格起点可读） */}
        {Array.from({length: 7}, (_, i) => {
          const segX = (i / 7) * w;
          return <span key={`wk${i}`} style={{position: 'absolute', left: segX, top: 0, bottom: 0, borderLeft: i === 0 ? 'none' : `2px dashed ${withAlphaM(theme.dim, 0.4)}`}} />;
        })}
        {/* 剩余段（自满格起算走——中性灰阶，烧蚀=剩余递减） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: remainW,
            background: `linear-gradient(90deg, ${withAlphaM(theme.dim, 0.5)}, ${withAlphaM(theme.dim, 0.28)})`,
          }}
        />
        {/* 烧蚀缘（右端锯齿烧蚀——burnP 推进） */}
        {burn > 0.03 ? (
          <div
            style={{
              position: 'absolute',
              left: Math.max(0, remainW - 16),
              top: -4,
              bottom: -4,
              width: 26,
              background: `linear-gradient(90deg, ${withAlphaM(theme.danger, 0.8)}, transparent)`,
              clipPath: 'polygon(0 0, 100% 12%, 62% 28%, 100% 44%, 55% 62%, 100% 78%, 66% 92%, 100% 100%, 0 100%)',
              opacity: burn,
            }}
          />
        ) : null}
        {/* 灰烬段（烧过区——静默灰） */}
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: w - remainW, background: withAlphaM(theme.dim, 0.14 * burn + 0.05)}} />
        {/* 条心读数（d1..d7 剩余天数——烧尽后出列） */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.mono, fontSize: 25, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: theme.text, whiteSpace: 'nowrap'}}>
          {`第 ${Math.min(7, Math.max(0, 7 - Math.round((1 - walk) * 7)))} 天 / 7`}
        </div>
      </div>
      {/* 费用刻度（条下——单调爬升、全程静默无警报元素） */}
      <div style={{position: 'relative', height: 26, marginTop: 10}}>
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 12, borderRadius: 6, background: withAlphaM(theme.dim, 0.16)}}>
          <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fee * 100}%`, borderRadius: 6, background: withAlphaM(theme.danger, 0.4)}} />
        </div>
        <div style={{position: 'absolute', right: 0, bottom: 16, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap', opacity: fee > 0.05 ? 1 : 0.5}}>
          {'费用 · 静默爬升'}
        </div>
      </div>
      {/* 满七天标线（右端——到点即过期） */}
      <div style={{position: 'absolute', right: 2, top: -10, fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>满 7 天</div>
    </div>
  );
};
