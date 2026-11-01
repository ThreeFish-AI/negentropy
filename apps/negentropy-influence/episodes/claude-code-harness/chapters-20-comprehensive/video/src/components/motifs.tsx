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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2–ep19 延续——
// LoopRing 描边色/线宽跨集恒定（theme.core = 陶土橙 #D97757 + RING_STROKE 6）
// = 逐字节拷贝的前提。本集契约（storyboard 前言）：环体恒 core 描边，全片
// 场景一律 `nodes={[]}`（环体即循环本体，无站点标注态）；本集环体双态画法
// （远景 RingCore 细线四拍呼吸 / 近景 CorridorWalk 走廊——中线恒为环体线）
// 以外层包装组件承载，LoopRing/SegArc 本体不动（承 ep18 WorkRing 先例）。

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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep19 逐字节
 * 拷贝（本集场景一律 `nodes={[]}`：环体即循环本体，无站点标注态；恒 core
 * 陶土橙描边——走廊中线态由 CorridorWalk 同几何承载，本组件不动）。
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

/** 环上「调模型」段弧角域（系列五站中点式，承 ep2 EXEC_ARC 公约：站位「调模型」
 *  -18°，两侧中点 -54°/18°）——本集「调模型」拍位锚：1-C 调用舱骑跨中线此段、
 *  4-C 名册归「调模型」前置槽位（每轮组装正发生在环上这一步）。 */
export const MODEL_CALL_ARC = {a0: -54, a1: 18} as const;

/** 消融双轨骨架（ep19 逐字节拷贝，源 ep16——左红右绿恒定，等高并置同题裁决；
 *  本集 4-D 消费：左「沿用旧名册」/右「每轮重组」）。轨内容由调用场景按
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

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep20
// 综合回合）storyboard 实现映射登记：RingCore（远景环体独在态——细线四拍
// 呼吸 ≤5%，LoopRing 外层包装）/ CorridorWalk（近景走廊态——恒定蓝墙体 +
// 陶土橙中线双态；走廊与环体并用不替换）/ SlotRail（挂点槽带——暗态轮廓/
// 逐站点亮/厚圈全亮三态，环边一圈）/ MechanismSil（十八枚机制剪影卡——灰调
// 形态件，零文字零前集标题：闸/钩/清单/底座/垫/墙/轨/钟/箱/牌/板/本/池/铃/
// 齿/门/梯/管）/ CountBand（汇流计数带 18/18 + 口径字幕条——计数离散发值）/
// BeatTag（四拍节拍签——0-B 建锚 / 5-D 回扣同签同形）/ GateBooth（入口岗亭
// ——驻环外，灯亮+挂钩+扫描）/ PrepRoom（准备室三联——门牌暗态→逐室亮）/
// RecoveryPad（恢复垫四徽章——限流/超载/超长/再压）/ ForkDesk（岔口判读台
// ——正反双分支同帧）/ LaneTrack（执行三车道——拦红/直绿/后台蓝恒定）/
// RosterGrid（27 格名册+外接槽+洗牌态）/ EvoRuler（演进链计数标尺
// 8→14→18→27）/ PairCard（左右对照卡族——中性描边）/ DoorFrame（委派两门
// ——中性门体）/ SelfTestBar（自检跑条——18 格断言带+日志行数）/ WhileTrueCard
// （四句收束块——五行代码剪影+while True 角标）/ CrossSection（环体剖面——
// 合流紫设施层环绕细线循环，5-A/5-B 同形）/ GroupArcs（五段组弧——承片头
// 五进度点形态，零文字）。全片主装置 = 走廊×挂点槽（恒定蓝墙体+合流紫设施格
// 两主题色语义全片不互换）；反例走 danger、放行/恢复/全绿走 ok、日志回流走
// exec、中性装置 theme.dim/panelBorder。哑装置原则承 ep15–19：动效参数
// （进度/状态/读数）一律经 prop 由调用场景注入，装置自身零 motion hook 调用
// （连续相位经 `t`（帧）prop 注入）。计数渲染红线：计数一律离散发值
// （Math.round 于场景侧先行），禁连续插值上屏。

/** 远景环体独在态（〔M-001〕细线四拍呼吸——narration 备注指定形态 @breathe
 *  ≤5%）：LoopRing 外层包装，呼吸只作用缩放、环体描边色/线宽/圆度不动。
 *  `beatT` 帧相位驱动内芯四拍微光（芯子在场陈述的帧上形态）。 */
