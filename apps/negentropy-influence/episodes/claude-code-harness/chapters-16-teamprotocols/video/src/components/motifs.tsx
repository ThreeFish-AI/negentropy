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

/** 底部角标——统一压在 bottom ≥ 176（避让字幕条，references/08 红线二；
 *  长文本角标走场景内 bottom ≥ 210 加缓冲） */
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
        bottom: 176,
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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2–ep15 延续——
// LoopRing 描边色/线宽跨集恒定（theme.core = 陶土橙 #D97757 + RING_STROKE 6）
// = 逐字节拷贝的前提。本集契约（storyboard 前言）：主代理环体恒 core 描边；
// 多枚同款环体并列承 ep15——队友环体走 bespoke 件 TeammateRing（同尺寸同转速
// 同线宽、仅描边色换 theme.mate），LoopRing 本体只演主代理橙环；全片场景一律
// `nodes={[]}`（环体即循环本体，无站点标注态）、状态色一律经容器透明度承载
// （描边契约不动）。

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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep15 逐字节
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
 *  环外挂件（「轮末查信」挂点段 / 回流线端点）的场景侧共用工式 */
export const ringPt = polar;

/** 环上「轮末查信」挂点段（1-A 暗色微光位 = 4-B 点亮位 = 5-A 仍亮位——
 *  段位角恒定：环右侧 ≈ -8°..30°，跨镜同位即挂点身份恒常；storyboard 契约：
 *  自 4-B 点亮起全片锁定） */
export const INBOX_HOOK_DEG = {from: -8, to: 30} as const;
const HOOK_STROKE_W = 10;

/** 弧 path（度数→SVG arc——挂点段专用，起于 from 终于 to 顺时针） */
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

/** 挂点段弧（暗色微光提示 / 点亮高亮两态——`litP` 0=暗提示 1=全亮锁定）。
 *  与 LoopRing 同几何（r = size/2 - 46）叠放使用。 */
export const HookArc: React.FC<{size: number; litP: number}> = ({size, litP}) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 46;
  const lit = clamp01v(litP);
  const tone = lit > 0.3 ? theme.core : theme.dim;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <path
        d={describeArc(cx, cy, r, INBOX_HOOK_DEG.from, INBOX_HOOK_DEG.to)}
        fill="none"
        stroke={tone}
        strokeWidth={HOOK_STROKE_W}
        strokeLinecap="round"
        opacity={0.25 + 0.75 * lit}
      />
      {lit > 0.3 ? (
        <text
          {...ringPt(cx, cy, r + 34, 11)}
          textAnchor="start"
          fontFamily={theme.sans}
          fontSize={Math.max(15, Math.round(size * 0.058))}
          fontWeight={700}
          fill={theme.core}
          opacity={lit}
        >
          轮末查信
        </text>
      ) : null}
    </svg>
  );
};

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep16 Team Protocols）
// storyboard 实现映射登记：RegistryTable / NumberBadge / StatePill /
// RequestCard / ReplyCard / ReceiptBook / CheckGateBar / AblationSplit /
// InboxSlot（MailboxFile 承 ep15）/ MessageGrid / GateContrast / CrackIcon /
// StepSign / RewriteCounter。全片主装置 = 登记表（req 靛蓝：落行/翻状态/长新行/
// 缩微/收胶囊）＋ 142 号徽章对签（请求卡/回执卡/表行三处同号流转＝流转主线）。
// 回执落定/销账拍走 receipt 兰紫；反例/退化走 danger；机制在位/拦截成功走 ok；
// 三态语义：待处理 = dim（中性蓝灰——底座 dim 即蓝灰系）/ 已批准 = ok /
// 已拒绝 = danger（系列保留语义色，不可占用）。哑装置原则承 ep15：动效参数
// （进度/状态/读数）一律经 prop 由调用场景注入，装置自身零 motion hook 调用
// （几何/条件内纯函数推进）。

const clamp01v = (v: number) => Math.min(1, Math.max(0, v));

