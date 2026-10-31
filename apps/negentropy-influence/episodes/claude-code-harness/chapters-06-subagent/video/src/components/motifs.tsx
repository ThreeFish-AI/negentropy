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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2/ep3/ep4/ep5 延续——
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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep5 逐字节
 * 拷贝（ep6 场景一律 `nodes={[]}`：环体即循环本体，「派活→回流」支线由场景在
 * 环外另绘短弧——主环本体不动、支线外挂）。
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

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep6 Subagent）
// storyboard 实现映射登记：MeetingRooms / RoomMessageList / TaskCard /
// ConclusionCard / ReturnChannel / ToolSlotRow / CountRing / BaselineBars /
// WhiteboardWall / PermissionGate / PrefixAlign / DocStack / RoomGlyph / MsgStrip。
// 全片主装置 = 两间会议室剖面 + 单向通道（对照 ep2 对照表 / ep5 清单+计数器之
// 地位）：左主会场钢蓝 / 右子代理室紫、通道单向右→左，缩微前后不重绘（scale
// 整体变换）。哑装置原则承 ep4/ep5：动效参数（进度/状态/读数）一律经 prop 由
// 调用场景注入，本段零 motion hooks——「怎么动」归场景，「画什么」归此处。

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 通用消息条（对话流条目——本集三色系：钢蓝 steel = 主对话主线 / mech 紫 =
 *  子代理室内条 / 缺省中性 dim = 过程记录与剪影）。`ghost` 0..1 灰化（降饱和
 *  渐暗非删除）；`flash` 0..1 落账闪。 */
export const MsgStrip: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
  sub?: string;
  color?: string;
  lit?: number;
  ghost?: number;
  flash?: number;
}> = ({x, y, w = 520, h = 44, label, sub, color, lit = 1, ghost = 0, flash = 0}) => {
  const c = color ?? withAlpha(theme.dim, 0.85);
  const g = clamp01(ghost);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        boxSizing: 'border-box',
        borderRadius: 8,
        border: `2.5px solid ${g > 0.5 ? withAlpha(theme.panelBorder, 0.9) : c}`,
        background: g > 0.5 ? 'transparent' : withAlpha(c, 0.1 + 0.16 * clamp01(flash)),
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        opacity: clamp01(lit) * (1 - 0.45 * g),
        filter: `saturate(${1 - 0.55 * g})`,
      }}
    >
      <span style={{fontFamily: theme.sans, fontSize: 21, fontWeight: 600, color: g > 0.5 ? theme.dim : theme.text, whiteSpace: 'nowrap'}}>
        {label}
      </span>
      {sub ? <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>{sub}</span> : null}
    </div>
  );
};

/** 派活描述卡（关键词签不复述全句；task 只进角标）。`pop` 0..1 弹出脉冲。 */
export const TaskCard: React.FC<{x: number; y: number; w?: number; h?: number; lit?: number; pop?: number; text?: string; sub?: string}> = ({
  x,
  y,
  w = 330,
  h = 64,
  lit = 1,
  pop = 0,
  text = '找测试框架',
  sub = 'task',
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: h,
      boxSizing: 'border-box',
      borderRadius: 10,
      border: `2.5px solid ${theme.text}`,
      background: theme.panel,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '0 18px',
      opacity: clamp01(lit),
      transform: `scale(${1 + 0.05 * clamp01(pop)})`,
      boxShadow: pop > 0.05 ? `0 0 ${22 * clamp01(pop)}px ${withAlpha(theme.text, 0.45)}` : 'none',
    }}
  >
    <span
      style={{
        fontFamily: theme.mono,
        fontSize: 15,
        fontWeight: 700,
        color: theme.bg,
        background: theme.mech,
        borderRadius: 6,
        padding: '2px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      {sub}
    </span>
    <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>{text}</span>
  </div>
);

/** 结论卡（钢蓝——结论回流通道同色；角标缺省 tool_result，走查卡换 pytest）。 */
export const ConclusionCard: React.FC<{x: number; y: number; w?: number; h?: number; lit?: number; flash?: number; text?: string; tag?: string}> = ({
  x,
  y,
  w = 380,
  h = 64,
  lit = 1,
  flash = 0,
  text = '一句话结论',
  tag = 'tool_result',
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: h,
      boxSizing: 'border-box',
      borderRadius: 10,
      border: `2.5px solid ${theme.steel}`,
      background: withAlpha(theme.steel, 0.1 + 0.16 * clamp01(flash)),
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '0 18px',
      opacity: clamp01(lit),
      boxShadow: flash > 0.05 ? `0 0 ${24 * clamp01(flash)}px ${withAlpha(theme.steel, 0.55)}` : 'none',
    }}
  >
    <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>{text}</span>
    <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.steel, marginLeft: 'auto', whiteSpace: 'nowrap'}}>{tag}</span>
  </div>
);

/** 单向回流通道（右→左恒定——数据本体方向，禁双向化）。`thick` 0..1 变粗
 *  （3-A 回传全史态）；`flow` 0..1 行进虚线相位；`switchLit` 0..1 中段「规矩
 *  开关」显形（两档标签 + 拨杆，`switchPos` 0=左档只回结论 / 1=右档回传全史）。 */
