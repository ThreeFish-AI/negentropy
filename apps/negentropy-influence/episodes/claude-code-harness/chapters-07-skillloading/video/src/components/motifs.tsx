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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2/ep3/ep4/ep5/ep6 延续——
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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep6 逐字节
 * 拷贝（本集场景一律 `nodes={[]}`：环体即循环本体，无站点标注态）。
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

/** 环上坐标（-90 = 12 点；r 与 LoopRing 内圈同式 = size/2 - 46）——支线短弧
 *  钉位/环外挂件的场景侧共用工式 */
export const ringPt = polar;

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep7 Skill Loading）
// storyboard 实现映射登记：CatalogBand / FullTextCard / LoadChannel / RegistryCard /
// BillingStack / RoundCounter。全片主装置 = 开场白带 + 全文卡双子装置（对照 ep2
// 对照表 / ep6 两间会议室之地位）：目录带紫 mech / 全文卡蓝 load、加载通道蓝单向
// 右→左，缩微前后不重绘（scale 整体变换）。哑装置原则承 ep4–ep6：动效参数（进度/
// 状态/读数）一律经 prop 由调用场景注入，本段零 motion hooks——「怎么动」归场景，
// 「画什么」归此处。
// CatalogBand 状态机口径（G1 修订）：病灶（含爆涨）/目录/走查/反例/生产共六态
// （P0 病灶与爆涨两拍、1-A 目录、2-A 走查、3-A 反例、4-A/4-B 生产），5-A 定格为
// 收束形态不计态；全片同一物理带——带位横贯恒定、状态切换不重绘带身。

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 开场白带（全片主装置·状态机——六态生长全经此件）。横贯细长带：头部标签 +
 *  四行书目（名字 + 一句话描述双字段）+ 带尾计数签。`accent` 缺省 mech（目录态
 *  紫）、P0 病灶态传中性灰白；`redMode` 0..1 反例态警示红描边 + 辉光；`inlineCards`
 *  0..4 反例态四张蓝卡拼入带内（蓝卡入紫带/红境——爆涨态由调用方加高 h 驱动）；
 *  `rowGhost` 0..1 行灰化（0-B 99% 灰）；`swell` 0..1 带身胀满一拍。 */
