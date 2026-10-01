/** 本集共享装置库（storyboard「实现映射」节全集）——幕级场景只做编排与文案注入。
 *
 *  契约（与 references/08 场景组件模式一致）：
 *  - **时点一律由调用侧用句边界推导**（`at('句id') - 镜.from`）后以 `at` / `*At`
 *    prop 传入；组件内部只允许相对这些锚的小额编排偏移（与 E2 CodePane 同形）。
 *  - hooks 只在组件顶层调用；map / 条件内的逐项动效一律用纯函数 `progress`。
 *  - 弹簧只喂局部帧、只驱动几何（位移/缩放）；不透明度/颜色恒走时长+缓动。
 *  - 位置一律 px（量纲红线一）；底部角标类内容由调用侧保证 bottom ≥ 150。
 *  - 色彩契约：金 concept=口径主线 · 紫 conceptDeep=治理/身份 · 青 verify=验证；
 *    danger 仅消融崩溃侧、ok 仅拦截侧（AblationPair 内部钉死，勿从外部改写）。
 *  - 帧驱动确定性：无 Math.random / Date.now；抖动/呼吸为帧的纯函数。
 *
 *  母题〔M-001〕：DefinitionCard 的几何常量 DC 是全片唯一事实源——金描边 2px、
 *  680×430、圆角 20，任何幕不得私改尺寸（P7 满屏回照用 scale 缩放保持同形）。
 *  注：QuoteCard 与骨架 cards.tsx 同名——本文件版本带 `at` 句锚，幕级一律从
 *  devices 导入（cards.tsx 属 seeded 残留，勿混用）。
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {
  DUR,
  progress,
  useBreathe,
  useCount,
  useDraw,
  useEnter,
  useFlowDash,
  useImpulse,
  useSpring,
  useStagger,
} from '../motion';

/** #RRGGBB → rgba（theme 未导出 withAlpha 的本地替身；纯函数）。 */
const withA = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// ─────────────────────────────────────────────── 定义卡母题〔M-001〕

/** DefinitionCard 几何 SSOT：全片同形，禁幕内私改（M-001 验：跨镜逐像素一致）。 */
const DC = {w: 680, h: 430, r: 20} as const;
const SEGMENTS = ['TABLES', 'RELATIONSHIPS', 'FACTS', 'DIMENSIONS', 'METRICS'] as const;

/**
 * 「同一份定义单」母题。四态：
 *  - empty（P0 空卡座：卡不在场，座上积灰光）
 *  - 注册态（P2：金描边点亮 + 五段式刻度逐段落）
 *  - claspAt（P3：紫色策略挂扣从右侧扣上）
 *  - stampAt（P4：青色 VERIFIED 印章落位；可与 claspAt 叠加）
 */
