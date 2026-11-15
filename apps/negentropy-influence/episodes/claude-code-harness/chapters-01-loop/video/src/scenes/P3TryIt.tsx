/** P3 试一下（p3-01..p3-07，5 镜）——分镜 3-A..3-E（storyboard v5）。
 *
 *  ★ 仿真实终端会话：`$ python agent_loop/code.py` 启动 + 源页英文 prompt 原文
 *    逐字敲入（口播为中文释义——声画各司其职）；右侧消息列四格两轮生长；命令真跑、
 *    输出滚出（青碧）、出口正门开启（确认绿全片首开）、环体停转；第二问快速复演
 *    （两拍计数）+ 观察重点双卡（符号语言零成句）。安全提示（临时测试目录）为
 *    3-A 视觉角标不口播。
 *  ★ 幕级 M-001 缩悬环：右上角跨五镜不断相；每轮调用走一格、循环退出即停转
 *    （P2 同形先例）。prompt 原文取 pinned 归档 §试一下（MIT）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, SceneTag, Terminal, type RingNode} from '../components/motifs';
import {DUR, clamp01, useDim, useDraw, useEnter, useImpulse, useProgress, useStagger} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 五站位（P1/P2 同构缩微） */
const STATIONS: RingNode[] = [0, 1, 2, 3, 4].map((i) => ({label: `s${i + 1}`, angle: -90 + i * 72}));

const TERM = {x: 130, y: 210, w: 780, h: 470} as const;
const MSG = {x: 990, y: 250, w: 470, slotH: 80, gap: 16} as const;
const slotTop = (i: number) => MSG.y + i * (MSG.slotH + MSG.gap);
const RING = {size: 140, x: 1700, y: 88} as const;

type MsgFill = {slot: number; role: string; label: string; at: number; accent?: string; mono?: string; pair?: boolean};

/** 出口正门（P2Walkthrough ExitGate 词汇继承：引线 + 对开门 + 「出口」） */
const ExitGate: React.FC<{at: number}> = ({at}) => {
  const lead = Math.max(0, at - DUR.f3);
  const line = useDraw(lead, DUR.f4);
  const o = useProgress(lead, DUR.f3);
  const open = useProgress(at, DUR.f5, 'decelerate');
  const ang = 78 * open;
  return (
    <div style={{position: 'absolute', left: RING.x - 44, top: RING.y + 20, opacity: o}}>
      <svg width={160} height={100} style={{overflow: 'visible'}}>
        <line x1={0} y1={50} x2={44} y2={50} stroke={theme.ok} strokeWidth={3} {...line} />
        <line x1={48} y1={16} x2={48} y2={84} stroke={theme.ok} strokeWidth={3} />
        <line x1={116} y1={16} x2={116} y2={84} stroke={theme.ok} strokeWidth={3} />
        <rect x={50} y={24} width={24} height={52} fill="none" stroke={theme.ok} strokeWidth={3} transform={`rotate(${-ang} 50 50)`} />
        <rect x={90} y={24} width={24} height={52} fill="none" stroke={theme.ok} strokeWidth={3} transform={`rotate(${ang} 116 50)`} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 34,
          top: -24,
          fontFamily: theme.sans,
          fontSize: 21,
          fontWeight: 600,
          color: theme.ok,
          opacity: open,
          whiteSpace: 'nowrap',
        }}
      >
        {'出口'}
      </div>
    </div>
  );
};

