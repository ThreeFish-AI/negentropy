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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2–ep9 延续——
// LoopRing 描边色/线宽跨集恒定（theme.core = 陶土橙 #D97757 + RING_STROKE 6）
// = 逐字节拷贝的前提；Terminal/DispatchTable 本集无对应场景、不拷）
// （ep10 复制适配：环体缩悬上角/顶角与暗位——「调用模型前」时点暗点为本集挂点语义）

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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep9 逐字节
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

/** 环上坐标（-90 = 12 点；r 与 LoopRing 内圈同式 = size/2 - 46）——挂点位高亮、
 *  环外挂件的场景侧共用工式 */
export const ringPt = polar;

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep10 System Prompt）
// storyboard 实现映射登记：SectionCardStack / StateManifestCard / AssemblyFlow /
// CacheBadge / CharCounterRuler / DebtLedger / MessageBubble / PromptBar /
// SizeCompareBar（另设组装件 StatusPairWindows——跨场景复用的镜级构件，
// 不属分镜登记名）。
// 全片主装置 = 分段卡（mech=分段紫罗兰四块）+ 状态清单卡（sky=装配天蓝）双件
// 与拼装流（对照 ep2 对照表 / ep9 库体+索引页之地位）：分段卡 = 按主题维护的
// 说明块（拆解 morph / 独立点亮 / 拼装态状态机），状态清单卡 = 判据源（逐行
// 点亮 / 记忆行无→有翻新状态机），拼装流 = 清单说了算的流向（接通 / 拼·不拼
// 两态分支）。分段紫 / 清单蓝语义色恒定，缩微前后不重绘（scale 整体变换）。
// 消融对照（左红右绿）为 P3 主视觉、由场景排布（红 danger 左轨 / 绿 ok 右轨）。
// 哑装置原则承 ep4–ep9：动效参数（进度/状态/读数）一律经 prop 由调用场景注入，
// 本段零 motion hooks——「怎么动」归场景，「画什么」归此处。

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 双 hex 线性插值（长卡灰→分段紫 morph 描边；t 走场景 progress——effects 不吃弹簧） */
const mixHex = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (x: number): string => Math.round(x).toString(16).padStart(2, '0');
  const mix = (sh: number): number => ((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * t;
  return `#${ch(mix(16))}${ch(mix(8))}${ch(mix(0))}`;
};

/** 分段卡组长文本行（写死长卡 = 四主题块 mash——拆解后各行归属各卡，逐字不重绘）。
 *  行文案为关键词级短句，不复述口播（I-007 判据外）。 */
export const SECTION_ROWS: readonly {zh: string; en: string}[] = [
  {zh: '你是终端里的编程助手', en: 'identity'},
  {zh: '回答前先看目录', en: 'identity'},
  {zh: '改动要先解释', en: 'identity'},
  {zh: '可用：读文件 · 写文件', en: 'tools'},
  {zh: '可用：执行命令', en: 'tools'},
  {zh: '新工具要登记', en: 'tools'},
  {zh: '目录：/repo/demo', en: 'workspace'},
  {zh: '只在此目录内工作', en: 'workspace'},
  {zh: '产物写回该目录', en: 'workspace'},
  {zh: '记忆：暂无', en: 'memory'},
  {zh: '如有，在此追加', en: 'memory'},
];

/** 分段卡组（主装置·mech 分段紫罗兰——N 块纵向分段卡；N=4 本集主体、N=7 为
 *  P4 右栏/3-C 暗层预告形态）。`splitP` 0..1 拆解 morph（0=合并为写死长卡态：
 *  无内框无卡名、外框灰——与 P0 长卡同形；1=四卡分离齐立）；`tintP` 0..1 外框
 *  灰→紫（morph 期与 splitP 同拍推进，拆开两轨以便 1-D/5-A ghost 复用灰态）；
 *  `litP[i]` 0..1 各卡实色点亮（独立性判据——其余卡不受连坐）；`skipP[i]`
 *  0..1 该卡半透虚化（不拼——虚线框 + 降透明）；`pulseP[i]` 0..1 该卡改动脉冲
 *  （mech 辉光，场景传 sin 包络）；`ghostP` 0..1 整组灰调定格式（写死手稿缩微）。
 *  缩微驻位（1-D 左卡 / 3-C 暗层 / 4-A 双栏 / 5-A 收束）一律 scale 变换不重绘。 */
export const SectionCardStack: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  cards?: readonly {zh: string; en: string}[];
  rows?: readonly {zh: string; en: string}[];
  splitP?: number;
  tintP?: number;
  litP?: number[];
  skipP?: number[];
  pulseP?: number[];
  ghostP?: number;
  scale?: number;
  lit?: number;
  dim?: number;
}> = ({
  x,
  y,
  w,
  h,
  cards = [
    {zh: '身份', en: 'identity'},
    {zh: '工具', en: 'tools'},
    {zh: '工作目录', en: 'workspace'},
    {zh: '记忆', en: 'memory'},
  ],
  rows = SECTION_ROWS,
  splitP = 1,
  tintP = 1,
  litP = [],
  skipP = [],
  pulseP = [],
  ghostP = 0,
  scale = 1,
  lit = 1,
  dim = 0,
}) => {
  const split = clamp01(splitP);
  const tint = clamp01(tintP);
  const ghost = clamp01(ghostP);
  const frameStroke = mixHex(mixHex(theme.panelBorder, theme.mech, tint), theme.dim, ghost * 0.75);
  const gap = split * 18;
  const cardH = (h - gap * (cards.length - 1)) / cards.length;
  // 行按卡均分（SECTION_ROWS 11 行对 4 卡 = 3+3+3+2；N=7 时按比例切）
  const perCard = Math.floor(rows.length / cards.length);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: clamp01(lit) * (1 - dim),
        transform: `scale(${scale})`,
        transformOrigin: 'left top',
      }}
    >
      {cards.map((c, i) => {
        const litI = clamp01(litP[i] ?? 0);
        const skipI = clamp01(skipP[i] ?? 0);
        const pulseI = clamp01(pulseP[i] ?? 0);
        const top = i * (cardH + gap);
        const rowsI = rows.slice(i * perCard, i === cards.length - 1 ? rows.length : (i + 1) * perCard);
        return (
          <div
            key={c.en}
            style={{
              position: 'absolute',
              left: 0,
              top,
              width: w,
              height: cardH,
              boxSizing: 'border-box',
              borderRadius: 10,
              // 内框随 split 显形（合并态 = 无内框——写死长卡不分段）；skip 态转虚线
              border: `${2 + split}px ${skipI > 0.3 ? 'dashed' : 'solid'} ${frameStroke}`,
              background: withAlpha(theme.panel, 0.92 - 0.5 * skipI),
              opacity: 1 - 0.62 * skipI,
              overflow: 'hidden',
              boxShadow:
                pulseI > 0.03 || litI > 0.4
                  ? `0 0 ${(10 + 16 * Math.max(pulseI, litI - 0.4))}px ${withAlpha(theme.mech, 0.25 + 0.35 * Math.max(pulseI, litI - 0.4))}`
                  : 'none',
            }}
          >
            {/* 卡头：卡名 + 角标（split=0 合并态不显——长卡无名无段） */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                padding: `${Math.max(4, cardH * 0.07)}px 14px 0`,
                opacity: split,
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: Math.max(13, cardH * 0.13), fontWeight: 700, color: litI > 0.3 ? theme.mech : theme.dim}}>
                {c.zh}
              </span>
              <span style={{fontFamily: theme.mono, fontSize: Math.max(10, cardH * 0.1), color: withAlpha(theme.dim, 0.85)}}>{c.en}</span>
            </div>
            {/* 行文本：写死长卡态与分段态同一批 DOM（逐字连续 morph 的帧上判据） */}
            <div style={{padding: '2px 14px'}}>
              {rowsI.map((r) => (
                <div
                  key={r.zh}
                  style={{
                    fontFamily: theme.sans,
                    fontSize: Math.max(11, cardH * 0.115),
                    lineHeight: 1.5,
                    color: mixHex(theme.dim, theme.text, litI * (1 - ghost)),
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {r.zh}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {/* 合并态外框（写死长卡：单一灰框包全组；split 起即让位给各卡内框） */}
      {split < 0.985 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxSizing: 'border-box',
            borderRadius: 12,
            border: `3px solid ${frameStroke}`,
            background: 'transparent',
            pointerEvents: 'none',
            opacity: 1 - split * 0.65,
          }}
        />
      ) : null}
    </div>
  );
};

/** 状态清单卡（主装置·sky 装配天蓝——判据源）。两行清单：工具表注册行 /
 *  记忆文件有无行。`rowsLit` 0..2 实数行点亮；`memHas` 0..1 记忆行 无→有翻新
 *  （翻新拍 `flipP` 走 sin 白闪一拍即收）；`flash` 落定闪。缩微（2-A 走查 /
 *  3-A 右轨）scale 变换不重绘。 */
export const StateManifestCard: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  rowsLit?: number;
  memHas?: number;
  flipP?: number;
  flash?: number;
  scale?: number;
  lit?: number;
  dim?: number;
}> = ({x, y, w, h, rowsLit = 0, memHas = 0, flipP = 0, flash = 0, scale = 1, lit = 1, dim = 0}) => {
  const has = clamp01(memHas);
  const flip = clamp01(flipP);
  const r0 = clamp01(rowsLit);
  const r1 = clamp01(rowsLit - 1);
  const rowH = Math.min(64, (h - 64) / 2);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
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
          borderRadius: 12,
          border: `3px solid ${withAlpha(theme.sky, 0.55 + 0.45 * Math.max(r0, flash))}`,
          background: withAlpha(theme.panel, 0.96),
          boxShadow: `0 0 ${16 * flash}px ${withAlpha(theme.sky, 0.3 + 0.4 * flash)}`,
          position: 'relative',
          padding: '14px 18px',
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.mono, fontSize: 14, fontWeight: 700, color: theme.sky}}>{'context · 状态清单'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 11, color: withAlpha(theme.dim, 0.8)}}>{'真实状态'}</span>
        </div>
        <div style={{position: 'absolute', left: 18, right: 18, top: 48}}>
          {/* 行一：工具表注册 */}
          <div style={{height: rowH, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.35 + 0.65 * r0}}>
            <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, width: 64}}>{'工具表'}</span>
            <span
              style={{
                flex: 1,
                height: 30,
                boxSizing: 'border-box',
                borderRadius: 6,
                border: `2px ${r0 > 0.4 ? 'solid' : 'dashed'} ${withAlpha(theme.sky, 0.3 + 0.5 * r0)}`,
                background: withAlpha(theme.sky, 0.08 * r0),
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 10,
                fontFamily: theme.sans,
                fontSize: 15,
                fontWeight: 600,
                color: theme.text,
                whiteSpace: 'nowrap',
              }}
            >
              {r0 > 0.4 ? '已注册 · 读 写 执行' : ''}
            </span>
          </div>
          {/* 行二：记忆文件有无（无→有翻新——值区随 has 交叉淡换 + flip 白闪） */}
          <div style={{height: rowH, display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, opacity: 0.35 + 0.65 * r1}}>
            <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, width: 64}}>{'记忆文件'}</span>
            <span
              style={{
                flex: 1,
                height: 30,
                boxSizing: 'border-box',
                borderRadius: 6,
                border: `2px ${r1 > 0.4 ? 'solid' : 'dashed'} ${withAlpha(has > 0.5 ? theme.ok : theme.sky, 0.3 + 0.5 * r1)}`,
                background: withAlpha(has > 0.5 ? theme.ok : theme.sky, 0.08),
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 10,
                gap: 10,
                fontFamily: theme.sans,
                fontSize: 15,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{color: theme.dim, opacity: 1 - has}}>{'无'}</span>
              <span style={{color: has > 0.5 ? theme.ok : theme.text, opacity: has}}>{'有内容'}</span>
              {flip > 0.02 ? (
                <span style={{width: 8, height: 8, borderRadius: '50%', background: theme.sky, opacity: flip}} />
              ) : null}
            </span>
          </div>
        </div>
        {/* 翻新白闪（无→有整卡一拍） */}
        {flip > 0.01 && flip < 0.99 ? (
          <div style={{position: 'absolute', inset: -4, borderRadius: 14, background: withAlpha(theme.sky, 0.16 * flip), pointerEvents: 'none'}} />
        ) : null}
      </div>
    </div>
  );
};

