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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2–ep14 延续——
// LoopRing 描边色/线宽跨集恒定（theme.core = 陶土橙 #D97757 + RING_STROKE 6）
// = 逐字节拷贝的前提。本集契约（storyboard 前言）：主代理环体恒 core 描边；
// 本集首次出现**多枚同款环体并列**——队友环体走 bespoke 件 TeammateRing
// （同尺寸同转速同线宽、仅描边色换 theme.mate），LoopRing 本体只演主代理橙
// 环；全片场景一律 `nodes={[]}`（环体即循环本体，无站点标注态）、状态色一律
// 经容器透明度承载（描边契约不动）。

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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep14 逐字节
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
 *  环外挂件（注入口 / 回合窗）的场景侧共用工式 */
export const ringPt = polar;

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep15 Agent Teams）
// storyboard 实现映射登记：MailboxFile / TeammateRing / ContrastStrip /
// ToolBeltBar / RoundCapBar / RetryBar / ProbePulse / PermBubble / AblationSplit。
// 全片主装置 = 信箱文件（inbox 湛蓝：追加一行逐字落格 / 整摞取走即清空 / 待取
// 辉光 / 锁扣）＋ 多环并列母题（LoopRing core 橙主环 + TeammateRing mate 品红
// 同款副本，同尺寸同转速仅描边色区分）。反例/退化走 danger（共用对话渗染 /
// 双入口抓空 / 左轨「待处理」卡死）；机制在位/办成落定走 ok（右轨对号 ×2 /
// 权限放行一闪）。哑装置原则承 ep4–ep14：动效参数（进度/状态/读数）一律经
// prop 由调用场景注入，装置自身零 motion hook 调用（几何/条件内纯函数推进）。

const clamp01v = (v: number) => Math.min(1, Math.max(0, v));

