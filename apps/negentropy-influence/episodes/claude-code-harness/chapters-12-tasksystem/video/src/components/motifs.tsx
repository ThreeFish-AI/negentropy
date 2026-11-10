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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2–ep11 延续——
// LoopRing 描边色/线宽跨集恒定（theme.core = 陶土橙 #D97757 + RING_STROKE 6）
// = 逐字节拷贝的前提；本集环侧亮「工具池」挂面（1-E 计数 3→8）与 5-C 下期卡
// 被慢命令进度条卡住，均不改描边契约）

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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep11 逐字节
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
 *  环外挂件（工具池挂面等）的场景侧共用工式 */
export const ringPt = polar;

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep12 Task System）
// storyboard 实现映射登记：TaskWall / WallCard / StateMachineBar / GateArm /
// UnblockFlow / ClaimLock / HighWaterMark / BuildGraphCompare / SpecPin。
// 全片主装置 = 任务墙（mech 任务卡紫：墙体网格 + 3×2 槽位阵列）+ 任务卡（六字段
// /状态机/翻面文件形态/灰卡幽灵态——对照 ep11 RoutingTable 之地位）；依赖连线与
// 解锁播报走 unlock 解锁蓝；关卡拦截/翻车/幽灵态走 danger；完成翻绿/放行走 ok。
// 灰卡 = 紫卡低饱和同款异色（病态语义）；真实版重墙 = 同构加重体量（非新建视觉）。
// 哑装置原则承 ep4–ep11：动效参数（进度/状态/读数）一律经 prop 由调用场景注入，
// 装置自身零 motion hook 调用（map/条件内纯函数推进）。

const clamp01v = (v: number) => Math.min(1, Math.max(0, v));

const withAlphaM = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01v(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 双 hex 线性插值（紫→绿翻色 / 灰卡降饱和的 morph 描边；t 走场景 progress——
 *  effects 不吃弹簧） */
export const mixHex = (a: string, b: string, t: number): string => {
  const p = clamp01v(t);
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + ((((pb >> 16) & 255) - ((pa >> 16) & 255)) * p));
  const g = Math.round(((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * p));
  const bl = Math.round((pa & 255) + (((pb & 255) - (pa & 255)) * p));
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
};

/** 任务墙全局几何（跨镜恒定——continuity 契约：墙体网格描边、槽位布局、紫卡
 *  色值跨镜恒定；急推/拉回由场景层 zoom 公式围绕槽心做整体变换，不重绘墙） */
export const WALL = {x: 330, y: 120, w: 1260, h: 660} as const;
/** 槽位 3×2（卡 360×260；col x = 375/780/1185 · row y = 180/480）——
 *  P2 走查拓扑：初稿 slot0 · 排版 slot1 · 发布 slot2 · 配图 slot3 · slot4 留空 ·
 *  灰卡 slot5（墙角病态位，2-F 首入镜） */
export const WALL_SLOTS = [
  {x: 375, y: 180},
  {x: 780, y: 180},
  {x: 1185, y: 180},
  {x: 375, y: 480},
  {x: 780, y: 480},
  {x: 1185, y: 480},
] as const;
export const SLOT_W = 360;
export const SLOT_H = 260;

/** 任务墙墙体（网格描边 + 槽位阵列 + 边框微光——主装置首帧件）。
 *  `litP` 0..1 轮廓亮起（0-C 首亮 / 4-A 重墙兑现同构复用）；`slotsP` 0..1 槽位
 *  阵列显形（stagger 内置：列序错峰）；`glowP` 0..1 边框微光；`dimP` 整体压暗
 *  （2-F 墙角收暗 / 5-A 背景暗层）；`flickerP` 0..1 重启白噪一闪（1-D——只打
 *  墙体不打卡）；`heavy` 真实版重墙加重体量（描边加粗 + 网格线密 + 九槽暗影，
 *  4-A 同构非新建） */
export const TaskWall: React.FC<{
  litP?: number;
  slotsP?: number;
  glowP?: number;
  dimP?: number;
  flickerP?: number;
  heavy?: boolean;
}> = ({litP = 1, slotsP = 0, glowP = 0, dimP = 0, flickerP = 0, heavy = false}) => {
  const lit = clamp01v(litP);
  const slots = clamp01v(slotsP);
  const glow = clamp01v(glowP);
  const flick = clamp01v(flickerP);
  const edge = heavy ? withAlphaM(theme.mech, 0.55) : withAlphaM(theme.mech, 0.4 + 0.45 * lit);
  const strokeW = heavy ? 7 : 3.5;
  // 槽位阵列：教学 3×2；重墙 3×3（九槽暗影——4-A 真实版体量预告/兑现）
  const rows = heavy ? 3 : 2;
  const cellW = 360;
  const cellH = heavy ? 160 : 260;
  const cols = [375, 780, 1185];
  const rowYs = heavy ? [190, 390, 590] : [180, 480];
  const slotPs: number[] = [];
  let k = 0;
  for (let c = 0; c < 3; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      slotPs.push(clamp01v(slots * 2.2 - k * 0.14));
      k += 1;
    }
  }
  const gridLines: {x1: number; y1: number; x2: number; y2: number}[] = [];
  for (const gx of [690, 1095]) {
    gridLines.push({x1: gx, y1: WALL.y + 24, x2: gx, y2: WALL.y + WALL.h - 24});
  }
  for (const gy of rowYs.slice(1)) {
    gridLines.push({x1: WALL.x + 24, y1: gy - 20, x2: WALL.x + WALL.w - 24, y2: gy - 20});
  }
  return (
    <div style={{position: 'absolute', left: WALL.x, top: WALL.y, width: WALL.w, height: WALL.h, opacity: 1 - 0.75 * clamp01v(dimP)}}>
      <svg width={WALL.w} height={WALL.h} viewBox={`0 0 ${WALL.w} ${WALL.h}`} style={{overflow: 'visible'}}>
        {/* 墙体外框（描边显形——pathLength 归一化描线与槽位虚线正交） */}
        <rect
          x={2}
          y={2}
          width={WALL.w - 4}
          height={WALL.h - 4}
          rx={16}
          fill={heavy ? withAlphaM(theme.panel, 0.42) : withAlphaM(theme.panel, 0.3)}
          stroke={edge}
          strokeWidth={strokeW}
          opacity={0.35 + 0.65 * lit}
        />
        {/* 边框微光（外圈柔光——空墙首亮 / 挂卡后常驻低亮） */}
        {glow > 0.02 ? (
          <rect x={-7} y={-7} width={WALL.w + 14} height={WALL.h + 14} rx={22} fill="none" stroke={theme.mech} strokeWidth={2.5} opacity={0.4 * glow} />
        ) : null}
        {/* 墙体网格线（结构线——槽位布局的经纬） */}
        {gridLines.map((g, i) => (
          <line key={`gl${i}`} x1={g.x1 - WALL.x} y1={g.y1 - WALL.y} x2={g.x2 - WALL.x} y2={g.y2 - WALL.y} stroke={withAlphaM(theme.panelBorder, 0.9)} strokeWidth={heavy ? 2 : 1.6} opacity={0.5 + 0.4 * lit} />
        ))}
        {/* 槽位阵列（虚线槽——空槽暗态是「先有墙后有卡」的可读前提） */}
        {cols.map((cx, c) =>
          rowYs.map((cy, r) => {
            const idx = c * rows + r;
            const p = slotPs[idx];
            if (p <= 0.02) return null;
            return (
              <rect
                key={`slot${idx}`}
                x={cx - WALL.x - 8}
                y={cy - WALL.y - 8}
                width={cellW + 16}
                height={cellH + 16}
                rx={12}
                fill="none"
                stroke={withAlphaM(theme.dim, 0.55)}
                strokeWidth={2}
                strokeDasharray="10 9"
                opacity={p * (heavy ? 0.5 : 0.8)}
              />
            );
          }),
        )}
        {/* 重启白噪一闪（1-D：整墙亮度脉冲一次——只打墙体，卡面零漂移由
            调用侧保证（卡不在本组件内）） */}
        {flick > 0.02 ? (
          <rect x={0} y={0} width={WALL.w} height={WALL.h} rx={16} fill={theme.text} opacity={0.16 * Math.sin(Math.PI * flick)} />
        ) : null}
      </svg>
    </div>
  );
};

