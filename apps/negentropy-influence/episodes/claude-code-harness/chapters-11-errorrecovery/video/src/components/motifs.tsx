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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2–ep10 延续——
// LoopRing 描边色/线宽跨集恒定（theme.core = 陶土橙 #D97757 + RING_STROKE 6）
// = 逐字节拷贝的前提；Terminal/DispatchTable 本集无对应场景、不拷）
// （ep11 复制适配：本集环上高亮「调用模型」段＝被保护壳包住的那一步；报错
//  压黑／恢复回橙为状态色事件，由场景层承载、不改本组件描边契约）

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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep10 逐字节
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

/** 「调用模型」段的段位角（环上被保护壳包住的那一步——12 点位 ±30°，
 *  全片契约位：0-A 报错砸中位 / 1-A 壳建锚位 / 2-A 缩悬微光位） */
export const CALL_SEG = {center: -90, span: 60} as const;

/** SVG 弧 path（角度制，a0→a1 逆时针为负角惯例同 polar） */
const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number): string => {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} ${sweep} ${p1.x} ${p1.y}`;
};

/** 环「调用模型」段高亮条（暗橙微光→点亮态；1-A 建锚后全片在场位同角度）。
 *  `segP` 0..1 段条自段尾向段首生长；`glowP` 0..1 微光强度（0 = 暗橙低亮驻位）。 */
export const CallSegmentGlow: React.FC<{
  cx: number;
  cy: number;
  r: number;
  segP?: number;
  glowP?: number;
}> = ({cx, cy, r, segP = 1, glowP = 0.35}) => {
  const p = clamp01v(segP);
  const half = CALL_SEG.span / 2;
  const mid = CALL_SEG.center;
  const a0 = mid - half;
  const a1 = a0 + CALL_SEG.span * p;
  return (
    <path
      d={arcPath(cx, cy, r, a0, a1)}
      fill="none"
      stroke={theme.core}
      strokeWidth={RING_STROKE + 5}
      strokeLinecap="round"
      opacity={0.25 + 0.55 * clamp01v(glowP)}
    />
  );
};

/** 保护壳（恢复蓝气泡壳——只包「调用模型」段不包整环）。`growP` 0..1 自段两端
 *  生长合拢（两半弧相向铺开）；`glowP` 0..1 壳辉光；`lineP` 0..1 线稿态
 *  （4-D 骨架线稿：细线无气泡填充）；`mini` 缩悬环适配（r<40 时线宽收细）。 */
export const RingShell: React.FC<{
  cx: number;
  cy: number;
  r: number;
  growP?: number;
  glowP?: number;
  lineP?: number;
  mini?: boolean;
}> = ({cx, cy, r, growP = 1, glowP = 0.6, lineP = 0, mini = false}) => {
  const g = Math.max(0, Math.min(1, growP));
  const half = CALL_SEG.span / 2 + 6;
  const mid = CALL_SEG.center;
  const rShell = r + (mini ? 13 : 26);
  // 两半弧：自段两端（±half）向中点 0 相向生长，g=1 时在壳顶合拢
  const reach = half * g;
  const arcL = arcPath(cx, cy, rShell, mid - half, mid - half + reach);
  const arcR = arcPath(cx, cy, rShell, mid + half, mid + half - reach);
  const solid = Math.max(0, Math.min(1, 1 - lineP));
  const bubbleW = mini ? 15 : 44;
  const edgeW = mini ? 2.2 : 3.5 + 1.5 * solid;
  return (
    <g>
      {/* 半透明气泡壳体（填充感来自粗描边低透明） */}
      <path
        d={`${arcL} ${arcR}`}
        fill="none"
        stroke={theme.mech}
        strokeWidth={bubbleW}
        strokeLinecap="round"
        opacity={0.12 * glowP * g * solid}
      />
      {/* 壳描边（恢复蓝；线稿态收细） */}
      <path
        d={arcL}
        fill="none"
        stroke={theme.mech}
        strokeWidth={edgeW}
        strokeLinecap="round"
        opacity={(0.55 + 0.45 * Math.max(0, Math.min(1, glowP))) * (0.4 + 0.6 * solid)}
      />
      <path
        d={arcR}
        fill="none"
        stroke={theme.mech}
        strokeWidth={edgeW}
        strokeLinecap="round"
        opacity={(0.55 + 0.45 * Math.max(0, Math.min(1, glowP))) * (0.4 + 0.6 * solid)}
      />
    </g>
  );
};

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep11 Error Recovery）
// storyboard 实现映射登记：RoutingTable / BackoffCurve / TokenBudgetCard /
// MessageStack / BalanceScale（另设组装件 CallSegmentGlow / RingShell /
// BudgetRuler——跨场景复用的镜级构件，不属分镜登记名）。
// 全片主装置 = 环体（core 陶土橙恒定锚）+ 保护壳（mech 恢复蓝）+ 分类表
// RoutingTable（对照 ep2 查表装置 / ep10 分段卡之地位）：分类表 = 错误类型列
// 对动作列的对照分发（三行逐行点火 / 变灰卷起抽走 / 残影虚线回魂 / 缩微驻位
// 状态机），恢复蓝描边语义色恒定、缩微前后不重绘（scale 整体变换）。
// 等待曲线 BackoffCurve = 时间维副装置（退避紫阶梯 + 32s 封顶虚线 + 抖动细齿 +
// 实测节点标记）。消融对照（左红右绿）为 P3 主视觉、由场景排布（danger 左轨 /
// ok 右轨）。哑装置原则承 ep4–ep10：动效参数（进度/状态/读数）一律经 prop 由
// 调用场景注入，装置自身零 motion hook 调用（map/条件内纯函数推进）。

const clamp01v = (v: number) => Math.min(1, Math.max(0, v));

const withAlphaM = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01v(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 双 hex 线性插值（表变灰 / 卡溶解的 morph 描边；t 走场景 progress——effects
 *  不吃弹簧） */
export const mixHex = (a: string, b: string, t: number): string => {
  const p = clamp01v(t);
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + ((((pb >> 16) & 255) - ((pa >> 16) & 255)) * p));
  const g = Math.round(((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * p));
  const bl = Math.round((pa & 255) + (((pb & 255) - (pa & 255)) * p));
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
};

/** 分类表三行（错误类型 → 动作；教学版三路径——行内容全片恒定，点火态由
 *  rowsLit 驱动） */
export const ROUTING_ROWS: readonly {kind: string; action: string}[] = [
  {kind: '截断', action: '升额度'},
  {kind: '超限', action: '压缩'},
  {kind: '瞬态', action: '等待'},
];

/** 分类表（主装置·mech 恢复蓝——双列暗态轮廓 → 三行逐行点火 → 变灰卷起抽走
 *  → 残影虚线回魂 → 缩微驻位的全片状态机）。
 *  `litP` 卡入场；`rowsLit` 0..3 实数行点火（第 i 行 p = rowsLit - i）；
 *  `scanP` 0..1 扫描线扫过一拍（1-A 判定演示，窗外隐藏）；`grayP` 0..1 变灰
 *  （3-A 表死亡前奏）；`rollP` 0..1 卷起抽走（表脊为轴收卷 + 上移离场）；
 *  `ghostP` 0..1 残影虚线态（3-D 被点名不复活）；`scale` 缩微（缩驻右上/
 *  走查联动位——同形不重绘）。 */
export const RoutingTable: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  litP?: number;
  rowsLit?: number;
  scanP?: number;
  grayP?: number;
  rollP?: number;
  ghostP?: number;
  scale?: number;
}> = ({x, y, w, h, litP = 1, rowsLit = 0, scanP = -1, grayP = 0, rollP = 0, ghostP = 0, scale = 1}) => {
  const lit = clamp01v(litP);
  const gray = clamp01v(grayP);
  const roll = clamp01v(rollP);
  const ghost = clamp01v(ghostP);
  const edge = mixHex(theme.mech, theme.dim, Math.max(gray, ghost * 0.5));
  const headH = Math.round(h * 0.16);
  const rowH = (h - headH) / 3;
  const colL = Math.round(w * 0.42);
  const colR = w - colL;
  const rowPs = [0, 1, 2].map((i) => clamp01v(rowsLit - i));
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: lit * (1 - 0.35 * roll),
        transform: `scale(${scale}) translateY(${-64 * roll}px) rotate(${2.4 * roll}deg) scaleY(${1 - 0.72 * roll})`,
        transformOrigin: '50% 0%',
      }}
    >
      {/* 残影层（虚线轮廓——3-D 被点名不复活，只勾形不亮体） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: `3px dashed ${withAlphaM(theme.mech, 0.75)}`,
          opacity: ghost,
        }}
      >
        <div style={{position: 'absolute', inset: headH, display: 'flex', flexDirection: 'column', gap: 10, padding: '6px 14px'}}>
          {[0, 1, 2].map((i) => (
            <div
              key={`gh${i}`}
              style={{
                flex: 1,
                borderRadius: 8,
                border: `2.5px dashed ${withAlphaM(theme.mech, 0.4)}`,
              }}
            />
          ))}
        </div>
      </div>
      {/* 实体层（表死亡后随 roll 收卷退场；残影在场时实体隐去） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: `3px solid ${edge}`,
          background: withAlphaM(theme.panel, 0.96),
          boxShadow: `0 0 ${16 * (1 - gray)}px ${withAlphaM(theme.mech, 0.22 * (1 - gray) * lit)}`,
          opacity: 1 - ghost,
        }}
      >
        {/* 双列表头（错误类型 / 动作——暗态轮廓的列语义） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            height: headH,
            display: 'flex',
            alignItems: 'center',
            borderBottom: `2px solid ${withAlphaM(edge, 0.5)}`,
            padding: '0 16px',
            gap: 12,
          }}
        >
          <span style={{width: colL - 40, fontFamily: theme.mono, fontSize: Math.max(13, Math.round(h * 0.052)), color: mixHex(theme.dim, theme.panelBorder, gray * 0.4), letterSpacing: 1, whiteSpace: 'nowrap'}}>{'错误类型'}</span>
          <span style={{fontFamily: theme.mono, fontSize: Math.max(13, Math.round(h * 0.052)), color: mixHex(theme.dim, theme.panelBorder, gray * 0.4), whiteSpace: 'nowrap'}}>{'动作'}</span>
        </div>
        {/* 三行槽位（空槽暗态 → 点火亮行） */}
        <div style={{position: 'absolute', left: 0, top: headH, right: 0, bottom: 0, padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8}}>
          {ROUTING_ROWS.map((row, i) => {
            const p = rowPs[i];
            const ignite = Math.sin(Math.PI * p) * (p > 0 && p < 1 ? 1 : 0);
            const rowEdge = p > 0.3 ? mixHex(theme.mech, theme.dim, gray) : mixHex(theme.panelBorder, theme.dim, 0.15);
            return (
              <div
                key={row.kind}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 6px 0 10px',
                  gap: 12,
                  borderRadius: 9,
                  border: `2.5px ${p > 0.3 ? 'solid' : 'dashed'} ${rowEdge}`,
                  background: p > 0.3 ? withAlphaM(mixHex(theme.mech, theme.panel, 0.8), 0.2 + 0.1 * ignite) : 'transparent',
                  boxShadow: ignite > 0.05 ? `0 0 ${12 * ignite}px ${withAlphaM(theme.mech, 0.5 * ignite)}` : 'none',
                }}
              >
                <span style={{width: 34, fontFamily: theme.mono, fontSize: Math.max(12, Math.round(h * 0.048)), color: theme.dim, whiteSpace: 'nowrap'}}>{`0${i + 1}`}</span>
                <span
                  style={{
                    width: colL - 78,
                    fontFamily: theme.sans,
                    fontSize: Math.max(15, Math.round(h * 0.075)),
                    fontWeight: 600,
                    color: p > 0.3 ? mixHex(theme.text, theme.dim, gray) : theme.panelBorder,
                    whiteSpace: 'nowrap',
                    opacity: 0.35 + 0.65 * p,
                  }}
                >
                  {row.kind}
                </span>
                <svg width={30} height={16} viewBox="0 0 30 16" style={{opacity: 0.25 + 0.75 * p, flexShrink: 0}}>
                  <path d="M 2 8 L 22 8" stroke={mixHex(theme.mech, theme.dim, gray)} strokeWidth={2.6} strokeLinecap="round" />
                  <path d="M 18 2 L 26 8 L 18 14" fill="none" stroke={mixHex(theme.mech, theme.dim, gray)} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span
                  style={{
                    fontFamily: theme.sans,
                    fontSize: Math.max(15, Math.round(h * 0.075)),
                    fontWeight: 700,
                    color: p > 0.3 ? mixHex(theme.mech, theme.dim, gray) : theme.panelBorder,
                    whiteSpace: 'nowrap',
                    opacity: 0.35 + 0.65 * p,
                  }}
                >
                  {row.action}
                </span>
              </div>
            );
          })}
        </div>
        {/* 扫描线（1-A 判定的最简演示——窗外隐藏） */}
        {scanP > 0.01 && scanP < 0.99 ? (
          <div
            style={{
              position: 'absolute',
              left: 4,
              right: 4,
              top: headH + (h - headH - 4) * scanP,
              height: 3,
              background: withAlphaM(theme.mech, 0.85),
              boxShadow: `0 0 12px ${withAlphaM(theme.mech, 0.8)}`,
              borderRadius: 2,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

/** 退避紫阶梯的级高（每级为前级两倍——翻倍可读的硬契约；32s 封顶线 = 第 4 级
 *  顶沿：曲线触线走平，4→32s 的时长压缩落在 plateau 段（代码注释即口径） */
const STEP_RISERS = [12, 24, 48, 96] as const;

/** 等待曲线（副装置·backoff 退避紫——指数退避阶梯，1-D 首生 → 1-E 长齿 →
 *  2-A 走查右轨转正的同形状态机）。
 *  `stairsP` 0..4 实数级铺开；`labels` 级数字（缺省教学值 0.5s/1s/2s/4s，走查
 *  传实测值 0.58s/1.01s/2.14s）；`markP` 0..3 实测节点点亮（节点圆点+读数）；
 *  `capP` 0..1 封顶虚线亮起 + 触线走平；`jitterP` 0..1 节点上沿抖动细齿长出；
 *  `dotsP` 0..1 并发请求点沿齿位散布；`flagP` 0..1 Retry-After 旗标插队升起
 *  （旗文本进角标，画布只给旗形）；`scale` 缩微。 */
export const BackoffCurve: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  stairsP?: number;
  labels?: string[];
  markP?: number;
  capP?: number;
  jitterP?: number;
  dotsP?: number;
  flagP?: number;
  scale?: number;
}> = ({x, y, w, h, stairsP = 4, labels = ['0.5s', '1s', '2s', '4s'], markP = -1, capP = 0, jitterP = 0, dotsP = 0, flagP = 0, scale = 1}) => {
  const steps = STEP_RISERS.length;
  const x0 = 46;
  const baseY = h - 34;
  const sw = (w - x0 - 56) / (steps + 0.6); // 末级后留 plateau 段
  const levelY = (i: number) => baseY - STEP_RISERS.slice(0, i + 1).reduce((a, b) => a + b, 0);
  const capY = levelY(steps - 1);
  const platEnd = x0 + sw * steps + (w - x0 - 56 - sw * steps) * clamp01v(capP);
  const stepP = (i: number) => clamp01v(stairsP - i);
  const nodeP = (i: number) => clamp01v(markP - i);
  // 细齿/散点的确定性伪随机（禁随机数——sin 哈希，帧间稳定）
  const toothH = (k: number) => 7 + 11 * Math.abs(Math.sin(k * 3.7 + 1.3));
  const teeth: {tx: number; ty: number; th: number}[] = [];
  for (let i = 0; i < steps; i += 1) {
    const y = levelY(i);
    const n = 4;
    for (let k = 0; k < n; k += 1) {
      const idx = i * n + k;
      teeth.push({tx: x0 + i * sw + 10 + (k * (sw - 20)) / (n - 1), ty: y, th: toothH(idx)});
    }
  }
  const flagX = x0 + sw * 1.5;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'left top'}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{overflow: 'visible'}}>
        {/* 基线（时间轴） */}
        <line x1={x0 - 20} y1={baseY} x2={w - 20} y2={baseY} stroke={withAlphaM(theme.panelBorder, 0.9)} strokeWidth={2.5} />
        {/* 32s 封顶虚线（横贯上部；亮起后曲线触线走平） */}
        {capP > 0.01 ? (
          <g opacity={clamp01v(capP)}>
            <line x1={x0 - 20} y1={capY} x2={w - 20} y2={capY} stroke={withAlphaM(theme.backoff, 0.8)} strokeWidth={2.5} strokeDasharray="10 8" />
            <text x={w - 20} y={capY - 10} textAnchor="end" fontFamily={theme.mono} fontSize={17} fontWeight={700} fill={theme.backoff}>
              {'封顶 32s'}
            </text>
          </g>
        ) : null}
        {/* 阶梯（逐级铺开：横段 + 竖 riser，级高翻倍） */}
        {Array.from({length: steps}, (_, i) => {
          const p = stepP(i);
          const y = levelY(i);
          const prevY = i === 0 ? baseY : levelY(i - 1);
          return (
            <g key={`st${i}`} opacity={p > 0 ? 1 : 0}>
              <line
                x1={x0 + i * sw}
                y1={y}
                x2={x0 + i * sw + sw * p}
                y2={y}
                stroke={theme.backoff}
                strokeWidth={5}
                strokeLinecap="round"
              />
              {i > 0 ? (
                <line x1={x0 + i * sw} y1={prevY} x2={x0 + i * sw} y2={prevY + (y - prevY) * p} stroke={theme.backoff} strokeWidth={5} strokeLinecap="round" />
              ) : (
                <line x1={x0} y1={baseY} x2={x0} y2={y} stroke={theme.backoff} strokeWidth={5} strokeLinecap="round" />
              )}
              {/* 级数字（落在数据旁） */}
              <text
                x={x0 + i * sw + 6}
                y={y - 10}
                fontFamily={theme.mono}
                fontSize={17}
                fontWeight={700}
                fill={withAlphaM(theme.text, 0.9)}
                opacity={p}
              >
                {labels[i]}
              </text>
            </g>
          );
        })}
        {/* 触线走平段（plateau——封顶后的曲线形态） */}
        {capP > 0.01 ? (
          <line x1={x0 + sw * steps} y1={capY} x2={platEnd} y2={capY} stroke={theme.backoff} strokeWidth={5} strokeLinecap="round" opacity={clamp01v(capP)} />
        ) : null}
        {/* 实测节点标记（走查态：节点圆点 + 读数落在数据旁） */}
        {markP >= 0
          ? Array.from({length: steps}, (_, i) => {
              const p = nodeP(i);
              if (p <= 0.01) return null;
              const px = x0 + i * sw + 6;
              const py = levelY(i) + 16;
              return (
                <g key={`mk${i}`} opacity={p}>
                  <circle cx={px} cy={py} r={7} fill={theme.bg} stroke={theme.backoff} strokeWidth={3.5} />
                  <circle cx={px} cy={py} r={3} fill={theme.backoff} />
                </g>
              );
            })
          : null}
        {/* 抖动细齿（随机高低——sin 哈希防等距） */}
        {jitterP > 0.01
          ? teeth.map((t, k) => {
              const p = clamp01v(jitterP * 1.6 - k * 0.035);
              return p <= 0.01 ? null : (
                <line
                  key={`jt${k}`}
                  x1={t.tx}
                  y1={t.ty - 2}
                  x2={t.tx}
                  y2={t.ty - 2 - t.th * p}
                  stroke={withAlphaM(theme.backoff, 0.7)}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              );
            })
          : null}
        {/* 并发请求点（沿齿位错落散布——错峰的具象） */}
        {dotsP > 0.01
          ? teeth.map((t, k) => {
              if (k % 2 === 1) return null;
              const p = clamp01v(dotsP * 1.8 - k * 0.05);
              return p <= 0.01 ? null : (
                <circle key={`dp${k}`} cx={t.tx + 5} cy={t.ty - t.th - 10} r={4} fill={withAlphaM(theme.tool, 0.85)} opacity={p} />
              );
            })
          : null}
        {/* Retry-After 旗标（插队位在当前等待位之前——旗形 only，文本进角标） */}
        {flagP > 0.01 ? (
          <g opacity={clamp01v(flagP)}>
            <line x1={flagX} y1={levelY(1) + 8} x2={flagX} y2={levelY(1) - 74 * clamp01v(flagP)} stroke={theme.backoff} strokeWidth={3} strokeLinecap="round" />
            <path
              d={`M ${flagX} ${levelY(1) - 74 * clamp01v(flagP)} L ${flagX + 30} ${levelY(1) - 66 * clamp01v(flagP)} L ${flagX} ${levelY(1) - 58 * clamp01v(flagP)} Z`}
              fill={theme.backoff}
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
};

/** 额度数字卡（TokenBudgetCard——8000 → 64000 翻牌；截断→升额度路径的数据件，
 *  1-B 首演 / 2-C 复演同形）。`flipP` 0..1 翻牌（前半正面翻出、后半背面翻正）。 */
export const TokenBudgetCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  flipP?: number;
  litP?: number;
  scale?: number;
}> = ({x, y, w = 300, h = 150, flipP = 0, litP = 1, scale = 1}) => {
  const flip = clamp01v(flipP);
  const p1 = clamp01v(flip * 2);
  const p2 = clamp01v(flip * 2 - 1);
  const faceStyle = (rot: number, op: number): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    border: `3px solid ${withAlphaM(theme.mech, 0.4 + 0.6 * op)}`,
    background: withAlphaM(theme.panel, 0.97),
    backfaceVisibility: 'hidden',
    transform: `rotateX(${rot}deg)`,
    opacity: op,
  });
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: clamp01v(litP), transform: `scale(${scale})`, transformOrigin: 'left top', perspective: 620}}>
      <div style={faceStyle(-90 * p1, 1)}>
        <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim, letterSpacing: 2, whiteSpace: 'nowrap'}}>{'额度上限'}</span>
        <span style={{fontFamily: theme.mono, fontSize: 54, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>{'8000'}</span>
      </div>
      <div style={faceStyle(90 - 90 * p2, p2 > 0 ? 1 : 0)}>
        <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.mech, letterSpacing: 2, whiteSpace: 'nowrap'}}>{'额度上限 · 升后'}</span>
        <span style={{fontFamily: theme.mono, fontSize: 54, fontWeight: 700, color: theme.mech, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textShadow: p2 > 0.9 ? `0 0 18px ${withAlphaM(theme.mech, 0.55)}` : 'none'}}>{'64000'}</span>
      </div>
    </div>
  );
};

/** 额度增长条标尺（数字必带基线标尺——基线刻度 8000 恒常驻，读数 8000→64000
 *  动态拉升；`barP` 0..1 填充自基线位涨满，`flash` 定格 punch 辉光） */
export const BudgetRuler: React.FC<{
  x: number;
  y: number;
  w: number;
  litP?: number;
  barP?: number;
  flash?: number;
  scale?: number;
}> = ({x, y, w, litP = 1, barP = 0, flash = 0, scale = 1}) => {
  const p = clamp01v(barP);
  const baseFrac = 8000 / 64000;
  const fillX = baseFrac * w;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: clamp01v(litP), transform: `scale(${scale})`, transformOrigin: 'left top'}}>
      <div style={{display: 'flex', alignItems: 'flex-end', gap: 10, height: 46}}>
        <div style={{position: 'relative', flex: 1, height: 30, borderRadius: 6, border: `2.5px solid ${withAlphaM(theme.mech, 0.55)}`, background: withAlphaM(theme.panel, 0.9)}}>
          {/* 基线刻度 8000（恒常驻——读数变动的对照锚） */}
          <div style={{position: 'absolute', left: fillX, top: -8, bottom: -8, borderLeft: `3px dashed ${withAlphaM(theme.dim, 0.85)}`}} />
          {/* 增长填充（自基线位拉升至满格 64000——数据本体禁过冲，宽度线性于 p） */}
          <div
            style={{
              position: 'absolute',
              left: fillX,
              top: 0,
              bottom: 0,
              width: (w - fillX) * p,
              background: withAlphaM(theme.mech, 0.3 + 0.35 * p),
              boxShadow: flash > 0.05 ? `0 0 ${16 * clamp01v(flash)}px ${withAlphaM(theme.mech, 0.6)}` : 'none',
            }}
          />
        </div>
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 15, color: theme.dim, marginTop: 6, whiteSpace: 'nowrap'}}>
        <span style={{color: theme.dim}}>{'基线 8000'}</span>
        <span style={{color: p > 0.6 ? theme.mech : theme.dim, fontWeight: p > 0.6 ? 700 : 400}}>{'64000'}</span>
      </div>
    </div>
  );
};

/** 消息块列（MessageStack——九条等高消息块竖列；1-C 首演收叠 / 3-B 右轨 /
 *  2-C 左位复演同形）。`collapseP` 0..1 头部三条淡出收叠（其余上移补位）；
 *  `tailLit` 0..1 尾部五条保留位高亮框（keep_tail=5 语义——计数口径 9→6 与
 *  保留五条并存，进角标）；`litP` 入场。 */
export const MessageStack: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  collapseP?: number;
  tailLit?: number;
  litP?: number;
  scale?: number;
}> = ({x, y, w, h, collapseP = 0, tailLit = 0, litP = 1, scale = 1}) => {
  const c = clamp01v(collapseP);
  const count = 9;
  const gap = Math.max(4, Math.round(h * 0.012));
  const bh = (h - gap * (count - 1)) / count;
  const shift = c * 3 * (bh + gap);
  const tailEdge = withAlphaM(theme.mech, 0.4 + 0.6 * clamp01v(tailLit));
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: clamp01v(litP), transform: `scale(${scale})`, transformOrigin: 'left top'}}>
      {/* 尾部五条保留位高亮框（先立框——收叠前后框位恒定，保留位语义） */}
      {tailLit > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: -8,
            top: 4 * (bh + gap) + gap - 3 - shift,
            width: w + 16,
            height: 5 * bh + 4 * gap + 6,
            borderRadius: 10,
            border: `3px ${tailLit > 0.4 ? 'solid' : 'dashed'} ${tailEdge}`,
            opacity: clamp01v(tailLit),
          }}
        />
      ) : null}
      {Array.from({length: count}, (_, i) => {
        const head = i < 3;
        const op = head ? 1 - 0.9 * c : 1;
        const top = i * (bh + gap) - (head ? 0 : shift);
        return (
          <div
            key={`msg${i}`}
            style={{
              position: 'absolute',
              left: 0,
              top,
              width: w,
              height: bh,
              borderRadius: 6,
              border: `2px solid ${withAlphaM(theme.panelBorder, 0.95)}`,
              background: withAlphaM(theme.panel, head ? 0.55 : 0.92),
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 10px',
              opacity: op,
            }}
          >
            <span style={{width: 12, height: 12, borderRadius: 3, background: withAlphaM(i % 3 === 0 ? theme.tool : theme.dim, head ? 0.4 : 0.55), flexShrink: 0}} />
            <span style={{flex: 1, height: Math.max(3, Math.round(bh * 0.14)), borderRadius: 3, background: withAlphaM(theme.dim, head ? 0.22 : 0.3)}} />
            <span style={{fontFamily: theme.mono, fontSize: 12, color: withAlphaM(theme.dim, head ? 0.4 : 0.65), whiteSpace: 'nowrap'}}>{`m${i + 1}`}</span>
          </div>
        );
      })}
    </div>
  );
};

/** 分类表缩微驻位（1-E/2-A/2-B/2-C 跨镜一致——表缩微前后不重绘，右上锚位） */
export const TABLE_MINI = {x: 1600, y: 70, w: 560, h: 300, scale: 0.42} as const;

/** 缩微分类表（跨镜锚件——右上驻位同形；`dim` 走查联动期的让焦压暗） */
export const MiniTable: React.FC<{rowsLit?: number; dim?: number}> = ({rowsLit = 3, dim = 0.9}) => (
  <div style={{position: 'absolute', left: TABLE_MINI.x, top: TABLE_MINI.y, opacity: dim}}>
    <RoutingTable x={0} y={0} w={TABLE_MINI.w} h={TABLE_MINI.h} litP={1} rowsLit={rowsLit} scale={TABLE_MINI.scale} />
  </div>
);

/** 备用模型卡（1-E 待命位 ↔ 2-B 接棒位同形——伏笔回收不新建视觉；`solid`
 *  0..1 半透明待命 → 实体就位，常驻「需已配置」备注签） */
export const BackupCard: React.FC<{x: number; y: number; litP: number; solid?: number}> = ({x, y, litP, solid = 0}) => {
  const p = clamp01v(litP);
  const so = clamp01v(solid);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 400,
        height: 230,
        borderRadius: 14,
        border: `3px ${so > 0.4 ? 'solid' : 'dashed'} ${withAlphaM(theme.mech, 0.45 + 0.55 * so)}`,
        background: withAlphaM(theme.panel, 0.6 + 0.38 * so),
        padding: '18px 22px',
        opacity: p,
        boxShadow: so > 0.6 ? `0 0 22px ${withAlphaM(theme.mech, 0.4)}` : 'none',
      }}
    >
      <div style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 700, color: so > 0.4 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{'备用模型'}</div>
      <div style={{display: 'flex', gap: 8, marginTop: 14}}>
        {[0, 1, 2].map((k) => (
          <span key={`bc${k}`} style={{width: 46, height: 12, borderRadius: 4, background: withAlphaM(theme.mech, 0.18 + 0.14 * k)}} />
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 16,
          bottom: 14,
          padding: '3px 12px',
          borderRadius: 7,
          border: `2px solid ${withAlphaM(theme.dim, 0.7)}`,
          fontFamily: theme.sans,
          fontSize: 14,
          color: theme.dim,
          whiteSpace: 'nowrap',
        }}
      >
        {'需已配置'}
      </div>
    </div>
  );
};

/** 参数天平（BalanceScale——P4 参数对照：中支点、左右两卡等大等权重；激进档
 *  ↔ 保守档三行参数各带小图标，两卡同色恢复蓝系、无优劣色差——「都对」裁决
 *  禁红绿异色）。`riseP` 0..1 天平升起落定；`tilt` -1..1 摇摆（0 = 水平定格
 *  ——等权重=都对，天平永不可倾斜定格）；`rightRowsLit` 0..3 右卡三行参数
 *  点亮；`dissolveP` 0..1 两卡自外向内溶解（4-D 参数归于骨架）；`tagLit`
 *  {left, right} 两卡下方优先小签点亮。 */
export const BalanceScale: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  riseP?: number;
  tilt?: number;
  rightRowsLit?: number;
  dissolveP?: number;
  tagLit?: {left: number; right: number};
  litP?: number;
}> = ({x, y, w, h, riseP = 1, tilt = 0, rightRowsLit = 0, dissolveP = 0, tagLit = {left: 0, right: 0}, litP = 1}) => {
  const rise = clamp01v(riseP);
  const t = Math.max(-1, Math.min(1, tilt));
  const dis = clamp01v(dissolveP);
  const beamY = h * 0.34;
  const panDrop = 74;
  const half = w * 0.36;
  const paramRow = (label: string, val: string, icon: React.ReactNode, lit: number, side: 1 | -1, disP: number) => {
    const p = clamp01v(lit);
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '5px 10px',
          borderRadius: 7,
          border: `2px solid ${p > 0.35 ? withAlphaM(theme.mech, 0.85) : withAlphaM(theme.panelBorder, 0.9)}`,
          background: p > 0.35 ? withAlphaM(theme.mech, 0.16) : 'transparent',
          opacity: 0.45 + 0.55 * p,
          transform: `translateX(${side * -34 * disP}px)`,
        }}
      >
        <span style={{display: 'inline-flex', width: 20, height: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>{icon}</span>
        <span style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>{label}</span>
        <span style={{fontFamily: theme.mono, fontSize: 18, fontWeight: 700, color: p > 0.35 ? theme.text : theme.dim, marginLeft: 'auto', whiteSpace: 'nowrap'}}>{val}</span>
      </div>
    );
  };
  const iconBudget = (
    <svg width={18} height={18} viewBox="0 0 18 18">
      <rect x="2" y="9" width="14" height="6" rx="1.5" fill="none" stroke={theme.dim} strokeWidth={1.8} />
      <rect x="2" y="5" width="7" height="4" rx="1.5" fill="none" stroke={theme.dim} strokeWidth={1.8} />
    </svg>
  );
  const iconRetry = (
    <svg width={18} height={18} viewBox="0 0 18 18">
      <path d="M 14 9 A 5 5 0 1 1 9 4" fill="none" stroke={theme.dim} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M 7 1.5 L 10.5 4 L 7 6.5" fill="none" stroke={theme.dim} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const iconSwap = (
    <svg width={18} height={18} viewBox="0 0 18 18">
      <path d="M 3 6.5 L 13 6.5 M 10.5 4 L 13.5 6.5 L 10.5 9" fill="none" stroke={theme.dim} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 15 11.5 L 5 11.5 M 7.5 9 L 4.5 11.5 L 7.5 14" fill="none" stroke={theme.dim} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const pan = (side: 1 | -1, title: string, rows: {label: string; val: string; icon: React.ReactNode}[], rowsLit: number, tag: string, tagP: number) => {
    const cx = w / 2 + side * half;
    const rot = (t * 7 * side * -1) as number;
    return (
      <div style={{position: 'absolute', left: cx, top: beamY, transform: `translate(-50%, ${panDrop}px)`, opacity: 1}}>
        {/* 吊索（自梁端垂到卡顶——随卡水平，不随梁倾斜） */}
        <div style={{position: 'absolute', left: '50%', top: -panDrop, width: 2.5, height: panDrop, background: withAlphaM(theme.dim, 0.7), transform: 'translateX(-50%)'}} />
        <div
          style={{
            width: 300,
            padding: '14px 16px',
            borderRadius: 14,
            border: `3px solid ${withAlphaM(theme.mech, 0.75)}`,
            background: withAlphaM(theme.panel, 0.97),
            transform: `translateY(${rot * 6}px)`,
            opacity: 1 - dis,
            boxShadow: `0 0 ${18 * (1 - dis)}px ${withAlphaM(theme.mech, 0.18)}`,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.text, marginBottom: 8, whiteSpace: 'nowrap'}}>{title}</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            {rows.map((r) => paramRow(r.label, r.val, r.icon, rowsLit - rows.indexOf(r), side, dis))}
          </div>
        </div>
        {/* 优先小签（两卡下方——关键词签） */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 330,
            transform: `translateX(-50%) translateY(${(1 - clamp01v(tagP)) * 12}px)`,
            padding: '5px 16px',
            borderRadius: 9,
            border: `2.5px solid ${withAlphaM(theme.mech, 0.8)}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 17,
            fontWeight: 700,
            color: theme.mech,
            whiteSpace: 'nowrap',
            opacity: clamp01v(tagP),
          }}
        >
          {tag}
        </div>
      </div>
    );
  };
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: clamp01v(litP),
        transform: `translateY(${(1 - rise) * 64}px)`,
      }}
    >
      {/* 支点（中） */}
      <svg width={80} height={64} viewBox="0 0 80 64" style={{position: 'absolute', left: w / 2 - 40, top: beamY + panDrop * 0.4, opacity: 1 - dis}}>
        <path d="M 40 4 L 70 60 L 10 60 Z" fill={withAlphaM(theme.panel, 0.98)} stroke={withAlphaM(theme.dim, 0.85)} strokeWidth={3} strokeLinejoin="round" />
      </svg>
      {/* 横梁（绕中支点旋转；tilt=0 水平=等权重=都对） */}
      <svg width={w} height={20} viewBox={`0 0 ${w} 20`} style={{position: 'absolute', left: 0, top: beamY - 10, overflow: 'visible', opacity: 1 - dis}}>
        <g transform={`rotate(${t * -7} ${w / 2} 10)`}>
          <line x1={w / 2 - half} y1={10} x2={w / 2 + half} y2={10} stroke={theme.dim} strokeWidth={5} strokeLinecap="round" />
          <circle cx={w / 2 - half} cy={10} r={6} fill={theme.panelBorder} stroke={theme.dim} strokeWidth={2.5} />
          <circle cx={w / 2 + half} cy={10} r={6} fill={theme.panelBorder} stroke={theme.dim} strokeWidth={2.5} />
        </g>
      </svg>
      {/* 左卡：激进档（对照基线恒亮）；右卡：保守档（p4-04 逐行点亮） */}
      {pan(
        -1,
        '激进档',
        [
          {label: '额度', val: '64K', icon: iconBudget},
          {label: '重试', val: '10 次', icon: iconRetry},
          {label: '切换', val: '×3', icon: iconSwap},
        ],
        3,
        '成功率优先',
        tagLit.left,
      )}
      {pan(
        1,
        '保守档',
        [
          {label: '额度', val: '16K', icon: iconBudget},
          {label: '重试', val: '3 次', icon: iconRetry},
          {label: '切换', val: '×2', icon: iconSwap},
        ],
        rightRowsLit,
        '延迟与成本优先',
        tagLit.right,
      )}
    </div>
  );
};