/** 拼装流（清单→分段拼装流 + 拼/不拼两态分支——「清单说了算」的流向件）。
 *  `flowP` 0..1 主箭头自清单边描至分支点；`branchP` 0..1 两态分支显形；
 *  `skipP` 0..1 分支箭头压向「不拼」端（带值微例：记忆空 → 不拼）；坐标由
 *  场景传（判据源/拼装位各幕屏位不同，几何不锁死）。流色 sky 恒定。 */
export const AssemblyFlow: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  flowP?: number;
  branchP?: number;
  skipP?: number;
  lit?: number;
}> = ({x1, y1, x2, y2, flowP = 0, branchP = 0, skipP = 0, lit = 1}) => {
  const flow = clamp01(flowP);
  const branch = clamp01(branchP);
  const skip = clamp01(skipP);
  const midX = x1 + (x2 - x1) * 0.55;
  const forkY = y2 - 56;
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, opacity: clamp01(lit), pointerEvents: 'none'}}>
      {/* 主箭头（清单 → 分支点；pathLength 归一化描线） */}
      <line
        x1={x1}
        y1={y1}
        x2={midX}
        y2={forkY}
        stroke={theme.sky}
        strokeWidth={4}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - flow}
      />
      {flow > 0.95 ? <circle cx={midX} cy={forkY} r={7} fill={theme.sky} opacity={branch} /> : null}
      {/* 分支两态：拼（上，实色随 skip 降）/ 不拼（下，skip 起亮） */}
      {branch > 0.02 ? (
        <>
          <line
            x1={midX}
            y1={forkY}
            x2={x2}
            y2={y2 - 64}
            stroke={theme.sky}
            strokeWidth={skip > 0.4 ? 2.5 : 4}
            strokeLinecap="round"
            opacity={branch * (1 - 0.55 * skip)}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - branch}
          />
          <line
            x1={midX}
            y1={forkY}
            x2={x2}
            y2={y2 + 40}
            stroke={skip > 0.05 ? theme.sky : withAlpha(theme.dim, 0.75)}
            strokeWidth={skip > 0.05 ? 4 : 2.5}
            strokeDasharray={skip > 0.05 ? undefined : '6 6'}
            strokeLinecap="round"
            opacity={branch * (0.45 + 0.55 * skip)}
          />
        </>
      ) : null}
    </svg>
  );
};