/** 依赖小签（卡面 blockedBy 编号签——待领灰 / 完成 ok 翻绿 / 不存在虚线问号三态） */
export const DepChip: React.FC<{id: string; doneP?: number; ghostP?: number; w?: number}> = ({id, doneP = 0, ghostP = 0, w = 150}) => {
  const done = clamp01v(doneP);
  const ghost = clamp01v(ghostP);
  const edge = ghost > 0.3 ? withAlphaM(theme.danger, 0.55 + 0.4 * ghost) : done > 0.4 ? theme.ok : withAlphaM(theme.dim, 0.8);
  return (
    <div
      style={{
        width: w,
        padding: '3px 10px',
        borderRadius: 7,
        border: `2px ${ghost > 0.3 ? 'dashed' : 'solid'} ${edge}`,
        background: withAlphaM(theme.panel, 0.92),
        fontFamily: theme.mono,
        fontSize: 15,
        color: ghost > 0.3 ? theme.danger : done > 0.4 ? theme.ok : theme.dim,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {ghost > 0.3 ? `${id.replace(/0+$/, '')}?` : id}
    </div>
  );
};

/** 单张任务卡（六字段卡同款——跨幕状态机件）。
 *  `state`: 'pending'（紫实）| 'claimed'（亮紫 + 签名）| 'done'（确认绿）；
 *  `litP` 入场；`solidP` 0.35 卡影 → 1 实体（0-C 预演挂槽 / 1-A 凝实）；
 *  `signP` 签名写入（右下 serif 斜体——认领动作的落卡证据）；`signer` 签名内容；
 *  `greenP` 翻绿进度（mech→ok 描边与徽点 crossfade）；`grayP` 灰卡低饱和态
 *  （2-F/3-A 病态语义——低饱和紫非褪灰）；`ghostP` 幽灵态（半透明 + 警示红描边
 *  闪——3-B 被错误放行后）；`errP` 编号闪错一次（1-C「不放行也不崩溃」稳态）；
 *  `deps` 依赖小签列表（右下竖排，配 `depsP` 显形 / 每枚 doneP 由调用方控制）；
 *  `compact` 紧凑排版（墙槽位 360×260 缺省 → 走查全景同尺寸即缺省） */
export const WallCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  title: string;
  id: string;
  state?: 'pending' | 'claimed' | 'done';
  litP?: number;
  solidP?: number;
  signP?: number;
  signer?: string;
  greenP?: number;
  grayP?: number;
  ghostP?: number;
  errP?: number;
  deps?: {id: string; doneP?: number; ghostP?: number}[];
  depsP?: number;
  gateHint?: {greenP?: number; redP?: number};
}> = ({
  x,
  y,
  w = SLOT_W,
  h = SLOT_H,
  title,
  id,
  state = 'pending',
  litP = 1,
  solidP = 1,
  signP = 0,
  signer,
  greenP = 0,
  grayP = 0,
  ghostP = 0,
  errP = 0,
  deps,
  depsP = 0,
  gateHint,
}) => {
  const lit = clamp01v(litP);
  const solid = clamp01v(solidP);
  const sign = clamp01v(signP);
  const green = clamp01v(greenP);
  const gray = clamp01v(grayP);
  const ghost = clamp01v(ghostP);
  const err = clamp01v(errP);
  const grayEdge = withAlphaM(theme.mech, 0.34); // 灰卡：低饱和紫（病态≠褪灰）
  const baseEdge = mixHex(theme.mech, theme.ok, green);
  const edge = gray > 0.3 ? grayEdge : ghost > 0.3 ? mixHex(baseEdge, theme.danger, 0.8 * Math.max(ghost, 0.4 * Math.sin(Math.PI * ghost))) : baseEdge;
  const dotColor = green > 0.5 ? theme.ok : state === 'claimed' ? theme.mech : gray > 0.3 ? grayEdge : withAlphaM(theme.mech, 0.75);
  const idShown = err > 0.3 ? id.replace(/\d+/, (d) => `${Number(d) + 400}`) : id;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: lit * (0.35 + 0.65 * solid) * (1 - 0.35 * ghost),
        transform: `scale(${0.96 + 0.04 * solid})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          border: `3px solid ${edge}`,
          background: withAlphaM(theme.panel, 0.9 + 0.06 * solid),
          boxShadow: green > 0.9 ? `0 0 ${16 * green}px ${withAlphaM(theme.ok, 0.35)}` : ghost > 0.5 ? `0 0 ${20 * ghost}px ${withAlphaM(theme.danger, 0.45)}` : 'none',
        }}
      >
        {/* 编号签（左上 mono——1-C 编号闪错在此呈现：task_001 → task_401 一拍回稳） */}
        <div
          style={{
            position: 'absolute',
            left: 14,
            top: 12,
            fontFamily: theme.mono,
            fontSize: 16,
            color: err > 0.05 ? theme.danger : theme.dim,
            whiteSpace: 'nowrap',
            letterSpacing: 1,
          }}
        >
          {idShown}
        </div>
        {/* 状态徽点（右上——pending 暗 / claimed 紫 / done 绿） */}
        <div style={{position: 'absolute', right: 16, top: 16, width: 16, height: 16, borderRadius: '50%', background: dotColor, opacity: 0.9}} />
        {/* 任务名签（中上 sans 粗——走查全程同形同色可追的具体输入值） */}
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: 44,
            fontFamily: theme.sans,
            fontSize: 30,
            fontWeight: 700,
            color: mixHex(theme.text, theme.dim, Math.max(gray, ghost * 0.3)),
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        {/* 依赖小签列（右下竖排——blockedBy 的卡上登记面） */}
        {deps && deps.length > 0 ? (
          <div style={{position: 'absolute', right: 14, bottom: 14, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', opacity: clamp01v(depsP)}}>
            {deps.map((d) => (
              <DepChip key={d.id} id={d.id} doneP={d.doneP} ghostP={d.ghostP} w={Math.min(150, w * 0.44)} />
            ))}
          </div>
        ) : null}
        {/* 签名（右下 serif 斜体——认领动作的归属人落卡；幽灵签名半透明可辨真假） */}
        {sign > 0.02 && signer ? (
          <div
            style={{
              position: 'absolute',
              left: 16,
              bottom: 14,
              fontFamily: theme.serif,
              fontSize: 24,
              fontStyle: 'italic',
              fontWeight: 700,
              color: ghost > 0.3 ? withAlphaM(theme.text, 0.45) : theme.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              width: `${sign * 46}%`,
              textShadow: ghost > 0.5 ? `0 0 12px ${withAlphaM(theme.danger, 0.5)}` : 'none',
            }}
          >
            {signer}
          </div>
        ) : null}
        {/* 完成对勾（翻绿落卡——greenP 后半程显形） */}
        {green > 0.5 ? (
          <svg width={30} height={30} viewBox="0 0 20 20" style={{position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', opacity: clamp01v(green * 2 - 1)}}>
            <path d="M 3 10.5 L 8 15.5 L 17 4.5" fill="none" stroke={theme.ok} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </div>
      {/* 卡前关卡灯（gateHint——2-B 关卡视角扫过：绿灯放行 / 红挡压卡的小型态） */}
      {gateHint ? (
        <div style={{position: 'absolute', left: -30, top: h / 2 - 14, display: 'flex', flexDirection: 'column', gap: 8, opacity: 1}}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: `3px solid ${clamp01v(gateHint.greenP ?? 0) > 0.4 ? theme.ok : withAlphaM(theme.danger, 0.85)}`,
              background: clamp01v(gateHint.greenP ?? 0) > 0.4 ? theme.ok : 'transparent',
              opacity: Math.max(clamp01v(gateHint.greenP ?? 0), clamp01v(gateHint.redP ?? 0)),
              boxShadow: clamp01v(gateHint.greenP ?? 0) > 0.4 ? `0 0 12px ${withAlphaM(theme.ok, 0.6)}` : 'none',
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

/** 折线长度参数化（DepLine 的 pathFollow 原子——t 0..1 → 折线上点） */
const polylineAt = (pts: readonly {x: number; y: number}[], t: number) => {
  const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  const total = segs.reduce((a, b) => a + b, 0);
  let d = clamp01v(t) * total;
  for (let i = 0; i < segs.length; i += 1) {
    if (d <= segs[i] || i === segs.length - 1) {
      const f = segs[i] === 0 ? 0 : Math.min(1, d / segs[i]);
      return {x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f};
    }
    d -= segs[i];
  }
  return pts[0];
};

const toPathD = (pts: readonly {x: number; y: number}[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

/** 依赖连线（解锁蓝——blockedBy 的图面表达）。
 *  `pts` 折线（单向下游，场景层保证不交叉折返）；`drawP` 描线（pathLength 归一）；
 *  `litP` 常亮强度（2-E 全链翻绿后连线转常亮）；`pulseT` 0..1 播报信号沿既有连线
 *  流动的位置（圆点脉冲——不另起路径）；`ghostP` 虚线态（2-F 灰卡连线指向虚空）；
 *  `dangleP` 0..1 悬空断头（4-D 左轨病态连线——描到半途断掉） */
export const DepLine: React.FC<{
  pts: readonly {x: number; y: number}[];
  drawP?: number;
  litP?: number;
  pulseT?: number;
  ghostP?: number;
  dangleP?: number;
}> = ({pts, drawP = 1, litP = 0, pulseT = -1, ghostP = 0, dangleP = 0}) => {
  const draw = clamp01v(drawP) * (1 - 0.65 * clamp01v(dangleP));
  const lit = clamp01v(litP);
  const ghost = clamp01v(ghostP);
  const d = toPathD(pts);
  const showPulse = pulseT !== undefined && pulseT >= 0 && pulseT <= 1;
  const pAt = showPulse ? polylineAt(pts, clamp01v(pulseT as number)) : null;
  return (
    <g>
      <path d={d} fill="none" stroke={withAlphaM(theme.unlock, 0.5 + 0.4 * lit)} strokeWidth={lit > 0.5 ? 5.5 : 4} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      {ghost > 0.02 ? <path d={d} fill="none" stroke={withAlphaM(theme.dim, 0.6 * ghost)} strokeWidth={3} strokeLinecap="round" strokeDasharray="8 9" /> : null}
      {/* 悬空断头（编号未生成不可引用——连线到 60% 处断掉，断口虚线问号由场景层挂） */}
      {dangleP > 0.02 ? <path d={d} fill="none" stroke={withAlphaM(theme.danger, 0.5 * clamp01v(dangleP))} strokeWidth={3} strokeLinecap="round" strokeDasharray="5 7" pathLength={1} strokeDashoffset={1 - 0.6} opacity={clamp01v(dangleP)} /> : null}
      {/* 播报信号脉冲（沿既有连线流动的解锁蓝圆点 + 拖尾亮段） */}
      {pAt ? (
        <>
          <circle cx={pAt.x} cy={pAt.y} r={8} fill={theme.unlock} opacity={0.95} />
          <circle cx={pAt.x} cy={pAt.y} r={15} fill="none" stroke={withAlphaM(theme.unlock, 0.55)} strokeWidth={2.5} />
        </>
      ) : null}
    </g>
  );
};

/** 关卡闸门（1-C 首建 → 2-B/2-D 卡前缩用 → 3-A 压灰卡；与卡前灯同款同形语义）。
 *  `dropP` 0..1 横杆落下（认领必经之路上压下）；`bar` 'left'（依赖未完成）|
 *  'right'（依赖不存在·引用错误）| 'both'——两枚红挡并列可辨；`barP` 红挡落下；
 *  `liftP` 0..1 横杆抬起（解锁播报后）；`halfP` 0..1 抬起一半（3-B 幽灵穿过的
 *  小半个闸门）；`greenP` 0..1 绿灯放行（亮灯替代红挡） */
export const GateArm: React.FC<{
  x: number;
  y: number;
  w?: number;
  dropP?: number;
  bar?: 'left' | 'right' | 'both' | null;
  barP?: number;
  liftP?: number;
  halfP?: number;
  greenP?: number;
}> = ({x, y, w = 240, dropP = 1, bar = null, barP = 0, liftP = 0, halfP = 0, greenP = 0}) => {
  const drop = clamp01v(dropP);
  const lift = clamp01v(liftP);
  const half = clamp01v(halfP);
  const green = clamp01v(greenP);
  const bp = clamp01v(barP);
  const armAngle = -78 * (1 - drop) + 82 * lift + 38 * half; // 横杆：水平=压下，抬起=转向上
  const postH = 96;
  const barLabels: {side: 'left' | 'right'; text: string}[] = bar === 'both' ? [{side: 'left', text: '依赖未完成'}, {side: 'right', text: '依赖不存在'}] : bar ? [{side: bar, text: bar === 'left' ? '依赖未完成' : '依赖不存在'}] : [];
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w}}>
      <svg width={w} height={postH + 30} viewBox={`0 0 ${w} ${postH + 30}`} style={{overflow: 'visible'}}>
        {/* 两立柱 */}
        <line x1={8} y1={postH} x2={8} y2={0} stroke={withAlphaM(theme.dim, 0.9)} strokeWidth={6} strokeLinecap="round" />
        <line x1={w - 8} y1={postH} x2={w - 8} y2={0} stroke={withAlphaM(theme.dim, 0.9)} strokeWidth={6} strokeLinecap="round" />
        {/* 横杆（绕左柱头旋转：落下=水平拦路 / 抬起=竖直放行） */}
        <g transform={`rotate(${armAngle} 8 10)`} opacity={drop > 0.05 ? 1 : 0}>
          <line x1={8} y1={10} x2={w - 8} y2={10} stroke={green > 0.4 ? withAlphaM(theme.ok, 0.9) : withAlphaM(theme.danger, 0.85)} strokeWidth={7} strokeLinecap="round" />
          {/* 杆上斜纹（关卡的可读性纹理——红绿随放行态） */}
          {Array.from({length: Math.floor((w - 24) / 30)}, (_, i) => (
            <line key={`stripe${i}`} x1={18 + i * 30} y1={10} x2={28 + i * 30} y2={3} stroke={green > 0.4 ? withAlphaM(theme.ok, 0.7) : withAlphaM(theme.danger, 0.6)} strokeWidth={3.5} strokeLinecap="round" />
          ))}
        </g>
        {/* 绿灯（放行态——亮灯替代红挡：与红灯互斥） */}
        {green > 0.02 ? (
          <g opacity={green}>
            <circle cx={w / 2} cy={postH + 12} r={13} fill={theme.ok} opacity={0.9} />
            <circle cx={w / 2} cy={postH + 12} r={20} fill="none" stroke={withAlphaM(theme.ok, 0.5)} strokeWidth={3} />
          </g>
        ) : null}
      </svg>
      {/* 红挡签（两枚并列——barP 落下；fail-closed 是稳态拦截非碎裂） */}
      {barLabels.map((b) =>
        bp > 0.02 ? (
          <div
            key={b.side}
            style={{
              position: 'absolute',
              left: b.side === 'left' ? -46 : w / 2 + 8,
              top: 34 - 46 * (1 - bp),
              padding: '5px 14px',
              borderRadius: 9,
              border: `2.5px solid ${theme.danger}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 16,
              fontWeight: 700,
              color: theme.danger,
              whiteSpace: 'nowrap',
              opacity: bp,
              boxShadow: `0 0 ${12 * bp}px ${withAlphaM(theme.danger, 0.4)}`,
            }}
          >
            {b.text}
          </div>
        ) : null,
      )}
    </div>
  );
};