const withAlphaM = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01v(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 本集舞台全局位（storyboard「全景坐标锚」：0-A 环体居中全局位 = 2-A 编队
 *  主环位 = 4-A 拓扑主环位——跨镜同位即 continuity；1-D 空坐席签位 = 2-A
 *  品红环体亮起位的右席） */
export const STAGE = {
  /** 主环全局位（0-A 居中缓转被压 / 2-A 编队居中 / 4-A 拓扑居中） */
  ring: {x: 760, y: 250, size: 400},
  /** 两侧队友坐席位（2-A 品红环亮起位；1-D 空坐席签挂右席侧） */
  mates: [
    {x: 130, y: 250, size: 400},
    {x: 1390, y: 250, size: 400},
  ],
} as const;

/** 队友环体（品红同款副本——与 LoopRing 同几何（r = size/2 - 46）、同线宽
 *  （RING_STROKE）、同光点（r 11）的环体，仅描边色换 `stroke`（默认
 *  theme.mate）。「循环没换、只是多了几条」：调用侧与主环共用同一
 *  secPerLap / 相位喂 dotProgress，同尺寸同转速即同款语义；draw 0→1 描线
 *  进度 = 自坐席亮起（2-A 掷光弧后的起环）。 */
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

/** 信箱文件（本集主装置——对照表之于 ep2 的地位）。全片同形约束：文件体 +
 *  文件名角标 + 湛蓝描边跨镜恒定、缩微前后不重绘（4-A 锁扣为唯一新增部件）。
 *  `litP` 显形；`rows` 箱内条目数（整摞的「摞」）；`appendP` 追加一行逐字落格
 *  （0..1——末行按字符比例显现，发信语义①）；`takeP` 整摞打包升起离箱
 *  （0..1——收信语义②，箱内归零由调用侧切 rows=0 承载）；`glowP` 待取辉光
 *  （外发光呼吸系数 0..1）；`count` 计数角标（-1 不显；3-D 翻 0 用）；
 *  `lockP` 箱角锁扣（4-A 生产生长位 0..1 扣上）；`scanP` 探测光扫过箱面
 *  （0..1 单程，只看不取——扫过不停留）。 */
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
      {/* 待取辉光（呼吸系数经 glowP 注入——外发光不打进描边契约） */}
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
      {/* 文件体（湛蓝描边 + 文件折角——「磁盘上的普通文件」） */}
      <div
        style={{
          position: 'relative',
          height: h,
          borderRadius: 14,
          border: `3px solid ${withAlphaM(theme.inbox, 0.85)}`,
          background: withAlphaM(theme.panel, 0.97),
        }}
      >
        {/* 文件名角标（顶部条——mono 文件名，全片同形） */}
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
        {/* 箱内条目（整摞——takeP>0 时整摞打包升起离箱，非逐条） */}
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
        {/* 追加一行（逐字落格——发信语义①：写字端逐字显现，非一次成行） */}
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
        {/* 整摞取走的离箱轨迹（条目堆打包升起——收信语义②；落点由场景侧叠加） */}
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
        {/* 探测光扫过箱面（只看不取——单程扫过不停留，scanP 0..1） */}
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
        {/* 计数角标（右上 mono——3-D 「再查信箱：零条」翻 0 读数位） */}
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
        {/* 锁扣（4-A 生产生长位——唯一新增部件；lockP 0..1 扣上） */}
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

/** 等高对照条（2-C 上带——「两种组法」构图纪律 X-001：左右栏等高、分工对照
 *  非优劣裁决）。`litP` 显形；`leftP`/`rightP` 左右栏各自点亮（0..1）。 */
export const ContrastStrip: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  leftP?: number;
  rightP?: number;
}> = ({x, y, w = 1560, h = 300, litP = 1, leftP = 0, rightP = 0}) => {
  const lit = clamp01v(litP);
  const lp = clamp01v(leftP);
  const rp = clamp01v(rightP);
  const colW = (w - 40) / 2;
  const col = (p: number, title: string, lines: string[], on: string) => (
    <div
      style={{
        width: colW,
        height: h,
        borderRadius: 14,
        border: `3px solid ${p > 0.3 ? withAlphaM(on, 0.85) : withAlphaM(theme.panelBorder, 0.9)}`,
        background: withAlphaM(theme.panel, 0.96),
        padding: '22px 30px',
        opacity: 0.55 + 0.45 * p,
      }}
    >
      <div style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 700, color: p > 0.3 ? on : theme.dim, whiteSpace: 'nowrap'}}>
        {title}
      </div>
      {lines.map((ln, i) => (
        <div key={`cs${i}`} style={{fontFamily: theme.sans, fontSize: 21, color: theme.text, marginTop: 12, whiteSpace: 'nowrap', opacity: 0.9}}>
          {ln}
        </div>
      ))}
    </div>
  );
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: lit, display: 'flex', gap: 40}}>
      {col(lp, '子代理 · 一次性', ['用完即走', '过程隔离，只回结论'], theme.dim)}
      {col(rp, '队友 · 一直活着', ['随时收信', '并行执行流，同款循环'], theme.mate)}
    </div>
  );
};

/** 工具计数条（2-C 下带——主代理工具集 11→14：格位可数、两档跳变与口播数字
 *  一致。「计数渲染 Math.round 直取」红线：countP <0.5 → 11 格、≥0.5 → 14 格
 *  （两档，非连续滚动）。`litP` 显形；`countP` 跳格进度。 */
export const ToolBeltBar: React.FC<{
  x: number;
  y: number;
  w?: number;
  litP?: number;
  countP?: number;
}> = ({x, y, w = 1560, litP = 1, countP = 0}) => {
  const lit = clamp01v(litP);
  const total = 14;
  const base = 11;
  const count = clamp01v(countP) < 0.5 ? base : total;
  const gap = 6;
  const cw = (w - (total - 1) * gap) / total;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: lit}}>
      <div style={{display: 'flex', gap, height: 40, alignItems: 'center'}}>
        {Array.from({length: total}, (_, i) => {
          const old = i < base;
          const on = i < count;
          return (
            <span
              key={`tb${i}`}
              style={{
                width: cw,
                height: 34,
                borderRadius: 4,
                background: on ? (old ? withAlphaM(theme.dim, 0.5) : withAlphaM(theme.mate, 0.55)) : 'transparent',
                border: `2px solid ${on ? (old ? withAlphaM(theme.dim, 0.8) : theme.mate) : withAlphaM(theme.panelBorder, 0.9)}`,
              }}
            />
          );
        })}
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 30,
            fontVariantNumeric: 'tabular-nums',
            color: theme.text,
            marginLeft: 18,
            whiteSpace: 'nowrap',
          }}
        >
          {`${count} 件`}
        </span>
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 8, whiteSpace: 'nowrap'}}>
        {'主代理工具集 · 11 → 14（+拉队友 / 发消息 / 查信箱）'}
      </div>
    </div>
  );
};

