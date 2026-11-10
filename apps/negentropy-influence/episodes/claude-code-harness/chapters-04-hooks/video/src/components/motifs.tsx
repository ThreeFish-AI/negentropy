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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2/ep3 延续——
// LoopRing 描边色/线宽跨集恒定（theme.core = 陶土橙 #D97757 + RING_STROKE 6）
// = 逐字节拷贝的前提；Terminal/DispatchTable 本集无对应场景、不拷）

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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep3 逐字节
 * 拷贝（ep4 场景一律 `nodes={[]}`：环体即循环本体，事件挂点由 HookPoint 另钉）。
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

/** 环上坐标（-90 = 12 点；r 与 LoopRing 内圈同式 = size/2 - 46）——四挂点
 *  钉位/弧段连线的场景侧共用工式 */
export const ringPt = polar;

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep4 Hooks）
// storyboard 实现映射登记：GateCard / GateTrio / CheckChip / HookPoint /
// HookGlyph / CallbackCard / RegistryRow / HookRegistry / MigrationTrack /
// LogTrace / AblationTrack / GrowthBar / VoteBoard / FlagBadge / InsuranceBadge。
// 全片主装置 = HOOKS 注册表 + 四挂点（对照 ep2 对照表 / ep3 闸门链之地位）：
// 双列结构、挂点紫描边、行内容缩微前后不重绘（scale 整体变换，非重画）。
// 哑装置原则承 ep3：动效参数（进度/状态）一律经 prop 由调用场景注入，本段
// 零 motion hooks——「怎么动」归场景，「画什么」归此处。
//
// 跨集签名色只读登记（G1 对抗核验 2026-11-01；色值跨集回溯、语义不歧义，
// 模块常量防漂移、不进 theme.ts——同 3D 面色常量先例，不占本集 accents 槽）：
// - 裁决紫 #7C6FF0 = ep3 闸卡签名：1-C 降格迁移动画的同形签名本体（跨集视觉
//   记忆——迁移中不换色即「同一道闸门」）、0-A 剪影一闪、5-A 闸卡小影同签回归；
// - 边界蓝 #4E9EFF = ep2 工作区范围框签名：3-B 在画（越界冲出的框界）。
const GATE_SIGIL = '#7C6FF0';
const BOUNDARY_BLUE = '#4E9EFF';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 闸卡（ep3 同形签名——拱形门几何逐字节承 ep3，描边恒裁决紫 #7C6FF0 跨集
 *  签名；kind 只换门芯符号：deny 实心断路 / rule 两枚关键词格 / ask 问号门）。
 *  `lit` 0..1 描线+显形；`ghost` 0..1 灰化剪影（描边转 panelBorder、结构轮廓
 *  保留 = 身份线索不断）；`hitFlash` 0..1 一拍加重。 */
export const GateCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  kind?: 'deny' | 'rule' | 'ask';
  lit?: number;
  ghost?: number;
  hitFlash?: number;
  showName?: boolean;
}> = ({x, y, w = 170, h = 160, kind = 'deny', lit = 1, ghost = 0, hitFlash = 0, showName = false}) => {
  const litP = clamp01(lit);
  const arcTop = 26;
  const doorPath = `M 8 ${h - 8} L 8 ${arcTop + 16} Q 8 8 ${w / 2} ${arcTop - 16} Q ${w - 8} 8 ${w - 8} ${arcTop + 16} L ${w - 8} ${h - 8}`;
  const stroke = ghost > 0.5 ? theme.panelBorder : GATE_SIGIL;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: 1 - 0.55 * ghost}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <path
          d={doorPath}
          fill={ghost > 0.5 ? 'transparent' : withAlpha(GATE_SIGIL, 0.16 * litP)}
          stroke={stroke}
          strokeWidth={3.5}
          opacity={0.3 + 0.7 * litP}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - litP}
        />
        {hitFlash > 0.01 ? <path d={doorPath} fill="none" stroke={theme.danger} strokeWidth={5} opacity={hitFlash} /> : null}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: h / 2 - 26,
          textAlign: 'center',
          opacity: litP * (1 - 0.5 * ghost),
        }}
      >
        {kind === 'ask' ? (
          <span style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: ghost > 0.5 ? theme.dim : GATE_SIGIL}}>
            ?
          </span>
        ) : kind === 'deny' ? (
          <svg width={44} height={30} viewBox="0 0 44 30" style={{overflow: 'visible'}}>
            <rect x={14} y={7} width={16} height={16} rx={3} fill={ghost > 0.5 ? theme.dim : GATE_SIGIL} />
            <line x1={4} y1={15} x2={10} y2={15} stroke={ghost > 0.5 ? theme.dim : GATE_SIGIL} strokeWidth={3.5} strokeLinecap="round" />
            <line x1={34} y1={15} x2={40} y2={15} stroke={ghost > 0.5 ? theme.dim : GATE_SIGIL} strokeWidth={3.5} strokeLinecap="round" />
          </svg>
        ) : (
          <svg width={52} height={30} viewBox="0 0 52 30" style={{overflow: 'visible'}}>
            <rect x={6} y={8} width={18} height={13} rx={3} fill="none" stroke={ghost > 0.5 ? theme.dim : GATE_SIGIL} strokeWidth={2.5} />
            <rect x={28} y={8} width={18} height={13} rx={3} fill="none" stroke={ghost > 0.5 ? theme.dim : GATE_SIGIL} strokeWidth={2.5} />
          </svg>
        )}
        {showName ? (
          <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: ghost > 0.5 ? theme.dim : theme.text, marginTop: 4}}>
            {kind === 'deny' ? '硬拒绝' : kind === 'rule' ? '规则' : '问人'}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 三闸卡串联（ep3 闸门链同构——1-C 环内拆出与迁移的主体、0-A 剪影、5-A 小影）。
 *  `spread` 0..1 列队展开度（0 = 三卡聚拢读作一枚）；`connect` 串联线；缩微走
 *  外层 scale（不重绘）。 */
