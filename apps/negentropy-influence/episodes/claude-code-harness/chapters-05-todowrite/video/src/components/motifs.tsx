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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2/ep3/ep4 延续——
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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep4 逐字节
 * 拷贝（ep5 场景一律 `nodes={[]}`：环体即循环本体，「调用前」挂点由 RingPoint
 * 另钉——注入时点 = 下一轮调用前，挂点色与计数器同源提醒紫）。
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

/** 环上坐标（-90 = 12 点；r 与 LoopRing 内圈同式 = size/2 - 46）——「调用前」
 *  挂点钉位/弧段连线的场景侧共用工式 */
export const ringPt = polar;

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep5 TodoWrite）
// storyboard 实现映射登记：TodoListCard / TodoLegend / NagCounter /
// VisibilityWindow / MsgBar / TurnStrip / TaskSteps / TAxis / RingPoint /
// DispatchTableMini / GrowthRuler / AblationLane / StatBar / ThresholdRow /
// DriftLoop / DebateScale / ContextPool / BrainGlyph / FocusRing。
// 全片主装置 = 待办清单卡 + 计数器两半（对照 ep2 对照表 / ep4 注册表之地位）：
// 规划蓝卡 + 三态行 + 提醒紫四格刻度盘，缩微前后不重绘（scale 整体变换）。
// 哑装置原则承 ep3/ep4：动效参数（进度/状态/读数）一律经 prop 由调用场景注入，
// 本段零 motion hooks——「怎么动」归场景，「画什么」归此处。
//
// 跨集签名色只读登记（G1 对抗核验同 ep4 形态；色值跨集回溯、语义不歧义，
// 模块常量防漂移、不进 theme.ts——同 3D 面色常量先例，不占本集 accents 槽）：
// - 琥珀 #EFB13C = ep2 对照表 mech 原值：1-C 工程账「工具对照表增行」的双列
//   表签名本体（跨集视觉记忆——承前集工程账句式的同构裁决）。
const AMBER_TABLE = '#EFB13C';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 三步任务签集（0-A 任务卡 / 2-A 建单 / 全片清单行——同款同文跨幕恒定；
 *  关键词签不显句，英文只进角标） */
export const TASK_ROWS = [
  {zh: '改命名', en: 'rename'},
  {zh: '跑测试', en: 'test'},
  {zh: '写报告', en: 'report'},
] as const;

/** 清单行三态（1-B 图例立锚、全片同款同色：空心=待办 / 高亮实心=进行中 /
 *  打勾=完成；empty = 建单前的空行骨架） */
export type TodoState = 'empty' | 'todo' | 'active' | 'done';

/** 三态圆点（行状态与 1-B 图例一一对应——TodoListCard / TodoLegend 共用本体） */
const TodoDot: React.FC<{state: TodoState; lit?: number; size?: number}> = ({state, lit = 1, size = 26}) => {
  const s = clamp01(lit);
  const R = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{flexShrink: 0, opacity: 0.35 + 0.65 * s}}>
      {state === 'todo' ? (
        <circle cx={R} cy={R} r={R - 3} fill="none" stroke={theme.dim} strokeWidth={2.5} />
      ) : null}
      {state === 'active' ? (
        <>
          <circle cx={R} cy={R} r={R - 3} fill={theme.mech} stroke={theme.mech} strokeWidth={2} />
          <circle cx={R} cy={R} r={R + 3} fill="none" stroke={withAlpha(theme.mech, 0.5)} strokeWidth={2} />
        </>
      ) : null}
      {state === 'done' ? (
        <path
          d={`M ${R - 7} ${R} L ${R - 2} ${R + 6} L ${R + 8} ${R - 6}`}
          fill="none"
          stroke={theme.ok}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {state === 'empty' ? (
        <circle cx={R} cy={R} r={R - 3} fill="none" stroke={withAlpha(theme.panelBorder, 1)} strokeWidth={2} strokeDasharray="4 4" />
      ) : null}
    </svg>
  );
};

/** 待办清单卡（全片主装置·前一半——规划蓝）。三态行状态机全走 prop：
 *  `rowStates` 每行三态；`rowLit` 每行显形（建单逐行成文）；`glow` 0..1 整卡
 *  辉光（1-C「规划能力」重音）；`squeeze` 0..1 挤出渐暗（2-B 吸收窗口——渐暗
 *  非删除）；`sink` 0..1 沉入内存槽位移（1-B 归属地移交，由场景配槽）；缩微走
 *  外层 scale（不重绘）。空行骨架 = 建单前的虚线空行（1-B/2-A）。 */
