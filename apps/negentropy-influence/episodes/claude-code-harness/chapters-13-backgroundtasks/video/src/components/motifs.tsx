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
// references/08 母题表出处 = 本系列 ep1 chapters-01-loop、经 ep2–ep12 延续——
// LoopRing 描边色/线宽跨集恒定（theme.core = 陶土橙 #D97757 + RING_STROKE 6）
// = 逐字节拷贝的前提；本集环上「执行」段是被「等待」砖压停/解放的时点段
// （RingExecSeg / WaitBrick 承载压停语义，均不改描边契约）

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
 * 全片恒定的环形循环（〔M-001〕：恒色恒线宽，全片多次同形出场）——ep12 逐字节
 * 拷贝（本集场景一律 `nodes={[]}`：环体即循环本体，无站点标注态；「执行」段
 * 标记走 RingExecSeg 叠加层，dotProgress 由场景喂匀速/冻结公式）。
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
 *  环外挂件（等待砖 / 执行段标记）的场景侧共用工式 */
export const ringPt = polar;

// ─────────────────────────────────────────────── 本集 bespoke 装置（ep13 Background Tasks）
// storyboard 实现映射登记：RegistryTable / DualGateRig / KeywordScanner /
// BackgroundTrack / TaskNotificationCard / PlaceholderReceipt / BlockingBar /
// TimeoutCard ＋ 环体契约件 RingExecSeg / WaitBrick / 协议单槽件 ProtocolCard。
// 全片主装置 = 登记表（mech 雾蓝：三列 编号/状态/摘要 + bg_0001 行生长/点亮成
// 通知卡/超时态状态机）+ 后台线程轨（mech，承 1-D 右轨同形）；通知注入走
// notify 兰紫（独立通知卡 + 合入消息事件）；环体压停/解放走 core 陶土橙 +
// WaitBrick 灰黑砖（0-A 压停 / 1-D 左轨回扣 / 5-B 残影碎散——同形生命周期）；
// 反例/退化走 danger（消融左轨 / 超时帧 / 违规红叉 / 补写箭头掐断）；机制在位/
// 拦截成功走 ok（兜底在位右轨 / 同框兑现 / durable 拾起——生产版转后台帧不在
// 绿语义清单，走雾蓝）。哑装置原则承 ep4–ep12：动效参数（进度/状态/读数）一律
// 经 prop 由调用场景注入，装置自身零 motion hook 调用（map/条件内纯函数推进）。

const clamp01v = (v: number) => Math.min(1, Math.max(0, v));

const withAlphaM = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01v(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 双 hex 线性插值（雾蓝→兰紫身份交接 / 压暗描边的 morph；t 走场景 progress——
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

/** 走查舞台全局位（2-A 首亮 / 3-A、4-A 开帧余位坐标锚共用——跨镜同位即 continuity）：
 *  环体缩悬顶角（解放态）· 登记表中央 · 后台线程轨横带 · 模型侧右缘 */
export const STAGE = {
  ring: {x: 110, y: 96, size: 280},
  registry: {x: 560, y: 216, w: 600, h: 300},
  track: {x: 300, y: 636, w: 1120},
  model: {x: 1560, y: 400},
} as const;

/** 环「执行」段标记（叠加在与 LoopRing 同位同尺寸的容器内——底部扇区弧段，
 *  angle 55°..125°（执行工具位 ±35°）。`segP` 弧段显形；`pressP` 被压停的加重
 *  （压停契约时点段：0-A 落砖时点亮 / 5-B 畅通态淡出）；`ghostP` 残影态（5-B
 *  碎散前）；`freeP` 解放态微光（P2 起贯穿）。描边色恒 core、线宽恒 RING_STROKE
 *  ——不改环契约，只是环上时点段的读法层 */
export const RingExecSeg: React.FC<{
  size: number;
  segP?: number;
  pressP?: number;
  ghostP?: number;
  freeP?: number;
  labelP?: number;
}> = ({size, segP = 1, pressP = 0, ghostP = 0, freeP = 0, labelP = 0}) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 46;
  const a0 = (55 * Math.PI) / 180;
  const a1 = (125 * Math.PI) / 180;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const largeArc = 0;
  const d = `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1}`;
  const press = clamp01v(pressP);
  const ghost = clamp01v(ghostP);
  const free = clamp01v(freeP);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none'}}>
      {/* 执行段弧（压停加重 → 解放微光 → 残影，三态互斥由调用侧喂值；描边恒 core）。
          ⑨ QA W3：去掉压停态 +3px 加厚——线宽恒 RING_STROKE=6 全片不变（环体契约），
          压停加重语义由透明度档与等待砖投影承载 */}
      <path
        d={d}
        fill="none"
        stroke={theme.core}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        opacity={clamp01v(segP) * Math.max(0.5 * press + 0.5 * ghost, 0.28 + 0.5 * free, 0.22)}
        strokeDasharray={ghost > 0.05 ? '14 10' : undefined}
      />
      {labelP > 0.02 ? (
        <text
          x={cx}
          y={cy + r + 34}
          textAnchor="middle"
          fontFamily={theme.sans}
          fontSize={Math.max(17, Math.round(size * 0.075))}
          fontWeight={700}
          fill={theme.text}
          opacity={clamp01v(labelP)}
        >
          执行
        </text>
      ) : null}
    </svg>
  );
};

/** 「等待」砖（灰黑砖——环体压停/解放契约件：0-A 落下压停 / 0-B/0-C 驻 / 1-D
 *  左轨缩微回扣 ↔ 右轨清走 / 5-B 残影碎散消隐）。`dropP` 自上方落下（末态 =
 *  压在执行段正上）；`clearP` 侧向清走（右轨解放）；`crumbleP` 碎散（残影消隐，
 *  8 枚确定性碎块 + 淡出）；`mini` 缩微形态（1-D 轨内 ~0.5 档） */
