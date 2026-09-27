/** chrome 层组件种子（seeded 档——scaffold 复制后完全自由，无门，随集演进）。
 *
 *  本文件从《拆开 Claude Code》集（claude-code-explained-video）的 motifs.tsx
 *  抽出**通用排版/标注机械**，只读底座 token（panel/panelBorder/text/dim +
 *  字体三族）；概念色一律经 `accent` prop 由调用方注入。任何集的 theme.ts
 *  底座都齐，故 scaffold 后无需改动即可 tsc 通过。随集演进时直接改本集副本
 *  （复制适配、不做跨集 import——复用边界见 references/PIPELINE.md §四）。
 *
 *  刻意**不进模板**的是创作性母题（Terminal / LoopRing / DispatchTable /
 *  GateRouter / SlotRing）：它们承载各集的叙事隐喻，属于每集的创作产物。
 *  需要时从 claude-code-explained-video 的 motifs.tsx 复制对应段落后裁剪、
 *  追加到本文件；母题目录与适用场景见 references/08 的母题表。
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

/** 集装箱母题〔M-001〕：货签粉恒定描边（2.5px）+ 同形箱体，全片锚。
 *  空间语义：箱内装「作业指导书 + 工具」，不是货；「开箱」= 正文进上下文（向右）。
 *  禁改描边色与线宽（恒定锚纪律）；只换 label / glow / 状态。 */
export const CargoBox: React.FC<{
  label?: string;
  width?: number;
  height?: number;
  glow?: number; // 0–1 危险高亮（瞬时红，仅攻击瞬间）
  lit?: number; // 0–1 整体可见度
  opened?: boolean; // 开箱态：顶盖虚线上移
  hot?: boolean; // 命中态：亮绿勾（ok，仅验证瞬间）
}> = ({label = '', width = 150, height = 104, glow = 0, lit = 1, opened = false, hot = false}) => (
  <div style={{position: 'relative', width, height, opacity: lit}}>
    <div
      style={{
        width,
        height,
        borderRadius: 10,
        border: `2.5px solid ${theme.conceptDeep}`,
        background: `${theme.conceptDeep}14`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.mono,
        fontSize: 16,
        color: theme.conceptDeep,
      }}
    >
      {label}
    </div>
    {opened ? (
      <div
        style={{
          position: 'absolute',
          left: 8,
          right: 8,
          top: -16,
          borderTop: `2.5px dashed ${theme.conceptDeep}`,
          opacity: 0.85,
        }}
      />
    ) : null}
    {glow > 0 ? (
      <div
        style={{
          position: 'absolute',
          inset: -3,
          borderRadius: 12,
          border: `3px solid ${theme.danger}`,
          background: `${theme.danger}26`,
          opacity: glow,
        }}
      />
    ) : null}
    {hot ? (
      <div
        style={{
          position: 'absolute',
          right: -12,
          top: -12,
          width: 26,
          height: 26,
          borderRadius: 13,
          border: `2.5px solid ${theme.ok}`,
          color: theme.ok,
          fontFamily: theme.mono,
          fontSize: 15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ✓
      </div>
    ) : null}
  </div>
);

/** 台账墙母题〔M-001〕：引航青单行账目，全片锚（tier-1 常驻目录的化身）。
 *  每行 = 箱号 + 一句货签；hot 行高亮（被想起/被提箱）；shadow 行划线（被遮蔽）。 */
export const LedgerWall: React.FC<{
  rows: {id: string; desc: string}[];
  lit?: number; // 已点亮行数（stagger 由调用侧驱动则传 0 手控）
  hotIndex?: number;
  shadowIndex?: number;
  width?: number;
  rowH?: number;
  visible?: number[]; // 各行透明度（外部驱动逐行点亮）
}> = ({rows, hotIndex = -1, shadowIndex = -1, width = 620, rowH = 44, visible}) => (
  <div style={{width, fontFamily: theme.mono}}>
    {rows.map((r, i) => {
      const op = visible ? visible[i] ?? 1 : 1;
      const hot = i === hotIndex;
      const shadowed = i === shadowIndex;
      return (
        <div
          key={r.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            height: rowH,
            borderTop: i === 0 ? `1px solid ${theme.concept}55` : undefined,
            borderBottom: `1px solid ${theme.concept}55`,
            background: hot ? `${theme.concept}1E` : undefined,
            opacity: op,
            padding: '0 10px',
          }}
        >
          <span style={{color: theme.concept, fontSize: 17, minWidth: 150}}>{r.id}</span>
          <span
            style={{
              color: shadowed ? theme.dim : theme.text,
              fontSize: 15,
              textDecoration: shadowed ? 'line-through' : undefined,
              opacity: shadowed ? 0.55 : 0.92,
              fontFamily: theme.sans,
            }}
          >
            {r.desc}
          </span>
          {shadowed ? <span style={{color: theme.deny, fontSize: 13}}>已遮蔽</span> : null}
        </div>
      );
    })}
  </div>
);