export const TodoListCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  rowStates?: readonly TodoState[];
  rowLit?: readonly number[];
  lit?: number;
  glow?: number;
  squeeze?: number;
  sink?: number;
  dim?: number;
  scale?: number;
  showTag?: number;
}> = ({
  x,
  y,
  w = 430,
  rowStates = ['empty', 'empty', 'empty'],
  rowLit = [1, 1, 1],
  lit = 1,
  glow = 0,
  squeeze = 0,
  sink = 0,
  dim = 0,
  scale = 1,
  showTag = 1,
}) => {
  const RH = 64;
  const H = 62 + 3 * RH + 2 * 10 + 14;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + 46 * clamp01(sink),
        width: w,
        height: H,
        opacity: clamp01(lit) * (1 - 0.62 * clamp01(squeeze)) * (1 - dim),
        transform: `scale(${scale})`,
        transformOrigin: 'left top',
        filter: `saturate(${1 - 0.5 * clamp01(squeeze)})`,
      }}
    >
      <Panel
        accent={theme.mech}
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          padding: 14,
          position: 'relative',
          boxShadow: glow > 0.01 ? `0 0 ${30 * clamp01(glow)}px ${withAlpha(theme.mech, 0.55)}` : 'none',
        }}
      >
        {/* 表头：todo_write 只进角标（口播恒称「待办清单工具」） */}
        <div style={{display: 'flex', alignItems: 'baseline', gap: 12, height: 34, opacity: clamp01(showTag)}}>
          <span style={{fontFamily: theme.mono, fontSize: 20, fontWeight: 700, color: theme.mech, letterSpacing: 1}}>{'todo_write'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'待办清单'}</span>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12}}>
          {TASK_ROWS.slice(0, rowStates.length).map((r, i) => {
            const st = rowStates[i] ?? 'empty';
            const rl = clamp01(rowLit[i] ?? 1);
            return (
              <div
                key={r.en}
                style={{
                  height: RH,
                  boxSizing: 'border-box',
                  borderRadius: 9,
                  border: st === 'active' ? `2.5px solid ${theme.mech}` : `2px solid ${withAlpha(theme.panelBorder, 0.8)}`,
                  background: st === 'active' ? withAlpha(theme.mech, 0.14) : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '0 18px',
                  opacity: 0.35 + 0.65 * rl,
                }}
              >
                <TodoDot state={st} lit={rl} />
                <span
                  style={{
                    fontFamily: theme.sans,
                    fontSize: 26,
                    fontWeight: 600,
                    color: rl > 0.5 ? theme.text : theme.dim,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.zh}
                </span>
                <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, opacity: rl}}>{r.en}</span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
};

/** 三态图例（1-B 建锚——侧边三样点；样式与 TodoListCard 行状态一一同款同色）。
 *  `dots` = [待办, 进行中, 完成] 各自点火进度 0..1。 */
export const TodoLegend: React.FC<{x: number; y: number; dots?: readonly number[]; dim?: number}> = ({
  x,
  y,
  dots = [0, 0, 0],
  dim = 0,
}) => {
  const items: {state: TodoState; zh: string}[] = [
    {state: 'todo', zh: '待办'},
    {state: 'active', zh: '进行中'},
    {state: 'done', zh: '完成'},
  ];
  return (
    <div style={{position: 'absolute', left: x, top: y, display: 'flex', flexDirection: 'column', gap: 18, opacity: 1 - dim}}>
      {items.map((it, i) => {
        const p = clamp01(dots[i] ?? 0);
        return (
          <div key={it.zh} style={{display: 'flex', alignItems: 'center', gap: 14, opacity: 0.4 + 0.6 * p}}>
            <TodoDot state={it.state} lit={p} size={30} />
            <span style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 600, color: p > 0.5 ? theme.text : theme.dim}}>
              {it.zh}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** 提醒计数器（全片主装置·后一半——提醒紫四格刻度盘 0–3）。读数/脉冲全走 prop：
 *  `count` 0..3 实数（逐格点亮，读数 = 四舍五入）；`pulse` 0..1 数到 3 的注入
 *  脉冲（外圈爆发 + 盘体闪亮）；`resetFlash` 0..1 清零回弹一拍；`watch` 0..1
 *  感测位清单微缩影显形（专盯清单——盯着对象在场）；缩微走外层 scale（不重绘）。 */
export const NagCounter: React.FC<{
  x: number;
  y: number;
  w?: number;
  count?: number;
  pulse?: number;
  resetFlash?: number;
  watch?: number;
  lit?: number;
  dim?: number;
  scale?: number;
}> = ({x, y, w = 330, count = 0, pulse = 0, resetFlash = 0, watch = 0, lit = 1, dim = 0, scale = 1}) => {
  const c = Math.max(0, Math.min(3, count));
  const CELL = (w - 76 - 3 * 10) / 4;
  const shown = Math.round(c); // 读数取整（步进语义——逐格、无小数读数）
  return (
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
      <Panel
        accent={theme.nag}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '12px 14px 14px',
          position: 'relative',
          boxShadow: pulse > 0.01 ? `0 0 ${34 * clamp01(pulse)}px ${withAlpha(theme.nag, 0.6)}` : 'none',
        }}
      >
        {/* 表头：机制名只进角标 */}
        <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', height: 30}}>
          <span style={{fontFamily: theme.mono, fontSize: 17, fontWeight: 700, color: theme.nag, letterSpacing: 1}}>
            {'rounds_since_todo'}
          </span>
          {/* 读数位（步进取整；清零回弹一拍闪白） */}
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 30,
              fontWeight: 700,
              color: theme.text,
              fontVariantNumeric: 'tabular-nums',
              textShadow: resetFlash > 0.01 ? `0 0 ${14 * clamp01(resetFlash)}px ${withAlpha(theme.text, 0.8)}` : 'none',
            }}
          >
            {String(shown)}
          </span>
        </div>
        {/* 四格刻度（0–3 恒四格；数到三即注入即清零——永不越 3） */}
        <div style={{display: 'flex', gap: 10, marginTop: 8}}>
          {[0, 1, 2, 3].map((i) => {
            const on = clamp01(c - i);
            const num = i + 1;
            return (
              <div
                key={i}
                style={{
                  width: CELL,
                  height: 46,
                  boxSizing: 'border-box',
                  borderRadius: 7,
                  border: `2.5px solid ${on > 0.5 ? theme.nag : theme.panelBorder}`,
                  background: on > 0.5 ? withAlpha(theme.nag, 0.16 + 0.2 * clamp01(pulse)) : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.45 + 0.55 * on,
                }}
              >
                <span
                  style={{
                    fontFamily: theme.mono,
                    fontSize: 18,
                    color: on > 0.5 ? theme.nag : theme.dim,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {num}
                </span>
              </div>
            );
          })}
        </div>
        {/* 感测位（专盯清单——清单卡微缩影；1-B 同款缩微） */}
        <div style={{position: 'absolute', right: 14, top: -34, opacity: clamp01(watch)}}>
          <div
            style={{
              width: 64,
              height: 40,
              boxSizing: 'border-box',
              borderRadius: 6,
              border: `2px solid ${withAlpha(theme.mech, 0.85)}`,
              background: withAlpha(theme.mech, 0.1),
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 3,
              padding: '0 8px',
            }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i} style={{height: 3, borderRadius: 2, background: withAlpha(theme.mech, 0.55 - i * 0.12)}} />
            ))}
          </div>
        </div>
        {/* 注入脉冲爆发环（数到 3——外圈半径波一拍） */}
        {pulse > 0.01 ? (
          <svg
            width={w}
            height={140}
            viewBox={`0 0 ${w} 140`}
            style={{position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none'}}
          >
            <rect
              x={2}
              y={2}
              width={w - 4}
              height={136}
              rx={14}
              fill="none"
              stroke={theme.nag}
              strokeWidth={3}
              opacity={0.7 * clamp01(pulse)}
              style={{transform: `scale(${1 + 0.08 * clamp01(pulse)})`, transformOrigin: 'center'}}
            />
          </svg>
        ) : null}
      </Panel>
    </div>
  );
};

/** 可见区视窗（本集术语锚装置——中性灰白框线，非契约主色）。`lit` 0..1 窗落下
 *  （窗内亮带显形 + 窗外上下暗罩压上）；`labelLit` 0..1 窗沿「可见区」签；
 *  `bandRatio` 亮带高占比（缺省尾段 ~0.34）；children 由场景放入（消息列——
 *  暗罩 z 序盖过子内容，窗形/照亮方向全片逐镜一致：尾段亮、窗外灰）。 */
export const VisibilityWindow: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  lit?: number;
  labelLit?: number;
  bandRatio?: number;
  children?: React.ReactNode;
}> = ({x, y, w, h, lit = 1, labelLit = 0, bandRatio = 0.34, children}) => {
  const p = clamp01(lit);
  const bandH = h * bandRatio;
  const bandY = y + h - bandH;
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {children}
      {/* 窗外暗罩（上段——一刀切灰化；随窗落下压上） */}
      <div
        style={{
          position: 'absolute',
          left: x - 14,
          top: y - 14,
          width: w + 28,
          height: bandY - y + 14,
          background: theme.bg,
          opacity: 0.74 * p,
        }}
      />
      {/* 窗框（中性灰白——术语锚装置恒中性线，亮带沿窗底尾段） */}
      <div
        style={{
          position: 'absolute',
          left: x,
          top: bandY,
          width: w,
          height: bandH,
          boxSizing: 'border-box',
          borderTop: `3px solid ${withAlpha(theme.text, 0.85 * p)}`,
          borderBottom: `3px solid ${withAlpha(theme.text, 0.85 * p)}`,
          background: withAlpha(theme.text, 0.045 * p),
          opacity: p,
        }}
      />
      {/* 窗沿「可见区」签（本集术语锚首立） */}
      {labelLit > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: x + w + 18,
            top: bandY - 4,
            fontFamily: theme.sans,
            fontSize: 24,
            fontWeight: 700,
            color: theme.text,
            opacity: clamp01(labelLit),
            whiteSpace: 'nowrap',
          }}
        >
          {'可见区'}
          <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginLeft: 10}}>{'context'}</span>
        </div>
      ) : null}
    </div>
  );
};

