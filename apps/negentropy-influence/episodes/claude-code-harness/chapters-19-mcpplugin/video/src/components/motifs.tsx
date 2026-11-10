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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2–ep18 延续——
// LoopRing 描边色/线宽跨集恒定（theme.core = 陶土橙 #D97757 + RING_STROKE 6）
// = 逐字节拷贝的前提。本集契约（storyboard 前言）：环体恒 core 描边，全片
// 场景一律 `nodes={[]}`（环体即循环本体，无站点标注态）；本集环上「调模型」
// 段高亮（全集唯一环上高亮段——每轮组装工具池正发生在环上这一步）为 SegArc
// 外层叠放（承 ep18 WorkRing 的外层包装形态，母题本体不动）。

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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep18 逐字节
 * 拷贝（本集场景一律 `nodes={[]}`：环体即循环本体，无站点标注态；恒 core
 * 陶土橙描边——「调模型」段高亮走 SegArc 外层叠放，本组件不动）。
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

/** 「调模型」段弧角域（系列五站中点式，承 ep2 EXEC_ARC 公约：站位「调模型」
 *  -18°，两侧中点 -54°/18°）——本集 M-001 变奏锚：全集唯一环上高亮段，
 *  1-E 建锚 → 2-A/2-B/3-A 同位同色 → 5-A 收光归一。 */
export const MODEL_CALL_ARC = {a0: -54, a1: 18} as const;

/** 消融双轨骨架（ep18 逐字节拷贝，源 ep16——左红右绿恒定，等高并置同题裁决；
 *  本集 3-B 消费：左「沿用旧池」/右「重建后」）。轨内容由调用场景按
 *  CHECK_LANES 常量摆位——装置只承载轨道背板 + 轨头标签。 */
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

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep19
// MCP 与插件）storyboard 实现映射登记：StepBar（三步签行①发现②命名③组装，
// 顶部窄条 y≥56——按槽位服役按槽位退役）/ SvcCard（外部服务卡，兰紫描边+
// 连接灯）/ ToolChip（工具卡·池内卡同形——中文名主字+英文角标+说明小字）/
// PrefixPlate（前缀挂牌，三段逐字拍上+双下划线分隔）/ ScrollList（清单卷轴）/
// SanitizeGrid（白名单归一网格——字符级翻写，1-C 与 2-C 同款同位同色复现）/
// CharRuler（字符窗标尺 0..64+超长卡拒收——「教学版」口径角标必带）/
// ToolPool（统一工具池——灌装/清空/注入/涟漪/褪层/微涌/嵌环态，池内卡片
// 同色同池）/ RegistryTable（对照表——立起/翻译联动/缩微/暗层状态机）/
// ChannelLane（传输通道，兰紫渐进）/ PermissionGate（权限闸——判读窗不留痕
// +宿主名单四条三绿一黄）/ EmblemBadge（MCP 徽记——契约允许的英文例外）。
// 全片主装置 = 工具池—对照表（深空蓝）+ 外部服务通道族（兰紫）两主题色语义
// 全片不互换；反例走 coral、消融左轨走 danger、机制在位/恢复/拦截走 ok。
// 哑装置原则承 ep15–18：动效参数（进度/状态/读数）一律经 prop 由调用场景注入，
// 装置自身零 motion hook 调用（连续相位经 `t`（帧）prop 注入；唯一例外
// useRingDot 族已在上）。计数渲染红线：计数一律离散发值，禁连续插值。

/** 三步签行（①发现 ②命名 ③组装——顶部窄条，驻安全带下方 y≥56）。
 *  `cur` 当前步唯一高亮（-1 无）；`done` 各步完成暗勾进度（0..1×3）；
 *  `chainP` 三签成链（全亮勾连——三步收拍）；`retireP` 整行退役淡出〔M-006〕。
 *  步色：①② svc（发现=连服务拿清单 / 命名=前缀挂牌，兰紫族）、③ pool（组装=池）。 */
export const STEP_ACCENTS = [theme.svc, theme.svc, theme.pool] as const;
export const STEP_LABELS = ['发现', '命名', '组装'] as const;