/** 缓存徽标（确认绿 ok——拼装流出口/静态段挂件；1-C 与 4-C 同形复用）。
 *  `litP` 0..1 挂上（轮廓态→实体态）；`hitP` 0..1 命中亮（✓ 落定 + ok 辉光，
 *  场景传）；`breakP` 0..1 闪断（红边一拍——缓存失效，场景传 sin 包络）；
 *  `size` 缩放（4-C 特写放大走 scale 同形）。 */
export const CacheBadge: React.FC<{
  x: number;
  y: number;
  litP?: number;
  hitP?: number;
  breakP?: number;
  size?: number;
  scale?: number;
  label?: string;
}> = ({x, y, litP = 0, hitP = 0, breakP = 0, size = 64, scale = 1, label = '缓存'}) => {
  const on = clamp01(litP);
  const hit = clamp01(hitP);
  const brk = clamp01(breakP);
  const edge = brk > 0.02 ? mixHex(theme.ok, theme.danger, brk) : theme.ok;
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: on, transform: `scale(${scale})`, transformOrigin: 'center center'}}>
      <div
        style={{
          width: size,
          boxSizing: 'border-box',
          borderRadius: size * 0.2,
          border: `3px solid ${withAlpha(edge, 0.45 + 0.55 * Math.max(on, hit))}`,
          background: withAlpha(theme.panel, 0.95),
          padding: `${size * 0.09}px ${size * 0.16}px`,
          display: 'flex',
          alignItems: 'center',
          gap: size * 0.1,
          boxShadow: `0 0 ${(8 + 18 * hit) * on}px ${withAlpha(theme.ok, (0.15 + 0.45 * hit) * on)}`,
        }}
      >
        <svg width={size * 0.3} height={size * 0.3} viewBox="0 0 20 20">
          <path d="M 4 10.5 L 8.5 15 L 16 5" fill="none" stroke={edge} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.35 + 0.65 * Math.max(on, hit)} />
        </svg>
        <span style={{fontFamily: theme.sans, fontSize: size * 0.24, fontWeight: 700, color: hit > 0.4 ? theme.ok : theme.dim, whiteSpace: 'nowrap'}}>
          {label}
        </span>
      </div>
    </div>
  );
};

