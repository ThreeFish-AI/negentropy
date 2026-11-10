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
// 本集 bespoke 装置段（TableRegistry 等）经运动层入场——seeded 档自由演进
import {useEnter, useImpulse} from '../motion';

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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop/motifs.tsx，2026-10-31
// 拷入——LoopRing 描边色/线宽跨集恒定 = 逐字节拷贝的前提；Terminal 承 0 幕终端）

export type TermLine = {text: string; color?: string; delay: number; prompt?: string};

/** 终端窗口 + 逐字打字机。cps = 每秒字数（帧驱动，可复现） */
export const Terminal: React.FC<{
  lines: TermLine[];
  width?: number;
  height?: number;
  cps?: number;
  /** 打完后光标是否停闪并变灰（P0「然后就没有然后了」的落点） */
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

/** 环上节点的默认四站（12 点起顺时针）——本集五站走 `nodes` prop 覆写 */
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
 * - `nodes` 覆写站点集（本集五步：5 节点 72° 均布由调用方传入）
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

/** 本集五站（承 ep1 五步同构：进消息→调模型→存档·查→执行→回喂，-90 每 +72°）。
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

/** 执行段弧（琥珀，pathLength 归一化描线；p=0..1 描线进度，叠于 LoopRing 之上） */
export const execArcPath = (cx: number, cy: number, r: number): string => {
  const a0 = polar(cx, cy, r, EXEC_ARC.a0);
  const a1 = polar(cx, cy, r, EXEC_ARC.a1);
  return `M ${a0.x.toFixed(1)} ${a0.y.toFixed(1)} A ${r} ${r} 0 0 1 ${a1.x.toFixed(1)} ${a1.y.toFixed(1)}`;
};

// ─────────────────────────────────────────────── 本集 bespoke 装置
// （storyboard 实现映射登记：TableRegistry / ToolCard / GateCard /
//   DispatchChain / NumberTag——⑧ 轮 seeded 定制，跨幕装置统一落此）

/** 对照表行集（五件工具，1-B p1-05 全集；行序即表序，跨幕恒定不重排） */
export const TABLE_ROWS = [
  {zh: '跑命令', en: 'bash'},
  {zh: '读文件', en: 'read_file'},
  {zh: '写文件', en: 'write_file'},
  {zh: '改文件', en: 'edit_file'},
  {zh: '找文件', en: 'glob'},
] as const;

/** 对照表（第二母题装置，逐幕生长：1-A 首亮 1 行 → 1-B 5 行 → 2-B 缩微联动 →
 *  3-A 压暗退场 → 4-A 关后复现。全片同形：双列结构 + mech 描边，缩微前后
 *  行内容不重绘（scale 整体变换））。
 *  - `rows` 当前行数；`rowAts` 各行入场锚（null = 已在场）
 *  - `lit` 行高亮（查表联动点亮；灰暗态由 dim 整体承载）
 *  - `fuseAt` 新行「名字↔部件」接点闪合锚（impulse） */
export const TableRegistry: React.FC<{
  x: number;
  y: number;
  scale?: number;
  rows: number;
  rowAts?: readonly (number | null)[];
  lit?: readonly boolean[];
  dim?: number;
  fuseAt?: number;
  glowAt?: number;
}> = ({x, y, scale = 1, rows, rowAts, lit, dim = 0, fuseAt, glowAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = useEnter('rise', {at: 0, dur: 12, dist: 18, springPreset: 'settle'});
  const fuse = useImpulse({at: fuseAt ?? -999, dur: 12, peak: 0.5});
  const glow = useImpulse({at: glowAt ?? -999, dur: 15});
  const W = 560;
  const HEAD = 56;
  const RH = 60;
  const GAP = 10;
  // ⑨ QA N4：角标计数随行落地同步递增（rowAts 有锚的行入场后才计入——
  // 1-B 长行过程中读 2→3→4→5 行，非开帧即终值；无 rowAts 处恒为 rows）
  const landedRows = TABLE_ROWS.slice(0, rows).reduce((n, _, i) => {
    const a = rowAts?.[i] ?? null;
    return n + (a === null || frame >= a ? 1 : 0);
  }, 0);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: W,
        opacity: (1 - dim) * enter.opacity,
        transform: `${enter.transform} scale(${scale})`,
        transformOrigin: 'left top',
      }}
    >
      <Panel accent={theme.mech} style={{width: '100%', boxSizing: 'border-box', padding: 0}}>
        {/* 表头：双列名 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: HEAD,
            padding: '0 22px',
            borderBottom: `2px solid ${theme.mech}55`,
            fontFamily: theme.sans,
            fontSize: 26,
            fontWeight: 700,
            color: theme.text,
          }}
        >
          <span style={{width: 300}}>{'名字'}</span>
          <span>{'部件'}</span>
        </div>
        {/* 行（rowAts 有锚的行自虚线空槽滑入——纯函数 spring，hooks 铁律①；
            null = 已在场；空槽恒占位 = 「表会继续长」的预留语言） */}
        {TABLE_ROWS.slice(0, rows).map((r, i) => {
          const at = rowAts?.[i] ?? null;
          const sl =
            at === null
              ? 1
              : spring({frame: frame - at, fps, config: {damping: 200, stiffness: 100, mass: 1}});
          const op = at === null ? 1 : Math.min(1, Math.max(0, (frame - at) / 6));
          return (
            <div
              key={r.en}
              style={{
                position: 'relative',
                height: RH,
                marginTop: i === 0 ? 0 : GAP,
                borderRadius: 8,
                border: `2px dashed ${op > 0.5 ? 'transparent' : theme.panelBorder}`,
                opacity: op > 0.5 ? 1 : 0.55,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 22px',
                  borderRadius: 8,
                  background: lit?.[i] ? `${theme.mech}22` : 'transparent',
                  opacity: op,
                  transform: `translateX(${(1 - sl) * 40}px)`,
                }}
              >
                <span style={{width: 236, display: 'flex', alignItems: 'baseline', gap: 12}}>
                  <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>
                    {r.zh}
                  </span>
                </span>
                {/* ⑨ QA N2：名字↔部件连接改短箭头（原 3/5 点线在帧上读作一串
                    省略号）；fuseAt 闪合=箭头瞬间加粗一拍 */}
                <svg width={70} height={RH} style={{flexShrink: 0}}>
                  <line
                    x1={4}
                    y1={RH / 2}
                    x2={54}
                    y2={RH / 2}
                    stroke={theme.mech}
                    strokeWidth={fuse > 0.05 ? 4.5 : 3}
                    opacity={0.85}
                  />
                  <path
                    d={`M52 ${RH / 2 - 6} L64 ${RH / 2} L52 ${RH / 2 + 6}`}
                    fill="none"
                    stroke={theme.mech}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.85}
                  />
                </svg>
                <span
                  style={{
                    fontFamily: theme.mono,
                    fontSize: 23,
                    color: lit?.[i] ? theme.mech : theme.dim,
                    textShadow: lit?.[i] ? `0 0 ${10 * fuse}px ${theme.mech}` : 'none',
                  }}
                >
                  {r.en}
                </span>
              </div>
            </div>
          );
        })}
      </Panel>
      {glow > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: 18,
            border: `3px solid ${theme.mech}`,
            boxShadow: `0 0 ${26 * glow}px ${theme.mech}`,
            opacity: glow,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <div style={{position: 'absolute', right: -4, top: -30, fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>
        {`TOOL_HANDLERS · ${landedRows} 行`}
      </div>
    </div>
  );
};

/** 工具卡（1-C 能力对照 / 5-B 指尖小签 / 4-D 上限位）。
 *  - `structured` 0..1：透视显形进度（动作名 + 参数位齐整排列）
 *  - `grey`：bash 灰串形态（无差别字符块，无结构位） */
export const ToolCard: React.FC<{
  zh: string;
  en: string;
  w?: number;
  h?: number;
  accent?: string;
  structured?: number;
  grey?: boolean;
  plain?: boolean;
  children?: React.ReactNode;
}> = ({zh, en, w = 300, h = 96, accent, structured = 0, grey = false, plain = false, children}) => {
  const color = grey ? theme.dim : (accent ?? theme.mech);
  return (
    <div
      style={{
        width: w,
        height: h,
        boxSizing: 'border-box',
        borderRadius: 10,
        border: `2px solid ${grey ? theme.panelBorder : color}`,
        background: grey ? 'transparent' : `${color}14`,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 16px',
        position: 'relative',
      }}
    >
      <span style={{fontFamily: theme.sans, fontSize: plain ? 24 : 27, fontWeight: 600, color: grey ? theme.dim : theme.text, whiteSpace: 'nowrap'}}>
        {zh}
      </span>
      {!plain ? (
        <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginLeft: 'auto', whiteSpace: 'nowrap'}}>
          {en}
        </span>
      ) : null}
      {grey ? (
        /* 无差别字符块：bash 串的具象（无结构位） */
        <span style={{position: 'absolute', left: 16, bottom: 12, display: 'flex', gap: 4, opacity: 0.55}}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
            <span key={k} style={{width: 9, height: 9, borderRadius: 2, background: theme.dim}} />
          ))}
        </span>
      ) : null}
      {structured > 0.01 ? (
        /* 结构显形层：动作名 + 参数位齐排（透视镜扫过才亮） */
        <span
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            opacity: structured,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 16, color}}>{'action'}</span>
          {[0, 1].map((k) => (
            <span key={k} style={{width: 52, height: 12, borderRadius: 3, background: `${color}66`, opacity: structured}} />
          ))}
        </span>
      ) : null}
      {children}
    </div>
  );
};