export const ReturnChannel: React.FC<{
  x: number;
  y: number;
  w: number;
  lit?: number;
  thick?: number;
  flow?: number;
  switchLit?: number;
  switchPos?: number;
  switchFlash?: number;
}> = ({x, y, w, lit = 1, thick = 0, flow = 0, switchLit = 0, switchPos = 0, switchFlash = 0}) => {
  const baseH = 40;
  const h = baseH + 54 * clamp01(thick);
  const cy = h / 2;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, pointerEvents: 'none'}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{overflow: 'visible', opacity: clamp01(lit)}}>
        {/* 通道带（变粗前后同一路径同 y 中心——粗细是唯一变量） */}
        <rect x={0} y={0} width={w} height={h} rx={h / 2} fill={withAlpha(theme.steel, 0.08 + 0.1 * clamp01(thick))} stroke={theme.steel} strokeWidth={2.5} />
        {/* 行进虚线（右→左；dashoffset 随 flow 行进——方向恒定） */}
        <line
          x1={w - 16}
          y1={cy}
          x2={16}
          y2={cy}
          stroke={theme.steel}
          strokeWidth={3}
          strokeDasharray="14 18"
          strokeDashoffset={-24 * (flow % 1)}
          opacity={0.85}
        />
        {/* 单向箭头（三枚左向 chevron——单向语义的静态宣告） */}
        {[0.3, 0.5, 0.7].map((f, i) => (
          <path
            key={i}
            d={`M ${w * f + 10} ${cy - 9} L ${w * f - 6} ${cy} L ${w * f + 10} ${cy + 9}`}
            fill="none"
            stroke={theme.steel}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
          />
        ))}
      </svg>
      {/* 规矩开关（3-A 新增件——回流通道中段；两档关键词签 + 拨杆） */}
      {switchLit > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: w / 2 - 210,
            top: -74,
            width: 420,
            boxSizing: 'border-box',
            borderRadius: 10,
            border: `2.5px solid ${withAlpha(theme.text, 0.8)}`,
            background: theme.panel,
            padding: '8px 12px 10px',
            opacity: clamp01(switchLit),
            boxShadow: switchFlash > 0.05 ? `0 0 ${26 * clamp01(switchFlash)}px ${withAlpha(theme.text, 0.5)}` : 'none',
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 12, color: theme.dim, marginBottom: 4}}>
            <span>{'extract_text'}</span>
            <span>{'return sub_history'}</span>
          </div>
          <div style={{position: 'relative', height: 40, borderRadius: 7, background: withAlpha(theme.panelBorder, 0.5)}}>
            {/* 两档标签（关键词签——左档只回结论 / 右档回传全部子历史） */}
            <span
              style={{
                position: 'absolute',
                left: 14,
                top: 8,
                fontFamily: theme.sans,
                fontSize: 17,
                fontWeight: 600,
                color: switchPos < 0.5 ? theme.text : theme.dim,
                whiteSpace: 'nowrap',
              }}
            >
              {'只回结论'}
            </span>
            <span
              style={{
                position: 'absolute',
                right: 14,
                top: 8,
                fontFamily: theme.sans,
                fontSize: 17,
                fontWeight: 600,
                color: switchPos > 0.5 ? theme.danger : theme.dim,
                whiteSpace: 'nowrap',
              }}
            >
              {'回传全史'}
            </span>
            {/* 拨杆 knob（左→右滑） */}
            <div
              style={{
                position: 'absolute',
                left: 8 + 250 * (1 - clamp01(switchPos)),
                top: -6,
                width: 26,
                height: 52,
                borderRadius: 7,
                border: `3px solid ${switchPos > 0.5 ? theme.danger : theme.ok}`,
                background: theme.panel,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

/** 工具列（五件基础工具卡 + 第六位）。紫室侧 `sixMode='empty'`（虚线空槽——
 *  派活工具的缺席轮廓）+ `seal`（单层封条）；主会场侧 `sixMode='task'`（task
 *  实卡，`sixLit` 点亮）。`five` 五卡亮度（stagger 由场景注入数组）。 */
const TOOL_FIVE = [
  {zh: '跑命令', en: 'bash'},
  {zh: '读文件', en: 'read'},
  {zh: '写文件', en: 'write'},
  {zh: '改文件', en: 'edit'},
  {zh: '找文件', en: 'glob'},
] as const;

export const ToolSlotRow: React.FC<{
  x: number;
  y: number;
  w?: number;
  cardH?: number;
  gap?: number;
  five?: readonly number[];
  sixMode?: 'empty' | 'task';
  sixLit?: number;
  slotLit?: number;
  seal?: number;
  dim?: number;
}> = ({x, y, w = 360, cardH = 64, gap = 10, five = [1, 1, 1, 1, 1], sixMode = 'empty', sixLit = 0, slotLit = 0, seal = 0, dim = 0}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, opacity: 1 - dim}}>
    {TOOL_FIVE.map((t, i) => {
      const p = clamp01(five[i] ?? 1);
      return (
        <div
          key={t.en}
          style={{
            height: cardH,
            marginBottom: gap,
            boxSizing: 'border-box',
            borderRadius: 9,
            border: `2px solid ${p > 0.5 ? withAlpha(theme.text, 0.65) : theme.panelBorder}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '0 16px',
            opacity: 0.4 + 0.6 * p,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 600, color: p > 0.5 ? theme.text : theme.dim}}>{t.zh}</span>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{t.en}</span>
        </div>
      );
    })}
    {/* 第六位：空槽虚线（紫室——派活工具的缺席轮廓，唯一虚线元素）或 task 实卡（主会场） */}
    <div style={{position: 'relative', height: cardH, marginBottom: gap}}>
      {sixMode === 'task' ? (
        <div
          style={{
            height: cardH,
            boxSizing: 'border-box',
            borderRadius: 9,
            border: `2.5px solid ${sixLit > 0.5 ? theme.mech : theme.panelBorder}`,
            background: sixLit > 0.5 ? withAlpha(theme.mech, 0.16) : theme.panel,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '0 16px',
            opacity: 0.45 + 0.55 * clamp01(sixLit),
            boxShadow: sixLit > 0.6 ? `0 0 ${20 * clamp01(sixLit)}px ${withAlpha(theme.mech, 0.5)}` : 'none',
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 600, color: clamp01(sixLit) > 0.5 ? theme.text : theme.dim}}>{'派活'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.mech}}>{'task'}</span>
        </div>
      ) : (
        <div
          style={{
            height: cardH,
            boxSizing: 'border-box',
            borderRadius: 9,
            border: `2.5px dashed ${slotLit > 0.3 ? withAlpha(theme.danger, 0.5 + 0.5 * slotLit) : theme.panelBorder}`,
            background: slotLit > 0.3 ? withAlpha(theme.danger, 0.05) : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            opacity: 0.55 + 0.45 * clamp01(slotLit),
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{'派活 · 缺席'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'task ∅'}</span>
        </div>
      )}
      {/* 单层封条（递归一层的具象——空槽上方压一枚小标） */}
      {seal > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: -12,
            top: -13,
            padding: '3px 12px',
            borderRadius: 7,
            border: `2px solid ${theme.danger}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 16,
            fontWeight: 700,
            color: theme.danger,
            whiteSpace: 'nowrap',
            opacity: clamp01(seal),
            transform: `rotate(-4deg)`,
          }}
        >
          {'单层'}
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, marginLeft: 8}}>{'depth = 1'}</span>
        </div>
      ) : null}
    </div>
  </div>
);

/** 30 轮计数环（兜底预算——中性刻度环非循环母题；危险红顶格线在 30）。
 *  `count` 0..30 实数（读数=四舍五入显示）；`topFlash` 0..1 到点红线一闪。 */
export const CountRing: React.FC<{cx: number; cy: number; r?: number; lit?: number; count?: number; topFlash?: number; dim?: number}> = ({
  cx,
  cy,
  r = 130,
  lit = 1,
  count = 0,
  topFlash = 0,
  dim = 0,
}) => {
  const ticks = Array.from({length: 30}, (_, i) => -90 + (i * 360) / 30);
  const sweep = (clamp01(count / 30)) * 359.9;
  return (
    <svg
      width={r * 2 + 60}
      height={r * 2 + 60}
      viewBox={`${-r - 30} ${-r - 30} ${r * 2 + 60} ${r * 2 + 60}`}
      style={{position: 'absolute', left: cx - r - 30, top: cy - r - 30, overflow: 'visible', opacity: clamp01(lit) * (1 - dim)}}
    >
      <circle r={r} fill="none" stroke={withAlpha(theme.panelBorder, 0.9)} strokeWidth={2} />
      {/* 30 刻度（恒 30 格——上限即语义） */}
      {ticks.map((a, i) => {
        const p1 = polar(0, 0, r, a);
        const p2 = polar(0, 0, r - (i % 5 === 0 ? 14 : 8), a);
        return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={withAlpha(theme.dim, 0.7)} strokeWidth={2} />;
      })}
      {/* 进度弧（0→count；到点即止、永不越 30） */}
      <circle
        r={r}
        fill="none"
        stroke={theme.text}
        strokeWidth={7}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - sweep / 360}
        transform="rotate(-90)"
        opacity={0.9}
      />
      {/* 顶格红线（30 位——到点即止的具象；topFlash 泛红一拍） */}
      <line
        x1={polar(0, 0, r + 10, -90).x}
        y1={polar(0, 0, r + 10, -90).y}
        x2={polar(0, 0, r - 16, -90).x}
        y2={polar(0, 0, r - 16, -90).y}
        stroke={theme.danger}
        strokeWidth={4 + 3 * clamp01(topFlash)}
        opacity={0.55 + 0.45 * clamp01(topFlash)}
      />
      {topFlash > 0.05 ? <circle r={r + 8} fill="none" stroke={theme.danger} strokeWidth={3} opacity={0.5 * clamp01(topFlash)} /> : null}
      <text y={12} textAnchor="middle" fontFamily={theme.mono} fontSize={52} fontWeight={700} fill={theme.text} style={{fontVariantNumeric: 'tabular-nums'}}>
        {String(Math.round(clamp01(count / 30) * 30))}
      </text>
      <text y={44} textAnchor="middle" fontFamily={theme.mono} fontSize={16} fill={theme.dim}>
        {'/ 30 轮'}
      </text>
    </svg>
  );
};