export const RingCore: React.FC<{
  x: number;
  y: number;
  size: number;
  litP?: number;
  breatheAmp?: number;
  t?: number;
  dotProgress?: number;
  coreBeatP?: number;
}> = ({x, y, size, litP = 1, breatheAmp = 0.02, t = 0, dotProgress, coreBeatP = 0}) => {
  const lit = clamp01v(litP);
  // 呼吸：±2% 缩放（≤5% 红线内），相位帧驱动无随机
  const breathe = 1 + breatheAmp * Math.sin((2 * Math.PI * t) / 96);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: size, height: size, opacity: lit}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${breathe})`,
          transformOrigin: '50% 50%',
        }}
      >
        <LoopRing size={size} nodes={[]} showExit={false} dotProgress={dotProgress} />
      </div>
      {/* 芯子四拍微光（0-A「芯子还是那四句」齐闪一拍 / 5-D 剖面四拍确认同几何） */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{position: 'absolute', inset: 0}}>
        {[-90, 0, 90, 180].map((a, k) => {
          const rad = (a * Math.PI) / 180;
          const cx = size / 2 + (size / 2 - 46) * 0.52 * Math.cos(rad);
          const cy = size / 2 + (size / 2 - 46) * 0.52 * Math.sin(rad);
          return (
            <circle
              key={`cb${k}`}
              cx={cx}
              cy={cy}
              r={9}
              fill={theme.core}
              opacity={0.25 + 0.75 * clamp01v(coreBeatP)}
            />
          );
        })}
      </svg>
    </div>
  );
};

/** 近景走廊态（本集主装置——环体的可行走形态：恒定蓝墙体描边 + 陶土橙中线
 *  即环体〔M-001〕，走廊与环体并用不替换）。`wallP` 墙体自中线两侧展开贯屏
 *  （0-C→1-A morph 的展开通道）；`t` 帧相位（中线四拍节拍微光轮转）；`cells`
 *  走廊外侧设施壁（上墙外沿一格一设施的合流紫设施带，逐格 litP）；`slotPs`
 *  下墙外沿挂点槽带（暗态细槽→逐站点亮）。哑装置：全部状态经 prop 注入。 */
export const CorridorWalk: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  wallP?: number;
  t?: number;
  cells?: readonly number[];
  slotPs?: readonly number[];
  midPulse?: number;
  litP?: number;
}> = ({x, y, w, h, wallP = 1, t = 0, cells = [], slotPs = [], midPulse = 1, litP = 1}) => {
  const lit = clamp01v(litP);
  const wall = clamp01v(wallP);
  const half = (w / 2) * wall; // 墙体自中线向两侧展开的半幅
  const midY = h / 2;
  const wallT = 44; // 上墙体 y（墙厚 10）
  const wallB = h - 44;
  // 四拍节拍：四个节拍点沿中线等距，轮流提亮（22 帧一拍）
  const beat = (k: number) => 0.35 + 0.65 * Math.max(0, Math.sin((2 * Math.PI * (t - k * 22)) / 88));
  const nCells = Math.max(cells.length, 1);
  const cellW = (w - 40) / nCells;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      {/* 上墙外侧设施壁（一格一设施——合流紫设施带） */}
      {cells.length > 0 ? (
        <div style={{position: 'absolute', left: 20, top: wallT - 64, width: w - 40, height: 46, display: 'flex', gap: 6}}>
          {cells.map((c, i) => {
            const cp = clamp01v(c);
            return (
              <div
                key={`fc${i}`}
                style={{
                  flex: 1,
                  maxWidth: cellW,
                  borderRadius: 7,
                  border: `2.5px solid ${withAlphaM(theme.merge, 0.3 + 0.6 * cp)}`,
                  background: cp > 0.4 ? withAlphaM(theme.merge, 0.18) : withAlphaM(theme.panel, 0.8),
                  opacity: cp,
                  transform: `translateY(${(1 - cp) * -10}px)`,
                }}
              />
            );
          })}
        </div>
      ) : null}
      {/* 墙体（恒定蓝双线 + 立柱刻痕——自中线两侧展开） */}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        {[wallT, wallB].map((wy, wi) => (
          <g key={`wl${wi}`}>
            <line x1={w / 2 - half} y1={wy} x2={w / 2 + half} y2={wy} stroke={theme.loop} strokeWidth={5} strokeLinecap="round" />
            <line x1={w / 2 - half} y1={wy + (wi === 0 ? 9 : -9)} x2={w / 2 + half} y2={wy + (wi === 0 ? 9 : -9)} stroke={withAlphaM(theme.loop, 0.4)} strokeWidth={2} />
            {/* 立柱刻痕（每 120px 一柱——墙体的工程质感层） */}
            {Array.from({length: Math.floor(w / 120) + 1}, (_, i) => {
              const sx = i * 120;
              return sx >= w / 2 - half && sx <= w / 2 + half ? (
                <line key={`st${wi}-${i}`} x1={sx} y1={wy - 7} x2={sx} y2={wy + 7} stroke={withAlphaM(theme.loop, 0.5)} strokeWidth={2.5} />
              ) : null;
            })}
          </g>
        ))}
        {/* 中线＝环体（陶土橙细线全片锚定——走廊态下环体即此线） */}
        <line x1={16} y1={midY} x2={w - 16} y2={midY} stroke={theme.core} strokeWidth={3.5} strokeLinecap="round" opacity={0.9} />
        {/* 四拍节拍微光（沿中线等距四点轮流提亮——「循环没变」的帧上证据） */}
        {[0, 1, 2, 3].map((k) => {
          const bx = w * (0.2 + k * 0.2);
          return <circle key={`bt${k}`} cx={bx} cy={midY} r={7} fill={theme.core} opacity={midPulse * beat(k)} />;
        })}
      </svg>
      {/* 下墙外沿挂点槽带（暗态细槽→逐站点亮——本集主装置的挂点面） */}
      {slotPs.length > 0 ? (
        <div style={{position: 'absolute', left: 20, top: wallB + 22, width: w - 40, height: 34, display: 'flex', gap: 6, alignItems: 'center'}}>
          {slotPs.map((s, i) => {
            const sp = clamp01v(s);
            return (
              <div
                key={`sl${i}`}
                style={{
                  flex: 1,
                  height: 26,
                  borderRadius: 13,
                  border: `${sp > 0.4 ? 3 : 2}px ${sp > 0.4 ? 'solid' : 'dashed'} ${withAlphaM(sp > 0.4 ? theme.merge : theme.dim, 0.3 + 0.6 * Math.max(sp, 0.25))}`,
                  background: sp > 0.4 ? withAlphaM(theme.merge, 0.2) : 'transparent',
                  opacity: 0.35 + 0.65 * Math.max(sp, 0.25),
                }}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

/** 挂点槽带（环边一圈——远景态主装置）：n 枚槽圆绕环排布，暗态细槽圈 →
 *  逐站点亮（合流紫）→ 厚圈全亮（整圈增亮一档不变形）。`litPs` 逐槽进度；
 *  `thickP` 厚圈（整圈 annulus 增亮）；`outlineP` 暗态轮廓初亮。 */
export const SlotRail: React.FC<{
  cx: number;
  cy: number;
  r: number;
  n?: number;
  outlineP?: number;
  litPs?: readonly number[];
  thickP?: number;
  glowI?: number;
}> = ({cx, cy, r, n = 18, outlineP = 0, litPs = [], thickP = 0, glowI = -1}) => {
  const outline = clamp01v(outlineP);
  const thick = clamp01v(thickP);
  const slotR = 13;
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
      {/* 厚圈（设施层整圈——只增亮不变形，X-001 逆旁白防线） */}
      {thick > 0.02 ? (
        <>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.merge} strokeWidth={30} opacity={0.16 * thick} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.merge} strokeWidth={12} opacity={0.3 * thick} />
        </>
      ) : null}
      {Array.from({length: n}, (_, i) => {
        const a = (-90 + (i * 360) / n) * (Math.PI / 180);
        const sx = cx + r * Math.cos(a);
        const sy = cy + r * Math.sin(a);
        const lp = clamp01v(litPs[i] ?? 0);
        const hot = i === glowI;
        return (
          <g key={`sr${i}`}>
            {/* 暗态细槽圈（虚线轮廓——P1 起逐站点亮前的虚位态） */}
            <circle
              cx={sx}
              cy={sy}
              r={slotR}
              fill={lp > 0.4 ? withAlphaM(theme.merge, 0.3) : theme.bg}
              stroke={lp > 0.4 ? theme.merge : withAlphaM(theme.dim, 0.4 + 0.3 * outline)}
              strokeWidth={lp > 0.4 ? 4 : 2.5}
              strokeDasharray={lp > 0.4 ? undefined : '5 4'}
              opacity={Math.max(outline, lp)}
            />
            {hot ? <circle cx={sx} cy={sy} r={slotR + 7} fill="none" stroke={theme.merge} strokeWidth={2.5} opacity={0.7} /> : null}
          </g>
        );
      })}
    </svg>
  );
};

/** 十八枚机制剪影卡（灰调形态件——反串线：回闪只用装置形态，零文字零前集
 *  标题零集数序号）。`i` 形号 0..17（闸/钩/清单/底座/垫/墙/轨/钟/箱/牌/板/
 *  本/池/铃/齿/门/梯/管）；`fly` 0..1 自屏外飞入落位（场景注入起终点）；灰调
 *  = theme.dim 描边，点亮格心 dim 填充。 */
export const SIL_SHAPES = ['gate', 'hook', 'list', 'base', 'pad', 'wall', 'rail', 'clock', 'box', 'plate', 'board', 'book', 'pool', 'bell', 'gear', 'door', 'ladder', 'pipe'] as const;

const SilGlyph: React.FC<{i: number; size: number}> = ({i, size}) => {
  const s = size;
  const u = s / 48; // 48 系设计稿的缩放单位
  const st = {stroke: theme.dim, strokeWidth: 3 * u, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  const shape = SIL_SHAPES[((i % 18) + 18) % 18];
  return (
    <svg width={s} height={s} viewBox="0 0 48 48">
      {shape === 'gate' && (
        <g {...st}>
          <line x1={12} y1={8} x2={12} y2={40} />
          <line x1={36} y1={8} x2={36} y2={40} />
          <line x1={9} y1={16} x2={39} y2={16} />
          <line x1={24} y1={16} x2={24} y2={30} />
          <line x1={18} y1={30} x2={30} y2={30} />
        </g>
      )}
      {shape === 'hook' && (
        <g {...st}>
          <path d="M24 8 V28 A8 8 0 0 0 32 36" />
          <circle cx={24} cy={7} r={4} />
        </g>
      )}
      {shape === 'list' && (
        <g {...st}>
          <rect x={10} y={7} width={28} height={34} rx={4} />
          <line x1={17} y1={16} x2={31} y2={16} />
          <line x1={17} y1={24} x2={31} y2={24} />
          <line x1={17} y1={32} x2={25} y2={32} />
        </g>
      )}
      {shape === 'base' && (
        <g {...st}>
          <rect x={8} y={30} width={32} height={9} rx={2} />
          <line x1={14} y1={30} x2={14} y2={12} />
          <line x1={34} y1={30} x2={34} y2={12} />
          <line x1={14} y1={12} x2={34} y2={12} />
        </g>
      )}
      {shape === 'pad' && (
        <g {...st}>
          <rect x={8} y={18} width={32} height={14} rx={7} />
          <line x1={24} y1={18} x2={24} y2={32} />
        </g>
      )}
      {shape === 'wall' && (
        <g {...st}>
          <rect x={8} y={12} width={32} height={24} />
          <line x1={8} y1={20} x2={40} y2={20} />
          <line x1={8} y1={28} x2={40} y2={28} />
          <line x1={18} y1={12} x2={18} y2={20} />
          <line x1={30} y1={20} x2={30} y2={28} />
          <line x1={18} y1={28} x2={18} y2={36} />
        </g>
      )}
      {shape === 'rail' && (
        <g {...st}>
          <line x1={10} y1={18} x2={38} y2={18} />
          <line x1={10} y1={30} x2={38} y2={30} />
          <line x1={16} y1={14} x2={16} y2={34} />
          <line x1={24} y1={14} x2={24} y2={34} />
          <line x1={32} y1={14} x2={32} y2={34} />
        </g>
      )}
      {shape === 'clock' && (
        <g {...st}>
          <circle cx={24} cy={24} r={15} />
          <line x1={24} y1={24} x2={24} y2={14} />
          <line x1={24} y1={24} x2={32} y2={28} />
        </g>
      )}
      {shape === 'box' && (
        <g {...st}>
          <path d="M10 16 L24 9 L38 16 L38 32 L24 39 L10 32 Z" />
          <path d="M10 16 L24 23 L38 16" />
          <line x1={24} y1={23} x2={24} y2={39} />
        </g>
      )}
      {shape === 'plate' && (
        <g {...st}>
          <rect x={12} y={9} width={24} height={18} rx={4} />
          <circle cx={24} cy={18} r={3.5} />
          <line x1={24} y1={27} x2={24} y2={39} />
        </g>
      )}
      {shape === 'board' && (
        <g {...st}>
          <rect x={9} y={9} width={30} height={30} rx={3} />
          <line x1={9} y1={17} x2={39} y2={17} />
          <line x1={15} y1={24} x2={33} y2={24} />
          <line x1={15} y1={31} x2={27} y2={31} />
        </g>
      )}
      {shape === 'book' && (
        <g {...st}>
          <path d="M24 13 C20 9 13 9 10 11 V35 C13 33 20 33 24 37" />
          <path d="M24 13 C28 9 35 9 38 11 V35 C35 33 28 33 24 37" />
          <line x1={24} y1={13} x2={24} y2={37} />
        </g>
      )}
      {shape === 'pool' && (
        <g {...st}>
          <path d="M9 18 L39 18 L35 38 L13 38 Z" />
          <path d="M12 25 C16 22 20 28 24 25 C28 22 32 28 36 25" />
        </g>
      )}
      {shape === 'bell' && (
        <g {...st}>
          <path d="M14 32 C14 18 18 12 24 12 C30 12 34 18 34 32 Z" />
          <line x1={10} y1={32} x2={38} y2={32} />
          <circle cx={24} cy={37} r={3} />
        </g>
      )}
      {shape === 'gear' && (
        <g {...st}>
          <circle cx={24} cy={24} r={11} />
          <circle cx={24} cy={24} r={4.5} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => {
            const rad = (d * Math.PI) / 180;
            return <line key={`gt${d}`} x1={24 + 11 * Math.cos(rad)} y1={24 + 11 * Math.sin(rad)} x2={24 + 16 * Math.cos(rad)} y2={24 + 16 * Math.sin(rad)} {...st} />;
          })}
        </g>
      )}
      {shape === 'door' && (
        <g {...st}>
          <rect x={13} y={8} width={22} height={32} rx={3} />
          <line x1={24} y1={8} x2={24} y2={40} />
          <circle cx={19} cy={25} r={2} />
          <circle cx={29} cy={25} r={2} />
        </g>
      )}
      {shape === 'ladder' && (
        <g {...st}>
          <line x1={16} y1={8} x2={16} y2={40} />
          <line x1={32} y1={8} x2={32} y2={40} />
          <line x1={16} y1={15} x2={32} y2={15} />
          <line x1={16} y1={24} x2={32} y2={24} />
          <line x1={16} y1={33} x2={32} y2={33} />
        </g>
      )}
      {shape === 'pipe' && (
        <g {...st}>
          <path d="M12 8 V28 A8 8 0 0 0 20 36 H38" />
          <rect x={8} y={5} width={8} height={6} rx={2} />
          <rect x={36} y={32} width={8} height={8} rx={2} />
        </g>
      )}
    </svg>
  );
};

export const MechanismSil: React.FC<{
  x: number;
  y: number;
  i: number;
  size?: number;
  litP?: number;
  flyP?: number;
  fromX?: number;
  fromY?: number;
  dimP?: number;
}> = ({x, y, i, size = 56, litP = 1, flyP = 1, fromX = 0, fromY = 0, dimP = 0}) => {
  const lit = clamp01v(litP);
  const fly = clamp01v(flyP);
  const dim = clamp01v(dimP);
  return (
    <div
      style={{
        position: 'absolute',
        left: x + (1 - fly) * fromX - size / 2,
        top: y + (1 - fly) * fromY - size / 2,
        width: size,
        height: size,
        opacity: lit * fly * (1 - 0.55 * dim),
        transform: `scale(${0.7 + 0.3 * fly})`,
      }}
    >
      <SilGlyph i={i} size={size} />
    </div>
  );
};

/** 汇流计数带（18/18——数字镜：卡数与口径字幕对账；`n` 离散发值由场景
 *  Math.round 先行，本件零插值）+ 口径字幕条（20−18 对账，整拍可读）。 */
export const CountBand: React.FC<{y?: number; litP?: number; n: number; capP?: number}> = ({
  y = 772,
  litP = 1,
  n,
  capP = 0,
}) => {
  const lit = clamp01v(litP);
  const cap = clamp01v(capP);
  const full = n >= 18;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', opacity: lit, pointerEvents: 'none'}}>
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: 40,
          fontWeight: 700,
          color: full ? theme.merge : theme.text,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: 2,
        }}
      >
        {`${n}/18`}
      </div>
      {/* 口径字幕条（十八般机制＝全部外围机制——20−18 对账，驻安全带上方） */}
      <div
        style={{
          marginTop: 10,
          fontFamily: theme.mono,
          fontSize: 19,
          color: theme.dim,
          whiteSpace: 'nowrap',
          opacity: 0.35 + 0.65 * cap,
        }}
      >
        {'十八般机制＝全部外围机制 · 芯子与终章不计入'}
      </div>
    </div>
  );
};

/** 四拍节拍签（0-B 建锚 / 5-D 回扣——同签同形同序；≤4 字/签关键词标签）。 */
export const BeatTag: React.FC<{
  x: number;
  y: number;
  label: string;
  litP?: number;
  tone?: string;
  w?: number;
}> = ({x, y, label, litP = 0, tone, w = 150}) => {
  const lit = clamp01v(litP);
  const on = tone ?? theme.core;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - 24,
        width: w,
        height: 48,
        borderRadius: 11,
        border: `3px solid ${lit > 0.35 ? on : withAlphaM(theme.dim, 0.5)}`,
        background: lit > 0.35 ? withAlphaM(on, 0.15) : withAlphaM(theme.panel, 0.9),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.sans,
        fontSize: 22,
        fontWeight: 700,
        color: lit > 0.35 ? theme.text : theme.dim,
        whiteSpace: 'nowrap',
        opacity: Math.max(0.3, lit),
        transform: `scale(${0.92 + 0.08 * lit})`,
        boxShadow: lit > 0.6 ? `0 0 ${14 * lit}px ${withAlphaM(on, 0.4)}` : 'none',
      }}
    >
      {label}
    </div>
  );
};

/** 入口岗亭（驻环外——门口的事不占循环）：门体中性、灯亮/挂钩/扫描走合流紫
 *  （输入钩子＝机制设施）。`lampP` 灯亮；`hookP` 挂钩小形探出；`scanP` 扫描线
 *  掠过（单向）；`doorSignP`「门外」小签。角标（UserPromptSubmit）由场景挂。 */
export const GateBooth: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  lampP?: number;
  hookP?: number;
  scanP?: number;
  doorSignP?: number;
}> = ({x, y, w = 170, h = 140, litP = 1, lampP = 0, hookP = 0, scanP = 0, doorSignP = 0}) => {
  const lit = clamp01v(litP);
  const lamp = clamp01v(lampP);
  const hook = clamp01v(hookP);
  const scan = clamp01v(scanP);
  const sign = clamp01v(doorSignP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: `4px solid ${withAlphaM(theme.panelBorder, 0.98)}`,
          background: withAlphaM(theme.panel, 0.96),
          boxShadow: `0 8px 26px ${withAlphaM('#000000', 0.4)}`,
          overflow: 'hidden',
        }}
      >
        {/* 亭顶檐 */}
        <div style={{position: 'absolute', left: -8, top: -14, right: -8, height: 22, borderRadius: 8, background: withAlphaM(theme.panelBorder, 0.98)}} />
        {/* 岗亭灯（合流紫——输入钩子设施灯亮） */}
        <div style={{position: 'absolute', left: 20, top: 22, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.3 + 0.7 * lamp}}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: theme.merge,
              boxShadow: lamp > 0.4 ? `0 0 ${14 * lamp}px ${withAlphaM(theme.merge, 0.8)}` : 'none',
              display: 'inline-block',
            }}
          />
          <span style={{fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: lamp > 0.4 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>值守</span>
        </div>
        {/* 亭内挂钩小形（输入钩子——看一眼再放行的机械面） */}
        <svg width={w - 40} height={54} viewBox="0 0 130 54" style={{position: 'absolute', left: 20, top: 52}}>
          <path
            d="M18 6 V28 A12 12 0 0 0 30 40"
            fill="none"
            stroke={theme.merge}
            strokeWidth={4.5}
            strokeLinecap="round"
            opacity={hook}
            transform={`translate(${(1 - hook) * -14}px, 0)`}
          />
          <circle cx={18} cy={5} r={4.5} fill={theme.merge} opacity={hook} />
          {/* 扫描线（自左向右单向掠过——红线：禁双向往返） */}
          {scan > 0.02 && scan < 0.98 ? (
            <line x1={8 + scan * 114} y1={2} x2={8 + scan * 114} y2={50} stroke={theme.dim} strokeWidth={3} strokeLinecap="round" opacity={0.9 - scan * 0.3} />
          ) : null}
        </svg>
        {/* 「门外」小签（亭体明确驻环外位——不占循环的空间陈述） */}
        {sign > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              right: 10,
              bottom: 10,
              padding: '3px 12px',
              borderRadius: 8,
              border: `2.5px solid ${withAlphaM(theme.dim, 0.4 + 0.6 * sign)}`,
              fontFamily: theme.sans,
              fontSize: 15,
              fontWeight: 700,
              color: theme.dim,
              whiteSpace: 'nowrap',
              opacity: sign,
              transform: `translateY(${(1 - sign) * -8}px)`,
            }}
          >
            门外
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 准备室（走廊中段三间——门牌暗态轮廓→逐室亮，一句一室对位）。室内装置位
 *  由场景经 children 摆入（注入滑槽/压缩管线/底座拼卡各形）。`plaqueP` 门牌
 *  轮廓立起；`litP` 室亮；`tag` 角标（cron · background tasks / compact /
 *  system prompt——只进角标）。 */
export const PrepRoom: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  plaqueP?: number;
  litP?: number;
  tag?: string;
  slotP?: number;
  children?: React.ReactNode;
}> = ({x, y, w = 430, h = 280, plaqueP = 0, litP = 0, tag, slotP = 0, children}) => {
  const plaque = clamp01v(plaqueP);
  const lit = clamp01v(litP);
  const slot = clamp01v(slotP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h}}>
      {/* 室顶设施格滑入环边挂点槽的归位道（合流紫——三站挂点齐的帧上面） */}
      {slot > 0.02 && slot < 0.98 ? (
        <div
          style={{
            position: 'absolute',
            left: w / 2 - 17,
            top: -14,
            width: 34,
            height: 22,
            borderRadius: 7,
            border: `3px solid ${theme.merge}`,
            background: withAlphaM(theme.merge, 0.25),
            transform: `translateY(${-slot * 46}px)`,
            opacity: 1 - Math.max(0, slot - 0.85) * 6,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          border: `${lit > 0.4 ? 4 : 3}px ${lit > 0.4 ? 'solid' : 'dashed'} ${lit > 0.4 ? withAlphaM(theme.merge, 0.85) : withAlphaM(theme.dim, 0.35 + 0.3 * plaque)}`,
          background: withAlphaM(theme.panel, 0.92 + 0.05 * lit),
          opacity: Math.max(0.35, Math.max(plaque, lit)),
        }}
      >
        {/* 门牌（暗态轮廓→亮；只标室号不点名机制） */}
        <div
          style={{
            position: 'absolute',
            left: 18,
            top: 14,
            padding: '3px 14px',
            borderRadius: 8,
            border: `2.5px solid ${lit > 0.4 ? theme.merge : withAlphaM(theme.dim, 0.55)}`,
            fontFamily: theme.mono,
            fontSize: 16,
            fontWeight: 700,
            color: lit > 0.4 ? theme.text : theme.dim,
            whiteSpace: 'nowrap',
          }}
        >
          {`准备室 ${tag ?? ''}`}
        </div>
        {/* 室内装置位 */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 52, bottom: 0}}>{children}</div>
      </div>
    </div>
  );
};

/** 恢复垫徽章组（调用舱外裹一层——限流/超载/超长/再压四档梯子逐档可数）。
 *  `padP` 缓冲垫裹上；`badges` 四徽章各 litP + 动作进度 actP（退一步箭头/
 *  备用卡换入/额度条续接/小压块再压——由场景注入）。角标 error recovery。 */
export const RecoveryPad: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  padP?: number;
  litP?: number;
  badges?: readonly {litP: number; actP: number}[];
  doorP?: number;
  children?: React.ReactNode;
}> = ({x, y, w = 300, h = 190, padP = 0, litP = 1, badges = [], doorP = 0, children}) => {
  const pad = clamp01v(padP);
  const lit = clamp01v(litP);
  const door = clamp01v(doorP);
  const labels = ['限流', '超载', '超长', '再压'];
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit}}>
      {/* 缓冲垫（舱体外一圈——裹上一拍） */}
      <div
        style={{
          position: 'absolute',
          inset: -16 * pad,
          borderRadius: 26,
          border: `${4 + 3 * pad}px solid ${withAlphaM(theme.merge, 0.3 + 0.55 * pad)}`,
          background: withAlphaM(theme.merge, 0.07 * pad),
          opacity: pad,
        }}
      />
      {/* 调用舱体（骑跨中线「调模型」拍位——舱门开启由 doorP） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 18,
          border: `4px solid ${theme.loop}`,
          background: withAlphaM(theme.panel, 0.97),
          overflow: 'hidden',
        }}
      >
        {/* 舱门（自中缝开启——开口第一帧的机械面） */}
        <div style={{position: 'absolute', inset: 0}}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '50%',
              background: withAlphaM(theme.loop, 0.16),
              borderRight: `3px solid ${withAlphaM(theme.loop, 0.7)}`,
              transform: `translateX(${-door * 100}%)`,
              transition: 'none',
            }}
          />
        </div>
        {children}
      </div>
      {/* 四枚小徽章（沿垫下沿排布——图形徽章 + 两字小签，点亮次序=口播次序） */}
      {badges.map((b, i) => {
        const bp = clamp01v(b.litP);
        const act = clamp01v(b.actP);
        const bx = (i - 1.5) * 74;
        return (
          <div
            key={`bg${i}`}
            style={{
              position: 'absolute',
              left: w / 2 + bx - 32,
              top: h + 22,
              width: 64,
              height: 64,
              opacity: Math.max(0.22, bp),
            }}
          >
            <svg width={64} height={64} viewBox="0 0 64 64">
              <circle cx={32} cy={26} r={16} fill={bp > 0.4 ? withAlphaM(theme.merge, 0.25) : 'transparent'} stroke={bp > 0.4 ? theme.merge : withAlphaM(theme.dim, 0.55)} strokeWidth={3} />
              {i === 0 ? <path d="M26 26 L38 26 M36 22 L40 26 L36 30" fill="none" stroke={bp > 0.4 ? theme.text : theme.dim} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={bp} /> : null}
              {i === 1 ? <rect x={24} y={18} width={16} height={16} rx={3} fill="none" stroke={bp > 0.4 ? theme.text : theme.dim} strokeWidth={2.5} opacity={bp} /> : null}
              {i === 2 ? (
                <>
                  <line x1={22} y1={26} x2={42} y2={26} stroke={bp > 0.4 ? theme.text : theme.dim} strokeWidth={2.5} strokeLinecap="round" opacity={bp} />
                  <line x1={42} y1={20} x2={42 + act * 8} y2={32} stroke={theme.text} strokeWidth={2.5} strokeLinecap="round" opacity={act} />
                </>
              ) : null}
              {i === 3 ? <rect x={24} y={20 + act * 6} width={16} height={12} rx={3} fill="none" stroke={bp > 0.4 ? theme.text : theme.dim} strokeWidth={2.5} opacity={bp} /> : null}
            </svg>
            <div style={{textAlign: 'center', fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: bp > 0.4 ? theme.text : theme.dim, whiteSpace: 'nowrap', marginTop: 2}}>
              {labels[i]}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** 岔口判读台（响应包展开位 + 直行/靠边双分支——判据正反同帧）。`frameP`
 *  岔口高亮视框；`deskP` 判读台亮出；`blockP` 调用块形轮廓（0 无 / 1 有高亮
 *  两态共用通道由场景切换）；`goP` 直行绿点亮；`sideP` 靠边蓝点亮；
 *  `bothP` 正反并置对照条。角标 tool_use block 由场景挂。 */
export const ForkDesk: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  frameP?: number;
  deskP?: number;
  blockP?: number;
  blockHotP?: number;
  finishP?: number;
  goP?: number;
  sideP?: number;
  bothP?: number;
}> = ({x, y, w = 600, h = 250, frameP = 0, deskP = 0, blockP = 0, blockHotP = 0, finishP = 0, goP = 0, sideP = 0, bothP = 0}) => {
  const frame = clamp01v(frameP);
  const desk = clamp01v(deskP);
  const block = clamp01v(blockP);
  const hot = clamp01v(blockHotP);
  const finish = clamp01v(finishP);
  const go = clamp01v(goP);
  const side = clamp01v(sideP);
  const both = clamp01v(bothP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h}}>
      {/* 岔口高亮视框（全走廊仅此一叉——一拍即收） */}
      {frame > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            inset: -18,
            borderRadius: 20,
            border: `3.5px solid ${withAlphaM(theme.loop, 0.85 * frame)}`,
            boxShadow: `0 0 ${22 * frame}px ${withAlphaM(theme.loop, 0.4 * frame)}`,
            opacity: frame,
          }}
        />
      ) : null}
      {/* 响应包（展开位——调用块位 + 收尾字段位并排对照） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: `3.5px solid ${withAlphaM(theme.panelBorder, 0.5 + 0.5 * desk)}`,
          background: withAlphaM(theme.panel, 0.96),
          opacity: Math.max(0.3, desk),
        }}
      >
        {/* 调用块位（有/无两态——块形轮廓闪现→高亮） */}
        <div
          style={{
            position: 'absolute',
            left: 24,
            top: 22,
            width: (w - 72) * 0.56,
            height: 64,
            borderRadius: 9,
            border: `3px ${block > 0.35 ? 'solid' : 'dashed'} ${block > 0.35 ? (hot > 0.3 ? theme.ok : theme.text) : withAlphaM(theme.dim, 0.6)}`,
            background: hot > 0.05 ? withAlphaM(theme.ok, 0.16 * hot) : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 17,
            fontWeight: 700,
            color: block > 0.35 ? theme.text : theme.dim,
            whiteSpace: 'nowrap',
            opacity: Math.max(0.4, block),
            boxShadow: hot > 0.3 ? `0 0 ${18 * hot}px ${withAlphaM(theme.ok, 0.5 * hot)}` : 'none',
          }}
        >
          调用块
        </div>
        {/* 收尾字段位（对照位——灰态） */}
        <div
          style={{
            position: 'absolute',
            right: 24,
            top: 22,
            width: (w - 72) * 0.34,
            height: 64,
            borderRadius: 9,
            border: `3px dashed ${withAlphaM(theme.dim, 0.55)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 17,
            fontWeight: 700,
            color: theme.dim,
            whiteSpace: 'nowrap',
            opacity: Math.max(0.35, finish),
          }}
        >
          收尾字段
        </div>
        {/* 双分支（自分叉口分出——直行绿 / 靠边蓝；先后各演一遍并置对照） */}
        <svg width={w} height={h - 100} viewBox={`0 0 ${w} ${h - 100}`} style={{position: 'absolute', left: 0, top: 100}}>
          <path d={`M ${w / 2} 6 L ${w / 2} 30`} fill="none" stroke={withAlphaM(theme.dim, 0.7)} strokeWidth={3.5} strokeLinecap="round" />
          <path d={`M ${w / 2} 30 L ${w * 0.28} ${h - 118}`} fill="none" stroke={withAlphaM(theme.ok, 0.3 + 0.7 * go)} strokeWidth={go > 0.3 ? 5 : 3.5} strokeLinecap="round" strokeDasharray={go > 0.3 ? undefined : '8 7'} />
          <path d={`M ${w / 2} 30 L ${w * 0.72} ${h - 118}`} fill="none" stroke={withAlphaM(theme.loop, 0.3 + 0.7 * side)} strokeWidth={side > 0.3 ? 5 : 3.5} strokeLinecap="round" strokeDasharray={side > 0.3 ? undefined : '8 7'} />
          <circle cx={w * 0.28} cy={h - 112} r={8} fill={theme.ok} opacity={go} />
          <circle cx={w * 0.72} cy={h - 112} r={8} fill={theme.loop} opacity={side} />
        </svg>
      </div>
      {/* 正反并置对照条（「有→直行 / 无→靠边」同帧可辨） */}
      {both > 0.02 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: h + 14, display: 'flex', gap: 12, opacity: both}}>
          {[
            {t: '有调用块 → 直行执行', tone: theme.ok},
            {t: '无调用块 → 就地收尾', tone: theme.loop},
          ].map((b) => (
            <div
              key={b.t}
              style={{
                flex: 1,
                padding: '6px 14px',
                borderRadius: 9,
                border: `2.5px solid ${withAlphaM(b.tone, 0.75)}`,
                background: withAlphaM(theme.panel, 0.95),
                fontFamily: theme.sans,
                fontSize: 18,
                fontWeight: 700,
                color: theme.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {b.t}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/** 执行段三车道（拦红/直绿/后台蓝 lane 语义恒定——2-B 与 3-C 同形复现，
 *  镜间身份恒常）。车道背板 + 权限闸门体；卡件/回执/钩由场景沿 CHEQUES
 *  常量摆位。`gateP` 闸门落下。 */
export const LANE_Y = {gate: 236, exec: 452, bg: 640} as const;

export const LaneTrack: React.FC<{
  x?: number;
  y?: number;
  w?: number;
  litP?: number;
  gateP?: number;
  gateHotP?: number;
}> = ({x = 120, y = 150, w = 1680, litP = 1, gateP = 0, gateHotP = 0}) => {
  const lit = clamp01v(litP);
  const gate = clamp01v(gateP);
  const hot = clamp01v(gateHotP);
  const lane = (ly: number, h: number, tone: string, dashed: boolean) => (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: ly,
        width: w,
        height: h,
        borderRadius: 14,
        border: `3px ${dashed ? 'dashed' : 'solid'} ${withAlphaM(tone, 0.4)}`,
        background: withAlphaM(tone, 0.05),
      }}
    />
  );
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: 560, opacity: lit}}>
      {lane(LANE_Y.gate - y, 150, theme.danger, false)}
      {lane(LANE_Y.exec - y, 130, theme.ok, false)}
      {lane(LANE_Y.bg - y, 110, theme.loop, true)}
      {/* 权限闸门体（①权限闸道居中——闸门落下） */}
      <div style={{position: 'absolute', left: 300, top: LANE_Y.gate - y - 10, width: 150, height: 170}}>
        <svg width={150} height={170} viewBox="0 0 150 170">
          <line x1={22} y1={10} x2={22} y2={160} stroke={theme.panelBorder} strokeWidth={6} strokeLinecap="round" />
          <line x1={128} y1={10} x2={128} y2={160} stroke={theme.panelBorder} strokeWidth={6} strokeLinecap="round" />
          {/* 闸门横杆（落下=自上而下；弹开帧由场景在卡侧表现） */}
          <rect
            x={16}
            y={20 + (1 - gate) * 100}
            width={118}
            height={16}
            rx={8}
            fill={hot > 0.3 ? withAlphaM(theme.danger, 0.85) : withAlphaM(theme.panelBorder, 0.98)}
            stroke={hot > 0.3 ? theme.danger : theme.dim}
            strokeWidth={2}
          />
        </svg>
        <div style={{position: 'absolute', left: 0, right: 0, top: 148, textAlign: 'center', fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>
          权限闸
        </div>
      </div>
    </div>
  );
};

/** 27 格名册（3×9 网格合流紫描边 + 阵列右侧动态外接槽位带 + 洗牌重组态）。
 *  `cellLits` 27 格点亮进度（离散 stagger 由场景注入）；`extP` 外接槽亮出
 *  （虚位以待——未连不实化）；`shuffleP` 整面洗牌重组（同卡新序——确定性
 *  置换表）；`miniP` 镜尾微缩归位滑向挂点槽。 */
export const RosterGrid: React.FC<{
  x: number;
  y: number;
  cellLits: readonly number[];
  extP?: number;
  shuffleP?: number;
  miniP?: number;
  litP?: number;
}> = ({x, y, cellLits, extP = 0, shuffleP = 0, miniP = 0, litP = 1}) => {
  const lit = clamp01v(litP);
  const ext = clamp01v(extP);
  const shuffle = clamp01v(shuffleP);
  const mini = clamp01v(miniP);
  const cols = 9;
  const rows = 3;
  const cw = 62;
  const ch = 66;
  const gap = 10;
  const gridW = cols * cw + (cols - 1) * gap;
  const gridH = rows * ch + (rows - 1) * gap;
  // 确定性洗牌置换（帧驱动无随机——同卡新序的重组演示；outbound→inbound
  // 折返即「洗牌定格复位」，不另绘第二置换层）
  const perm = (i: number) => (i * 7 + 11) % 27;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity: lit,
        transform: `translate(${mini * 420}px, ${mini * -60}px) scale(${1 - mini * 0.62})`,
        transformOrigin: '100% 50%',
      }}
    >
      <div style={{position: 'absolute', left: 0, top: 0, width: gridW, height: gridH, display: 'flex', flexWrap: 'wrap', gap}}>
        {Array.from({length: cols * rows}, (_, i) => {
          const cp = clamp01v(cellLits[i] ?? 0);
          // 洗牌：格卡沿置换表自 i 位滑向 perm(i) 位再复位（同卡新序）
          const target = perm(i);
          const outbound = Math.min(1, shuffle * 2);
          const inbound = Math.max(0, shuffle * 2 - 1);
          const tx = (target % cols - (i % cols)) * (cw + gap) * outbound * (1 - inbound);
          const ty = (Math.floor(target / cols) - Math.floor(i / cols)) * (ch + gap) * outbound * (1 - inbound);
          return (
            <div
              key={`rc${i}`}
              style={{
                width: cw,
                height: ch,
                borderRadius: 8,
                border: `2.5px solid ${withAlphaM(theme.merge, 0.3 + 0.65 * cp)}`,
                background: cp > 0.4 ? withAlphaM(theme.merge, 0.16) : withAlphaM(theme.panel, 0.9),
                opacity: Math.max(0.3, cp),
                transform: `translate(${tx}px, ${ty}px)`,
              }}
            />
          );
        })}
      </div>
      {/* 动态外接槽位带（虚位槽——随连随挂的泛指语义，未连不实化） */}
      {ext > 0.02 ? (
        <div style={{position: 'absolute', left: gridW + 26, top: 0, width: 190, height: gridH, display: 'flex', flexDirection: 'column', gap: 10, opacity: ext}}>
          {[0, 1, 2].map((k) => (
            <div
              key={`ex${k}`}
              style={{
                flex: 1,
                borderRadius: 9,
                border: `2.5px dashed ${withAlphaM(theme.merge, 0.55)}`,
                background: withAlphaM(theme.merge, 0.05),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.sans,
                fontSize: 15,
                fontWeight: 700,
                color: theme.dim,
                whiteSpace: 'nowrap',
              }}
            >
              外接 · 虚位
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/** 演进链计数标尺带（8→14→18→27 四刻度——机制每添一层家什跟着添）。
 *  `step` 离散发值 0..3（场景 Math.round 先行）；`stepP` 当档跳格进度；
 *  刻度与口播数字一致、计数不越 27。 */
export const EVO_TICKS = [8, 14, 18, 27] as const;

export const EvoRuler: React.FC<{x: number; y: number; w?: number; step: number; stepP?: number; litP?: number}> = ({
  x,
  y,
  w = 640,
  step,
  stepP = 0,
  litP = 1,
}) => {
  const lit = clamp01v(litP);
  const sp = clamp01v(stepP);
  const shown = step >= 3 ? 27 : EVO_TICKS[Math.max(0, step)] + Math.round((EVO_TICKS[Math.min(step + 1, 3)] - EVO_TICKS[Math.max(0, step)]) * sp);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: lit}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
        <span style={{fontFamily: theme.mono, fontSize: 40, fontWeight: 700, color: theme.merge, fontVariantNumeric: 'tabular-nums'}}>{`${shown} 件`}</span>
        <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, whiteSpace: 'nowrap'}}>{'演进链 · 8 → 14 → 18 → 27'}</span>
      </div>
      {/* 四刻度标尺（当前档高亮——跳格定格） */}
      <div style={{position: 'relative', width: w, height: 46, marginTop: 10}}>
        <svg width={w} height={46} viewBox={`0 0 ${w} 46`}>
          <line x1={8} y1={14} x2={w - 8} y2={14} stroke={withAlphaM(theme.dim, 0.7)} strokeWidth={2.5} />
          {EVO_TICKS.map((t, i) => {
            const tx = 8 + (i / 3) * (w - 16);
            const on = i <= step;
            return (
              <g key={`ev${i}`}>
                <circle cx={tx} cy={14} r={on ? 9 : 6} fill={on ? theme.merge : theme.bg} stroke={on ? theme.merge : theme.dim} strokeWidth={2.5} />
                <text x={tx} y={40} textAnchor="middle" fontFamily={theme.mono} fontSize={16} fontWeight={on ? 700 : 400} fill={on ? theme.text : theme.dim} style={{fontVariantNumeric: 'tabular-nums'}}>
                  {t}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

/** 左右对照卡族（4-A 清单/任务图、5-B 大脑/剖面——同构等大中性描边，
 *  G1 核注：对照装置走中性 panelBorder，避开红绿蓝紫四语义色）。 */
export const PairCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  label?: string;
  tag?: string;
  children?: React.ReactNode;
}> = ({x, y, w = 640, h = 420, litP = 0, label, tag, children}) => {
  const lit = clamp01v(litP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: Math.max(0.12, lit)}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 18,
          border: `${lit > 0.4 ? 4 : 3}px solid ${lit > 0.4 ? withAlphaM(theme.dim, 0.95) : withAlphaM(theme.dim, 0.4)}`,
          background: withAlphaM(theme.panel, 0.95),
          transform: `translateY(${(1 - lit) * 22}px)`,
        }}
      >
        {label ? (
          <div style={{position: 'absolute', left: 24, top: 16, display: 'flex', alignItems: 'baseline', gap: 12}}>
            <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: lit > 0.4 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{label}</span>
            {tag ? <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>{tag}</span> : null}
          </div>
        ) : null}
        <div style={{position: 'absolute', left: 0, right: 0, top: 60, bottom: 0}}>{children}</div>
      </div>
    </div>
  );
};

/** 委派门框（4-B 两扇门之一——中性门体；门楣签由场景落字）。`dropP` 门落下；
 *  `openP` 门内演示区显形。 */
export const DoorFrame: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  dropP?: number;
  litP?: number;
  lintel?: string;
  children?: React.ReactNode;
}> = ({x, y, w = 400, h = 480, dropP = 0, litP = 1, lintel, children}) => {
  const drop = clamp01v(dropP);
  const lit = clamp01v(litP);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + (1 - drop) * -60,
        width: w,
        height: h,
        opacity: lit * drop,
      }}
    >
      {/* 门楣（关键词门楣签——≤4 字） */}
      {lintel ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: -52,
            height: 46,
            borderRadius: 10,
            border: `3px solid ${withAlphaM(theme.dim, 0.85)}`,
            background: withAlphaM(theme.panel, 0.97),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.serif,
            fontSize: 24,
            fontWeight: 700,
            color: theme.text,
            letterSpacing: 4,
            whiteSpace: 'nowrap',
          }}
        >
          {lintel}
        </div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '16px 16px 8px 8px',
          border: `5px solid ${withAlphaM(theme.panelBorder, 0.98)}`,
          background: withAlphaM(theme.panel, 0.95),
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** 自检跑条（18 格断言带 + 日志行数滚动位——数字镜：18 格逐格可数）。
 *  `cellLits` 18 格离散点亮；`logN` 日志行数离散发值；`capP` 口径字幕
 *  （本地原型）；`retireP` 整条退役淡出〔M-006〕。 */
export const SelfTestBar: React.FC<{
  x: number;
  y: number;
  w?: number;
  cellLits: readonly number[];
  logN: number;
  capP?: number;
  retireP?: number;
  litP?: number;
}> = ({x, y, w = 900, cellLits, logN, capP = 0, retireP = 0, litP = 1}) => {
  const lit = clamp01v(litP);
  const cap = clamp01v(capP);
  const retire = clamp01v(retireP);
  const cw = (w - 17 * 8) / 18;
  const allGreen = cellLits.every((c) => c > 0.9);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + retire * -26,
        width: w,
        opacity: lit * (1 - retire),
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
        <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>全量自检</span>
        <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.35 + 0.65 * cap}}>本地原型</span>
      </div>
      <div style={{display: 'flex', gap: 8}}>
        {Array.from({length: 18}, (_, i) => {
          const cp = clamp01v(cellLits[i] ?? 0);
          return (
            <div
              key={`tb${i}`}
              style={{
                width: cw,
                height: 52,
                borderRadius: 7,
                border: `2.5px solid ${cp > 0.4 ? theme.ok : withAlphaM(theme.dim, 0.45)}`,
                background: cp > 0.4 ? withAlphaM(theme.ok, 0.32) : withAlphaM(theme.panel, 0.9),
                opacity: Math.max(0.3, cp),
              }}
            />
          );
        })}
      </div>
      {/* 日志行数滚动位（离散发值——定格即实测口径） */}
      <div style={{marginTop: 12, fontFamily: theme.mono, fontSize: 17, color: theme.dim, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>
        {`断言 18 · ${allGreen ? '全绿' : '运行中'} · 日志 ${logN} 行`}
      </div>
    </div>
  );
};