export const GateTrio: React.FC<{
  x: number;
  y: number;
  cardW?: number;
  cardH?: number;
  spacing?: number;
  spread?: number;
  connect?: number;
  lit?: number;
  ghost?: number;
  hit?: number;
  scale?: number;
  dim?: number;
}> = ({x, y, cardW = 150, cardH = 140, spacing = 186, spread = 1, connect = 1, lit = 1, ghost = 0, hit = 0, scale = 1, dim = 0}) => {
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
        opacity: 1 - dim,
        transform: `scale(${scale})`,
        transformOrigin: 'left top',
      }}
    >
      {connect > 0.01 && spread > 0.6
        ? [0, 1].map((i) => (
            <svg key={i} width={spacing - cardW} height={8} style={{position: 'absolute', left: cardW + i * spacing, top: cardH / 2 - 4, overflow: 'visible'}}>
              <line x1={2} y1={4} x2={spacing - cardW - 2} y2={4} stroke={GATE_SIGIL} strokeWidth={3} opacity={0.55 * connect} strokeDasharray="7 6" />
            </svg>
          ))
        : null}
      {kinds.map((k, i) => {
        const off = (i - 1) * spacing * clamp01(spread);
        const sideFade = i === 0 ? 1 : clamp01((spread - (i === 1 ? 0.25 : 0.55)) / 0.3);
        return (
          <div key={k} style={{position: 'absolute', left: off, top: 0, opacity: sideFade}}>
            <GateCard x={0} y={0} w={cardW} h={cardH} kind={k} lit={lit} ghost={ghost} hitFlash={hit} />
          </div>
        );
      })}
    </div>
  );
};

/** 杂色检查块字样（灰签同款形态）——0-A 候场块 / 0-B 入环块标 / 1-D 净化残留
 *  共用（G1 note5：1-A 清块未清名，0-B 字样残留至 1-D 才逐一淡出）。
 *  `label` = mono 字样（log/check/notify/commit）；`lit` 显形；`ghost` 灰化。 */
export const CheckChip: React.FC<{x: number; y: number; w?: number; label: string; lit?: number; ghost?: number}> = ({
  x,
  y,
  w = 120,
  label,
  lit = 1,
  ghost = 0,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: 44,
      boxSizing: 'border-box',
      borderRadius: 8,
      border: `2px solid ${ghost > 0.5 ? theme.panelBorder : withAlpha(theme.dim, 0.75)}`,
      background: ghost > 0.5 ? 'transparent' : withAlpha(theme.panel, 0.9),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: clamp01(lit) * (1 - 0.4 * ghost),
    }}
  >
    <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, whiteSpace: 'nowrap'}}>{label}</span>
  </div>
);

/** 事件挂点（挂点紫点——钉在环体〔M-001〕上的固定事件位）。`lit` 0..1 钉位
 *  点亮；`pulse` 0..1 事件触发脉冲（半径波一拍）；`dim` 压暗（缩微驻位 ≥0.35）。 */