export const StepBar: React.FC<{
  litP?: number;
  cur?: number;
  done?: readonly number[];
  chainP?: number;
  retireP?: number;
  y?: number;
}> = ({litP = 1, cur = -1, done = [0, 0, 0], chainP = 0, retireP = 0, y = 56}) => {
  const lit = clamp01v(litP);
  const chain = clamp01v(chainP);
  const retire = clamp01v(retireP);
  const cw = 250;
  const gap = 120;
  const totalW = cw * 3 + gap * 2;
  const x0 = (1920 - totalW) / 2;
  return (
    <div
      style={{
        position: 'absolute',
        left: x0,
        top: y - retire * 16,
        width: totalW,
        height: 48,
        opacity: lit * (1 - retire),
        display: 'flex',
        alignItems: 'center',
        gap,
        pointerEvents: 'none',
      }}
    >
      {/* 成链连线（三签全亮勾连——三步收拍） */}
      {chain > 0.02 ? (
        <svg width={totalW} height={48} style={{position: 'absolute', inset: 0}}>
          <line
            x1={cw / 2}
            y1={24}
            x2={totalW - cw / 2}
            y2={24}
            stroke={theme.text}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="10 8"
            opacity={0.55 * chain}
          />
        </svg>
      ) : null}
      {STEP_LABELS.map((label, i) => {
        const dn = clamp01v(done[i] ?? 0);
        const on = i === cur || chain > 0.3;
        const tone = STEP_ACCENTS[i];
        return (
          <div
            key={`st${i}`}
            style={{
              position: 'relative',
              width: cw,
              height: 48,
              borderRadius: 12,
              border: `3px solid ${withAlphaM(tone, on ? 0.95 : 0.32)}`,
              background: on ? withAlphaM(tone, 0.14) : withAlphaM(theme.panel, 0.92),
              boxShadow: on && chain < 0.3 ? `0 0 ${14 * lit}px ${withAlphaM(tone, 0.4)}` : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              opacity: 0.5 + 0.5 * (on ? 1 : dn),
              transform: `translateY(${(1 - lit) * -14}px)`,
            }}
          >
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                border: `2.5px solid ${on || dn > 0.5 ? tone : withAlphaM(theme.dim, 0.6)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 17,
                fontWeight: 700,
                color: on || dn > 0.5 ? tone : theme.dim,
                background: dn > 0.6 && !on ? withAlphaM(tone, 0.16) : 'transparent',
              }}
            >
              {/* 完成暗勾（①转完成、②转完成——勾替代数字） */}
              {dn > 0.6 && !(i === cur && chain < 0.3) ? (
                <svg width={16} height={16} viewBox="0 0 16 16">
                  <path d="M2.5 8.5 L6.5 12.5 L13.5 3.5" fill="none" stroke={tone} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: on ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** 外部服务卡（兰紫描边——服务侧两入口的载体）。`lampP` 连接灯（ok 绿——
 *  「连接是好的」的具象，3-B 病灶定位用）；`flashP` 描边一闪；`ghost` 泛指
 *  剪影态（3-A 新服务——不显名，虚线轮廓）。 */
export const SvcCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  title: string;
  tag: string;
  litP?: number;
  flashP?: number;
  lampP?: number;
  ghost?: boolean;
}> = ({x, y, w = 340, h = 260, title, tag, litP = 1, flashP = 0, lampP = 0, ghost = false}) => {
  const lit = clamp01v(litP);
  const flash = clamp01v(flashP);
  const lamp = clamp01v(lampP);
  const edge = ghost ? withAlphaM(theme.dim, 0.55) : theme.svc;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          border: `${ghost ? 3 : 4}px ${ghost ? 'dashed' : 'solid'} ${edge}`,
          background: withAlphaM(theme.panel, 0.96),
          boxShadow: flash > 0.04 ? `0 0 ${26 * flash}px ${withAlphaM(theme.svc, 0.55 * flash)}` : 'none',
        }}
      >
        <div style={{position: 'absolute', left: 24, top: 20, fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
          {title}
        </div>
        <div style={{position: 'absolute', right: 18, top: 18, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.9}}>
          {tag}
        </div>
        {/* 服务图形（卡内左上——圆角芯片形，兰紫族内跟主色系） */}
        <svg width={64} height={52} viewBox="0 0 64 52" style={{position: 'absolute', left: 24, top: 66}}>
          <rect x={6} y={8} width={44} height={36} rx={8} fill={withAlphaM(theme.svc, ghost ? 0.05 : 0.14)} stroke={edge} strokeWidth={3} strokeDasharray={ghost ? '6 5' : undefined} />
          <line x1={14} y1={0} y2={16} x2={14} stroke={edge} strokeWidth={3} strokeLinecap="round" />
          <line x1={26} y1={0} y2={16} x2={26} stroke={edge} strokeWidth={3} strokeLinecap="round" />
          <line x1={38} y1={0} y2={16} x2={38} stroke={edge} strokeWidth={3} strokeLinecap="round" />
          <line x1={14} y1={36} y2={52} x2={14} stroke={edge} strokeWidth={3} strokeLinecap="round" />
          <line x1={26} y1={36} y2={52} x2={26} stroke={edge} strokeWidth={3} strokeLinecap="round" />
          <line x1={38} y1={36} y2={52} x2={38} stroke={edge} strokeWidth={3} strokeLinecap="round" />
        </svg>
        {/* 连接灯（ok 绿——连接是好的；灯亮不代表可调，3-B 张力峰值对照物） */}
        {lamp > 0.02 ? (
          <div style={{position: 'absolute', left: 24, bottom: 18, display: 'flex', alignItems: 'center', gap: 9, opacity: lamp}}>
            <span
              style={{
                width: 15,
                height: 15,
                borderRadius: '50%',
                background: theme.ok,
                boxShadow: `0 0 ${12 * lamp}px ${withAlphaM(theme.ok, 0.7)}`,
                display: 'inline-block',
              }}
            />
            <span style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.ok, whiteSpace: 'nowrap'}}>已连接</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 工具卡（清单卷轴上/走查舞台/池内同形——中文名主字+英文角标+说明小字）。
 *  `tone` 缺省 svc（外部工具在服务侧/挂牌语境）；池内传 pool（同池同色——
 *  内外工具不分层色）。`dropP` 自上落入位移；`bob` 微涌偏移（场景算好注入）。 */
export const ToolChip: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  name: string;
  tag?: string;
  desc?: string;
  descP?: number;
  litP?: number;
  dropP?: number;
  bob?: number;
  tone?: string;
  micro?: boolean;
}> = ({x, y, w = 190, h = 108, name, tag, desc, descP = 0, litP = 1, dropP = 0, bob = 0, tone, micro = false}) => {
  const lit = clamp01v(litP);
  const drop = clamp01v(dropP);
  const dp = clamp01v(descP);
  const on = tone ?? theme.svc;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + (1 - drop) * -110 + bob,
        width: w,
        height: h,
        opacity: lit * drop,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 11,
          border: `${micro ? 2.5 : 3}px solid ${withAlphaM(on, 0.85)}`,
          background: withAlphaM(theme.panel, 0.97),
          padding: micro ? '8px 12px' : '12px 16px',
        }}
      >
        <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8}}>
          <span style={{fontFamily: theme.sans, fontSize: micro ? 17 : 21, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
            {name}
          </span>
          {tag ? (
            <span style={{fontFamily: theme.mono, fontSize: micro ? 11 : 13, color: theme.dim, whiteSpace: 'nowrap'}}>{tag}</span>
          ) : null}
        </div>
        {/* 说明小字（件件带说明——关键词标签，禁成句） */}
        {desc ? (
          <div
            style={{
              marginTop: micro ? 4 : 8,
              fontFamily: theme.sans,
              fontSize: micro ? 12 : 15,
              color: dp > 0.4 ? theme.dim : withAlphaM(theme.dim, 0.4),
              whiteSpace: 'nowrap',
              opacity: 0.35 + 0.65 * dp,
            }}
          >
            {desc}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 前缀挂牌（三段逐字拍上：前缀段 mcp__ · 服务名段 · 双下划线隔段 · 工具名段
 *  ——全段进角标 mono 小字）。`segs` 三段各自的落下进度；`sepFlashP` 双下划线
 *  分隔符各闪一拍（结构强调）；`blank` 服务名段空槽（结构示教不编服务名）。 */
export const PrefixPlate: React.FC<{
  x: number;
  y: number;
  litP?: number;
  segs?: readonly [number, number, number];
  sepFlashP?: number;
  blank?: boolean;
  tone?: string;
  server?: string;
  tool?: string;
}> = ({x, y, litP = 1, segs = [1, 1, 1], sepFlashP = 0, blank = false, tone, server = 'deploy', tool = 'check'}) => {
  const lit = clamp01v(litP);
  const s0 = clamp01v(segs[0]);
  const s1 = clamp01v(segs[1]);
  const s2 = clamp01v(segs[2]);
  const flash = clamp01v(sepFlashP);
  const on = tone ?? theme.svc;
  const cell = (wPx: number, text: string, p: number, dashed = false, hot = 0) => (
    <div
      style={{
        width: wPx,
        height: 44,
        borderRadius: 8,
        border: `2.5px ${dashed ? 'dashed' : 'solid'} ${withAlphaM(on, 0.35 + 0.65 * p)}`,
        background: p > 0.4 ? withAlphaM(on, 0.16) : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.mono,
        fontSize: 18,
        fontWeight: 700,
        color: p > 0.4 ? theme.text : theme.dim,
        whiteSpace: 'nowrap',
        opacity: p,
        transform: `translateY(${(1 - p) * -36}px)`,
        boxShadow: hot > 0.05 ? `0 0 ${18 * hot}px ${withAlphaM(on, 0.6 * hot)}` : 'none',
      }}
    >
      {text}
    </div>
  );
  return (
    <div style={{position: 'absolute', left: x, top: y, display: 'flex', gap: 8, opacity: lit, pointerEvents: 'none'}}>
      {cell(96, 'mcp__', s0)}
      {cell(110, blank ? '　' : server, s1, blank)}
      {/* 双下划线分隔符（结构强调——各闪一拍） */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, opacity: Math.max(s0, flash)}}>
        <span style={{width: 34, height: 5, borderRadius: 2.5, background: flash > 0.1 ? on : withAlphaM(on, 0.6), boxShadow: flash > 0.1 ? `0 0 ${12 * flash}px ${withAlphaM(on, 0.8)}` : 'none'}} />
        <span style={{width: 34, height: 5, borderRadius: 2.5, background: flash > 0.1 ? on : withAlphaM(on, 0.6), boxShadow: flash > 0.1 ? `0 0 ${12 * flash}px ${withAlphaM(on, 0.8)}` : 'none'}} />
      </div>
      {cell(96, tool, s2, false, flash * 0.6)}
    </div>
  );
};

/** 清单卷轴（服务回传的报文——两端卷轴 + 展开面）。`unrollP` 自右向左展开
 *  （回传方向：服务→主程序）；内容（两枚 ToolChip）由场景经 children 摆入。 */
export const ScrollList: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  unrollP?: number;
  children?: React.ReactNode;
}> = ({x, y, w = 560, h = 200, litP = 1, unrollP = 0, children}) => {
  const lit = clamp01v(litP);
  const un = clamp01v(unrollP);
  const rod = (rx: number, o: number) => (
    <div
      style={{
        position: 'absolute',
        left: rx,
        top: -12,
        width: 22,
        height: h + 24,
        borderRadius: 11,
        background: withAlphaM(theme.panel, 0.98),
        border: `3px solid ${withAlphaM(theme.svc, 0.35 + 0.55 * o)}`,
        opacity: o,
      }}
    />
  );
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      {/* 展开面（自右向左显形——回传方向） */}
      <div
        style={{
          position: 'absolute',
          left: 22,
          top: 0,
          width: (w - 44) * un,
          height: h,
          overflow: 'hidden',
          borderRadius: 10,
          border: `3px solid ${withAlphaM(theme.svc, 0.75)}`,
          background: withAlphaM(theme.panel, 0.95),
        }}
      >
        <div style={{position: 'absolute', left: 0, top: 0, width: w - 44, height: h}}>{children}</div>
      </div>
      {rod(w - 44, 1)}
      {rod(0, 1)}
    </div>
  );
};

/** 白名单归一网格（细格发光带——非白名单字符被格线拦下、逐字符翻成下划线）。
 *  1-C 与 2-C 同款同位同色复现（镜间身份恒常——同 device 同几何即同构）。
 *  `raw` 原始名（mono 角标级）；`enterP` 名字卡入网；`flipPs` 各非法字符的
 *  翻转进度（'/' 与 '.' 各一枚）；`doneP` 翻写完成落成全名卡；`stampP`
 *  「在案」戳（2-C 实测标记，仅 2-C 传值）。 */
export const SanitizeGrid: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  enterP?: number;
  flipPs?: readonly number[];
  doneP?: number;
  stampP?: number;
  raw?: string;
  resultTag?: string;
}> = ({x, y, w = 760, h = 150, litP = 1, enterP = 0, flipPs = [0, 0], doneP = 0, stampP = 0, raw = 'inv-checker/search.user', resultTag = 'inv-checker_search_user'}) => {
  const lit = clamp01v(litP);
  const enter = clamp01v(enterP);
  const done = clamp01v(doneP);
  const stamp = clamp01v(stampP);
  const cells = 24;
  const cw = (w - 24) / cells;
  // 非法字符在串中的下标（'/' 与 '.'）——逐字符翻转的靶位
  const badIdx = raw
    .split('')
    .map((c, i) => (c === '/' || c === '.' ? i : -1))
    .filter((i) => i >= 0);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h + 90, opacity: lit}}>
      {/* 发光细格带（网格本体——白名单的具象） */}
      <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h, display: 'flex', alignItems: 'stretch'}}>
        {Array.from({length: cells}, (_, i) => (
          <div
            key={`gc${i}`}
            style={{
              width: cw,
              height: h,
              border: `1.5px solid ${withAlphaM(theme.pool, 0.22 + 0.3 * lit)}`,
              background: i % 2 === 0 ? withAlphaM(theme.pool, 0.05) : 'transparent',
            }}
          />
        ))}
      </div>
      {/* 原始名（字符行——入网后逐字符翻写：非法字符被拦下翻 '_'） */}
      <div style={{position: 'absolute', left: 12, top: h * 0.22, display: 'flex', gap: 3, opacity: 0.35 + 0.65 * enter, transform: `translateX(${(1 - enter) * 90}px)`}}>
        {raw.split('').map((c, i) => {
          const bi = badIdx.indexOf(i);
          const fp = bi >= 0 ? clamp01v(flipPs[bi] ?? 0) : 0;
          const flipped = fp > 0.5;
          return (
            <span
              key={`sc${i}`}
              style={{
                fontFamily: theme.mono,
                fontSize: 21,
                fontWeight: 700,
                color: bi >= 0 ? (flipped ? theme.pool : theme.coral) : theme.dim,
                whiteSpace: 'pre',
                transform: `rotateY(${fp * 180}deg)`,
                textShadow: bi >= 0 && !flipped && fp > 0.02 ? `0 0 10px ${withAlphaM(theme.coral, 0.8)}` : 'none',
              }}
            >
              {bi >= 0 && flipped ? '_' : c}
            </span>
          );
        })}
      </div>
      {/* 网格标签（角标级） */}
      <div style={{position: 'absolute', left: 2, top: h + 8, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>
        白名单 · A-Z a-z 0-9 _ -
      </div>
      {/* 落成的全名卡（翻写完成——角标 inv-checker/search.user → inv-checker_search_user） */}
      {done > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: w * 0.34,
            top: h + 34,
            padding: '8px 20px',
            borderRadius: 10,
            border: `3px solid ${withAlphaM(theme.pool, 0.5 + 0.5 * done)}`,
            background: withAlphaM(theme.pool, 0.1),
            fontFamily: theme.mono,
            fontSize: 19,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: done,
            transform: `translateY(${(1 - done) * 14}px)`,
          }}
        >
          {resultTag}
          {/* 「在案」戳（2-C 实测标记——唯一确认绿元素，斜盖不常驻剧场化） */}
          {stamp > 0.02 ? (
            <span
              style={{
                position: 'absolute',
                right: -26,
                top: -22,
                padding: '3px 12px',
                borderRadius: 8,
                border: `3px solid ${withAlphaM(theme.ok, 0.55 + 0.45 * stamp)}`,
                fontFamily: theme.sans,
                fontSize: 16,
                fontWeight: 700,
                color: theme.ok,
                whiteSpace: 'nowrap',
                transform: `rotate(-10deg) scale(${0.7 + 0.3 * stamp})`,
                background: withAlphaM(theme.panel, 0.97),
                opacity: stamp,
              }}
            >
              在案
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

/** 字符窗标尺（0..64 基线刻度——超长全名卡滑入卡在 64 刻度线外 +「>64 拒收」
 *  红牌拍落）。「教学版」口径角标必带（官方 128 不上屏——数字分歧不双开，
 *  B.1 登记纪律）；刻度与口播一致（64）。`cardP` 超长卡滑入；`rejectP`
 *  红牌拍落。 */
export const CharRuler: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  cardP?: number;
  rejectP?: number;
  sample?: string;
  len?: number;
}> = ({x, y, w = 1180, h = 300, litP = 1, cardP = 0, rejectP = 0, sample = 'mcp__deploy__trigger__check', len = 78}) => {
  const lit = clamp01v(litP);
  const card = clamp01v(cardP);
  const reject = clamp01v(rejectP);
  const rulerW = w - 120;
  const at64 = rulerW; // 64 刻度线位置（0..64 线性映射）
  const barW = (len / 64) * rulerW; // 超长卡长度（> rulerW 即越线）
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          border: `3.5px solid ${withAlphaM(theme.coral, 0.4 + 0.5 * Math.max(lit, reject))}`,
          background: withAlphaM(theme.panel, 0.96),
        }}
      >
        {/* 教学版口径角标（必带——官方 128 不上屏） */}
        <div style={{position: 'absolute', right: 20, top: 16, fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.9}}>
          64 字符线 · 教学版口径
        </div>
        {/* 标尺（刻度 0..64——小刻每 4、标数 0/16/32/48/64） */}
        <div style={{position: 'absolute', left: 60, top: 96, width: rulerW, height: 88, opacity: lit}}>
          <svg width={rulerW} height={36} viewBox={`0 0 ${rulerW} 36`}>
            {Array.from({length: 17}, (_, i) => {
              const tx = (i / 16) * rulerW;
              const major = i % 4 === 0;
              return <line key={`tk${i}`} x1={tx} y1={0} x2={tx} y2={major ? 16 : 9} stroke={withAlphaM(theme.dim, major ? 0.9 : 0.5)} strokeWidth={major ? 2.5 : 1.8} />;
            })}
            <line x1={0} y1={0} x2={rulerW} y2={0} stroke={withAlphaM(theme.dim, 0.9)} strokeWidth={2.5} />
            {/* 64 刻度线（硬线——竖起一道拒收红线） */}
            <line x1={at64} y1={-26} x2={at64} y2={30} stroke={theme.coral} strokeWidth={4} opacity={lit} />
            {[0, 16, 32, 48, 64].map((n) => (
              <text
                key={`lb${n}`}
                x={(n / 64) * rulerW}
                y={34}
                textAnchor={n === 0 ? 'start' : n === 64 ? 'end' : 'middle'}
                fontFamily={theme.mono}
                fontSize={15}
                fill={n === 64 ? theme.coral : theme.dim}
              >
                {n}
              </text>
            ))}
          </svg>
        </div>
        {/* 超长全名卡（滑入——长度条为主体，mono 小字随行；尾部越出 64 刻度线） */}
        <div
          style={{
            position: 'absolute',
            left: 60 + (1 - card) * -560,
            top: 176,
            width: barW,
            opacity: card,
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <div
              style={{
                width: barW,
                height: 34,
                borderRadius: 6,
                border: `3px solid ${withAlphaM(theme.dim, 0.8)}`,
                background: withAlphaM(theme.dim, 0.16),
                position: 'relative',
              }}
            >
              {/* 越线段（64 线外的尾部——珊瑚红警示段） */}
              <div
                style={{
                  position: 'absolute',
                  left: at64,
                  right: 0,
                  top: -3,
                  bottom: -3,
                  borderRadius: '0 6px 6px 0',
                  background: withAlphaM(theme.coral, 0.3),
                  borderRight: `4px solid ${theme.coral}`,
                }}
              />
            </div>
          </div>
          <div style={{marginTop: 8, fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>
            {sample}
            <span style={{color: theme.coral, marginLeft: 10}}>{len} 字符</span>
          </div>
        </div>
        {/* 「>64 拒收」红牌（拍落定格——珊瑚红） */}
        {reject > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: rulerW - 130,
              top: 250,
              padding: '8px 22px',
              borderRadius: 10,
              border: `3.5px solid ${withAlphaM(theme.coral, 0.6 + 0.4 * reject)}`,
              background: withAlphaM(theme.coral, 0.16),
              fontFamily: theme.sans,
              fontSize: 23,
              fontWeight: 700,
              color: theme.coral,
              whiteSpace: 'nowrap',
              opacity: reject,
              transform: `translateY(${(1 - reject) * -46}px) rotate(-3deg)`,
            }}
          >
            &gt;64 拒收
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 统一工具池（本集主装置——深空蓝池体：暗态轮廓→灌装→清空/注入循环→涟漪→
 *  褪层→嵌环终态）。池内卡片同色同池（内外工具不分层色——同池语义红线）。
 *  `outlineP` 暗态轮廓（1-A 只亮轮廓不显卡）；`fillP` 灌装水位/色块充盈；
 *  `clearP` 清空（卡片淡出+水位降——与注入两拍明确可辨）；`rippleP` 涟漪
 *  （一次性 0..1 自池心扩散）；`t` 连续涟漪相位帧（2-C 活池涌动）；`shedP`
 *  旧外层褪层（片片褪起）；`surgeP` 卡片微涌一拍；`capTag/capP` 口径角标
 *  （「教学版 5+1」——必带教学版字样）；`labelP` 「工具池」签。 */
export const ToolPool: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  outlineP?: number;
  fillP?: number;
  clearP?: number;
  rippleP?: number;
  t?: number;
  shedP?: number;
  surgeP?: number;
  cards?: readonly {name: string; litP: number}[];
  labelP?: number;
  capTag?: string;
  capP?: number;
  dimP?: number;
}> = ({
  x,
  y,
  w = 440,
  h = 300,
  litP = 1,
  outlineP = 0,
  fillP = 0,
  clearP = 0,
  rippleP = 0,
  t,
  shedP = 0,
  surgeP = 0,
  cards = [],
  labelP = 1,
  capTag = '教学版 5+1',
  capP = 0,
  dimP = 0,
}) => {
  const lit = clamp01v(litP);
  const outline = clamp01v(outlineP);
  const fill = clamp01v(fillP);
  const clear = clamp01v(clearP);
  const shed = clamp01v(shedP);
  const surge = clamp01v(surgeP);
  const dim = clamp01v(dimP);
  const lp = clamp01v(labelP);
  const cap = clamp01v(capP);
  // 水位：灌装升、清空降（清/注两拍明确可辨——水位即辨析物）
  const level = fill * (1 - clear * 0.88);
  const surgeLift = Math.sin(Math.PI * surge) * -7;
  // 涟漪：一次性（rippleP 0..1）或连续相位（t 传帧时 2s 周期双环）
  const ringR = (phase: number) => Math.max(w, h) * 0.18 + phase * Math.max(w, h) * 0.42;
  const r1 = t !== undefined ? ((t % 64) / 64) : clamp01v(rippleP);
  const r2 = t !== undefined ? (((t + 32) % 64) / 64) : clamp01v(rippleP) * 0.55;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit * (1 - 0.62 * dim)}}>
      {/* 池体（深空蓝描边——暗态 dashed 轮廓 → 实线池体） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '24px 24px 30px 30px',
          border: outline < 0.6 ? `3.5px dashed ${withAlphaM(theme.pool, 0.25 + 0.5 * outline)}` : `4px solid ${theme.pool}`,
          background: withAlphaM(theme.panel, 0.9),
          overflow: 'hidden',
        }}
      >
        {/* 池水（色块流充盈——自底升起） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${Math.round(level * 100)}%`,
            background: `linear-gradient(180deg, ${withAlphaM(theme.pool, 0.1)}, ${withAlphaM(theme.pool, 0.34)})`,
            borderTop: `3px solid ${withAlphaM(theme.pool, 0.6)}`,
          }}
        />
        {/* 池内卡片（同色同池——不分内外层色；4×2 槽位） */}
        <div style={{position: 'absolute', inset: 0, padding: '20px 22px', display: 'flex', flexWrap: 'wrap', gap: 12, alignContent: 'flex-start'}}>
          {cards.map((c, i) => {
            const cp = clamp01v(c.litP) * (1 - clear);
            return (
              <div
                key={`pc${i}`}
                style={{
                  width: (w - 44 - 36) / 2,
                  height: 54,
                  borderRadius: 9,
                  border: `2.5px solid ${withAlphaM(theme.pool, 0.5 + 0.5 * cp)}`,
                  background: withAlphaM(theme.pool, 0.12 + 0.1 * cp),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.sans,
                  fontSize: 18,
                  fontWeight: 700,
                  color: cp > 0.5 ? theme.text : theme.dim,
                  whiteSpace: 'nowrap',
                  opacity: cp,
                  transform: `translateY(${(1 - cp) * -40 + surgeLift * (i % 2 === 0 ? 1 : 0.6)}px)`,
                }}
              >
                {c.name}
              </div>
            );
          })}
        </div>
      </div>
      {/* 涟漪（自池心扩散——池外溢出可见） */}
      {(rippleP > 0.02 || t !== undefined) && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none'}}>
          {[r1, r2].map((ph, i) => (
            <ellipse
              key={`rp${i}`}
              cx={w / 2}
              cy={h / 2}
              rx={ringR(ph)}
              ry={ringR(ph) * 0.42}
              fill="none"
              stroke={theme.pool}
              strokeWidth={3}
              opacity={(1 - ph) * 0.6 * (t !== undefined ? 1 : clamp01v(rippleP))}
            />
          ))}
        </svg>
      )}
      {/* 旧外层褪层（片片褪起——2-C 活池预告） */}
      {shed > 0.02
        ? [0, 1, 2, 3].map((k) => (
            <div
              key={`sh${k}`}
              style={{
                position: 'absolute',
                left: k === 0 || k === 3 ? -6 : w * 0.3,
                top: k < 2 ? -6 : h - 8,
                width: k === 1 || k === 2 ? w * 0.4 : 52,
                height: k < 2 ? 14 : 18,
                borderRadius: 7,
                border: `2.5px solid ${withAlphaM(theme.pool, 0.7)}`,
                background: withAlphaM(theme.panel, 0.9),
                transform: `translate(${shed * (k % 2 === 0 ? -46 : 46)}px, ${shed * (k < 2 ? -52 : 46)}px) rotate(${shed * (k % 2 === 0 ? -14 : 12)}deg)`,
                opacity: shed * (1 - shed * 0.7),
              }}
            />
          ))
        : null}
      {/* 「工具池」签（池顶上沿——净空 ≥20px） */}
      {lp > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: -42,
            padding: '4px 18px',
            borderRadius: 9,
            border: `2.5px solid ${withAlphaM(theme.pool, 0.4 + 0.5 * lp)}`,
            background: withAlphaM(theme.panel, 0.97),
            fontFamily: theme.sans,
            fontSize: 20,
            fontWeight: 700,
            color: lp > 0.5 ? theme.text : theme.dim,
            whiteSpace: 'nowrap',
            opacity: lp,
          }}
        >
          工具池
        </div>
      ) : null}
      {/* 口径角标（教学版——必带字样，池右上沿） */}
      {cap > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: -38,
            fontFamily: theme.mono,
            fontSize: 14,
            color: theme.dim,
            whiteSpace: 'nowrap',
            opacity: cap * 0.95,
          }}
        >
          {capTag}
        </div>
      ) : null}
    </div>
  );
};