/** 三状态横条 + 两动作箭头（1-B 状态机教学件——等宽单向：只许待领→在做→完成）。
 *  `litP` 入场；`segsP` 0..3 三段依次点亮（待领灰紫 / 在做亮紫 / 完成绿）；
 *  `pos` 0..2 滑标实数位（状态改写的单向滑动）；`claimP` 认领箭头推入（携签名
 *  笔尖）；`doneP` 完成箭头翻绿（携绿刷） */
export const StateMachineBar: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  segsP?: number;
  pos?: number;
  claimP?: number;
  doneP?: number;
}> = ({x, y, w = 1000, h = 96, litP = 1, segsP = 0, pos = 0, claimP = 0, doneP = 0}) => {
  const lit = clamp01v(litP);
  const segs = clamp01v(segsP);
  const segW = w / 3;
  const segs3 = [
    {t: '待领', c: withAlphaM(theme.mech, 0.4)},
    {t: '在做', c: theme.mech},
    {t: '完成', c: theme.ok},
  ];
  const sliderX = segW * 0.5 + (Math.min(2, Math.max(0, pos))) * segW;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: lit}}>
      {/* 三段等宽横条 */}
      <div style={{display: 'flex', width: w, height: h, borderRadius: 14, overflow: 'hidden', border: `3px solid ${withAlphaM(theme.panelBorder, 0.9)}`}}>
        {segs3.map((s, i) => {
          const p = clamp01v(segs - i);
          return (
            <div
              key={s.t}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.sans,
                fontSize: 30,
                fontWeight: 700,
                color: p > 0.35 ? theme.text : theme.dim,
                background: p > 0.35 ? withAlphaM(s.c, 0.3) : 'transparent',
                borderLeft: i > 0 ? `2.5px solid ${withAlphaM(theme.panelBorder, 0.7)}` : 'none',
                opacity: 0.4 + 0.6 * p,
                whiteSpace: 'nowrap',
              }}
            >
              {s.t}
            </div>
          );
        })}
      </div>
      {/* 滑标（状态徽——单向滑动的当前态指针；数据本体禁过冲） */}
      <div
        style={{
          position: 'absolute',
          left: sliderX - 26,
          top: -16,
          width: 52,
          height: h + 32,
          borderRadius: 12,
          border: `3px solid ${pos > 1.5 ? theme.ok : theme.mech}`,
          background: withAlphaM(pos > 1.5 ? theme.ok : theme.mech, 0.12),
          boxShadow: `0 0 14px ${withAlphaM(pos > 1.5 ? theme.ok : theme.mech, 0.45)}`,
        }}
      />
      {/* 两支动作箭头（横条下方待位——认领携笔尖 / 完成携绿刷） */}
      <div style={{position: 'absolute', left: 0, top: h + 22, display: 'flex', gap: 40}}>
        {[
          {t: '认领', p: clamp01v(claimP), c: theme.mech, icon: 'pen' as const},
          {t: '完成', p: clamp01v(doneP), c: theme.ok, icon: 'brush' as const},
        ].map((a) => (
          <div key={a.t} style={{display: 'flex', alignItems: 'center', gap: 10, opacity: 0.35 + 0.65 * a.p, transform: `translateX(${a.p * 26}px)`}}>
            <svg width={34} height={34} viewBox="0 0 34 34">
              {a.icon === 'pen' ? (
                <g stroke={a.c} strokeWidth={2.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M 6 28 L 10 20 L 24 6 L 28 10 L 14 24 Z" />
                  <path d="M 21 9 L 25 13" />
                </g>
              ) : (
                <g stroke={a.c} strokeWidth={2.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="5" width="14" height="10" rx="2" />
                  <path d="M 13 15 L 13 20 L 26 20 L 26 12 L 22 12" />
                  <path d="M 22 26 L 28 26" strokeWidth={5} />
                </g>
              )}
            </svg>
            <span
              style={{
                padding: '4px 16px',
                borderRadius: 8,
                border: `2.5px solid ${a.p > 0.4 ? a.c : withAlphaM(theme.panelBorder, 0.9)}`,
                background: theme.panel,
                fontFamily: theme.sans,
                fontSize: 19,
                fontWeight: 700,
                color: a.p > 0.4 ? a.c : theme.dim,
                whiteSpace: 'nowrap',
              }}
            >
              {a.t}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** 解锁播报条（2-C——完成动作自己带回开工名单；信号沿既有连线流动见 DepLine
 *  pulseT，本件是墙下的名单条）。`popP` 弹出；`name` 点名对象（'排版'/'发布'，
 *  null = 空单——空条非文字）；`flashP` 整条高亮（主动推送语义） */
export const UnblockFlow: React.FC<{x: number; y: number; w?: number; popP?: number; name?: string | null; flashP?: number}> = ({x, y, w = 620, popP = 0, name = null, flashP = 0}) => {
  const pop = clamp01v(popP);
  const flash = clamp01v(flashP);
  const empty = name === null || name === undefined;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + (1 - pop) * 18,
        width: w,
        padding: '10px 22px',
        borderRadius: 11,
        border: `3px solid ${flash > 0.3 ? theme.unlock : withAlphaM(theme.unlock, 0.65)}`,
        background: withAlphaM(theme.panel, 0.96),
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        opacity: pop,
        boxShadow: flash > 0.05 ? `0 0 ${22 * flash}px ${withAlphaM(theme.unlock, 0.55)}` : 'none',
      }}
    >
      <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.unlock, whiteSpace: 'nowrap'}}>{'解锁'}</span>
      {empty ? (
        /* 空单播报：空条非文字（发布完成 → 报：没有） */
        <span style={{flex: 1, height: 22, borderRadius: 5, border: `2.5px dashed ${withAlphaM(theme.dim, 0.6)}`}} />
      ) : (
        <>
          <svg width={26} height={14} viewBox="0 0 26 14">
            <path d="M 2 7 L 18 7" stroke={theme.unlock} strokeWidth={2.6} strokeLinecap="round" />
            <path d="M 15 2 L 22 7 L 15 12" fill="none" stroke={theme.unlock} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{name}</span>
        </>
      )}
    </div>
  );
};