export const HookPoint: React.FC<{cx: number; cy: number; r?: number; lit?: number; pulse?: number; dim?: number}> = ({
  cx,
  cy,
  r = 13,
  lit = 1,
  pulse = 0,
  dim = 0,
}) => (
  <svg width={80} height={80} viewBox="-40 -40 80 80" style={{position: 'absolute', left: cx - 40, top: cy - 40, overflow: 'visible', opacity: 1 - dim, pointerEvents: 'none'}}>
    {/* 钉位外圈（点亮描边收拢） */}
    <circle r={r + 5} fill="none" stroke={theme.mech} strokeWidth={3} opacity={0.35 + 0.65 * clamp01(lit)} />
    {/* 本体紫点 */}
    <circle r={r * (0.6 + 0.4 * clamp01(lit))} fill={theme.mech} opacity={0.35 + 0.65 * clamp01(lit)} />
    {/* 触发脉冲（半径波一拍） */}
    {pulse > 0.01 ? <circle r={r + 6 + 26 * pulse} fill="none" stroke={theme.mech} strokeWidth={3} opacity={0.6 * pulse} /> : null}
  </svg>
);

/** Stop 紫钩（挂点紫 J 形钩——1-D 自第四挂点伸出勾住「做完了」、2-A 驻门楣
 *  同形回归）。`extend` 0..1 甩下行程（绕挂点旋转 + 钩身描线）；`s` 缩放。 */
export const HookGlyph: React.FC<{cx: number; cy: number; s?: number; extend?: number; dim?: number}> = ({cx, cy, s = 1, extend = 1, dim = 0}) => {
  const e = clamp01(extend);
  const rot = -38 * (1 - e);
  return (
    <svg
      width={90 * s}
      height={110 * s}
      viewBox="-45 -55 90 110"
      style={{position: 'absolute', left: cx - 45 * s, top: cy - 55 * s, overflow: 'visible', opacity: 1 - dim, pointerEvents: 'none'}}
    >
      <g transform={`rotate(${rot})`}>
        {/* 钩身：竖柄 + 下钩弯（挂点紫，round caps） */}
        <path
          d="M 0 -34 L 0 18 Q 0 38 -18 38 Q -34 38 -34 20"
          fill="none"
          stroke={theme.mech}
          strokeWidth={7}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - e}
        />
      </g>
    </svg>
  );
};

/** 回调卡（回调蓝——挂上挂点串的普通程序）。`flip` 0..1 翻面（正面 label /
 *  背面「配置」签——3-B 特权→配置的字面翻转）；`removed` 0..1 摘走淡出；
 *  `flash` 0..1 同挂点齐动脉冲；`lit` 显形。 */
export const CallbackCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
  sub?: string;
  lit?: number;
  flip?: number;
  removed?: number;
  flash?: number;
  dim?: number;
  accent?: string;
}> = ({x, y, w = 168, h = 56, label, sub, lit = 1, flip = 0, removed = 0, flash = 0, dim = 0, accent}) => {
  const color = accent ?? theme.hook;
  const f = clamp01(flip);
  const showBack = f > 0.5;
  const sx = Math.abs(1 - 2 * f);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: clamp01(lit) * (1 - 0.75 * clamp01(removed)) * (1 - dim)}}>
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: 10,
          border: `2.5px solid ${color}`,
          background: withAlpha(color, 0.12 + 0.1 * flash),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          transform: `scaleX(${Math.max(0.04, sx)})`,
          boxShadow: flash > 0.01 ? `0 0 ${22 * flash}px ${withAlpha(color, 0.7)}` : 'none',
        }}
      >
        {showBack ? (
          <>
            <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text}}>{'配置'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'configuration'}</span>
          </>
        ) : (
          <>
            <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>{label}</span>
            {sub ? <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>{sub}</span> : null}
          </>
        )}
      </div>
    </div>
  );
};

/** 注册表四事件行常量（1-A 左列显名 = 白话短签 + 英文角标；1-B 环上短签同源） */
export const HOOK_EVENTS = [
  {zh: '输入前', sub: '注入上下文', en: 'UserPromptSubmit'},
  {zh: '动手前', sub: '可拦截', en: 'PreToolUse'},
  {zh: '动手后', sub: '查副作用', en: 'PostToolUse'},
  {zh: '退出前', sub: '收尾', en: 'Stop'},
] as const;

