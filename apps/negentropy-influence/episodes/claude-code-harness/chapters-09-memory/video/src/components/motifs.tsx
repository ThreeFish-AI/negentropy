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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2–ep8 延续——
// LoopRing 描边色/线宽跨集恒定（theme.core = 陶土橙 #D97757 + RING_STROKE 6）
// = 逐字节拷贝的前提；Terminal/DispatchTable 本集无对应场景、不拷）
// （ep9 复制适配：环体缩悬压缩层/门装置上方——「回合结束」挂点高亮为本集挂点语义）

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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep8 逐字节
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

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep9 Memory）
// storyboard 实现映射登记：MemoryVault / MemoryFileCard / IndexPage / TypeCard /
// GateArch / SnapshotFrame / CountRuler / ConsolidateSeal（另设两件组装件
// ChatWindow / ClearWave——跨场景复用的镜级构件，不属分镜登记名）。
// 全片主装置 = 记忆库体（mech=记忆紫方体）+ 索引页（index=索引蓝）双件
// （对照 ep2 对照表 / ep8 蓝紫双平面之地位）：库体 = 一个记忆一个文件的长期
// 记忆容器（开门 / 格填 / 清空 / 稳态状态机），索引页 = 一行一链接的目录
// （逐行点亮 / 重建闪烁 / 全量重写状态机——「重建闪烁」为全片签名动作）；
// 库体紫 / 索引蓝语义色恒定，缩微前后不重绘（scale 整体变换）。
// 输入值可追约束：偏好示例「缩进 · 制表符」全片同签（1-A 首卡 → 2-B 偏好卡 →
// 3-B 候选卡 → 3-C/4 各幕回扣）。哑装置原则承 ep4–ep8：动效参数（进度/状态/
// 读数）一律经 prop 由调用场景注入，本段零 motion hooks——「怎么动」归场景，
// 「画什么」归此处。

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 对话窗（0-A 冷启动 / 0-B 退暗 / 2-B 消息条 / 5-B 新会话窗——会话层世界的
 *  统一可视）。`rows` 消息行文案；`rowsLit` 0..n 实数行显形；`dead` 0..1 边框
 *  熄灭断开（会话一断——边框断裂 + 整体压暗）；`sweepP` 0..1 警示红淡扫自上而
 *  下（全清零——扫过处行熄灭由场景以 rowsLit 配合）；`glowP` 0..1 窗内泛微光
 *  （「还认得你」的具象）；`emptyAwait` 0..1 新会话空待态（光标待落）。 */
