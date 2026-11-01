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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2–ep7 延续——
// LoopRing 描边色/线宽跨集恒定（theme.core = 陶土橙 #D97757 + RING_STROKE 6）
// = 逐字节拷贝的前提；Terminal/DispatchTable 本集无对应场景、不拷）
// （ep8 复制适配：环体缩悬各装置上角、环侧挂草稿纸——每转一段纸厚一分）

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

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep8 Context Compact）
// storyboard 实现映射登记：DualPlaneStage / MessageColumn / ThresholdWaterline /
// DiskCard / PathStub / PlaceholderStub / ArchiveFolder / StepLadder / TimelineAxis /
// ReceiptCard / AblationTracks / TokenGate / SummaryCard / FuseCard / RedStamp
// （ArchiveFolder 拆出 ArchiveMark、AblationTracks 拆出 AblationTrack 单轨件、
// TokenGate 拆出 BillingCard——登记名下的实现件按组装需要细分，登记注释在此留痕）。
// 全片主装置 = 蓝面/紫盘双平面（对照 ep2 对照表 / ep6 两间会议室之地位）：
// 蓝面 mech=天蓝（上下文消息列——「还占着上下文」侧）恒左、紫面 archive=长春花紫
// （磁盘留档——「原文住址」侧）恒右；一切腾地方动作 = 蓝→紫双色箭头（恒向右）、
// 占位条必带路径签（「有住址」与「死字」的可视分界）、水位刻度口径全片一致
// （满位=额度框顶、红线刻度=二十万）。缩微前后不重绘（scale 整体变换）。
// 哑装置原则承 ep4–ep7：动效参数（进度/状态/读数）一律经 prop 由调用场景注入，
// 本段零 motion hooks——「怎么动」归场景，「画什么」归此处。

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 拒收红章（0-A 首砸、1-B 回扣缩小版——同款同形跨幕回扣件）。`p` 0..1 盖落
 *  （自上方砸下 + 落章一拍冲击）；`flash` 0..1 落章辉光。数据本体红线：p 只作用
 *  transform/opacity，章面文字恒定。 */