/** 单行状态（HookRegistry 消费——行点亮/高亮、回调珠串、缺口虚位、划掉） */
export type RegRowState = {
  lit: number;
  active?: number;
  beads?: readonly string[];
  ghosts?: readonly string[];
  struck?: number;
  beadPulse?: number;
};

/** 注册表行（事件名行 + 右列回调珠串——行内容缩微前后不重绘）。`struck` 0..1
 *  划掉（3-A 左轨忽略续跑）；`ghosts` 摘除缺口虚位留痕（3-B 串 -1）。 */
export const RegistryRow: React.FC<{
  w?: number;
  ev: {zh: string; en: string};
  state?: RegRowState;
  dim?: number;
}> = ({w = 430, ev, state = {lit: 0}, dim = 0}) => {
  const lit = clamp01(state.lit);
  const active = clamp01(state.active ?? 0);
  const struck = clamp01(state.struck ?? 0);
  const beads = state.beads ?? [];
  const ghosts = state.ghosts ?? [];
  const pulse = clamp01(state.beadPulse ?? 0);
  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: 72,
        boxSizing: 'border-box',
        borderRadius: 10,
        border: `2.5px solid ${active > 0.4 ? theme.mech : withAlpha(theme.mech, 0.25 + 0.5 * lit)}`,
        background: lit > 0.4 ? withAlpha(theme.mech, 0.08 + 0.08 * active) : 'transparent',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        opacity: (0.4 + 0.6 * lit) * (1 - dim),
      }}
    >
      {/* 事件名（白话短签）+ 英文角标 */}
      <div style={{display: 'flex', flexDirection: 'column', gap: 2, minWidth: 118}}>
        <span style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 700, color: lit > 0.4 ? theme.text : theme.dim}}>{ev.zh}</span>
        <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{ev.en}</span>
      </div>
      {/* 列间连线位（字典对照结构——1-A 连线由场景在两列间描） */}
      <div style={{width: 2, height: 26, marginLeft: 10, marginRight: 12, background: withAlpha(theme.mech, 0.5 * lit)}} />
      {/* 回调珠串（回调蓝小卡；颗数 = 挂上的回调） */}
      <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
        {beads.map((b) => (
          <div
            key={b}
            style={{
              width: 92,
              height: 44,
              boxSizing: 'border-box',
              borderRadius: 8,
              border: `2px solid ${theme.hook}`,
              background: withAlpha(theme.hook, 0.14 + 0.18 * pulse),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: pulse > 0.01 ? `0 0 ${16 * pulse}px ${withAlpha(theme.hook, 0.65)}` : 'none',
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>{b}</span>
          </div>
        ))}
        {/* 摘除缺口虚位（串 -1 留痕——位还在、回调没了） */}
        {ghosts.map((g) => (
          <div
            key={`ghost-${g}`}
            style={{
              width: 92,
              height: 44,
              boxSizing: 'border-box',
              borderRadius: 8,
              border: `2px dashed ${theme.panelBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'-1'}</span>
          </div>
        ))}
      </div>
      {/* 划掉（忽略续跑——警示红横线划过行） */}
      {struck > 0.01 ? (
        <span
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            top: '50%',
            height: 4,
            background: theme.danger,
            borderRadius: 2,
            transform: `scaleX(${struck})`,
            transformOrigin: 'left center',
          }}
        />
      ) : null}
    </div>
  );
};

/** HOOKS 注册表（全片主装置——双列表：左列四事件名行、右列回调珠串；挂点紫
 *  描边；计数角标「4 事件 · 5 回调」）。缩微联动位走 scale（不重绘）。 */
export const HookRegistry: React.FC<{
  x: number;
  y: number;
  w?: number;
  lit?: number;
  rows: readonly RegRowState[];
  counterLit?: number;
  dim?: number;
  scale?: number;
}> = ({x, y, w = 470, lit = 1, rows, counterLit = 0, dim = 0, scale = 1}) => {
  const H = 64 + 4 * 72 + 3 * 10 + 16;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: H,
        opacity: clamp01(lit) * (1 - dim),
        transform: `scale(${scale})`,
        transformOrigin: 'left top',
      }}
    >
      <Panel accent={theme.mech} style={{width: '100%', height: '100%', boxSizing: 'border-box', padding: 14, position: 'relative'}}>
        {/* 表头：HOOKS + 计数角标（基线标尺：教学版可数事实） */}
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 36, marginBottom: 12}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
            <span style={{fontFamily: theme.mono, fontSize: 22, fontWeight: 700, color: theme.mech, letterSpacing: 1}}>{'HOOKS'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'注册表'}</span>
          </div>
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 16,
              color: theme.text,
              fontVariantNumeric: 'tabular-nums',
              border: `2px solid ${withAlpha(theme.mech, 0.5)}`,
              borderRadius: 7,
              padding: '2px 10px',
              opacity: counterLit,
              whiteSpace: 'nowrap',
            }}
          >
            {'4 事件 · 5 回调'}
          </span>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
          {HOOK_EVENTS.map((ev, i) => (
            <RegistryRow key={ev.en} w={w - 28} ev={ev} state={rows[i]} />
          ))}
        </div>
      </Panel>
    </div>
  );
};

/** 降格迁移轨（环内 → 挂点下方的弧轨，`p` 0..1 描线 + 末端箭头） */
export const MigrationTrack: React.FC<{
  x1: number;
  y1: number;
  qx: number;
  qy: number;
  x2: number;
  y2: number;
  p?: number;
  color?: string;
}> = ({x1, y1, qx, qy, x2, y2, p = 0, color}) => {
  const c = color ?? theme.mech;
  const pp = clamp01(p);
  const d = `M ${x1} ${y1} Q ${qx} ${qy}, ${x2} ${y2}`;
  // 末端方向（箭头朝向）：终点处切线 = 2(P2-P1)
  const tx = x2 - qx;
  const ty = y2 - qy;
  const len = Math.hypot(tx, ty) || 1;
  const ax = x2 + (14 * tx) / len;
  const ay = y2 + (14 * ty) / len;
  const bx1 = x2 + (9 * -ty) / len;
  const by1 = y2 + (9 * tx) / len;
  const bx2 = x2 - (9 * -ty) / len;
  const by2 = y2 - (9 * tx) / len;
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
      <path d={d} fill="none" stroke={c} strokeWidth={3.5} strokeDasharray="10 9" opacity={0.55 * pp} />
      {/* 描线亮沿（实线 overlay 走 pathLength 归一化——与虚线分元素，红线三） */}
      <path d={d} fill="none" stroke={c} strokeWidth={4.5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - pp} />
      {pp > 0.92 ? <path d={`M ${ax} ${ay} L ${bx1} ${by1} L ${bx2} ${by2} Z`} fill={c} /> : null}
    </svg>
  );
};

/** 原型日志面板（2-C 右轨——两行 Stop 日志先后滑入；数字恒由日志行承载）。
 *  `line1`/`line2` 0..1 各行滑入进度。 */
export const LogTrace: React.FC<{x: number; y: number; w?: number; line1?: number; line2?: number; dim?: number}> = ({
  x,
  y,
  w = 640,
  line1 = 0,
  line2 = 0,
  dim = 0,
}) => {
  const lines = [
    {t: '[HOOK] Stop: session used 8 tool results', p: clamp01(line1)},
    {t: '[HOOK] Stop: session used 9 tool results', p: clamp01(line2)},
  ];
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        opacity: 1 - dim,
      }}
    >
      <Panel style={{width: '100%', boxSizing: 'border-box', padding: '16px 20px'}}>
        <div style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginBottom: 10}}>{'stop-hook · trace'}</div>
        {lines.map((ln) => (
          <div
            key={ln.t}
            style={{
              fontFamily: theme.mono,
              fontSize: 21,
              color: theme.hook,
              whiteSpace: 'nowrap',
              opacity: ln.p,
              transform: `translateX(${(1 - ln.p) * 46}px)`,
              marginBottom: 8,
            }}
          >
            {ln.t}
          </div>
        ))}
      </Panel>
    </div>
  );
};

/** 消融单轨（3-A 左红右绿双例并置——accent 由调用方注入 danger/ok；轮次带十格
 *  同 fill 同拍演化〔QA-4：双例传同一 rounds〕；轨头带 Stop 挂点微缩签名——
 *  紫钩同形回归，判续承接 2-C；读数位/开关由场景钉在轨内轨下）。 */
export const AblationTrack: React.FC<{
  x: number;
  y: number;
  w?: number;
  tag: string;
  accent: string;
  lit?: number;
  rounds?: number;
  dim?: number;
}> = ({x, y, w = 760, tag, accent, lit = 0, rounds = 0, dim = 0}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, opacity: (0.35 + 0.65 * clamp01(lit)) * (1 - dim)}}>
    <Panel accent={accent} style={{width: '100%', boxSizing: 'border-box', padding: '14px 18px'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <svg width={26} height={30} viewBox="-13 -15 26 30" style={{overflow: 'visible'}}>
          {/* Stop 挂点微缩签名（紫钩同形——判续承接 2-C） */}
          <path d="M 0 -12 L 0 4 Q 0 12 -6 12 Q -11 12 -11 6" fill="none" stroke={theme.mech} strokeWidth={3.5} strokeLinecap="round" />
        </svg>
        <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: accent}}>{tag}</span>
      </div>
      {/* 轮次带（十格同 fill——双例同拍；无号圆点语言） */}
      <div style={{display: 'flex', gap: 6, marginTop: 12}}>
        {Array.from({length: 10}, (_, i) => {
          const on = clamp01(clamp01(rounds) * 10 - i);
          return (
            <div
              key={i}
              style={{
                width: (w - 36 - 9 * 6) / 10,
                height: 34,
                borderRadius: 6,
                border: `2px solid ${on > 0.5 ? accent : theme.panelBorder}`,
                background: on > 0.5 ? withAlpha(accent, 0.18) : 'transparent',
                opacity: 0.55 + 0.45 * on,
              }}
            />
          );
        })}
      </div>
    </Panel>
  </div>
);

/** 事件清单增长条（4-A——左端 4 段骨架（注册表成年态同形：四事件名微缩可辨、
 *  挂点紫恒亮）→ 中段细格（`grow` 0..1 驱动计数 4→27）→ 右端虚线外延段
 *  （趋势化、不落具体值）；归属徽标/日期角标钉在读数条上）。 */
export const GrowthBar: React.FC<{
  x: number;
  y: number;
  w?: number;
  segLit?: number;
  grow?: number;
  extLit?: number;
  badgeLit?: number;
  dateLit?: number;
  dim?: number;
}> = ({x, y, w = 1560, segLit = 1, grow = 0, extLit = 0, badgeLit = 0, dateLit = 0, dim = 0}) => {
  const mid = 23; // 中段细格数（4 骨架 + 23 = 27）
  const segW = 130;
  const cellW = (w - 4 * segW - mid * 6 - 26 - 30) / mid;
  const g = clamp01(grow);
  const count = 4 + Math.round(23 * g);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: 1 - dim}}>
      <div style={{display: 'flex', alignItems: 'stretch', gap: 6}}>
        {/* 骨架 4 段（注册表成年态——事件名微缩可辨 + 恒亮加重档） */}
        {HOOK_EVENTS.map((ev, i) => (
          <div
            key={ev.en}
            style={{
              width: segW,
              height: 92,
              boxSizing: 'border-box',
              borderRadius: 10,
              border: `2.5px solid ${theme.mech}`,
              background: withAlpha(theme.mech, 0.1 + 0.1 * clamp01(segLit)),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              opacity: 0.55 + 0.45 * clamp01(segLit),
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.text}}>{ev.zh}</span>
            <span style={{fontFamily: theme.mono, fontSize: 11, color: theme.dim}}>{ev.en}</span>
          </div>
        ))}
        {/* 中段 27 细格（grow 渐次点亮） */}
        {Array.from({length: mid}, (_, i) => {
          const on = clamp01(g * mid - i);
          return (
            <div
              key={`m${i}`}
              style={{
                width: cellW,
                height: 92,
                borderRadius: 5,
                border: `2px solid ${on > 0.5 ? theme.mech : theme.panelBorder}`,
                background: on > 0.5 ? withAlpha(theme.mech, 0.16) : 'transparent',
                opacity: 0.5 + 0.5 * on,
              }}
            />
          );
        })}
        {/* 虚线外延段（渐隐增长沿——趋势化不落具体值） */}
        <div
          style={{
            width: 26,
            height: 92,
            borderRadius: 5,
            border: `2px dashed ${withAlpha(theme.mech, 0.65 * clamp01(extLit))}`,
            background: `linear-gradient(90deg, ${withAlpha(theme.mech, 0.08 * clamp01(extLit))}, transparent)`,
            opacity: clamp01(extLit),
          }}
        />
      </div>
      {/* 读数行：计数 + 归属徽标 + 日期角标（钉在读数条上） */}
      <div style={{display: 'flex', alignItems: 'baseline', gap: 20, marginTop: 12, paddingLeft: 4}}>
        <span style={{fontFamily: theme.mono, fontSize: 34, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums'}}>
          {`${count} 事件`}
        </span>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.dim,
            border: `2px solid ${withAlpha(theme.mech, 0.5)}`,
            borderRadius: 7,
            padding: '2px 10px',
            opacity: clamp01(badgeLit),
            whiteSpace: 'nowrap',
          }}
        >
          {'claude-code'}
        </span>
        <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, opacity: clamp01(dateLit), whiteSpace: 'nowrap'}}>
          {'2026-10'}
        </span>
      </div>
    </div>
  );
};

/** 不变式表决装置（4-B——承 ep3 3-B VoteBoard 同构签名：点头签 ok「允」×5
 *  横排 + 摇头签 danger「否」沉压 + 计票器；ep4 增设顶部「设置：拒绝 / 询问」
 *  双签位与居中递票）。`ticket` 0..1 递票行程；`bounce` 0..1 被设置位弹回；
 *  `nods` 齐亮；`press` 摇头沉压；`kill` 点头全灭；`counterGhost` 虚影一闪；
 *  `counterRetire` 即划退役。摇头压制方向 = 拒绝 > 允许（重者在下压）。 */
export const VoteBoard: React.FC<{
  x: number;
  y: number;
  lit?: number;
  ticket?: number;
  bounce?: number;
  nods?: readonly number[];
  press?: number;
  kill?: number;
  counterGhost?: number;
  counterRetire?: number;
  /** 摇头签定格放大（4-B 重音镜——只放大摇头签本体，其余装置不动） */
  headZoom?: number;
}> = ({x, y, lit = 0, ticket = 0, bounce = 0, nods = [0, 0, 0, 0, 0], press = 0, kill = 0, counterGhost = 0, counterRetire = 0, headZoom = 0}) => (
  <div style={{position: 'absolute', left: x, top: y, width: 900, height: 600, opacity: clamp01(lit)}}>
    {/* 顶部「设置」双签位（拒绝 / 询问——设置压过钩子的一票否决位） */}
    <div style={{position: 'absolute', left: 250, top: 0, display: 'flex', gap: 30}}>
      {[
        {k: '拒绝', en: 'deny'},
        {k: '询问', en: 'ask'},
      ].map((s) => (
        <div
          key={s.en}
          style={{
            width: 170,
            height: 76,
            boxSizing: 'border-box',
            borderRadius: 12,
            border: `3px solid ${theme.danger}`,
            background: withAlpha(theme.danger, 0.12),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 700, color: theme.text}}>{s.k}</span>
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.danger}}>{s.en}</span>
        </div>
      ))}
      <div style={{position: 'absolute', left: -96, top: 20, fontFamily: theme.mono, fontSize: 18, color: theme.dim, whiteSpace: 'nowrap'}}>
        {'settings'}
      </div>
    </div>
    {/* 递票（「钩子说放行」——回调蓝；递向设置位被弹回） */}
    {ticket > 0.01 ? (
      <div
        style={{
          position: 'absolute',
          left: 330 + 210 * clamp01(ticket) - 150 * clamp01(bounce),
          top: 130 + 56 * clamp01(ticket) + 34 * clamp01(bounce),
          padding: '10px 20px',
          borderRadius: 10,
          border: `2.5px solid ${theme.hook}`,
          background: withAlpha(theme.hook, 0.14),
          opacity: 1 - 0.5 * clamp01(bounce),
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>{'钩子说放行'}</span>
      </div>
    ) : null}
    {/* 点头签横排（确认绿「允」；kill 全灭 + 沉压下弯） */}
    <div style={{position: 'absolute', left: 120, top: 300, display: 'flex', gap: 26}}>
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
              opacity: 0.45 + 0.55 * Math.max(on, 1 - clamp01(kill)),
              transform: `translateY(${sag}px)`,
            }}
          >
            {'允'}
          </div>
        );
      })}
    </div>
    {/* 摇头签（警示红「否」——自上沉压过整排点头签，重者在下压；headZoom 定格放大） */}
    <div
      style={{
        position: 'absolute',
        left: 404 - 46 * clamp01(headZoom),
        top: 120 + 150 * clamp01(press) - 46 * clamp01(headZoom),
        width: 92 + 92 * clamp01(headZoom),
        height: 92 + 92 * clamp01(headZoom),
        borderRadius: 999,
        border: `${4 + 2 * clamp01(headZoom)}px solid ${theme.danger}`,
        background: withAlpha(theme.danger, 0.2),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.sans,
        fontSize: 38 + 26 * clamp01(headZoom),
        fontWeight: 700,
        color: theme.danger,
        boxShadow: `0 ${10 * clamp01(press)}px ${26 * clamp01(press) + 20 * clamp01(headZoom)}px ${withAlpha(theme.danger, 0.5 + 0.3 * clamp01(headZoom))}`,
        zIndex: 3,
      }}
    >
      {'否'}
    </div>
    {/* 计票器（虚影一闪即划——无计票语义） */}
    <div
      style={{
        position: 'absolute',
        left: 320,
        top: 440,
        padding: '10px 22px',
        borderRadius: 10,
        border: `2.5px solid ${theme.mech}`,
        background: theme.panel,
        fontFamily: theme.mono,
        fontSize: 22,
        color: theme.text,
        opacity: counterGhost * (1 - 0.55 * clamp01(counterRetire)),
      }}
    >
      <span style={{position: 'relative'}}>
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
  </div>
);

/** 防转圈标志位（4-C——仅两态：空（虚线空格）/ 亮（mech 实心 + 辉光）；
 *  禁第三态）。`flag` 0..1 空→亮翻转。 */
export const FlagBadge: React.FC<{x: number; y: number; lit?: number; flag?: number; dim?: number}> = ({x, y, lit = 1, flag = 0, dim = 0}) => {
  const f = clamp01(flag);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 190,
        height: 84,
        boxSizing: 'border-box',
        borderRadius: 12,
        border: `3px solid ${theme.mech}`,
        background: withAlpha(theme.mech, 0.08),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        opacity: clamp01(lit) * (1 - dim),
      }}
    >
      <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'stopHookActive'}</span>
      {/* 状态格：空 = 虚线空圈；亮 = mech 实心 + 辉光（两态切换走连续降档） */}
      <svg width={34} height={34} viewBox="0 0 34 34" style={{overflow: 'visible'}}>
        <circle cx={17} cy={17} r={12} fill="none" stroke={theme.dim} strokeWidth={2.5} strokeDasharray="5 5" opacity={1 - f} />
        <circle cx={17} cy={17} r={12} fill={theme.mech} opacity={f} />
        {f > 0.01 ? <circle cx={17} cy={17} r={12 + 8 * f} fill="none" stroke={theme.mech} strokeWidth={2.5} opacity={0.6 * f} /> : null}
      </svg>
    </div>
  );
};

/** 保险徽记（4-D——挂点紫圆形徽 + 盾形刻线 + 下缘名签；两枚合拢同亮）。
 *  `lit` 显形；`glow` 0..1 同亮辉光。 */
export const InsuranceBadge: React.FC<{cx: number; cy: number; r?: number; label: string; lit?: number; glow?: number; dim?: number}> = ({
  cx,
  cy,
  r = 110,
  label,
  lit = 1,
  glow = 0,
  dim = 0,
}) => (
  <div style={{position: 'absolute', left: cx - r - 20, top: cy - r - 20, width: (r + 20) * 2, opacity: clamp01(lit) * (1 - dim), textAlign: 'center'}}>
    <svg width={(r + 20) * 2} height={(r + 20) * 2} viewBox={`${-r - 20} ${-r - 20} ${(r + 20) * 2} ${(r + 20) * 2}`} style={{overflow: 'visible'}}>
      <circle r={r} fill={withAlpha(theme.mech, 0.1)} stroke={theme.mech} strokeWidth={5} />
      {glow > 0.01 ? <circle r={r + 12} fill="none" stroke={theme.mech} strokeWidth={3} opacity={0.55 * clamp01(glow)} /> : null}
      {/* 盾形刻线（保险语义——简笔盾形） */}
      <path
        d={`M 0 ${-r * 0.5} L ${r * 0.42} ${-r * 0.28} L ${r * 0.42} ${r * 0.12} Q ${r * 0.42} ${r * 0.52} 0 ${r * 0.66} Q ${-r * 0.42} ${r * 0.52} ${-r * 0.42} ${r * 0.12} L ${-r * 0.42} ${-r * 0.28} Z`}
        fill="none"
        stroke={theme.mech}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path d={`M 0 ${-r * 0.18} L 0 ${r * 0.3}`} stroke={theme.mech} strokeWidth={4} strokeLinecap="round" />
    </svg>
    <div style={{marginTop: -r * 0.5, fontFamily: theme.sans, fontSize: 27, fontWeight: 700, color: theme.text}}>{label}</div>
  </div>
);