/** 字符计数器 + 基线标尺条（数字必带基线标尺——113/147/154 口径）。
 *  `value` 读数（场景 useCount 驱动，禁过冲弹簧）；`baseLine` 基线值与
 *  `baseLit` 基线标尺条立起（基线刻度恒常驻：读数变动时基线是对照锚）；
 *  `cells`/`cellsLit` 格阵增格（154 > 113 时增格可见）；`flash` 定格 punch。 */
export const CharCounterRuler: React.FC<{
  x: number;
  y: number;
  w: number;
  value?: number;
  unit?: string;
  baseLine?: number;
  baseLit?: number;
  cells?: number;
  cellsLit?: number;
  flash?: number;
  label?: string;
  lit?: number;
  scale?: number;
}> = ({x, y, w, value, unit = '字符', baseLine = 113, baseLit = 0, cells = 18, cellsLit = 0, flash = 0, label = '', lit = 1, scale = 1}) => {
  const cellW = Math.max(10, Math.min(30, (w - (cells - 1) * 4) / cells));
  const baseX = (baseLine / 154) * ((cells - 1) * (cellW + 4) + cellW);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: clamp01(lit), transform: `scale(${scale})`, transformOrigin: 'left top'}}>
      {label ? (
        <div style={{fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.dim, marginBottom: 6, whiteSpace: 'nowrap'}}>{label}</div>
      ) : null}
      {/* 格阵（拼装体量——cellsLit 实数增格） */}
      <div style={{display: 'flex', gap: 4, position: 'relative'}}>
        {Array.from({length: cells}, (_, i) => {
          const p = clamp01(cellsLit - i);
          return (
            <div
              key={`cc${i}`}
              style={{
                width: cellW,
                height: 20,
                borderRadius: 3,
                border: `2px solid ${p > 0.4 ? theme.mech : withAlpha(theme.panelBorder, 0.9)}`,
                background: p > 0.4 ? withAlpha(theme.mech, 0.26 + 0.2 * p) : 'transparent',
                opacity: 0.55 + 0.45 * Math.max(p, 0.25),
              }}
            />
          );
        })}
        {/* 基线标尺条（基线刻度竖线 + 签——读数变动的对照锚，恒常驻） */}
        <div style={{position: 'absolute', left: baseX + 1, top: -10, height: 40, opacity: clamp01(baseLit)}}>
          <div style={{width: 0, height: '100%', borderLeft: `3px dashed ${theme.sky}`}} />
          <div style={{position: 'absolute', left: 8, top: 16, fontFamily: theme.mono, fontSize: 13, fontWeight: 700, color: theme.sky, whiteSpace: 'nowrap'}}>
            {`基线 ${baseLine}`}
          </div>
        </div>
      </div>
      {/* 读数（场景闭合值——flash = 数字定格 punch 辉光） */}
      <div
        style={{
          marginTop: 8,
          fontFamily: theme.mono,
          fontSize: 32,
          fontWeight: 700,
          color: theme.text,
          fontVariantNumeric: 'tabular-nums',
          textShadow: flash > 0.05 ? `0 0 ${18 * clamp01(flash)}px ${withAlpha(theme.mech, 0.6)}` : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {value !== undefined ? `${value} ${unit}` : ''}
      </div>
    </div>
  );
};

