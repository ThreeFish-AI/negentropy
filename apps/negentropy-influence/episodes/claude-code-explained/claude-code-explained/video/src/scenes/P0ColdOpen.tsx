/** P0 会写不会做（p0-01..14，2 镜 0 cue）——分镜 0-A / 0-B（v3）。
 *
 *  ★ v3 换代（2026-10-14）：v2 的 5 镜 LoopRing/archify 叙事整体退役——
 *    v3 P0 只立「会写不会做」一个命题，不挂图、不立环体锚（环体自 P1 全景母图起才出场）。
 *  ★ 0-A 开篇首镜视听合力（RSI-039）：p0-01 落字时命令行逐字符打出又停住，
 *    光标呼吸；深底仅光标一处高亮，无装饰性入场。
 *  ★ 0-B 分屏搬运 + 双问题卡 + 四图标：用户在「模型/终端」间搬运，计数递增（不进字幕区）；
 *    p0-12 双问题卡红描边脉冲一次；p0-14 四图标（环/表/闸/钩）自左向右点亮成一排。
 *  色彩契约：core 陶土橙=环（循环）/ mech 青=表（工具分发）/ deny 珊瑚红=闸 / dim 银灰=钩；
 *  danger 红只给「危险」意象（p0-09/12 红描边）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel, SceneTag} from '../components/motifs';
import {
  DUR,
  clamp01,
  useBreathe,
  useCount,
  useEnter,
  useFlowDash,
  useImpulse,
  useProgress,
  useReveal,
  useStagger,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 0-A 命令行：p0-04 的「列个目录、跑个脚本」语义——一条合法、无害的 ls 命令。 */
const COMMAND = 'ls -la ./project && bash run_tests.sh';

// ── 0-A 终端冷启动 ──────────────────────────────────────────────────────

/** 终端窗居中：命令逐字符打出（p0-01 落字）又停住，光标孤闪。
 *  窗位于画布上半区，命令行落在字幕安全带（y≥920）之上。 */
const ColdTerminal: React.FC<{atTyping: number; atDim: number}> = ({atTyping, atDim}) => {
  const typed = useReveal(COMMAND, {at: atTyping, cps: 11});
  const done = typed.length >= COMMAND.length;
  // 光标呼吸：打字期实心常亮（0.9），停住后转入呼吸（0.15..1）——孤闪
  const breathe = useBreathe({period: 42, amp: 0.425, base: 0.575});
  const cursorOpacity = done ? breathe : 0.9;
  // 「没有然后」：p0-05 起整窗微压暗一档，镜尾（p0-06）随 0-B 交棒淡出
  const dim = 1 - 0.18 * useProgress(atDim, DUR.f6);
  const enter = useEnter('fade', {at: 0, dur: DUR.f4});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: enter.opacity * dim}}>
      <Panel style={{width: 1180, height: 400, padding: 0, overflow: 'hidden', marginTop: -60}}>
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
            <div key={i} style={{width: 12, height: 12, borderRadius: 999, background: theme.panelBorder}} />
          ))}
          <div style={{marginLeft: 10, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>zsh</div>
        </div>
        <div
          style={{
            padding: '56px 40px',
            fontFamily: theme.mono,
            fontSize: 38,
            lineHeight: 1.6,
            color: theme.text,
            whiteSpace: 'pre',
          }}
        >
          <span style={{color: theme.dim}}>$ </span>
          {typed}
          <span style={{color: theme.core, opacity: cursorOpacity}}>▍</span>
        </div>
      </Panel>
    </AbsoluteFill>
  );
};

// ── 0-B 分屏搬运 ────────────────────────────────────────────────────────

/** 双节点中心位（左：模型 / 右：终端）。上半区，y ≤ 560，给下半问题卡与图标让位。 */
const NODE = {y: 300, w: 380, h: 180, leftX: 330, rightX: 1590} as const;
/** 用户图标在两节点间往返一程的位置带（节点内缘之间）。 */
const TRAVEL = {x0: NODE.leftX + NODE.w / 2 + 50, x1: NODE.rightX - NODE.w / 2 - 50} as const;

/** 搬运来回（bespoke 逃生舱：机械感是主题，等速三角波不走缓动）：
 *  t^1.6 把进度前松后紧——往返越来越密（加速），5 次往返后停靠左端。 */