/** 通用消息条（对话流条目）。`color` 缺省中性 dim（用户/杂项）；tool 青碧 =
 *  工具结果回喂（承系列语义）；nag 紫 = 提醒条（ReminderStrip 形态）；`sub`
 *  只进角标（reminder 等英文原文防与口播逐字重合）；`ghost` 0..1 灰化（挤出
 *  窗外变灰——渐暗非删除）。 */
export const MsgBar: React.FC<{
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
}> = ({x, y, w = 520, h = 52, label, sub, color, lit = 1, ghost = 0, flash = 0}) => {
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
        borderRadius: 9,
        border: `2.5px solid ${g > 0.5 ? withAlpha(theme.panelBorder, 0.9) : c}`,
        background: g > 0.5 ? 'transparent' : withAlpha(c, 0.1 + 0.14 * clamp01(flash)),
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        opacity: clamp01(lit) * (1 - 0.45 * g),
        filter: `saturate(${1 - 0.55 * g})`,
      }}
    >
      <span
        style={{
          fontFamily: theme.sans,
          fontSize: 22,
          fontWeight: 600,
          color: g > 0.5 ? theme.dim : theme.text,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {sub ? (
        <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, whiteSpace: 'nowrap'}}>{sub}</span>
      ) : null}
    </div>
  );
};


/** 轮次带（3-A 消融轨/走查通用——n 格同 fill 同拍推进；`rounds` 0..n 实数）。
 *  `exhausted` 0..1 轮数耗尽锁止（警示红整框——预算格跑满截停）。 */