export const DefinitionCard: React.FC<{
  /** 入场锚（帧，句边界推导）。 */
  at: number;
  /** 空卡座态（P0）。 */
  empty?: boolean;
  /** 入场形态；注册落印用 fall（缺省）。 */
  enter?: 'fall' | 'pop' | 'rise' | 'fade';
  /** 卡头 mono 小字。 */
  kicker?: string;
  /** 卡面词条（如「净收入」）。 */
  title?: string;
  /** 词条下一行说明（可选）。 */
  note?: string;
  /** 五段式刻度（缺省 TABLES→METRICS；显式传 [] 可隐藏）。 */
  segments?: readonly string[];
  /** 刻度逐段落位起点（帧）。 */
  segmentsAt?: number;
  /** 策略挂扣（紫）扣上时点；不传则不出现。 */
  claspAt?: number;
  /** 签名盖章位（青）落印时点；不传则不出现。 */
  stampAt?: number;
  /** 辉光系数 0..1（回照微光；持续呼吸由调用侧传 useBreathe 值）。 */
  halo?: number;
  /** 几何缩放（transform，形状不变——P7 满屏回照用）。 */
  scale?: number;
}> = ({
  at,
  empty = false,
  enter = 'fall',
  kicker = 'SEMANTIC VIEW',
  title,
  note,
  segments,
  segmentsAt,
  claspAt,
  stampAt,
  halo = 0,
  scale = 1,
}) => {
  const e = useEnter(enter, {at, dur: DUR.f5, dist: 44});
  const border = useDraw(at, DUR.f6);
  const dust = useBreathe({period: 160, base: 0.5, amp: 0.5});
  const frame = useCurrentFrame();
  const segs = segments ?? (empty ? [] : SEGMENTS);
  const segAt = segmentsAt ?? at + 12;
  return (
    <div
      style={{
        ...e,
        position: 'relative',
        width: DC.w,
        height: DC.h,
        transform: `${e.transform} scale(${scale})`,
        boxShadow: halo > 0 ? `0 0 ${34 * halo}px ${withA(theme.concept, 0.4 * halo)}` : 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: DC.r,
          background: empty ? withA(theme.panel, 0.4) : theme.panel,
        }}
      />
      {empty ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: DC.r,
            background: `linear-gradient(180deg, ${withA(theme.text, 0.055)}, ${withA(theme.text, 0.015)})`,
          }}
        />
      ) : null}
      <svg width={DC.w} height={DC.h} viewBox={`0 0 ${DC.w} ${DC.h}`} style={{position: 'absolute', inset: 0}}>
        <rect
          x={1}
          y={1}
          width={DC.w - 2}
          height={DC.h - 2}
          rx={DC.r - 1}
          fill="none"
          stroke={theme.concept}
          strokeWidth={2}
          {...border}
        />
        {empty ? (
          <rect
            x={1}
            y={1}
            width={DC.w - 2}
            height={DC.h - 2}
            rx={DC.r - 1}
            fill="none"
            stroke={theme.concept}
            strokeWidth={2}
            opacity={0.14 + 0.16 * dust}
          />
        ) : null}
      </svg>
      {empty ? (
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <span style={{fontFamily: theme.serif, fontSize: 120, color: withA(theme.dim, 0.32 + 0.14 * dust)}}>
            {'？'}
          </span>
        </div>
      ) : (
        <>
          <div style={{position: 'absolute', top: 36, left: 50, display: 'flex', alignItems: 'center', gap: 12}}>
            <div style={{width: 10, height: 10, background: theme.concept}} />
            <span style={{fontFamily: theme.mono, fontSize: 16, letterSpacing: 3, color: theme.dim}}>{kicker}</span>
          </div>
          {title ? (
            <div style={{position: 'absolute', top: 126, left: 50, right: 50}}>
              <div
                style={{
                  fontFamily: theme.serif,
                  fontSize: 58,
                  fontWeight: 700,
                  color: theme.concept,
                  lineHeight: 1.25,
                }}
              >
                {title}
              </div>
              {note ? (
                <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{note}</div>
              ) : null}
            </div>
          ) : null}
          <div
            style={{
              position: 'absolute',
              left: 50,
              right: 50,
              bottom: 44,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            {segs.map((s, i) => {
              const p = progress(frame, segAt + i * 5, DUR.f3);
              return (
                <div key={s} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: p}}>
                  <div
                    style={{
                      width: 2,
                      height: 16,
                      background: p >= 1 ? theme.concept : withA(theme.concept, 0.4),
                    }}
                  />
                  <span style={{fontFamily: theme.mono, fontSize: 15, letterSpacing: 1, color: p >= 1 ? theme.text : theme.dim}}>
                    {s}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
      {claspAt !== undefined ? <PolicyClasp at={claspAt} /> : null}
      {stampAt !== undefined ? <SignStamp at={stampAt} /> : null}
    </div>
  );
};

/** 紫色策略挂扣：从右侧扣上（snap 弹簧，几何通道）。 */
const PolicyClasp: React.FC<{at: number}> = ({at}) => {
  const s = useSpring('snap', {at, dur: DUR.f5});
  const frame = useCurrentFrame();
  const o = progress(frame, at, 4);
  return (
    <div
      style={{
        position: 'absolute',
        left: DC.w - 46,
        top: DC.h / 2 - 78,
        width: 92,
        height: 156,
        opacity: o,
        transform: `translateX(${(1 - s) * 74}px)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          border: `2px solid ${theme.conceptDeep}`,
          background: theme.panel,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        <div style={{width: 26, height: 10, background: theme.conceptDeep}} />
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 14,
            letterSpacing: 3,
            color: theme.conceptDeep,
            writingMode: 'vertical-rl',
          }}
        >
          {'POLICY'}
        </span>
        <div style={{width: 26, height: 10, background: theme.conceptDeep}} />
      </div>
    </div>
  );
};

/** 青色 VERIFIED 印章：落印 + 一次性脉冲外圈。 */
const SignStamp: React.FC<{at: number}> = ({at}) => {
  const s = useSpring('settle', {at, dur: DUR.f5});
  const frame = useCurrentFrame();
  const o = progress(frame, at, 5);
  const pulse = useImpulse({at: at + 4, dur: 14, peak: 1});
  return (
    <div
      style={{
        position: 'absolute',
        right: 40,
        bottom: 104,
        width: 132,
        height: 132,
        opacity: o,
        transform: `scale(${0.7 + 0.3 * s}) rotate(-11deg)`,
      }}
    >
      <div style={{position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${theme.verify}`}} />
      <div style={{position: 'absolute', inset: 10, borderRadius: '50%', border: `1.5px solid ${withA(theme.verify, 0.55)}`}} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `3px solid ${theme.verify}`,
          transform: `scale(${1 + 0.35 * pulse})`,
          opacity: 0.6 * pulse,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 17, letterSpacing: 2, color: theme.verify}}>{'VERIFIED'}</span>
        <span style={{fontFamily: theme.mono, fontSize: 13, color: withA(theme.verify, 0.75)}}>{'VQR'}</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────── 术语卡

/** 术语卡：词条 + 白话同位语小字 + 右上角标（Semantic View / PK / FK / Grain…）。 */
export const TermCard: React.FC<{
  at?: number;
  /** 词条（如「语义视图」）。 */
  term: string;
  /** 白话同位语。 */
  gloss: string;
  /** 英文角标。 */
  tag?: string;
  width?: number;
  /** 左侧竖条色（缺省金）。 */
  accent?: string;
}> = ({at = 0, term, gloss, tag, width = 400, accent}) => {
  const e = useEnter('rise', {at, dur: DUR.f4, dist: 26});
  const a = accent ?? theme.concept;
  return (
    <div
      style={{
        ...e,
        width,
        background: theme.panel,
        border: `2px solid ${theme.panelBorder}`,
        borderRadius: 14,
        padding: '24px 26px',
        position: 'relative',
      }}
    >
      <div style={{position: 'absolute', left: 0, top: 22, bottom: 22, width: 3, background: a}} />
      <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
        <span style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 700, color: theme.text}}>{term}</span>
        {tag ? (
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 15,
              letterSpacing: 1,
              color: theme.dim,
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 6,
              padding: '3px 8px',
            }}
          >
            {tag}
          </span>
        ) : null}
      </div>
      <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 22, lineHeight: 1.55, color: theme.dim}}>{gloss}</div>
    </div>
  );
};