/** 四句收束块（while True 卡——五行代码块剪影为底 + while True 小角标；
 *  恒定蓝。角标层不口播、代码不上大字——契约允许的英文小角标）。 */
export const WhileTrueCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  lineLits?: readonly number[];
}> = ({x, y, w = 380, h = 210, litP = 0, lineLits = [0, 0, 0, 0, 0]}) => {
  const lit = clamp01v(litP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: Math.max(0.14, lit)}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          border: `3.5px solid ${withAlphaM(theme.loop, 0.35 + 0.6 * lit)}`,
          background: withAlphaM(theme.panel, 0.96),
          padding: '18px 22px',
        }}
      >
        {/* 五行代码块剪影（行条形——不显代码文字，剪影为底） */}
        {[0.92, 0.66, 0.8, 0.66, 0.5].map((fw, i) => {
          const lp = clamp01v(lineLits[i] ?? 0);
          return (
            <div
              key={`cl${i}`}
              style={{
                width: `${fw * 100}%`,
                height: 16,
                borderRadius: 4,
                background: lp > 0.35 ? withAlphaM(theme.loop, 0.55) : withAlphaM(theme.panelBorder, 0.9),
                marginBottom: 13,
                opacity: Math.max(0.5, lp),
              }}
            />
          );
        })}
      </div>
      {/* while True 小角标（mono 小字——四拍节奏的代码注脚，契约允许例外） */}
      <div
        style={{
          position: 'absolute',
          right: 12,
          bottom: -30,
          fontFamily: theme.mono,
          fontSize: 17,
          fontWeight: 700,
          color: theme.loop,
          whiteSpace: 'nowrap',
          opacity: lit,
        }}
      >
        while True
      </div>
    </div>
  );
};