export const TurnStrip: React.FC<{
  x: number;
  y: number;
  w?: number;
  n?: number;
  rounds?: number;
  accent?: string;
  exhausted?: number;
  lit?: number;
}> = ({x, y, w = 640, n = 11, rounds = 0, accent, exhausted = 0, lit = 1}) => {
  const a = accent ?? theme.dim;
  const cellW = (w - (n - 1) * 6) / n;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: clamp01(lit)}}>
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: 6,
          boxSizing: 'border-box',
          borderRadius: 10,
          border: exhausted > 0.4 ? `2.5px solid ${theme.danger}` : '2.5px solid transparent',
          boxShadow: exhausted > 0.4 ? `0 0 ${18 * clamp01(exhausted)}px ${withAlpha(theme.danger, 0.4)}` : 'none',
        }}
      >
        {Array.from({length: n}, (_, i) => {
          const on = clamp01(rounds * n - i);
          return (
            <div
              key={i}
              style={{
                width: cellW,
                height: 30,
                borderRadius: 5,
                border: `2px solid ${on > 0.5 ? a : theme.panelBorder}`,
                background: on > 0.5 ? withAlpha(a, 0.2) : 'transparent',
                opacity: 0.5 + 0.5 * on,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

/** 三格任务步进带（3-A/3-C——A-30 任务带为存活承接主体）。`states` 三格态；
 *  `grayFlash` 0..1 第三格空置灰闪（「只剩两步」）；三勾在「任务完成」词前
 *  不预亮（时序由场景钉）。 */
export const TaskSteps: React.FC<{
  x: number;
  y: number;
  w?: number;
  states?: readonly (TodoState | 'crossed')[];
  lit?: number;
  grayFlash?: number;
  accent?: string;
}> = ({x, y, w = 210, states = ['todo', 'todo', 'todo'], lit = 1, grayFlash = 0, accent}) => {
  const cellW = (w - 2 * 8) / 3;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: clamp01(lit), display: 'flex', gap: 8}}>
      {states.map((st, i) => {
        const flash = i === 2 ? clamp01(grayFlash) : 0;
        const done = st === 'done';
        const active = st === 'active';
        const a = accent ?? theme.ok;
        return (
          <div
            key={i}
            style={{
              width: cellW,
              height: 40,
              boxSizing: 'border-box',
              borderRadius: 7,
              border: `2.5px solid ${done ? a : active ? theme.mech : flash > 0.3 ? withAlpha(theme.danger, 0.7) : theme.panelBorder}`,
              background: done ? withAlpha(a, 0.14) : active ? withAlpha(theme.mech, 0.12) : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: done || active ? 1 : 0.55 + 0.2 * Math.sin(Math.PI * flash),
            }}
          >
            {done ? (
              <svg width={22} height={22} viewBox="0 0 22 22">
                <path d="M 4 11 L 9 16 L 18 5" fill="none" stroke={a} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : active ? (
              <span style={{fontFamily: theme.sans, fontSize: 14, fontWeight: 700, color: theme.mech}}>{'进行中'}</span>
            ) : flash > 0.3 ? (
              <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.danger}}>{'—'}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

/** t 刻度轴游标（2-A 走查舞台底部——t1..t11 细刻度 + 当前轮游标，全程可追；
 *  刻度不逐格标字（抢字幕），仅端点标 t1/t11）。`cursor` 0..n-1 实数（t1 = 0）。 */
export const TAxis: React.FC<{x: number; y: number; w?: number; n?: number; cursor?: number; lit?: number}> = ({
  x,
  y,
  w = 760,
  n = 11,
  cursor = 0,
  lit = 1,
}) => {
  const cur = Math.max(0, Math.min(n - 1, cursor));
  const cx = x + (w * cur) / (n - 1);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: clamp01(lit)}}>
      <svg width={w} height={34} viewBox={`0 0 ${w} 34`} style={{overflow: 'visible'}}>
        <line x1={0} y1={12} x2={w} y2={12} stroke={withAlpha(theme.dim, 0.55)} strokeWidth={2} />
        {Array.from({length: n}, (_, i) => {
          const tx = (w * i) / (n - 1);
          return <line key={i} x1={tx} y1={7} x2={tx} y2={17} stroke={withAlpha(theme.dim, 0.55)} strokeWidth={2} />;
        })}
        {/* 游标（当前轮——帧驱动推进全程可追） */}
        <g transform={`translate(${cx} 0)`}>
          <line x1={0} y1={2} x2={0} y2={22} stroke={theme.text} strokeWidth={3.5} strokeLinecap="round" />
          <circle cx={0} cy={2} r={5} fill={theme.text} />
        </g>
      </svg>
      <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 2}}>
        <span>{'t1'}</span>
        <span>{'t11'}</span>
      </div>
    </div>
  );
};

/** 环上「调用前」挂点（nag 紫点——注入时点 = 下一轮调用前，挂点色与计数器
 *  同源提醒紫；ep4 HookPoint 的本集语义变体）。`lit` 0..1 钉位点亮（首现
 *  微光 = 0.45 恒驻暗态）；`pulse` 0..1 注入闪亮（2-C 本集两大 punch 之一）。 */
export const RingPoint: React.FC<{cx: number; cy: number; r?: number; lit?: number; pulse?: number; dim?: number}> = ({
  cx,
  cy,
  r = 13,
  lit = 1,
  pulse = 0,
  dim = 0,
}) => (
  <svg
    width={80}
    height={80}
    viewBox="-40 -40 80 80"
    style={{position: 'absolute', left: cx - 40, top: cy - 40, overflow: 'visible', opacity: 1 - dim, pointerEvents: 'none'}}
  >
    {/* 钉位外圈（点亮描边收拢；恒驻微光 = 0.45 底） */}
    <circle r={r + 5} fill="none" stroke={theme.nag} strokeWidth={3} opacity={0.45 + 0.55 * clamp01(lit)} />
    {/* 本体紫点 */}
    <circle r={r * (0.6 + 0.4 * clamp01(lit))} fill={theme.nag} opacity={0.45 + 0.55 * clamp01(lit)} />
    {/* 注入闪亮（半径波一拍——挂点闪亮为证：注入恒在下轮调用前） */}
    {pulse > 0.01 ? <circle r={r + 6 + 30 * clamp01(pulse)} fill="none" stroke={theme.nag} strokeWidth={3.5} opacity={0.65 * clamp01(pulse)} /> : null}
  </svg>
);

/** 对照表（1-C 工程账——ep2 琥珀双列签名同构：5 行末态承前集行序 + 新行 6
 *  「待办工具↔待办处理器」滑入）。`newIn` 0..1 新行滑入；`fuseAt` 归场景的
 *  接点闪合 impulse 值（0..1）；`counterLit` 表头计数角标（TOOLS · 6）显形。
 *  行序 = ep2 TABLE_ROWS 原序（跨集恒定不重排）。 */
const TABLE_ROWS_E2 = [
  {zh: '跑命令', en: 'bash', part: 'bash 处理器'},
  {zh: '读文件', en: 'read_file', part: '读处理器'},
  {zh: '写文件', en: 'write_file', part: '写处理器'},
  {zh: '改文件', en: 'edit_file', part: '改处理器'},
  {zh: '找文件', en: 'glob', part: '找处理器'},
] as const;

export const DispatchTableMini: React.FC<{
  x: number;
  y: number;
  w?: number;
  scale?: number;
  newIn?: number;
  fuse?: number;
  counterLit?: number;
  dim?: number;
}> = ({x, y, w = 560, scale = 1, newIn = 0, fuse = 0, counterLit = 0, dim = 0}) => {
  const HEAD = 54;
  const RH = 56;
  const GAP = 9;
  const rows = [...TABLE_ROWS_E2, {zh: '记待办', en: 'todo_write', part: '待办处理器'}];
  const H = HEAD + 6 * RH + 5 * GAP + 16;
  const ni = clamp01(newIn);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: H,
        opacity: 1 - dim,
        transform: `scale(${scale})`,
        transformOrigin: 'left top',
      }}
    >
      <Panel accent={AMBER_TABLE} style={{width: '100%', height: '100%', boxSizing: 'border-box', padding: 0, position: 'relative'}}>
        {/* 表头：双列名（承 ep2 同构）+ 计数角标 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: HEAD,
            padding: '0 22px',
            borderBottom: `2px solid ${withAlpha(AMBER_TABLE, 0.4)}`,
          }}
        >
          <span style={{width: 300, fontFamily: theme.sans, fontSize: 25, fontWeight: 700, color: theme.text}}>{'工具'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 700, color: theme.text}}>{'处理器'}</span>
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: theme.mono,
              fontSize: 15,
              color: theme.text,
              border: `2px solid ${withAlpha(AMBER_TABLE, 0.5)}`,
              borderRadius: 7,
              padding: '2px 10px',
              opacity: clamp01(counterLit),
              whiteSpace: 'nowrap',
            }}
          >
            {'TOOLS · 5→6'}
          </span>
        </div>
        {/* 行（前 5 行恒亮在位；新行 6 滑入 + 接点闪合） */}
        <div style={{padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: GAP}}>
          {rows.map((r, i) => {
            const isNew = i === 5;
            const op = isNew ? ni : 1;
            const dx = isNew ? (1 - ni) * 60 : 0;
            return (
              <div
                key={r.en}
                style={{
                  height: RH,
                  borderRadius: 8,
                  border: isNew ? `2px dashed ${op > 0.5 ? 'transparent' : theme.panelBorder}` : '2px dashed transparent',
                  opacity: isNew ? 0.5 + 0.5 * op : 1,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 10px',
                    borderRadius: 8,
                    background: isNew ? withAlpha(AMBER_TABLE, 0.08 + 0.12 * clamp01(fuse)) : 'transparent',
                    opacity: op,
                    transform: `translateX(${dx}px)`,
                    boxShadow: isNew && fuse > 0.01 ? `0 0 ${18 * clamp01(fuse)}px ${withAlpha(AMBER_TABLE, 0.5)}` : 'none',
                  }}
                >
                  <span style={{width: 268, display: 'flex', alignItems: 'baseline', gap: 12}}>
                    <span style={{fontFamily: theme.sans, fontSize: 25, fontWeight: 600, color: theme.text}}>{r.zh}</span>
                    <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{r.en}</span>
                  </span>
                  <span style={{fontFamily: theme.sans, fontSize: 23, color: isNew ? theme.text : theme.dim}}>{r.part}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
};

/** 工具数 5→6 增长条标尺（1-C 底部——基线标尺恒常驻：前 5 格恒亮、第 6 格
 *  随新行同步点亮；读数随格子落地同步递增）。`six` 0..1 第 6 格点亮。 */
export const GrowthRuler: React.FC<{x: number; y: number; w?: number; six?: number; lit?: number}> = ({
  x,
  y,
  w = 560,
  six = 0,
  lit = 1,
}) => {
  const s = clamp01(six);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: clamp01(lit)}}>
      <div style={{display: 'flex', gap: 7}}>
        {Array.from({length: 6}, (_, i) => {
          const on = i < 5 ? 1 : s;
          return (
            <div
              key={i}
              style={{
                width: (w - 5 * 7) / 6,
                height: 40,
                borderRadius: 6,
                border: `2.5px solid ${on > 0.5 ? AMBER_TABLE : theme.panelBorder}`,
                background: on > 0.5 ? withAlpha(AMBER_TABLE, 0.16) : 'transparent',
                opacity: 0.5 + 0.5 * on,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.mono,
                fontSize: 15,
                color: on > 0.5 ? theme.text : theme.dim,
              }}
            >
              {i + 1}
            </div>
          );
        })}
      </div>
      {/* 读数行 + 基线标签（基线恒常驻——5 为基线值） */}
      <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 8}}>
        <span style={{fontFamily: theme.mono, fontSize: 26, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums'}}>
          {`工具数 ${5 + Math.round(s)}`}
        </span>
        <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{'基线 5 · ep2 口径'}</span>
      </div>
    </div>
  );
};

/** 消融单轨（3-A 左绿右红双例并置——本集镜像构图：左=提醒在位 ok、右=拆掉
 *  danger；两轨轮次带同款格位、任务带/计数位逐项对照）。读数全走 prop：
 *  `rounds` 0..11；`exhausted` 锁止；`task` 三格态；`taskFlash` 第三格灰闪；
 *  `nag` 提醒次数；`drift` 漂移次数；`finish` 0..1 收尾位（绿勾）/ `cross`
 *  0..1 红叉。工况角标 `cond`（episode A / experiment 1）。 */
export const AblationLane: React.FC<{
  x: number;
  y: number;
  w?: number;
  tag: string;
  cond: string;
  accent: string;
  lit?: number;
  rounds?: number;
  exhausted?: number;
  task?: readonly TodoState[];
  taskFlash?: number;
  nag?: number;
  nagFlash?: number;
  drift?: number;
  driftAt?: boolean;
  finish?: number;
  cross?: number;
  dim?: number;
}> = ({
  x,
  y,
  w = 800,
  tag,
  cond,
  accent,
  lit = 0,
  rounds = 0,
  exhausted = 0,
  task = ['todo', 'todo', 'todo'],
  taskFlash = 0,
  nag = 0,
  nagFlash = 0,
  drift = 0,
  driftAt = false,
  finish = 0,
  cross = 0,
  dim = 0,
}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, opacity: (0.35 + 0.65 * clamp01(lit)) * (1 - dim)}}>
    <Panel accent={accent} style={{width: '100%', boxSizing: 'border-box', padding: '14px 18px'}}>
      {/* 头行：轨名 + 工况角标 */}
      <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
        <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: accent}}>{tag}</span>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 14,
            color: theme.dim,
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 6,
            padding: '1px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          {cond}
        </span>
      </div>
      {/* 轮次带（11 格——两轨同款格位同拍演化） */}
      <TurnStrip x={0} y={0} w={w - 36} n={11} rounds={rounds} accent={accent} exhausted={exhausted} lit={1} />
      {/* 任务步进带 + 三计数位（提醒/漂移/收尾——四指标逐项对照） */}
      <div style={{display: 'flex', alignItems: 'center', gap: 22, marginTop: 14}}>
        <TaskSteps x={0} y={0} w={190} states={task} lit={1} grayFlash={taskFlash} accent={accent} />
        <div style={{display: 'flex', gap: 20, alignItems: 'center'}}>
          {/* 提醒计数位（紫色注入位——在场一轨闪现） */}
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3}}>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'提醒'}</span>
            <div
              style={{
                width: 58,
                height: 40,
                borderRadius: 7,
                border: `2.5px solid ${nag > 0 ? theme.nag : theme.panelBorder}`,
                background: withAlpha(theme.nag, 0.08 + 0.2 * clamp01(nagFlash)),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: nagFlash > 0.01 ? `0 0 ${14 * clamp01(nagFlash)}px ${withAlpha(theme.nag, 0.55)}` : 'none',
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 20, fontWeight: 700, color: nag > 0 ? theme.nag : theme.dim}}>
                {String(nag)}
              </span>
            </div>
          </div>
          {/* 漂移计数位（归因前恒 0——画面先给数、口播下句归因） */}
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3}}>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'漂移'}</span>
            <div
              style={{
                width: 58,
                height: 40,
                borderRadius: 7,
                border: `2.5px solid ${drift > 0 ? theme.danger : theme.panelBorder}`,
                background: withAlpha(theme.danger, 0.08),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 20, fontWeight: 700, color: drift > 0 ? theme.danger : theme.dim}}>
                {String(drift)}
              </span>
            </div>
          </div>
          {/* 收尾状态位（绿勾 / 红叉） */}
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3}}>
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{'收尾'}</span>
            <div
              style={{
                width: 58,
                height: 40,
                borderRadius: 7,
                border: `2.5px solid ${cross > 0.4 ? theme.danger : finish > 0.4 ? theme.ok : theme.panelBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {cross > 0.4 ? (
                <svg width={24} height={24} viewBox="0 0 24 24">
                  <line x1={6} y1={6} x2={18} y2={18} stroke={theme.danger} strokeWidth={3.5} strokeLinecap="round" />
                  <line x1={18} y1={6} x2={6} y2={18} stroke={theme.danger} strokeWidth={3.5} strokeLinecap="round" />
                </svg>
              ) : finish > 0.4 ? (
                <svg width={24} height={24} viewBox="0 0 24 24">
                  <path d="M 5 12 L 10 17 L 19 6" fill="none" stroke={theme.ok} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>{'—'}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  </div>
);

/** 四指标数字动态条（3-A 底部基线锚——两条各五格数字位，左绿右红逐项同款
 *  对齐定格；数字与口播/实验记录逐项一致，条带基线刻度恒常驻）。 */
export const StatBar: React.FC<{
  x: number;
  y: number;
  w?: number;
  lit?: number;
  /** 五格：[轮次, 步数, 提醒, 漂移, 收尾] */
  cells: readonly string[];
  accent: string;
  dim?: number;
}> = ({x, y, w = 800, lit = 0, cells, accent, dim = 0}) => {
  const LABELS = ['轮次', '步数', '提醒', '漂移', '收尾'];
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: clamp01(lit) * (1 - dim)}}>
      <div style={{display: 'flex', gap: 8}}>
        {cells.map((c, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 62,
              boxSizing: 'border-box',
              borderRadius: 8,
              border: `2px solid ${withAlpha(accent, 0.55)}`,
              background: withAlpha(accent, 0.07),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>{LABELS[i]}</span>
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 23,
                fontWeight: 700,
                color: theme.text,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {c}
            </span>
          </div>
        ))}
      </div>
      {/* 基线刻度（恒常驻） */}
      <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: theme.mono, fontSize: 13, color: theme.dim}}>
        <span>{'四指标对照 · 基线刻度'}</span>
        <span>{'episode A / experiment 1'}</span>
      </div>
    </div>
  );
};

/** 阈值单档条（3-C 三档并列——三档同宽横列，默认 3 居中为基线标尺位）。
 *  `mode`：'base'（默认 3——基线位恒中、对照锚）/ 'chatty'（阈值 1：提醒 6·
 *  消息 23→28·任务照常完成）/ 'dead'（阈值 999：提醒 0·逐项翻红=同拆掉）。
 *  `nag` 提醒次数；`msg` 消息数（23 基线）；`taskDone` 任务带三勾；`redLit`
 *  0..1 dead 档逐项翻红。工况角标 nag_threshold=N。 */
export const ThresholdRow: React.FC<{
  x: number;
  y: number;
  w?: number;
  mode: 'base' | 'chatty' | 'dead';
  lit?: number;
  nag?: number;
  nagFlash?: number;
  msg?: number;
  taskDone?: number;
  redLit?: number;
}> = ({x, y, w = 560, mode, lit = 0, nag = 0, nagFlash = 0, msg = 23, taskDone = 0, redLit = 0}) => {
  const isBase = mode === 'base';
  const isDead = mode === 'dead';
  const red = clamp01(redLit);
  // dead 档逐项翻红：提醒 0·消息同基线 23·步 2/3·漂移 7·没收尾（同 3-A 右轨）
  const cells: {label: string; val: string; hot: boolean}[] = isBase
    ? [
        {label: '提醒', val: '1', hot: false},
        {label: '消息', val: '23', hot: false},
        {label: '步数', val: '3/3', hot: false},
        {label: '漂移', val: '0', hot: false},
      ]
    : mode === 'chatty'
      ? [
          {label: '提醒', val: String(nag), hot: true},
          {label: '消息', val: String(msg), hot: false},
          {label: '步数', val: '3/3', hot: false},
          {label: '漂移', val: '0', hot: false},
        ]
      : [
          {label: '提醒', val: '0', hot: false},
          {label: '消息', val: '23', hot: false},
          {label: '步数', val: '2/3', hot: true},
          {label: '漂移', val: '7', hot: true},
        ];
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: (0.35 + 0.65 * clamp01(lit)) * (1 - 0.15 * red)}}>
      <Panel accent={isBase ? theme.dim : isDead ? theme.danger : theme.nag} style={{width: '100%', boxSizing: 'border-box', padding: '12px 16px'}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
          <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: isDead && red > 0.4 ? theme.danger : theme.text}}>
            {isBase ? '默认 3' : mode === 'chatty' ? '阈值 1' : '阈值 999'}
          </span>
          {isBase ? (
            <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, border: `2px solid ${theme.panelBorder}`, borderRadius: 6, padding: '1px 8px'}}>
              {'基线标尺位'}
            </span>
          ) : null}
          <span style={{fontFamily: theme.mono, fontSize: 13, color: theme.dim, marginLeft: 'auto', whiteSpace: 'nowrap'}}>
            {`nag_threshold=${isBase ? 3 : mode === 'chatty' ? 1 : 999}`}
          </span>
        </div>
        {/* 四指标位 + 任务带缩微（同款对齐） */}
        <div style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 10}}>
          {cells.map((c) => (
            <div key={c.label} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 64}}>
              <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{c.label}</span>
              <span
                style={{
                  fontFamily: theme.mono,
                  fontSize: 22,
                  fontWeight: 700,
                  color: c.hot && red > 0.4 ? theme.danger : c.label === '提醒' && c.val !== '0' ? theme.nag : theme.text,
                  fontVariantNumeric: 'tabular-nums',
                  textShadow: c.label === '提醒' && nagFlash > 0.01 ? `0 0 ${12 * clamp01(nagFlash)}px ${withAlpha(theme.nag, 0.7)}` : 'none',
                }}
              >
                {c.val}
              </span>
            </div>
          ))}
          <TaskSteps
            x={0}
            y={0}
            w={150}
            states={isBase ? ['done', 'done', 'done'] : mode === 'chatty' ? ['done', 'done', 'done'] : ['done', 'done', 'todo']}
            lit={Math.max(taskDone, red)}
            grayFlash={isDead ? red : 0}
          />
        </div>
        {/* chatty 档：六枚紫色注入位密集闪现（啰嗦的具象） */}
        {mode === 'chatty' ? (
          <div style={{display: 'flex', gap: 6, marginTop: 10}}>
            {Array.from({length: 6}, (_, i) => {
              const on = clamp01(nagFlash * 6 - i);
              return (
                <div
                  key={i}
                  style={{
                    width: (w - 32 - 5 * 6) / 6,
                    height: 22,
                    borderRadius: 5,
                    border: `2px solid ${on > 0.5 ? theme.nag : theme.panelBorder}`,
                    background: on > 0.5 ? withAlpha(theme.nag, 0.22) : 'transparent',
                  }}
                />
              );
            })}
          </div>
        ) : null}
      </Panel>
    </div>
  );
};

/** 漂移环（3-B 归因——同一枚格式化动作卡沿小环循环、旁计数器跳 7）。环上只此
 *  一卡（重复即原地打转的空间陈述）；轨道 = 中性虚线环（漂移轨道非契约主色），
 *  计数 = danger（漂移反例）；`spin` 0..1 动作卡绕环角度；`count` 跳 7 读数；
 *  `noExit` 0..1 环外虚线路径描出（无出口）。 */
export const DriftLoop: React.FC<{
  cx: number;
  cy: number;
  r?: number;
  spin?: number;
  count?: number;
  noExit?: number;
  lit?: number;
  dim?: number;
}> = ({cx, cy, r = 150, spin = 0, count = 0, noExit = 0, lit = 1, dim = 0}) => {
  const cardA = -90 + spin * 360;
  const rad = (cardA * Math.PI) / 180;
  const px = cx + r * Math.cos(rad);
  const py = cy + r * Math.sin(rad);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: clamp01(lit) * (1 - dim), pointerEvents: 'none'}}>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        {/* 轨道（中性虚线环——重复的轨道） */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={withAlpha(theme.dim, 0.5)} strokeWidth={3} strokeDasharray="9 9" />
        {/* 无出口虚线路径（环外一问无出口——描出发即止；虚线底与描线亮沿分
            元素：px dasharray 与 pathLength 归一化互斥，红线三） */}
        {noExit > 0.01 ? (
          <>
            <path
              d={`M ${cx + r * 0.7} ${cy - r * 0.72} Q ${cx + r * 1.5} ${cy - r * 1.3}, ${cx + r * 1.2} ${cy - r * 0.4}`}
              fill="none"
              stroke={theme.danger}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray="8 10"
              opacity={0.35 * clamp01(noExit)}
            />
            <path
              d={`M ${cx + r * 0.7} ${cy - r * 0.72} Q ${cx + r * 1.5} ${cy - r * 1.3}, ${cx + r * 1.2} ${cy - r * 0.4}`}
              fill="none"
              stroke={theme.danger}
              strokeWidth={4}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - clamp01(noExit)}
              opacity={0.7}
            />
          </>
        ) : null}
      </svg>
      {/* 同一枚格式化动作卡（灰调块——环上只此一卡） */}
      <div style={{position: 'absolute', left: px - 56, top: py - 22}}>
        <div
          style={{
            width: 112,
            height: 44,
            boxSizing: 'border-box',
            borderRadius: 8,
            border: `2.5px solid ${withAlpha(theme.dim, 0.8)}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'fmt'}</span>
        </div>
      </div>
      {/* 旁计数器（跳 7——漂移反例计数） */}
      <div style={{position: 'absolute', left: cx + r + 36, top: cy - 30}}>
        <div
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            border: `2.5px solid ${theme.danger}`,
            background: withAlpha(theme.danger, 0.1),
            fontFamily: theme.mono,
            fontSize: 26,
            fontWeight: 700,
            color: theme.danger,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {`×${Math.round(count)}`}
        </div>
      </div>
    </div>
  );
};