export const CatalogBand: React.FC<{
  x: number;
  y: number;
  w: number;
  h?: number;
  scale?: number;
  lit?: number;
  dim?: number;
  accent?: string;
  headLabel?: string;
  headLit?: number;
  rows?: readonly {name: string; sub: string}[];
  rowsLit?: number;
  rowsDesc?: number;
  hitRow?: number;
  rowPulse?: number;
  rowGhost?: number;
  charText?: string;
  charLit?: number;
  tailTag?: string;
  tailLit?: number;
  redMode?: number;
  inlineCards?: number;
  inlineFlash?: number;
  swell?: number;
}> = ({
  x,
  y,
  w,
  h = 172,
  scale = 1,
  lit = 1,
  dim = 0,
  accent,
  headLabel = '开场白 · system prompt',
  headLit = 1,
  rows = [],
  rowsLit = 0,
  rowsDesc = 1,
  hitRow = -1,
  rowPulse = 0,
  rowGhost = 0,
  charText,
  charLit = 0,
  tailTag,
  tailLit = 0,
  redMode = 0,
  inlineCards = 0,
  inlineFlash = 0,
  swell = 0,
}) => {
  const on = accent ?? theme.mech;
  const red = clamp01(redMode);
  const border = red > 0.4 ? theme.danger : on;
  const rowH = 30;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h + 26 * clamp01(swell),
        opacity: clamp01(lit) * (1 - dim),
        transform: `scale(${scale})`,
        transformOrigin: 'left top',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: 14,
          border: `3px solid ${withAlpha(border, 0.9)}`,
          background: withAlpha(theme.panel, 0.94),
          boxShadow:
            red > 0.05
              ? `0 0 ${30 * red}px ${withAlpha(theme.danger, 0.45)}, inset 0 0 ${36 * red}px ${withAlpha(theme.danger, 0.14)}`
              : `0 0 ${18 * clamp01(rowPulse)}px ${withAlpha(on, 0.4)}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 头部标签（带身恒定件——状态切换不重绘带身） */}
        <div
          style={{
            position: 'absolute',
            left: 20,
            top: 12,
            fontFamily: theme.mono,
            fontSize: 17,
            color: on,
            opacity: clamp01(headLit),
            whiteSpace: 'nowrap',
          }}
        >
          {headLabel}
        </div>
        {/* 反例态计费口径签（红——8370 轴） */}
        {red > 0.05 && charText ? (
          <div
            style={{
              position: 'absolute',
              right: 20,
              top: 10,
              padding: '3px 12px',
              borderRadius: 7,
              border: `2.5px solid ${theme.danger}`,
              background: withAlpha(theme.danger, 0.1),
              fontFamily: theme.mono,
              fontSize: 19,
              fontWeight: 700,
              color: theme.danger,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              opacity: clamp01(charLit),
            }}
          >
            {charText}
          </div>
        ) : null}
        {/* 四行书目（名字 + 一句话描述双字段；未亮 = 虚线空位） */}
        <div style={{position: 'absolute', left: 24, right: 24, top: 46}}>
          {rows.map((r, i) => {
            const p = clamp01(rowsLit - i);
            const isHit = i === hitRow;
            const g = clamp01(rowGhost);
            return (
              <div
                key={r.name}
                style={{
                  position: 'relative',
                  height: rowH,
                  marginBottom: 4,
                  boxSizing: 'border-box',
                  borderRadius: 7,
                  border: `2px solid ${isHit ? withAlpha(on, 0.5 + 0.5 * clamp01(rowPulse)) : p > 0.5 ? withAlpha(on, 0.5) : theme.panelBorder}`,
                  borderStyle: p > 0.05 ? 'solid' : 'dashed',
                  background: isHit ? withAlpha(on, 0.16 + 0.14 * clamp01(rowPulse)) : p > 0.5 ? withAlpha(on, 0.07) : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '0 12px',
                  opacity: (0.35 + 0.65 * p) * (1 - 0.55 * g),
                  filter: `saturate(${1 - 0.6 * g})`,
                  boxShadow: isHit && rowPulse > 0.05 ? `0 0 ${18 * clamp01(rowPulse)}px ${withAlpha(on, 0.55)}` : 'none',
                }}
              >
                {/* 名字字段（书目的键） */}
                <span
                  style={{
                    fontFamily: theme.sans,
                    fontSize: 21,
                    fontWeight: 600,
                    color: g > 0.5 ? theme.dim : theme.text,
                    whiteSpace: 'nowrap',
                    minWidth: 128,
                  }}
                >
                  {r.name}
                </span>
                {/* 一句话描述字段（书目的值——双字段分步长出） */}
                <span
                  style={{
                    fontFamily: theme.mono,
                    fontSize: 13,
                    color: theme.dim,
                    whiteSpace: 'nowrap',
                    opacity: clamp01(rowsDesc),
                  }}
                >
                  {r.sub}
                </span>
              </div>
            );
          })}
        </div>
        {/* 反例态：四张全文蓝卡拼进带内（蓝卡入红境——全量内联的具象） */}
        {inlineCards > 0.02
          ? Array.from({length: 4}, (_, i) => {
              const p = clamp01(inlineCards - i);
              return (
                <div
                  key={`ic${i}`}
                  style={{
                    position: 'absolute',
                    left: 24 + i * ((w - 48) / 4 - 8),
                    top: 46,
                    width: (w - 48) / 4 - 16,
                    height: h - 66,
                    boxSizing: 'border-box',
                    borderRadius: 8,
                    border: `2.5px solid ${withAlpha(theme.load, 0.85)}`,
                    background: withAlpha(theme.load, 0.12 + 0.1 * clamp01(inlineFlash)),
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '8px 10px',
                    opacity: 0.3 + 0.7 * p,
                  }}
                >
                  <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.load, whiteSpace: 'nowrap'}}>{`SKILL.md ${i + 1}`}</span>
                  {Array.from({length: 5}, (_, k) => (
                    <div key={k} style={{height: 7, width: `${88 - k * 12}%`, borderRadius: 3, background: withAlpha(theme.load, 0.3), opacity: p}} />
                  ))}
                </div>
              );
            })
          : null}
        {/* 带尾字符计数签（走查态 281 口径——紫框数字签） */}
        {charText && red < 0.4 ? (
          <div
            style={{
              position: 'absolute',
              right: 18,
              bottom: 12,
              padding: '3px 12px',
              borderRadius: 7,
              border: `2.5px solid ${withAlpha(on, 0.85)}`,
              background: withAlpha(on, 0.1),
              fontFamily: theme.mono,
              fontSize: 19,
              fontWeight: 700,
              color: theme.text,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              opacity: clamp01(charLit),
            }}
          >
            {charText}
          </div>
        ) : null}
        {/* 带尾小签（「有什么」——常驻的书目感） */}
        {tailTag ? (
          <div
            style={{
              position: 'absolute',
              right: 18,
              bottom: 12,
              padding: '3px 12px',
              borderRadius: 7,
              border: `2px solid ${withAlpha(theme.dim, 0.8)}`,
              fontFamily: theme.sans,
              fontSize: 16,
              fontWeight: 600,
              color: theme.dim,
              whiteSpace: 'nowrap',
              opacity: clamp01(tailLit) * (charText ? 0 : 1),
            }}
          >
            {tailTag}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 全文卡（蓝·大部头——六态生长：待命/进场/已在历史/内联反例/虚位/堆积）。
 *  `rowsLit` 0..12 内容行点亮（大部头体量）；`flash` 0..1 进场落账闪；
 *  `ghostMark` 0..1 「已在内」标记（不再重复加载）；`dashMode` 0..1 虚位轮廓
 *  （用到之前不在场——在场/不在场对照）。 */
export const FullTextCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  scale?: number;
  lit?: number;
  dim?: number;
  title?: string;
  tag?: string;
  rowsLit?: number;
  flash?: number;
  ghostMark?: number;
  dashMode?: number;
}> = ({
  x,
  y,
  w = 300,
  h = 430,
  scale = 1,
  lit = 1,
  dim = 0,
  title = '数据库指南 · 全文',
  tag = 'SKILL.md',
  rowsLit = 0,
  flash = 0,
  ghostMark = 0,
  dashMode = 0,
}) => {
  const dashed = clamp01(dashMode);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: clamp01(lit) * (1 - dim) * (1 - 0.25 * dashed),
        transform: `scale(${scale})`,
        transformOrigin: 'left top',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: 12,
          border: `3px ${dashed > 0.4 ? 'dashed' : 'solid'} ${dashed > 0.4 ? withAlpha(theme.load, 0.55) : theme.load}`,
          background: dashed > 0.4 ? withAlpha(theme.load, 0.03) : withAlpha(theme.panel, 0.94),
          boxShadow: dashed > 0.4 ? 'none' : flash > 0.05 ? `0 0 ${26 * clamp01(flash)}px ${withAlpha(theme.load, 0.5)}` : 'none',
          position: 'relative',
          padding: '14px 16px',
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{title}</span>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.load}}>{tag}</span>
        </div>
        {/* 大部头内容行（两千行级的体量感——12 条实线行） */}
        <div style={{marginTop: 12}}>
          {Array.from({length: 12}, (_, i) => {
            const p = clamp01(rowsLit - i);
            return (
              <div
                key={i}
                style={{
                  height: 8,
                  width: `${90 - ((i * 13) % 42)}%`,
                  borderRadius: 4,
                  background: dashed > 0.4 ? 'transparent' : withAlpha(theme.load, 0.22 + 0.2 * p),
                  border: dashed > 0.4 ? `2px dashed ${withAlpha(theme.load, 0.3)}` : 'none',
                  marginBottom: 9,
                  opacity: dashed > 0.4 ? 0.5 : 0.25 + 0.75 * p,
                }}
              />
            );
          })}
        </div>
        {/* 行数标（两千行级——体量读数） */}
        <div
          style={{
            position: 'absolute',
            left: 16,
            bottom: 12,
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.dim,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {dashed > 0.4 ? '用到之前 · 不在场' : '~2000 行级'}
        </div>
        {/* 「已在内」标记（历史携带——不再重复加载） */}
        {ghostMark > 0.05 ? (
          <div
            style={{
              position: 'absolute',
              right: -14,
              top: -16,
              padding: '4px 14px',
              borderRadius: 8,
              border: `2.5px solid ${theme.ok}`,
              background: withAlpha(theme.ok, 0.12),
              fontFamily: theme.sans,
              fontSize: 17,
              fontWeight: 700,
              color: theme.ok,
              whiteSpace: 'nowrap',
              opacity: clamp01(ghostMark),
              transform: `rotate(-4deg)`,
            }}
          >
            {'已在内'}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 蓝色加载通道（右→左单向——全文经通道一次性进场）。`flow` 0..1 行进虚线相位；
 *  `mouthLit` 0..1 通道口高亮；`blocked` 0..1 禁行杠落下（路径天生堵死的边界
 *  一拍）；`inMark` 0..1 「已在内」通道口标记；`ghostArrow` 0..1 重复加载箭头
 *  虚化禁行。通道本体恒单向——方向语义不随状态变。 */
export const LoadChannel: React.FC<{
  x: number;
  y: number;
  w: number;
  h?: number;
  lit?: number;
  flow?: number;
  mouthLit?: number;
  blocked?: number;
  inMark?: number;
  ghostArrow?: number;
}> = ({x, y, w, h = 56, lit = 1, flow = 0, mouthLit = 0, blocked = 0, inMark = 0, ghostArrow = 0}) => {
  const cy = h / 2;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: clamp01(lit), pointerEvents: 'none'}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{overflow: 'visible'}}>
        {/* 通道带 */}
        <rect x={0} y={0} width={w} height={h} rx={h / 2} fill={withAlpha(theme.load, 0.08)} stroke={theme.load} strokeWidth={2.5} />
        {/* 行进虚线（右→左恒定） */}
        <line
          x1={w - 14}
          y1={cy}
          x2={14}
          y2={cy}
          stroke={theme.load}
          strokeWidth={3}
          strokeDasharray="14 18"
          strokeDashoffset={-24 * (((flow % 1) + 1) % 1)}
          opacity={0.85}
        />
        {/* 单向箭头（左向 chevron ×3——单向语义静态宣告） */}
        {[0.32, 0.52, 0.72].map((f, i) => (
          <path
            key={i}
            d={`M ${w * f + 10} ${cy - 9} L ${w * f - 6} ${cy} L ${w * f + 10} ${cy + 9}`}
            fill="none"
            stroke={theme.load}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
          />
        ))}
        {/* 通道口（右端——名字签的投递口） */}
        <circle cx={w - 4} cy={cy} r={13 + 4 * clamp01(mouthLit)} fill={theme.bg} stroke={theme.load} strokeWidth={4} opacity={0.7 + 0.3 * clamp01(mouthLit)} />
        {/* 禁行杠（通道口落下——路径堵死的边界一拍；承系列边界语言） */}
        {blocked > 0.02 ? (
          <g opacity={clamp01(blocked)}>
            <line x1={w - 26} y1={cy - 26 + 30 * (1 - clamp01(blocked))} x2={w + 2} y2={cy + 26 - 30 * (1 - clamp01(blocked))} stroke={theme.danger} strokeWidth={6} strokeLinecap="round" />
          </g>
        ) : null}
      </svg>
      {/* 「已在内」通道口标记（历史携带——通道不再走第二趟） */}
      {inMark > 0.05 ? (
        <div
          style={{
            position: 'absolute',
            right: -30,
            top: -46,
            padding: '3px 12px',
            borderRadius: 7,
            border: `2.5px solid ${theme.ok}`,
            background: withAlpha(theme.ok, 0.12),
            fontFamily: theme.sans,
            fontSize: 16,
            fontWeight: 700,
            color: theme.ok,
            whiteSpace: 'nowrap',
            opacity: clamp01(inMark),
          }}
        >
          {'已在内'}
        </div>
      ) : null}
      {/* 重复加载箭头（虚化禁行——第二趟不发生的可核对判据） */}
      {ghostArrow > 0.02 ? (
        <svg width={120} height={30} viewBox="0 0 120 30" style={{position: 'absolute', right: -10, top: h + 8, overflow: 'visible', opacity: 0.4 * (1 - clamp01(ghostArrow))}}>
          <line x1={110} y1={15} x2={20} y2={15} stroke={theme.dim} strokeWidth={3} strokeDasharray="6 6" />
          <path d="M 28 8 L 18 15 L 28 22" fill="none" stroke={theme.dim} strokeWidth={3} strokeLinecap="round" />
        </svg>
      ) : null}
    </div>
  );
};

/** 注册表卡（紫·双列：名字 ↔ 技能——按名查表的字典装置）。`hitP` 0..1 命中行
 *  点亮（名字签落进、行高亮）；`hitIndex` 命中行号。角标 SKILL_REGISTRY。 */
export const RegistryCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  lit?: number;
  hitP?: number;
  hitIndex?: number;
}> = ({x, y, w = 640, h = 380, lit = 1, hitP = 0, hitIndex = 1}) => {
  const ROWS = ['react-style', 'sql-style', 'api-design', 'pdf'];
  const rowH = (h - 88) / ROWS.length;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: clamp01(lit)}}>
      <Panel accent={theme.mech} style={{width: '100%', height: '100%', boxSizing: 'border-box', position: 'relative'}}>
        {/* 头行：双列表头（名字 ↔ 技能）+ 角标 */}
        <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 20px 0'}}>
          <div style={{display: 'flex', gap: 24, fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>
            <span style={{width: 200}}>{'名字'}</span>
            <span>{'技能'}</span>
          </div>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.mech}}>{'SKILL_REGISTRY'}</span>
        </div>
        {/* 命中行（名字签落进——行点亮闪） */}
        {ROWS.map((name, i) => {
          const isHit = i === hitIndex;
          const p = isHit ? clamp01(hitP) : 0;
          return (
            <div
              key={name}
              style={{
                position: 'absolute',
                left: 20,
                right: 20,
                top: 52 + i * rowH,
                height: rowH - 8,
                boxSizing: 'border-box',
                borderRadius: 8,
                border: `2.5px solid ${isHit && p > 0.1 ? theme.mech : theme.panelBorder}`,
                background: isHit ? withAlpha(theme.mech, 0.1 + 0.12 * p) : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                padding: '0 16px',
                opacity: isHit ? 0.45 + 0.55 * p : 0.55,
                boxShadow: isHit && p > 0.3 ? `0 0 ${20 * p}px ${withAlpha(theme.mech, 0.5)}` : 'none',
              }}
            >
              <span style={{width: 200, fontFamily: theme.mono, fontSize: 19, color: isHit ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{name}</span>
              <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 600, color: isHit ? theme.text : theme.dim, whiteSpace: 'nowrap', opacity: isHit ? p : 0.6}}>
                {`${name} 全文`}
              </span>
              {isHit && p > 0.5 ? (
                <span style={{marginLeft: 'auto', fontFamily: theme.mono, fontSize: 13, color: theme.ok, whiteSpace: 'nowrap', opacity: p}}>{'命中'}</span>
              ) : null}
            </div>
          );
        })}
      </Panel>
    </div>
  );
};

/** 每轮复制叠印计费帧（P0 首演 / 0-B 加速 / 3-C 左轨回场）。`copies` 0..3 实数
 *  叠印份数（=轮数，逐轮 +1）；`cellsLit` 0..3 计费格点亮；`perRound` 每轮增量
 *  文本（+6500 / +8370）。复制方向恒向右（叠印帧与账格同步同拍）。 */
export const BillingStack: React.FC<{
  x: number;
  y: number;
  w: number;
  h?: number;
  lit?: number;
  copies?: number;
  cellsLit?: number;
  perRound?: string;
  cellTag?: string;
}> = ({x, y, w, h = 96, lit = 1, copies = 0, cellsLit = 0, perRound = '+6500', cellTag = '每轮'}) => (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h + 116, opacity: clamp01(lit), pointerEvents: 'none'}}>
      {/* 叠印帧（带身向右逐轮复制——ghost 层向右下错位；⑨ QA RISKY-1/2：副本
          可见性抬升——偏移 40/14、亮态 opacity ≥0.35、描边随点亮增强） */}
      {Array.from({length: 3}, (_, i) => {
        const on = clamp01(copies - i);
        return (
          <div
            key={`cp${i}`}
            style={{
              position: 'absolute',
              left: (i + 1) * 40,
              top: (i + 1) * 14,
              width: w,
              height: h,
              boxSizing: 'border-box',
              borderRadius: 14,
              border: `3px solid ${withAlpha(theme.danger, 0.3 + 0.45 * on)}`,
              background: withAlpha(theme.danger, 0.06 * on),
              opacity: 0.35 + 0.35 * on,
            }}
          />
        );
      })}
      {/* 计费格（带下方三格——每轮一格、读数 +perRound；⑨ QA N1：亮格提亮
          ≥200/255——底 0.22 + 辉光） */}
      <div style={{position: 'absolute', left: 8, top: h + 12, display: 'flex', gap: 10, alignItems: 'center'}}>
        {Array.from({length: 3}, (_, i) => {
          const on = clamp01(cellsLit - i);
          return (
            <div
              key={`cell${i}`}
              style={{
                width: 118,
                height: 40,
                boxSizing: 'border-box',
                borderRadius: 8,
                border: `3px solid ${on > 0.5 ? theme.danger : theme.panelBorder}`,
                borderStyle: on > 0.05 ? 'solid' : 'dashed',
                background: on > 0.5 ? withAlpha(theme.danger, 0.22) : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 18,
                fontWeight: 700,
                color: on > 0.5 ? theme.danger : theme.dim,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                opacity: 0.5 + 0.5 * on,
                boxShadow: on > 0.5 ? `0 0 ${12 * on}px ${withAlpha(theme.danger, 0.55)}` : 'none',
              }}
            >
              {on > 0.5 ? perRound : `轮 ${i + 1}`}
            </div>
          );
        })}
        <span style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap'}}>{cellTag}</span>
      </div>
    </div>
  );

/** 三轮输入计数器（P2 走查 / 2-C 总账 / 3-B 重跑——同器不同值）。`bigValue`
 *  大读数（调用方 Math.round 有界值直传，禁 clamp01）；`cells` 轮次小格值；
 *  `cellsLit` 0..3 实数点亮；`totalMode` 2-C 形态（三小格汇入总格——加法关系
 *  可读）；`flash` 跳格闪。角标 label 场景传（per_turn_input / total）。 */
export const RoundCounter: React.FC<{
  x: number;
  y: number;
  scale?: number;
  lit?: number;
  bigValue: number;
  label?: string;
  cells?: readonly number[];
  cellsLit?: number;
  activeCell?: number;
  flash?: number;
  totalMode?: number;
  totalFrom?: readonly number[];
}> = ({x, y, scale = 1, lit = 1, bigValue, label = 'per_turn_input', cells = [323, 352, 2384], cellsLit = 0, activeCell = -1, flash = 0, totalMode = 0, totalFrom}) => {
  const tm = clamp01(totalMode);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 560,
        opacity: clamp01(lit),
        transform: `scale(${scale})`,
        transformOrigin: 'left top',
      }}
    >
      {/* 大读数 + 角标 */}
      <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 54,
            fontWeight: 700,
            color: theme.text,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            textShadow: flash > 0.05 ? `0 0 ${14 * clamp01(flash)}px ${withAlpha(theme.text, 0.8)}` : 'none',
          }}
        >
          {String(Math.round(bigValue))}
        </span>
        <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, whiteSpace: 'nowrap'}}>{label}</span>
      </div>
      {/* 轮次小格（基线刻度——323/352/2384 恒常驻三格） */}
      <div style={{display: 'flex', gap: 10, marginTop: 12, alignItems: 'flex-end'}}>
        {cells.map((c, i) => {
          const on = clamp01(cellsLit - i);
          const isActive = i === activeCell;
          return (
            <div
              key={i}
              style={{
                position: 'relative',
                width: 96,
                padding: '6px 0 5px',
                boxSizing: 'border-box',
                borderRadius: 7,
                border: `2.5px solid ${isActive ? theme.load : on > 0.5 ? withAlpha(theme.load, 0.55) : theme.panelBorder}`,
                background: isActive ? withAlpha(theme.load, 0.14) : 'transparent',
                textAlign: 'center',
                opacity: 0.45 + 0.55 * on,
                transform: isActive ? `scale(${1 + 0.06 * clamp01(flash)})` : 'none',
              }}
            >
              <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{`轮 ${i + 1}`}</div>
              <div style={{fontFamily: theme.mono, fontSize: 21, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums'}}>{String(c)}</div>
            </div>
          );
        })}
      </div>
      {/* 总账形态（2-C：三小格汇入总格——加法关系可读） */}
      {tm > 0.02 && totalFrom ? (
        <div style={{position: 'relative', height: 64 * tm + 20, marginTop: 6}}>
          <svg width={410} height={84} viewBox="0 0 410 84" style={{overflow: 'visible', opacity: tm}}>
            {/* 汇入连线（三小格 → 总格——单向向下汇入） */}
            {[52, 158, 264].map((cx0, i) => (
              <path
                key={i}
                d={`M ${cx0} 4 Q ${cx0} 40, 205 ${74}`}
                fill="none"
                stroke={withAlpha(theme.load, 0.6)}
                strokeWidth={2.5}
                strokeDasharray="6 6"
                pathLength={1}
                strokeDashoffset={1 - tm}
              />
            ))}
          </svg>
          <div
            style={{
              position: 'absolute',
              left: 205 - 110,
              top: 62,
              width: 220,
              textAlign: 'center',
              padding: '6px 0',
              borderRadius: 8,
              border: `2.5px solid ${theme.load}`,
              background: withAlpha(theme.load, 0.1),
              fontFamily: theme.mono,
              fontSize: 14,
              color: theme.dim,
              opacity: tm,
            }}
          >
            {`${totalFrom.join(' + ')}`}
          </div>
        </div>
      ) : null}
    </div>
  );
};