/** 认领锁（4-B——3-D 悬置剪影兑现为实体锁，同形）。`closeP` 锁体闭合；`chainP`
 *  0..5 五节链环按口播次序咬合（重读→查归属→查完成→查依赖→写归属）；`retryN`
 *  重试计数读数（1..30，计数条跳至上限刻度锚定）；`waitMs` 等待读数 5..100ms
 *  （拉长条动态拉长，双端刻度锚定——数据本体禁过冲，调用侧线性喂值） */
export const ClaimLock: React.FC<{
  x: number;
  y: number;
  closeP?: number;
  chainP?: number;
  retryN?: number;
  waitMs?: number;
}> = ({x, y, closeP = 0, chainP = 0, retryN = 0, waitMs = 5}) => {
  const close = clamp01v(closeP);
  const steps = ['重读', '查归属', '查完成', '查依赖', '写归属'];
  const w = 760;
  const h = 330;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h}}>
      {/* 锁体（挂锁形——锁梁 + 锁身；与 3-D 剪影同形） */}
      <svg width={w} height={150} viewBox={`0 0 ${w} 150`} style={{overflow: 'visible'}}>
        <path d={`M ${w / 2 - 70} 74 L ${w / 2 - 70} 46 A 70 70 0 0 1 ${w / 2 + 70} 46 L ${w / 2 + 70} 74`} fill="none" stroke={theme.mech} strokeWidth={11} strokeLinecap="round" opacity={0.35 + 0.65 * close} />
        <rect x={w / 2 - 130} y={72} width={260} height={70} rx={14} fill={withAlphaM(theme.panel, 0.97)} stroke={theme.mech} strokeWidth={4.5} opacity={0.4 + 0.6 * close} />
        {/* 锁孔（闭合即现） */}
        <circle cx={w / 2} cy={98} r={9} fill={theme.mech} opacity={close} />
        <rect x={w / 2 - 4} y={100} width={8} height={22} rx={3} fill={theme.mech} opacity={close} />
      </svg>
      {/* 锁内五步链（五节链环逐节咬合——每节：链环 + 步名；咬合=合口+咔哒脉冲） */}
      <div style={{position: 'absolute', left: 0, top: 168, display: 'flex', gap: 12}}>
        {steps.map((s, i) => {
          const p = clamp01v(chainP - i);
          const shut = p > 0.55;
          return (
            <div key={s} style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <div
                style={{
                  width: 108,
                  padding: '10px 0',
                  borderRadius: 10,
                  border: `2.5px ${shut ? 'solid' : 'dashed'} ${shut ? withAlphaM(theme.mech, 0.9) : withAlphaM(theme.panelBorder, 0.9)}`,
                  background: shut ? withAlphaM(theme.mech, 0.16) : 'transparent',
                  textAlign: 'center',
                  fontFamily: theme.sans,
                  fontSize: 19,
                  fontWeight: 700,
                  color: shut ? theme.text : theme.dim,
                  whiteSpace: 'nowrap',
                  opacity: 0.4 + 0.6 * p,
                  boxShadow: shut && p < 0.95 ? `0 0 ${10 * (1 - Math.abs(p - 0.7) * 3)}px ${withAlphaM(theme.mech, 0.5)}` : 'none',
                }}
              >
                {s}
              </div>
              {i < steps.length - 1 ? (
                <svg width={16} height={20} viewBox="0 0 16 20" style={{opacity: 0.3 + 0.6 * clamp01v(chainP - i - 0.5)}}>
                  <ellipse cx={8} cy={10} rx={5} ry={8} fill="none" stroke={withAlphaM(theme.mech, 0.8)} strokeWidth={2.6} />
                </svg>
              ) : null}
            </div>
          );
        })}
      </div>
      {/* 锁外重试计数条（次数位跳动 + 30 上限刻度锚定） */}
      <div style={{position: 'absolute', left: 0, top: 262, width: w}}>
        <div style={{position: 'relative', height: 30, borderRadius: 7, border: `3px solid ${withAlphaM(theme.mech, 0.55)}`, background: withAlphaM(theme.panel, 0.9)}}>
          <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(1, Math.max(0, retryN / 30)) * 100}%`, borderRadius: 4, background: withAlphaM(theme.mech, 0.4)}} />
          {/* 30 上限刻度（基线标尺——计数只升不越 30） */}
          <div style={{position: 'absolute', right: 2, top: -7, bottom: -7, borderRight: `3px dashed ${withAlphaM(theme.dim, 0.85)}`}} />
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 16, color: theme.dim, marginTop: 5, whiteSpace: 'nowrap'}}>
          <span style={{color: retryN > 0 ? theme.text : theme.dim, fontWeight: 700}}>{`重试 ${Math.round(Math.min(30, Math.max(0, retryN)))}/30`}</span>
          <span>{'上限 30'}</span>
        </div>
      </div>
      {/* 等待拉长条（5→100ms 双端刻度——退避的可视） */}
      <div style={{position: 'absolute', left: 0, top: 340, width: w, opacity: 1}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>{'等待'}</span>
          <div style={{position: 'relative', flex: 1, height: 16, borderRadius: 5, border: `2.5px solid ${withAlphaM(theme.mech, 0.4)}`, background: withAlphaM(theme.panel, 0.9)}}>
            <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${((Math.min(100, Math.max(5, waitMs)) - 5) / 95) * 100}%`, borderRadius: 3, background: withAlphaM(theme.mech, 0.5)}} />
          </div>
          <span style={{fontFamily: theme.mono, fontSize: 16, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>{`${Math.round(waitMs)} ms`}</span>
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 4, paddingLeft: 52, whiteSpace: 'nowrap'}}>
          <span>{'5'}</span>
          <span>{'100'}</span>
        </div>
      </div>
    </div>
  );
};