/** ── Stage：act 级（终端 + 消息列 + 环 mini + 出口门；跨镜状态累积） ── */
const Stage: React.FC<{
  lines: {text: string; delay: number; color?: string; prompt?: string}[];
  fills: MsgFill[];
  gateAt: number;
  stopAt: number;
  /** 环走格锚（第一轮执行拍） */
  walkAt: number;
}> = ({lines, fills, gateAt, stopAt, walkAt}) => {
  const frame = useCurrentFrame();
  const termO = useProgress(0, DUR.f4);
  const listO = useProgress(DUR.f3, DUR.f4);
  const slots = useStagger(4, {at: 6, stride: 8, dur: DUR.f3});
  // 环 mini：第一轮执行走一格（0→0.2），stopAt 起冻结（停转=退出）
  const walk = clamp01(useProgress(walkAt, 26, 'linear')) * 0.2;
  const dot = frame >= stopAt ? walk : walk;
  return (
    <>
      <SceneTag chapter="试一下" tagline="真实跑一遍" accent={theme.core} />
      {/* 终端（真实会话感；行延迟=句锚） */}
      <div style={{position: 'absolute', left: TERM.x, top: TERM.y, opacity: termO}}>
        <Terminal lines={lines} width={TERM.w} height={TERM.h} cps={13} title="agent_loop" freezeCursorAt={stopAt} />
      </div>
      {/* 消息列表四格 */}
      <div style={{position: 'absolute', left: MSG.x, top: MSG.y - 40, fontFamily: theme.mono, fontSize: 20, color: theme.dim, opacity: listO}}>
        {'messages'}
      </div>
      {[0, 1, 2, 3].map((i) => {
        const fill = fills.find((f) => f.slot === i);
        const shown = fill !== undefined && frame >= fill.at;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: MSG.x,
              top: slotTop(i),
              width: MSG.w,
              height: MSG.slotH,
              borderRadius: 10,
              border: `2px ${shown && fill ? 'solid' : 'dashed'} ${shown && fill ? (fill.accent ?? theme.panelBorder) : theme.panelBorder}`,
              background: shown && fill && fill.accent ? `${fill.accent}12` : 'transparent',
              opacity: slots[i] * (shown ? 1 : 0.55),
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '0 18px',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {shown && fill ? (
              <>
                <span style={{fontFamily: theme.mono, fontSize: 16, color: fill.accent ?? theme.dim}}>{fill.role}</span>
                <span style={{fontFamily: theme.sans, fontSize: 24, fontWeight: 600, color: theme.text}}>{fill.label}</span>
                {fill.mono ? (
                  <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim}}>{fill.mono}</span>
                ) : null}
                {fill.pair ? (
                  <span style={{fontFamily: theme.mono, fontSize: 14, color: theme.dim, marginLeft: 'auto', padding: '1px 8px', borderRadius: 6, border: `1.5px solid ${theme.panelBorder}`}}>
                    {'#01'}
                  </span>
                ) : null}
              </>
            ) : (
              <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.panelBorder}}>{String(i + 1).padStart(2, '0')}</span>
            )}
          </div>
        );
      })}
      {/* 环 mini + 出口门 */}
      <div style={{position: 'absolute', left: RING.x, top: RING.y, opacity: 0.95}}>
        <LoopRing size={RING.size} nodes={STATIONS} showLabels={false} showExit={false} dotProgress={dot} />
      </div>
      <ExitGate at={gateAt} />
    </>
  );
};

// ── 3-A：盾形安全角标 ────────────────────────────────────────────────────

const SafetyShield: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('pop', {at, dur: DUR.f4});
  return (
    <div style={{position: 'absolute', left: TERM.x + TERM.w - 250, top: TERM.y + TERM.h - 74, ...e, opacity: e.opacity * 0.85}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', borderRadius: 10, border: `2px solid ${theme.panelBorder}`, background: theme.bg}}>
        <svg width={22} height={26} viewBox="0 0 22 26">
          <path d="M11 2 L20 6 V13 Q20 21 11 24 Q2 21 2 13 V6 Z" fill="none" stroke={theme.dim} strokeWidth={2.5} />
          <path d="M7 13 L10 16 L15 9" fill="none" stroke={theme.dim} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'临时测试目录'}</span>
      </div>
    </div>
  );
};

// ── 3-B：调用块飞行（消息列 → 终端执行 → 回喂） ─────────────────────────