export const WaitBrick: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  dropP?: number;
  clearP?: number;
  crumbleP?: number;
  litP?: number;
  mini?: boolean;
}> = ({x, y, w = 168, h = 56, dropP = 1, clearP = 0, crumbleP = 0, litP = 1, mini = false}) => {
  const drop = clamp01v(dropP);
  const clear = clamp01v(clearP);
  const crumble = clamp01v(crumbleP);
  const dropDist = mini ? 90 : 240;
  const frags = 8;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: clamp01v(litP) * (1 - 0.9 * crumble), pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: mini ? 5 : 9,
          background: '#20242E',
          border: `${mini ? 2 : 3}px solid ${withAlphaM(theme.dim, 0.85)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translateY(${(1 - drop) * -dropDist}px) translateX(${clear * (w + 60)}px) rotate(${clear * 8}deg)`,
          opacity: 1 - clear,
          boxShadow: drop > 0.95 ? `0 ${mini ? 4 : 8}px 0 ${withAlphaM('#000000', 0.45)}` : 'none',
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: mini ? 14 : 22, fontWeight: 700, color: theme.dim, letterSpacing: 2, whiteSpace: 'nowrap'}}>等待</span>
      </div>
      {/* 碎散残块（5-B 消隐——确定性扇出，禁随机） */}
      {crumble > 0.02
        ? Array.from({length: frags}, (_, i) => {
            const cp = clamp01v((crumble - i * 0.04) / 0.8);
            const ang = (i / frags) * Math.PI * 2;
            return (
              <span
                key={`cf${i}`}
                style={{
                  position: 'absolute',
                  left: w / 2 + Math.cos(ang) * cp * (60 + i * 12),
                  top: h / 2 + Math.sin(ang) * cp * (40 + i * 9) - cp * 30,
                  width: mini ? 6 : 12,
                  height: mini ? 4 : 8,
                  borderRadius: 2,
                  background: withAlphaM(theme.dim, 0.7 * (1 - cp)),
                  transform: `rotate(${i * 47 + cp * 90}deg)`,
                }}
              />
            );
          })
        : null}
    </div>
  );
};

/** 对话协议卡（0-C 悬念态 ↔ 1-A 急推展开态——morph 同主体：卡轮廓 + 「一次调用
 *  → 一个结果」通道形恒在，槽位暗态轮廓 → 单槽展开由 slotP 连续推进）。
 *  `litP` 入场；`slotP` 0=暗态轮廓 1=实体单槽（虚→实 + 高亮）；`connectP` 调用块
 *  与单槽连线（一对一配对契约）；`branchP` 槽右侧双岔路显形（上路等它跑完/下路
 *  先回再补）；`timerP` 上路计时器膨胀（撑满岔口=堵死）；`xP` 下路红 ✗（违规）；
 *  `sinkP` 整卡下沉一格（p0-07 规矩拦路）；`ghostOutP`/`ghostBackP` 理想态虚影
 *  箭头一闪（0-C 专用，一闪即收由调用侧 sin(πp) 喂值） */