/** 高水位标刻度尺（4-C——记用过的最大编号；刻度只升不降、删卡位留虚痕不复用）。
 *  `litP` 浮起；`markP` 0..1 当前最大号刻度线标定（高水位指针落下）；`delP`
 *  0..1 一枚旧编号卡淡出（其刻度位保留虚痕）；`skipP` 0..1 新卡跳号越过旧位
 *  落下一格（不回退的可视证明） */
export const HighWaterMark: React.FC<{
  x: number;
  y: number;
  w?: number;
  litP?: number;
  markP?: number;
  delP?: number;
  skipP?: number;
}> = ({x, y, w = 860, litP = 1, markP = 0, delP = 0, skipP = 0}) => {
  const lit = clamp01v(litP);
  const mark = clamp01v(markP);
  const del = clamp01v(delP);
  const skip = clamp01v(skipP);
  // 刻度 1..7：1..5 已用实色（教学墙 task_001..005 含幽灵）；6/7 未用虚色。
  // 3 号位 = 删卡位（delP 淡出后留虚痕）；6 号位 = 新卡跳号落位
  const ticks = [1, 2, 3, 4, 5, 6, 7];
  const pad = 70;
  const tw = (w - pad * 2) / (ticks.length - 1);
  const tx = (n: number) => pad + (n - 1) * tw;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: lit, transform: `translateY(${(1 - lit) * 22}px)`}}>
      <div style={{position: 'relative', width: w, height: 190, borderRadius: 14, border: `3px solid ${withAlphaM(theme.mech, 0.5)}`, background: withAlphaM(theme.panel, 0.95)}}>
        <svg width={w} height={190} viewBox={`0 0 ${w} 190`}>
          {/* 基线 */}
          <line x1={30} y1={140} x2={w - 30} y2={140} stroke={withAlphaM(theme.panelBorder, 0.95)} strokeWidth={3} />
          {ticks.map((n) => {
            const isGhostSlot = n === 3; // 删卡位
            const used = n <= 5;
            const faded = isGhostSlot && del > 0.5;
            return (
              <g key={`tk${n}`}>
                {/* 刻度线：已用实色 / 未用虚色 / 删卡位淡出留虚痕 */}
                <line
                  x1={tx(n)}
                  y1={faded ? 122 : 116}
                  x2={tx(n)}
                  y2={140}
                  stroke={faded ? withAlphaM(theme.dim, 0.45) : used ? theme.mech : withAlphaM(theme.dim, 0.5)}
                  strokeWidth={faded ? 2.5 : 4}
                  strokeDasharray={used && !faded ? undefined : '5 5'}
                  opacity={isGhostSlot ? 1 - 0.5 * del : 1}
                />
                <text x={tx(n)} y={168} textAnchor="middle" fontFamily={theme.mono} fontSize={17} fontWeight={700} fill={faded ? withAlphaM(theme.dim, 0.55) : used ? theme.text : theme.dim} opacity={isGhostSlot ? 1 - 0.45 * del : 1}>
                  {String(n).padStart(3, '0')}
                </text>
              </g>
            );
          })}
          {/* 高水位指针（当前最大号 = 005——markP 落下；只升不降） */}
          {mark > 0.02 ? (
            <g opacity={mark}>
              <line x1={tx(5)} y1={60} x2={tx(5)} y2={112} stroke={theme.ok} strokeWidth={4} strokeLinecap="round" />
              <path d={`M ${tx(5) - 9} 60 L ${tx(5) + 9} 60 L ${tx(5)} 74 Z`} fill={theme.ok} />
              <text x={tx(5)} y={44} textAnchor="middle" fontFamily={theme.mono} fontSize={15} fontWeight={700} fill={theme.ok}>
                {'最大号'}
              </text>
            </g>
          ) : null}
          {/* 删掉的卡（旧编号小卡淡出——编号不复用的具象物） */}
          {del > 0.02 ? (
            <g opacity={1 - del * 0.85}>
              <rect x={tx(3) - 26} y={70} width={52} height={36} rx={6} fill={withAlphaM(theme.panel, 0.98)} stroke={withAlphaM(theme.dim, 0.9)} strokeWidth={2.5} />
              <text x={tx(3)} y={94} textAnchor="middle" fontFamily={theme.mono} fontSize={14} fontWeight={700} fill={theme.dim}>
                {'删'}
              </text>
            </g>
          ) : null}
          {/* 新卡跳号落位（越过删卡位 003 落 006——skipP：从 003 上空弧线跃至 006） */}
          {skip > 0.02 ? (
            <g opacity={clamp01v(skip)}>
              <path d={`M ${tx(3)} 64 Q ${(tx(3) + tx(6)) / 2} ${18 - 10 * Math.sin(Math.PI * clamp01v(skip))} ${tx(3) + (tx(6) - tx(3)) * clamp01v(skip)} ${64 - 44 * clamp01v(skip)}`} fill="none" stroke={theme.mech} strokeWidth={3} strokeDasharray="7 6" />
              <rect x={tx(6) - 26} y={70 - 44} width={52} height={36} rx={6} fill={withAlphaM(theme.panel, 0.98)} stroke={theme.mech} strokeWidth={2.5} opacity={clamp01v(skip * 1.4 - 0.4)} />
              <text x={tx(6)} y={94 - 44} textAnchor="middle" fontFamily={theme.mono} fontSize={14} fontWeight={700} fill={theme.mech} opacity={clamp01v(skip * 1.4 - 0.4)}>
                {'新'}
              </text>
            </g>
          ) : null}
        </svg>
      </div>
    </div>
  );
};