export const RedStamp: React.FC<{
  x: number;
  y: number;
  scale?: number;
  p?: number;
  flash?: number;
  rot?: number;
  label?: string;
  sub?: string;
}> = ({x, y, scale = 1, p = 0, flash = 0, rot = -8, label = '拒收', sub = 'prompt_too_long'}) => {
  const t = clamp01(p);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y - 200 * (1 - t),
        width: 320,
        height: 150,
        transform: `translate(-50%, -50%) scale(${scale}) rotate(${rot}deg)`,
        opacity: clamp01(t * 2),
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: 18,
          border: `6px solid ${theme.danger}`,
          background: withAlpha(theme.danger, 0.12),
          boxShadow: `0 0 ${34 * clamp01(flash)}px ${withAlpha(theme.danger, 0.5)}, inset 0 0 ${20 * clamp01(flash)}px ${withAlpha(theme.danger, 0.2)}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <span style={{fontFamily: theme.serif, fontSize: 56, fontWeight: 700, color: theme.danger, letterSpacing: 10, paddingLeft: 10}}>{label}</span>
        <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.danger, opacity: 0.8}}>{sub}</span>
      </div>
    </div>
  );
};

/** 配对规矩线（红线——0-C 横贯底部首亮 → 1-A 迁入列下缘驻位，全片 continuity：
 *  色值/线宽/水平姿态恒定，仅位置与宽度由调用方给）。`lit` 0..1 亮起（自左向右
 *  描线感——clip 宽度驱动）。 */
export const Redline: React.FC<{x: number; y: number; w: number; lit?: number; thickness?: number}> = ({
  x,
  y,
  w,
  lit = 1,
  thickness = 5,
}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w * clamp01(lit), height: 0, borderTop: `${thickness}px solid ${theme.danger}`, pointerEvents: 'none'}} />
);

/** 上下文草稿纸（P0 主装置 / 5-B 回扣——同款同形首尾对照件）。三类内容块
 *  （文件块/命令输出条/回答气泡）按 `rowsLit` 0..12 实数交错显形；`redness`
 *  0..1 整张泛红；`thickness` 0..1 纸厚（环每转一段厚一分——右缘纸页叠层）；
 *  `quotaLit` 0..1 外缘额度框（框满即死）；`cleanP` 0..1 清爽态（边角留白——
 *  纸面内容按比例淡出留白）；`blankP` 0..1 完全空白（新纸「忘」的判据）。 */
export const ContextPaper: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  scale?: number;
  lit?: number;
  dim?: number;
  rowsLit?: number;
  redness?: number;
  thickness?: number;
  quotaLit?: number;
  cleanP?: number;
  blankP?: number;
  stampZone?: number;
}> = ({
  x,
  y,
  w,
  h,
  scale = 1,
  lit = 1,
  dim = 0,
  rowsLit = 0,
  redness = 0,
  thickness = 0,
  quotaLit = 0,
  cleanP = 0,
  blankP = 0,
  stampZone = 0,
}) => {
  const clean = clamp01(cleanP);
  const blank = clamp01(blankP);
  // 三类内容块布局：文件(0,3,6,9) 命令(1,4,7,10) 回答(2,5,8,11) 交错压行
  const rows = [
    {kind: 'file', zh: '读过的文件'},
    {kind: 'cmd', zh: '命令输出'},
    {kind: 'reply', zh: '模型的回答'},
    {kind: 'file', zh: '读过的文件'},
    {kind: 'cmd', zh: '命令输出'},
    {kind: 'reply', zh: '模型的回答'},
    {kind: 'file', zh: '读过的文件'},
    {kind: 'cmd', zh: '命令输出'},
    {kind: 'reply', zh: '模型的回答'},
    {kind: 'file', zh: '读过的文件'},
    {kind: 'cmd', zh: '命令输出'},
    {kind: 'reply', zh: '模型的回答'},
  ] as const;
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
          borderRadius: 10,
          border: `3px solid ${withAlpha(theme.mech, 0.55 + 0.35 * clamp01(redness))}`,
          background: withAlpha(theme.panel, 0.96),
          boxShadow: `0 0 ${26 * clamp01(redness)}px ${withAlpha(theme.danger, 0.3 * clamp01(redness))}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 头签（上下文额度条——蓝） */}
        <div style={{position: 'absolute', left: 18, top: 12, display: 'flex', alignItems: 'baseline', gap: 10, opacity: 1 - blank}}>
          <span style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.mech}}>{'上下文 · 草稿纸'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'messages'}</span>
        </div>
        {/* 内容块阵（一行压一行越写越密——交错三类） */}
        <div style={{position: 'absolute', left: 18, right: 18, top: 44}}>
          {rows.map((r, i) => {
            const p = clamp01(rowsLit - i);
            // cleanP 清爽态：后半内容块按比例淡出（边角留白）；blankP 全隐（新纸空白）
            const fade = (1 - clamp01(clean * 2 - (i < 6 ? 0 : 1))) * (1 - blank);
            if (p <= 0.02 || fade <= 0.02) {
              return null;
            }
            const isFile = r.kind === 'file';
            const isCmd = r.kind === 'cmd';
            return (
              <div
                key={i}
                style={{
                  height: isCmd ? 30 : 36,
                  marginBottom: 7,
                  boxSizing: 'border-box',
                  borderRadius: isFile ? 6 : isCmd ? 4 : 12,
                  border: `2px solid ${isCmd ? withAlpha(theme.dim, 0.5) : withAlpha(theme.mech, 0.3 + 0.4 * p)}`,
                  background: isCmd ? withAlpha(theme.bg, 0.6) : withAlpha(theme.mech, 0.06 + 0.08 * p),
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 12,
                  gap: 10,
                  opacity: fade * (0.3 + 0.7 * p),
                  width: `${96 - ((i * 7) % 30)}%`,
                }}
              >
                {isCmd ? (
                  <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.8}}>{'$ … 退出码 0'}</span>
                ) : (
                  <>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: r.kind === 'reply' ? '50%' : 4,
                        background: withAlpha(theme.mech, 0.5),
                        display: 'inline-block',
                      }}
                    />
                    <span style={{fontFamily: theme.sans, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>{r.zh}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {/* 泛红遮罩（写满那一刻——整张泛红） */}
        {redness > 0.02 ? (
          <div style={{position: 'absolute', inset: 0, background: withAlpha(theme.danger, 0.16 * clamp01(redness)), pointerEvents: 'none'}} />
        ) : null}
        {/* 红章预留位提示（0-A 词窗内 stampZone>0 时纸面轻震——由调用方 RedStamp 叠加） */}
        {stampZone > 0.02 ? (
          <div style={{position: 'absolute', inset: 0, boxShadow: `inset 0 0 ${24 * clamp01(stampZone)}px ${withAlpha(theme.danger, 0.35)}`, pointerEvents: 'none'}} />
        ) : null}
      </div>
      {/* 纸厚叠层（环每转一段厚一分——右缘纸页） */}
      {thickness > 0.02
        ? Array.from({length: 3}, (_, k) => {
            const on = clamp01(thickness * 3 - k);
            return (
              <div
                key={`pg${k}`}
                style={{
                  position: 'absolute',
                  left: (k + 1) * 5,
                  top: (k + 1) * 4,
                  width: w,
                  height: h,
                  borderRadius: 10,
                  border: `2px solid ${withAlpha(theme.mech, 0.16 + 0.14 * on)}`,
                  background: 'transparent',
                  opacity: 0.24 + 0.3 * on,
                  zIndex: -1,
                  pointerEvents: 'none',
                }}
              />
            );
          })
        : null}
      {/* 额度框（框满即死的边界陈述——纸外缘虚线框 + 满签） */}
      {quotaLit > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: -18,
            top: -16,
            width: w + 36,
            height: h + 32,
            borderRadius: 14,
            border: `3px dashed ${withAlpha(theme.danger, 0.55 + 0.35 * clamp01(quotaLit))}`,
            opacity: clamp01(quotaLit),
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              position: 'absolute',
              right: 12,
              top: -16,
              padding: '3px 14px',
              borderRadius: 8,
              border: `2.5px solid ${theme.danger}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 17,
              fontWeight: 700,
              color: theme.danger,
              whiteSpace: 'nowrap',
            }}
          >
            {'额度 · 满=拒收'}
          </span>
        </div>
      ) : null}
    </div>
  );
};

/** 蓝面消息列（双平面之蓝面容器+行阵——1-A 配对特写 / 1-C 末条聚拢 / 2-A 长条）。
 *  `rows` 行类型序列（call=调用块 / result=结果块 / msg=普通消息）；`rowsLit`
 *  0..n 实数行显形；`pairLock` 0..1 配对锁咔哒锁上（锁画在每个 call↔result 接缝）；
 *  `lockFlash` 锁合辉光；`headLit`/`tailLit` 头三格/尾部组高亮框定（2-A）；
 *  `lastMsgLit` 末条消息聚拢框（1-C）。 */
export const MessageColumn: React.FC<{
  x: number;
  y: number;
  w: number;
  rowH?: number;
  scale?: number;
  lit?: number;
  dim?: number;
  rows: readonly ('call' | 'result' | 'msg')[];
  rowsLit?: number;
  pairLock?: number;
  lockFlash?: number;
  headLit?: number;
  tailLit?: number;
  lastMsgLit?: number;
  headerLabel?: string;
}> = ({
  x,
  y,
  w,
  rowH = 64,
  scale = 1,
  lit = 1,
  dim = 0,
  rows,
  rowsLit = 0,
  pairLock = 0,
  lockFlash = 0,
  headLit = 0,
  tailLit = 0,
  lastMsgLit = 0,
  headerLabel = '上下文 · 消息列',
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      opacity: clamp01(lit) * (1 - dim),
      transform: `scale(${scale})`,
      transformOrigin: 'left top',
    }}
  >
    <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.mech, marginBottom: 8, whiteSpace: 'nowrap'}}>{headerLabel}</div>
    <div style={{position: 'relative'}}>
      {rows.map((kind, i) => {
        const p = clamp01(rowsLit - i);
        const isCall = kind === 'call';
        const isResult = kind === 'result';
        const inHead = i < 3;
        const inTail = i >= rows.length - 4;
        const headGlow = inHead ? clamp01(headLit) : 0;
        const tailGlow = inTail ? clamp01(tailLit) : 0;
        const isLast = i === rows.length - 1;
        const lastGlow = isLast ? clamp01(lastMsgLit) : 0;
        return (
          <div key={i} style={{position: 'relative', height: rowH, marginBottom: 8}}>
            {/* 行本体（call=蓝实框「调用」/ result=蓝浅框「结果」/ msg=灰框） */}
            <div
              style={{
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                borderRadius: 8,
                border: `2.5px solid ${isCall || isResult ? withAlpha(theme.mech, 0.45 + 0.4 * p) : withAlpha(theme.panelBorder, 0.9)}`,
                background: isCall ? withAlpha(theme.mech, 0.14) : isResult ? withAlpha(theme.mech, 0.06) : 'transparent',
                borderStyle: p > 0.05 ? 'solid' : 'dashed',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 14,
                gap: 10,
                opacity: 0.35 + 0.65 * p,
                boxShadow:
                  headGlow > 0.3 || tailGlow > 0.3 || lastGlow > 0.3
                    ? `0 0 ${16 * Math.max(headGlow, tailGlow, lastGlow)}px ${withAlpha(theme.text, 0.4)}`
                    : 'none',
                outline: Math.max(headGlow, tailGlow, lastGlow) > 0.3 ? `2.5px solid ${withAlpha(theme.text, 0.5 * Math.max(headGlow, tailGlow, lastGlow))}` : 'none',
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 600, color: isCall || isResult ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>
                {isCall ? '调用 tool_use' : isResult ? '结果 tool_result' : '消息'}
              </span>
            </div>
            {/* 配对小锁（call→下一行 result 的接缝中点——咔哒锁上） */}
            {isCall && rows[i + 1] === 'result' && pairLock > 0.02 ? (
              <div
                style={{
                  position: 'absolute',
                  left: w / 2 - 21,
                  top: rowH - 12,
                  width: 42,
                  height: 30,
                  boxSizing: 'border-box',
                  borderRadius: 7,
                  border: `3px solid ${theme.text}`,
                  background: theme.panel,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: clamp01(pairLock),
                  transform: `scale(${0.7 + 0.3 * clamp01(pairLock)})`,
                  boxShadow: lockFlash > 0.05 ? `0 0 ${16 * clamp01(lockFlash)}px ${withAlpha(theme.text, 0.6)}` : 'none',
                  zIndex: 2,
                }}
              >
                <span style={{fontFamily: theme.sans, fontSize: 13, fontWeight: 700, color: theme.text}}>{'锁'}</span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  </div>
);

/** 批预算水位条（列侧立——满位=额度框顶，红线刻度=二十万）。`level` 0..1 水位
 *  （读数 label 由场景算好传入）；`tick` 0..1 红线刻度位；`breach` 0..1 破线泛红
 *  （水位越过刻度的警示态——破位方向恒向上冒过红线）。 */
export const ThresholdWaterline: React.FC<{
  x: number;
  y: number;
  h: number;
  level?: number;
  label?: string;
  tick?: number;
  breach?: number;
  breachFlash?: number;
  lit?: number;
  caption?: string;
}> = ({x, y, h, level = 0, label = '', tick = 0.95, breach = 0, breachFlash = 0, lit = 1, caption = '批预算'}) => {
  const lv = clamp01(level);
  const br = clamp01(breach);
  return (
    <div style={{position: 'absolute', left: x, top: y, height: h, opacity: clamp01(lit), pointerEvents: 'none'}}>
      <div style={{position: 'relative', width: 74, height: '100%'}}>
        {/* 轨道 */}
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 40, borderRadius: 8, border: `2.5px solid ${withAlpha(theme.mech, 0.55)}`, background: withAlpha(theme.mech, 0.05)}} />
        {/* 水位（自底涨——蓝实；破线段红） */}
        <div
          style={{
            position: 'absolute',
            left: 3,
            bottom: 3,
            width: 34,
            height: `calc(${(h - 6) * lv}px)`,
            borderRadius: 6,
            background: withAlpha(br > 0.4 ? theme.danger : theme.mech, 0.3 + 0.25 * lv),
            boxShadow: br > 0.05 ? `0 0 ${16 * br}px ${withAlpha(theme.danger, 0.5)}` : 'none',
          }}
        />
        {/* 红线刻度（二十万——横杠 + 读数） */}
        <div style={{position: 'absolute', left: -6, top: h * (1 - tick), width: 52, height: 0, borderTop: `4px solid ${theme.danger}`, opacity: 0.95}} />
        <div
          style={{
            position: 'absolute',
            left: 48,
            top: h * (1 - tick) - 12,
            fontFamily: theme.mono,
            fontSize: 15,
            fontWeight: 700,
            color: theme.danger,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {'200,000'}
        </div>
        {/* 当前读数（场景算好的闭合值——不在此处换算） */}
        {label ? (
          <div
            style={{
              position: 'absolute',
              left: 48,
              top: Math.min(h - 34, h * (1 - lv) - 6),
              padding: '2px 10px',
              borderRadius: 6,
              border: `2.5px solid ${br > 0.4 ? theme.danger : theme.mech}`,
              background: theme.panel,
              fontFamily: theme.mono,
              fontSize: 18,
              fontWeight: 700,
              color: theme.text,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              boxShadow: breachFlash > 0.05 ? `0 0 ${14 * clamp01(breachFlash)}px ${withAlpha(theme.danger, 0.55)}` : 'none',
            }}
          >
            {label}
          </div>
        ) : null}
        {/* 头签 */}
        <div style={{position: 'absolute', left: -4, top: -30, fontFamily: theme.sans, fontSize: 14, fontWeight: 600, color: theme.dim, whiteSpace: 'nowrap'}}>{caption}</div>
      </div>
    </div>
  );
};

/** 蓝→紫双色箭头（全片恒向右——一切腾地方动作的统一可视）。`p` 0..1 行进
 *  （箭头头部位置）；`flowPhase` 虚线相位（场景帧驱动）。 */
export const TransferArrow: React.FC<{x: number; y: number; w: number; p?: number; lit?: number; flowPhase?: number; thick?: number}> = ({
  x,
  y,
  w,
  p = 0,
  lit = 1,
  flowPhase = 0,
  thick = 5,
}) => {
  const t = clamp01(p);
  const headX = 14 + (w - 34) * t;
  return (
    <svg width={w} height={44} viewBox={`0 0 ${w} 44`} style={{position: 'absolute', left: x, top: y, overflow: 'visible', opacity: clamp01(lit), pointerEvents: 'none'}}>
      <defs>
        <linearGradient id={`bpGrad${Math.round(w)}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={theme.mech} />
          <stop offset="100%" stopColor={theme.archive} />
        </linearGradient>
      </defs>
      <line x1={10} y1={22} x2={headX - 4} y2={22} stroke={`url(#bpGrad${Math.round(w)})`} strokeWidth={thick} strokeLinecap="round" strokeDasharray="16 10" strokeDashoffset={-18 * (((flowPhase % 1) + 1) % 1)} />
      <path
        d={`M ${headX - 16} 8 L ${headX + 8} 22 L ${headX - 16} 36`}
        fill="none"
        stroke={theme.archive}
        strokeWidth={thick}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={t > 0.02 ? 1 : 0}
      />
      {/* 起点蓝点（蓝面出发的锚） */}
      <circle cx={8} cy={22} r={6} fill={theme.mech} opacity={0.85} />
    </svg>
  );
};

/** 磁盘文件卡（紫面落盘件——必带路径签）。`rowsLit` 0..8 内容行；`flash` 落账闪；
 *  `sizeTag` 大件长度标尺小签（「超三万」）。 */
export const DiskCard: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  scale?: number;
  lit?: number;
  dim?: number;
  title?: string;
  path?: string;
  rowsLit?: number;
  flash?: number;
  sizeTag?: string;
  sizeTagLit?: number;
}> = ({
  x,
  y,
  w,
  h,
  scale = 1,
  lit = 1,
  dim = 0,
  title = '大结果 · 整份',
  path = '.task_outputs/tool-results/r8.json',
  rowsLit = 0,
  flash = 0,
  sizeTag,
  sizeTagLit = 0,
}) => (
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
        borderRadius: 10,
        border: `3px solid ${theme.archive}`,
        background: withAlpha(theme.panel, 0.96),
        boxShadow: flash > 0.05 ? `0 0 ${26 * clamp01(flash)}px ${withAlpha(theme.archive, 0.55)}` : 'none',
        position: 'relative',
        padding: '12px 14px',
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
        <span style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{title}</span>
        <span style={{fontFamily: theme.mono, fontSize: 11, color: theme.archive}}>{'磁盘'}</span>
      </div>
      {/* 内容行（体量剪影） */}
      <div style={{marginTop: 8}}>
        {Array.from({length: 8}, (_, i) => {
          const p = clamp01(rowsLit - i);
          return <div key={i} style={{height: 7, width: `${88 - ((i * 11) % 36)}%`, borderRadius: 3, background: withAlpha(theme.archive, 0.2 + 0.2 * p), marginBottom: 6, opacity: 0.3 + 0.7 * p}} />;
        })}
      </div>
      {/* 路径签（原文住址——落盘件必带） */}
      <div
        style={{
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: 8,
          padding: '3px 8px',
          borderRadius: 6,
          border: `2px solid ${withAlpha(theme.archive, 0.7)}`,
          fontFamily: theme.mono,
          fontSize: 12,
          color: theme.archive,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {path}
      </div>
      {/* 大件长度标尺小签（「超三万」——右上角贴） */}
      {sizeTag && sizeTagLit > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            right: -12,
            top: -18,
            padding: '2px 10px',
            borderRadius: 7,
            border: `2.5px solid ${theme.archive}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 14,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: clamp01(sizeTagLit),
            transform: 'rotate(3deg)',
          }}
        >
          {sizeTag}
        </div>
      ) : null}
    </div>
  </div>
);

/** 原位小条（路径＋预览两签——大块搬走后蓝面原位留的「住址条」）。 */
export const PathStub: React.FC<{x: number; y: number; w: number; lit?: number; pathLit?: number; previewLit?: number; previewTag?: string}> = ({
  x,
  y,
  w,
  lit = 1,
  pathLit = 0,
  previewLit = 0,
  previewTag = '前 2,000 字符预览',
}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, opacity: clamp01(lit)}}>
    <div
      style={{
        width: '100%',
        boxSizing: 'border-box',
        borderRadius: 8,
        border: `2.5px dashed ${withAlpha(theme.archive, 0.8)}`,
        background: withAlpha(theme.panel, 0.9),
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span
        style={{
          padding: '2px 10px',
          borderRadius: 6,
          border: `2px solid ${theme.archive}`,
          fontFamily: theme.mono,
          fontSize: 12,
          color: theme.archive,
          whiteSpace: 'nowrap',
          opacity: clamp01(pathLit),
        }}
      >
        {'路径签'}
      </span>
      <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', overflow: 'hidden'}}>{'.task_outputs/tool-results/r8.json'}</span>
      <span
        style={{
          marginLeft: 'auto',
          padding: '2px 10px',
          borderRadius: 6,
          border: `2px solid ${withAlpha(theme.archive, 0.8)}`,
          fontFamily: theme.sans,
          fontSize: 12,
          fontWeight: 600,
          color: theme.text,
          whiteSpace: 'nowrap',
          opacity: clamp01(previewLit),
        }}
      >
        {previewTag}
      </span>
    </div>
  </div>
);

/** 占位条（蓝面原位换上的小条——路径签/死字双态）。`foldP` 0..1 折叠缩成过程；
 *  `pathLit` 0..1 路径签亮（「按址取回」点睛）；`dead` 0..1 死字态——整条灰死
 *  （saturate 压暗）+ 路径签改指向空处（叉标）。 */
export const PlaceholderStub: React.FC<{
  x: number;
  y: number;
  w: number;
  h?: number;
  lit?: number;
  foldP?: number;
  pathLit?: number;
  dead?: number;
  flash?: number;
  indexTag?: number;
}> = ({x, y, w, h = 40, lit = 1, foldP = 0, pathLit = 0, dead = 0, flash = 0, indexTag}) => {
  const fold = clamp01(foldP);
  const dd = clamp01(dead);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h * (1 - 0.62 * fold), opacity: clamp01(lit), filter: `saturate(${1 - 0.75 * dd}) brightness(${1 - 0.25 * dd})`}}>
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: 7,
          border: `2.5px ${dd > 0.5 ? 'solid' : 'dashed'} ${dd > 0.5 ? withAlpha(theme.danger, 0.55) : withAlpha(theme.mech, 0.75)}`,
          background: dd > 0.5 ? withAlpha(theme.danger, 0.05) : withAlpha(theme.mech, 0.07),
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          paddingLeft: 10,
          boxShadow: flash > 0.05 ? `0 0 ${12 * clamp01(flash)}px ${withAlpha(dd > 0.5 ? theme.danger : theme.mech, 0.5)}` : 'none',
        }}
      >
        {indexTag !== undefined ? <span style={{fontFamily: theme.mono, fontSize: 11, color: theme.dim}}>{String(indexTag).padStart(2, '0')}</span> : null}
        <span style={{fontFamily: theme.mono, fontSize: 12, color: dd > 0.5 ? theme.danger : theme.mech, whiteSpace: 'nowrap', opacity: 0.9}}>
          {dd > 0.5 ? '死占位 · [saved at …]' : '[Earlier tool result saved at <路径>]'}
        </span>
        {/* 路径签（亮=有住址可取回；死态=指向空处的叉标） */}
        <span
          style={{
            marginLeft: 'auto',
            marginRight: 8,
            padding: '1px 8px',
            borderRadius: 5,
            border: `2px solid ${dd > 0.5 ? theme.danger : theme.archive}`,
            fontFamily: theme.mono,
            fontSize: 11,
            color: dd > 0.5 ? theme.danger : theme.archive,
            whiteSpace: 'nowrap',
            opacity: Math.max(clamp01(pathLit), 0.35 + 0.4 * dd),
          }}
        >
          {dd > 0.5 ? '✗ 按址取不回' : '路径'}
        </span>
      </div>
    </div>
  );
};

/** 留档夹（紫面——2-A 整列复印进夹 / 4-A 先留档复现）。`fillP` 0..1 整列复印
 *  进夹（夹内行数随进度长出）；`flash` 复印落账闪。 */
export const ArchiveFolder: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  scale?: number;
  lit?: number;
  dim?: number;
  fillP?: number;
  rowsMax?: number;
  flash?: number;
  title?: string;
}> = ({x, y, w, h, scale = 1, lit = 1, dim = 0, fillP = 0, rowsMax = 10, flash = 0, title = '留档 · transcript'}) => {
  const fill = clamp01(fillP);
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
      {/* 夹盖（文件夹形——上缘折舌） */}
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: '4px 14px 10px 10px',
          border: `3px solid ${theme.archive}`,
          background: withAlpha(theme.panel, 0.96),
          boxShadow: flash > 0.05 ? `0 0 ${24 * clamp01(flash)}px ${withAlpha(theme.archive, 0.5)}` : 'none',
          position: 'relative',
          padding: '10px 12px',
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{title}</span>
          <span style={{fontFamily: theme.mono, fontSize: 10, color: theme.archive}}>{'.transcripts/'}</span>
        </div>
        {/* 夹内档页（复印进度——行数随 fillP 长出） */}
        <div style={{marginTop: 6}}>
          {Array.from({length: rowsMax}, (_, i) => {
            const p = clamp01(fill * rowsMax - i);
            return <div key={i} style={{height: 6, width: `${92 - ((i * 9) % 30)}%`, borderRadius: 3, background: withAlpha(theme.archive, 0.24), marginBottom: 5, opacity: 0.2 + 0.8 * p}} />;
          })}
        </div>
      </div>
    </div>
  );
};

/** 归档标记（蓝面原位钉回——签面两行小签：裁掉多少 · 全文在哪）。`pinP` 0..1
 *  钉入（自上落钉一拍）。 */
export const ArchiveMark: React.FC<{x: number; y: number; w: number; lit?: number; pinP?: number; cutText?: string; atText?: string}> = ({
  x,
  y,
  w,
  lit = 1,
  pinP = 0,
  cutText = '裁掉 10 条',
  atText = '全文在 .transcripts/',
}) => {
  const pin = clamp01(pinP);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y - 18 * (1 - pin),
        width: w,
        opacity: clamp01(lit) * clamp01(pin * 2),
      }}
    >
      <div
        style={{
          width: '100%',
          boxSizing: 'border-box',
          borderRadius: 7,
          border: `2.5px solid ${theme.archive}`,
          background: withAlpha(theme.panel, 0.95),
          padding: '6px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 13, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{cutText}</span>
        <span style={{fontFamily: theme.mono, fontSize: 11, color: theme.archive, whiteSpace: 'nowrap'}}>{atText}</span>
      </div>
    </div>
  );
};

/** 四步阶梯（第二索引件——0-C 首亮 → 缩影恒驻右上 → 各步逐格点亮 → 4-A 主景
 *  → 5-A 双轴定格收束；三态 = 'mini' | 'main' | 'axes'，缩微前后不重绘——
 *  同一阶梯几何 scale 变换）。`litMask` 0..4 实数（第 N 格亮）；`prewarm4` 0..1
 *  第四格预亮（3-C 钩子）；`axisP` 0..1 成本轴箭头自低向高点亮；`sweepP` 0..1
 *  四卡间贯穿光带掠过（4-D P5 预演）；axes 态 `distortP` 失真轴展开 + `tiersLit`
 *  0..3 三档标注（无损/可恢复/不可恢复——档位高低=成本高低=运行先后）。 */
export const StepLadder: React.FC<{
  x: number;
  y: number;
  scale?: number;
  lit?: number;
  dim?: number;
  mode?: 'mini' | 'main' | 'axes';
  litMask?: number;
  prewarm4?: number;
  axisP?: number;
  sweepP?: number;
  distortP?: number;
  tiersLit?: number;
  settleGlow?: number;
}> = ({
  x,
  y,
  scale = 1,
  lit = 1,
  dim = 0,
  mode = 'main',
  litMask = 0,
  prewarm4 = 0,
  axisP = 0,
  sweepP = 0,
  distortP = 0,
  tiersLit = 0,
  settleGlow = 0,
}) => {
  const STEPS = [
    {no: '①', zh: '大件落盘', en: 'budget', note: '超三万整份写进磁盘'},
    {no: '②', zh: '裁中段', en: 'snip', note: '留档后裁 · 标记带路径'},
    {no: '③', zh: '缩旧结果', en: 'micro', note: '先存盘再换占位条'},
    {no: '④', zh: '全量摘要', en: 'compact', note: '唯一花调用的一步'},
  ] as const;
  const mini = mode === 'mini';
  const cardW = mini ? 46 : 250;
  const cardH = mini ? 34 : 132;
  const stepUp = mini ? 16 : 92;
  const stepRight = mini ? 50 : 262;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity: clamp01(lit) * (1 - dim),
        transform: `scale(${scale})`,
        transformOrigin: 'left top',
        pointerEvents: 'none',
      }}
    >
      <div style={{position: 'relative', width: mini ? 220 : 1080, height: mini ? 108 : 460}}>
        {STEPS.map((s, i) => {
          const on = clamp01(litMask - i);
          const pre = i === 3 ? clamp01(prewarm4) : 0;
          const cx = i * stepRight;
          const cy = (3 - i) * stepUp;
          const border = on > 0.5 || pre > 0.4 ? theme.core : theme.panelBorder;
          return (
            <div
              key={s.no}
              style={{
                position: 'absolute',
                left: cx,
                top: cy,
                width: cardW,
                height: cardH,
                boxSizing: 'border-box',
                borderRadius: mini ? 7 : 14,
                border: `${mini ? 2 : 3}px ${on > 0.05 ? 'solid' : 'dashed'} ${border}`,
                background: on > 0.05 ? withAlpha(theme.panel, 0.96) : 'transparent',
                boxShadow: on > 0.5 ? `0 0 ${16 * on + 12 * pre}px ${withAlpha(theme.core, 0.28 + 0.2 * pre)}` : 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: mini ? 0 : 6,
                opacity: on > 0.05 ? 0.45 + 0.55 * on : 0.4,
                padding: mini ? 0 : '10px 12px',
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: mini ? 15 : 24, fontWeight: 700, color: on > 0.5 ? theme.text : theme.dim}}>{s.no}</span>
              {mini ? null : (
                <>
                  <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: on > 0.5 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{s.zh}</span>
                  <span style={{fontFamily: theme.mono, fontSize: 12, color: on > 0.5 ? theme.core : theme.dim, whiteSpace: 'nowrap'}}>{s.en}</span>
                  {/* 内容行暗态（info dump 禁——亮格才显简述） */}
                  <span style={{fontFamily: theme.sans, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', opacity: on}}>{s.note}</span>
                </>
              )}
            </div>
          );
        })}
        {/* 成本纵轴（低→高箭头自低向高点亮——0-C「便宜的先跑，贵的后跑」） */}
        {!mini ? (
          <svg width={64} height={460} viewBox="0 0 64 460" style={{position: 'absolute', left: -58, top: 0, overflow: 'visible'}}>
            <line x1={30} y1={442} x2={30} y2={442 - 400 * clamp01(axisP)} stroke={withAlpha(theme.dim, 0.85)} strokeWidth={3.5} strokeLinecap="round" />
            <path d={`M 20 ${52 - 400 * clamp01(axisP)} L 30 ${38 - 400 * clamp01(axisP)} L 40 ${52 - 400 * clamp01(axisP)}`} fill="none" stroke={theme.dim} strokeWidth={3.5} strokeLinecap="round" opacity={clamp01(axisP)} />
            <text x={40} y={446} fontFamily={theme.sans} fontSize={15} fill={theme.dim}>
              {'成本 低'}
            </text>
            <text x={40} y={26} fontFamily={theme.sans} fontSize={15} fill={theme.dim} opacity={clamp01(axisP)}>
              {'高'}
            </text>
          </svg>
        ) : null}
        {/* 双轴定格（5-A axes 态——失真轴横向展开 + 三档标注） */}
        {mode === 'axes' ? (
          <>
            {/* 失真横轴（无损 → 不可恢复） */}
            <svg width={1080} height={54} viewBox="0 0 1080 54" style={{position: 'absolute', left: 0, top: 460, overflow: 'visible'}}>
              <line x1={10} y1={26} x2={10 + 1040 * clamp01(distortP)} y2={26} stroke={withAlpha(theme.danger, 0.7)} strokeWidth={3} strokeLinecap="round" />
              <path d={`M ${1044 - 26 * (1 - clamp01(distortP))} 16 L ${1048} 26 L ${1044 - 26 * (1 - clamp01(distortP))} 36`} fill="none" stroke={theme.danger} strokeWidth={3} strokeLinecap="round" opacity={clamp01(distortP)} />
              <text x={14} y={12} fontFamily={theme.sans} fontSize={15} fill={theme.dim}>
                {'失真 无损'}
              </text>
              <text x={980} y={50} fontFamily={theme.sans} fontSize={15} fill={theme.danger} opacity={clamp01(distortP)}>
                {'不可恢复'}
              </text>
            </svg>
            {/* 三档标注（档位线——逐档点亮；低先跑、最高档垫底压轴） */}
            {[
              {zh: '无损先做', at: 0},
              {zh: '可恢复的居中', at: 1},
              {zh: '不可恢复的垫底', at: 2},
            ].map((t, i) => {
              const on = clamp01(tiersLit - i);
              return (
                <div
                  key={t.zh}
                  style={{
                    position: 'absolute',
                    left: 60 + i * 340,
                    top: 500,
                    padding: '5px 16px',
                    borderRadius: 8,
                    border: `2.5px solid ${i === 2 ? theme.danger : i === 1 ? theme.core : theme.ok}`,
                    background: theme.panel,
                    fontFamily: theme.sans,
                    fontSize: 18,
                    fontWeight: 700,
                    color: i === 2 ? theme.danger : i === 1 ? theme.core : theme.ok,
                    whiteSpace: 'nowrap',
                    opacity: on,
                    transform: `translateY(${(1 - on) * 12}px)`,
                  }}
                >
                  {t.zh}
                </div>
              );
            })}
          </>
        ) : null}
        {/* 贯穿光带（4-D 原则预演——四卡间一道掠过；坐标随 mode 容器宽走） */}
        {sweepP > 0.01 && sweepP < 0.99 ? (
          <div
            style={{
              position: 'absolute',
              left: -10 + (mini ? 250 : 1120) * clamp01(sweepP),
              top: -12,
              width: mini ? 5 : 8,
              height: mini ? 130 : 480,
              borderRadius: 4,
              background: `linear-gradient(${withAlpha(theme.text, 0)}, ${withAlpha(theme.text, 0.75)}, ${withAlpha(theme.text, 0)})`,
              boxShadow: `0 0 ${mini ? 10 : 20}px ${withAlpha(theme.text, 0.5)}`,
              opacity: Math.sin(Math.PI * clamp01(sweepP)),
              pointerEvents: 'none',
            }}
          />
        ) : null}
        {/* 定格辉光（5-A 收束呼吸） */}
        {settleGlow > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              inset: -18,
              borderRadius: 22,
              border: `${3}px solid ${withAlpha(theme.core, 0.5 * clamp01(settleGlow))}`,
              boxShadow: `0 0 ${36 * clamp01(settleGlow)}px ${withAlpha(theme.core, 0.3)}`,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

/** 判定轴（3-A——消息时间轴：分界灯 + 已读紫/未读蓝双色）。`blocks` 自左（旧）
 *  至右（新）；`markerP` 位标落定（模型最近一次回复）；`lampP` 分界灯亮（唯一
 *  竖向分隔）；`shieldLit` 未读蓝罩（分界后）；`seenLit` 已读紫框（分界前）；
 *  `clockCrossP` 轴端时间刻度划掉 + `readTagP`「读没读过」小签（判定换轴）；
 *  `shake` 整轴轻晃位移 px；`breakP` 未读块与模型视野圈断线一拍。 */
export const TimelineAxis: React.FC<{
  x: number;
  y: number;
  w: number;
  lit?: number;
  blocks: readonly {seen: boolean; big?: boolean}[];
  blocksLit?: number;
  markerP?: number;
  lampP?: number;
  shieldLit?: number;
  seenLit?: number;
  lockFlash?: number;
  clockCrossP?: number;
  readTagP?: number;
  shake?: number;
  breakP?: number;
  eyeP?: number;
}> = ({
  x,
  y,
  w,
  lit = 1,
  blocks,
  blocksLit = 0,
  markerP = 0,
  lampP = 0,
  shieldLit = 0,
  seenLit = 0,
  lockFlash = 0,
  clockCrossP = 0,
  readTagP = 0,
  shake = 0,
  breakP = 0,
  eyeP = 0,
}) => {
  const n = blocks.length;
  const markerIdx = n - 3; // 「最近一次回复」位标格（右侧倒数第三块处）
  const bw = Math.min(120, (w - 40) / n - 10);
  return (
    <div style={{position: 'absolute', left: x + shake, top: y, width: w, opacity: clamp01(lit)}}>
      <div style={{position: 'relative', height: 240}}>
        {/* 时间轴主线（水平主轴——身份线索） */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 196, height: 0, borderTop: `3.5px solid ${withAlpha(theme.dim, 0.8)}`}} />
        {/* 轴端时间刻度（被划掉——判定不按时间） */}
        <div style={{position: 'absolute', right: -8, top: 186, fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.85}}>
          {'时间 →'}
        </div>
        {clamp01(clockCrossP) > 0.02 ? (
          <svg width={96} height={30} viewBox="0 0 96 30" style={{position: 'absolute', right: -12, top: 172, overflow: 'visible', opacity: clamp01(clockCrossP)}}>
            <line x1={4} y1={24} x2={88} y2={6} stroke={theme.danger} strokeWidth={4} strokeLinecap="round" />
          </svg>
        ) : null}
        {/* 「读没读过」小签（判定换轴——划掉时间后改挂） */}
        {clamp01(readTagP) > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              right: -6,
              top: 216,
              padding: '3px 12px',
              borderRadius: 7,
              border: `2.5px solid ${theme.text}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 15,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: clamp01(readTagP),
            }}
          >
            {'读没读过'}
          </div>
        ) : null}
        {/* 块阵（左旧右新；seen=已读可折叠紫框 / 未读=蓝罩） */}
        {blocks.map((b, i) => {
          const p = clamp01(blocksLit - i);
          const isSeen = b.seen;
          const seenGlow = isSeen ? clamp01(seenLit) : 0;
          const shield = !isSeen ? clamp01(shieldLit) : 0;
          const bx = 20 + i * (bw + 10);
          return (
            <div key={i} style={{position: 'absolute', left: bx, top: 60, width: bw, height: 118, opacity: 0.3 + 0.7 * p}}>
              <div
                style={{
                  width: '100%',
                  height: b.big ? 136 : 104,
                  marginTop: b.big ? -18 : 0,
                  boxSizing: 'border-box',
                  borderRadius: 8,
                  border: `2.5px ${isSeen ? 'solid' : 'solid'} ${isSeen ? (seenGlow > 0.4 ? theme.archive : withAlpha(theme.panelBorder, 0.95)) : withAlpha(theme.mech, 0.5)}`,
                  background: isSeen ? 'transparent' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.sans,
                  fontSize: 14,
                  color: theme.dim,
                  whiteSpace: 'nowrap',
                }}
              >
                {b.big ? (
                  <span style={{fontFamily: theme.mono, fontSize: 16, fontWeight: 700, color: theme.dim}}>{'超大 +'}</span>
                ) : isSeen ? (
                  <span style={{opacity: seenGlow}}>{'已读'}</span>
                ) : (
                  <span>{'未读'}</span>
                )}
              </div>
              {/* 未读保护罩（蓝罩+锁——信息从未到达） */}
              {shield > 0.02 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: -4,
                    top: b.big ? -22 : -4,
                    width: bw + 8,
                    height: (b.big ? 136 : 104) + 8,
                    borderRadius: 10,
                    border: `3px solid ${withAlpha(theme.mech, 0.6 + 0.35 * shield)}`,
                    background: withAlpha(theme.mech, 0.1 * shield),
                    boxShadow: lockFlash > 0.05 ? `0 0 ${16 * clamp01(lockFlash)}px ${withAlpha(theme.mech, 0.6)}` : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-end',
                    opacity: shield,
                    pointerEvents: 'none',
                  }}
                >
                  <span style={{fontFamily: theme.sans, fontSize: 11, fontWeight: 700, color: theme.mech, padding: '2px 6px'}}>{'锁'}</span>
                </div>
              ) : null}
            </div>
          );
        })}
        {/* 位标（模型最近一次回复——倒三角落定） */}
        {clamp01(markerP) > 0.02 ? (
          <svg width={40} height={40} viewBox="0 0 40 40" style={{position: 'absolute', left: 20 + markerIdx * (bw + 10) + bw / 2 - 20, top: 156 - 26 * clamp01(markerP), overflow: 'visible', opacity: clamp01(markerP)}}>
            <path d="M 6 8 L 34 8 L 20 30 Z" fill={theme.core} />
            <text x={46} y={20} fontFamily={theme.sans} fontSize={13} fill={theme.text}>
              {'最近回复'}
            </text>
          </svg>
        ) : null}
        {/* 分界灯（位标右侧竖线+灯点——唯一竖向分隔） */}
        {clamp01(lampP) > 0.02 ? (
          <div style={{position: 'absolute', left: 20 + (markerIdx + 1) * (bw + 10) - 6, top: 40, height: 178, opacity: clamp01(lampP)}}>
            <div style={{width: 0, height: '100%', borderLeft: `4px solid ${theme.core}`}} />
            <div
              style={{
                position: 'absolute',
                left: -9,
                top: -10,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: theme.core,
                boxShadow: `0 0 ${20 * clamp01(lampP)}px ${withAlpha(theme.core, 0.8)}`,
              }}
            />
          </div>
        ) : null}
        {/* 模型侧视野圈（右端——未读块与它断线一拍） */}
        {clamp01(eyeP) > 0.02 ? (
          <>
            <div
              style={{
                position: 'absolute',
                right: -60,
                top: 64,
                width: 92,
                height: 92,
                borderRadius: '50%',
                border: `3px dashed ${withAlpha(theme.text, 0.65)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.sans,
                fontSize: 15,
                color: theme.text,
                opacity: clamp01(eyeP),
              }}
            >
              {'模型'}
            </div>
            {clamp01(breakP) > 0.02 ? (
              <svg width={130} height={30} viewBox="0 0 130 30" style={{position: 'absolute', right: -80, top: 96, overflow: 'visible', opacity: clamp01(breakP)}}>
                <line x1={4} y1={15} x2={124} y2={15} stroke={theme.danger} strokeWidth={4} strokeDasharray="8 6" />
                <path d="M 10 8 L 2 15 L 10 22 M 118 8 L 126 15 L 118 22" fill="none" stroke={theme.danger} strokeWidth={4} strokeLinecap="round" />
              </svg>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
};

/** 已付款·未到货单据卡（3-B 类比一拍——≤3 拍即收）。`payP` 付款动画；`emptyP`
 *  货位空空；`secondP` 第二张单据浮起（买家再下一单）；`onceP`「一次性」小签；
 *  `restockP` 补货=重跑双小签并列（重跑工具 + 再付调用）。 */
export const ReceiptCard: React.FC<{
  x: number;
  y: number;
  lit?: number;
  payP?: number;
  emptyP?: number;
  secondP?: number;
  onceP?: number;
  restockP?: number;
  qP?: number;
}> = ({x, y, lit = 1, payP = 0, emptyP = 0, secondP = 0, onceP = 0, restockP = 0, qP = 0}) => (
  <div style={{position: 'absolute', left: x, top: y, opacity: clamp01(lit), width: 560}}>
    <div
      style={{
        width: 520,
        boxSizing: 'border-box',
        borderRadius: 12,
        border: `3px solid ${withAlpha(theme.dim, 0.85)}`,
        background: withAlpha(theme.panel, 0.96),
        padding: '14px 18px',
        position: 'relative',
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
        <span style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.text}}>{'订单 · 工具结果'}</span>
        <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'tool_result'}</span>
      </div>
      {/* 付款行（款付了——付款条充满 + 勾） */}
      <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 12}}>
        <div style={{flex: 1, height: 18, borderRadius: 5, border: `2px solid ${theme.ok}`, background: withAlpha(theme.ok, 0.12 * clamp01(payP)), position: 'relative', overflow: 'hidden'}}>
          <div style={{position: 'absolute', inset: 0, width: `${100 * clamp01(payP)}%`, background: withAlpha(theme.ok, 0.4)}} />
        </div>
        <span style={{fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.ok, opacity: clamp01(payP)}}>{'款付了'}</span>
      </div>
      {/* 货位（货没送到——空框） */}
      <div
        style={{
          marginTop: 12,
          height: 84,
          borderRadius: 9,
          border: `2.5px dashed ${withAlpha(theme.dim, 0.5 + 0.3 * clamp01(emptyP))}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          fontFamily: theme.sans,
          fontSize: 16,
          color: theme.dim,
          opacity: 0.55 + 0.45 * clamp01(emptyP),
        }}
      >
        {'货位'}
        <span style={{fontWeight: 700, color: theme.danger, opacity: clamp01(emptyP)}}>{'空 · 货没送到'}</span>
      </div>
      {/* 「一次性」小签 + 补货双小签（重跑工具 · 再付调用） */}
      <div style={{display: 'flex', gap: 10, marginTop: 12, alignItems: 'center'}}>
        <span
          style={{
            padding: '3px 12px',
            borderRadius: 7,
            border: `2px solid ${theme.text}`,
            fontFamily: theme.sans,
            fontSize: 14,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: clamp01(onceP),
          }}
        >
          {'一次性'}
        </span>
        {['重跑工具', '再付调用'].map((t, k) => (
          <span
            key={t}
            style={{
              padding: '3px 12px',
              borderRadius: 7,
              border: `2px solid ${theme.danger}`,
              background: withAlpha(theme.danger, 0.08),
              fontFamily: theme.sans,
              fontSize: 14,
              fontWeight: 700,
              color: theme.danger,
              whiteSpace: 'nowrap',
              opacity: clamp01(restockP) * (k === 0 ? 1 : clamp01(restockP * 2 - 1)),
            }}
          >
            {`补货=${t}`}
          </span>
        ))}
      </div>
      {/* 模型端问号（买家侧第二张单据前的迟疑） */}
      {clamp01(qP) > 0.02 ? (
        <span style={{position: 'absolute', right: 26, top: 54, fontFamily: theme.serif, fontSize: 52, fontWeight: 700, color: theme.text, opacity: clamp01(qP)}}>{'？'}</span>
      ) : null}
    </div>
    {/* 第二张单据（浮起——再下一单） */}
    {clamp01(secondP) > 0.02 ? (
      <div
        style={{
          marginTop: 14,
          width: 520,
          boxSizing: 'border-box',
          borderRadius: 12,
          border: `3px solid ${theme.danger}`,
          background: withAlpha(theme.danger, 0.06),
          padding: '10px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          opacity: clamp01(secondP),
          transform: `translateY(${(1 - clamp01(secondP)) * 22}px)`,
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.danger}}>{'第二张单据 · 再调一次'}</span>
        <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'tool_use ×2'}</span>
      </div>
    ) : null}
  </div>
);