/** 对照表（承系列查表视觉血缘——分发查表→命名翻译表，同一装置语义换内容）。
 *  双列：左「全名」右「原始名」；`rows` 各行点亮；`hitP` 命中行高亮；`slideP`
 *  全名卡沿行自左列滑移至右列（翻译轨迹——2-B 单输入翻译演示）；`connectorP`
 *  中缝连线闪合（翻译关系接线）；`micro` 缩微联动位（2-A——表行内容低于可读
 *  阈值即回退表形图标 + 行数角标，承 ep2 同款条款）；`dimP` 暗层（P3/P4）。 */
export const RegistryTable: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  rows?: readonly {full: string; orig: string; litP: number}[];
  hitP?: number;
  slideP?: number;
  connectorP?: number;
  micro?: boolean;
  dimP?: number;
  rowsTag?: string;
}> = ({x, y, w = 420, h = 240, litP = 1, rows = [], hitP = 0, slideP = 0, connectorP = 0, micro = false, dimP = 0, rowsTag}) => {
  const lit = clamp01v(litP);
  const hit = clamp01v(hitP);
  const slide = clamp01v(slideP);
  const conn = clamp01v(connectorP);
  const dim = clamp01v(dimP);
  if (micro) {
    // 缩微联动位：表形图标 + 行数角标（内容低于可读阈值的回退形态）
    return (
      <div style={{position: 'absolute', left: x, top: y, width: 150, height: 130, opacity: lit * (1 - 0.55 * dim)}}>
        <svg width={150} height={130} viewBox="0 0 150 130">
          <rect x={4} y={4} width={142} height={122} rx={10} fill={withAlphaM(theme.panel, 0.95)} stroke={withAlphaM(theme.pool, 0.7)} strokeWidth={3} />
          <line x1={4} y1={44} x2={146} y2={44} stroke={withAlphaM(theme.pool, 0.5)} strokeWidth={2.5} />
          <line x1={75} y1={44} x2={75} y2={126} stroke={withAlphaM(theme.pool, 0.4)} strokeWidth={2.5} />
          {[0, 1, 2].map((r) => (
            <line key={`mr${r}`} x1={16} y1={64 + r * 24} x2={64} y2={64 + r * 24} stroke={withAlphaM(theme.dim, 0.55)} strokeWidth={3} strokeLinecap="round" />
          ))}
          {[0, 1, 2].map((r) => (
            <line key={`ml${r}`} x1={86} y1={64 + r * 24} x2={134} y2={64 + r * 24} stroke={withAlphaM(theme.dim, 0.4)} strokeWidth={3} strokeLinecap="round" />
          ))}
        </svg>
        <div style={{position: 'absolute', left: 0, top: -26, fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.9}}>
          对照表{rowsTag ? ` · ${rowsTag}` : ''}
        </div>
      </div>
    );
  }
  const rowH = 52;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit * (1 - 0.62 * dim)}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: `3.5px solid ${withAlphaM(theme.pool, 0.55 + 0.35 * hit)}`,
          background: withAlphaM(theme.panel, 0.96),
          boxShadow: hit > 0.3 ? `0 0 ${22 * hit}px ${withAlphaM(theme.pool, 0.3 * hit)}` : 'none',
        }}
      >
        {/* 表头（双列——全名 | 原始名） */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 50, display: 'flex', borderBottom: `2.5px solid ${withAlphaM(theme.pool, 0.5)}`}}>
          {['全名', '原始名'].map((h, i) => (
            <div
              key={`th${i}`}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.sans,
                fontSize: 21,
                fontWeight: 700,
                color: theme.text,
                whiteSpace: 'nowrap',
              }}
            >
              {h}
            </div>
          ))}
        </div>
        {/* 行（左全名右原始名——逐行点亮；命中行高亮+滑移） */}
        {rows.map((r, i) => {
          const rp = clamp01v(r.litP);
          const rowHot = i === 0 ? hit : 0;
          return (
            <div key={`tr${i}`} style={{position: 'absolute', left: 0, right: 0, top: 50 + i * rowH, height: rowH, display: 'flex', opacity: rp}}>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.mono,
                  fontSize: 15,
                  color: rowHot > 0.3 ? theme.text : theme.dim,
                  whiteSpace: 'nowrap',
                  background: rowHot > 0.05 ? withAlphaM(theme.pool, 0.14 * rowHot) : 'transparent',
                }}
              >
                {r.full}
              </div>
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.mono,
                  fontSize: 15,
                  color: rowHot > 0.3 ? theme.text : theme.dim,
                  whiteSpace: 'nowrap',
                }}
              >
                {r.orig}
              </div>
              {/* 全名卡滑移（沿行自左列至右列——翻译轨迹，仅首行演示） */}
              {i === 0 && slide > 0.02 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: `${8 + slide * 46}%`,
                    top: 6,
                    padding: '4px 12px',
                    borderRadius: 7,
                    border: `2.5px solid ${withAlphaM(theme.pool, 0.9)}`,
                    background: withAlphaM(theme.panel, 0.98),
                    fontFamily: theme.mono,
                    fontSize: 14,
                    fontWeight: 700,
                    color: theme.pool,
                    whiteSpace: 'nowrap',
                    opacity: Math.min(1, slide * 2) * (1 - Math.max(0, slide - 0.85) * 6),
                    zIndex: 2,
                  }}
                >
                  {slide < 0.5 ? r.full : r.orig}
                </div>
              ) : null}
            </div>
          );
        })}
        {/* 中缝连线（翻译关系——闪合） */}
        {conn > 0.02 ? (
          <svg width={w} height={h} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
            <line
              x1={w / 2}
              y1={62}
              x2={w / 2}
              y2={50 + rowH - 8}
              stroke={theme.pool}
              strokeWidth={3.5}
              strokeLinecap="round"
              opacity={conn}
            />
          </svg>
        ) : null}
      </div>
    </div>
  );
};