/** 争议天平（4-C——横梁左盘「补丁」右盘「必需」各坐一枚清单卡缩微；两盘等重
 *  悬置不落盘=争议无裁决）。`beamLit` 0..1 天平落位；`panL`/`panR` 各盘点火；
 *  `axisScroll` 0..1 能力轴滚动；`bead` 0..1 答案珠沿曲线游移（恒不定格）。 */
export const DebateScale: React.FC<{
  cx: number;
  cy: number;
  lit?: number;
  beamLit?: number;
  panL?: number;
  panR?: number;
  axisScroll?: number;
  bead?: number;
  dim?: number;
}> = ({cx, cy, lit = 0, beamLit = 0, panL = 0, panR = 0, axisScroll = 0, bead = 0, dim = 0}) => {
  const L = clamp01(lit);
  const beam = clamp01(beamLit);
  const panY = cy + 46;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: L * (1 - dim), pointerEvents: 'none'}}>
      {/* 后景：版本漂移曲线（能力演进横轴恒左→右 + 答案珠游移） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        {/* 能力演进轴（滚动：dashoffset 随 axisScroll 行进——方向恒左→右） */}
        <line
          x1={cx - 380}
          y1={cy + 250}
          x2={cx + 380}
          y2={cy + 250}
          stroke={withAlpha(theme.dim, 0.6)}
          strokeWidth={3}
          strokeDasharray="12 10"
          style={{strokeDashoffset: -24 * clamp01(axisScroll)}}
        />
        <text x={cx - 380} y={cy + 284} fontFamily={theme.mono} fontSize={16} fill={theme.dim}>
          {'能力演进 →'}
        </text>
        {/* 答案曲线（问号珠游移轨道——不落终态） */}
        <path
          d={`M ${cx - 340} ${cy + 196} Q ${cx - 120} ${cy + 130}, ${cx} ${cy + 172} T ${cx + 340} ${cy + 150}`}
          fill="none"
          stroke={withAlpha(theme.dim, 0.4)}
          strokeWidth={2.5}
          strokeDasharray="6 8"
        />
      </svg>
      {/* 天平（支点 + 横梁等重悬置） */}
      <svg width={720} height={420} viewBox={`0 0 720 420`} style={{position: 'absolute', left: cx - 360, top: cy - 200, overflow: 'visible', opacity: beam}}>
        {/* 支点 + 立柱 + 底座 */}
        <polygon points="360,80 336,150 384,150" fill={withAlpha(theme.dim, 0.5)} />
        <line x1={360} y1={150} x2={360} y2={330} stroke={theme.dim} strokeWidth={5} />
        <line x1={280} y1={332} x2={440} y2={332} stroke={theme.dim} strokeWidth={5} strokeLinecap="round" />
        {/* 横梁（等重悬置——水平恒定不倾） */}
        <line x1={120} y1={80} x2={600} y2={80} stroke={theme.text} strokeWidth={6} strokeLinecap="round" />
        <circle cx={360} cy={80} r={9} fill={theme.text} />
        {/* 吊索 + 两盘 */}
        <line x1={120} y1={80} x2={120} y2={130} stroke={withAlpha(theme.dim, 0.7)} strokeWidth={2.5} />
        <line x1={600} y1={80} x2={600} y2={130} stroke={withAlpha(theme.dim, 0.7)} strokeWidth={2.5} />
      </svg>
      {/* 左盘「补丁」/ 右盘「必需」（各坐一枚清单卡缩微——规划蓝微缩同形） */}
      {[{k: '补丁', x: cx - 240, p: panL}, {k: '必需', x: cx + 240, p: panR}].map((s) => (
        <div key={s.k} style={{position: 'absolute', left: s.x - 80, top: panY, opacity: clamp01(s.p)}}>
          <div
            style={{
              width: 160,
              height: 8,
              borderRadius: 4,
              background: withAlpha(theme.dim, 0.7),
              marginBottom: 8,
            }}
          />
          <div
            style={{
              width: 118,
              height: 74,
              boxSizing: 'border-box',
              borderRadius: 9,
              border: `2.5px solid ${theme.mech}`,
              background: withAlpha(theme.mech, 0.1),
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 5,
              padding: '0 12px',
              margin: '0 auto',
            }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i} style={{display: 'flex', alignItems: 'center', gap: 6}}>
                <div style={{width: 10, height: 10, borderRadius: 999, border: `2px solid ${withAlpha(theme.mech, 0.7)}`}} />
                <div style={{height: 4, width: 62, borderRadius: 2, background: withAlpha(theme.mech, 0.35)}} />
              </div>
            ))}
          </div>
          <div style={{textAlign: 'center', fontFamily: theme.sans, fontSize: 26, fontWeight: 700, color: theme.text, marginTop: 10}}>{s.k}</div>
        </div>
      ))}
      {/* 答案珠（问号——沿曲线游移不停、不落终态；左→右随 bead） */}
      <div
        style={{
          position: 'absolute',
          left: cx - 340 + 680 * clamp01(bead),
          top: cy + 168 - 26 * Math.sin(Math.PI * clamp01(bead)),
          fontFamily: theme.serif,
          fontSize: 34,
          fontWeight: 700,
          color: theme.text,
        }}
      >
        {'?'}
      </div>
      {/* 支点下方估量签（「根子」——规划靠谱吗）由场景另贴 */}
    </div>
  );
};

