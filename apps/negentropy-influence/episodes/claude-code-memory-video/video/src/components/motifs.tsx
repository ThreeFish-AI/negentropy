/** chrome 层组件种子（seeded 档——scaffold 复制后完全自由，无门，随集演进）。
 *
 *  本文件从《拆开 Claude Code》集（claude-code-explained-video）的 motifs.tsx
 *  抽出**通用排版/标注机械**，只读底座 token（panel/panelBorder/text/dim +
 *  字体三族）；概念色一律经 `accent` prop 由调用方注入。任何集的 theme.ts
 *  底座都齐，故 scaffold 后无需改动即可 tsc 通过。随集演进时直接改本集副本
 *  （复制适配、不做跨集 import——复用边界见 pipeline/README.md §四）。
 *
 *  刻意**不进模板**的是创作性母题（Terminal / LoopRing / DispatchTable /
 *  GateRouter / SlotRing）：它们承载各集的叙事隐喻，属于每集的创作产物。
 *  需要时从 claude-code-explained-video 的 motifs.tsx 复制对应段落后裁剪、
 *  追加到本文件；母题目录与适用场景见 pipeline/skills/06 的母题表。
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

/** 底部角标——统一压在 bottom ≥ 150（避让字幕条，skills/06 红线二） */
export const Footnote: React.FC<{children: React.ReactNode; delay?: number; slot?: 0 | 1}> = ({
  children,
  delay = 0,
  slot = 0,
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
        // slot：同一 Sequence 里并列两个组件各带一条 Footnote 时，两条会在
        // bottom:168 完全重印成一团糊字（2026-08 品控实拍坐实）。slot=1 抬到 206 错行。
        bottom: slot === 1 ? 206 : 168,
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

/** 幕级常驻抬头带（2026-08 品控改造）——修复「顶部 1/3 全片闲置」的构图缺陷。
 *
 *  实测动机：五集 3×3 宫格抽样显示顶带 ink 仅 0.4–2.0%，而 SceneTag 的
 *  Sequence 覆盖率只有 7–59%。本组件由**幕**（而非镜）挂载一次，全幕常驻，
 *  一次性补齐顶部信息层：左＝幕序与幕名，右＝本幕机制英文名（角标层，不进口播）。
 *
 *  纪律：只读底座 token 与传入的 accent；不参与句锚动画（避免与镜内动效抢注意力），
 *  仅在幕首 12 帧淡入；高度锁死 ≤96px，不侵占镜内主体区。 */
export const SceneHeader: React.FC<{
  index: string;
  title: string;
  meta?: string;
  accent?: string;
}> = ({index, title, meta, accent}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 12], [0, 1], {extrapolateRight: 'clamp'});
  const c = accent ?? theme.core;
  return (
    <div
      style={{
        position: 'absolute',
        left: 72,
        right: 72,
        top: 52,
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        opacity: o * 0.92,
        pointerEvents: 'none',
      }}
    >
      <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 22,
            color: c,
            letterSpacing: 3,
            borderLeft: `3px solid ${c}`,
            paddingLeft: 12,
          }}
        >
          {index}
        </span>
        <span style={{fontFamily: theme.serif, fontSize: 27, color: theme.text, letterSpacing: 1}}>
          {title}
        </span>
      </div>
      {meta ? (
        <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, letterSpacing: 1}}>
          {meta}
        </span>
      ) : null}
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

// ─────────────────────────────────────────────────── 本集母题（《AI 的记忆》）
//
// Terminal / LoopRing 自《拆开 Claude Code》集复制裁剪（复制适配、不跨集 import）：
//   Terminal  系列终端 —— P0 痛点开场（同款窗口/打字机/光标凝住）
//   LoopRing  系列恒定视觉锚 —— 仅在 P5「压缩瞬间」出场：core 色、6px 绝对线宽、
//             四节点（问模型/看回答/执行工具/填回结果），与系列同款同宽。
// 本集新增画面原子（贯穿「桌面与登记簿」比喻体系）：
//   Chip / PaperCard / Desk / Ledger / Cabinet / HelperFigure
// ★ 本集纪律：丢失不用颜色画——被压内容向 dim/panel 褪色，褪色即遗忘；
//   keep 苔绿只属于恒存层（登记簿/记忆文件/索引/抢救出的字条）。

export type TermLine = {text: string; color?: string; delay: number; prompt?: string};