/** 环体剖面（5-A 终态 / 5-B 对照帧同形——镜间身份恒常）：合流紫设施层
 *  整圈环绕陶土橙细线循环（复杂在外围的终态构图）+ 内芯四拍微光确认位。
 *  `facilityP` 设施层增亮；`beatPs` 四拍逐一确认；`hotP` 增亮一拍。 */
export const CrossSection: React.FC<{
  cx: number;
  cy: number;
  size?: number;
  litP?: number;
  facilityP?: number;
  beatPs?: readonly number[];
  hotP?: number;
}> = ({cx, cy, size = 220, litP = 1, facilityP = 0, beatPs = [0, 0, 0, 0], hotP = 0}) => {
  const lit = clamp01v(litP);
  const fac = clamp01v(facilityP);
  const hot = clamp01v(hotP);
  const r = size / 2 - 26;
  return (
    <svg width={size + 80} height={size + 80} viewBox={`0 0 ${size + 80} ${size + 80}`} style={{position: 'absolute', left: cx - (size + 80) / 2, top: cy - (size + 80) / 2, overflow: 'visible', opacity: lit}}>
      {/* 设施层（合流紫整圈 annulus——环绕细线循环） */}
      <circle cx={(size + 80) / 2} cy={(size + 80) / 2} r={r + 26} fill="none" stroke={theme.merge} strokeWidth={24} opacity={0.2 + 0.28 * fac + 0.25 * hot} />
      <circle cx={(size + 80) / 2} cy={(size + 80) / 2} r={r + 26} fill="none" stroke={theme.merge} strokeWidth={5} opacity={0.3 + 0.5 * fac + 0.2 * hot} />
      {/* 细线循环（陶土橙——剖面里唯一中线，禁第二中线） */}
      <circle cx={(size + 80) / 2} cy={(size + 80) / 2} r={r} fill="none" stroke={theme.core} strokeWidth={5} />
      {/* 四拍微光确认位（沿内圈四点——芯子=四句的剖面陈述） */}
      {[-90, 0, 90, 180].map((a, k) => {
        const rad = (a * Math.PI) / 180;
        const bx = (size + 80) / 2 + r * 0.62 * Math.cos(rad);
        const by = (size + 80) / 2 + r * 0.62 * Math.sin(rad);
        const bp = clamp01v(beatPs[k] ?? 0);
        return <circle key={`cs${k}`} cx={bx} cy={by} r={8} fill={theme.core} opacity={0.25 + 0.75 * bp} />;
      })}
    </svg>
  );
};

/** 五段组弧（5-D 回环——承片头五进度点形态，五大组进度全亮；零文字零
 *  集数序号：反串线终章从严）。`arcLits` 五段进度；`litP` 整组显形。 */
export const GroupArcs: React.FC<{
  cx: number;
  cy: number;
  r: number;
  arcLits: readonly number[];
  litP?: number;
}> = ({cx, cy, r, arcLits, litP = 1}) => {
  const lit = clamp01v(litP);
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', opacity: lit}}>
      {[0, 1, 2, 3, 4].map((k) => {
        const a0 = -90 + k * 72 + 4;
        const a1 = -90 + (k + 1) * 72 - 4;
        const ap = clamp01v(arcLits[k] ?? 0);
        if (ap < 0.02) return null;
        return (
          <g key={`ga${k}`}>
            <path d={describeArc(cx, cy, r, a0, a1)} fill="none" stroke={theme.core} strokeWidth={12} strokeLinecap="round" opacity={0.25 + 0.6 * ap} />
            <path d={describeArc(cx, cy, r, a0, a1)} fill="none" stroke={theme.core} strokeWidth={26} strokeLinecap="round" opacity={0.14 * ap} />
          </g>
        );
      })}
    </svg>
  );
};