const CallFly: React.FC<{atCall: number; atExec: number; atFeed: number; cmd: string}> = ({atCall, atExec, atFeed, cmd}) => {
  const call = useEnter('pop', {at: atCall, dur: DUR.f4});
  const pulse = useImpulse({at: atExec, dur: DUR.f6});
  const feed = useProgress(atFeed, DUR.f5, 'decelerate');
  const p0 = {x: MSG.x + 60, y: slotTop(1) + MSG.slotH / 2};
  const p2 = {x: TERM.x + TERM.w - 60, y: TERM.y + TERM.h - 60};
  const px = p0.x + (p2.x - p0.x) * feed;
  const py = p0.y + (p2.y - p0.y) * feed;
  return (
    <AbsoluteFill>
      {/* 调用块（携命令签；p3-02「参数已经写好」词位命令签翻开；回喂起随飞行淡出让位，勿压 tool_result 卡） */}
      <div style={{position: 'absolute', left: MSG.x + 40, top: slotTop(1) + MSG.slotH + 26, ...call, opacity: call.opacity * (1 - feed)}}>
        <div style={{position: 'relative'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              padding: '9px 16px',
              borderRadius: 10,
              border: `2.5px solid ${theme.tool}`,
              background: `${theme.tool}26`,
              boxShadow: `0 0 ${20 * pulse}px ${theme.tool}`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.tool}}>{'tool_use'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.text}}>{cmd}</span>
          </div>
        </div>
      </div>
      {/* 执行→回喂 走线（光点沿抛物弧：概念引导元素合法走弧） */}
      {feed > 0.02 && feed < 0.98 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          <circle cx={px} cy={py - Math.sin(Math.PI * feed) * 70} r={9} fill={theme.tool} opacity={0.9} />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};

// ── 3-C：空缺脉冲（对照前轮） ───────────────────────────────────────────

const VacancyBeat: React.FC<{at: number}> = ({at}) => {
  const pulse = useImpulse({at, dur: DUR.f6, peak: 0.08});
  return (
    <div
      style={{
        position: 'absolute',
        left: MSG.x + 40,
        top: slotTop(3) + MSG.slotH + 24,
        width: 250,
        height: 54,
        boxSizing: 'border-box',
        borderRadius: 8,
        border: `2.5px dashed ${theme.panelBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        transform: `scale(${1 + pulse})`,
        opacity: 0.85,
      }}
    >
      <span style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{'tool_use'}</span>
      <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'∅'}</span>
    </div>
  );
};

// ── 3-D：快速复演（两拍） ────────────────────────────────────────────────

const ReplayBeats: React.FC<{beat1At: number; beat2At: number; countAt: number}> = ({beat1At, beat2At, countAt}) => {
  const b1 = useEnter('pop', {at: beat1At, dur: DUR.f4});
  const b2 = useEnter('pop', {at: beat2At, dur: DUR.f4});
  const count = useEnter('pop', {at: countAt, dur: DUR.f4, springPreset: 'settle'});
  const chip: React.CSSProperties = {
    padding: '10px 24px',
    borderRadius: 999,
    border: `2.5px solid`,
    fontFamily: theme.sans,
    fontSize: 26,
    fontWeight: 600,
    background: theme.bg,
  };
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, right: 0, top: 740, display: 'flex', justifyContent: 'center', gap: 40}}>
        <div style={{...chip, borderColor: theme.tool, ...b1}}>
          <span style={{color: theme.dim}}>{'拍① '}</span>
          <span style={{color: theme.tool}}>{'调用'}</span>
        </div>
        <div style={{...chip, borderColor: theme.core, ...b2}}>
          <span style={{color: theme.dim}}>{'拍② '}</span>
          <span style={{color: theme.core}}>{'作答'}</span>
        </div>
        <div style={{...chip, borderColor: theme.panelBorder, ...count}}>
          <span style={{color: theme.text, fontVariantNumeric: 'tabular-nums'}}>{'×2'}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 3-E：观察重点双卡（符号语言零成句） ─────────────────────────────────

const ObservedCards: React.FC<{atL: number; atR: number; spinAt: number; stopAt: number}> = ({atL, atR, spinAt, stopAt}) => {
  const dim = useDim({at: atL - DUR.f4, to: 0.35, dur: DUR.f5});
  const l = useEnter('pop', {at: atL, dur: DUR.f4, springPreset: 'settle'});
  const r = useEnter('pop', {at: atR, dur: DUR.f4, springPreset: 'settle'});
  // 左卡环转 icon 转（「循环继续」词位）、右卡停（「循环就结束」词位）
  const spin = clamp01(useProgress(spinAt, 30, 'linear')) * 360;
  const stopPulse = useImpulse({at: stopAt, dur: DUR.f5});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, background: theme.bg, opacity: (1 - dim) * 0.62}} />
      <div style={{position: 'absolute', left: 330, top: 400, ...l}}>
        <Panel accent={theme.core} style={{width: 480, padding: '30px 34px', textAlign: 'center'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22}}>
            <span style={{fontFamily: theme.mono, fontSize: 30, color: theme.tool}}>{'tool_use ✓'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>{'→'}</span>
            <svg width={54} height={54} viewBox="0 0 44 44">
              <g transform={`rotate(${spin} 22 22)`}>
                <path d="M35 22 A 13 13 0 1 1 22 9" fill="none" stroke={theme.core} strokeWidth={4.5} strokeLinecap="round" />
                <path d="M14 3 L30 9 L14 15 Z" fill={theme.core} />
              </g>
            </svg>
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 1110, top: 400, ...r}}>
        <Panel accent={theme.ok} style={{width: 480, padding: '30px 34px', textAlign: 'center'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22}}>
            <span style={{fontFamily: theme.mono, fontSize: 30, color: theme.dim}}>{'∅'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>{'→'}</span>
            <svg width={54} height={54} viewBox="0 0 44 44">
              <g stroke={theme.ok} strokeWidth={4.5} fill="none" strokeLinecap="round">
                <circle cx={22} cy={22} r={13} opacity={0.9 + 0.1 * stopPulse} />
                <line x1={22} y1={9} x2={22} y2={35} opacity={0.9 + 0.1 * stopPulse} />
              </g>
            </svg>
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P3TryIt: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p3-01');
  const bB = w('p3-02', 'p3-03');
  const bC = w('p3-04', 'p3-05');
  const bD = w('p3-06');
  const bE = w('p3-07');

  // 终端行锚（scene 局部）
  const tBoot = wa('p3-01', 0.2);
  const tPrompt1 = wa('p3-01', 0.55);
  const tExec1 = wa('p3-03', 0.2);
  const tOut1 = wa('p3-03', 0.55);
  const tExit = wa('p3-05', 0.7);
  const tPrompt2 = wa('p3-06', 0.24);
  const tExec2 = wa('p3-06', 0.55);
  const tOut2 = wa('p3-06', 0.82);

  // 消息格锚
  const slot1 = wa('p3-01', 0.86);
  const slot2 = wa('p3-02', 0.3);
  const slot3 = wa('p3-03', 0.82);
  const slot4 = wa('p3-04', 0.5);
  // 环与门
  const walkAt = tExec1;
  const gateAt = wa('p3-05', 0.5);
  const stopAt = wa('p3-05', 0.82);

  const lines = [
    {text: 'python agent_loop/code.py', delay: tBoot, prompt: '$ '},
    {text: 'List all Python files in this directory', delay: tPrompt1, prompt: '>> '},
    {text: '$ ls *.py', delay: tExec1, color: theme.tool},
    {text: 'a.py  b.py  c.py  demo.py', delay: tOut1, color: theme.dim},
    {text: 'loop exited', delay: tExit, prompt: '$ ', color: theme.dim},
    {text: 'What is the current git branch?', delay: tPrompt2, prompt: '>> '},
    {text: '$ git branch --show-current', delay: tExec2, color: theme.tool},
    {text: 'feature/agent-loop', delay: tOut2, color: theme.dim},
  ];

  return (
    <AbsoluteFill>
      <Stage
        lines={lines}
        fills={[
          {slot: 0, role: 'user', label: '问题 · 列文件', at: slot1},
          {slot: 1, role: 'assistant', label: '调用', at: slot2, accent: theme.core, mono: 'ls *.py', pair: true},
          {slot: 2, role: 'user', label: 'tool_result', at: slot3, accent: theme.tool, mono: '目录清单', pair: true},
          {slot: 3, role: 'assistant', label: '纯文本回答', at: slot4, accent: theme.core},
        ]}
        gateAt={gateAt}
        stopAt={stopAt}
        walkAt={walkAt}
      />

      <Sequence {...bA} name="3-A 会话开场">
        <SafetyShield at={wa('p3-01', 0.9) - bA.from} />
        <Footnote delay={10}>{'prompt · messages[0]'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="3-B 第一轮 · 调用">
        <CallFly
          atCall={wa('p3-02', 0.3) - bB.from}
          atExec={tExec1 - bB.from}
          atFeed={wa('p3-03', 0.6) - bB.from}
          cmd={'ls *.py'}
        />
        <Footnote delay={6}>{'tool_use → run_bash'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="3-C 第二轮 · 出口">
        <VacancyBeat at={wa('p3-04', 0.66) - bC.from} />
        <Footnote delay={6}>{'no tool_use → exit'}</Footnote>
      </Sequence>

      <Sequence {...bD} name="3-D 快速复演">
        <ReplayBeats
          beat1At={wa('p3-06', 0.52) - bD.from}
          beat2At={wa('p3-06', 0.72) - bD.from}
          countAt={wa('p3-06', 0.9) - bD.from}
        />
        <Footnote delay={6}>{'git branch --show-current'}</Footnote>
      </Sequence>

      <Sequence {...bE} name="3-E 观察重点">
        <ObservedCards
          atL={wa('p3-07', 0.18) - bE.from}
          atR={wa('p3-07', 0.5) - bE.from}
          spinAt={wa('p3-07', 0.3) - bE.from}
          stopAt={wa('p3-07', 0.82) - bE.from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3TryIt;