/** 子代理室内消息列表面板（CU 机位 1-B / 2-B / 2-C——空态三现同形）。
 *  `msgs` 实数点亮数；`counter` 读数显示值；`clear` 0..1 整层同步淡出（清空
 *  语义——一条不留）；`tagLit` SUB_SYSTEM 标签；`descLit` 任务描述卡（落底
 *  独占）；`flash` 计数落账闪。 */
export const RoomMessageList: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  lit?: number;
  tagLit?: number;
  descLit?: number;
  descText?: string;
  msgs?: number;
  counter?: number;
  clear?: number;
  counterFlash?: number;
}> = ({
  x,
  y,
  w = 780,
  h = 640,
  lit = 1,
  tagLit = 0,
  descLit = 0,
  descText = '找测试框架',
  msgs = 0,
  counter = 0,
  clear = 0,
  counterFlash = 0,
}) => {
  const ROWS = 16;
  const rowH = 24;
  const gap = 5;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: clamp01(lit)}}>
      <Panel accent={theme.mech} style={{width: '100%', height: '100%', boxSizing: 'border-box', padding: 16, position: 'relative'}}>
        {/* 头行：室内名 + 计数角标（先账后清——计数先亮后清空） */}
        <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', height: 36}}>
          <span style={{fontFamily: theme.mono, fontSize: 18, fontWeight: 700, color: theme.mech, letterSpacing: 1}}>{'subagent · 新对话'}</span>
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 26,
              fontWeight: 700,
              color: theme.text,
              fontVariantNumeric: 'tabular-nums',
              textShadow: counterFlash > 0.05 ? `0 0 ${12 * clamp01(counterFlash)}px ${withAlpha(theme.text, 0.8)}` : 'none',
            }}
          >
            {/* ⑨ QA RISKY-1：去 clamp01（钳 [0,1] 使 ≥1 条数恒渲「1 条」；调用点传值有界 0..16） */}
            {`${Math.round(counter)} 条`}
          </span>
        </div>
        {/* 列表顶「独立系统提示」标签位（仅四字不成句） */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 8,
            padding: '4px 14px',
            borderRadius: 7,
            border: `2px solid ${withAlpha(theme.mech, 0.8)}`,
            background: withAlpha(theme.mech, 0.1),
            opacity: clamp01(tagLit),
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 600, color: theme.text}}>{'独立系统提示'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'SUB_SYSTEM'}</span>
        </div>
        {/* 消息条堆高区（读文件结果条与轮转条交错；整层同步淡出=清空） */}
        <div style={{position: 'relative', height: ROWS * (rowH + gap), marginTop: 10, opacity: 1 - clamp01(clear) * 0.96, filter: `saturate(${1 - 0.4 * clamp01(clear)})`}}>
          {Array.from({length: ROWS}, (_, i) => {
            const p = clamp01(msgs - i);
            const isTool = i % 2 === 0;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: i * (rowH + gap),
                  width: '100%',
                  height: rowH,
                  opacity: p,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: rowH,
                    boxSizing: 'border-box',
                    borderRadius: 7,
                    /* ⑨ QA W2：紫系（视觉契约「内部消息条=紫」衔接「紫=子代理」色教学；
                       工具条亮紫 / 轮转条暗紫保留次级差异） */
                    border: `2px solid ${isTool ? withAlpha(theme.mech, 0.62) : withAlpha(theme.mech, 0.32)}`,
                    background: isTool ? withAlpha(theme.mech, 0.08) : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 12,
                    fontFamily: theme.sans,
                    fontSize: 13,
                    color: theme.dim,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isTool ? `读取 ${['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'][Math.floor(i / 2) % 8]}.py 结果` : `轮转 ${Math.floor(i / 2) + 1}`}
                </div>
              </div>
            );
          })}
        </div>
        {/* 任务描述卡（落底独占——空态同形的家具位） */}
        <div style={{position: 'absolute', left: 16, right: 16, bottom: 16, opacity: clamp01(descLit)}}>
          <div
            style={{
              height: 56,
              boxSizing: 'border-box',
              borderRadius: 9,
              border: `2.5px solid ${theme.text}`,
              background: theme.panel,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '0 18px',
            }}
          >
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 13,
                fontWeight: 700,
                color: theme.bg,
                background: theme.mech,
                borderRadius: 6,
                padding: '2px 10px',
              }}
            >
              {'task'}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 22, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>{descText}</span>
          </div>
        </div>
      </Panel>
    </div>
  );
};

/** 两间会议室剖面（全片主装置·状态机——装配 / 走查 / 灌满 / 清空复现全经此件）。
 *  左主会场钢蓝（消息条整齐 + 工具表纵列 + 计数角标）、右子代理室紫、中墙
 *  可生长（`wallW` 180→560——4-A 墙体放大居中）、单向通道右→左嵌于墙位。
 *  紫室空态（msgs=0 / clear 完）三现同形不重绘；缩微走外层 scale。 */