/** 欠债清单（三格——不分段 / 不看状态 / 不缓存；警示红描边待点亮）。
 *  `cellsLit` 0..3 实数格点亮（stagger 由场景传）；`lit` 卡入场；`dim` 点亮后
 *  驻侧半透明（A#4 两句点亮即收、不剧场化）。 */
export const DebtLedger: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  cellsLit?: number;
  lit?: number;
  dim?: number;
}> = ({x, y, w, h, cellsLit = 0, lit = 1, dim = 0}) => {
  const NAMES = ['不分段', '不看状态', '不缓存'] as const;
  const cellH = (h - 56 - 2 * 10) / 3;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: clamp01(lit) * (1 - dim),
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: 12,
          border: `3px solid ${withAlpha(theme.danger, 0.5)}`,
          background: withAlpha(theme.panel, 0.94),
          position: 'relative',
          padding: '12px 16px',
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 14, fontWeight: 700, color: theme.danger}}>{'欠债清单 · 结构债'}</div>
        <div style={{position: 'absolute', left: 16, right: 16, top: 46}}>
          {NAMES.map((n, i) => {
            const p = clamp01(cellsLit - i);
            return (
              <div
                key={n}
                style={{
                  height: cellH,
                  marginBottom: 10,
                  boxSizing: 'border-box',
                  borderRadius: 8,
                  border: `2.5px ${p > 0.3 ? 'solid' : 'dashed'} ${withAlpha(theme.danger, 0.35 + 0.6 * p)}`,
                  background: p > 0.3 ? withAlpha(theme.danger, 0.1) : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 14,
                  gap: 10,
                  opacity: 0.45 + 0.55 * Math.max(p, 0.3),
                }}
              >
                <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.danger, opacity: p}}>{'✗'}</span>
                <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: p > 0.3 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{n}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** 闲聊消息条（tool 青碧——引语全文，走查输入数据本体；2-B/3-A 同形复用）。
 *  `lit` 显形；`hlP` 0..1 「记忆」二字高亮（3-A 左轨——误拼触发位）；位移/
 *  弹开由场景排布（`y` 由场景传）。引语 = 走查输入数据本体（caption-dup-ok
 *  登记于场景文件：消息条即演示对象本身，非画面复述口播）。 */
export const MessageBubble: React.FC<{
  x: number;
  y: number;
  w?: number;
  lit?: number;
  hlP?: number;
  scale?: number;
}> = ({x, y, w = 560, lit = 1, hlP = 0, scale = 1}) => {
  const hl = clamp01(hlP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: clamp01(lit), transform: `scale(${scale})`, transformOrigin: 'left top'}}>
      <div
        style={{
          boxSizing: 'border-box',
          borderRadius: 14,
          border: `3px solid ${withAlpha(theme.tool, 0.55 + 0.45 * Math.max(lit, hl))}`,
          background: withAlpha(theme.panel, 0.96),
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: hl > 0.05 ? `0 0 ${20 * hl}px ${withAlpha(theme.danger, 0.4 * hl)}` : 'none',
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 12, color: withAlpha(theme.dim, 0.85), whiteSpace: 'nowrap'}}>{'用户'}</span>
        <span style={{fontFamily: theme.sans, fontSize: 22, color: theme.text, whiteSpace: 'nowrap'}}>
          {'我对写这个模块毫无'}
          <span
            style={{
              fontWeight: 700,
              color: hl > 0.3 ? theme.danger : theme.text,
              background: withAlpha(theme.danger, 0.22 * hl),
              borderRadius: 4,
              padding: '0 2px',
              textShadow: hl > 0.3 ? `0 0 ${12 * hl}px ${withAlpha(theme.danger, 0.6)}` : 'none',
            }}
          >
            {'记忆'}
          </span>
        </span>
      </div>
    </div>
  );
};

/** 提示条（三态跨镜逐像素一致——同一形态再现即同形）。
 *  mode='grow'（0-B 加长轨）：灰段逐段贴上、整条重排、新旧段交界红叉——
 *   `segs` 段名数组、`segLit` 0..n 实数段落定、`reflowP` 重排拍、`conflictP`
 *   交界红叉闪（场景传包络）；
 *  mode='assembled'（1-B/1-D/2/3/4-A 拼装态）：紫罗兰分段块拼成一条——
 *   `chipsLit[i]` 各块滑入、`skipIdx`+`skipP` 该块半透虚化（不拼）、`misIdx`+
 *   `misP` 误拼块红染（3-A 左轨）、`hotP[i]` 该块实色点亮（2-C 记忆段到场）、
 *   `shakeP` 轻微抖动（3-B 被撬动）；
 *  mode='boundary'（4-C 分界线切分）：一条横贯提示条切「静态段｜动态段」两截
 *   ——`dropP` 切分线一次落下、`staticP` 静态/动态占比。 */