// ─────────────────────────────────────────────── 红绿消融同屏

export type AblationMeter = {
  label: string;
  from: number;
  to: number;
  suffix?: string;
  decimals?: number;
  at?: number;
};
export type AblationSideSpec = {
  /** 角标短码（如 D6 / 门在位）。 */
  tag: string;
  /** 侧标题。 */
  title: string;
  /** 链路/日志行（逐行错峰）。 */
  lines: readonly string[];
  /** 退化/泄露数字位（useCount 翻牌）。 */
  meter?: AblationMeter;
  /** 底部行进虚线（红侧崩溃链路扩散 / 绿侧持续拦截）。 */
  flow?: {label?: string};
};

/** 红绿消融同屏：左=崩溃（danger），右=拦截（ok）——两色钉死，勿外部改写。 */
export const AblationPair: React.FC<{
  at: number;
  left: AblationSideSpec;
  right: AblationSideSpec;
  width?: number;
  minHeight?: number;
}> = ({at, left, right, width = 1560, minHeight = 470}) => (
  <div style={{display: 'flex', alignItems: 'stretch', gap: 24, width}}>
    <AblationSideView side={left} tone={theme.danger} at={at} minHeight={minHeight} />
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12}}>
      <div style={{flex: 1, width: 0, borderLeft: `2px dashed ${withA(theme.dim, 0.35)}`}} />
      <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{'vs'}</span>
      <div style={{flex: 1, width: 0, borderLeft: `2px dashed ${withA(theme.dim, 0.35)}`}} />
    </div>
    <AblationSideView side={right} tone={theme.ok} at={at + 8} minHeight={minHeight} />
  </div>
);

const AblationSideView: React.FC<{side: AblationSideSpec; tone: string; at: number; minHeight: number}> = ({
  side,
  tone,
  at,
  minHeight,
}) => {
  const frame = useCurrentFrame();
  const e = progress(frame, at, DUR.f5);
  const rows = useStagger(side.lines.length, {at: at + 4, stride: 7, dur: DUR.f3});
  const flow = useFlowDash({dash: 9, gap: 11, period: 22});
  const meterV = useCount({from: side.meter?.from ?? 0, to: side.meter?.to ?? 0, at: side.meter?.at ?? at + 10, dur: 40});
  return (
    <div
      style={{
        flex: 1,
        minHeight,
        borderRadius: 14,
        border: `2px solid ${withA(tone, 0.8)}`,
        background: withA(tone, 0.055),
        padding: '26px 30px',
        position: 'relative',
        opacity: e,
        transform: `translateY(${(1 - e) * 20}px)`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 17,
            letterSpacing: 2,
            color: tone,
            border: `1.5px solid ${withA(tone, 0.6)}`,
            borderRadius: 6,
            padding: '2px 8px',
          }}
        >
          {side.tag}
        </span>
        <span style={{fontFamily: theme.sans, fontSize: 29, fontWeight: 600, color: theme.text}}>{side.title}</span>
      </div>
      <div style={{marginTop: 18, display: 'flex', flexDirection: 'column', gap: 9}}>
        {side.lines.map((l, i) => (
          <div
            key={l}
            style={{
              opacity: rows[i],
              fontFamily: theme.mono,
              fontSize: 21,
              lineHeight: 1.5,
              color: i === 0 ? theme.text : theme.dim,
              whiteSpace: 'pre',
            }}
          >
            <span style={{color: tone, marginRight: 10}}>{'›'}</span>
            {l}
          </div>
        ))}
      </div>
      {side.meter ? (
        <div style={{marginTop: 'auto', paddingTop: 16, display: 'flex', alignItems: 'baseline', gap: 16}}>
          <span style={{fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', fontSize: 58, color: tone}}>
            {side.meter.decimals ? meterV.toFixed(side.meter.decimals) : Math.round(meterV)}
            {side.meter.suffix ?? ''}
          </span>
          <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim}}>{side.meter.label}</span>
        </div>
      ) : null}
      {side.flow ? (
        <svg width="100%" height="10" viewBox="0 0 400 10" preserveAspectRatio="none" style={{marginTop: 10}}>
          <line x1={2} y1={5} x2={398} y2={5} stroke={tone} strokeWidth={2} opacity={0.85} {...flow} />
        </svg>
      ) : null}
    </div>
  );
};

// ─────────────────────────────────────────────── 基线锚定动态标尺