export const ChatWindow: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  scale?: number;
  lit?: number;
  dim?: number;
  rows?: string[];
  rowsLit?: number;
  dead?: number;
  sweepP?: number;
  glowP?: number;
  emptyAwait?: number;
  header?: string;
}> = ({
  x,
  y,
  w,
  h,
  scale = 1,
  lit = 1,
  dim = 0,
  rows = ['问', '答', '问', '答'],
  rowsLit = 0,
  dead = 0,
  sweepP = 0,
  glowP = 0,
  emptyAwait = 0,
  header = '会话',
}) => {
  const sweep = clamp01(sweepP);
  const rowH = 44;
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
          // 边框熄灭断开：dashed 断口随 dead 显现（会话一断——边框先裂）
          border: `3px ${dead > 0.4 ? 'dashed' : 'solid'} ${withAlpha(theme.dim, 0.9 - 0.55 * clamp01(dead))}`,
          background: withAlpha(theme.panel, 0.94 - 0.35 * clamp01(dead)),
          position: 'relative',
          padding: '14px 18px',
          boxShadow: `0 0 ${26 * clamp01(glowP)}px ${withAlpha(theme.index, 0.4 * clamp01(glowP))}`,
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{header}</span>
          <span style={{fontFamily: theme.mono, fontSize: 11, color: withAlpha(theme.dim, 0.7)}}>{'session'}</span>
        </div>
        <div style={{position: 'absolute', left: 18, right: 18, top: 44}}>
          {rows.map((r, i) => {
            // 淡扫自上而下：扫线已过之行随 sweep 熄灭（行透明度 × 1−swept）
            const swept = clamp01(sweep * (rows.length + 1) - i);
            const p = clamp01(rowsLit - i);
            if (p <= 0.02) {
              return null;
            }
            return (
              <div key={i} style={{height: rowH, marginBottom: 10, opacity: (0.3 + 0.7 * p) * (1 - 0.9 * swept)}}>
                <div
                  style={{
                    width: `${72 + ((i * 13) % 22)}%`,
                    height: '100%',
                    boxSizing: 'border-box',
                    borderRadius: 9,
                    border: `2.5px solid ${withAlpha(theme.panelBorder, 0.95)}`,
                    background: withAlpha(theme.bg, 0.5),
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 12,
                    fontFamily: theme.sans,
                    fontSize: 15,
                    color: theme.dim,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r}
                </div>
              </div>
            );
          })}
          {/* 空待态：光标待落（新会话窗开起——消息列空） */}
          {emptyAwait > 0.02 ? (
            <div style={{height: rowH, display: 'flex', alignItems: 'center', gap: 8, opacity: clamp01(emptyAwait)}}>
              <span style={{width: 3, height: 30, background: theme.dim, display: 'inline-block'}} />
              <span style={{fontFamily: theme.mono, fontSize: 14, color: withAlpha(theme.dim, 0.6)}}>{'空 · 待落'}</span>
            </div>
          ) : null}
        </div>
        {/* 清零淡扫带（警示红半透明横带自上而下——扫幅由场景给） */}
        {sweep > 0.01 && sweep < 0.99 ? (
          <div
            style={{
              position: 'absolute',
              left: -6,
              right: -6,
              top: sweep * (h - 30),
              height: 30,
              borderRadius: 6,
              background: `linear-gradient(${withAlpha(theme.danger, 0)}, ${withAlpha(theme.danger, 0.4)}, ${withAlpha(theme.danger, 0)})`,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

/** 记忆库体（主装置·mech 记忆紫方体——「长期记忆」容器）。状态机经 prop 注入：
 *  `doorP` 0..1 门缝张开（双开门左右滑开，内里暗格透光）；`ghostP` 0..1 暗格
 *  轮廓显形（虚线格 stagger 由场景传实数）；`slotsLit` 0..n 实数格填入；
 *  `clearP` 0..1 旧格整层清空（待写白态——格内容褪为浅虚线空格）；
 *  `rewriteP` 0..n 实数新条目逐格写入（与 slotsLit 分轨——删光旧/写入全是两拍）；
 *  `glow` 0..1 稳态微光（场景传 useBreathe 值——清场波下纹丝不动的呼吸）；
 *  `flash` 0..1 写入落定闪；`label` 头签（.memory/）。方体三面（前+顶+右）固定
 *  偏移 22/−16——跨镜逐像素同形（库体轮廓 continuity 的帧上判据）。 */
export const MemoryVault: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  scale?: number;
  lit?: number;
  dim?: number;
  doorP?: number;
  ghostP?: number;
  cols?: number;
  rowsN?: number;
  slotsLit?: number;
  clearP?: number;
  rewriteP?: number;
  glow?: number;
  flash?: number;
  label?: string;
}> = ({
  x,
  y,
  w,
  h,
  scale = 1,
  lit = 1,
  dim = 0,
  doorP = 0,
  ghostP = 0,
  cols = 6,
  rowsN = 5,
  slotsLit = 0,
  clearP = 0,
  rewriteP = 0,
  glow = 0,
  flash = 0,
  label = '.memory/',
}) => {
  const door = clamp01(doorP);
  const cells = cols * rowsN;
  const ghostN = clamp01(ghostP) * cells;
  const DX = 22;
  const DY = -16;
  const pad = 16;
  const cw = (w - pad * 2 - (cols - 1) * 8) / cols;
  const ch = (h - pad * 2 - (rowsN - 1) * 8) / rowsN;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w + DX,
        height: h - DY,
        opacity: clamp01(lit) * (1 - dim),
        transform: `scale(${scale})`,
        transformOrigin: 'left top',
      }}
    >
      <svg width={w + DX} height={h - DY} viewBox={`0 0 ${w + DX} ${h - DY}`} style={{overflow: 'visible'}}>
        {/* 顶面 + 右面（方体三面之二——固定偏移的体积暗示） */}
        <polygon points={`0,0 ${DX},${DY} ${w + DX},${DY} ${w},0`} fill={withAlpha(theme.mech, 0.1)} stroke={withAlpha(theme.mech, 0.55)} strokeWidth={2.5} />
        <polygon points={`${w},0 ${w + DX},${DY} ${w + DX},${h + DY} ${w},${h}`} fill={withAlpha(theme.mech, 0.07)} stroke={withAlpha(theme.mech, 0.45)} strokeWidth={2.5} />
        {/* 腔体底（门后内里——透光暗格所在） */}
        <rect x={0} y={0} width={w} height={h} rx={10} fill={withAlpha(theme.bg, 0.75)} stroke={withAlpha(theme.mech, 0.5 + 0.3 * door + 0.2 * clamp01(glow))} strokeWidth={3.5} />
        {/* 内里光（门缝光开——腔内随开门渐亮） */}
        <rect x={0} y={0} width={w} height={h} rx={10} fill={withAlpha(theme.mech, 0.05 + 0.09 * door)} />
        {/* 暗格阵（腔内）：ghostP 虚线轮廓显形 → slotsLit 格填入 → clearP 清空
            → rewriteP 重写；四态按优先级叠算（clear 后 slots 淡出、rewrite 覆亮） */}
        {Array.from({length: cells}, (_, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          const cx = pad + c * (cw + 8);
          const cy = pad + r * (ch + 8);
          const ghost = clamp01(ghostN - i);
          const filled = clamp01(slotsLit - i);
          const cleared = clamp01(clearP * 1.6 - i / cells);
          const rewr = clamp01(rewriteP - i);
          // 清空态：已填格褪为白态（浅虚线空格）；重写态：重写格覆亮
          const vis = Math.max(ghost * 0.55, filled, rewr);
          if (vis <= 0.02) {
            return null;
          }
          const isRewr = rewr > 0.02;
          return (
            <g key={`cell${i}`}>
              <rect
                x={cx}
                y={cy}
                width={cw}
                height={ch}
                rx={4}
                fill={isRewr ? withAlpha(theme.mech, 0.34) : filled > 0.02 ? withAlpha(theme.mech, 0.24) : 'transparent'}
                stroke={isRewr || filled > 0.02 ? withAlpha(theme.mech, 0.75) : withAlpha(theme.mech, 0.4)}
                strokeWidth={2}
                strokeDasharray={filled > 0.02 || isRewr ? undefined : '4 4'}
                opacity={Math.max(vis, 1 - 0.75 * cleared)}
              />
              {/* 格内微行纹（有内容的剪影——清空后随 cleared 隐去） */}
              <rect x={cx + 5} y={cy + ch / 2 - 2} width={(cw - 10) * (0.6 + ((i * 7) % 4) * 0.1)} height={4} rx={2} fill={withAlpha(theme.mech, 0.5)} opacity={filled * (1 - cleared) * 0.9} />
            </g>
          );
        })}
        {/* 双开门（前封面——左右滑开露暗格；门上头签 .memory/） */}
        <g>
          <rect
            x={0}
            y={0}
            width={w / 2 - door * (w / 2 - pad - 6)}
            height={h}
            rx={10}
            fill={withAlpha(theme.panel, 0.96 - 0.5 * door)}
            stroke={withAlpha(theme.mech, 0.85)}
            strokeWidth={3}
            transform={`translate(${-door * (w / 2 - pad - 6)}, 0)`}
          />
          <rect
            x={w / 2 + door * (w / 2 - pad - 6)}
            y={0}
            width={w / 2 - door * (w / 2 - pad - 6)}
            height={h}
            rx={10}
            fill={withAlpha(theme.panel, 0.96 - 0.5 * door)}
            stroke={withAlpha(theme.mech, 0.85)}
            strokeWidth={3}
            transform={`translate(${door * (w / 2 - pad - 6)}, 0)`}
          />
          {/* 门中缝（未开时一条细缝——门缝未开判据） */}
          <line x1={w / 2} y1={4} x2={w / 2} y2={h - 4} stroke={withAlpha(theme.mech, 0.9)} strokeWidth={2} opacity={0.5 + 0.5 * door} />
          <text x={16} y={30} fontFamily={theme.mono} fontSize={15} fill={theme.mech} opacity={0.9}>
            {label}
          </text>
        </g>
        {/* 稳态微光 / 写入落定闪（外缘辉光——清场波下纹丝不动的呼吸） */}
        <rect
          x={-9}
          y={-9}
          width={w + DX + 18}
          height={h - DY + 18}
          rx={16}
          fill="none"
          stroke={withAlpha(theme.mech, 0.5 * clamp01(glow) + 0.5 * clamp01(flash))}
          strokeWidth={3}
          opacity={0.4 + 0.6 * Math.max(clamp01(glow), clamp01(flash))}
          style={{filter: `drop-shadow(0 0 ${10 + 22 * Math.max(clamp01(glow), clamp01(flash))}px ${withAlpha(theme.mech, 0.55)})`}}
        />
      </svg>
    </div>
  );
};

/** 记忆文件卡（一个记忆一个文件——卡头三行小字槽 + 卡尾类型槽四分小扇）。
 *  `fieldsLit` 0..3 三槽逐一亮起填字（槽内仅短词：名字·缩进 / 简介·制表符 /
 *  类型·偏好）；`fanP` 0..1 四分小扇翻出（四类型预告不展开）；`sign` 传值走
 *  候选签面（「缩进 · 制表符」——2-B/3-B 与 1-A 首卡同形可追）；`flash` 落定闪。 */
export const MemoryFileCard: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  scale?: number;
  lit?: number;
  dim?: number;
  fieldsLit?: number;
  fanP?: number;
  sign?: string;
  signLit?: number;
  flash?: number;
}> = ({
  x,
  y,
  w,
  h,
  scale = 1,
  lit = 1,
  dim = 0,
  fieldsLit = 0,
  fanP = 0,
  sign,
  signLit = 0,
  flash = 0,
}) => {
  const fields = [
    {k: '名字', v: '缩进'},
    {k: '简介', v: '制表符'},
    {k: '类型', v: '偏好'},
  ] as const;
  const fan = clamp01(fanP);
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
          border: `3px solid ${theme.mech}`,
          background: withAlpha(theme.panel, 0.97),
          boxShadow: flash > 0.05 ? `0 0 ${26 * clamp01(flash)}px ${withAlpha(theme.mech, 0.55)}` : 'none',
          position: 'relative',
          padding: '12px 16px',
        }}
      >
        {/* 签面（候选形态——2-B 偏好卡 / 3-B 候选卡；与首卡同形锚：三槽仍在卡头） */}
        {sign ? (
          <div style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap', opacity: clamp01(signLit)}}>
            {sign}
          </div>
        ) : null}
        {/* 卡头三行小字槽（首卡主体——槽内仅短词） */}
        <div style={{marginTop: sign ? 8 : 2}}>
          {fields.map((f, i) => {
            const p = clamp01(fieldsLit - i);
            return (
              <div key={f.k} style={{display: 'flex', alignItems: 'center', gap: 10, height: 34}}>
                <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, width: 40}}>{f.k}</span>
                <span
                  style={{
                    flex: 1,
                    height: 22,
                    boxSizing: 'border-box',
                    borderRadius: 5,
                    border: `2px ${p > 0.05 ? 'solid' : 'dashed'} ${withAlpha(theme.mech, 0.3 + 0.55 * p)}`,
                    background: withAlpha(theme.mech, 0.1 * p),
                    fontFamily: theme.sans,
                    fontSize: 15,
                    fontWeight: 600,
                    color: theme.text,
                    lineHeight: '18px',
                    paddingLeft: p > 0.05 ? 8 : 0,
                    opacity: 0.45 + 0.55 * p,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {p > 0.05 ? f.v : ''}
                </span>
              </div>
            );
          })}
        </div>
        {/* 卡尾类型槽（四分小扇——四类型预告，不展开文字） */}
        <div style={{position: 'absolute', right: 14, bottom: 12, width: 58, height: 58}}>
          <svg width={58} height={58} viewBox="0 0 58 58">
            <rect x={1} y={1} width={56} height={56} rx={7} fill={withAlpha(theme.bg, 0.5)} stroke={withAlpha(theme.mech, 0.6)} strokeWidth={2} strokeDasharray="4 4" />
            {[0, 1, 2, 3].map((q) => {
              const p = clamp01(fan * 4 - q);
              const a0 = (q * Math.PI) / 2;
              const cx = 29;
              const cy = 29;
              const r = 22 * (0.55 + 0.45 * p);
              return (
                <path
                  key={`fan${q}`}
                  d={`M ${cx} ${cy} L ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a0 + Math.PI / 2)} ${cy + r * Math.sin(a0 + Math.PI / 2)} Z`}
                  fill={withAlpha(theme.mech, 0.22 + 0.3 * p)}
                  stroke={withAlpha(theme.mech, 0.5 + 0.4 * p)}
                  strokeWidth={1.6}
                  opacity={p}
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};

/** 索引页（主装置·index 索引蓝——一页目录，行 = 名字 + 指向线，指向线断在各
 *  文件图标处）。`rowsLit` 0..n 实数行点亮（行序即目录序）；`writeP` 0..1 新行
 *  写入（页角写入位亮 → 新行生长）；`rebuildP` 0..1 重建闪烁（签名动作——envelope
 *  由场景传 sin 包络，页体泛 index 白闪一拍即收）；`rewriteP` 0..n 实数全量重写
 *  （删光旧写入全的「大闪」面：行随 rewriteP 逐行重落）；`flash` 角标级落定闪。
 *  缩微驻位（2-A 右半 / 3-C 双轨 / 5-A 终态）一律 scale 变换，不重绘。 */
export const IndexPage: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  scale?: number;
  lit?: number;
  dim?: number;
  rows?: string[];
  rowsLit?: number;
  writeP?: number;
  rebuildP?: number;
  rewriteP?: number;
  flash?: number;
  header?: string;
}> = ({
  x,
  y,
  w,
  h,
  scale = 1,
  lit = 1,
  dim = 0,
  rows = ['缩进', '测试', '合规', '看板', '依赖', '提交'],
  rowsLit = 0,
  writeP = 0,
  rebuildP = 0,
  rewriteP = 0,
  flash = 0,
  header = 'MEMORY.md',
}) => {
  const shown = rows.length + (writeP > 0.02 ? 1 : 0);
  const rowH = Math.min(64, (h - 70) / shown);
  const rebuild = clamp01(rebuildP);
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
          border: `3px solid ${withAlpha(theme.index, 0.65 + 0.35 * rebuild)}`,
          background: withAlpha(theme.panel, 0.96),
          boxShadow: `0 0 ${18 * rebuild + 20 * clamp01(flash)}px ${withAlpha(theme.index, 0.3 + 0.4 * rebuild)}`,
          position: 'relative',
          padding: '14px 18px',
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.mono, fontSize: 14, fontWeight: 700, color: theme.index}}>{header}</span>
          <span style={{fontFamily: theme.mono, fontSize: 11, color: theme.dim}}>{'索引 · 一行一链接'}</span>
        </div>
        <div style={{position: 'absolute', left: 18, right: 18, top: 46}}>
          {rows.map((r, i) => {
            // 全量重写分轨：rewriteP>0 时行可见度改由 rewriteP 驱动（删光→逐行重落）
            const lit = clamp01(rowsLit - i);
            const rewr = rewriteP > 0.02 ? clamp01(rewriteP - i) : 0;
            const vis = rewriteP > 0.02 ? Math.max(rewr, 0) : lit;
            if (vis <= 0.02) {
              return null;
            }
            return (
              <div key={r} style={{height: rowH, display: 'flex', alignItems: 'center', gap: 10, opacity: 0.35 + 0.65 * vis}}>
                <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, width: 20}}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>{r}</span>
                {/* 指向线（断在各文件图标处——正文在各自文件里） */}
                <svg width={Math.max(60, w - 190)} height={12} viewBox={`0 0 ${Math.max(60, w - 190)} 12`} style={{overflow: 'visible'}}>
                  <line x1={0} y1={6} x2={Math.max(60, w - 190) - 22} y2={6} stroke={withAlpha(theme.index, 0.55)} strokeWidth={2.4} strokeDasharray="7 6" opacity={vis} />
                </svg>
                {/* 文件图标（指向线终点——正文住址） */}
                <span
                  style={{
                    width: 16,
                    height: 20,
                    borderRadius: 3,
                    border: `2px solid ${withAlpha(theme.mech, 0.8)}`,
                    background: withAlpha(theme.mech, 0.16),
                    display: 'inline-block',
                    opacity: vis,
                  }}
                />
              </div>
            );
          })}
          {/* 新行写入（页角写入位 → 新行生长——重建闪烁的触发面） */}
          {writeP > 0.02 ? (
            <div style={{height: rowH, display: 'flex', alignItems: 'center', gap: 10, opacity: clamp01(writeP)}}>
              <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.index, width: 20}}>{String(rows.length + 1).padStart(2, '0')}</span>
              <span style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 600, color: theme.index, whiteSpace: 'nowrap'}}>{'新条目'}</span>
              <svg width={Math.max(60, w - 190)} height={12} viewBox={`0 0 ${Math.max(60, w - 190)} 12`} style={{overflow: 'visible'}}>
                <line x1={0} y1={6} x2={(Math.max(60, w - 190) - 22) * clamp01(writeP)} y2={6} stroke={theme.index} strokeWidth={2.4} strokeLinecap="round" />
              </svg>
              <span
                style={{
                  width: 16,
                  height: 20,
                  borderRadius: 3,
                  border: `2px solid ${theme.index}`,
                  background: withAlpha(theme.index, 0.2),
                  display: 'inline-block',
                  opacity: clamp01(writeP),
                }}
              />
            </div>
          ) : null}
        </div>
        {/* 页角写入位（左下角小 + 位——写入入口恒在） */}
        <div
          style={{
            position: 'absolute',
            left: 14,
            bottom: 10,
            fontFamily: theme.mono,
            fontSize: 13,
            color: writeP > 0.02 ? theme.index : theme.dim,
            border: `2px dashed ${writeP > 0.02 ? theme.index : withAlpha(theme.dim, 0.5)}`,
            borderRadius: 6,
            padding: '1px 8px',
          }}
        >
          {'+ 写入'}
        </div>
      </div>
      {/* 重建闪烁泛光（签名动作——index 白闪一拍即收，envelope 由场景传） */}
      {rebuild > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: 14,
            background: withAlpha(theme.index, 0.3 * rebuild),
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  );
};