export const ProtocolCard: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  litP?: number;
  slotP?: number;
  connectP?: number;
  branchP?: number;
  timerP?: number;
  xP?: number;
  sinkP?: number;
  ghostOutP?: number;
  ghostBackP?: number;
}> = ({x, y, w, h, litP = 1, slotP = 0, connectP = 0, branchP = 0, timerP = 0, xP = 0, sinkP = 0, ghostOutP = 0, ghostBackP = 0}) => {
  const lit = clamp01v(litP);
  const slot = clamp01v(slotP);
  const connect = clamp01v(connectP);
  const branch = clamp01v(branchP);
  const timer = clamp01v(timerP);
  const xx = clamp01v(xP);
  const sink = clamp01v(sinkP);
  const solid = slot > 0.5;
  const headH = Math.round(h * 0.24);
  const callW = Math.round(w * 0.3);
  const slotW = Math.round(w * 0.24);
  const slotH = Math.round(h * 0.44);
  const midY = headH + Math.round((h - headH) / 2.6);
  return (
    <div style={{position: 'absolute', left: x, top: y + sink * 30, width: w, height: h, opacity: lit}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: `3.5px solid ${withAlphaM(theme.text, 0.55 + 0.25 * slot)}`,
          background: withAlphaM(theme.panel, 0.96),
          boxShadow: sink > 0.5 ? `0 6px 0 ${withAlphaM(theme.panelBorder, 0.8)}` : 'none',
        }}
      >
        {/* 卡头：对话协议 · 一次调用 → 一个结果（通道形——morph 身份线索恒在） */}
        <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: `${Math.round(h * 0.06)}px ${Math.round(w * 0.05)}px 0`}}>
          <span style={{fontFamily: theme.mono, fontSize: Math.max(13, Math.round(w * 0.032)), color: theme.dim, letterSpacing: 2, whiteSpace: 'nowrap'}}>{'对话协议'}</span>
          <span style={{fontFamily: theme.sans, fontSize: Math.max(15, Math.round(w * 0.04)), fontWeight: 600, color: theme.dim, whiteSpace: 'nowrap'}}>{'一次调用 → 一个结果'}</span>
        </div>
        {/* 通道行：调用块 → 连线 → 单槽（+ 岔路在槽右侧） */}
        <div style={{position: 'absolute', left: Math.round(w * 0.06), top: midY, width: w - Math.round(w * 0.12), height: slotH + 24}}>
          <svg width={w - Math.round(w * 0.1)} height={slotH + 24} viewBox={`0 0 ${w - Math.round(w * 0.1)} ${slotH + 24}`} style={{overflow: 'visible'}}>
            {/* 连线（一对一配对契约——connectP 描线） */}
            <line
              x1={callW + 14}
              y1={(slotH + 24) / 2}
              x2={callW + 14 + (w * 0.14) * connect}
              y2={(slotH + 24) / 2}
              stroke={withAlphaM(theme.text, 0.85)}
              strokeWidth={4}
              strokeLinecap="round"
            />
            {/* 理想态虚影箭头（0-C 一闪即收——上：慢命令飞出 / 下：结果回流）。
                ⑨ QA W2：飞出（发出侧）改雾蓝——与「雾蓝=发出/兰紫=回注」双色轴及
                后台轨授色一致；确认绿不在枚举内（下侧回流箭头保持兰紫） */}
            {ghostOutP > 0.02 ? (
              <g opacity={clamp01v(ghostOutP)}>
                <path d={`M ${w * 0.5} ${(slotH + 24) / 2 - 20} Q ${w * 0.62} ${(slotH + 24) / 2 - 90} ${w * 0.82} ${(slotH + 24) / 2 - 34}`} fill="none" stroke={withAlphaM(theme.mech, 0.85)} strokeWidth={4} strokeDasharray="10 8" strokeLinecap="round" />
                <path d={`M ${w * 0.82 - 12} ${(slotH + 24) / 2 - 44} L ${w * 0.82} ${(slotH + 24) / 2 - 34} L ${w * 0.82 - 14} ${(slotH + 24) / 2 - 26}`} fill="none" stroke={withAlphaM(theme.mech, 0.85)} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            ) : null}
            {ghostBackP > 0.02 ? (
              <g opacity={clamp01v(ghostBackP)}>
                <path d={`M ${w * 0.82} ${(slotH + 24) / 2 + 30} Q ${w * 0.62} ${(slotH + 24) / 2 + 96} ${w * 0.5} ${(slotH + 24) / 2 + 36}`} fill="none" stroke={withAlphaM(theme.notify, 0.9)} strokeWidth={4} strokeDasharray="10 8" strokeLinecap="round" />
                <path d={`M ${w * 0.5 + 14} ${(slotH + 24) / 2 + 44} L ${w * 0.5} ${(slotH + 24) / 2 + 36} L ${w * 0.5 + 12} ${(slotH + 24) / 2 + 26}`} fill="none" stroke={withAlphaM(theme.notify, 0.9)} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            ) : null}
          </svg>
          {/* 调用块（角标 tool_use——一次调用的具象） */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 12,
              width: callW,
              height: slotH,
              borderRadius: 9,
              border: `3px solid ${withAlphaM(theme.tool, 0.85)}`,
              background: withAlphaM(theme.panel, 0.98),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              opacity: 0.35 + 0.65 * slot,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: Math.max(14, Math.round(w * 0.045)), fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'调用块'}</span>
            <span style={{fontFamily: theme.mono, fontSize: Math.max(10, Math.round(w * 0.028)), color: theme.dim, whiteSpace: 'nowrap'}}>{'tool_use'}</span>
          </div>
          {/* 单结果槽位（暗态虚线轮廓 → 实体单槽——名额只有一个） */}
          <div
            style={{
              position: 'absolute',
              left: callW + 14 + w * 0.14,
              top: 12,
              width: slotW,
              height: slotH,
              borderRadius: 9,
              border: `3px ${solid ? 'solid' : 'dashed'} ${solid ? theme.text : withAlphaM(theme.dim, 0.9)}`,
              background: solid ? withAlphaM(theme.text, 0.14) : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              boxShadow: solid ? `0 0 ${16 * slot}px ${withAlphaM(theme.text, 0.3)}` : 'none',
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: Math.max(13, Math.round(w * 0.04)), fontWeight: 700, color: solid ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>{'结果'}</span>
            <span style={{fontFamily: theme.mono, fontSize: Math.max(9, Math.round(w * 0.026)), color: theme.dim, whiteSpace: 'nowrap'}}>{'tool_result'}</span>
          </div>
          {/* 双岔路（槽右侧——branchP 显形；上路计时器膨胀堵死 / 下路红 ✗） */}
          {branch > 0.02 ? (
            <div style={{position: 'absolute', left: callW + 14 + w * 0.14 + slotW + 24, top: -8, width: Math.max(160, w * 0.34), height: slotH + 40, opacity: branch}}>
              {/* 上路：等它跑完（计时器——timerP 膨胀到撑满岔口） */}
              <div style={{position: 'absolute', left: 0, top: 0, display: 'flex', alignItems: 'center', gap: 8}}>
                <svg width={26} height={12} viewBox="0 0 26 12">
                  <path d="M 2 6 L 16 6" stroke={withAlphaM(theme.dim, 0.8)} strokeWidth={2.4} strokeLinecap="round" />
                  <path d="M 14 2 L 20 6 L 14 10" fill="none" stroke={withAlphaM(theme.dim, 0.8)} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{fontFamily: theme.sans, fontSize: Math.max(12, Math.round(w * 0.034)), color: theme.dim, whiteSpace: 'nowrap'}}>{'等它跑完'}</span>
                {/* 计时器（膨胀=堵死通道——宽度上限撑满岔路盒、不出卡右缘） */}
                <div
                  style={{
                    width: 18 + timer * 76,
                    height: 18 + timer * 22,
                    borderRadius: 9,
                    background: withAlphaM(theme.dim, 0.25 + 0.45 * timer),
                    border: `2.5px solid ${timer > 0.5 ? withAlphaM(theme.danger, 0.85) : withAlphaM(theme.dim, 0.7)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 6,
                  }}
                >
                  <span style={{fontFamily: theme.mono, fontSize: Math.max(10, Math.round(w * 0.028)), color: timer > 0.5 ? theme.danger : theme.dim, whiteSpace: 'nowrap', opacity: timer}}>{'600s'}</span>
                </div>
              </div>
              {/* 下路：先回再补（补写箭头 + 红 ✗——违规） */}
              <div style={{position: 'absolute', left: 0, top: slotH + 4, display: 'flex', alignItems: 'center', gap: 8}}>
                <svg width={26} height={12} viewBox="0 0 26 12">
                  <path d="M 2 6 L 16 6" stroke={withAlphaM(theme.dim, 0.8)} strokeWidth={2.4} strokeLinecap="round" />
                  <path d="M 14 2 L 20 6 L 14 10" fill="none" stroke={withAlphaM(theme.dim, 0.8)} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{fontFamily: theme.sans, fontSize: Math.max(12, Math.round(w * 0.034)), color: theme.dim, whiteSpace: 'nowrap'}}>{'先回再补'}</span>
                {/* 补写箭头（旧账补写——被红 ✗ 盖上） */}
                <svg width={30} height={16} viewBox="0 0 30 16" style={{overflow: 'visible'}}>
                  <path d="M 2 12 Q 15 2 26 8" fill="none" stroke={withAlphaM(theme.dim, 0.7)} strokeWidth={2.4} strokeDasharray="5 4" />
                  {xx > 0.02 ? (
                    <g opacity={xx} transform={`scale(${0.7 + 0.3 * xx})`} style={{transformOrigin: '22px 8px'}}>
                      <line x1={18} y1={0} x2={30} y2={14} stroke={theme.danger} strokeWidth={4} strokeLinecap="round" />
                      <line x1={30} y1={0} x2={18} y2={14} stroke={theme.danger} strokeWidth={4} strokeLinecap="round" />
                    </g>
                  ) : null}
                </svg>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

/** 双闸门分派装置（1-B 首亮——判定次序可追：命令入口 → 闸门①看参数 → 闸门②
 *  翻文本 → 门后岔路）。`litP` 装置入场；`gate1P`/`gate2P` 双门先后立起（stagger
 *  由调用侧喂）；`bgRailP` 后台轨雾蓝轮廓显形（同步轨恒在）；`paramP` 命令卡翻出
 *  参数签；`readP` 门①读卡位扫过（读卡光带）；`greenP` 门①确认绿放行灯；
 *  `passT` 命令卡穿门滑向后台轨（0..1 位移）；`scanP` 门②扫描位亮起（待扫——
 *  词级扫描在 1-C KeywordScanner） */
export const DualGateRig: React.FC<{
  x: number;
  y: number;
  w?: number;
  litP?: number;
  gate1P?: number;
  gate2P?: number;
  bgRailP?: number;
  paramP?: number;
  readP?: number;
  greenP?: number;
  passT?: number;
  scanP?: number;
}> = ({x, y, w = 1400, litP = 1, gate1P = 0, gate2P = 0, bgRailP = 0, paramP = 0, readP = 0, greenP = 0, passT = 0, scanP = 0}) => {
  const lit = clamp01v(litP);
  const g1 = clamp01v(gate1P);
  const g2 = clamp01v(gate2P);
  const bgRail = clamp01v(bgRailP);
  const param = clamp01v(paramP);
  const read = clamp01v(readP);
  const green = clamp01v(greenP);
  const pass = clamp01v(passT);
  const scan = clamp01v(scanP);
  // 局部几何：入口卡（左）→ 门① → 门② → 门后岔路（同步轨上 / 后台轨下）
  const entryX = 0;
  const entryW = 280;
  const gate1X = 430;
  const gate2X = 800;
  const gateW = 230;
  const postH = 150;
  const railX = gate2X + gateW + 40;
  const railW = w - railX;
  const syncY = -60;
  const bgY = 70;
  /** 单门立柱对（读卡位/扫描位随门型） */
  const gate = (gx: number, p: number, kind: 'param' | 'text') => (
    <div style={{position: 'absolute', left: gx, top: 0, width: gateW, opacity: 0.25 + 0.75 * p}}>
      <svg width={gateW} height={postH + 26} viewBox={`0 0 ${gateW} ${postH + 26}`} style={{overflow: 'visible'}}>
        {/* 两立柱 */}
        <line x1={10} y1={postH} x2={10} y2={10} stroke={withAlphaM(theme.dim, 0.9)} strokeWidth={6} strokeLinecap="round" />
        <line x1={gateW - 10} y1={postH} x2={gateW - 10} y2={10} stroke={withAlphaM(theme.dim, 0.9)} strokeWidth={6} strokeLinecap="round" />
        {/* 门楣 + 门名签 */}
        <line x1={10} y1={10} x2={gateW - 10} y2={10} stroke={withAlphaM(theme.dim, 0.55)} strokeWidth={3} />
        {/* 读卡位（门①——参数签插入读取的水平槽）/ 扫描位（门②——竖向扫描灯带轮廓） */}
        {kind === 'param' ? (
          <>
            <rect x={34} y={postH / 2 - 12} width={gateW - 68} height={24} rx={7} fill={withAlphaM(theme.panel, 0.98)} stroke={read > 0.05 ? theme.ok : withAlphaM(theme.dim, 0.8)} strokeWidth={2.5} />
            {/* 读卡光带（readP 扫过——确认绿） */}
            {read > 0.02 ? (
              <rect x={34 + (gateW - 84) * read} y={postH / 2 - 16} width={16} height={32} rx={4} fill={withAlphaM(theme.ok, 0.55)} />
            ) : null}
          </>
        ) : (
          <rect x={gateW / 2 - 14} y={26} width={28} height={postH - 46} rx={8} fill="none" stroke={scan > 0.05 ? theme.mech : withAlphaM(theme.dim, 0.75)} strokeWidth={2.5} strokeDasharray={scan > 0.4 ? undefined : '7 6'} opacity={0.5 + 0.5 * scan} />
        )}
        {/* 放行灯（门①专用——greenP 亮） */}
        {kind === 'param' && green > 0.02 ? (
          <g opacity={green}>
            <circle cx={gateW / 2} cy={postH + 12} r={12} fill={theme.ok} />
            <circle cx={gateW / 2} cy={postH + 12} r={19} fill="none" stroke={withAlphaM(theme.ok, 0.5)} strokeWidth={3} />
          </g>
        ) : null}
      </svg>
      {/* 门名签（①看参数 / ②翻文本——次序=口播） */}
      <div style={{position: 'absolute', left: 0, top: -40, width: gateW, textAlign: 'center', fontFamily: theme.sans, fontSize: 21, fontWeight: 700, color: p > 0.5 ? theme.text : theme.dim, whiteSpace: 'nowrap'}}>
        {kind === 'param' ? '① 看参数' : '② 翻文本'}
      </div>
    </div>
  );
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: 300, opacity: lit}}>
      {/* 门后岔路：同步轨（灰·默认路径，非惩罚态） / 后台轨（雾蓝空置待通） */}
      <svg width={w} height={220} viewBox={`0 0 ${w} 220`} style={{position: 'absolute', left: 0, top: syncY + 60}}>
        <line x1={railX} y1={syncY + 60 + 40} x2={w} y2={syncY + 60 + 40} stroke={withAlphaM(theme.dim, 0.5)} strokeWidth={5} strokeLinecap="round" />
        <line x1={railX} y1={syncY + 60 + 170} x2={w} y2={syncY + 60 + 170} stroke={withAlphaM(theme.mech, 0.25 + 0.65 * bgRail)} strokeWidth={bgRail > 0.5 ? 6.5 : 5} strokeLinecap="round" strokeDasharray={bgRail > 0.5 ? undefined : '14 10'} />
      </svg>
      {/* 轨名签 */}
      <div style={{position: 'absolute', left: railX + 8, top: syncY + 88, fontFamily: theme.sans, fontSize: 17, color: theme.dim, whiteSpace: 'nowrap'}}>{'同步执行'}</div>
      <div style={{position: 'absolute', left: railX + 8, top: syncY + 218, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: bgRail > 0.4 ? theme.mech : theme.dim, whiteSpace: 'nowrap', opacity: 0.45 + 0.55 * bgRail}}>{'后台执行'}</div>
      {/* 双门（①在前②在后——次序=口播） */}
      {gate(gate1X, g1, 'param')}
      {gate(gate2X, g2, 'text')}
      {/* 命令入口卡（npm install 同签待判定——paramP 翻出参数签；passT 穿门滑走） */}
      <div
        style={{
          position: 'absolute',
          left: entryX + pass * (railX - entryX + 30),
          top: 38,
          width: entryW,
          height: 120,
          borderRadius: 11,
          border: `3px solid ${param > 0.5 ? withAlphaM(theme.mech, 0.8) : withAlphaM(theme.panelBorder, 0.95)}`,
          background: withAlphaM(theme.panel, 0.97),
          padding: '12px 16px',
          opacity: 1 - clamp01v(pass * 1.4 - 0.4),
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.text, whiteSpace: 'nowrap'}}>{'$ npm install'}</div>
        <div style={{fontFamily: theme.sans, fontSize: 15, color: theme.dim, marginTop: 6, whiteSpace: 'nowrap'}}>{'安装命令 · 待判定'}</div>
        {/* 参数签（run_in_background——paramP 翻出） */}
        {param > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              right: -24,
              top: -22,
              padding: '4px 12px',
              borderRadius: 7,
              border: `2.5px solid ${theme.mech}`,
              background: theme.panel,
              fontFamily: theme.mono,
              fontSize: 13,
              fontWeight: 700,
              color: theme.mech,
              whiteSpace: 'nowrap',
              opacity: param,
              transform: `translateY(${(1 - param) * -10}px)`,
            }}
          >
            {'run_in_background'}
          </div>
        ) : null}
      </div>
      {/* 穿门滑行的命令卡残影（passT 后半程——落到后台轨上的同签卡） */}
      {pass > 0.4 ? (
        <div
          style={{
            position: 'absolute',
            left: railX + 20 + (pass - 0.4) * 60,
            top: syncY + 176,
            padding: '6px 14px',
            borderRadius: 8,
            border: `2.5px solid ${theme.mech}`,
            background: withAlphaM(theme.panel, 0.97),
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.mech,
            whiteSpace: 'nowrap',
            opacity: clamp01v(pass * 2 - 0.8),
          }}
        >
          {'npm install'}
        </div>
      ) : null}
    </div>
  );
};

/** 关键词扫描灯带（1-C ECU——命令文本条满幅，扫描灯带自左向右**单向**扫过）。
 *  `bandT` 灯带位置 0..1（恒速由调用侧线性喂——扫描单向不回头）；`hits` 命中词
 *  列表（各带点亮 p 与横位 fx 0..1）；`noTagP` 「不要后台」小签显形；
 *  `noTagDimP` 小签暗角化（无视的可核对判据：灯带径直穿过、不减速不停留——
 *  恒速由构造保证）；`blueP` 命令文本条整体转雾蓝（判为慢操作）；`outP` 穿门
 *  滑入后台轨的收尾位移 */
export const KeywordScanner: React.FC<{
  x: number;
  y: number;
  w: number;
  h?: number;
  bandT?: number;
  hits?: {t: string; fx: number; p: number}[];
  noTagP?: number;
  noTagDimP?: number;
  blueP?: number;
  outP?: number;
}> = ({x, y, w, h = 210, bandT = 0, hits = [], noTagP = 0, noTagDimP = 0, blueP = 0, outP = 0}) => {
  const band = clamp01v(bandT);
  const blue = clamp01v(blueP);
  const out = clamp01v(outP);
  const noTag = clamp01v(noTagP);
  const noDim = clamp01v(noTagDimP);
  const barH = 96;
  const edge = mixHex(withAlphaM(theme.panelBorder, 1), theme.mech, blue);
  return (
    <div style={{position: 'absolute', left: x - out * 260, top: y, width: w, height: h, opacity: 1 - 0.55 * out, transform: `scale(${1 - 0.12 * out})`, transformOrigin: '70% 50%'}}>
      {/* 命令文本条（角标 npm install——转雾蓝随 blueP） */}
      <div style={{position: 'relative', width: w, height: barH, borderRadius: 12, border: `3.5px solid ${edge}`, background: withAlphaM(theme.panel, 0.97), overflow: 'hidden'}}>
        {/* 文本 token 行（$ npm install ——命中词为中文词窗示范位） */}
        <div style={{display: 'flex', alignItems: 'center', gap: 26, padding: '0 34px', height: barH}}>
          <span style={{fontFamily: theme.mono, fontSize: 30, color: blue > 0.4 ? theme.mech : theme.text, whiteSpace: 'nowrap'}}>{'$ npm install'}</span>
          {hits.map((hit) => {
            const p = clamp01v(hit.p);
            return (
              <span
                key={hit.t}
                style={{
                  fontFamily: theme.sans,
                  fontSize: 27,
                  fontWeight: 700,
                  color: p > 0.35 ? theme.mech : theme.dim,
                  whiteSpace: 'nowrap',
                  padding: '2px 10px',
                  borderRadius: 6,
                  background: p > 0.35 ? withAlphaM(theme.mech, 0.16) : 'transparent',
                  boxShadow: p > 0.85 ? `0 0 10px ${withAlphaM(theme.mech, 0.4)}` : 'none',
                  opacity: 0.45 + 0.55 * p,
                }}
              >
                {hit.t}
              </span>
            );
          })}
        </div>
        {/* 扫描灯带（竖向亮带——bandT 恒速单向；越过命中词即点亮由调用侧算 p） */}
        {band > 0.01 && band < 0.995 ? (
          <div
            style={{
              position: 'absolute',
              left: band * w - 14,
              top: 0,
              bottom: 0,
              width: 28,
              background: `linear-gradient(180deg, ${withAlphaM(theme.mech, 0.1)}, ${withAlphaM(theme.mech, 0.42)}, ${withAlphaM(theme.mech, 0.1)})`,
              borderLeft: `2px solid ${withAlphaM(theme.mech, 0.7)}`,
              borderRight: `2px solid ${withAlphaM(theme.mech, 0.7)}`,
            }}
          />
        ) : null}
      </div>
      {/* 命中词位标（条下刻度——词在条上的横位锚，读法辅助） */}
      {hits.map((hit) => (
        <div key={`tick${hit.t}`} style={{position: 'absolute', left: hit.fx * w - 1, top: barH + 10, width: 2, height: 12, background: withAlphaM(theme.dim, 0.7)}} />
      ))}
      {/* 显式「不要后台」小签（卡角——灯带径直穿过、不停留；随后暗角化定格）。
          ⑨ QA W1：top -46→-26 使签底边压进命令条上缘数像素——扫描灯带（裁剪在
          条内）得以从签身上横穿，「从签下方掠过」恢复为「径直穿过」（恒速/不
          读取/不拦截三硬约束不动） */}
      {noTag > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            right: 30,
            top: -26,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 14px',
            borderRadius: 8,
            border: `2.5px solid ${noDim > 0.4 ? withAlphaM(theme.dim, 0.5) : withAlphaM(theme.text, 0.7)}`,
            background: theme.panel,
            opacity: noTag * (1 - 0.55 * noDim),
            transform: `scale(${1 - 0.1 * noDim})`,
            transformOrigin: '100% 0%',
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: noDim > 0.4 ? theme.dim : theme.text, whiteSpace: 'nowrap'}}>{'不要后台'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 11, color: theme.dim, whiteSpace: 'nowrap'}}>{'should_run_background=false'}</span>
        </div>
      ) : null}
    </div>
  );
};

/** 阻塞时长条（1-D 消融 / 4-D 回闪——基线标尺恒驻：0 与 600 双刻度 + 数字读数）。
 *  `fillP` 填充 0..1（数据本体：调用侧线性喂值、禁过冲）；`value` 读数（0..600，
 *  mono tabular）；`tone` 'danger'（阻塞增长/回闪）| 'ok'（恒 0 定格——机制在位）；
 *  `litP` 入场；`pulseP` 数字重跳一拍（4-D 回闪重音） */
export const BlockingBar: React.FC<{
  x: number;
  y: number;
  w?: number;
  fillP?: number;
  value?: number;
  tone?: 'danger' | 'ok';
  litP?: number;
  pulseP?: number;
}> = ({x, y, w = 640, fillP = 0, value = 0, tone = 'danger', litP = 1, pulseP = 0}) => {
  const lit = clamp01v(litP);
  const fill = clamp01v(fillP);
  const v = Math.round(Math.min(600, Math.max(0, value)));
  const pulse = clamp01v(pulseP);
  const on = tone === 'danger' ? theme.danger : theme.ok;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, opacity: lit}}>
      {/* 条体（0→600 填充——线性） */}
      <div style={{position: 'relative', height: 44, borderRadius: 9, border: `3px solid ${withAlphaM(on, 0.75)}`, background: withAlphaM(theme.panel, 0.92)}}>
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, borderRadius: 6, background: withAlphaM(on, 0.42)}} />
        {/* 读数（条心——mono tabular；pulseP 重跳一拍） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.mono,
            fontSize: 27,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: v > 0 ? on : theme.dim,
            transform: `scale(${1 + 0.16 * pulse})`,
            textShadow: pulse > 0.1 ? `0 0 ${16 * pulse}px ${withAlphaM(on, 0.6)}` : 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {`${v} s`}
        </div>
        {/* 600 上限刻度（基线标尺——恒驻） */}
        <div style={{position: 'absolute', right: 2, top: -8, bottom: -8, borderRight: `3px dashed ${withAlphaM(theme.dim, 0.85)}`}} />
      </div>
      {/* 双刻度标签 */}
      <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 17, color: theme.dim, marginTop: 6, whiteSpace: 'nowrap'}}>
        <span>{'0 s'}</span>
        <span>{'600 s'}</span>
      </div>
    </div>
  );
};

/** 登记表（主装置——对照表之于 ep2 的地位）。三列 编号/状态/摘要 恒定；`litP`
 *  空架首亮；`rowP` 首行落下（bg_0001 · 运行中）；`idText` 编号读数（count-up
 *  0000→0001 由调用侧喂字符串）；`state` 行状态机：'running'（运行中·mech）|
 *  'done'（完成·待收，doneP 行点亮抬升——表上一行→独立卡的出生预备）| 'timeout'
 *  （超时·danger 状态灯——4-A 教学版断的表上呈现）；`syncP` 缩微联动脉冲（2-B
 *  小票闭合同步）；`mini` 缩微形态（2-B/5-B 驻位）；`dimP` 压暗（4-A 余位/背景） */
export const RegistryTable: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  rowP?: number;
  idText?: string;
  state?: 'empty' | 'running' | 'done' | 'timeout';
  doneP?: number;
  syncP?: number;
  mini?: boolean;
  dimP?: number;
}> = ({x, y, w = 600, h = 300, litP = 1, rowP = 0, idText = 'bg_0001', state = 'empty', doneP = 0, syncP = 0, mini = false, dimP = 0}) => {
  const lit = clamp01v(litP);
  const row = clamp01v(rowP);
  const done = clamp01v(doneP);
  const sync = clamp01v(syncP);
  const dim = clamp01v(dimP);
  const cols = ['编号', '状态', '摘要'];
  const colW = [w * 0.34, w * 0.26, w * 0.4];
  const headH = mini ? 40 : 56;
  const rowH = mini ? 40 : 56;
  const stateTxt = state === 'running' ? '运行中' : state === 'done' ? '完成' : state === 'timeout' ? '超时' : '—';
  // ⑨ QA N1：done 行状态灯由 ok 改 notify——「行点亮成通知卡」的出生语义与
  // doneP 辉光同色（同对象双色杂消除）；确认绿枚举不含登记行完成态
  const stateColor = state === 'timeout' ? theme.danger : state === 'done' ? theme.notify : state === 'running' ? theme.mech : theme.dim;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: lit * (1 - 0.72 * dim)}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: `${mini ? 2.5 : 3.5}px solid ${withAlphaM(theme.mech, 0.55 + 0.3 * sync)}`,
          background: withAlphaM(theme.panel, 0.95),
          boxShadow: done > 0.5 ? `0 0 ${18 * done}px ${withAlphaM(theme.notify, 0.35)}` : sync > 0.3 ? `0 0 ${14 * sync}px ${withAlphaM(theme.mech, 0.4)}` : 'none',
        }}
      >
        {/* 表头：登记表 · registry（三列列名恒定） */}
        <div style={{display: 'flex', alignItems: 'center', height: headH, padding: `0 ${mini ? 12 : 18}px`, borderBottom: `2px solid ${withAlphaM(theme.panelBorder, 0.9)}`}}>
          <span style={{fontFamily: mini ? theme.mono : theme.sans, fontSize: mini ? 15 : 20, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{'登记表'}</span>
          <span style={{fontFamily: theme.mono, fontSize: mini ? 10 : 13, color: theme.dim, marginLeft: 10, whiteSpace: 'nowrap'}}>{'registry + lock'}</span>
        </div>
        {/* 列名行 */}
        <div style={{display: 'flex', height: mini ? 30 : 40, alignItems: 'center', padding: `0 ${mini ? 12 : 18}px`, borderBottom: `1.5px solid ${withAlphaM(theme.panelBorder, 0.7)}`}}>
          {cols.map((c, i) => (
            <span key={c} style={{width: colW[i], fontFamily: theme.sans, fontSize: mini ? 13 : 17, color: theme.dim, whiteSpace: 'nowrap'}}>
              {c}
            </span>
          ))}
        </div>
        {/* bg_0001 行（rowP 落下——行生长；doneP 点亮抬升；状态灯随状态机） */}
        {row > 0.02 ? (
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              height: rowH,
              padding: `0 ${mini ? 12 : 18}px`,
              marginTop: 8,
              transform: `translateY(${(1 - row) * -18}px)`,
              opacity: row,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 8,
                background: done > 0.3 ? withAlphaM(theme.notify, 0.16) : withAlphaM(theme.mech, 0.1),
                border: `2px solid ${done > 0.3 ? withAlphaM(theme.notify, 0.7) : withAlphaM(theme.mech, 0.4)}`,
                transform: `translateY(${done * -8}px) scale(${1 + 0.03 * done})`,
              }}
            />
              <span style={{width: colW[0], fontFamily: theme.mono, fontSize: mini ? 14 : 21, fontWeight: 700, color: theme.mech, whiteSpace: 'nowrap'}}>{idText}</span>
              <span style={{width: colW[1], display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap'}}>
                <span style={{width: mini ? 9 : 12, height: mini ? 9 : 12, borderRadius: '50%', background: stateColor, boxShadow: `0 0 ${8 * (0.4 + sync)}px ${withAlphaM(stateColor, 0.7)}`}} />
                <span style={{fontFamily: theme.sans, fontSize: mini ? 13 : 18, fontWeight: 600, color: stateColor}}>{stateTxt}</span>
              </span>
              <span style={{width: colW[2], fontFamily: theme.mono, fontSize: mini ? 10 : 13, color: theme.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{'npm install · 安装依赖包'}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** 后台线程轨（雾蓝——承 1-D 右轨同形，镜间身份恒常）。`litP` 轨显形（描线）；
 *  `cardT` 命令卡在轨上的位置 0..1（爬行由调用侧喂）；`progP` 卡上进度条 0..1；
 *  `flowT` 流光相位 0..1（行进虚线光带——flowP>0 时流动）；`flowP` 流光强度
 *  （加速一拍 = 调用侧抬强度）；`mini` 缩微（走查联动位）；`endCap` 轨端指向画外
 *  （2-C——轨端箭头） */
export const BackgroundTrack: React.FC<{
  x: number;
  y: number;
  w: number;
  litP?: number;
  cardT?: number;
  progP?: number;
  flowT?: number;
  flowP?: number;
  mini?: boolean;
  endCap?: boolean;
}> = ({x, y, w, litP = 1, cardT = -1, progP = 0, flowT = 0, flowP = 0, mini = false, endCap = false}) => {
  const lit = clamp01v(litP);
  const prog = clamp01v(progP);
  const flow = clamp01v(flowP);
  const dashOffset = -((flowT % 1) * 84);
  const cardW = mini ? 150 : 250;
  const cardH = mini ? 54 : 92;
  const cardY = mini ? -38 : -66;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: mini ? 76 : 140, opacity: lit}}>
      <svg width={w} height={mini ? 76 : 140} viewBox={`0 0 ${w} ${mini ? 76 : 140}`} style={{overflow: 'visible'}}>
        {/* 轨体（雾蓝横轨——描线显形） */}
        <line x1={0} y1={mini ? 38 : 70} x2={w} y2={mini ? 38 : 70} stroke={withAlphaM(theme.mech, 0.5)} strokeWidth={mini ? 3.5 : 5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - lit} />
        {/* 流光（行进虚线光带——flowT 相位流动；加速一拍抬强度） */}
        {flow > 0.02 ? (
          <line x1={0} y1={mini ? 38 : 70} x2={w} y2={mini ? 38 : 70} stroke={withAlphaM(theme.mech, 0.25 + 0.55 * flow)} strokeWidth={mini ? 5 : 8} strokeLinecap="round" strokeDasharray="26 58" strokeDashoffset={dashOffset} />
        ) : null}
        {/* 轨端指向（endCap——轨端箭头，指向画外通知位） */}
        {endCap ? (
          <path d={`M ${w - 26} ${mini ? 30 : 58} L ${w} ${mini ? 38 : 70} L ${w - 26} ${mini ? 46 : 82}`} fill="none" stroke={withAlphaM(theme.mech, 0.8)} strokeWidth={mini ? 3 : 4.5} strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
      </svg>
      {/* 轨名签（daemon thread——工况角标随轨） */}
      <div style={{position: 'absolute', left: 0, top: mini ? 46 : 82, fontFamily: theme.mono, fontSize: mini ? 11 : 14, color: withAlphaM(theme.mech, 0.8), whiteSpace: 'nowrap'}}>{'daemon thread'}</div>
      {/* 轨上命令卡（npm install 同签——爬行；进度条未满是「在赶路」的读法） */}
      {cardT >= 0 ? (
        <div
          style={{
            position: 'absolute',
            left: clamp01v(cardT) * (w - cardW),
            top: cardY,
            width: cardW,
            height: cardH,
            borderRadius: mini ? 7 : 10,
            border: `${mini ? 2 : 3}px solid ${withAlphaM(theme.mech, 0.85)}`,
            background: withAlphaM(theme.panel, 0.97),
            padding: mini ? '5px 9px' : '10px 14px',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: mini ? 12 : 19, color: theme.text, whiteSpace: 'nowrap'}}>{'npm install'}</div>
          {/* 卡上进度条（progP——爬行读数） */}
          <div style={{position: 'relative', height: mini ? 7 : 12, borderRadius: 4, border: `1.5px solid ${withAlphaM(theme.mech, 0.5)}`, background: withAlphaM(theme.panel, 0.9), marginTop: mini ? 4 : 8}}>
            <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${prog * 100}%`, borderRadius: 3, background: withAlphaM(theme.mech, 0.55)}} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

/** 占位回执卡（code.py 实文——「任务已启动，结果完成后可得」；2-A 弹出/2-C 手持
 *  /3-C 回到消息位同形）。`litP` 显形；`idChip` 编号签（bg_0001 全程同形同色）；
 *  `flyP` 沿通路飞回模型侧（调用侧喂位移轨迹，本件只渲染落位态）；`compact`
 *  紧凑形态（2-B 小票变体/3-C 消息位） */
export const PlaceholderReceipt: React.FC<{
  x: number;
  y: number;
  w?: number;
  litP?: number;
  compact?: boolean;
  glowP?: number;
}> = ({x, y, w = 380, litP = 1, compact = false, glowP = 0}) => {
  const lit = clamp01v(litP);
  const glow = clamp01v(glowP);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        padding: compact ? '8px 14px' : '14px 20px',
        borderRadius: compact ? 8 : 11,
        border: `${compact ? 2 : 3}px solid ${withAlphaM(theme.mech, 0.85)}`,
        background: withAlphaM(theme.panel, 0.97),
        opacity: lit,
        boxShadow: glow > 0.05 ? `0 0 ${16 * glow}px ${withAlphaM(theme.mech, 0.5)}` : 'none',
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
        <span
          style={{
            padding: '2px 9px',
            borderRadius: 6,
            border: `2px solid ${theme.mech}`,
            fontFamily: theme.mono,
            fontSize: compact ? 12 : 15,
            fontWeight: 700,
            color: theme.mech,
            whiteSpace: 'nowrap',
          }}
        >
          {'bg_0001'}
        </span>
        <span style={{fontFamily: theme.sans, fontSize: compact ? 14 : 19, color: theme.text, whiteSpace: 'nowrap'}}>
          {/* caption-dup-ok: 回执卡面为 code.py 实文占位回执（走查数据本体即演示
              对象，承 ep10 2-B 引语豁免先例——storyboard 2-A 行登记） */}
          {'任务已启动，结果完成后可得'}
        </span>
      </div>
    </div>
  );
};

/** 通知卡（兰紫描边——本集第二主角：任务号/状态/原命令/摘要 四栏）。
 *  `litP` 显形；`colsP` 四栏点亮进度 0..4（次序=口播：任务号→状态→原命令→摘要）；
 *  `truncP` 摘要栏 200 字标线截断（截断动画可见）；`truncFadeP` 截断段淡出
 *  （只留开头）；`glowP` 点亮辉光（点亮成卡的出生时刻 / 3-D 同框兑现）；
 *  `mini` 缩微（3-B 出生卡 / 5-B 全家福）；`foldP` 任务卡收拢包成通知卡的身份
 *  交接（雾蓝→兰紫描边过渡由调用侧 mixHex 喂 edge 色时改用本组件 `edge` prop） */
export const TaskNotificationCard: React.FC<{
  x: number;
  y: number;
  w?: number;
  h?: number;
  litP?: number;
  colsP?: number;
  truncP?: number;
  truncFadeP?: number;
  glowP?: number;
  mini?: boolean;
  edge?: string;
}> = ({x, y, w = 620, h = 360, litP = 1, colsP = 0, truncP = 0, truncFadeP = 0, glowP = 0, mini = false, edge}) => {
  const lit = clamp01v(litP);
  const cols = Math.max(0, colsP);
  const trunc = clamp01v(truncP);
  const truncFade = clamp01v(truncFadeP);
  const glow = clamp01v(glowP);
  const borderColor = edge ?? theme.notify;
  const cols4 = [
    {k: '任务号', v: 'bg_0001'},
    {k: '状态', v: '完成'},
    {k: '原命令', v: 'npm install'},
    {k: '摘要', v: ''},
  ];
  const labelFs = mini ? 12 : 16;
  const valFs = mini ? 13 : 20;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: mini ? 9 : 14,
        border: `${mini ? 2 : 3.5}px solid ${withAlphaM(borderColor, 0.9)}`,
        background: withAlphaM(theme.panel, 0.97),
        opacity: lit,
        boxShadow: glow > 0.05 ? `0 0 ${20 * glow}px ${withAlphaM(theme.notify, 0.45)}` : 'none',
        padding: mini ? '8px 12px' : '16px 22px',
      }}
    >
      {/* 卡头：task_notification（通知世界的身份签） */}
      <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: mini ? 6 : 12}}>
        <span style={{fontFamily: theme.mono, fontSize: mini ? 11 : 14, color: theme.notify, letterSpacing: 1, whiteSpace: 'nowrap'}}>{'task_notification'}</span>
        <span style={{flex: 1, height: 1.5, background: withAlphaM(theme.notify, 0.35)}} />
      </div>
      {/* 四栏（前三栏短值 / 第四栏摘要=截断文本条 + ≤200 标线） */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: mini ? 6 : 14}}>
        {cols4.map((c, i) => {
          const p = clamp01v(cols - i);
          const isSummary = i === 3;
          return (
            <div
              key={c.k}
              style={{
                borderRadius: 8,
                border: `2px ${p > 0.35 ? 'solid' : 'dashed'} ${p > 0.35 ? withAlphaM(theme.notify, 0.75) : withAlphaM(theme.dim, 0.5)}`,
                background: p > 0.35 ? withAlphaM(theme.notify, 0.08) : 'transparent',
                padding: mini ? '5px 9px' : '9px 14px',
                opacity: 0.35 + 0.65 * p,
                minHeight: isSummary ? (mini ? 46 : 86) : undefined,
              }}
            >
              <div style={{fontFamily: theme.sans, fontSize: labelFs, color: p > 0.35 ? theme.notify : theme.dim, whiteSpace: 'nowrap'}}>{c.k}</div>
              {isSummary ? (
                /* 摘要栏：超长文本条（灰阶条纹示意）被 200 字标线截断——截断段随
                   truncFade 淡出（只留开头） */
                <div style={{position: 'relative', height: mini ? 20 : 36, marginTop: 6, borderRadius: 5, border: `1.5px solid ${withAlphaM(theme.dim, 0.5)}`, background: withAlphaM(theme.panel, 0.9), overflow: 'hidden'}}>
                  {Array.from({length: mini ? 5 : 8}, (_, s) => {
                    const inTail = s >= (mini ? 3 : 5);
                    return (
                      <div
                        key={`sum${s}`}
                        style={{
                          position: 'absolute',
                          left: 8,
                          top: 6 + s * ((mini ? 20 : 36) / (mini ? 5.6 : 8.4)),
                          width: (mini ? 90 : 170) + ((s * 37) % (mini ? 40 : 90)),
                          height: mini ? 2.5 : 4,
                          borderRadius: 2,
                          background: withAlphaM(theme.dim, inTail ? 0.55 * (1 - truncFade) : 0.55),
                        }}
                      />
                    );
                  })}
                  {/* 200 字标线（truncP 落下——只作用于摘要栏） */}
                  {trunc > 0.02 ? (
                    <div style={{position: 'absolute', left: `${28 + 52 * trunc}%`, top: -3, bottom: -3, borderLeft: `3px dashed ${theme.notify}`, opacity: trunc}} />
                  ) : null}
                  <span style={{position: 'absolute', right: 6, bottom: 3, fontFamily: theme.mono, fontSize: mini ? 8 : 11, color: theme.notify, whiteSpace: 'nowrap', opacity: trunc}}>{'≤ 200'}</span>
                </div>
              ) : (
                <div style={{fontFamily: theme.mono, fontSize: valFs, color: theme.text, marginTop: 4, whiteSpace: 'nowrap'}}>{p > 0.5 ? c.v : ''}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 120 秒超时卡（警示红——到点即断的具象：教学版 4-A 盖上 / 4-B 上联复现）。
 *  `stampP` 盖落（rotate + scale 落章）；`bounceP` 任务卡被弹起（由调用侧作用于
 *  任务卡本体，本件只渲染章） */
export const TimeoutCard: React.FC<{x: number; y: number; stampP?: number}> = ({x, y, stampP = 0}) => {
  const stamp = clamp01v(stampP);
  if (stamp <= 0.02) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 250,
        height: 120,
        borderRadius: 12,
        border: `4px solid ${theme.danger}`,
        background: withAlphaM(theme.panel, 0.97),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        transform: `rotate(${-8 + 3 * stamp}deg) scale(${0.6 + 0.4 * stamp})`,
        opacity: stamp * 0.97,
        boxShadow: `0 0 ${18 * stamp}px ${withAlphaM(theme.danger, 0.4)}`,
      }}
    >
      <span style={{fontFamily: theme.mono, fontSize: 30, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap'}}>{'Timeout'}</span>
      <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.danger, whiteSpace: 'nowrap'}}>{'120 s 到点即断'}</span>
    </div>
  );
};