/** 消融单轨（2-C 左红右绿之单元——双轨除步骤序外全同构）。`mode` 'swap'=换序
 *  （占位条成片出现、紫面空空、落盘计数 1→0、死占位逐枚灰死）/ 'proper'=正序
 *  （占位带路径、副本卡 1:1、落盘 1 份）；`stampsLit` 0..11 占位条显形；
 *  `deadP` 0..11 死字灰死；`copiesLit` 0..11 副本卡；`swapFlash` 步骤序倒转
 *  闪一拍；`magP` 放大镜扫过（p2-08 蓝面无原文）；`xP` 红叉落下。双计数位
 *  读数（落盘份/死占位处）由场景算好传入。 */
export const AblationTrack: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  mode: 'swap' | 'proper';
  accent: string;
  tag: string;
  sub: string;
  stampsLit?: number;
  deadP?: number;
  copiesLit?: number;
  swapFlash?: number;
  magP?: number;
  xP?: number;
  savedCount: string;
  deadCount: string;
  countsLit?: number;
  countsFlash?: number;
}> = ({
  x,
  y,
  w = 860,
  h = 690,
  mode,
  accent,
  tag,
  sub,
  stampsLit = 0,
  deadP = 0,
  copiesLit = 0,
  swapFlash = 0,
  magP = 0,
  xP = 0,
  savedCount,
  deadCount,
  countsLit = 0,
  countsFlash = 0,
}) => {
  const STAMPS = 11;
  // 占位条阵总宽 ≤ w-330（右侧 250 紫面 + 20 padding + 60 净空）
  const stampW = (w - 330 - (STAMPS - 1) * 8 - 20) / STAMPS;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h}}>
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: 16,
          border: `3.5px solid ${accent}`,
          background: withAlpha(theme.panel, 0.92),
          position: 'relative',
          boxShadow: swapFlash > 0.05 ? `0 0 ${24 * clamp01(swapFlash)}px ${withAlpha(accent, 0.5)}` : 'none',
          padding: '16px 20px',
        }}
      >
      {/* 头行：轨名 + 工况角标 */}
      <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
        <span style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 700, color: accent}}>{tag}</span>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 12,
            color: theme.dim,
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 6,
            padding: '1px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          {sub}
        </span>
      </div>
      {/* 缩微消息列（占位条阵——11 枚） */}
      <div style={{display: 'flex', gap: 8, marginTop: 22, alignItems: 'flex-end', height: 96}}>
        {Array.from({length: STAMPS}, (_, i) => {
          const on = clamp01(stampsLit - i);
          const dead = mode === 'swap' ? clamp01(deadP - i) : 0;
          return (
            <div
              key={i}
              style={{
                width: stampW,
                height: 84,
                boxSizing: 'border-box',
                borderRadius: 6,
                border: `2px ${dead > 0.5 ? 'solid' : 'dashed'} ${dead > 0.5 ? withAlpha(theme.danger, 0.55) : withAlpha(theme.mech, 0.7)}`,
                background: dead > 0.5 ? withAlpha(theme.danger, 0.06) : withAlpha(theme.mech, 0.07),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                opacity: 0.3 + 0.7 * on,
                filter: `saturate(${1 - 0.7 * dead})`,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 10, color: dead > 0.5 ? theme.danger : theme.mech}}>{dead > 0.5 ? '死' : '占'}</span>
              <span style={{fontFamily: theme.mono, fontSize: 9, color: dead > 0.5 ? theme.danger : theme.archive, whiteSpace: 'nowrap'}}>{dead > 0.5 ? '✗' : '址'}</span>
            </div>
          );
        })}
        {/* 放大镜（扫过占位条——蓝面无原文；p2-08。基准=内层 relative 框，
            沿占位条阵横扫） */}
        {clamp01(magP) > 0.02 && clamp01(magP) < 0.98 ? (
          <svg width={64} height={64} viewBox="0 0 64 64" style={{position: 'absolute', left: 30 + magP * (w - 130), top: 84, overflow: 'visible', opacity: Math.sin(Math.PI * clamp01(magP))}}>
            <circle cx={26} cy={26} r={17} fill="none" stroke={theme.text} strokeWidth={4} />
            <line x1={38} y1={38} x2={54} y2={54} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
          </svg>
        ) : null}
      </div>
      {/* 缩微紫面（右——swap: 空空 / proper: 副本卡与占位 1:1 可数） */}
      <div
        style={{
          position: 'absolute',
          right: 20,
          top: 96,
          width: 250,
          height: 220,
          boxSizing: 'border-box',
          borderRadius: 10,
          border: `3px ${mode === 'swap' ? 'dashed' : 'solid'} ${mode === 'swap' ? withAlpha(theme.archive, 0.4) : theme.archive}`,
          background: mode === 'swap' ? 'transparent' : withAlpha(theme.archive, 0.05),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: 8,
        }}
      >
        {mode === 'swap' ? (
          <span style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim}}>{'磁盘 · 空空'}</span>
        ) : (
          <>
            <span style={{fontFamily: theme.sans, fontSize: 14, fontWeight: 700, color: theme.archive}}>{'磁盘副本 ×11'}</span>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center'}}>
              {Array.from({length: 11}, (_, i) => {
                const on = clamp01(copiesLit - i);
                return (
                  <div
                    key={i}
                    style={{
                      width: 34,
                      height: 22,
                      borderRadius: 4,
                      border: `2px solid ${on > 0.4 ? theme.archive : theme.panelBorder}`,
                      background: withAlpha(theme.archive, 0.12 * on),
                      opacity: on,
                    }}
                  />
                );
              })}
            </div>
            <span style={{fontFamily: theme.mono, fontSize: 10, color: theme.archive}}>{'1:1 · 带路径'}</span>
          </>
        )}
        {/* 红叉（紫面空处落下——p2-08 两无的可视） */}
        {clamp01(xP) > 0.02 ? (
          <span style={{fontFamily: theme.sans, fontSize: 44, fontWeight: 700, color: theme.danger, opacity: clamp01(xP)}}>{'✗'}</span>
        ) : null}
      </div>
      {/* 双计数位（落盘份 / 死占位处——数据本体：场景传闭合字符串） */}
      <div style={{position: 'absolute', left: 20, bottom: 84, display: 'flex', gap: 18, alignItems: 'baseline'}}>
        {[
          {zh: '完整落盘', val: savedCount, hot: mode === 'proper'},
          {zh: '死占位', val: deadCount, hot: mode === 'swap'},
        ].map((c) => (
          <div key={c.zh} style={{display: 'flex', alignItems: 'baseline', gap: 8, opacity: clamp01(countsLit)}}>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 52,
                fontWeight: 700,
                color: c.hot ? accent : theme.dim,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
                textShadow: clamp01(countsFlash) > 0.05 ? `0 0 ${16 * clamp01(countsFlash)}px ${withAlpha(c.hot ? accent : theme.dim, 0.6)}` : 'none',
              }}
            >
              {c.val}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>{`${c.zh} · 份/处`}</span>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
};