/** 四类型卡（①你是谁 user / ②怎么做 feedback / ③眼下的事 project / ④东西在哪
 *  reference——反枚举：panel 底 + 编号，翻面入场次序 = 口播次序）。`flipP` 0..1
 *  翻面（back 虚线暗面 → front 例图面）；`exLit` 0..1 例图点亮（各卡一例一图：
 *  ①缩进符号线亮/空格点灰 ②假数据行红叉 ③合规章盖下 ④看板指针指向一格）。 */
export const TypeCard: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  i: number;
  flipP?: number;
  exLit?: number;
  lit?: number;
  dim?: number;
}> = ({x, y, w, h, i, flipP = 0, exLit = 0, lit = 1, dim = 0}) => {
  const TYPES = [
    {no: '①', zh: '你是谁', en: 'user'},
    {no: '②', zh: '怎么做', en: 'feedback'},
    {no: '③', zh: '眼下的事', en: 'project'},
    {no: '④', zh: '东西在哪', en: 'reference'},
  ] as const;
  const t = TYPES[i];
  const flip = clamp01(flipP);
  const ex = clamp01(exLit);
  const face = flip < 0.5 ? 'back' : 'front';
  const sx = Math.max(0.04, Math.abs(1 - 2 * flip));
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: clamp01(lit) * (1 - dim),
        transform: `scaleX(${sx})`,
        transformOrigin: '50% 50%',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          borderRadius: 12,
          border: `3px ${face === 'back' ? 'dashed' : 'solid'} ${face === 'back' ? withAlpha(theme.panelBorder, 1) : theme.mech}`,
          background: withAlpha(theme.panel, 0.96),
          position: 'relative',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {face === 'back' ? (
          <>
            <span style={{fontFamily: theme.mono, fontSize: 30, fontWeight: 700, color: theme.dim}}>{t.no}</span>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: withAlpha(theme.dim, 0.7), marginTop: 6}}>{t.en}</span>
          </>
        ) : (
          <>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
              <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: theme.text}}>
                {t.no}
                {t.zh}
              </span>
              <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.mech}}>{t.en}</span>
            </div>
            {/* 例图区（一卡一例——仅关键词/图形，不成句） */}
            <div style={{flex: 1, marginTop: 8, position: 'relative'}}>
              {i === 0 ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                  {/* 缩进符号线（tab 箭头——亮）vs 空格点（灰） */}
                  <div style={{display: 'flex', alignItems: 'center', gap: 6, opacity: 0.4 + 0.6 * ex}}>
                    {[0, 1, 2].map((k) => (
                      <svg key={`tab${k}`} width={22} height={14} viewBox="0 0 22 14">
                        <path d="M 2 7 L 16 7 M 11 2 L 17 7 L 11 12" fill="none" stroke={theme.mech} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ))}
                    <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.mech}}>{'制表符'}</span>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: 7, opacity: 0.55 - 0.25 * ex}}>
                    {[0, 1, 2, 3, 4].map((k) => (
                      <span key={`dot${k}`} style={{width: 5, height: 5, borderRadius: '50%', background: theme.dim, display: 'inline-block'}} />
                    ))}
                    <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'空格'}</span>
                  </div>
                </div>
              ) : null}
              {i === 1 ? (
                <div style={{position: 'relative', height: 44}}>
                  {/* 假数据行 + 红叉（造假数据糊弄测试） */}
                  <div
                    style={{
                      height: 34,
                      borderRadius: 7,
                      border: `2.5px solid ${withAlpha(theme.dim, 0.7)}`,
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 10,
                      gap: 8,
                      opacity: 0.4 + 0.6 * ex,
                    }}
                  >
                    <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'mock'}</span>
                    <span style={{flex: 1, height: 8, borderRadius: 4, background: withAlpha(theme.dim, 0.3)}} />
                    <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.ok, marginRight: 8, opacity: 1 - ex}}>{'✓'}</span>
                  </div>
                  {ex > 0.02 ? (
                    <svg width={120} height={44} viewBox="0 0 120 44" style={{position: 'absolute', left: '50%', top: 0, transform: `translateX(-50%) scale(${ex})`, overflow: 'visible'}}>
                      <line x1={16} y1={8} x2={104} y2={36} stroke={theme.danger} strokeWidth={5} strokeLinecap="round" opacity={ex} />
                      <line x1={104} y1={8} x2={16} y2={36} stroke={theme.danger} strokeWidth={5} strokeLinecap="round" opacity={ex} />
                    </svg>
                  ) : null}
                </div>
              ) : null}
              {i === 2 ? (
                <div style={{position: 'relative', height: 64}}>
                  {/* 合规章（盖下——外部约束逼出的记录） */}
                  <div style={{position: 'absolute', left: '50%', top: 6, transform: `translate(-50%, ${-26 * (1 - ex)}px)`, opacity: ex}}>
                    <div
                      style={{
                        padding: '5px 14px',
                        borderRadius: 8,
                        border: `3px solid ${theme.danger}`,
                        background: withAlpha(theme.danger, 0.1),
                        fontFamily: theme.serif,
                        fontSize: 19,
                        fontWeight: 700,
                        color: theme.danger,
                        letterSpacing: 4,
                        whiteSpace: 'nowrap',
                        transform: `rotate(-6deg)`,
                      }}
                    >
                      {'合规'}
                    </div>
                  </div>
                  <div style={{position: 'absolute', left: 0, right: 0, bottom: 4, height: 10, borderRadius: 5, background: withAlpha(theme.dim, 0.22)}} />
                  <div style={{position: 'absolute', left: 12, width: '46%', bottom: 14, height: 8, borderRadius: 4, background: withAlpha(theme.dim, 0.3)}} />
                </div>
              ) : null}
              {i === 3 ? (
                <div style={{display: 'flex', gap: 8, alignItems: 'flex-end', height: 64}}>
                  {/* 看板指针（指向一格——东西在哪） */}
                  {[0, 1, 2].map((col, k) => (
                    <div key={`kb${k}`} style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 5}}>
                      {[0, 1].map((cell) => (
                        <div
                          key={`kb${k}${cell}`}
                          style={{
                            height: 20,
                            borderRadius: 5,
                            border: `2px solid ${k === 1 && cell === 0 ? theme.mech : withAlpha(theme.panelBorder, 0.9)}`,
                            background: k === 1 && cell === 0 ? withAlpha(theme.mech, 0.16 + 0.2 * ex) : 'transparent',
                            opacity: k === 1 && cell === 0 ? 0.4 + 0.6 * ex : 0.75,
                          }}
                        />
                      ))}
                    </div>
                  ))}
                  <svg width={30} height={30} viewBox="0 0 30 30" style={{position: 'absolute', right: -4, top: 4, overflow: 'visible', opacity: ex}}>
                    <path d="M 26 4 L 8 22" stroke={theme.mech} strokeWidth={3.5} strokeLinecap="round" />
                    <circle cx={7} cy={23} r={4} fill={theme.mech} />
                  </svg>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/** 五道写入门（拱门·mech 描边——候选位与库门之间的纵列）。`i` 0..4（①范围
 *  ②类型 ③字段 ④临时话 ⑤比对——名牌仅关键词）；`outlineP` 0..1 暗态轮廓显形
 *  （编号先落）；`litP` 0..1 门亮（本关点名）；`passP` 0..1 放行（门内通道亮起
 *  一拍）；`bounceP` 0..1 弹回闪（门口红闪——被拦卡片的反光）；`blockP` 0..1
 *  红杠拦下（门④专用态）。缩微（3-C 右轨五门在位）走 scale。 */