const withAlphaM = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01v(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 三态语义色（全片恒定）：pending=中性蓝灰(dim) / approved=ok / rejected=danger */
export const STATE_TONE = {
  pending: theme.dim,
  approved: theme.ok,
  rejected: theme.danger,
} as const;
export type TriState = keyof typeof STATE_TONE;
export const STATE_LABEL: Record<TriState, string> = {
  pending: '待处理',
  approved: '已批准',
  rejected: '已拒绝',
};

/** 本集舞台全局位（storyboard「全景坐标锚」：0-A 三环编队全局位 = 4-A 编队
 *  全局位——跨镜同位即 continuity；承 ep15 STAGE 同值（编队同款签名）） */
export const STAGE = {
  /** 主环全局位（0-A 居中缓转 / 4-A 编队居中） */
  ring: {x: 760, y: 210, size: 400},
  /** 两侧队友坐席位（0-A 品红环并列位——承 ep15 同款） */
  mates: [
    {x: 130, y: 210, size: 400},
    {x: 1390, y: 210, size: 400},
  ],
} as const;

/** 队友环体（品红同款副本——与 LoopRing 同几何（r = size/2 - 46）、同线宽
 *  （RING_STROKE）、同光点（r 11）的环体，仅描边色换 `stroke`（默认
 *  theme.mate）。「循环没换、只是多了几条」：调用侧与主环共用同一
 *  secPerLap / 相位喂 dotProgress，同尺寸同转速即同款语义；draw 0→1 描线
 *  进度 = 自坐席亮起。 */
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

/** 信箱文件（承 ep15 同款签名——4-A「队友甲的收件箱格」跨集设施连续性件，
 *  ep15 逐字节拷贝）。全片同形约束：文件体 + 文件名角标 + 湛蓝描边跨镜恒定。
 *  `litP` 显形；`rows` 箱内条目数（整摞的「摞」）；`appendP` 追加一行逐字落格
 *  （0..1——末行按字符比例显现，发信语义）；`takeP` 整摞打包升起离箱
 *  （0..1——收信语义，箱内归零由调用侧切 rows=0 承载）；`glowP` 待取辉光；
 *  `count` 计数角标（-1 不显；4-A 翻 0 用）；`scanP` 探测光扫过箱面。 */
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

/** 编号徽章（142 号对签——请求卡/回执卡/表行三处同号同形流转＝装置的流转
 *  主线）。靛蓝圆形 + mono 数字；`glowP` 落定拍辉光（对号重合闪兰紫时由调用侧
 *  传 receipt 色辉光）。 */
export const NumberBadge: React.FC<{
  label: string;
  size?: number;
  litP?: number;
  glow?: number;
  tone?: string;
  hollow?: boolean;
}> = ({label, size = 44, litP = 1, glow = 0, tone, hollow = false}) => {
  const on = tone ?? theme.req;
  const lit = clamp01v(litP);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${Math.max(2.5, size * 0.07)}px solid ${on}`,
        background: hollow ? 'transparent' : withAlphaM(on, 0.16),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.mono,
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
        color: theme.text,
        whiteSpace: 'nowrap',
        opacity: lit,
        boxShadow: glow > 0.03 ? `0 0 ${20 * glow}px ${withAlphaM(on, 0.7 * glow)}` : 'none',
        flexShrink: 0,
      }}
    >
      {label}
    </div>
  );
};

/** 三态胶囊（全片恒定三色）：`from` → `to` 翻转（flipP 0..1——0.5 处换色，
 *  scaleX 伴随翻转读感；from === to 时不翻转只显形）。 */
export const StatePill: React.FC<{
  from?: TriState;
  to?: TriState;
  litP?: number;
  flipP?: number;
  small?: boolean;
  flash?: number;
}> = ({from = 'pending', to, litP = 1, flipP = 0, small = false, flash = 0}) => {
  const flip = clamp01v(flipP);
  const target = to ?? from;
  const state: TriState = flip > 0.5 ? target : from;
  const tone = STATE_TONE[state];
  const w = small ? 26 : 30;
  return (
    <div
      style={{
        padding: small ? '3px 10px' : '4px 14px',
        borderRadius: 999,
        border: `${w * 0.085}px solid ${tone}`,
        background: withAlphaM(tone, 0.14 + 0.1 * flash),
        fontFamily: theme.sans,
        fontSize: small ? 15 : 18,
        fontWeight: 700,
        color: tone,
        whiteSpace: 'nowrap',
        opacity: clamp01v(litP),
        transform: `scaleX(${Math.abs(Math.cos(Math.PI * (to && to !== from ? flip : 0)))}) scale(${1 + 0.08 * clamp01v(flash)})`,
        boxShadow: flash > 0.03 ? `0 0 ${18 * clamp01v(flash)}px ${withAlphaM(tone, 0.6 * clamp01v(flash))}` : 'none',
      }}
    >
      {STATE_LABEL[state]}
    </div>
  );
};

/** 登记表行数据（RegistryTable 的行输入——缩微前后不重绘） */
export type RegRow = {
  key: string;
  /** 号签文本；undefined = 列位占位不显数（3-B/4-A 实验单——不造 narration 外号数） */
  badge?: string;
  type: string;
  to: string;
  state: TriState;
  /** 行入场 0..1（滑入落行） */
  rowP?: number;
  /** 状态翻转 0..1（from=pending → state） */
  stateP?: number;
  /** 「闭环」微章 0..1（2-B 镜尾） */
  closedP?: number;
  /** 误批红沉 0..1（3-B 左轨——整行泛红下沉） */
  hardP?: number;
  /** 行高亮 0..1（1-C「看表说话」/ 2-B 142 行悬停） */
  hotP?: number;
};

/** 登记表（本集主装置——对照表之于 ep2 的地位）。全片同形约束：靛蓝描边 +
 *  四列表头（编号 / 类型 / 发给谁 / 状态）+ 三态胶囊恒定，缩微前后不重绘。
 *  `headerP` 四列签逐列出亮（0..1×4）；`pillP` 右侧三态胶囊三格（暗态虚位
 *  →逐格点亮）；`nameP` 命名签（衬线体小签「协议状态机」）；`branchP`
 *  「+ 类型」分支按钮；`frameGlow` 外框亮一拍（结构兜底）；`micro` 缩微档
 *  （行内容压缩、无缩略列注）。 */
export const RegistryTable: React.FC<{
  x: number;
  y: number;
  w?: number;
  litP?: number;
  headerP?: readonly number[];
  rows?: RegRow[];
  pillP?: readonly number[];
  nameP?: number;
  branchP?: number;
  frameGlow?: number;
  micro?: boolean;
}> = ({
  x,
  y,
  w = 980,
  litP = 1,
  headerP = [1, 1, 1, 1],
  rows = [],
  pillP = [0, 0, 0],
  nameP = 0,
  branchP = 0,
  frameGlow = 0,
  micro = false,
}) => {
  const lit = clamp01v(litP);
  const glow = clamp01v(frameGlow);
  const heads = ['编号', '类型', '发给谁', '状态'];
  // 四列宽（编号窄、状态宽）＋行高随 micro 档
  const colW = micro ? [0.16, 0.24, 0.26, 0.34] : [0.16, 0.26, 0.28, 0.3];
  const rowH = micro ? 44 : 58;
  const headH = micro ? 40 : 52;
  const bodyRows = rows.length;
  const h = headH + bodyRows * rowH + (micro ? 10 : 18);
  const badgeSize = micro ? 30 : 40;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: lit}}>
      {/* 表体（靛蓝描边——全片同形锚） */}
      <div
        style={{
          position: 'relative',
          borderRadius: 14,
          border: `3px solid ${withAlphaM(theme.req, 0.55 + 0.35 * glow)}`,
          background: withAlphaM(theme.panel, 0.97),
          boxShadow: glow > 0.03 ? `0 0 ${34 * glow}px ${withAlphaM(theme.req, 0.4 * glow)}` : 'none',
        }}
      >
        {/* 表头（四列签逐列出亮——次序 = 口播点名次序） */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: headH,
            padding: '0 20px',
            borderBottom: `2px solid ${withAlphaM(theme.req, 0.5)}`,
            gap: 12,
          }}
        >
          {heads.map((hd, i) => (
            <div
              key={`hd${i}`}
              style={{
                width: `calc(${colW[i] * 100}% - 9px)`,
                fontFamily: theme.sans,
                fontSize: micro ? 17 : 21,
                fontWeight: 700,
                color: headerP[i] > 0.4 ? theme.text : theme.dim,
                opacity: 0.45 + 0.55 * clamp01v(headerP[i]),
                whiteSpace: 'nowrap',
              }}
            >
              {hd}
            </div>
          ))}
          {/* 命名签（衬线体小签——2-C p2-06b「协议状态机」贴表头） */}
          {nameP > 0.02 ? (
            <div
              style={{
                marginLeft: 'auto',
                padding: '3px 12px',
                borderRadius: 8,
                border: `2px solid ${withAlphaM(theme.receipt, 0.85)}`,
                background: withAlphaM(theme.panel, 0.98),
                fontFamily: theme.serif,
                fontSize: micro ? 13 : 16,
                fontWeight: 700,
                color: theme.receipt,
                whiteSpace: 'nowrap',
                opacity: clamp01v(nameP),
                transform: `translateY(${(1 - clamp01v(nameP)) * 8}px)`,
              }}
            >
              协议状态机
            </div>
          ) : null}
        </div>
        {/* 数据行（滑入落行 / 状态翻转 / 闭环微章 / 误批红沉） */}
        {rows.map((r, ri) => {
          const rowP = clamp01v(r.rowP ?? 1);
          const stateP = clamp01v(r.stateP ?? (r.state === 'pending' ? 1 : 0));
          const hard = clamp01v(r.hardP ?? 0);
          const hot = clamp01v(r.hotP ?? 0);
          const closed = clamp01v(r.closedP ?? 0);
          const cells: React.ReactNode[] = [];
          cells.push(
            r.badge === undefined ? (
              // 号签列位占位（不显数——3-B/4-A 实验单）
              <div
                key={`bg${ri}`}
                style={{
                  width: badgeSize,
                  height: badgeSize,
                  borderRadius: '50%',
                  border: `2.5px dashed ${withAlphaM(theme.dim, 0.6)}`,
                  flexShrink: 0,
                }}
              />
            ) : (
              <NumberBadge key={`bg${ri}`} label={r.badge} size={badgeSize} />
            ),
          );
          cells.push(
            <div key={`ty${ri}`} style={{fontFamily: theme.sans, fontSize: micro ? 16 : 19, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>
              {r.type}
            </div>,
          );
          cells.push(
            <div key={`to${ri}`} style={{fontFamily: theme.sans, fontSize: micro ? 16 : 19, color: theme.text, whiteSpace: 'nowrap'}}>
              {r.to}
            </div>,
          );
          cells.push(
            <div key={`st${ri}`} style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <StatePill from="pending" to={r.state} flipP={stateP} small={micro} />
              {closed > 0.02 ? (
                <span
                  style={{
                    fontFamily: theme.mono,
                    fontSize: micro ? 12 : 14,
                    color: theme.ok,
                    border: `2px solid ${withAlphaM(theme.ok, 0.8)}`,
                    borderRadius: 6,
                    padding: '1px 8px',
                    whiteSpace: 'nowrap',
                    opacity: closed,
                  }}
                >
                  闭环
                </span>
              ) : null}
            </div>,
          );
          return (
            <div
              key={`row-${r.key}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: rowH,
                padding: '0 20px',
                gap: 12,
                borderTop: ri === 0 ? 'none' : `1px solid ${withAlphaM(theme.panelBorder, 0.8)}`,
                background: hard > 0.02 ? withAlphaM(theme.danger, 0.14 * hard) : hot > 0.02 ? withAlphaM(theme.req, 0.1 * hot) : 'transparent',
                opacity: rowP,
                transform: `translateX(${(1 - rowP) * -26}px)`,
              }}
            >
              {cells.map((c, ci) => (
                <div key={`c${ci}`} style={{width: `calc(${colW[ci] * 100}% - 9px)`, display: 'flex', alignItems: 'center', overflow: 'visible'}}>
                  {c}
                </div>
              ))}
            </div>
          );
        })}
        {/* 底缘：七字段缩略注 + 「+ 类型」分支按钮（2-C 幕点生长） */}
        {!micro ? (
          <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '8px 20px 12px'}}>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.75}}>
              {'ProtocolState · 发件人 / 收件人 / 载荷 / 时间戳 缩略'}
            </span>
            {branchP > 0.02 ? (
              <span
                style={{
                  marginLeft: 'auto',
                  padding: '4px 14px',
                  borderRadius: 8,
                  border: `2.5px solid ${withAlphaM(theme.ok, 0.85)}`,
                  background: withAlphaM(theme.ok, 0.1),
                  fontFamily: theme.sans,
                  fontSize: 16,
                  fontWeight: 700,
                  color: theme.ok,
                  whiteSpace: 'nowrap',
                  opacity: clamp01v(branchP),
                }}
              >
                + 类型
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {/* 右侧三态胶囊位（暗态三格虚位 → 逐格点亮——1-A p1-04 重音镜） */}
      {pillP.some((p) => p > 0.02) ? (
        <div style={{position: 'absolute', left: w + 26, top: headH - 8, display: 'flex', flexDirection: 'column', gap: 18}}>
          {(['pending', 'approved', 'rejected'] as const).map((s, i) => (
            <div key={`sp${i}`} style={{display: 'flex', alignItems: 'center', gap: 10, opacity: 0.35 + 0.65 * clamp01v(pillP[i])}}>
              <StatePill to={s} litP={1} small />
              <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap'}}>
                {['pending', 'approved', 'rejected'][i]}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/** 裂缝图标（0-C 三裂缝预埋 / 5-B 飞回压灭——口信三种坏法的具象）。
 *  `crackP` 裂开显形（0..1——描线裂开）；`snuffP` 被检查栏徽章压灭（0..1）。 */
export const CrackIcon: React.FC<{
  x: number;
  y: number;
  size?: number;
  crackP?: number;
  snuffP?: number;
  label?: string;
}> = ({x, y, size = 74, crackP = 0, snuffP = 0, label}) => {
  const crack = clamp01v(crackP);
  const snuff = clamp01v(snuffP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: size + 90, opacity: (0.3 + 0.7 * crack) * (1 - snuff)}}>
      <svg width={size} height={size} viewBox="0 0 74 74" style={{overflow: 'visible'}}>
        {/* 卡片底（虚线壳——口信的薄脆感） */}
        <rect
          x={4}
          y={4}
          width={66}
          height={66}
          rx={9}
          fill={withAlphaM(theme.panel, 0.95)}
          stroke={crack > 0.4 ? theme.danger : theme.panelBorder}
          strokeWidth={2.5}
          strokeDasharray={crack > 0.4 ? undefined : '6 5'}
        />
        {/* 闪电裂缝（描线裂开——crackP 驱动 pathLength 归一化） */}
        <path
          d="M40 8 L30 30 L42 32 L26 66"
          fill="none"
          stroke={theme.danger}
          strokeWidth={3.5}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - crack}
        />
      </svg>
      {label ? (
        <span
          style={{
            position: 'absolute',
            left: size + 8,
            top: size / 2 - 14,
            fontFamily: theme.sans,
            fontSize: 19,
            fontWeight: 700,
            color: crack > 0.4 ? theme.text : theme.dim,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
};

/** 四步签（1-C 立空白虚位 → 2-A/2-B 逐签显字 → 2-B 末退役）。
 *  `slotP` 立起；`textP` 显字（签面空白→「开单/投递/回执/销账」）。 */
export const StepSign: React.FC<{
  index: number;
  label?: string;
  litP?: number;
  textP?: number;
}> = ({index, label, litP = 1, textP = 0}) => {
  const lit = clamp01v(litP);
  const txt = clamp01v(textP);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 18px',
        borderRadius: 10,
        border: `${txt > 0.4 ? '3px solid' : '2.5px dashed'} ${txt > 0.4 ? withAlphaM(theme.req, 0.85) : withAlphaM(theme.dim, 0.55)}`,
        background: txt > 0.4 ? withAlphaM(theme.req, 0.1) : 'transparent',
        opacity: lit,
      }}
    >
      <span style={{fontFamily: theme.mono, fontSize: 20, color: txt > 0.4 ? theme.req : theme.dim}}>{`①②③④`[index]}</span>
      <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.text, opacity: txt, whiteSpace: 'nowrap'}}>
        {label ?? '　'}
      </span>
    </div>
  );
};

/** 消融双轨骨架（3-B/3-C 全片张力峰值——左红右绿恒定；等高并置同题裁决）。
 *  轨内容（迷你登记表行 / 闸片 / 回复轨道 / 计数器）由调用场景按 CHECK_LANES
 *  常量摆位——装置只承载轨道背板 + 轨头标签（左右语义色恒定，标题经 props
 *  注入：3-B 拆类型检查 / 3-C 关掉防重——同骨架不同题）。 */
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

/** 请求卡（靛蓝——2-A 开单产物、沿投递线滑入甲收件箱格）。三签随口播次序
 *  逐签落位：`badgeP` 号签（142 徽章）/ `typeP` 类型签 / `toP` 收件签；
 *  位移（生成 → 滑入收件箱格）由调用场景以 transform 驱动。 */
export const RequestCard: React.FC<{
  w?: number;
  litP?: number;
  badgeP?: number;
  typeP?: number;
  toP?: number;
  badgeText?: string;
  typeText?: string;
  toText?: string;
}> = ({w = 300, litP = 1, badgeP = 0, typeP = 0, toP = 0, badgeText = '142', typeText = '关机', toText = '队友甲'}) => {
  const lit = clamp01v(litP);
  const seal = (p: number, text: string, tone: string) => ({
    padding: '4px 14px',
    borderRadius: 8,
    border: `${p > 0.4 ? '2.5px solid' : '2px dashed'} ${p > 0.4 ? withAlphaM(tone, 0.85) : withAlphaM(theme.dim, 0.55)}`,
    background: p > 0.4 ? withAlphaM(tone, 0.12) : 'transparent',
    fontFamily: theme.sans,
    fontSize: 17,
    fontWeight: 700,
    color: p > 0.4 ? theme.text : theme.dim,
    whiteSpace: 'nowrap',
    opacity: 0.4 + 0.6 * clamp01v(p),
    transform: `translateY(${(1 - clamp01v(p)) * 8}px)`,
  });
  return (
    <div
      style={{
        width: w,
        borderRadius: 12,
        border: `3px solid ${withAlphaM(theme.req, 0.85)}`,
        background: withAlphaM(theme.panel, 0.97),
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: lit,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
        <NumberBadge label={badgeText} size={38} litP={clamp01v(badgeP)} />
        <div style={{display: 'flex', gap: 10, flexWrap: 'nowrap'}}>
          <span style={{...seal(typeP, typeText, theme.req)}}>{typeText}</span>
          <span style={{...seal(toP, toText, theme.req)}}>{toText}</span>
        </div>
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.8}}>
        {'shutdown_request · 待处理'}
      </div>
    </div>
  );
};

/** 回执卡（兰紫——2-B 甲的回复，携同一枚 142 号徽章+「同意」签沿回流线飞回；
 *  同号对签 = 对号的视觉主线，号徽章与请求卡/表行三处同号同形）。 */
export const ReplyCard: React.FC<{
  w?: number;
  litP?: number;
  badgeP?: number;
  agreeP?: number;
  badgeText?: string;
  agreeText?: string;
  tone?: string;
}> = ({w = 300, litP = 1, badgeP = 1, agreeP = 0, badgeText = '142', agreeText = '同意', tone}) => {
  const on = tone ?? theme.receipt;
  const lit = clamp01v(litP);
  return (
    <div
      style={{
        width: w,
        borderRadius: 12,
        border: `3px solid ${withAlphaM(on, 0.85)}`,
        background: withAlphaM(theme.panel, 0.97),
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        opacity: lit,
      }}
    >
      <NumberBadge label={badgeText} size={38} litP={clamp01v(badgeP)} tone={on} />
      <span
        style={{
          padding: '4px 14px',
          borderRadius: 8,
          border: `2.5px solid ${withAlphaM(on, 0.85)}`,
          background: withAlphaM(on, 0.12),
          fontFamily: theme.sans,
          fontSize: 17,
          fontWeight: 700,
          color: theme.text,
          whiteSpace: 'nowrap',
          opacity: 0.4 + 0.6 * clamp01v(agreeP),
        }}
      >
        {agreeText}
      </span>
      <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginLeft: 'auto', whiteSpace: 'nowrap', opacity: 0.8}}>
        {'response'}
      </span>
    </div>
  );
};

/** 回执簿（附录 A 唯一正主——1-B 落锚「开单/等回执/按编号销账」、5-B 回扣
 *  「翻开那本回执簿：对上号，才算数」收口）。一单一号双联簿：左联存根 /
 *  右联回执、齿孔撕线。`openP` 翻开度（0 合 / 1 全开）；`stubP` 存根落一行；
 *  `flyP` 回执联撕下携号飞向存根；`mergeP` 同号重合；`glow` 兰紫落定拍；
 *  `halfP` 半合待命（1-B 边界句——不担保语义）；`closeP` 合上（5-B 收口）；
 *  `sealP` 封面靛蓝编号徽章戳；`pillsP` 三态胶囊收进封面。 */
export const ReceiptBook: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  openP?: number;
  stubP?: number;
  flyP?: number;
  mergeP?: number;
  glow?: number;
  halfP?: number;
  closeP?: number;
  sealP?: number;
  pillsP?: number;
}> = ({x, y, w = 880, h = 460, litP = 1, openP = 1, stubP = 0, flyP = 0, mergeP = 0, glow = 0, halfP = 0, closeP = 0, sealP = 0, pillsP = 0}) => {
  const lit = clamp01v(litP);
  const open = clamp01v(openP) * (1 - 0.5 * clamp01v(halfP)) * (1 - clamp01v(closeP));
  const closed = clamp01v(closeP);
  const leafW = (w - 8) / 2;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: lit}}>
      {/* 翻开态（双联簿页）——closeP 起被封面收起 */}
      <div style={{position: 'relative', height: h, opacity: 1 - closed * 0.96, transform: `rotateX(${closed * 60}deg)`, transformOrigin: '50% 100%'}}>
        {/* 左联存根 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: leafW,
            height: h,
            borderRadius: '12px 2px 2px 12px',
            border: `3px solid ${withAlphaM(theme.receipt, 0.7)}`,
            borderRight: 'none',
            background: withAlphaM(theme.panel, 0.97),
            padding: '18px 24px',
            opacity: open,
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 22, fontWeight: 700, color: theme.text}}>存根联</div>
          {/* 存根行（开单落一行） */}
          {[0, 1, 2].map((i) => (
            <div
              key={`st${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                height: 52,
                marginTop: 14,
                borderRadius: 8,
                border: `2px ${i === 0 && stubP > 0.5 ? 'solid' : 'dashed'} ${i === 0 && stubP > 0.5 ? withAlphaM(theme.req, 0.8) : withAlphaM(theme.panelBorder, 0.9)}`,
                background: i === 0 && stubP > 0.5 ? withAlphaM(theme.req, 0.1) : 'transparent',
                opacity: i === 0 ? 0.4 + 0.6 * clamp01v(stubP) : 0.35,
              }}
            >
              {i === 0 ? <NumberBadge label="142" size={30} litP={clamp01v(stubP)} /> : <span style={{width: 30, height: 30, borderRadius: '50%', border: `2px dashed ${withAlphaM(theme.dim, 0.5)}`}} />}
              <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>{i === 0 ? '关机 · 队友甲' : '　'}</span>
            </div>
          ))}
        </div>
        {/* 齿孔撕线 */}
        <div style={{position: 'absolute', left: leafW - 2, top: 10, bottom: 10, width: 4, opacity: open * 0.9}}>
          {Array.from({length: 9}, (_, i) => (
            <span
              key={`ph${i}`}
              style={{
                display: 'block',
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: theme.bg,
                border: `1.5px solid ${withAlphaM(theme.dim, 0.7)}`,
                margin: `${(h - 20) / 18}px 0`,
              }}
            />
          ))}
        </div>
        {/* 右联回执（撕下携号飞回——flyP 驱动；重合后闪兰紫） */}
        <div
          style={{
            position: 'absolute',
            left: leafW + 4,
            top: 0,
            width: leafW,
            height: h,
            borderRadius: '2px 12px 12px 2px',
            border: `3px solid ${withAlphaM(theme.receipt, 0.7)}`,
            borderLeft: 'none',
            background: withAlphaM(theme.panel, 0.97),
            padding: '18px 24px',
            opacity: open,
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 22, fontWeight: 700, color: theme.text}}>回执联</div>
          {/* 回执位（等回执——空位呼吸由调用侧 breathe 喂 stubP 之后的等待拍） */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              height: 52,
              marginTop: 14,
              borderRadius: 8,
              border: `2px dashed ${withAlphaM(theme.receipt, 0.6)}`,
              opacity: 0.5 + 0.3 * glow,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginLeft: 8, whiteSpace: 'nowrap'}}>{'等回执 · 回信落此'}</span>
          </div>
          {/* 边界小签位（管销账不管催账——1-B p1-06 贴上，由场景注入签件） */}
        </div>
        {/* 撕下的回执（携号飞向存根——flyP 0..1：沿撕线左飞） */}
        <div
          style={{
            position: 'absolute',
            left: leafW + 4 - clamp01v(flyP) * (leafW - 60),
            top: 74,
            width: leafW,
            opacity: clamp01v(flyP) * (1 - clamp01v(mergeP) * 0.85),
            transform: `rotate(${(1 - clamp01v(mergeP)) * -4}deg)`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              height: 52,
              borderRadius: 8,
              border: `2.5px solid ${withAlphaM(theme.receipt, 0.9)}`,
              background: withAlphaM(theme.panel, 0.98),
              padding: '0 16px',
            }}
          >
            <NumberBadge label="142" size={30} tone={theme.receipt} />
            <span style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'回执 · 对号'}</span>
          </div>
        </div>
        {/* 同号重合拍（存根行上闪兰紫辉光——对上号才算办结） */}
        <div
          style={{
            position: 'absolute',
            left: 24,
            top: 96,
            width: leafW - 48,
            height: 44,
            borderRadius: 8,
            border: `3px solid ${withAlphaM(theme.receipt, 0.9 * clamp01v(mergeP))}`,
            boxShadow: glow > 0.03 ? `0 0 ${34 * clamp01v(glow)}px ${withAlphaM(theme.receipt, 0.7 * clamp01v(glow))}` : 'none',
            opacity: clamp01v(mergeP),
          }}
        />
      </div>
      {/* 合上的封面（5-B 收口——三态胶囊收进 + 靛蓝编号徽章戳） */}
      {closed > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: w / 2 - 210,
            top: h * 0.16,
            width: 420,
            height: h * 0.62,
            borderRadius: 14,
            border: `3px solid ${withAlphaM(theme.receipt, 0.8)}`,
            background: withAlphaM(theme.panel, 0.98),
            opacity: closed,
            transform: `translateY(${(1 - closed) * -26}px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 30, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>回执簿</div>
          {/* 三态胶囊（收进封面——三格小胶囊纵列） */}
          <div style={{display: 'flex', gap: 14, opacity: clamp01v(pillsP)}}>
            <StatePill to="pending" small />
            <StatePill to="approved" small />
            <StatePill to="rejected" small />
          </div>
          {/* 编号徽章戳（靛蓝——与 0-C/1-A 徽章同形） */}
          <div style={{transform: `scale(${1 + 0.25 * (1 - clamp01v(sealP))})`, opacity: clamp01v(sealP) > 0.02 ? 1 : 0}}>
            <NumberBadge label="142" size={52} glow={clamp01v(sealP) > 0.5 ? 1 : 0} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

/** 改写计数器（3-C 基线标尺——刻度带 1|2|3+ 工况角标）。计数渲染红线：
 *  `value` 由调用侧离散给值（1→2→3 逐拍跳变），组件 Math.round 直取、
 *  禁连续滚动（QA 硬约束：clamp01 禁用于计数渲染）。 */
export const RewriteCounter: React.FC<{
  x: number;
  y: number;
  value: number;
  litP?: number;
  label?: string;
}> = ({x, y, value, litP = 1, label = '状态改写次数'}) => {
  const lit = clamp01v(litP);
  const v = Math.max(1, Math.round(value));
  const cells = [1, 2, 3];
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: lit}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
        <span style={{fontFamily: theme.mono, fontSize: 44, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: v >= 3 ? theme.danger : theme.text}}>
          {v}
        </span>
        <div style={{display: 'flex', gap: 5, alignItems: 'flex-end'}}>
          {cells.map((c) => (
            <span
              key={`cc${c}`}
              style={{
                width: 22,
                height: 12 + c * 8,
                borderRadius: 3,
                background: c <= v ? (v >= 3 ? withAlphaM(theme.danger, 0.6) : withAlphaM(theme.ok, 0.55)) : 'transparent',
                border: `2px solid ${c <= v ? (v >= 3 ? theme.danger : theme.ok) : withAlphaM(theme.dim, 0.4)}`,
              }}
            />
          ))}
        </div>
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 6, whiteSpace: 'nowrap'}}>
        {`${label} · 1|2|3+`}
      </div>
    </div>
  );
};