/** Baseline-Anchored Counter：增长条（useCount）+ 恒常驻基线值 + 区间括角 + 工况角标。 */
export const BaselineBar: React.FC<{
  at: number;
  /** 增益下界（如 59）。 */
  from: number;
  /** 增益上界（如 91）——计数爬到该值。 */
  to: number;
  unit?: string;
  /** 工况角标（TPC-DS 4 查询 · 359GB→120MB）。 */
  caption?: string;
  /** 基线标签（缺省「基准查询」）。 */
  baselineNote?: string;
  width?: number;
}> = ({at, from, to, unit = '×', caption, baselineNote = '基准查询', width = 1120}) => {
  const frame = useCurrentFrame();
  const v = useCount({from: 1, to, at, dur: 48});
  const e = progress(frame, at, DUR.f4);
  const pad = 8;
  const inner = width - pad * 2;
  const x = (val: number) => ((val - 1) / Math.max(1, to - 1)) * inner;
  return (
    <div style={{width, opacity: e}}>
      <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', marginBottom: 14}}>
        <span style={{fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', fontSize: 66, color: theme.concept}}>
          {Math.round(v)}
          {unit}
        </span>
      </div>
      <div style={{position: 'relative', height: 36, borderRadius: 8, background: withA(theme.panelBorder, 0.4)}}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: Math.max(0, x(v)),
            borderRadius: 8,
            background: `linear-gradient(90deg, ${withA(theme.concept, 0.3)}, ${theme.concept})`,
          }}
        />
        {/* 区间括角：from..to（标注实测区间，条体计数至上界） */}
        <div style={{position: 'absolute', left: x(from), top: -14, right: 0, height: 2, background: withA(theme.concept, 0.6)}}>
          <div style={{position: 'absolute', left: 0, top: -4, width: 2, height: 10, background: theme.concept}} />
          <div style={{position: 'absolute', right: 0, top: -4, width: 2, height: 10, background: theme.concept}} />
        </div>
      </div>
      <div style={{position: 'relative', height: 26, marginTop: 10}}>
        <div style={{position: 'absolute', left: 0, display: 'flex', alignItems: 'center', gap: 8}}>
          <div style={{width: 2, height: 14, background: theme.dim}} />
          <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>
            {`1${unit} · ${baselineNote}`}
          </span>
        </div>
        <div style={{position: 'absolute', right: 0, fontFamily: theme.mono, fontSize: 19, color: theme.text}}>
          {`${from}${unit}–${to}${unit}`}
        </div>
      </div>
      {caption ? (
        <div style={{marginTop: 6, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{caption}</div>
      ) : null}
    </div>
  );
};

// ─────────────────────────────────────────────── 衬线金句卡

/** 金句卡（@enter:pop + 微光〔M-003〕）。注意：带 `at` 句锚，勿用 cards.tsx 同名件。 */
export const QuoteCard: React.FC<{
  at?: number;
  zh: string;
  cite?: string;
  accent?: string;
  kicker?: string;
}> = ({at = 0, zh, cite, accent, kicker}) => {
  const e = useEnter('pop', {at, dur: DUR.f5});
  const glow = useBreathe({period: 200, base: 0.4, amp: 0.6});
  const a = accent ?? theme.concept;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 180px'}}>
      <div style={{...e, textAlign: 'center'}}>
        {kicker ? (
          <div style={{fontFamily: theme.mono, fontSize: 18, letterSpacing: 4, color: theme.dim, marginBottom: 26}}>
            {kicker}
          </div>
        ) : null}
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 62,
            fontWeight: 700,
            lineHeight: 1.45,
            color: a,
            textShadow: `0 0 ${26 * glow}px ${withA(a, 0.35 * glow + 0.08)}`,
          }}
        >
          {zh}
        </div>
        {cite ? (
          <div style={{marginTop: 30, fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{`—— ${cite}`}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 状态走查轨道（Animated State Trace）

/** 状态走查：输入卡进入 → 引擎面板状态标签逐拍变换（步骤灯同刻逐亮）→ 输出。
 *  灰置旁注（如「事件表 · 全程未触碰」）挂在引擎面板底栏右侧。 */
export const StateTrace: React.FC<{
  /** 轨道与输入卡入场锚。 */
  at: number;
  inputs: readonly {label: string; sub?: string}[];
  inputAt?: number;
  engineTitle: string;
  engineTag?: string;
  /** 状态逐拍：at = 本镜局部帧（调用侧 rel 推导）。 */
  stages: readonly {label: string; at: number}[];
  output: {label: string; value: string; tone?: string; countTo?: number};
  outputAt: number;
  aside?: {label: string; note?: string};
  width?: number;
}> = ({at, inputs, inputAt, engineTitle, engineTag, stages, output, outputAt, aside, width = 1520}) => {
  const frame = useCurrentFrame();
  const ins = useStagger(inputs.length, {at: inputAt ?? at, stride: 8, dur: DUR.f4});
  const railL = useDraw(at + 16, DUR.f5);
  const railR = useDraw(Math.max(at + 16, outputAt - 8), DUR.f5);
  const outE = useEnter('pop', {at: outputAt, dur: DUR.f4});
  const outV = useCount({to: output.countTo ?? 0, at: outputAt, dur: 24});
  let act = -1;
  stages.forEach((s, i) => {
    if (frame >= s.at) act = i;
  });
  const rail = (
    draw: {pathLength: 1; strokeDasharray: 1; strokeDashoffset: number},
    tipAt: number,
  ) => (
    <svg width={86} height={40} viewBox="0 0 86 40">
      <line x1={2} y1={20} x2={64} y2={20} stroke={theme.dim} strokeWidth={2} {...draw} />
      <polygon points="64,12 82,20 64,28" fill={theme.dim} opacity={progress(frame, tipAt, 3)} />
    </svg>
  );
  const tipL = at + 16 + DUR.f5 - 2;
  const tipR = Math.max(at + 16, outputAt - 8) + DUR.f5 - 2;
  const outTone = output.tone ?? theme.concept;
  return (
    <div style={{width, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        {inputs.map((inp, i) => (
          <div
            key={inp.label + i}
            style={{
              width: 210,
              padding: '14px 16px',
              borderRadius: 10,
              border: `1.5px solid ${theme.panelBorder}`,
              background: theme.panel,
              opacity: ins[i],
              transform: `translateX(${(1 - ins[i]) * -26}px)`,
            }}
          >
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.text}}>{inp.label}</div>
            {inp.sub ? (
              <div style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginTop: 3}}>{inp.sub}</div>
            ) : null}
          </div>
        ))}
      </div>
      {rail(railL, tipL)}
      <div
        style={{
          position: 'relative',
          width: 560,
          minHeight: 330,
          borderRadius: 14,
          border: `2px solid ${theme.concept}`,
          background: theme.panel,
          padding: '22px 26px',
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{engineTitle}</span>
          {engineTag ? (
            <span style={{fontFamily: theme.mono, fontSize: 14, letterSpacing: 2, color: theme.dim}}>{engineTag}</span>
          ) : null}
        </div>
        <div style={{position: 'relative', height: 150, marginTop: 26}}>
          {stages.map((s, i) => {
            const next = stages[i + 1];
            const o = progress(frame, s.at, 3) * (1 - (next ? progress(frame, next.at, 3) : 0));
            return (
              <div
                key={s.label + i}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  opacity: o,
                  transform: `translateY(${(1 - o) * 8}px)`,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: i === act ? theme.concept : theme.panelBorder,
                  }}
                />
                <span
                  style={{
                    fontFamily: theme.sans,
                    fontSize: 30,
                    fontWeight: 600,
                    color: i === act ? theme.text : theme.dim,
                  }}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{position: 'absolute', left: 26, right: 26, bottom: 20, display: 'flex', gap: 10, alignItems: 'center'}}>
          {stages.map((s, i) => {
            const on = progress(frame, s.at, 3);
            return (
              <div
                key={i}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  border: `2px solid ${on >= 1 ? theme.concept : theme.panelBorder}`,
                  background: on > 0 ? theme.concept : 'transparent',
                  opacity: 0.35 + 0.65 * on,
                }}
              />
            );
          })}
          {aside ? (
            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 12px',
                border: `1.5px dashed ${withA(theme.dim, 0.5)}`,
                borderRadius: 8,
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{aside.label}</span>
              {aside.note ? (
                <span style={{fontFamily: theme.mono, fontSize: 13, color: withA(theme.dim, 0.7)}}>{aside.note}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {rail(railR, tipR)}
      <div
        style={{
          ...outE,
          width: 300,
          borderRadius: 14,
          border: `2px solid ${outTone}`,
          background: withA(outTone, 0.07),
          padding: '24px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 17, letterSpacing: 2, color: theme.dim}}>{output.label}</div>
        <div
          style={{
            marginTop: 12,
            fontFamily: theme.mono,
            fontVariantNumeric: 'tabular-nums',
            fontSize: 64,
            color: outTone,
          }}
        >
          {output.countTo !== undefined ? Math.round(outV) : output.value}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────── 八层栈

/** 层栈：自底向上垒起（层落=translateY+透明度），当前层金描边高亮，指定层降饱和。 */
export const LayerStack: React.FC<{
  at: number;
  /** 自底向上（i=0 为底层）。 */
  layers: readonly {name: string; sub?: string}[];
  /** 金描边高亮层索引。 */
  activeIndex?: number;
  /** 高亮出现时点（缺省 = 全部落板后）。 */
  activeAt?: number;
  /** 降饱和层索引（供给/出口区）。 */
  desat?: readonly number[];
  width?: number;
  layerH?: number;
}> = ({at, layers, activeIndex, activeAt, desat = [], width = 640, layerH = 56}) => {
  const frame = useCurrentFrame();
  const halo = useBreathe({period: 140, base: 0.45, amp: 0.55});
  const activeOn =
    activeIndex !== undefined ? progress(frame, activeAt ?? at + layers.length * 4 + 2, DUR.f3) : 0;
  return (
    <div style={{display: 'flex', flexDirection: 'column-reverse', gap: 10, width}}>
      {layers.map((l, i) => {
        const p = progress(frame, at + i * 4, DUR.f4);
        const active = activeIndex === i;
        const grey = desat.includes(i);
        return (
          <div
            key={l.name + i}
            style={{
              height: layerH,
              borderRadius: 9,
              border: `2px solid ${active ? theme.concept : theme.panelBorder}`,
              background: active ? withA(theme.concept, 0.1) : theme.panel,
              boxShadow:
                active && activeOn > 0
                  ? `0 0 ${20 * halo * activeOn + 6}px ${withA(theme.concept, 0.5 * activeOn)}`
                  : 'none',
              opacity: p * (grey ? 0.5 : 1),
              transform: `translateY(${(1 - p) * 26}px)`,
              display: 'flex',
              alignItems: 'center',
              padding: '0 20px',
              gap: 14,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 15, color: active ? theme.concept : theme.dim}}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: grey ? theme.dim : theme.text}}>
              {l.name}
            </span>
            {l.sub ? (
              <span style={{marginLeft: 'auto', fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{l.sub}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────── 韦恩交集

/** 两圆交叠：左=用户权限（中性）·右=权限天花板（紫）·交集区金亮 + 只减不增箭头。
 *  emptyAt 可选：交集塌缩为空（常态由 RevocationClock 承担，这里留给独立用法）。 */
export const VennIntersection: React.FC<{
  at: number;
  leftLabel: string;
  rightLabel: string;
  centerTag?: string;
  arrowLabel?: string;
  emptyAt?: number;
  /** 交集区一次性脉冲时点（缺省不脉冲）。 */
  impulseAt?: number;
  width?: number;
}> = ({at, leftLabel, rightLabel, centerTag = '实际权限', arrowLabel = '只减不增', emptyAt, impulseAt, width = 880}) => {
  const frame = useCurrentFrame();
  const drawL = useDraw(at, DUR.f6);
  const drawR = useDraw(at + 5, DUR.f6);
  const fill = progress(frame, at + 18, DUR.f5);
  const empty = emptyAt !== undefined ? progress(frame, emptyAt, DUR.f5) : 0;
  const pulse = useImpulse({at: impulseAt ?? 1e9, dur: 16, peak: 1});
  const H = 560;
  const cy = H / 2;
  const R = 205;
  const x1 = width / 2 - 82;
  const x2 = width / 2 + 82;
  const d = x2 - x1;
  const h = Math.sqrt(R * R - (d / 2) * (d / 2));
  const xm = (x1 + x2) / 2;
  // 透镜（交集）= 两段劣弧：先沿右圆左缘、再沿左圆右缘（均 sweep 0）
  const lens = `M ${xm} ${cy - h} A ${R} ${R} 0 0 0 ${xm} ${cy + h} A ${R} ${R} 0 0 0 ${xm} ${cy - h} Z`;
  return (
    <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
      <path d={lens} fill={theme.concept} opacity={fill * (1 - empty) * (0.34 + 0.4 * pulse)} />
      <circle cx={x1} cy={cy} r={R} fill="none" stroke={withA(theme.text, 0.55)} strokeWidth={2} {...drawL} />
      <circle cx={x2} cy={cy} r={R} fill="none" stroke={theme.conceptDeep} strokeWidth={2} {...drawR} />
      <g opacity={fill * (1 - empty)}>
        <line x1={xm} y1={cy - h + 58} x2={xm} y2={cy + h - 78} stroke={theme.concept} strokeWidth={3} />
        <polygon
          points={`${xm - 9},${cy + h - 80} ${xm + 9},${cy + h - 80} ${xm},${cy + h - 58}`}
          fill={theme.concept}
        />
        <text x={xm + 18} y={cy + 8} fill={theme.text} fontSize={22} fontFamily={theme.sans}>
          {arrowLabel}
        </text>
      </g>
      <text x={x1} y={cy + R + 44} textAnchor="middle" fill={theme.dim} fontSize={24} fontFamily={theme.sans} opacity={fill}>
        {leftLabel}
      </text>
      <text
        x={x2}
        y={cy + R + 44}
        textAnchor="middle"
        fill={theme.conceptDeep}
        fontSize={24}
        fontFamily={theme.sans}
        opacity={fill}
      >
        {rightLabel}
      </text>
      <text
        x={xm}
        y={cy - h - 18}
        textAnchor="middle"
        fill={theme.concept}
        fontSize={22}
        fontFamily={theme.mono}
        opacity={fill * (1 - empty)}
      >
        {centerTag}
      </text>
      {empty > 0 ? (
        <text x={xm} y={cy + 12} textAnchor="middle" fill={theme.danger} fontSize={44} fontFamily={theme.mono} opacity={empty}>
          {'∩ = ∅'}
        </text>
      ) : null}
    </svg>
  );
};

// ─────────────────────────────────────────────── 时间轴走查

/** 时间轴走查：事件点逐个落位 + 游标线性推进 + 交集胶囊塌缩为空。 */
export const RevocationClock: React.FC<{
  at: number;
  /** x 为轴上位置 0..1（缺省按序均分）；tone 缺省 text（拒绝事件传 theme.danger）。 */
  events: readonly {time: string; label: string; at: number; x?: number; tone?: string}[];
  /** 交集塌缩时点（胶囊收窄 → 空）。 */
  collapseAt?: number;
  /** 游标推进终点（缺省 = 末事件 at + 12）。 */
  endAt?: number;
  intersectTag?: string;
  emptyLabel?: string;
  width?: number;
}> = ({at, events, collapseAt, endAt, intersectTag = 'RBAC ∩ RSS', emptyLabel = '交集 = ∅', width = 1440}) => {
  const frame = useCurrentFrame();
  const axisO = progress(frame, at, DUR.f4);
  const stop = endAt ?? (events.length ? events[events.length - 1].at + 12 : at + 12);
  const cursor = progress(frame, at, Math.max(1, stop - at));
  const collapse = collapseAt !== undefined ? progress(frame, collapseAt, DUR.f5) : 0;
  const pad = 30;
  const inner = width - pad * 2;
  const X = (f: number) => f * inner;
  const capTone = collapse >= 1 ? theme.danger : theme.concept;
  return (
    <div style={{width, position: 'relative', height: 310, opacity: axisO}}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: Math.max(0, 360 * (1 - collapse)),
            height: 44,
            borderRadius: 22,
            border: `2px solid ${capTone}`,
            background: withA(capTone, 0.08),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {collapse < 0.6 ? (
            <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.concept, whiteSpace: 'nowrap'}}>
              {intersectTag}
            </span>
          ) : null}
        </div>
        {collapse >= 1 ? (
          <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.danger}}>{emptyLabel}</span>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 180}}>
        <div style={{position: 'absolute', left: pad, width: inner, height: 3, background: withA(theme.dim, 0.5)}} />
        <div style={{position: 'absolute', left: pad + X(cursor) - 1.5, top: -46, width: 3, height: 96, background: theme.text}}>
          <div
            style={{
              position: 'absolute',
              top: -12,
              left: -7,
              width: 0,
              height: 0,
              borderLeft: '8.5px solid transparent',
              borderRight: '8.5px solid transparent',
              borderTop: `12px solid ${theme.text}`,
            }}
          />
        </div>
        {events.map((ev, i) => {
          const f = ev.x ?? i / Math.max(1, events.length - 1);
          const p = progress(frame, ev.at, DUR.f4);
          const c = ev.tone ?? theme.text;
          return (
            <div
              key={ev.time + i}
              style={{
                position: 'absolute',
                left: pad + X(f),
                top: 0,
                transform: `translateX(-50%) translateY(${(1 - p) * -18}px)`,
                opacity: p,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <span style={{fontFamily: theme.mono, fontSize: 22, color: c, marginBottom: 8}}>{ev.time}</span>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: c,
                  boxShadow: `0 0 12px ${withA(c, 0.6)}`,
                }}
              />
              <span
                style={{
                  marginTop: 10,
                  fontFamily: theme.sans,
                  fontSize: 20,
                  color: theme.dim,
                  whiteSpace: 'nowrap',
                }}
              >
                {ev.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────── 表海网格

/** 表海：暗格铺底 + 金亮格按占比散布（确定性伪随机）+ 占比计量（useCount）。 */
export const TableSea: React.FC<{
  at: number;
  cols?: number;
  rows?: number;
  /** 金亮格占比（0..1）。 */
  litRatio?: number;
  totalLabel: string;
  litNote?: string;
  countAt?: number;
  cell?: number;
  gap?: number;
}> = ({
  at,
  cols = 30,
  rows = 13,
  litRatio = 0.05,
  totalLabel,
  litNote = '语义视图覆盖',
  countAt,
  cell = 30,
  gap = 7,
}) => {
  const frame = useCurrentFrame();
  const pct = useCount({to: litRatio * 100, at: countAt ?? at, dur: 46});
  const W = cols * cell + (cols - 1) * gap;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
      <div style={{position: 'relative', width: W, height: rows * cell + (rows - 1) * gap}}>
        {Array.from({length: cols * rows}, (_, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const p = progress(frame, at + r * 3 + Math.floor(c / 2), DUR.f3);
          const lit = ((i * 37 + 13) % 1000) < Math.round(litRatio * 1000);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: c * (cell + gap),
                top: r * (cell + gap),
                width: cell,
                height: cell,
                borderRadius: 4,
                background: lit ? withA(theme.concept, 0.9) : withA(theme.text, 0.055),
                boxShadow: lit ? `0 0 8px ${withA(theme.concept, 0.5)}` : 'none',
                opacity: p,
              }}
            />
          );
        })}
      </div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 22}}>
        <span style={{fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', fontSize: 52, color: theme.concept}}>
          {pct.toFixed(1)}
          {'%'}
        </span>
        <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.text}}>{litNote}</span>
        <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{totalLabel}</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────── CONFLICT 卡阵

/** 冲突卡阵：定义卡互相推挤抖动（确定性正弦）→ 裁决后收敛散开，人工裁决印章落位。 */
export const ConflictCards: React.FC<{
  at: number;
  labels: readonly {kicker?: string; title: string}[];
  /** 裁决章落位 + 抖动收敛时点。 */
  verdictAt: number;
  stampText?: string;
  note?: string;
}> = ({at, labels, verdictAt, stampText = '人工裁决', note}) => {
  const frame = useCurrentFrame();
  const settle = 1 - progress(frame, verdictAt, DUR.f5);
  const cols = 4;
  const CW = 320;
  const CH = 96;
  const GX = 22;
  const GY = 18;
  const rows = Math.ceil(labels.length / cols);
  const W = cols * CW + (cols - 1) * GX;
  const H = rows * CH + (rows - 1) * GY;
  const cx = W / 2;
  const cy = H / 2;
  return (
    <div style={{position: 'relative', width: W, height: H}}>
      <span
        style={{
          position: 'absolute',
          top: -48,
          left: 0,
          fontFamily: theme.mono,
          fontSize: 20,
          letterSpacing: 3,
          color: theme.dim,
        }}
      >
        {`CONFLICT × ${labels.length}`}
      </span>
      {labels.map((l, i) => {
        const p = progress(frame, at + i * 3, DUR.f3);
        const jx = Math.sin((frame + i * 29) / 2.7) * 3 * settle;
        const jy = Math.cos((frame + i * 17) / 3.1) * 2.2 * settle;
        const rot = Math.sin((frame + i * 11) / 3.7) * 1.1 * settle;
        const row = Math.floor(i / cols);
        const col = i % cols;
        const px = col * (CW + GX) + CW / 2;
        const py = row * (CH + GY) + CH / 2;
        const spread = 16 * (1 - settle);
        const dirx = (px - cx) / Math.max(60, Math.abs(px - cx));
        const diry = (py - cy) / Math.max(60, Math.abs(py - cy));
        return (
          <div
            key={l.title + i}
            style={{
              position: 'absolute',
              left: px - CW / 2,
              top: py - CH / 2,
              width: CW,
              height: CH,
              borderRadius: 10,
              border: `1.5px solid ${theme.panelBorder}`,
              background: theme.panel,
              opacity: p * (0.8 + 0.2 * settle),
              transform: `translate(${jx + dirx * spread}px, ${jy + diry * spread}px) rotate(${rot}deg)`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '0 18px',
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim}}>{l.kicker ?? '定义'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 21, color: theme.text, marginTop: 4}}>{l.title}</span>
          </div>
        );
      })}
      <VerdictSeal at={verdictAt} text={stampText} note={note} />
    </div>
  );
};

const VerdictSeal: React.FC<{at: number; text: string; note?: string}> = ({at, text, note}) => {
  const e = useEnter('fall', {at, dur: DUR.f5, dist: 70});
  const s = useSpring('settle', {at, dur: DUR.f5});
  return (
    <div style={{position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)'}}>
      <div
        style={{
          ...e,
          position: 'relative',
          transform: `${e.transform} scale(${0.7 + 0.3 * s}) rotate(-9deg)`,
          width: 250,
          height: 250,
          borderRadius: '50%',
          border: `4px solid ${theme.conceptDeep}`,
          background: withA(theme.panel, 0.88),
          boxShadow: `0 0 34px ${withA(theme.conceptDeep, 0.4)}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <div
          style={{position: 'absolute', inset: 12, borderRadius: '50%', border: `1.5px dashed ${withA(theme.conceptDeep, 0.6)}`}}
        />
        <span style={{fontFamily: theme.serif, fontSize: 40, fontWeight: 700, color: theme.conceptDeep}}>{text}</span>
        {note ? <span style={{fontFamily: theme.sans, fontSize: 18, color: theme.dim}}>{note}</span> : null}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────── 边界护栏卡

export type GuardrailCol = {tag: string; title: string; body: string; tone?: string};
export const GUARDRAIL_DEFAULT: readonly GuardrailCol[] = [
  {tag: 'INSIDE ENGINE', title: '引擎内', body: '定义、策略、账本都在执行点上 · 承诺有效', tone: theme.concept},
  {tag: 'OUTSIDE', title: '出楼', body: '直查底库、导出数据 · 治理承诺清零', tone: theme.dim},
  {tag: 'TRANSFORM LAYER', title: '转换层', body: '开放标准只管携带 · 数据质量是另一层的责任', tone: theme.conceptDeep},
];

/** 边界护栏卡三栏：横杆 + 立柱护语句，三栏错峰。 */
export const GuardrailCard: React.FC<{at?: number; cols?: readonly GuardrailCol[]; width?: number}> = ({
  at = 0,
  cols = GUARDRAIL_DEFAULT,
  width = 1620,
}) => {
  const ps = useStagger(cols.length, {at, stride: 10, dur: DUR.f5});
  return (
    <div style={{display: 'flex', gap: 26, width}}>
      {cols.map((c, i) => {
        const t = c.tone ?? theme.dim;
        return (
          <div key={c.tag} style={{flex: 1, opacity: ps[i], transform: `translateY(${(1 - ps[i]) * 22}px)`}}>
            <svg width="100%" height={30} viewBox="0 0 300 30" preserveAspectRatio="none">
              <line x1={0} y1={8} x2={300} y2={8} stroke={t} strokeWidth={4} />
              {[20, 150, 280].map((x) => (
                <line key={x} x1={x} y1={8} x2={x} y2={28} stroke={t} strokeWidth={4} />
              ))}
            </svg>
            <div
              style={{
                marginTop: 10,
                borderRadius: 12,
                border: `2px solid ${withA(t, 0.55)}`,
                background: theme.panel,
                padding: '24px 26px',
                minHeight: 220,
              }}
            >
              <div style={{fontFamily: theme.mono, fontSize: 15, letterSpacing: 2, color: t}}>{c.tag}</div>
              <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 36, fontWeight: 700, color: theme.text}}>
                {c.title}
              </div>
              <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 22, lineHeight: 1.6, color: theme.dim}}>
                {c.body}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────── 多双眼图标

const DEFAULT_EYES = [
  {label: '人', dx: -560, dy: -110},
  {label: '报表工具', dx: 0, dy: -300},
  {label: 'Agent', dx: 560, dy: -110},
] as const;

/** 多双眼环绕（定义卡居中由调用侧摆放）：眼睛错峰睁开 + 从中心探出。 */
export const EyeArray: React.FC<{
  at?: number;
  /** dx/dy 为相对画面中心（960,540）的 px 偏移。 */
  eyes?: readonly {label: string; dx: number; dy: number}[];
  iris?: string;
}> = ({at = 0, eyes = DEFAULT_EYES, iris}) => {
  const opens = useStagger(eyes.length, {at, stride: 11, dur: DUR.f5});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {eyes.map((eye, i) => {
        const o = opens[i];
        const len = Math.max(1, Math.hypot(eye.dx, eye.dy));
        const px = (eye.dx / len) * 42 * (1 - o);
        const py = (eye.dy / len) * 42 * (1 - o);
        return (
          <div
            key={eye.label + i}
            style={{
              position: 'absolute',
              left: 960 + eye.dx,
              top: 540 + eye.dy,
              transform: `translate(-50%, -50%) translate(${px}px, ${py}px)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <svg width={150} height={84} viewBox="0 0 150 84" style={{transform: `scaleY(${0.1 + 0.9 * o})`}}>
              <path d="M6 42 Q75 -14 144 42 Q75 98 6 42 Z" fill={theme.panel} stroke={withA(theme.text, 0.7)} strokeWidth={2} />
              <circle cx={75} cy={42} r={16} fill={iris ?? theme.text} />
              <circle cx={75} cy={42} r={7} fill={theme.bg} />
              <circle cx={80} cy={36} r={3} fill={theme.text} opacity={0.8} />
            </svg>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, opacity: o}}>{eye.label}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