export const GateArch: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  i: number;
  outlineP?: number;
  litP?: number;
  passP?: number;
  bounceP?: number;
  blockP?: number;
  scale?: number;
  lit?: number;
  dim?: number;
}> = ({x, y, w, h, i, outlineP = 0, litP = 0, passP = 0, bounceP = 0, blockP = 0, scale = 1, lit = 1, dim = 0}) => {
  const NAMES = ['范围', '类型', '字段', '临时话', '比对'] as const;
  const outline = clamp01(outlineP);
  const on = clamp01(litP);
  const pass = clamp01(passP);
  const bounce = clamp01(bounceP);
  const block = clamp01(blockP);
  const stroke = on > 0.4 ? theme.mech : withAlpha(theme.mech, 0.4 + 0.3 * outline);
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
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{overflow: 'visible'}}>
        {/* 拱门（两柱 + 顶弧——门内为通道） */}
        <path
          d={`M ${w * 0.18} ${h} L ${w * 0.18} ${h * 0.44} A ${w * 0.32} ${h * 0.34} 0 0 1 ${w * 0.82} ${h * 0.44} L ${w * 0.82} ${h}`}
          fill={pass > 0.02 ? withAlpha(theme.mech, 0.1 + 0.14 * pass) : 'transparent'}
          stroke={stroke}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={on > 0.05 || pass > 0.02 ? undefined : '6 6'}
          opacity={0.35 + 0.65 * Math.max(outline, on)}
        />
        {/* 通道放行光（passP——门内亮起一拍，候选穿行） */}
        {pass > 0.02 && pass < 0.98 ? (
          <rect x={w * 0.22} y={h * 0.2} width={w * 0.56} height={h * 0.78} rx={8} fill={withAlpha(theme.mech, 0.22 * Math.sin(Math.PI * pass))} />
        ) : null}
        {/* 编号徽（轮廓态即落——「编号 1..5」先于门亮） */}
        <circle cx={w * 0.5} cy={h * 0.3} r={15} fill={theme.panel} stroke={stroke} strokeWidth={2.5} opacity={outline} />
        <text x={w * 0.5} y={h * 0.3 + 5} textAnchor="middle" fontFamily={theme.mono} fontSize={16} fontWeight={700} fill={on > 0.4 ? theme.mech : theme.dim} opacity={outline}>
          {String(i + 1)}
        </text>
        {/* 名牌（仅关键词） */}
        <text x={w * 0.5} y={h + 22} textAnchor="middle" fontFamily={theme.sans} fontSize={17} fontWeight={600} fill={on > 0.4 ? theme.text : theme.dim} opacity={outline}>
          {NAMES[i]}
        </text>
        {/* 弹回红闪（门口——被拦卡片反光） */}
        {bounce > 0.02 ? <circle cx={w * 0.5} cy={h * 0.62} r={20 + 10 * bounce} fill="none" stroke={theme.danger} strokeWidth={3} opacity={0.6 * bounce} /> : null}
        {/* 红杠拦下（门④——压字拦下一拍收） */}
        {block > 0.02 ? (
          <g opacity={block}>
            <line x1={w * 0.12} y1={h * 0.6} x2={w * 0.88} y2={h * 0.6} stroke={theme.danger} strokeWidth={6} strokeLinecap="round" />
          </g>
        ) : null}
      </svg>
    </div>
  );
};

