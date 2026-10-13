/** chrome 层组件种子（seeded 档——scaffold 复制后完全自由，无门，随集演进）。
 *
 *  本文件从《拆开 Claude Code》集（claude-code-explained-video）的 motifs.tsx
 *  抽出**通用排版/标注机械**，只读底座 token（panel/panelBorder/text/dim +
 *  字体三族）；概念色一律经 `accent` prop 由调用方注入。任何集的 theme.ts
 *  底座都齐，故 scaffold 后无需改动即可 tsc 通过。随集演进时直接改本集副本
 *  （复制适配、不做跨集 import——复用边界见 references/PIPELINE.md §四）。
 *
 *  刻意**不进模板**的是创作性母题（Terminal / LoopRing / DispatchTable /
 *  GateRouter / SlotRing）：它们承载各集的叙事隐喻，属于每集的创作产物。
 *  需要时从 claude-code-explained-video 的 motifs.tsx 复制对应段落后裁剪、
 *  追加到本文件；母题目录与适用场景见 references/08 的母题表。
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

/** 幕标题条：章号 + 标语（角标性质，不进口播）。章号默认 text，
 *  各集常换成本集概念色（ep1 即是 core）——这是 chrome 层少数的「随集演进」点。
 *  本集定位：左上、常驻系列条（y64..98）之下一行（top:112）——右上角让位给
 *  LodgeMap 缩略坐标装置（本集常驻件）；tagline 控制在 8 字内，右缘 <300，
 *  与 archify 全屏画框（左缘 311、顶 150）零碰撞。 */
export const SceneTag: React.FC<{
  chapter: string;
  tagline: string;
  accent?: string;
}> = ({chapter, tagline, accent}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [6, 24], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', left: 72, top: 112, opacity: o}}>
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

// ─────────────────────────────────────────────────────────── 本集母题

/** 走廊环线宽（绝对像素，全片恒定，勿随 size 缩放——〔M-001〕） */
export const RING_STROKE = 6;

/** 楼体母题面色（P0/P6 楼体共用——跨幕同色须共享常量防漂移；
 *  母题装饰底色不占语义槽，storyboard 视觉契约「母题装饰底」行登记） */
export const LODGE_INK = '#10151d';

/** 环形走廊母题（〔M-001〕恒定视觉锚）：core 橙描边 + 绝对线宽 6px 全片锁定，
 *  只换 size / 描画进度 / 辉光强度——「走廊始终不变」靠它被看见而非被听说。
 *  自 ep1 LoopRing 的描边纪律裁剪：不带节点、不带出口线；描画走 pathLength
 *  归一化（红线三：不与像素 dasharray 混用）；辉光是低透明宽描边的静态叠加
 *  （effects 不吃弹簧），强度由调用方经 glow 注入（如 useBreathe 输出）。 */
export const CorridorRing: React.FC<{
  size?: number;
  /** 0..1 描线进度（缺省 1 = 已成环） */
  draw?: number;
  /** 0..1 辉光强度（外圈低透明宽描边） */
  glow?: number;
  /** 整体透明度（缩略档压暗用） */
  opacity?: number;
}> = ({size = 300, draw = 1, glow = 0, opacity = 1}) => {
  const pad = RING_STROKE / 2 + 8; // 描边半宽 + 呼吸辉光余量
  const r = size / 2 - pad;
  const cx = size / 2;
  const d = Math.max(0, Math.min(1, draw));
  return (
    <svg width={size} height={size} style={{overflow: 'visible', opacity}}>
      {/* 呼吸辉光：主环下的低透明宽描边（颜色同主环——恒色纪律） */}
      {glow > 0 ? (
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={theme.concept}
          strokeWidth={RING_STROKE * 2.6}
          strokeLinecap="round"
          opacity={0.16 * glow}
        />
      ) : null}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={theme.concept}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - d}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
    </svg>
  );
};

/** 七件设施缩略坐标（楼体剖面常驻件）：上层房带（mechDeep 深赭）＋中层走廊环
 *  （core 橙缩略，描边恒 6px——〔M-001〕的缩小身位）＋下层五设施格。
 *  active 高亮当前幕设施、压暗其余；corridorHidden 把走廊位留成「?」（0-C 预告态：
 *  第七件未揭晓）。尺寸 ≤240×150，调用方放右上角（y≥56，不入字幕带）。 */