/** 两步建图对比（4-D——左右双轨同卡同局，唯一差异 = 建图次序）。
 *  `leftP` 0..1 左轨一把梭（卡片与连线一次落笔）；`nodesP` 0..1 右轨第一步（四
 *  卡落位拿到编号）；`edgesP` 0..1 右轨第二步（回头连边）；`backP` 0..1 上方
 *  调用块背对（视锥各自朝外）；`dangleP` 0..1 左轨后建卡伸向先建卡编号——连线
 *  悬空断头；`checkP` 0..3 右轨连线逐条校验绿点；`stampP` 0..1「契约」印章盖
 *  落右轨连线（只盖右轨） */
export const BuildGraphCompare: React.FC<{
  x: number;
  y: number;
  leftP?: number;
  nodesP?: number;
  edgesP?: number;
  backP?: number;
  dangleP?: number;
  checkP?: number;
  stampP?: number;
}> = ({x, y, leftP = 0, nodesP = 0, edgesP = 0, backP = 0, dangleP = 0, checkP = 0, stampP = 0}) => {
  const left = clamp01v(leftP);
  const nodes = clamp01v(nodesP);
  const edges = clamp01v(edgesP);
  const back = clamp01v(backP);
  const dangle = clamp01v(dangleP);
  const stamp = clamp01v(stampP);
  const laneW = 600;
  const cardW = 150;
  const cardH = 84;
  // 四小卡 2×2（同卡同局——A/B 左列、C/D 右列；边 A→C、B→C、C→D）
  const nodes4 = [
    {id: 'A', x: 60, y: 40},
    {id: 'B', x: 60, y: 190},
    {id: 'C', x: 360, y: 40},
    {id: 'D', x: 360, y: 190},
  ];
  const edges3 = [
    {from: 0, to: 2},
    {from: 1, to: 2},
    {from: 2, to: 3},
  ];
  const lane = (ox: number) => (
    <div style={{position: 'absolute', left: ox, top: 0, width: laneW, height: 320}}>
      {/* 连线（下层） */}
      <svg width={laneW} height={320} viewBox={`0 0 ${laneW} 320`} style={{position: 'absolute', inset: 0}}>
        {edges3.map((e, i) => {
          const a = nodes4[e.from];
          const b = nodes4[e.to];
          const x1 = a.x + cardW;
          const y1 = a.y + cardH / 2;
          const x2 = b.x;
          const y2 = b.y + cardH / 2;
          const midX = (x1 + x2) / 2;
          const d = `M ${x1} ${y1} Q ${midX} ${(y1 + y2) / 2 + (e.from === 1 ? 30 : -20)} ${x2} ${y2}`;
          const isDangle = e.from === 0 && dangle > 0.02;
          return (
            <g key={`edge${i}`}>
              <path d={d} fill="none" stroke={isDangle ? withAlphaM(theme.danger, 0.6) : withAlphaM(theme.unlock, 0.6)} strokeWidth={3} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - (isDangle ? 0.55 : edges)} opacity={isDangle ? clamp01v(dangle) : 1} />
              {isDangle ? <text x={midX + 14} y={(y1 + y2) / 2 - 6} fontFamily={theme.mono} fontSize={22} fontWeight={700} fill={theme.danger} opacity={clamp01v(dangle)}>{'?'}</text> : null}
              {/* 校验绿点（每条边过一遍关卡——checkP 逐条） */}
              {checkP > i ? (
                <circle cx={midX} cy={(y1 + y2) / 2 + (e.from === 1 ? 15 : -10)} r={8} fill={theme.ok} opacity={clamp01v(checkP - i)} />
              ) : null}
            </g>
          );
        })}
      </svg>
      {/* 四小卡（上层——A..D 带编号签） */}
      {nodes4.map((n, i) => {
        const p = Math.max(nodes, i === 3 ? left : left * 0.92);
        return (
          <div
            key={n.id}
            style={{
              position: 'absolute',
              left: n.x,
              top: n.y,
              width: cardW,
              height: cardH,
              borderRadius: 9,
              border: `2.5px solid ${withAlphaM(theme.mech, 0.8)}`,
              background: withAlphaM(theme.panel, 0.96),
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 12px',
              opacity: clamp01v(p) * (i === 3 ? 1 : 1),
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.mech, whiteSpace: 'nowrap'}}>{`00${i + 1}`}</span>
            <span style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{n.id}</span>
          </div>
        );
      })}
      {/* 「契约」印章（只盖右轨——rotate + scale 落章） */}
      {stamp > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: laneW / 2 - 62,
            top: 96,
            width: 124,
            height: 124,
            borderRadius: '50%',
            border: `4px solid ${theme.danger}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `rotate(${-14 + 4 * clamp01v(stamp)}deg) scale(${0.5 + 0.5 * clamp01v(stamp)})`,
            opacity: clamp01v(stamp) * 0.92,
            boxShadow: `0 0 ${20 * clamp01v(stamp)}px ${withAlphaM(theme.danger, 0.35)}`,
          }}
        >
          <span style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.danger, letterSpacing: 4, paddingLeft: 4, whiteSpace: 'nowrap'}}>{'契约'}</span>
        </div>
      ) : null}
    </div>
  );
  return (
    <div style={{position: 'absolute', left: x, top: y, width: laneW * 2 + 140, height: 560}}>
      {/* 轨道标题 */}
      <div style={{position: 'absolute', left: 0, top: -46, fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>{'一把梭'}</div>
      <div style={{position: 'absolute', left: laneW + 140, top: -46, fontFamily: theme.sans, fontSize: 22, fontWeight: 700, color: theme.mech, whiteSpace: 'nowrap'}}>{'两步走'}</div>
      {/* 左轨：一把梭（建卡同时写依赖——一次落笔：卡与连线同拍） */}
      {lane(0)}
      {/* 右轨：两步走（先四卡落位拿编号 → 再回头连边） */}
      {lane(laneW + 140)}
      {/* 轨间分隔虚线 */}
      <div style={{position: 'absolute', left: laneW + 70, top: -10, height: 340, borderLeft: `2.5px dashed ${withAlphaM(theme.dim, 0.5)}`}} />
      {/* 上方调用块（同一轮回答里的几个调用——互相背对：三块小面板各自视锥朝外） */}
      <div style={{position: 'absolute', left: 0, top: 360, width: laneW * 2 + 140, display: 'flex', justifyContent: 'center', gap: 70}}>
        {[0, 1, 2].map((i) => {
          const face = back > 0.3;
          const rot = [-24, 0, 24][i];
          return (
            <div key={`cb${i}`} style={{position: 'relative', transform: `rotate(${face ? rot : 0}deg) translateY(${face ? -8 : 0}px)`, transition: 'none'}}>
              <div
                style={{
                  width: 170,
                  height: 74,
                  borderRadius: 9,
                  border: `2.5px solid ${withAlphaM(theme.tool, 0.75)}`,
                  background: withAlphaM(theme.panel, 0.95),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.tool, whiteSpace: 'nowrap'}}>{`调用 ${i + 1}`}</span>
              </div>
              {/* 视锥扇形（背对时朝外——互相看不见的遮断示意） */}
              <svg width={170} height={40} viewBox="0 0 170 40" style={{position: 'absolute', left: 0, top: face ? (rot === 0 ? -40 : rot < 0 ? -30 : -30) : 30, transform: `rotate(${face ? 0 : 180}deg)`, opacity: 0.5 + 0.4 * back}}>
                <path d={`M 85 40 L 30 4 A 62 62 0 0 1 140 4 Z`} fill={withAlphaM(theme.tool, 0.16)} stroke={withAlphaM(theme.tool, 0.5)} strokeWidth={1.8} />
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 规格签钉入（0-C——三枚关键词签随墙亮起同拍逐枚钉入，服务完本拍即撤）。
 *  `pins` 签文案（关键词签非整句）；`pinP` 0..n 逐枚钉入；`outP` 整组退役 */
export const SpecPin: React.FC<{pins: string[]; pinP?: number; outP?: number; y?: number}> = ({pins, pinP = 0, outP = 0, y = 210}) => {
  const out = clamp01v(outP);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', gap: 28, opacity: 1 - out}}>
      {pins.map((p, i) => {
        const pin = clamp01v(pinP - i);
        return (
          <div key={p} style={{position: 'relative', opacity: pin, transform: `translateY(${(1 - pin) * -26}px)`}}>
            <div
              style={{
                padding: '10px 26px',
                borderRadius: 10,
                border: `3px solid ${withAlphaM(theme.text, 0.75)}`,
                background: theme.panel,
                fontFamily: theme.sans,
                fontSize: 25,
                fontWeight: 700,
                color: theme.text,
                letterSpacing: 2,
                whiteSpace: 'nowrap',
                boxShadow: pin > 0.9 ? `0 0 ${12 * pin}px ${withAlphaM(theme.text, 0.25)}` : 'none',
              }}
            >
              {p}
            </div>
            {/* 钉（签顶两枚图钉——钉入语义） */}
            <span style={{position: 'absolute', left: 14, top: -7, width: 10, height: 10, borderRadius: '50%', background: withAlphaM(theme.dim, 0.9)}} />
            <span style={{position: 'absolute', right: 14, top: -7, width: 10, height: 10, borderRadius: '50%', background: withAlphaM(theme.dim, 0.9)}} />
          </div>
        );
      })}
    </div>
  );
};