export const MeetingRooms: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  scale?: number;
  lit?: number;
  dim?: number;
  wallW?: number;
  rightOpen?: number;
  leftBars?: number;
  leftAdd?: number;
  leftAddFlash?: number;
  leftDanger?: number;
  leftOverflow?: number;
  counterVal?: number;
  counterFlash?: number;
  toolsFive?: readonly number[];
  taskLit?: number;
  roomBars?: number;
  roomClear?: number;
  roomDesc?: number;
  ringLit?: number;
  ringDot?: number;
  branchLit?: number;
  branchPulse?: number;
  channelThick?: number;
  channelFlow?: number;
  switchLit?: number;
  switchPos?: number;
  switchFlash?: number;
  flyReturn?: number;
  wallQ?: number;
  wallBoard?: number;
  showTools?: boolean;
}> = ({
  x,
  y,
  w = 1460,
  h = 560,
  scale = 1,
  lit = 1,
  dim = 0,
  wallW = 180,
  rightOpen = 1,
  leftBars = 3,
  leftAdd = 0,
  leftAddFlash = 0,
  leftDanger = 0,
  leftOverflow = 0,
  counterVal = 0,
  counterFlash = 0,
  toolsFive = [1, 1, 1, 1, 1],
  taskLit = 0,
  roomBars = 0,
  roomClear = 0,
  roomDesc = 0,
  ringLit = 0,
  ringDot,
  branchLit = 0,
  branchPulse = 0,
  channelThick = 0,
  channelFlow = 0,
  switchLit = 0,
  switchPos = 0,
  switchFlash = 0,
  flyReturn,
  wallQ = 0,
  wallBoard = 0,
  showTools = true,
}) => {
  const roomW = (w - wallW) / 2;
  const wallX = roomW;
  const channelY = h * 0.4;
  // 工具列卡高随室高自适应（缩微态 3-B 双轨不溢出室框）
  const toolCardH = Math.max(22, Math.min(40, Math.floor((h - 74) / 6) - 7));
  const toolGap = Math.max(4, Math.min(7, Math.floor(toolCardH / 6)));
  const ro = clamp01(rightOpen);
  const ringSize = 116;
  const ringR = ringSize / 2 - 46;
  const ringCx = roomW - ringSize / 2 + 6;
  const ringCy = 76;
  const leftBarLabels = ['旧消息', '工具结果', '轮转', '工具结果', '轮转', '工具结果', '轮转', '旧消息'];
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
      {/* 左主会场（钢蓝描边——0-A 同款消息面板收拢为一室剖面） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: roomW,
          height: h,
          boxSizing: 'border-box',
          borderRadius: 16,
          border: `3px solid ${withAlpha(theme.steel, 0.85)}`,
          background: withAlpha(theme.panel, 0.92),
          boxShadow: leftDanger > 0.05 ? `0 0 ${34 * clamp01(leftDanger)}px ${withAlpha(theme.danger, 0.5)}, inset 0 0 ${40 * clamp01(leftDanger)}px ${withAlpha(theme.danger, 0.16)}` : 'none',
        }}
      >
        <div style={{position: 'absolute', left: 18, top: 14, fontFamily: theme.mono, fontSize: 15, color: theme.steel}}>{'主会场 · 主对话'}</div>
        {/* 计数角标（落账读数——先亮后清次序由场景注入；无账态不显示占位） */}
        {counterVal > 0 ? (
        <div
          style={{
            position: 'absolute',
            right: 16,
            top: 10,
            fontFamily: theme.mono,
            fontSize: 22,
            fontWeight: 700,
            color: theme.text,
            fontVariantNumeric: 'tabular-nums',
            textShadow: counterFlash > 0.05 ? `0 0 ${12 * clamp01(counterFlash)}px ${withAlpha(theme.ok, 0.9)}` : 'none',
          }}
        >
          {/* ⑨ QA RISKY-1：同上——去 clamp01 直取 Math.round */}
          {`${Math.round(counterVal)} 条`}
        </div>
        ) : null}
        {/* 工具表纵列（五件小卡 + task 卡位——主会场侧 sixMode='task'；缩微态
            （3-B 双轨）可整列收起让位消息区） */}
        {showTools ? (
          <div style={{position: 'absolute', left: 14, top: 44, width: 150}}>
            <ToolSlotRow x={0} y={0} w={150} cardH={toolCardH} gap={toolGap} five={toolsFive} sixMode="task" sixLit={taskLit} />
          </div>
        ) : null}
        {/* 消息条整齐列（钢蓝——灌满态逐条点亮；溢出一拍=条顶上移露头） */}
        <div style={{position: 'absolute', left: showTools ? 180 : 16, right: 16, top: 48, height: h - 66, overflow: 'visible'}}>
          <div style={{position: 'relative', width: '100%', height: '100%', transform: `translateY(${-12 * clamp01(leftOverflow)}px)`}}>
            {Array.from({length: 16}, (_, i) => {
              const p = clamp01(leftBars - i);
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: i * ((h - 78) / 16),
                    width: '100%',
                    height: (h - 78) / 16 - 5,
                    boxSizing: 'border-box',
                    borderRadius: 6,
                    border: `2px solid ${p > 0.5 ? withAlpha(theme.steel, 0.55) : withAlpha(theme.panelBorder, 0.7)}`,
                    background: p > 0.5 ? withAlpha(theme.steel, 0.08) : 'transparent',
                    opacity: 0.35 + 0.65 * p,
                  }}
                >
                  {i < 8 ? (
                    <span style={{fontFamily: theme.sans, fontSize: 13, color: theme.dim, lineHeight: `${(h - 78) / 16 - 9}px`, paddingLeft: 10, whiteSpace: 'nowrap'}}>
                      {leftBarLabels[i]}
                    </span>
                  ) : null}
                </div>
              );
            })}
            {/* 「只多两条」新落账（钢蓝两条 + 确认绿闪——增量恰两条） */}
            {[0, 1].map((k) => (
              <div
                key={`add${k}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  width: '100%',
                  height: 34,
                  top: (h - 78) * 0.55 + k * 40,
                  opacity: clamp01(leftAdd),
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: 34,
                    boxSizing: 'border-box',
                    borderRadius: 7,
                    border: `2.5px solid ${k === 0 ? theme.steel : theme.steel}`,
                    background: withAlpha(theme.steel, 0.12 + 0.18 * clamp01(leftAddFlash)),
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 10,
                    fontFamily: theme.sans,
                    fontSize: 15,
                    fontWeight: 600,
                    color: theme.text,
                    boxShadow: leftAddFlash > 0.3 ? `0 0 ${14 * clamp01(leftAddFlash)}px ${withAlpha(theme.ok, 0.55)}` : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {k === 0 ? '派活记录' : '结论'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 中墙（可生长：墙体放大居中=4-A；白板暗纹→转实经 wallBoard） */}
      <div
        style={{
          position: 'absolute',
          left: wallX,
          top: 0,
          width: wallW,
          height: h,
          boxSizing: 'border-box',
          borderRadius: 10,
          border: `2px solid ${withAlpha(theme.panelBorder, 0.9)}`,
          background: withAlpha(theme.panel, 0.6),
        }}
      >
        {/* 白板（暗纹 0.18 → 转实 1——透出/亮起两态） */}
        <div
          style={{
            position: 'absolute',
            left: Math.max(10, wallW * 0.08),
            right: Math.max(10, wallW * 0.08),
            top: h * 0.12,
            bottom: h * 0.3,
            boxSizing: 'border-box',
            borderRadius: 8,
            border: `2px solid ${withAlpha(theme.text, 0.25 + 0.6 * clamp01(wallBoard))}`,
            background: withAlpha(theme.text, 0.03 + 0.05 * clamp01(wallBoard)),
            opacity: clamp01(wallBoard),
          }}
        />
        {/* 墙体问号（3-C——欲显未显的边界悬念） */}
        {wallQ > 0.01 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: h * 0.3,
              textAlign: 'center',
              fontFamily: theme.serif,
              fontSize: 64,
              fontWeight: 700,
              color: theme.text,
              opacity: clamp01(wallQ) * 0.9,
            }}
          >
            {'?'}
          </div>
        ) : null}
      </div>

      {/* 右子代理室（紫描边——弹出成形；空态/堆高/清空三现同形） */}
      <div
        style={{
          position: 'absolute',
          left: wallX + wallW,
          top: (1 - ro) * 26,
          width: roomW,
          height: h - (1 - ro) * 52,
          boxSizing: 'border-box',
          borderRadius: 16,
          border: `3px solid ${withAlpha(theme.mech, 0.85)}`,
          background: withAlpha(theme.panel, 0.92),
          opacity: 0.25 + 0.75 * ro,
        }}
      >
        <div style={{position: 'absolute', left: 18, top: 14, fontFamily: theme.mono, fontSize: 15, color: theme.mech}}>{'子代理 · 新会议室'}</div>
        {/* 室内消息条（堆高→整层淡出=用完清空；空态=零条） */}
        <div style={{position: 'absolute', left: 18, right: 18, top: 44, bottom: 18, opacity: 1 - clamp01(roomClear) * 0.96}}>
          {Array.from({length: 16}, (_, i) => {
            const p = clamp01(roomBars - i);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: i * ((h - 70) / 16),
                  height: (h - 70) / 16 - 5,
                  boxSizing: 'border-box',
                  borderRadius: 6,
                  border: `2px solid ${p > 0.5 ? withAlpha(theme.dim, 0.55) : withAlpha(theme.panelBorder, 0.7)}`,
                  opacity: 0.3 + 0.7 * p,
                }}
              />
            );
          })}
          {/* 任务描述卡在场（走查工况——占列表首格） */}
          {roomDesc > 0.01 ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: 38,
                boxSizing: 'border-box',
                borderRadius: 7,
                border: `2.5px solid ${theme.text}`,
                background: theme.panel,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 12px',
                opacity: clamp01(roomDesc),
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 11, fontWeight: 700, color: theme.bg, background: theme.mech, borderRadius: 5, padding: '1px 8px'}}>{'task'}</span>
              <span style={{fontFamily: theme.sans, fontSize: 15, fontWeight: 600, color: theme.text}}>{'找测试框架'}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* 单向通道（右→左恒定——嵌于墙位；粗细/开关/流光全经 ReturnChannel） */}
      <ReturnChannel
        x={wallX - 34}
        y={channelY}
        w={wallW + 68}
        lit={ro}
        thick={channelThick}
        flow={channelFlow}
        switchLit={switchLit}
        switchPos={switchPos}
        switchFlash={switchFlash}
      />

      {/* 结论卡沿通道飞回（右→左；flyReturn 0..1 一趟；落账两条显形后让位淡出） */}
      {flyReturn !== undefined && flyReturn > 0.01 && flyReturn < 1.3 ? (
        <div style={{position: 'absolute', left: wallX - 34 + (wallW + 68) * (1 - Math.min(flyReturn, 1)) - 90, top: channelY - 34, opacity: (1 - Math.max(0, flyReturn - 1) * 3) * (1 - 0.9 * clamp01(leftAdd))}}>
          <ConclusionCard x={0} y={0} w={180} h={40} lit={1} text={'结论'} tag={''} />
        </div>
      ) : null}

      {/* 缩悬环体（M-001 同形小尺度——主会场上角；支线外挂不动主环本体） */}
      {ringLit > 0.01 ? (
        <>
          <div style={{position: 'absolute', left: ringCx - ringSize / 2, top: ringCy - ringSize / 2, opacity: clamp01(ringLit)}}>
            <LoopRing size={ringSize} nodes={[]} showExit={false} dotProgress={ringDot} />
          </div>
          {/* 「派活→回流」支线短弧（执行段〔90°〕外侧——主环本体不动，本集生长件） */}
          {branchLit > 0.01 ? (
            <svg width={ringSize + 90} height={ringSize + 90} viewBox={`${-45} ${-45} ${ringSize + 90} ${ringSize + 90}`} style={{position: 'absolute', left: ringCx - ringSize / 2 - 45, top: ringCy - ringSize / 2 - 45, overflow: 'visible', pointerEvents: 'none'}}>
              <path
                d={`M ${polar(ringSize / 2, ringSize / 2, ringR + 20, 52).x} ${polar(ringSize / 2, ringSize / 2, ringR + 20, 52).y} A ${ringR + 20} ${ringR + 20} 0 0 1 ${polar(ringSize / 2, ringSize / 2, ringR + 20, 128).x} ${polar(ringSize / 2, ringSize / 2, ringR + 20, 128).y}`}
                fill="none"
                stroke={theme.steel}
                strokeWidth={4}
                strokeLinecap="round"
                opacity={clamp01(branchLit)}
                strokeDasharray={branchPulse > 0.05 ? undefined : '7 7'}
              />
              <circle cx={polar(ringSize / 2, ringSize / 2, ringR + 20, 52).x} cy={polar(ringSize / 2, ringSize / 2, ringR + 20, 52).y} r={7} fill={theme.mech} opacity={clamp01(branchLit)} />
              <circle cx={polar(ringSize / 2, ringSize / 2, ringR + 20, 128).x} cy={polar(ringSize / 2, ringSize / 2, ringR + 20, 128).y} r={7} fill={theme.steel} opacity={clamp01(branchLit)} />
              {branchPulse > 0.05 ? (
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringR + 20}
                  fill="none"
                  stroke={theme.steel}
                  strokeWidth={2.5}
                  opacity={0.5 * clamp01(branchPulse)}
                />
              ) : null}
            </svg>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

/** 群像会议室小室（5-A EWS 会议室群——主会场居中 / 四周紫室开合）。 */
export const RoomGlyph: React.FC<{cx: number; cy: number; w: number; h: number; accent: string; label: string; lit?: number; open?: number}> = ({
  cx,
  cy,
  w,
  h,
  accent,
  label,
  lit = 1,
  open = 1,
}) => {
  const o = clamp01(open);
  return (
    <div
      style={{
        position: 'absolute',
        left: cx - (w * (0.7 + 0.3 * o)) / 2,
        top: cy - (h * (0.7 + 0.3 * o)) / 2,
        width: w,
        height: h,
        boxSizing: 'border-box',
        borderRadius: 12,
        /* ⑨ QA W3：视觉权重三升（描边 2.5→4、室内底色随 accent、开合下限 0.35→0.55、
           室名字号 13→17）——半分辨率下「越开越多」须有画面证据；底色随 accent 派生
           （紫室紫底/主会场钢蓝底），不写死 mech 以保组件通用契约 */
        border: `4px solid ${withAlpha(accent, 0.85)}`,
        background: withAlpha(accent, 0.1),
        opacity: clamp01(lit) * (0.55 + 0.45 * o),
        transform: `scale(${0.82 + 0.18 * o})`,
      }}
    >
      <div style={{position: 'absolute', left: 14, top: 8, fontFamily: theme.mono, fontSize: 17, color: accent}}>{label}</div>
    </div>
  );
};

/** 三栏基线标尺（2-D 实测对比——派活 / 亲自动手 / 子代理内部）。增长条高度比
 *  =真实字符比 147:2626:2617（数据本体禁过冲）；最短条保底可读 + 精确值旁标。
 *  `cols`: barP 增长条 0..1 / valP 双读数 0..1 / count 条数 / chars 字符数。 */
export const BaselineBars: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  lit?: number;
  cols: readonly {tag: string; sub: string; count: number; chars: number; color: string; barP: number; valP: number; note?: string}[];
  rulerLit?: number;
}> = ({x, y, w = 1500, h = 420, lit = 1, cols, rulerLit = 1}) => {
  const MAXC = 2626;
  const MINH = 34;
  const colW = w / cols.length;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: clamp01(lit)}}>
      {cols.map((c, i) => {
        const trueH = (h - 130) * (c.chars / MAXC);
        const barH = Math.max(MINH, trueH) * clamp01(c.barP);
        const cx0 = i * colW + colW / 2;
        return (
          <div key={c.tag}>
            {/* 栏头（栏名 + 工况角标） */}
            <div style={{position: 'absolute', left: cx0 - colW / 2, top: 0, width: colW, textAlign: 'center'}}>
              <div style={{fontFamily: theme.sans, fontSize: 27, fontWeight: 700, color: c.color === theme.dim ? theme.text : c.color}}>{c.tag}</div>
              <div style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginTop: 2}}>{c.sub}</div>
              {c.note ? (
                <div style={{fontFamily: theme.sans, fontSize: 16, color: theme.dim, marginTop: 4}}>{c.note}</div>
              ) : null}
            </div>
            {/* 增长条（真实比例 + 保底可读——精确值旁标补偿读数） */}
            <div
              style={{
                position: 'absolute',
                left: cx0 - 90,
                top: h - 60 - barH,
                width: 180,
                height: barH,
                boxSizing: 'border-box',
                borderRadius: 8,
                border: `2.5px solid ${c.color}`,
                background: withAlpha(c.color, 0.14),
              }}
            />
            {/* 精确值旁标（条顶——保底条的可读补偿） */}
            <div
              style={{
                position: 'absolute',
                left: cx0 + 100,
                top: h - 74 - barH,
                fontFamily: theme.mono,
                fontSize: 19,
                fontWeight: 700,
                color: theme.text,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                opacity: clamp01(c.valP),
              }}
            >
              {`${c.chars} 字符`}
            </div>
          </div>
        );
      })}
      {/* 双口径计数位（条/字符同屏——基线下沿） */}
      {cols.map((c, i) => {
        const cx0 = i * (w / cols.length) + colW / 2;
        return (
          <div
            key={`cnt${c.tag}`}
            style={{
              position: 'absolute',
              left: cx0 - colW / 2,
              top: h - 52,
              width: colW,
              textAlign: 'center',
              fontFamily: theme.mono,
              fontSize: 22,
              fontWeight: 700,
              color: theme.text,
              fontVariantNumeric: 'tabular-nums',
              opacity: clamp01(c.valP),
            }}
          >
            {`${c.count} 条`}
          </div>
        );
      })}
      {/* 共用基线标尺（恒常驻） */}
      <div style={{position: 'absolute', left: 30, right: 30, top: h - 60, height: 0, borderTop: `3px solid ${withAlpha(theme.dim, 0.7)}`, opacity: clamp01(rulerLit)}} />
      <div style={{position: 'absolute', left: 30, top: h - 50, fontFamily: theme.mono, fontSize: 13, color: theme.dim, opacity: clamp01(rulerLit)}}>
        {'字符口径增长条 · 共底基线'}
      </div>
      {/* ⑨ QA W1：工况角标（G1 修订后 storyboard 已登记的契约元素） */}
      <div style={{position: 'absolute', right: 30, top: h - 50, fontFamily: theme.mono, fontSize: 13, color: theme.dim, opacity: clamp01(rulerLit)}}>
        {'episode B · 实测口径'}
      </div>
    </div>
  );
};

/** 墙体白板（4-A/4-B 主角件——两室正中、同一工作目录）。`board` 0.2 暗纹 → 1
 *  转实；`marks` 紫笔迹文件卡；`marksCmd` 命令痕迹条；`vision` 钢蓝视野圈罩板；
 *  `workdir` WORKDIR 角标。 */
export const WhiteboardWall: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  lit?: number;
  board?: number;
  q?: number;
  marks?: number;
  marksCmd?: number;
  vision?: number;
  workdir?: number;
}> = ({x, y, w, h, lit = 1, board = 1, q = 0, marks = 0, marksCmd = 0, vision = 0, workdir = 0}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: clamp01(lit)}}>
    {/* 墙体（外框） */}
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        borderRadius: 14,
        border: `3px solid ${withAlpha(theme.panelBorder, 0.95)}`,
        background: withAlpha(theme.panel, 0.55),
        position: 'relative',
      }}
    >
      {/* 白板（暗纹→转实——两室笔迹同板共存） */}
      <div
        style={{
          position: 'absolute',
          left: 26,
          right: 26,
          top: 30,
          bottom: 30,
          boxSizing: 'border-box',
          borderRadius: 10,
          border: `2.5px solid ${withAlpha(theme.text, 0.3 + 0.55 * clamp01(board))}`,
          background: withAlpha(theme.text, 0.035 + 0.05 * clamp01(board)),
        }}
      >
        {/* WORKDIR 角标（贴板角） */}
        <span
          style={{
            position: 'absolute',
            right: 10,
            bottom: 8,
            fontFamily: theme.mono,
            fontSize: 14,
            color: theme.dim,
            opacity: clamp01(workdir),
          }}
        >
          {'WORKDIR'}
        </span>
        {/* 紫笔迹：文件小卡（子代理写出——清点可数） */}
        {['a.py', 'b.py', 'c.py'].map((f, i) => (
          <div
            key={f}
            style={{
              position: 'absolute',
              left: 30 + i * 150,
              top: 26,
              width: 118,
              height: 58,
              boxSizing: 'border-box',
              borderRadius: 8,
              border: `2.5px solid ${withAlpha(theme.mech, 0.8)}`,
              background: withAlpha(theme.mech, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 19,
              color: theme.text,
              opacity: clamp01(marks),
            }}
          >
            {f}
          </div>
        ))}
        {/* 紫笔迹：命令痕迹条（跑过的命令） */}
        {[0, 1].map((i) => (
          <div
            key={`cmd${i}`}
            style={{
              position: 'absolute',
              left: 30,
              top: 116 + i * 46,
              width: 420 - i * 90,
              height: 34,
              boxSizing: 'border-box',
              borderRadius: 7,
              border: `2px solid ${withAlpha(theme.mech, 0.55)}`,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 12,
              fontFamily: theme.mono,
              fontSize: 16,
              color: theme.dim,
              whiteSpace: 'nowrap',
              opacity: clamp01(marksCmd),
            }}
          >
            {i === 0 ? '$ pytest -q · 痕迹' : '$ grep -r pytest · 痕迹'}
          </div>
        ))}
      </div>
      {/* 问号（3-C 暗纹态承袭——转实前隐现） */}
      {q > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: h * 0.32,
            textAlign: 'center',
            fontFamily: theme.serif,
            fontSize: 110,
            fontWeight: 700,
            color: theme.text,
            opacity: clamp01(q) * (1 - clamp01(board)),
          }}
        >
          {'?'}
        </div>
      ) : null}
      {/* 主会场视野圈（钢蓝——罩全板：主代理看得见） */}
      {vision > 0.01 ? (
        <svg width={w} height={h} style={{position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none'}}>
          <ellipse
            cx={w / 2}
            cy={h / 2}
            rx={w / 2 - 8}
            ry={h / 2 - 8}
            fill="none"
            stroke={theme.steel}
            strokeWidth={4}
            strokeDasharray="16 12"
            opacity={0.75 * clamp01(vision)}
          />
        </svg>
      ) : null}
    </div>
  </div>
);

/** 权限门（4-C——子代理工具通路中段检查点，承 ep3 三闸门形态回扣）。
 *  `cardP` 0..1 命令卡行进（至门前停）；`blocked` 红×；`reject` 拒绝条弹回；
 *  `pass` 下一动作过门（绿边过痕）；`mark` 常驻标记定格（门不随隔离消失）。 */
export const PermissionGate: React.FC<{
  x: number;
  y: number;
  w?: number;
  lit?: number;
  gateLit?: number;
  cardP?: number;
  blocked?: number;
  reject?: number;
  pass?: number;
  mark?: number;
}> = ({x, y, w = 1100, lit = 1, gateLit = 0, cardP = 0, blocked = 0, reject = 0, pass = 0, mark = 0}) => {
  const pathY = 250;
  const gateX = w * 0.56;
  const cardX = 60 + (gateX - 170) * clamp01(cardP);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: 420, opacity: clamp01(lit)}}>
      <svg width={w} height={420} viewBox={`0 0 ${w} 420`} style={{overflow: 'visible'}}>
        {/* 工具通路（子代理 → 执行） */}
        <line x1={30} y1={pathY} x2={w - 30} y2={pathY} stroke={withAlpha(theme.dim, 0.55)} strokeWidth={3} strokeDasharray="10 10" />
        <text x={30} y={pathY - 130} fontFamily={theme.mono} fontSize={15} fill={theme.dim}>
          {'子代理 · 工具通路'}
        </text>
        <text x={w - 30} y={pathY - 130} textAnchor="end" fontFamily={theme.mono} fontSize={15} fill={theme.dim}>
          {'执行'}
        </text>
        {/* 检查点门体（双竖线 + 顶灯——承三闸门形态） */}
        <g opacity={clamp01(gateLit)}>
          <line x1={gateX - 14} y1={pathY - 95} x2={gateX - 14} y2={pathY + 95} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
          <line x1={gateX + 14} y1={pathY - 95} x2={gateX + 14} y2={pathY + 95} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
          <circle cx={gateX} cy={pathY - 112} r={9} fill={blocked > 0.4 ? theme.danger : pass > 0.4 ? theme.ok : theme.dim} opacity={clamp01(gateLit)} />
          <text x={gateX} y={pathY - 130} textAnchor="middle" fontFamily={theme.mono} fontSize={14} fill={theme.dim}>
            {'PreToolUse'}
          </text>
        </g>
        {/* 拦截红×（门上亮起——卡停在门前） */}
        {blocked > 0.05 ? (
          <g opacity={clamp01(blocked)}>
            <line x1={gateX - 22} y1={pathY - 60} x2={gateX + 22} y2={pathY - 16} stroke={theme.danger} strokeWidth={6} strokeLinecap="round" />
            <line x1={gateX + 22} y1={pathY - 60} x2={gateX - 22} y2={pathY - 16} stroke={theme.danger} strokeWidth={6} strokeLinecap="round" />
          </g>
        ) : null}
        {/* 绿边过痕（下一动作顺利过门——同门同位两种裁决） */}
        {pass > 0.05 ? (
          <line
            x1={gateX - 60}
            y1={pathY}
            x2={gateX + 60}
            y2={pathY}
            stroke={theme.ok}
            strokeWidth={7}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - clamp01(pass)}
            opacity={0.85}
          />
        ) : null}
      </svg>
      {/* 命令卡（暗红预览——行至门前被拦：cardP 到 1 即停） */}
      <div style={{position: 'absolute', left: cardX, top: pathY - 25, opacity: cardP > 0.01 ? 1 : 0}}>
        <div
          style={{
            width: 220,
            height: 50,
            boxSizing: 'border-box',
            borderRadius: 9,
            border: `2.5px solid ${theme.danger}`,
            background: withAlpha(theme.danger, 0.12),
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 14px',
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 20, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap'}}>{'删光整盘'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'rm -rf /'}</span>
        </div>
      </div>
      {/* 下一动作卡（读文件——顺利过门） */}
      {pass > 0.05 ? (
        <div style={{position: 'absolute', left: gateX - 230 + 290 * clamp01(pass), top: pathY + 44, opacity: clamp01(pass)}}>
          <div
            style={{
              width: 170,
              height: 44,
              boxSizing: 'border-box',
              borderRadius: 8,
              border: `2.5px solid ${theme.ok}`,
              background: withAlpha(theme.ok, 0.1),
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 12px',
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>{'读文件'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'read'}</span>
          </div>
        </div>
      ) : null}
      {/* 拒绝条（弹回——deny list · Permission denied 只进角标） */}
      {reject > 0.05 ? (
        <div style={{position: 'absolute', left: gateX - 210 - 120 * (1 - clamp01(reject)), top: pathY + 118, opacity: clamp01(reject)}}>
          <div
            style={{
              width: 330,
              height: 46,
              boxSizing: 'border-box',
              borderRadius: 8,
              border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`,
              background: theme.panel,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 14px',
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap'}}>{'拒绝'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim, whiteSpace: 'nowrap'}}>{'deny list · Permission denied'}</span>
          </div>
        </div>
      ) : null}
      {/* 常驻标记（门不随隔离消失——静态陈述配持续态） */}
      {mark > 0.05 ? (
        <div
          style={{
            position: 'absolute',
            left: gateX - 120,
            top: pathY + 168,
            width: 240,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 20,
            fontWeight: 700,
            color: theme.text,
            opacity: clamp01(mark),
          }}
        >
          {'隔离 ≠ 豁免'}
        </div>
      ) : null}
    </div>
  );
};