/** 快照装置（4-B 三段动画主体）。`snapP` 0..1 定照闪 + 底照缩略图浮于库侧；
 *  `layP` 0..1 底照展开铺回（复原——缩略图放大对齐库格）；`checkP` 0..1 确认绿
 *  框勾落定（复原终态 = 底照逐格一致）；`failP` 0..1 红叉（写入失败）；
 *  `emptyP` 0..1 空框态（4-C 左轨——快照位空框打叉）。 */
export const SnapshotFrame: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  scale?: number;
  lit?: number;
  dim?: number;
  snapP?: number;
  layP?: number;
  checkP?: number;
  failP?: number;
  emptyP?: number;
}> = ({x, y, w, h, scale = 1, lit = 1, dim = 0, snapP = 0, layP = 0, checkP = 0, failP = 0, emptyP = 0}) => {
  const snap = clamp01(snapP);
  const lay = clamp01(layP);
  const check = clamp01(checkP);
  const fail = clamp01(failP);
  const empty = clamp01(emptyP);
  const cols = 5;
  const rowsN = 3;
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
      {/* 空框态（4-C 左轨——无快照） */}
      {empty > 0.02 ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            borderRadius: 9,
            border: `3px dashed ${withAlpha(theme.danger, 0.6)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 14,
            color: theme.danger,
            opacity: empty,
          }}
        >
          {'快照位 · 空'}
        </div>
      ) : null}
      {/* 底照缩略图（浮于库侧——复原依据全程可见；layP 展开铺回） */}
      {snap > 0.02 && empty < 0.02 ? (
        <div
          style={{
            width: w,
            height: h,
            boxSizing: 'border-box',
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(theme.mech, 0.55 + 0.4 * snap)}`,
            background: withAlpha(theme.panel, 0.96),
            boxShadow: `0 0 ${20 * snap + 16 * check}px ${withAlpha(theme.mech, 0.3 + 0.3 * snap)}`,
            padding: 6,
            transform: `translateY(${(1 - snap) * 14}px)`,
            opacity: snap,
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 10, color: theme.mech, marginBottom: 3}}>{'快照 · 底照'}</div>
          <div style={{display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 3}}>
            {Array.from({length: cols * rowsN}, (_, i) => (
              <div key={`snap${i}`} style={{height: (h - 34) / rowsN - 3, borderRadius: 3, background: withAlpha(theme.mech, 0.3), border: `1.5px solid ${withAlpha(theme.mech, 0.5)}`}} />
            ))}
          </div>
        </div>
      ) : null}
      {/* 复原绿框勾（落定——复原终态 = 底照逐格一致） */}
      {check > 0.02 ? (
        <svg width={46} height={46} viewBox="0 0 46 46" style={{position: 'absolute', right: -14, top: -14, overflow: 'visible', opacity: check, transform: `scale(${0.7 + 0.3 * check})`}}>
          <rect x={3} y={3} width={40} height={40} rx={9} fill={theme.panel} stroke={theme.ok} strokeWidth={4} />
          <path d="M 12 23 L 20 31 L 34 15" fill="none" stroke={theme.ok} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {/* 失败红叉（写入中途） */}
      {fail > 0.02 ? (
        <svg width={46} height={46} viewBox="0 0 46 46" style={{position: 'absolute', left: '50%', top: '40%', transform: `translate(-50%, -50%) scale(${fail})`, overflow: 'visible'}}>
          <line x1={10} y1={10} x2={36} y2={36} stroke={theme.danger} strokeWidth={6} strokeLinecap="round" />
          <line x1={36} y1={10} x2={10} y2={36} stroke={theme.danger} strokeWidth={6} strokeLinecap="round" />
        </svg>
      ) : null}
      {/* 铺回进度指示（layP——底照向库格展开的箭头语义，具体位移由场景排布） */}
      {lay > 0.02 && lay < 0.98 ? (
        <div style={{position: 'absolute', left: 0, right: 0, bottom: -20, fontFamily: theme.mono, fontSize: 11, color: theme.mech, textAlign: 'center', opacity: Math.sin(Math.PI * lay)}}>{'铺回中'}</div>
      ) : null}
    </div>
  );
};