const useCarrierX = (atStart: number, atEnd: number): number => {
  const frame = useCurrentFrame();
  const t = clamp01((frame - atStart) / Math.max(1, atEnd - atStart));
  const phase = Math.pow(t, 1.6) * 5;
  const frac = phase - Math.floor(phase);
  // 一次往返 = 三角波：0→1→0
  const tri = frac < 0.5 ? frac * 2 : (1 - frac) * 2;
  return TRAVEL.x0 + (TRAVEL.x1 - TRAVEL.x0) * tri;
};

const NodeBox: React.FC<{label: string; sub: string; cx: number; accent: string; enterAt: number}> = ({
  label,
  sub,
  cx,
  accent,
  enterAt,
}) => {
  const e = useEnter('rise', {at: enterAt, dur: DUR.f5, dist: 24, restBottom: NODE.y + NODE.h / 2});
  return (
    <div
      style={{
        position: 'absolute',
        left: cx - NODE.w / 2,
        top: NODE.y - NODE.h / 2,
        width: NODE.w,
        height: NODE.h,
        opacity: e.opacity,
        transform: e.transform,
      }}
    >
      <Panel accent={accent} style={{width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10}}>
        <div style={{fontFamily: theme.serif, fontSize: 46, fontWeight: 700, color: accent}}>{label}</div>
        <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{sub}</div>
      </Panel>
    </div>
  );
};