/** 十格带共用内件（RoundCapBar 队友十轮带与 RetryBar 锁重试带同构——
 *  分镜 4-B「同构不同装置：锁重试 ≠ 轮次上限，角标区分」的落地：格位全暗
 *  起步（上限未动用 / 未撞满十次），基线标尺 + 工况角标经 `label` 注入） */
const TenCellStrip: React.FC<{x: number; y: number; w?: number; litP?: number; label: string}> = ({x, y, w = 800, litP = 1, label}) => {
  const lit = clamp01v(litP);
  const n = 10;
  const gap = 5;
  const cw = (w - (n - 1) * gap) / n;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: lit}}>
      <div style={{display: 'flex', gap, height: 40}}>
        {Array.from({length: n}, (_, i) => (
          <span
            key={`tc${i}`}
            style={{
              width: cw,
              height: 40,
              borderRadius: 3,
              background: 'transparent',
              border: `2px solid ${withAlphaM(theme.dim, 0.42)}`,
            }}
          />
        ))}
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginTop: 8, whiteSpace: 'nowrap'}}>
        <span>{'0'}</span>
        <span>{label}</span>
        <span>{'10'}</span>
      </div>
    </div>
  );
};

/** 十格轮次带（2-B——队友教学版轮次上限，基线标尺：十格全暗 + 工况角标） */
export const RoundCapBar: React.FC<{x: number; y: number; w?: number; litP?: number}> = ({x, y, w, litP}) => (
  <TenCellStrip x={x} y={y} w={w} litP={litP} label={'教学版上限 10 轮 · range(10)'} />
);

/** 十格锁重试带（4-B——写信文件锁的重试上限，与轮次带同构不同角标） */
export const RetryBar: React.FC<{x: number; y: number; w?: number; litP?: number}> = ({x, y, w, litP}) => (
  <TenCellStrip x={x} y={y} w={w} litP={litP} label={'锁重试上限 10 次 · proper-lockfile'} />
);

/** 每秒探测脉冲（3-B ECU——信箱上方湛蓝脉冲环，节拍器节奏恒定每秒一拍、
 *  零强调动效〔M-002〕）。`tick` 秒相位 0..1（调用侧 `(frame % 30) / 30`
 *  喂——匀速点亮即一拍）；`litP` 显形；`labelP` 「只看不取」标签闪现；
 *  `wakeP` 唤醒连线点亮（暗态 → 亮，单向）。 */
export const ProbePulse: React.FC<{
  x: number;
  y: number;
  r?: number;
  litP?: number;
  tick?: number;
  labelP?: number;
}> = ({x, y, r = 56, litP = 1, tick = 0, labelP = 0}) => {
  const lit = clamp01v(litP);
  const t = ((tick % 1) + 1) % 1;
  const label = clamp01v(labelP);
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: lit}}>
      <svg width={r * 2 + 120} height={r * 2 + 40} viewBox={`0 0 ${r * 2 + 120} ${r * 2 + 40}`} style={{overflow: 'visible'}}>
        {/* 脉冲本体（每秒一拍：中心点恒亮微光 + 一圈匀速扩散环） */}
        <circle cx={r + 20} cy={r + 20} r={14} fill={theme.inbox} opacity={0.85} />
        <circle cx={r + 20} cy={r + 20} r={20 + t * r * 0.9} fill="none" stroke={withAlphaM(theme.inbox, 0.75 * (1 - t))} strokeWidth={4} />
        <circle cx={r + 20} cy={r + 20} r={r} fill="none" stroke={withAlphaM(theme.inbox, 0.3)} strokeWidth={2} strokeDasharray="4 8" />
      </svg>
      {/* 「只看不取」标签（承袭语义③——闪现一拍随词锚） */}
      <div
        style={{
          position: 'absolute',
          left: r * 2 + 46,
          top: r + 2,
          padding: '6px 16px',
          borderRadius: 9,
          border: `2.5px solid ${withAlphaM(theme.inbox, 0.8)}`,
          background: withAlphaM(theme.panel, 0.96),
          fontFamily: theme.sans,
          fontSize: 19,
          fontWeight: 700,
          color: theme.inbox,
          whiteSpace: 'nowrap',
          opacity: label,
        }}
      >
        {'只看不取'}
      </div>
    </div>
  );
};