export type LodgeFacility = 'wall' | 'slot' | 'ledger' | 'clock' | 'socket' | 'rooms' | 'corridor';

const LODGE_CELLS: {key: LodgeFacility; label: string}[] = [
  {key: 'wall', label: '墙'},
  {key: 'slot', label: '口'},
  {key: 'ledger', label: '簿'},
  {key: 'clock', label: '钟'},
  {key: 'socket', label: '座'},
];

export const LodgeMap: React.FC<{
  active: LodgeFacility | null;
  /** 第七位留「?」：走廊环压暗 + 问号（0-C 章毕预告态） */
  corridorHidden?: boolean;
  opacity?: number;
}> = ({active, corridorHidden = false, opacity = 1}) => {
  const W = 220;
  const H = 140;
  const ringOn = active === 'corridor';
  return (
    <svg width={W} height={H} style={{opacity, overflow: 'visible'}}>
      {/* 上层房带（私人层——深赭仅装饰线） */}
      <rect
        x={10}
        y={8}
        width={200}
        height={34}
        rx={5}
        fill="none"
        stroke={active === 'rooms' ? theme.mechDeep : theme.panelBorder}
        strokeWidth={active === 'rooms' ? 2.5 : 1.5}
        opacity={active === null || active === 'rooms' ? 1 : 0.45}
      />
      {[0, 1, 2].map((i) => (
        <line
          key={i}
          x1={60 + i * 50}
          y1={12}
          x2={60 + i * 50}
          y2={38}
          stroke={theme.panelBorder}
          strokeWidth={1}
          opacity={active === 'rooms' ? 0.9 : 0.4}
        />
      ))}
      <text
        x={16}
        y={29}
        fontFamily={theme.sans}
        fontSize={12}
        fill={active === 'rooms' ? theme.text : theme.dim}
        opacity={active === 'rooms' ? 1 : 0.55}
      >
        {'房'}
      </text>
      {/* 中层走廊环（core 橙缩略——描边恒 6px〔M-001〕；预告态压暗留「?」） */}
      {corridorHidden ? (
        <>
          <circle cx={110} cy={57} r={11} fill="none" stroke={theme.panelBorder} strokeWidth={RING_STROKE} opacity={0.5} />
          <text
            x={110}
            y={63}
            textAnchor="middle"
            fontFamily={theme.mono}
            fontSize={15}
            fill={theme.dim}
          >
            {'?'}
          </text>
        </>
      ) : (
        <g opacity={active === null || ringOn ? 1 : 0.45}>
          <circle
            cx={110}
            cy={57}
            r={11}
            fill="none"
            stroke={theme.concept}
            strokeWidth={RING_STROKE}
          />
        </g>
      )}
      {/* 下层五设施格（公共层——赭金激活才染色，反枚举） */}
      {LODGE_CELLS.map((c, i) => {
        const on = active === c.key;
        const x = 12 + i * 40;
        return (
          <g key={c.key} opacity={active === null || on ? 1 : 0.4}>
            <rect
              x={x}
              y={80}
              width={34}
              height={46}
              rx={4}
              fill={on ? `${theme.accent}1F` : 'none'}
              stroke={on ? theme.accent : theme.panelBorder}
              strokeWidth={on ? 2.5 : 1.5}
            />
            <text
              x={x + 17}
              y={108}
              textAnchor="middle"
              fontFamily={theme.sans}
              fontSize={15}
              fontWeight={on ? 700 : 400}
              fill={on ? theme.accent : theme.dim}
            >
              {c.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export {ease};

// ─────────────────────────────────────────────────────── 系列片头用 LoopRing
// 自系列种子移植（主干 #1190，origin/feature/1.x.x 同文件「母题 2」段原样）：
// series-intro.tsx（五集孪生副本，本轮入库未挂载）import 本母题，tsc 全量编译
// 需要它在场；本集正片使用 CorridorRing（楼喻裁剪版），两者并存互不干扰。
// 片头挂载与逐集裁剪留待下轮重制（vibe-video.toml drift 条同注）。
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