/** 对话池（5-B 下期钩——池壁刻度上浮、消息条越堆越满；池水浑浊化由场景叠
 *  罩层）。`lit` 显形；`level` 0..1 水位（池壁刻度逼近上限）；池内条目由场景
 *  放入（本件只画池壁 + 刻度）。 */
export const ContextPool: React.FC<{x: number; y: number; w: number; h: number; lit?: number; level?: number; dim?: number}> = ({
  x,
  y,
  w,
  h,
  lit = 0,
  level = 0,
  dim = 0,
}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: clamp01(lit) * (1 - dim)}}>
    {/* 池壁（左右壁 + 底） */}
    <svg width={w + 16} height={h + 16} viewBox={`0 0 ${w + 16} ${h + 16}`} style={{overflow: 'visible'}}>
      <line x1={0} y1={0} x2={0} y2={h + 12} stroke={withAlpha(theme.dim, 0.75)} strokeWidth={5} strokeLinecap="round" />
      <line x1={w + 12} y1={0} x2={w + 12} y2={h + 12} stroke={withAlpha(theme.dim, 0.75)} strokeWidth={5} strokeLinecap="round" />
      <line x1={0} y1={h + 12} x2={w + 12} y2={h + 12} stroke={withAlpha(theme.dim, 0.75)} strokeWidth={5} strokeLinecap="round" />
      {/* 池壁刻度（左壁水位刻度——上限线 danger 虚线） */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} y1={h * (1 - f)} x2={16} y2={h * (1 - f)} stroke={withAlpha(theme.dim, 0.5)} strokeWidth={3} />
      ))}
      <line x1={0} y1={h * 0.08} x2={w + 12} y2={h * 0.08} stroke={withAlpha(theme.danger, 0.55)} strokeWidth={2.5} strokeDasharray="8 8" />
    </svg>
    {/* 水位线标注（逼近上限——由 level 推进的位置签） */}
    <div
      style={{
        position: 'absolute',
        left: -6,
        top: h * (1 - 0.3 - 0.62 * clamp01(level)),
        fontFamily: theme.mono,
        fontSize: 15,
        color: theme.dim,
        whiteSpace: 'nowrap',
      }}
    >
      {'context'}
    </div>
  </div>
);