/** 审批请求泡（4-C 权限冒泡四步链的载体——品红泡体 + 「删文件」动作签）。
 *  `litP` 泡体显形；`signP` 动作签贴泡面（0..1）；泡的位移（升起 / 沉回）
 *  由调用场景以 transform 驱动（四步次序 = 口播次序，装置只承载泡形）。 */
export const PermBubble: React.FC<{litP?: number; signP?: number; size?: number}> = ({litP = 1, signP = 0, size = 120}) => {
  const lit = clamp01v(litP);
  const sign = clamp01v(signP);
  const c = size / 2;
  return (
    <div style={{position: 'relative', width: size, height: size, opacity: lit}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow: 'visible'}}>
        {/* 泡体（品红描边 + 内微光——「请求像气泡」） */}
        <circle cx={c} cy={c - 8} r={c - 18} fill={withAlphaM(theme.mate, 0.16)} stroke={theme.mate} strokeWidth={4} />
        <circle cx={c - (c - 18) * 0.35} cy={c - 8 - (c - 18) * 0.4} r={7} fill={withAlphaM(theme.mate, 0.5)} />
        {/* 泡尾（下向——冒泡方向：自队友环体升起） */}
        <path d={`M ${c - 12} ${c + size * 0.28} l 12 16 l 12 -16`} fill="none" stroke={theme.mate} strokeWidth={3.5} strokeLinecap="round" />
      </svg>
      {/* 动作签（贴泡面——「比如删个文件」的具体输入值，关键词签） */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: c - 6,
          transform: `translateX(-50%) translateY(${(1 - sign) * 8}px)`,
          padding: '5px 14px',
          borderRadius: 8,
          border: `2.5px solid ${withAlphaM(theme.danger, 0.8)}`,
          background: withAlphaM(theme.panel, 0.97),
          fontFamily: theme.sans,
          fontSize: 18,
          fontWeight: 700,
          color: theme.text,
          whiteSpace: 'nowrap',
          opacity: sign,
        }}
      >
        {'删文件'}
      </div>
    </div>
  );
};

/** 消融双轨骨架（3-D/3-E 全片张力峰值——左红右绿恒定：左「放工具直读」退化
 *  轨 / 右「入口统一」正例轨；等高并置同题裁决）。`litP` 双轨立起显形。
 *  轨内容（迷你环体编队 / 信箱 / 关机单状态格 / 回音位）由调用场景按
 *  LANE 常量摆位——装置只承载轨道背板 + 轨头标签（左右语义色恒定）。 */
export const ABLATION_LANES = {
  left: {x: 110, y: 150, w: 800, h: 700},
  right: {x: 1010, y: 150, w: 800, h: 700},
} as const;

export const AblationSplit: React.FC<{litP?: number; leftP?: number; rightP?: number}> = ({litP = 1, leftP = 0, rightP = 0}) => {
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
      {lane(ABLATION_LANES.left, leftP, theme.danger, '放工具直读', 'check_inbox 直读')}
      {lane(ABLATION_LANES.right, rightP, theme.ok, '入口统一', 'consume_lead_inbox')}
    </>
  );
};