/** 调用令牌闸机（4-A——全片唯一付费位）。`tokenFly` 0..1 令牌自画外飞入；
 *  `tokenDrop` 0..1 投入闸机（令牌落进投口）；`gateOpen` 0..1 闸门开启（两板
 *  上抬）；`gateFlash` 开闸辉光。 */
export const TokenGate: React.FC<{x: number; y: number; scale?: number; lit?: number; tokenFly?: number; tokenDrop?: number; gateOpen?: number; gateFlash?: number}> = ({
  x,
  y,
  scale = 1,
  lit = 1,
  tokenFly = 0,
  tokenDrop = 0,
  gateOpen = 0,
  gateFlash = 0,
}) => {
  const fly = clamp01(tokenFly);
  const drop = clamp01(tokenDrop);
  // 令牌两段轨迹：画外（上方 -260）→ 飞至投口上方（-10）→ 投口内落下（+70 消隐）
  const tokenY = drop > 0.005 ? -10 + 80 * drop : -260 + 250 * fly;
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: clamp01(lit), transform: `scale(${scale})`, transformOrigin: 'center bottom'}}>
      <svg width={200} height={190} viewBox="0 0 200 190" style={{overflow: 'visible'}}>
        {/* 闸机体（基座+两闸板） */}
        <rect x={16} y={86} width={168} height={18} rx={5} fill={theme.panel} stroke={withAlpha(theme.text, 0.85)} strokeWidth={3.5} />
        {/* 闸板（开启=两板上抬让位） */}
        <line x1={54} y1={86 - 62 * clamp01(gateOpen)} x2={54} y2={86 - 62 * clamp01(gateOpen) + 62} stroke={theme.core} strokeWidth={7} strokeLinecap="round" />
        <line x1={146} y1={86 - 62 * clamp01(gateOpen)} x2={146} y2={86 - 62 * clamp01(gateOpen) + 62} stroke={theme.core} strokeWidth={7} strokeLinecap="round" />
        {/* 支柱 */}
        <rect x={20} y={104} width={10} height={70} fill={withAlpha(theme.panelBorder, 0.9)} />
        <rect x={170} y={104} width={10} height={70} fill={withAlpha(theme.panelBorder, 0.9)} />
        {/* 投口（令牌投进的位置——顶面凹槽） */}
        <rect x={76} y={72} width={48} height={12} rx={4} fill={theme.bg} stroke={withAlpha(theme.text, 0.7)} strokeWidth={2.5} />
        {/* 开闸辉光 */}
        {clamp01(gateFlash) > 0.05 ? <ellipse cx={100} cy={86} rx={70} ry={20} fill={withAlpha(theme.core, 0.25 * clamp01(gateFlash))} /> : null}
      </svg>
      {/* 调用令牌（圆片——「调用」刻字；飞入→投口） */}
      {fly > 0.01 && drop < 0.95 ? (
        <div
          style={{
            position: 'absolute',
            left: 96,
            top: tokenY,
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: `4px solid ${theme.core}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 15,
            fontWeight: 700,
            color: theme.text,
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 18px ${withAlpha(theme.core, 0.45)}`,
            opacity: clamp01(Math.min(fly * 3, 1) * (1 - Math.max(0, drop - 0.8) * 5)),
          }}
        >
          {'调用'}
        </div>
      ) : null}
    </div>
  );
};