/** 传输通道（4-A 六条竖列之一——兰紫渐进亮度）。`t` 帧相位（车道流光——
 *  竖向行进虚线）；`tag` 通道名（mono 角标，只进角标不上大字）。 */
export const ChannelLane: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  tag: string;
  t?: number;
}> = ({x, y, w = 120, h = 420, litP = 1, tag, t = 0}) => {
  const lit = clamp01v(litP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: 0.25 + 0.75 * lit}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '60px 60px 26px 26px',
          border: `3px solid ${withAlphaM(theme.svc, 0.25 + 0.65 * lit)}`,
          background: `linear-gradient(180deg, ${withAlphaM(theme.svc, 0.16 * lit)}, ${withAlphaM(theme.svc, 0.04)})`,
        }}
      >
        {/* 车道流光（竖向行进虚线——双向微光：中缝上/下两股） */}
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
          <line
            x1={w / 2 - 12}
            y1={18}
            x2={w / 2 - 12}
            y2={h - 18}
            stroke={withAlphaM(theme.svc, 0.85)}
            strokeWidth={3}
            strokeDasharray="12 16"
            strokeDashoffset={-(t * 1.4) % 28}
            opacity={lit}
            strokeLinecap="round"
          />
          <line
            x1={w / 2 + 12}
            y1={18}
            x2={w / 2 + 12}
            y2={h - 18}
            stroke={withAlphaM(theme.svc, 0.6)}
            strokeWidth={3}
            strokeDasharray="12 16"
            strokeDashoffset={(t * 1.4) % 28}
            opacity={lit}
            strokeLinecap="round"
          />
        </svg>
      </div>
      {/* 通道名角标（mono 小字——只进角标） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: h + 12,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 16,
          color: theme.dim,
          whiteSpace: 'nowrap',
          opacity: 0.35 + 0.6 * lit,
        }}
      >
        {tag}
      </div>
    </div>
  );
};

/** 权限闸（4-B——深灰门体+判读窗+宿主名单四条目名单带）。
 *  机制红线：判读窗对自我介绍卡「扫描线掠过即空、不留任何判读痕」（X-001
 *  逆旁白防线——扫描线是唯一可见物、窗内恒空）。名单条目全名只进角标、
 *  三绿一黄（allow=ok / confirm=warn）；`hotP` 黄签放大一拍（回环点名 P2
 *  走查例）；`askP` 黄签「每次问」小标；`scanP` 扫描线掠过；`listP` 名单
 *  翻出；`pulseP` 名单外工具卡撞门一拍（弹道由场景绘制）。 */
export const PermissionGate: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  scanP?: number;
  listP?: number;
  entries?: readonly {tag: string; kind: 'allow' | 'confirm'; litP: number}[];
  hotP?: number;
  askP?: number;
  hostP?: number;
}> = ({x, y, w = 460, h = 420, litP = 1, scanP = 0, listP = 0, entries = [], hotP = 0, askP = 0, hostP = 0}) => {
  const lit = clamp01v(litP);
  const scan = clamp01v(scanP);
  const list = clamp01v(listP);
  const hot = clamp01v(hotP);
  const ask = clamp01v(askP);
  const host = clamp01v(hostP);
  const rowH = 54;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      {/* 闸后主程序轮廓（掌管工具执行的主程序——白话先释视觉对位） */}
      <div
        style={{
          position: 'absolute',
          left: w / 2 - 120,
          top: -86,
          width: 240,
          height: 74,
          borderRadius: 12,
          border: `3px ${host > 0.4 ? 'solid' : 'dashed'} ${withAlphaM(theme.pool, 0.3 + 0.6 * host)}`,
          background: withAlphaM(theme.pool, 0.08 * host),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.sans,
          fontSize: 18,
          fontWeight: 700,
          color: host > 0.4 ? theme.text : theme.dim,
          whiteSpace: 'nowrap',
          opacity: 0.35 + 0.65 * host,
        }}
      >
        主程序 · 宿主
      </div>
      {/* 门体（深灰——判读窗在上、名单带在下） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          border: `5px solid ${withAlphaM(theme.panelBorder, 0.98)}`,
          background: withAlphaM(theme.panel, 0.97),
          boxShadow: `0 10px 34px ${withAlphaM('#000000', 0.4)}`,
        }}
      >
        <div style={{position: 'absolute', left: 0, right: 0, top: 16, textAlign: 'center', fontFamily: theme.sans, fontSize: 25, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
          权限闸
        </div>
        {/* 判读窗（扫描线掠过即空、不留判读痕——窗内恒空是机制红线） */}
        <div
          style={{
            position: 'absolute',
            left: 60,
            top: 62,
            width: w - 120,
            height: 66,
            borderRadius: 10,
            border: `3px solid ${withAlphaM(theme.dim, 0.55)}`,
            background: withAlphaM(theme.bg, 0.75),
            overflow: 'hidden',
          }}
        >
          {scan > 0.02 && scan < 0.98 ? (
            <div
              style={{
                position: 'absolute',
                left: scan * (w - 140),
                top: 4,
                width: 4,
                height: 54,
                borderRadius: 2,
                background: theme.dim,
                boxShadow: `0 0 12px ${withAlphaM(theme.dim, 0.9)}`,
                opacity: 1 - scan * 0.3,
              }}
            />
          ) : null}
        </div>
        {/* 宿主名单（四条目名单带——三绿一黄；条目全名进角标） */}
        <div
          style={{
            position: 'absolute',
            left: 34,
            right: 34,
            top: 150,
            height: entries.length * rowH + 46,
            borderRadius: 12,
            border: `3px solid ${withAlphaM(theme.pool, 0.3 + 0.6 * list)}`,
            background: withAlphaM(theme.panel, 0.98),
            opacity: list,
            transform: `translateY(${(1 - list) * 26}px) rotateX(${(1 - list) * 38}deg)`,
            transformOrigin: '50% 0%',
          }}
        >
          <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '8px 16px 0'}}>
            <span style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>宿主名单</span>
            <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap'}}>
              四条 · 三绿一黄 · 教学版
            </span>
          </div>
          {entries.map((e, i) => {
            const ep = clamp01v(e.litP);
            const tone = e.kind === 'allow' ? theme.ok : theme.warn;
            const isHot = e.kind === 'confirm' && hot > 0.02;
            return (
              <div
                key={`ge${i}`}
                style={{
                  position: 'absolute',
                  left: 12,
                  right: 12,
                  top: 40 + i * rowH,
                  height: rowH - 8,
                  borderRadius: 9,
                  border: `2.5px solid ${withAlphaM(tone, 0.3 + 0.7 * ep)}`,
                  background: withAlphaM(tone, 0.08 + 0.1 * ep),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '0 14px',
                  opacity: ep,
                  transform: `translateY(${(1 - ep) * 12}px) scale(${isHot ? 1 + 0.06 * hot : 1})`,
                  boxShadow: isHot ? `0 0 ${20 * hot}px ${withAlphaM(tone, 0.55 * hot)}` : 'none',
                }}
              >
                <span style={{width: 12, height: 12, borderRadius: '50%', background: tone, display: 'inline-block', opacity: 0.9}} />
                <span style={{fontFamily: theme.mono, fontSize: 15, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{e.tag}</span>
                <span style={{marginLeft: 'auto', fontFamily: theme.sans, fontSize: 14, fontWeight: 700, color: tone, whiteSpace: 'nowrap'}}>
                  {e.kind === 'allow' ? '放行' : '每次都问'}
                </span>
                {/* 黄签「每次问」小标（挂签——confirm 档专属） */}
                {e.kind === 'confirm' && ask > 0.02 ? (
                  <span
                    style={{
                      position: 'absolute',
                      right: -14,
                      top: -20,
                      padding: '2px 10px',
                      borderRadius: 7,
                      border: `2.5px solid ${withAlphaM(theme.warn, 0.5 + 0.5 * ask)}`,
                      background: withAlphaM(theme.panel, 0.98),
                      fontFamily: theme.sans,
                      fontSize: 13,
                      fontWeight: 700,
                      color: theme.warn,
                      whiteSpace: 'nowrap',
                      opacity: ask,
                      transform: `rotate(6deg) translateY(${(1 - ask) * -8}px)`,
                    }}
                  >
                    每次问
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        {/* 角标（MCP_HOST_POLICY——授权只认宿主配置） */}
        <div style={{position: 'absolute', right: 14, top: 14, fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>
          MCP_HOST_POLICY
        </div>
      </div>
    </div>
  );
};

/** MCP 徽记（0-B 门楣标准徽记——兰紫描边圆形徽记，契约允许的英文例外：
 *  「MCP」三字母为机制名首现主字；全称只进角标）。`captionP` 全称角标淡入
 *  （Model Context Protocol）。 */
export const EmblemBadge: React.FC<{x: number; y: number; size?: number; litP?: number; captionP?: number}> = ({
  x,
  y,
  size = 120,
  litP = 1,
  captionP = 0,
}) => {
  const lit = clamp01v(litP);
  const cap = clamp01v(captionP);
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: lit}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow: 'visible'}}>
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 8} fill={withAlphaM(theme.panel, 0.97)} stroke={theme.svc} strokeWidth={4.5} />
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 18} fill="none" stroke={withAlphaM(theme.svc, 0.4)} strokeWidth={2} strokeDasharray="6 6" />
        <text
          x={size / 2}
          y={size / 2 + 9}
          textAnchor="middle"
          fontFamily={theme.mono}
          fontSize={size * 0.26}
          fontWeight={700}
          fill={theme.text}
          letterSpacing={2}
        >
          MCP
        </text>
      </svg>
      {cap > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: size + 18,
            top: size / 2 - 14,
            fontFamily: theme.mono,
            fontSize: 17,
            color: theme.dim,
            whiteSpace: 'nowrap',
            opacity: cap,
          }}
        >
          MCP · Model Context Protocol
        </div>
      ) : null}
    </div>
  );
};