/** 计数标尺 / 计数带（数字必带基线标尺——双口径计数位）。`mode='cells'`（缺省）：
 *  `cells` 格数、`cellsLit` 0..n 实数格点亮、`triggerAt`/`triggerLit` 触发线（第
 *  几格 + 竖线亮）、`capAt`/`capLit`/`capTag` 上限格（括弧 + 上限签）、`rounds`/
 *  `roundsLit` 轮次格（双口径带的上排圆点——轮次 × 计数并列）、`readout` 读数
 *  （场景算好闭合值）+ `readoutFlash` 定格 punch 辉光。`mode='meter'`：单条水位
 *  丈量条（`level` 0..1 + `limitTag` 上限刻度签——2-C 两万字符口径）。 */
export const CountRuler: React.FC<{
  x: number;
  y: number;
  w: number;
  mode?: 'cells' | 'meter';
  cells?: number;
  cellsLit?: number;
  triggerAt?: number;
  triggerLit?: number;
  capAt?: number;
  capLit?: number;
  capTag?: string;
  rounds?: number;
  roundsLit?: number;
  level?: number;
  limitTag?: string;
  readout?: string;
  readoutLit?: number;
  readoutFlash?: number;
  label?: string;
  accent?: string;
  lit?: number;
  scale?: number;
}> = ({
  x,
  y,
  w,
  mode = 'cells',
  cells = 30,
  cellsLit = 0,
  triggerAt,
  triggerLit = 0,
  capAt,
  capLit = 0,
  capTag = '上限',
  rounds = 0,
  roundsLit = 0,
  level = 0,
  limitTag = '上限',
  readout = '',
  readoutLit = 1,
  readoutFlash = 0,
  label = '',
  accent,
  lit = 1,
  scale = 1,
}) => {
  const on = accent ?? theme.mech;
  const cellW = Math.max(10, Math.min(26, (w - (cells - 1) * 5) / cells));
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: clamp01(lit), transform: `scale(${scale})`, transformOrigin: 'left top'}}>
      {label ? (
        <div style={{fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.dim, marginBottom: 6, whiteSpace: 'nowrap'}}>{label}</div>
      ) : null}
      {/* 轮次格（双口径带上排——圆点逐轮点亮） */}
      {rounds > 0 ? (
        <div style={{display: 'flex', gap: 8, marginBottom: 6}}>
          {Array.from({length: rounds}, (_, i) => (
            <span
              key={`rd${i}`}
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: `2.5px solid ${clamp01(roundsLit - i) > 0.4 ? theme.core : theme.panelBorder}`,
                background: clamp01(roundsLit - i) > 0.4 ? theme.core : 'transparent',
                display: 'inline-block',
              }}
            />
          ))}
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, marginLeft: 4, whiteSpace: 'nowrap'}}>{'轮次'}</span>
        </div>
      ) : null}
      {mode === 'cells' ? (
        <div style={{position: 'relative'}}>
          <div style={{display: 'flex', gap: 5}}>
            {Array.from({length: cells}, (_, i) => {
              const p = clamp01(cellsLit - i);
              return (
                <div
                  key={`cell${i}`}
                  style={{
                    width: cellW,
                    height: 22,
                    borderRadius: 4,
                    border: `2px solid ${p > 0.4 ? on : theme.panelBorder}`,
                    background: p > 0.4 ? withAlpha(on, 0.3 + 0.3 * p) : 'transparent',
                    opacity: 0.5 + 0.5 * Math.max(p, 0.3),
                  }}
                />
              );
            })}
          </div>
          {/* 触发线（第 triggerAt 格——竖线 + 数字签） */}
          {triggerAt !== undefined && triggerLit > 0.02 ? (
            <div style={{position: 'absolute', left: triggerAt * (cellW + 5) - 3, top: -8, height: 38, opacity: clamp01(triggerLit)}}>
              <div style={{width: 0, height: '100%', borderLeft: `4px solid ${theme.core}`}} />
              <div style={{position: 'absolute', left: 6, top: -20, fontFamily: theme.mono, fontSize: 14, fontWeight: 700, color: theme.core, whiteSpace: 'nowrap'}}>{`触发 ${triggerAt}`}</div>
            </div>
          ) : null}
          {/* 上限括弧（第 capAt 格止——上限签） */}
          {capAt !== undefined && capLit > 0.02 ? (
            <div style={{position: 'absolute', left: 0, top: 26, width: capAt * (cellW + 5) - 5, opacity: clamp01(capLit)}}>
              <div style={{width: '100%', height: 0, borderTop: `3px solid ${theme.dim}`, position: 'relative'}} />
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 6,
                  padding: '1px 9px',
                  borderRadius: 6,
                  border: `2px solid ${theme.dim}`,
                  background: theme.panel,
                  fontFamily: theme.mono,
                  fontSize: 12,
                  color: theme.dim,
                  whiteSpace: 'nowrap',
                }}
              >
                {capTag}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{position: 'relative', width: w, height: 30}}>
          {/* 水位丈量条（meter——单条 + 末端上限刻度；水位禁过冲） */}
          <div style={{width: '100%', height: '100%', boxSizing: 'border-box', borderRadius: 7, border: `2.5px solid ${withAlpha(on, 0.6)}`, background: withAlpha(on, 0.06), overflow: 'hidden'}}>
            <div style={{width: `${100 * clamp01(level)}%`, height: '100%', background: withAlpha(on, 0.34)}} />
          </div>
          <div style={{position: 'absolute', right: -2, top: -6, bottom: -6, width: 0, borderRight: `4px solid ${theme.danger}`}} />
          <div style={{position: 'absolute', right: 0, top: -28, fontFamily: theme.mono, fontSize: 13, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap'}}>{limitTag}</div>
        </div>
      )}
      {/* 读数（闭合值——场景算好传入；flash = 数字定格 punch 辉光） */}
      {readout ? (
        <div
          style={{
            marginTop: 8,
            fontFamily: theme.mono,
            fontSize: 30,
            fontWeight: 700,
            color: theme.text,
            fontVariantNumeric: 'tabular-nums',
            opacity: clamp01(readoutLit),
            textShadow: readoutFlash > 0.05 ? `0 0 ${18 * clamp01(readoutFlash)}px ${withAlpha(on, 0.6)}` : 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {readout}
        </div>
      ) : null}
    </div>
  );
};

/** 整理三动作签（合并 / 修正 / 淘汰——每签一枚微演，一拍各现）。`mergeP` 两条
 *  同文卡并拢成一张（×1 签）；`fixP` 矛盾卡改写（「非 A」行被 A 行覆写）；
 *  `retireP` 过时卡褪色（灰化 + 划线）。仅关键词 + 微图形，不成句。 */
export const ConsolidateSeal: React.FC<{
  x: number;
  y: number;
  w: number;
  lit?: number;
  mergeP?: number;
  fixP?: number;
  retireP?: number;
}> = ({x, y, w, lit = 1, mergeP = 0, fixP = 0, retireP = 0}) => {
  const merge = clamp01(mergeP);
  const fix = clamp01(fixP);
  const retire = clamp01(retireP);
  const cardW = (w - 2 * 24) / 3;
  const items = [
    {zh: '合并重复', p: merge},
    {zh: '修正矛盾', p: fix},
    {zh: '淘汰过时', p: retire},
  ] as const;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: clamp01(lit), display: 'flex', gap: 24}}>
      {items.map((it, i) => (
        <div
          key={it.zh}
          style={{
            width: cardW,
            boxSizing: 'border-box',
            borderRadius: 10,
            border: `2.5px solid ${it.p > 0.05 ? theme.mech : theme.panelBorder}`,
            background: withAlpha(theme.panel, 0.95),
            padding: '10px 12px',
            opacity: 0.45 + 0.55 * Math.max(it.p, 0.35),
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: it.p > 0.4 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{it.zh}</div>
          {/* 微演区（高 64——各一拍） */}
          <div style={{position: 'relative', height: 64, marginTop: 6}}>
            {i === 0 ? (
              <div style={{position: 'relative', height: '100%'}}>
                {/* 两条同文卡并拢（间距随 merge 收拢 → 一张 + ×1 签） */}
                {[0, 1].map((k) => (
                  <div
                    key={`mg${k}`}
                    style={{
                      position: 'absolute',
                      left: `${(k === 0 ? 8 : 52) + (k === 0 ? 1 : -1) * 22 * merge}px`,
                      top: 12 + (k === 1 ? 18 * (1 - merge) : 0),
                      width: 84,
                      height: 34,
                      borderRadius: 6,
                      border: `2px solid ${withAlpha(theme.mech, 0.7)}`,
                      background: withAlpha(theme.mech, 0.14),
                      opacity: k === 1 ? 1 - merge * 0.85 : 1,
                    }}
                  />
                ))}
                {merge > 0.5 ? (
                  <span style={{position: 'absolute', right: 4, bottom: 2, fontFamily: theme.mono, fontSize: 13, fontWeight: 700, color: theme.mech, opacity: (merge - 0.5) * 2}}>{'×1'}</span>
                ) : null}
              </div>
            ) : null}
            {i === 1 ? (
              <div style={{display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10}}>
                {/* 矛盾卡改写：A 行恒在，「非 A」行被覆写（交叉淡入淡出） */}
                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.text}}>{'A'}</span>
                  <span style={{width: 100, height: 8, borderRadius: 4, background: withAlpha(theme.mech, 0.5)}} />
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, opacity: 1 - fix}}>{'非A'}</span>
                  <span style={{width: 100, height: 8, borderRadius: 4, background: withAlpha(theme.danger, 0.4), opacity: 1 - fix}} />
                  <span style={{position: 'absolute', left: 34, fontFamily: theme.mono, fontSize: 12, color: theme.mech, opacity: fix}}>{'→ 改写'}</span>
                </div>
              </div>
            ) : null}
            {i === 2 ? (
              <div style={{position: 'relative', paddingTop: 14}}>
                {/* 过时卡褪色（灰化 + 划线） */}
                <div
                  style={{
                    width: 110,
                    height: 36,
                    borderRadius: 6,
                    border: `2px solid ${withAlpha(theme.dim, 0.8)}`,
                    background: withAlpha(theme.panel, 0.8),
                    filter: `saturate(${1 - 0.8 * retire}) brightness(${1 - 0.3 * retire})`,
                    opacity: 1 - 0.45 * retire,
                  }}
                />
                <div style={{position: 'absolute', left: 0, top: 30, width: 110 * retire, height: 0, borderTop: `3px solid ${theme.dim}`, opacity: retire}} />
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
};

/** 压缩清场波（4-D / 5-B 同款同向——0-C 压缩层小环签名随波扫过）。`sweepP`
 *  0..1 自上而下扫幅（吃句尾 + 幕间余量由场景排窗）；`size` 波带厚度。波为
 *  core 微染半透明横带（压缩层的世界动作，非记忆层事件——库体在其下纹丝不动）。 */
export const ClearWave: React.FC<{x?: number; yTop?: number; w?: number; h?: number; sweepP?: number; lit?: number}> = ({
  x = 0,
  yTop = 56,
  w = 1920,
  h = 864,
  sweepP = 0,
  lit = 1,
}) => {
  const p = clamp01(sweepP);
  if (p <= 0.005 || p >= 0.995) {
    return null;
  }
  return (
    <div style={{position: 'absolute', left: x, top: 0, width: w, height: yTop + h, opacity: clamp01(lit), pointerEvents: 'none'}}>
      {/* 已扫过区轻染（清场完成的静默面——极低透明度） */}
      <div style={{position: 'absolute', left: 0, top: yTop, width: w, height: (yTop + h) * p, background: withAlpha(theme.core, 0.045)}} />
      {/* 波带（行进前沿——core 渐变横带） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: yTop + (yTop + h) * p - 30,
          width: w,
          height: 60,
          background: `linear-gradient(${withAlpha(theme.core, 0)}, ${withAlpha(theme.core, 0.22)}, ${withAlpha(theme.core, 0)})`,
        }}
      />
      {/* 波上小环签名（0-C 压缩层同款——随波前行；不透底、恒定线宽） */}
      <div style={{position: 'absolute', left: w / 2 - 44, top: yTop + (yTop + h) * p - 44, width: 88, height: 88}}>
        <svg width={88} height={88} viewBox="0 0 88 88" style={{overflow: 'visible'}}>
          <circle cx={44} cy={44} r={34} fill={withAlpha(theme.bg, 0.55)} stroke={theme.core} strokeWidth={RING_STROKE * 0.66} strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
};