/** 前缀对齐 + 命中标记 + 冒泡弹窗（4-F——真实版收尾三联件）。
 *  `dots` 0..1 绿点逐格点亮（两列字符格逐位等值——逐格可数）；`hit` 命中
 *  标记落下；`cost` 费用小卡变薄一闪；`popup` 权限弹窗沿气泡轨迹上升回终端。 */
export const PrefixAlign: React.FC<{
  x: number;
  y: number;
  w?: number;
  lit?: number;
  dots?: number;
  hit?: number;
  cost?: number;
  popup?: number;
}> = ({x, y, w = 900, lit = 1, dots = 0, hit = 0, cost = 0, popup = 0}) => {
  const ROWS = 8;
  const cell = 44;
  const glyphL = ['C', 'C', '>', '你', '好', '{', 's', 'y'];
  const glyphR = ['C', 'C', '>', '你', '好', '{', 's', 'y'];
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: 560, opacity: clamp01(lit)}}>
      {/* 两列头（主对话 / 新对话——前缀逐字节一致） */}
      <div style={{display: 'flex', gap: 140, marginBottom: 14}}>
        {[0, 1].map((k) => (
          <span key={k} style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>
            {k === 0 ? '主对话前缀' : '新对话前缀'}
          </span>
        ))}
      </div>
      {/* 字符格两列（绿点逐格点亮——每格一拍、机器节奏） */}
      <div style={{display: 'flex', gap: 60}}>
        {[glyphL, glyphR].map((col, c) => (
          <div key={c} style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            {col.map((g, i) => {
              const on = clamp01(dots * ROWS - i);
              return (
                <div key={i} style={{display: 'flex', alignItems: 'center', gap: 10}}>
                  <div
                    style={{
                      width: cell,
                      height: cell,
                      boxSizing: 'border-box',
                      borderRadius: 8,
                      border: `2px solid ${on > 0.5 ? withAlpha(theme.ok, 0.8) : theme.panelBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: theme.mono,
                      fontSize: 21,
                      color: theme.text,
                      opacity: 0.5 + 0.5 * on,
                    }}
                  >
                    {g}
                  </div>
                  {/* 等值绿点（逐位等值——逐格可数） */}
                  <svg width={22} height={22} viewBox="0 0 22 22" style={{opacity: on}}>
                    <circle cx={11} cy={11} r={7} fill={theme.ok} />
                  </svg>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {/* 命中标记（prompt cache——落下） */}
      {hit > 0.05 ? (
        <div style={{position: 'absolute', left: 460, top: 120 + (1 - clamp01(hit)) * -30, opacity: clamp01(hit)}}>
          <div
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: `2.5px solid ${theme.ok}`,
              background: withAlpha(theme.ok, 0.12),
              fontFamily: theme.mono,
              fontSize: 17,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              boxShadow: `0 0 ${18 * clamp01(hit)}px ${withAlpha(theme.ok, 0.45)}`,
            }}
          >
            {'命中 · prompt cache'}
          </div>
        </div>
      ) : null}
      {/* 费用小卡（变薄一闪——省钱省时的具象，不进口播数字） */}
      {cost > 0.05 ? (
        <div style={{position: 'absolute', left: 470, top: 210, opacity: clamp01(cost) * (1 - 0.3 * clamp01(cost))}}>
          <div
            style={{
              width: 150,
              height: 54 - 22 * clamp01(cost),
              boxSizing: 'border-box',
              borderRadius: 8,
              border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.mono,
              fontSize: 14,
              color: theme.dim,
              whiteSpace: 'nowrap',
            }}
          >
            {'费用'}
          </div>
        </div>
      ) : null}
      {/* 权限弹窗（沿「冒泡」轨迹上升回用户终端——单向向上） */}
      {popup > 0.05 ? (
        <div
          style={{
            position: 'absolute',
            left: 560 + 200 * clamp01(popup),
            top: 470 - 330 * clamp01(popup),
            opacity: clamp01(popup),
          }}
        >
          <div
            style={{
              width: 260,
              height: 84,
              boxSizing: 'border-box',
              borderRadius: 12,
              border: `2.5px solid ${withAlpha(theme.text, 0.85)}`,
              background: theme.panel,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 19, fontWeight: 600, color: theme.text}}>{'权限确认'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'allow / deny'}</span>
          </div>
          {/* 气泡轨迹（虚线向上——冒泡语义） */}
          <svg width={300} height={360} viewBox="0 0 300 360" style={{position: 'absolute', left: -20, top: 96, overflow: 'visible', pointerEvents: 'none', opacity: 0.5 * clamp01(popup)}}>
            <path d="M 150 340 Q 90 250, 150 160 Q 210 80, 150 10" fill="none" stroke={withAlpha(theme.dim, 0.7)} strokeWidth={2.5} strokeDasharray="7 9" />
            <path d="M 143 22 L 150 6 L 158 22" fill="none" stroke={withAlpha(theme.dim, 0.8)} strokeWidth={2.5} strokeLinecap="round" />
          </svg>
        </div>
      ) : null}
      {/* 终端位（弹窗冒回的归属地——用户终端） */}
      <div style={{position: 'absolute', left: 700, top: 60, opacity: 0.35 + 0.65 * clamp01(popup)}}>
        <div
          style={{
            width: 120,
            height: 66,
            boxSizing: 'border-box',
            borderRadius: 9,
            border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 15,
            color: theme.dim,
          }}
        >
          {'终端'}
        </div>
      </div>
      {/* Fork 角标 */}
      <div style={{position: 'absolute', left: 0, top: 470, fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'Fork · 逐字节一致'}</div>
    </div>
  );
};

/** 知识文档堆（5-B 下期钩 + 4-F 压来剪影）。`press` 自画外压入；`grow` 堆高；
 *  `rows` 行数计数读数；`overflow` 堆顶溢出画框上缘一拍；`cost` 堆底费用小卡
 *  变厚。文档堆不进入主会场（没进场语义——调用点负责布局隔离）。 */
export const DocStack: React.FC<{
  x: number;
  y: number;
  w?: number;
  lit?: number;
  press?: number;
  grow?: number;
  rows?: number;
  overflow?: number;
  cost?: number;
}> = ({x, y, w = 620, lit = 1, press = 0, grow = 0, rows = 0, overflow = 0, cost = 0}) => (
  <div
    style={{
      position: 'absolute',
      left: x + 260 * (1 - clamp01(press)),
      top: y,
      width: w,
      opacity: clamp01(lit) * clamp01(press),
    }}
  >
    {/* 文档卡层层叠高（行数读数疯涨） */}
    <div style={{position: 'relative', height: 420 + 200 * clamp01(grow) - 40 * clamp01(overflow)}}>
      {[0, 1, 2, 3].map((i) => {
        const on = clamp01(grow * 4 - i);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: i * 26,
              top: (3 - i) * 66 - 60 * clamp01(overflow) * (i === 3 ? 1 : 0.3 * i),
              width: w - i * 52,
              height: 150,
              boxSizing: 'border-box',
              borderRadius: 10,
              border: `2.5px solid ${withAlpha(theme.dim, 0.55)}`,
              background: withAlpha(theme.panel, 0.92),
              padding: '12px 16px',
              opacity: on,
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
              <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{`docs_${i + 1}.md`}</span>
              <span style={{fontFamily: theme.mono, fontSize: 15, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums'}}>
                {/* ⑨ QA RISKY-1 同类：行数计数去 clamp01（几千行恒渲「1 行」） */}
              {`${Math.round(rows)} 行`}
              </span>
            </div>
            {[0, 1, 2, 3].map((k) => (
              <div key={k} style={{height: 9, width: `${88 - k * 14}%`, borderRadius: 4, background: withAlpha(theme.dim, 0.28), marginTop: 10}} />
            ))}
          </div>
        );
      })}
    </div>
    {/* 堆底费用小卡（养不起——同步变厚） */}
    <div style={{position: 'relative', height: 30 + 34 * clamp01(cost), marginTop: 10}}>
      <div
        style={{
          width: w - 78,
          height: 30 + 34 * clamp01(cost),
          boxSizing: 'border-box',
          borderRadius: 8,
          border: `2.5px solid ${withAlpha(theme.dim, 0.7)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.mono,
          fontSize: 15,
          color: theme.dim,
        }}
      >
        {'费用 · 全前置'}
      </div>
    </div>
  </div>
);