/** 搬运场景：左右节点 + 虚线通道 + 用户小人往返 + 计数。 */
const CarryScene: React.FC<{atCarry: number; atEnd: number; atDanger: number}> = ({atCarry, atEnd, atDanger}) => {
  const x = useCarrierX(atCarry, atEnd);
  const flow = useFlowDash({dash: 14, gap: 12, period: 34});
  const count = useCount({from: 0, to: 128, at: atCarry, dur: atEnd - atCarry, ease: 'accelerate'});
  const enter = useEnter('fade', {at: 0, dur: DUR.f4});
  // 用户小人：搬运中保持中性银灰（dim）；p0-09 危险命令一过，小人在「停手」瞬间描边转红
  const stop = useImpulse({at: atDanger, dur: DUR.f6, peak: 1});
  const personColor = stop > 0.01 ? theme.danger : theme.dim;
  // 搬运收束（p0-11「得自动化」）：人退出回路——小人淡到 25%，计数定格作为「搬运了这么多」的遗迹
  const personOpacity = 1 - 0.75 * useProgress(atEnd, DUR.f6);
  return (
    <AbsoluteFill style={{opacity: enter.opacity}}>
      <NodeBox label="模型" sub="LLM" cx={NODE.leftX} accent={theme.mech} enterAt={0} />
      <NodeBox label="终端" sub="shell" cx={NODE.rightX} accent={theme.core} enterAt={DUR.f2} />
      {/* 虚线通道 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line
          x1={TRAVEL.x0 - 30}
          y1={NODE.y}
          x2={TRAVEL.x1 + 30}
          y2={NODE.y}
          stroke={withAlpha(theme.dim, 0.55)}
          strokeWidth={4}
          {...flow}
        />
        {/* 用户小人：头 + 肩，沿通道往返；搬运中的「命令」/「结果」小卡随其移动 */}
        <g transform={`translate(${x}, ${NODE.y})`} opacity={personOpacity}>
          <circle cx={0} cy={-24} r={20} fill={personColor} />
          <path d="M-36 40 Q-36 -2 0 -6 Q36 -2 36 40 Z" fill={personColor} />
        </g>
      </svg>
      {/* 搬运计数：左上节点下方，y≈480，避开字幕带（y≥920）与章节条 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 450,
          textAlign: 'center',
          fontFamily: theme.mono,
          fontSize: 34,
          color: theme.dim,
        }}
      >
        <span>搬运 </span>
        <span style={{color: theme.text, fontSize: 56, fontWeight: 700, fontVariantNumeric: 'tabular-nums'}}>
          {Math.round(count)}
        </span>
        <span> 次</span>
      </div>
    </AbsoluteFill>
  );
};

/** 双问题卡：左「怎么让它自己动手」/右「凭什么敢放手」；红描边脉冲一次（p0-12 起）。 */
const QuestionCards: React.FC<{atShow: number; atPulse: number}> = ({atShow, atPulse}) => {
  const [leftIn, rightIn] = useStagger(2, {at: atShow, dur: DUR.f5, stride: DUR.f4});
  const pulse = useImpulse({at: atPulse, dur: DUR.f6, peak: 1});
  // 脉冲之后转入低幅呼吸：问题悬而未决的「心跳」，避免 p0-12..13 整段静帧
  const settled = useProgress(atPulse + DUR.f6, DUR.f5);
  const heartbeat = useBreathe({period: 54, amp: 0.2, base: 0.25}) * settled;
  const cards = [
    {text: '怎么让它自己动手', accent: theme.mech, p: leftIn, glow: 0},
    {text: '凭什么敢放手', accent: theme.danger, p: rightIn, glow: Math.max(pulse, heartbeat)},
  ];
  return (
    <>
      {cards.map((c, i) => (
        <div
          key={c.text}
          style={{
            position: 'absolute',
            left: i === 0 ? 220 : 1000,
            top: 590,
            width: 700,
            opacity: c.p,
            transform: `translateY(${(1 - c.p) * 20}px)`,
          }}
        >
          <Panel
            accent={withAlpha(c.accent, 0.55 + 0.45 * c.glow)}
            style={{
              padding: '26px 30px',
              textAlign: 'center',
              fontFamily: theme.serif,
              fontSize: 44,
              fontWeight: 700,
              color: theme.text,
              boxShadow: c.glow > 0.05 ? `0 0 ${24 * c.glow}px ${withAlpha(c.accent, 0.5 * c.glow)}` : undefined,
            }}
          >
            {c.text}
          </Panel>
        </div>
      ))}
    </>
  );
};

/** 四枚小图标：环 / 表 / 闸 / 钩——自左向右点亮成横排等距一排。
 *  线框图标（SVG 路径），契约色：环=core / 表=mech / 闸=deny / 钩=dim 银灰。 */
const ICONS: {key: string; label: string; color: string; node: React.ReactNode}[] = [
  {
    key: 'loop',
    label: '循环',
    color: theme.core,
    node: <circle cx={0} cy={0} r={26} fill="none" strokeWidth={6} />,
  },
  {
    key: 'table',
    label: '表',
    color: theme.mech,
    node: (
      <g fill="none" strokeWidth={5}>
        <rect x={-28} y={-24} width={56} height={48} rx={4} />
        <line x1={-28} y1={-6} x2={28} y2={-6} />
        <line x1={0} y1={-6} x2={0} y2={24} />
      </g>
    ),
  },
  {
    key: 'gate',
    label: '闸门',
    color: theme.deny,
    node: (
      <g fill="none" strokeWidth={6}>
        <line x1={-26} y1={-26} x2={-26} y2={26} />
        <line x1={26} y1={-26} x2={26} y2={26} />
        <line x1={-26} y1={-8} x2={26} y2={-8} />
      </g>
    ),
  },
  {
    key: 'hook',
    label: '挂点',
    color: theme.dim,
    node: (
      <g fill="none" strokeWidth={6} strokeLinecap="round">
        <line x1={0} y1={-26} x2={0} y2={8} />
        <path d="M0 8 Q0 24 -16 24" />
      </g>
    ),
  },
];

const FourIcons: React.FC<{atStart: number; total: number}> = ({atStart, total}) => {
  const ps = useStagger(ICONS.length, {at: atStart, dur: DUR.f5, fit: {total}});
  const gap = 300;
  const x0 = 960 - (gap * (ICONS.length - 1)) / 2;
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
      {ICONS.map((ic, i) => {
        const p = ps[i];
        return (
          <g key={ic.key} transform={`translate(${x0 + gap * i}, 800)`} opacity={p}>
            <g stroke={withAlpha(ic.color, 0.35 + 0.65 * p)}>{ic.node}</g>
            <text
              x={0}
              y={64}
              textAnchor="middle"
              fontFamily={theme.sans}
              fontSize={26}
              fill={withAlpha(p > 0.5 ? ic.color : theme.dim, 1)}
            >
              {ic.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P0ColdOpen: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;

  const bA = w('p0-01', 'p0-06');
  const bB = w('p0-07', 'p0-14');

  return (
    <AbsoluteFill>
      <SceneTag chapter="P0" tagline="会写不会做" />

      <Sequence {...bA} name="0-A 终端冷启动">
        <ColdTerminal atTyping={0} atDim={at('p0-05') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="0-B 分屏搬运">
        {/* 局部帧 0 = p0-07 起点；各时点由句 id 边界推导（at(id) − bB.from） */}
        <CarryScene
          atCarry={0}
          atEnd={at('p0-11') - bB.from}
          atDanger={at('p0-09') - bB.from}
        />
        <QuestionCards atShow={at('p0-11') - bB.from} atPulse={at('p0-12') - bB.from} />
        <FourIcons atStart={at('p0-14') - bB.from} total={w('p0-14').durationInFrames * 0.7} />
      </Sequence>
    </AbsoluteFill>
  );
};