/** 模型脑图标（中性灰白——模型本体，全片非契约主色；`size` 直径、`lit` 显形、
 *  `bigger` 0..1 放大一档（3-D「更聪明的模型」）。1-B/3-D/5-A 共用同形。 */
export const BrainGlyph: React.FC<{cx: number; cy: number; size?: number; lit?: number; bigger?: number; dim?: number}> = ({
  cx,
  cy,
  size = 120,
  lit = 1,
  bigger = 0,
  dim = 0,
}) => {
  const s = size * (1 + 0.3 * clamp01(bigger));
  const r = s / 2;
  return (
    <svg
      width={s}
      height={s}
      viewBox={`${-r} ${-r} ${s} ${s}`}
      style={{position: 'absolute', left: cx - s / 2, top: cy - s / 2, overflow: 'visible', opacity: clamp01(lit) * (1 - dim)}}
    >
      <circle r={r - 4} fill={theme.panel} stroke={withAlpha(theme.dim, 0.85)} strokeWidth={3} />
      {/* 简笔沟回（确定性弧线——无随机） */}
      <path d={`M ${-r * 0.5} ${-r * 0.3} Q 0 ${-r * 0.62}, ${r * 0.5} ${-r * 0.26}`} fill="none" stroke={withAlpha(theme.dim, 0.7)} strokeWidth={3} strokeLinecap="round" />
      <path d={`M ${-r * 0.55} ${r * 0.12} Q ${-r * 0.1} ${r * 0.42}, ${r * 0.52} ${r * 0.1}`} fill="none" stroke={withAlpha(theme.dim, 0.7)} strokeWidth={3} strokeLinecap="round" />
      <path d={`M ${-r * 0.1} ${-r * 0.5} Q ${r * 0.05} 0, ${-r * 0.16} ${r * 0.5}`} fill="none" stroke={withAlpha(theme.dim, 0.55)} strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
};

/** 注意力光圈（2-B/2-C——收缩套住失败条=被吸住；松开=拉回）。中性白虚线圆
 *  （注意力非契约主色）；`shrink` 0..1 收缩行程；`hold` 0..1 套住加亮。 */
export const FocusRing: React.FC<{cx: number; cy: number; r0?: number; r1?: number; shrink?: number; hold?: number; lit?: number}> = ({
  cx,
  cy,
  r0 = 320,
  r1 = 150,
  shrink = 0,
  hold = 0,
  lit = 1,
}) => {
  const r = r0 + (r1 - r0) * clamp01(shrink);
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: clamp01(lit), pointerEvents: 'none'}}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={theme.text}
        strokeWidth={3.5 + 2.5 * clamp01(hold)}
        strokeDasharray="14 12"
        opacity={0.55 + 0.4 * clamp01(hold)}
      />
      {hold > 0.01 ? <circle cx={cx} cy={cy} r={r + 10} fill="none" stroke={withAlpha(theme.text, 0.3 * clamp01(hold))} strokeWidth={7} /> : null}
    </svg>
  );
};