/** 编号签（单号雏形）：n 缺省 = 空白签（2-D 欲显未显）；ghost 0..1 虚化半透
 *  （3-B「拔掉编号」预告消融） */
export const NumberTag: React.FC<{n?: number; size?: number; color?: string; ghost?: number; dashed?: boolean}> = ({
  n,
  size = 44,
  color,
  ghost = 0,
  dashed = false,
}) => {
  const c = color ?? theme.mech;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        border: `2px ${dashed ? 'dashed' : 'solid'} ${c}`,
        background: n === undefined ? 'transparent' : `${c}22`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.mono,
        fontSize: size * 0.5,
        fontWeight: 700,
        color: c,
        opacity: 1 - 0.6 * ghost,
        boxShadow: `0 0 ${12 * (1 - ghost)}px ${c}44`,
      }}
    >
      {n === undefined ? '' : `${n}`}
    </div>
  );
};

/** 查表四节点链（名字→表→部件→参数递入）——1-B 执行段换装后的动作链。
 *  `step` 0..4：节点 i 在 step∈(i, i+1] 点亮，其出边在 step∈(i+0.5, i+1.5] 推进。 */
export const DispatchChain: React.FC<{x: number; y: number; w: number; step: number}> = ({x, y, w, step}) => {
  const NODES = [
    {label: '名字', sub: 'name'},
    {label: '表', sub: 'lookup'},
    {label: '部件', sub: 'handler'},
    {label: '参数', sub: 'input'},
  ];
  const seg = w / NODES.length;
  const cl = (v: number) => Math.min(1, Math.max(0, v));
  return (
    <svg width={w + 40} height={96} viewBox={`0 0 ${w + 40} 96`} style={{position: 'absolute', left: x, top: y, overflow: 'visible'}}>
      {NODES.map((nd, i) => {
        const cx = 20 + i * seg + seg / 2;
        const litN = cl(step - i);
        return (
          <g key={nd.sub}>
            {i < NODES.length - 1 ? (
              <line
                x1={cx + 24}
                y1={34}
                x2={cx + seg - 24}
                y2={34}
                stroke={theme.mech}
                strokeWidth={3}
                opacity={0.25 + 0.65 * cl(step - i - 0.5)}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - cl(step - i - 0.5)}
              />
            ) : null}
            <circle cx={cx} cy={34} r={9 + 3 * litN} fill={litN > 0.5 ? theme.mech : theme.bg} stroke={theme.mech} strokeWidth={3} opacity={0.35 + 0.65 * litN} />
            <text x={cx} y={72} textAnchor="middle" fontFamily={theme.sans} fontSize={22} fontWeight={600} fill={litN > 0.5 ? theme.text : theme.dim}>
              {nd.label}
            </text>
            <text x={cx} y={90} textAnchor="middle" fontFamily={theme.mono} fontSize={14} fill={theme.dim} opacity={0.8}>
              {nd.sub}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/** 门卡（生产版五道关）：琥珀描边拱形 + 编号圆牌 + 名牌（4-B 逐关点名亮字）。
 *  `passMark` 0..1 绿边过痕（4-B 方块过门各留一枚）。 */
export const GateCard: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  index: number;
  name?: string;
  sub?: string;
  lit: number;
  ghost?: number;
  passMark?: number;
}> = ({x, y, w, h, index, name, sub, lit, ghost = 0, passMark = 0}) => {
  const arcTop = 26;
  const doorPath = `M 8 ${h - 8} L 8 ${arcTop + 16} Q 8 8 ${w / 2} ${arcTop - 16} Q ${w - 8} 8 ${w - 8} ${arcTop + 16} L ${w - 8} ${h - 8}`;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: 1 - 0.72 * ghost}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <path
          d={doorPath}
          fill={lit > 0.4 ? `${theme.mech}14` : 'transparent'}
          stroke={theme.mech}
          strokeWidth={3.5}
          opacity={0.3 + 0.7 * lit}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - lit}
        />
        {/* 绿边过痕：门柱内侧一枚 ok 小方点（过门证据） */}
        {passMark > 0.5 ? (
          <rect x={w - 14} y={h - 30} width={10} height={10} rx={2} fill={theme.ok} opacity={0.9} />
        ) : null}
      </svg>
      {/* 编号圆牌 */}
      <div
        style={{
          position: 'absolute',
          left: w / 2 - 17,
          top: 4,
          width: 34,
          height: 34,
          borderRadius: 999,
          background: theme.bg,
          border: `2.5px solid ${lit > 0.5 ? theme.mech : theme.panelBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.mono,
          fontSize: 19,
          fontWeight: 700,
          color: lit > 0.5 ? theme.mech : theme.dim,
        }}
      >
        {index}
      </div>
      {name ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: h / 2 - 16, textAlign: 'center'}}>
          <div
            style={{
              fontFamily: theme.sans,
              fontSize: 27,
              fontWeight: 700,
              color: lit > 0.5 ? theme.text : theme.dim,
              opacity: lit,
            }}
          >
            {name}
          </div>
          {sub ? (
            <div style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 3, opacity: lit}}>{sub}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