/** 终端窗口 + 逐字打字机。cps = 每秒字数（帧驱动，可复现） */
export const Terminal: React.FC<{
  lines: TermLine[];
  width?: number;
  height?: number;
  cps?: number;
  /** 打完后光标是否停闪并变灰（「它停在那儿了」的落点） */
  freezeCursorAt?: number;
  title?: string;
}> = ({lines, width = 1180, height = 470, cps = 26, freezeCursorAt, title = 'zsh'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const frozen = freezeCursorAt !== undefined && frame >= freezeCursorAt;
  const blink = frozen ? 0.35 : Math.floor((frame / fps) * 2) % 2 === 0 ? 1 : 0.15;
  return (
    <Panel style={{width, height, padding: 0, overflow: 'hidden'}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 44,
          padding: '0 18px',
          borderBottom: `2px solid ${theme.panelBorder}`,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{width: 12, height: 12, borderRadius: 999, background: theme.panelBorder}}
          />
        ))}
        <div style={{marginLeft: 10, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
          {title}
        </div>
      </div>
      <div style={{padding: '22px 26px', fontFamily: theme.mono, fontSize: 27, lineHeight: 1.65}}>
        {lines.map((ln, i) => {
          const shown = Math.max(0, Math.floor(((frame - ln.delay) / fps) * cps));
          if (shown <= 0) return null;
          const isLast = i === lines.length - 1;
          const done = shown >= ln.text.length;
          return (
            <div key={i} style={{color: ln.color ?? theme.text, whiteSpace: 'pre'}}>
              {ln.prompt ? <span style={{color: theme.core}}>{ln.prompt} </span> : null}
              {ln.text.slice(0, shown)}
              {isLast && done ? (
                <span style={{opacity: blink, color: frozen ? theme.dim : theme.core}}>▍</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

/** 环线宽（绝对像素，全系列恒定，勿随 size 缩放） */
export const RING_STROKE = 6;

export type RingNode = {label: string; angle: number};

/** 环上四个节点的固定角度（12 点起顺时针）——系列一致，位置即语义 */
export const RING_NODES: RingNode[] = [
  {label: '问模型', angle: -90},
  {label: '看回答', angle: 0},
  {label: '执行工具', angle: 90},
  {label: '填回结果', angle: 180},
];

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

/**
 * 系列恒定的环形循环（本集仅在 P5 压缩瞬间出场，无停机出口）。
 * 不变量：stroke 恒 theme.core、strokeWidth 恒 RING_STROKE 绝对像素——调用点
 * 不得覆写；只允许改 size / 位置 / draw / dotProgress。
 * - `draw` 0→1 描线进度（pathLength 归一化，不与像素 dasharray 混用）
 * - `dotProgress` 光点沿环位置（0–1）；`showLabels` 在 size < 260 时必须关
 */
export const LoopRing: React.FC<{
  size?: number;
  draw?: number;
  dotProgress?: number;
  activeNode?: number;
  dimNodes?: boolean;
  nodeLabels?: string[];
  showLabels?: boolean;
}> = ({
  size = 460,
  draw = 1,
  dotProgress,
  activeNode,
  dimNodes = false,
  nodeLabels,
  showLabels,
}) => {
  const labelsOn = showLabels ?? size >= 260;
  const frame = useCurrentFrame();
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 46;
  const pulse = 0.55 + 0.45 * Math.sin(frame / 5);
  const dot = dotProgress === undefined ? null : polar(cx, cy, r, -90 + dotProgress * 360);
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
      {RING_NODES.map((n, i) => {
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
      {dot ? <circle cx={dot.x} cy={dot.y} r={11} fill={theme.core} /> : null}
    </svg>
  );
};

/** 环的匀速巡游进度（周期 secPerLap 秒） */
export const useRingDot = (secPerLap = 2.5, offset = 0) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return ((frame - offset) / (fps * secPerLap)) % 1;
};

/** 桌面纸卡：本集最高频画面原子（对话历史 = 桌上的纸）。
 *  tone 是褪色刻度：full=正在用 / half=过气 / faded=被压掉——褪色即遗忘，
 *  不引入新颜色。accent 用于描边语义（如 core 描边「任务书」）。 */
export const PaperCard: React.FC<{
  w?: number;
  h?: number;
  tone?: 'full' | 'half' | 'faded';
  label?: string;
  bars?: number;
  accent?: string;
  dashed?: boolean;
  style?: React.CSSProperties;
}> = ({w = 120, h = 64, tone = 'full', label, bars = 3, accent, dashed, style}) => {
  const base = tone === 'faded' ? 0.18 : tone === 'half' ? 0.42 : 0.8;
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 6,
        background: theme.panel,
        border: `2px ${dashed ? 'dashed' : 'solid'} ${accent ?? theme.panelBorder}`,
        padding: `${Math.max(5, Math.round(h * 0.1))}px ${Math.max(6, Math.round(w * 0.08))}px`,
        opacity: tone === 'faded' ? 0.6 : 1,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {label ? (
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: Math.max(13, Math.min(19, Math.round(h * 0.22))),
            color: accent ?? theme.dim,
            opacity: Math.min(1, base + 0.2),
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      ) : null}
      {Array.from({length: bars}).map((_, i) => (
        <div
          key={i}
          style={{
            height: 4,
            borderRadius: 2,
            background: theme.text,
            opacity: Math.max(0.06, base - i * 0.1),
            marginTop: Math.max(4, Math.round(h / (bars + 2.2))),
            width: `${[100, 84, 66, 92, 76][i % 5]}%`,
          }}
        />
      ))}
    </div>
  );
};

/** 桌面：全部对话的舞台（本集比喻体系的主舞台）。褪色由调用方用 opacity 驱动。 */
export const Desk: React.FC<{
  w?: number;
  h?: number;
  label?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({w = 1520, h = 460, label, style, children}) => (
  <div
    style={{
      position: 'relative',
      width: w,
      height: h,
      borderRadius: 18,
      background: 'rgba(255,255,255,0.025)',
      border: `3px solid ${theme.panelBorder}`,
      ...style,
    }}
  >
    {label ? (
      <div
        style={{
          position: 'absolute',
          left: 20,
          top: -36,
          fontFamily: theme.mono,
          fontSize: 22,
          color: theme.dim,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
    ) : null}
    {children}
  </div>
);

/** 登记簿（keep 恒存层实体）：页只增不删的本子。pages 驱动页缘厚度（越攒越厚）。 */
export const Ledger: React.FC<{
  w?: number;
  h?: number;
  pages?: number;
  glow?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({w = 380, h = 340, pages = 6, glow = 0, style, children}) => (
  <div style={{position: 'relative', width: w + pages * 3, height: h + pages * 3, ...style}}>
    {glow > 0 ? (
      <div
        style={{
          position: 'absolute',
          inset: -20,
          borderRadius: 30,
          boxShadow: `0 0 ${Math.round(46 * glow)}px ${theme.keep}`,
          opacity: glow * 0.45,
          pointerEvents: 'none',
        }}
      />
    ) : null}
    {/* 页缘：逐层错位的书页 */}
    {Array.from({length: pages}).map((_, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: (pages - i) * 3,
          top: (pages - i) * 3,
          width: w,
          height: h,
          borderRadius: 12,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          opacity: 0.5 + 0.5 * (i / Math.max(1, pages - 1)),
        }}
      />
    ))}
    {/* 封面：keep 描边 + 书脊 */}
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: w,
        height: h,
        borderRadius: 12,
        background: theme.panel,
        border: `3px solid ${theme.keep}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 24,
          background: theme.keepDeep,
          borderRight: `2px solid ${theme.keep}`,
        }}
      />
      <div style={{position: 'absolute', left: 40, right: 16, top: 16, bottom: 16}}>{children}</div>
    </div>
  </div>
);

/** 文件柜（硬盘/档案室）：抽屉逐格；openIndex 驱动某一格抽屉拉开露出内腔。 */
export const Cabinet: React.FC<{
  w?: number;
  h?: number;
  drawers?: number;
  openIndex?: number;
  label?: string;
  style?: React.CSSProperties;
}> = ({w = 620, h = 560, drawers = 5, openIndex = -1, label, style}) => {
  const gap = 10;
  const dh = Math.floor((h - (drawers + 1) * gap) / drawers);
  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: h,
        borderRadius: 14,
        background: theme.panel,
        border: `3px solid ${theme.panelBorder}`,
        padding: gap,
        ...style,
      }}
    >
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: 20,
            top: -36,
            fontFamily: theme.mono,
            fontSize: 22,
            color: theme.dim,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      ) : null}
      {Array.from({length: drawers}).map((_, i) => {
        const open = openIndex === i;
        return (
          <div
            key={i}
            style={{
              position: 'relative',
              height: dh,
              marginBottom: gap,
              borderRadius: 8,
              border: `2px solid ${theme.panelBorder}`,
              background: theme.bg,
              overflow: 'hidden',
            }}
          >
            {/* 抽屉面：open 时下滑露出内腔 */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: dh,
                background: theme.panel,
                borderTop: `2px solid ${theme.panelBorder}`,
                borderRadius: 8,
                transform: `translateY(${open ? dh * 0.72 : 0}px)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{width: 56, height: 8, borderRadius: 4, background: theme.panelBorder}} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** 摘要帮工：小个子石青小人。armAngle 驱动作业臂绕肩转动（扫桌/卷纸动作）。 */
export const HelperFigure: React.FC<{
  size?: number;
  armAngle?: number;
  dim?: boolean;
  style?: React.CSSProperties;
}> = ({size = 200, armAngle = 0, dim = false, style}) => {
  const s = size / 200;
  const c = dim ? theme.dim : theme.mech;
  return (
    <svg width={size} height={size * 1.15} style={style}>
      <g transform={`scale(${s})`} stroke={c} strokeWidth={9} strokeLinecap="round" fill="none">
        <circle cx={100} cy={44} r={26} fill={theme.panel} />
        <line x1={100} y1={70} x2={100} y2={150} />
        <line x1={100} y1={92} x2={56} y2={124} />
        <g transform={`rotate(${armAngle} 100 92)`}>
          <line x1={100} y1={92} x2={158} y2={86} />
          <circle cx={158} cy={86} r={7} fill={c} stroke="none" />
        </g>
        <line x1={100} y1={150} x2={72} y2={196} />
        <line x1={100} y1={150} x2={128} y2={196} />
      </g>
    </svg>
  );
};

export {ease};