/** 计费小卡（3-C 恒 0 / 3-B 两道划扣 / 4-A 唯一 +1——同卡三用）。`charges`
 *  0..2 实数划扣道数（道道可数）；`big` 0..1 放大一拍（零调用总账定格）。 */
export const BillingCard: React.FC<{x: number; y: number; lit?: number; charges?: number; big?: number; caption?: string}> = ({
  x,
  y,
  lit = 1,
  charges = 0,
  big = 0,
  caption = '调用计费',
}) => {
  const ch = Math.min(2, Math.max(0, charges));
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: clamp01(lit), transform: `scale(${1 + 0.22 * clamp01(big)})`, transformOrigin: 'left top'}}>
      <div
        style={{
          padding: '10px 16px',
          borderRadius: 10,
          border: `3px solid ${ch > 0.5 ? theme.danger : theme.ok}`,
          background: theme.panel,
          boxShadow: clamp01(big) > 0.3 ? `0 0 ${20 * clamp01(big)}px ${withAlpha(ch > 0.5 ? theme.danger : theme.ok, 0.4)}` : 'none',
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap'}}>{caption}</div>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 4}}>
          {/* 大读数（划扣次数——数据本体：Math.round 有界值直取，不经 clamp01） */}
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 44,
              fontWeight: 700,
              color: ch > 0.5 ? theme.danger : theme.ok,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {String(Math.round(ch))}
          </span>
          {/* 划扣道（两道杠——逐道落下可数） */}
          <div style={{display: 'flex', gap: 5, alignItems: 'center'}}>
            {[0, 1].map((i) => {
              const on = clamp01(ch - i);
              return (
                <div
                  key={i}
                  style={{
                    width: 26,
                    height: 6,
                    borderRadius: 3,
                    background: on > 0.5 ? theme.danger : theme.panelBorder,
                    opacity: 0.4 + 0.6 * on,
                    transform: `rotate(-18deg) scale(${0.8 + 0.2 * on})`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/** 摘要卡双段（4-B 主装置——上段「当前请求」/ 下段「对话摘要·仅供参考」+ 分隔
 *  光带 + 滤网）。`genP` 0..1 自消息列整列压缩生成（4-A 末）；`segP` 双段展开；
 *  `bandP` 分隔光带亮；`bandWideP` 加宽一拍（混排预演后「分开即解」）；
 *  `userTagP` 工具结果条携用户名签滑入上段侧；`mixP` 混排预演（指令句与结果条
 *  同段交叠）+ `qP` 问号闪；`filterP` 滤网落下；`smuggleFly` 夹带条飞向滤网；
 *  `blockedP` 撞网被拦；`factP` 落入下段变事实记录（带「不执行」小签）。 */
export const SummaryCard: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  lit?: number;
  genP?: number;
  segP?: number;
  bandP?: number;
  bandWideP?: number;
  userTagP?: number;
  mixP?: number;
  qP?: number;
  filterP?: number;
  smuggleFly?: number;
  blockedP?: number;
  factP?: number;
}> = ({
  x,
  y,
  w,
  h,
  lit = 1,
  genP = 0,
  segP = 0,
  bandP = 0,
  bandWideP = 0,
  userTagP = 0,
  mixP = 0,
  qP = 0,
  filterP = 0,
  smuggleFly = 0,
  blockedP = 0,
  factP = 0,
}) => {
  const seg = clamp01(segP);
  const bandW = 10 + 26 * clamp01(bandWideP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: clamp01(lit) * (0.3 + 0.7 * clamp01(genP))}}>
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: 14,
          border: `3.5px solid ${theme.core}`,
          background: withAlpha(theme.panel, 0.97),
          position: 'relative',
          overflow: 'hidden',
          padding: '14px 18px',
        }}
      >
        {/* 上段（当前请求） */}
        <div style={{height: h * 0.42 * seg, overflow: 'hidden'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
            <span style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'当前请求'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 11, color: theme.dim}}>{'active_request'}</span>
          </div>
          {/* 指令句（此刻的指令——上段常驻行） */}
          <div style={{marginTop: 8, padding: '5px 10px', borderRadius: 6, border: `2px solid ${withAlpha(theme.text, 0.6)}`, display: 'inline-block', fontFamily: theme.sans, fontSize: 14, color: theme.text, whiteSpace: 'nowrap'}}>
            {'「帮我把缩进改成制表符」'}
          </div>
          {/* 工具结果条携用户名签（记在用户名下——滑入上段侧） */}
          {clamp01(userTagP) > 0.02 ? (
            <div
              style={{
                marginTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 10px',
                borderRadius: 6,
                border: `2px solid ${withAlpha(theme.mech, 0.7)}`,
                background: withAlpha(theme.mech, 0.07),
                transform: `translateX(${(1 - clamp01(userTagP)) * -40}px)`,
                opacity: clamp01(userTagP),
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 11, color: theme.mech}}>{'用户名下'}</span>
              <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'tool_result'}</span>
            </div>
          ) : null}
          {/* 混排预演（指令句与结果条同段交叠——错位叠压 + 问号） */}
          {clamp01(mixP) > 0.02 ? (
            <div style={{position: 'relative', height: 44, marginTop: 4, opacity: clamp01(mixP)}}>
              <div style={{position: 'absolute', left: 22, top: 6, padding: '4px 10px', borderRadius: 6, border: `2px solid ${withAlpha(theme.text, 0.6)}`, fontFamily: theme.sans, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap', transform: 'rotate(-1.5deg)'}}>
                {'此刻的指令？'}
              </div>
              <div style={{position: 'absolute', left: 66, top: 20, padding: '4px 10px', borderRadius: 6, border: `2px solid ${withAlpha(theme.mech, 0.6)}`, fontFamily: theme.mono, fontSize: 11, color: theme.dim, whiteSpace: 'nowrap', transform: 'rotate(1.2deg)'}}>
                {'tool_result'}
              </div>
              {clamp01(qP) > 0.02 ? <span style={{position: 'absolute', right: 8, top: 2, fontFamily: theme.serif, fontSize: 30, fontWeight: 700, color: theme.danger, opacity: clamp01(qP)}}>{'？'}</span> : null}
            </div>
          ) : null}
        </div>
        {/* 分隔光带（双段分隔——加宽一拍=「分开即解」） */}
        <div
          style={{
            width: '100%',
            height: bandW * clamp01(bandP),
            borderRadius: 6,
            background: `linear-gradient(90deg, ${withAlpha(theme.core, 0)}, ${withAlpha(theme.core, 0.55)}, ${withAlpha(theme.core, 0)})`,
            boxShadow: clamp01(bandP) > 0.4 ? `0 0 ${16 * clamp01(bandP)}px ${withAlpha(theme.core, 0.5)}` : 'none',
          }}
        />
        {/* 下段（对话摘要·仅供参考） */}
        <div style={{height: h * 0.5 * seg, overflow: 'hidden', paddingTop: 8}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
            <span style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'对话摘要'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 11, color: theme.dim}}>{'仅供参考 · [Compacted]'}</span>
          </div>
          {/* 摘要行（事实记录——事实句样式） */}
          <div style={{marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6}}>
            {['用户有代码风格偏好', '任务：改缩进为制表符'].map((t) => (
              <div key={t} style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <span style={{width: 8, height: 8, borderRadius: 2, background: withAlpha(theme.dim, 0.7), display: 'inline-block'}} />
                <span style={{fontFamily: theme.sans, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap'}}>{t}</span>
              </div>
            ))}
            {/* 夹带条终态（事实记录——带「不执行」小签） */}
            {clamp01(factP) > 0.02 ? (
              <div style={{display: 'flex', alignItems: 'center', gap: 8, opacity: clamp01(factP)}}>
                <span style={{width: 8, height: 8, borderRadius: 2, background: theme.core, display: 'inline-block'}} />
                <span style={{fontFamily: theme.sans, fontSize: 14, color: theme.text, whiteSpace: 'nowrap'}}>{'「用户要求以后都执行某命令」——记为事实'}</span>
                <span
                  style={{
                    padding: '1px 8px',
                    borderRadius: 5,
                    border: `2px solid ${theme.ok}`,
                    fontFamily: theme.sans,
                    fontSize: 11,
                    fontWeight: 700,
                    color: theme.ok,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {'不执行'}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        {/* 滤网（入口横网——防夹带的唯一拦截件） */}
        {clamp01(filterP) > 0.02 ? (
          <svg width={w - 36} height={40} viewBox={`0 0 ${w - 36} 40`} style={{position: 'absolute', left: 18, top: -34 * (1 - clamp01(filterP)) + 2, overflow: 'visible', pointerEvents: 'none'}}>
            {Array.from({length: 9}, (_, i) => (
              <line key={i} x1={16 + i * ((w - 68) / 8)} y1={4} x2={16 + i * ((w - 68) / 8)} y2={34} stroke={theme.tool} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
            ))}
            <line x1={8} y1={4} x2={w - 44} y2={4} stroke={theme.tool} strokeWidth={3} opacity={0.85} />
          </svg>
        ) : null}
        {/* 夹带小字条（「以后都执行某命令」——飞向滤网、撞网被拦） */}
        {clamp01(smuggleFly) > 0.01 ? (
          <div
            style={{
              position: 'absolute',
              left: w * 0.28 + w * 0.4 * (1 - clamp01(blockedP)),
              top: -74 + 96 * clamp01(smuggleFly) * (1 - clamp01(blockedP)),
              padding: '4px 12px',
              borderRadius: 7,
              border: `2.5px solid ${clamp01(blockedP) > 0.5 ? theme.danger : withAlpha(theme.text, 0.7)}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 14,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: clamp01(smuggleFly * 2) * (1 - clamp01(factP)),
            }}
          >
            {'「以后都执行某命令」'}
            {clamp01(blockedP) > 0.5 ? <span style={{color: theme.danger, marginLeft: 8, fontWeight: 700}}>{'拦'}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 三格保险丝（4-D——连败三次熔断）。`litP` 0..1 三格亮出；`burnP` 0..1 第三格
 *  烧断（断口分离+焦黑+闪——烧断恰发生在第三格）。 */
export const FuseCard: React.FC<{x: number; y: number; lit?: number; litP?: number; burnP?: number; burnFlash?: number}> = ({
  x,
  y,
  lit = 1,
  litP = 0,
  burnP = 0,
  burnFlash = 0,
}) => {
  const burn = clamp01(burnP);
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: clamp01(lit)}}>
      <div style={{fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.text, marginBottom: 10}}>
        {'连续失败 · 熔断'}
        <span style={{fontFamily: theme.mono, fontSize: 11, color: theme.dim, marginLeft: 10}}>{'3 次'}</span>
      </div>
      <div style={{display: 'flex', gap: 14, alignItems: 'center'}}>
        {[0, 1, 2].map((i) => {
          const on = clamp01(litP * 3 - i);
          const burnt = i === 2 && burn > 0.5;
          return (
            <div key={i} style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
              <div
                style={{
                  width: 74,
                  height: 34,
                  boxSizing: 'border-box',
                  borderRadius: 8,
                  border: `3px solid ${burnt ? theme.danger : on > 0.5 ? theme.ok : theme.panelBorder}`,
                  background: burnt ? withAlpha(theme.danger, 0.12) : on > 0.5 ? withAlpha(theme.ok, 0.1) : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.mono,
                  fontSize: 14,
                  fontWeight: 700,
                  color: burnt ? theme.danger : on > 0.5 ? theme.text : theme.dim,
                  opacity: 0.4 + 0.6 * on,
                  boxShadow: i === 2 && clamp01(burnFlash) > 0.05 ? `0 0 ${18 * clamp01(burnFlash)}px ${withAlpha(theme.danger, 0.7)}` : 'none',
                }}
              >
                {`败 ${i + 1}`}
              </div>
              {/* 第三格断口（烧断——两半分离位移） */}
              {i === 2 && burn > 0.02 ? (
                <>
                  <div style={{position: 'absolute', left: -6 * burn, top: 0, width: 3, height: 34, background: withAlpha(theme.danger, 0.8), transform: 'rotate(-14deg)'}} />
                  <div style={{position: 'absolute', right: -6 * burn, top: 0, width: 3, height: 34, background: withAlpha(theme.danger, 0.8), transform: 'rotate(14deg)'}} />
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      {burn > 0.5 ? (
        <div style={{marginTop: 8, fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap', opacity: burn}}>{'第三格 · 熔断'}</div>
      ) : null}
    </div>
  );
};