export const PromptBar: React.FC<{
  x: number;
  y: number;
  w: number;
  h?: number;
  mode: 'grow' | 'assembled' | 'boundary';
  segs?: string[];
  segLit?: number;
  reflowP?: number;
  conflictP?: number;
  chips?: readonly {zh: string; en?: string}[];
  chipsLit?: number[];
  skipIdx?: number;
  skipP?: number;
  misIdx?: number;
  misP?: number;
  hotP?: number[];
  shakeP?: number;
  dropP?: number;
  staticP?: number;
  lit?: number;
  dim?: number;
  scale?: number;
}> = ({
  x,
  y,
  w,
  h = 84,
  mode,
  segs = [],
  segLit = 0,
  reflowP = 0,
  conflictP = 0,
  chips = [],
  chipsLit = [],
  skipIdx = -1,
  skipP = 0,
  misIdx = -1,
  misP = 0,
  hotP = [],
  shakeP = 0,
  dropP = 0,
  staticP = 0.62,
  lit = 1,
  dim = 0,
  scale = 1,
}) => {
  const shake = clamp01(shakeP);
  const sx = shake > 0.02 ? Math.sin(shake * 40) * 5 * shake : 0;
  const growW = mode === 'grow' ? w : w;
  const chipW = chips.length > 0 ? (w - (chips.length - 1) * 10) / chips.length : w;
  return (
    <div
      style={{
        position: 'absolute',
        left: x + sx,
        top: y,
        width: growW,
        height: h,
        opacity: clamp01(lit) * (1 - dim),
        transform: `scale(${scale})`,
        transformOrigin: 'left top',
      }}
    >
      {mode === 'grow' ? (
        <div style={{position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box', borderRadius: 10, border: `2.5px solid ${withAlpha(theme.dim, 0.55)}`, background: withAlpha(theme.bg, 0.5), display: 'flex', alignItems: 'center', paddingLeft: 10, gap: 8, overflow: 'hidden'}}>
          {segs.map((s, i) => {
            const p = clamp01(segLit - i);
            if (p <= 0.02) {
              return null;
            }
            return (
              <span
                key={`g${i}`}
                style={{
                  padding: '8px 16px',
                  borderRadius: 7,
                  border: `2px solid ${withAlpha(theme.dim, 0.4 + 0.4 * p)}`,
                  background: withAlpha(theme.panel, 0.9),
                  fontFamily: theme.sans,
                  fontSize: 16,
                  color: theme.dim,
                  whiteSpace: 'nowrap',
                  opacity: 0.5 + 0.5 * p,
                  transform: `translateX(${(1 - p) * -14 - clamp01(reflowP) * Math.sin(i * 2.1) * 6}px)`,
                }}
              >
                {s}
              </span>
            );
          })}
          {/* 新旧段交界红叉（打架——一拍闪） */}
          {conflictP > 0.03 ? (
            <svg width={34} height={34} viewBox="0 0 34 34" style={{position: 'absolute', left: Math.min(w - 60, 40 + segs.length * 92 * clamp01(segLit / Math.max(1, segs.length))) , top: h / 2 - 17}}>
              <line x1={7} y1={7} x2={27} y2={27} stroke={theme.danger} strokeWidth={5} strokeLinecap="round" opacity={clamp01(conflictP)} />
              <line x1={27} y1={7} x2={7} y2={27} stroke={theme.danger} strokeWidth={5} strokeLinecap="round" opacity={clamp01(conflictP)} />
            </svg>
          ) : null}
        </div>
      ) : null}
      {mode === 'assembled' ? (
        <div style={{position: 'relative', width: '100%', height: '100%', display: 'flex', gap: 10}}>
          {chips.map((c, i) => {
            const p = clamp01(chipsLit[i] ?? 0);
            const isSkip = i === skipIdx && clamp01(skipP) > 0.02;
            const skip = isSkip ? clamp01(skipP) : 0;
            const mis = i === misIdx ? clamp01(misP) : 0;
            const hot = clamp01(hotP[i] ?? 0);
            if (p <= 0.02 && skip <= 0.02) {
              return null;
            }
            return (
              <div
                key={c.zh}
                style={{
                  width: chipW,
                  height: '100%',
                  boxSizing: 'border-box',
                  borderRadius: 9,
                  border: `3px ${skip > 0.3 ? 'dashed' : 'solid'} ${mis > 0.3 ? theme.danger : withAlpha(theme.mech, 0.4 + 0.6 * Math.max(p, skip, hot))}`,
                  background: mis > 0.02 ? withAlpha(theme.danger, 0.1 + 0.1 * mis) : withAlpha(theme.mech, 0.1 + 0.14 * p + 0.1 * hot),
                  opacity: p * (1 - 0.62 * skip),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  transform: `translateY(${(1 - p) * 26}px)`,
                  boxShadow: mis > 0.3 ? `0 0 ${16 * mis}px ${withAlpha(theme.danger, 0.45)}` : hot > 0.3 ? `0 0 ${14 * hot}px ${withAlpha(theme.mech, 0.4)}` : 'none',
                }}
              >
                <span style={{fontFamily: theme.sans, fontSize: Math.min(21, h * 0.24), fontWeight: 700, color: skip > 0.3 ? theme.dim : theme.text, whiteSpace: 'nowrap'}}>{c.zh}</span>
                {c.en ? (
                  <span style={{fontFamily: theme.mono, fontSize: Math.min(12, h * 0.13), color: withAlpha(theme.dim, 0.85), whiteSpace: 'nowrap'}}>{c.en}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {mode === 'boundary' ? (
        <div style={{position: 'relative', width: '100%', height: '100%'}}>
          {/* 静态段（左——全局缓存挂位） */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: w * staticP,
              height: '100%',
              boxSizing: 'border-box',
              borderRadius: 10,
              border: `3px solid ${withAlpha(theme.ok, 0.65)}`,
              background: withAlpha(theme.ok, 0.07),
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 18,
              gap: 12,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.ok, whiteSpace: 'nowrap'}}>{'静态段'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 12, color: withAlpha(theme.dim, 0.85), whiteSpace: 'nowrap'}}>{'不变前缀'}</span>
          </div>
          {/* 动态段（右——每轮变化；不挂缓存徽标） */}
          <div
            style={{
              position: 'absolute',
              left: w * staticP + 14,
              right: 0,
              top: 0,
              height: '100%',
              boxSizing: 'border-box',
              borderRadius: 10,
              border: `3px dashed ${withAlpha(theme.sky, 0.6)}`,
              background: withAlpha(theme.sky, 0.05),
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 18,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.sky, whiteSpace: 'nowrap'}}>{'动态段'}</span>
          </div>
          {/* 分界线（一次落下——重音镜；dropP 走场景 spring/progress） */}
          <div
            style={{
              position: 'absolute',
              left: w * staticP + 2,
              top: -18 - 10 * (1 - clamp01(dropP)),
              width: 5,
              bottom: 0,
              background: theme.text,
              borderRadius: 3,
              opacity: clamp01(dropP),
              boxShadow: `0 0 ${12 * clamp01(dropP)}px ${withAlpha(theme.text, 0.5)}`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

/** 体量对比条（4-D——双端增长条 + 数量级标尺；数据本体禁过冲）。
 *  `longP` 0..1 长端攀升（标准形态 · 两三万字节——约数区间呈现）；`shortP`
 *  0..1 短端落定（极简形态 · 一百五十来个字符——保底可读宽 + 精确值旁标）；
 *  `magP` 0..1 ×100 数量级档位差点亮（两枚刻度标尺）。 */
export const SizeCompareBar: React.FC<{
  x: number;
  y: number;
  w: number;
  longP?: number;
  shortP?: number;
  magP?: number;
  lit?: number;
}> = ({x, y, w, longP = 0, shortP = 0, magP = 0, lit = 1}) => {
  const long = clamp01(longP);
  const short = clamp01(shortP);
  const mag = clamp01(magP);
  const longW = w * long;
  // 短端保底可读（40px 起）+ 落定微展——与满幅长端的比例悬殊仍一目了然
  const shortW = 40 + 66 * short;
  const barH = 46;
  const gapY = 70;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: clamp01(lit)}}>
      {/* 长端：标准形态（攀升至满幅——约数区间呈现，不精确化） */}
      <div style={{position: 'relative', height: barH}}>
        <div style={{position: 'absolute', left: 0, top: 0, height: '100%', width: '100%', boxSizing: 'border-box', borderRadius: 9, border: `2.5px solid ${withAlpha(theme.dim, 0.35)}`}} />
        <div style={{position: 'absolute', left: 0, top: 0, height: '100%', width: longW, borderRadius: 9, background: `repeating-linear-gradient(90deg, ${withAlpha(theme.mech, 0.5)} 0 24px, ${withAlpha(theme.mech, 0.24)} 24px 32px)`}} />
        <div style={{position: 'absolute', left: 16, top: 9, fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
          {'标准形态 · 两三万字节'}
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginLeft: 10}}>{'≈ 20–30 KB（约数）'}</span>
        </div>
      </div>
      {/* 短端：极简形态（保底可读宽 + 精确值旁标） */}
      <div style={{position: 'relative', height: barH, marginTop: gapY - barH - 24}}>
        <div style={{position: 'absolute', left: 0, top: 0, height: '100%', width: shortW, boxSizing: 'border-box', borderRadius: 9, border: `2.5px solid ${theme.sky}`}} />
        <div style={{position: 'absolute', left: shortW + 16, top: 9, fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>
          {'极简形态 · 一百五十来个字符'}
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginLeft: 10}}>{'~150 chars（角标 CLAUDE_CODE_SIMPLE）'}</span>
        </div>
      </div>
      {/* 数量级标尺（×1 / ×100 两档刻度——magP 压上时 ×100 档位差点亮） */}
      <div style={{position: 'relative', marginTop: 34, height: 40}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 20, height: 0, borderTop: `2.5px solid ${withAlpha(theme.dim, 0.5)}`}} />
        {[0, 1].map((k) => (
          <div key={`mag${k}`} style={{position: 'absolute', left: `${k * 100}%`, top: 8, opacity: k === 0 ? 0.9 : mag}}>
            <div style={{width: 0, height: 26, borderLeft: `3px solid ${k === 0 ? withAlpha(theme.dim, 0.8) : theme.ok}`}} />
            <div
              style={{
                position: 'absolute',
                left: k === 0 ? 8 : -46,
                top: 26,
                fontFamily: theme.mono,
                fontSize: 15,
                fontWeight: 700,
                color: k === 0 ? theme.dim : theme.ok,
                whiteSpace: 'nowrap',
                textShadow: k === 1 && mag > 0.3 ? `0 0 ${12 * mag}px ${withAlpha(theme.ok, 0.5)}` : 'none',
              }}
            >
              {k === 0 ? '×1' : '×100'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/** 状态小窗对（0-A/5-A 同形复现——工具表窗 + 记忆文件窗两格；「状态变了，
 *  写死的长卡不知道」的对照件）。`toolNewP` 工具表窗新行亮（工具新了）；
 *  `memOnP` 记忆文件窗图标亮（记忆有了）；`stepP` 5-A 兑现拍——工具窗再进
 *  一行、记忆窗内容条显现（窗在变化而长卡同步跟动——首尾对照的「窗侧」）。 */
export const StatusPairWindows: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  lit?: number;
  toolNewP?: number;
  memOnP?: number;
  stepP?: number;
}> = ({x, y, w = 300, h = 190, lit = 1, toolNewP = 0, memOnP = 0, stepP = 0}) => {
  const tn = clamp01(toolNewP);
  const mo = clamp01(memOnP);
  const st = clamp01(stepP);
  const winH = (h - 16) / 2;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: clamp01(lit)}}>
      {/* 工具表窗 */}
      <div
        style={{
          width: '100%',
          height: winH,
          boxSizing: 'border-box',
          borderRadius: 10,
          border: `2.5px solid ${withAlpha(theme.tool, 0.4 + 0.5 * Math.max(tn, st))}`,
          background: withAlpha(theme.panel, 0.94),
          padding: '10px 14px',
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'工具表'}</span>
        <div style={{marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6}}>
          {['读文件', '写文件', '执行命令'].map((t, i) => (
            <div
              key={t}
              style={{
                height: 22,
                borderRadius: 5,
                border: `2px solid ${withAlpha(theme.panelBorder, 0.95)}`,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 8,
                fontFamily: theme.sans,
                fontSize: 13,
                color: theme.dim,
                whiteSpace: 'nowrap',
              }}
            >
              {t}
            </div>
          ))}
          {/* 新行（工具新了——亮起：tn 首拍 / st 兑现拍再进一行） */}
          <div
            style={{
              height: 22,
              borderRadius: 5,
              border: `2px solid ${withAlpha(theme.tool, 0.4 + 0.6 * Math.max(tn, st))}`,
              background: withAlpha(theme.tool, 0.12 * Math.max(tn, st)),
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 8,
              fontFamily: theme.sans,
              fontSize: 13,
              color: theme.tool,
              whiteSpace: 'nowrap',
              opacity: Math.max(tn, st),
            }}
          >
            {st > 0.5 ? '联网检索 · 新' : '联网检索'}
          </div>
        </div>
      </div>
      {/* 记忆文件窗 */}
      <div
        style={{
          width: '100%',
          height: winH,
          marginTop: 16,
          boxSizing: 'border-box',
          borderRadius: 10,
          border: `2.5px solid ${withAlpha(theme.mech, 0.4 + 0.5 * Math.max(mo, st))}`,
          background: withAlpha(theme.panel, 0.94),
          padding: '10px 14px',
          position: 'relative',
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'记忆文件'}</span>
        {/* 文件图标（暗位 → 亮起；兑现拍加内容条） */}
        <svg width={44} height={54} viewBox="0 0 44 54" style={{overflow: 'visible', marginTop: 4, filter: `drop-shadow(0 0 ${8 * Math.max(mo, st)}px ${withAlpha(theme.mech, 0.5)})`}}>
          <path d="M 6 3 L 30 3 L 38 11 L 38 51 L 6 51 Z" fill={withAlpha(theme.panel, 0.97)} stroke={withAlpha(theme.mech, 0.35 + 0.65 * Math.max(mo, st))} strokeWidth={3} strokeLinejoin="round" />
          <path d="M 30 3 L 30 11 L 38 11" fill="none" stroke={withAlpha(theme.mech, 0.35 + 0.65 * Math.max(mo, st))} strokeWidth={3} strokeLinejoin="round" />
          <line x1={12} y1={22} x2={32} y2={22} stroke={withAlpha(theme.mech, 0.55)} strokeWidth={3} strokeLinecap="round" opacity={Math.max(mo, st)} />
          <line x1={12} y1={30} x2={26} y2={30} stroke={withAlpha(theme.mech, 0.4)} strokeWidth={3} strokeLinecap="round" opacity={st} />
        </svg>
        {/* 无/有内容签（mo：无 → st：有内容） */}
        <span
          style={{
            position: 'absolute',
            right: 14,
            bottom: 12,
            fontFamily: theme.sans,
            fontSize: 13,
            fontWeight: 700,
            color: st > 0.5 ? theme.mech : theme.dim,
            whiteSpace: 'nowrap',
          }}
        >
          {st > 0.5 ? '有内容' : '无'}
        </span>
      </div>
    </div>
  );
};
