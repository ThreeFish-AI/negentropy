/** P5 诚实的边界（p5-01..30，6 镜 13 cue）——分镜 5-A…5-F。
 *
 *  ★ 5-A 大实话先行：工坊打烊 deny 渐暗主调——顶灯熄灭、清洗槽滚筒停转
 *    （mech→mechDeep）、定时钟秒针停在半途（ClockFace dead 混入 deny）、师傅离场。
 *  ★ 5-B/5-C durable 边界＋官方三档：两图全屏接力（p5-04/p5-10/p5-11/p5-16
 *    空窗句回落）；5-D 传送带自白：timing-panorama 三章（p5-18/p5-20/p5-22 回落）。
 *  ★ 5-E 产品侧单线圈：LoopRing 复用（core 橙描边恒定〔M-001〕——与传送带同锚），
 *    箭头离圈不回；【三】归属引语卡；教学版↔产品对撞双卡。
 *  ★ 5-F 收束：两问句亮起、第三问灰置打叉——「同时能跑几个」留给下期维度。
 *    无锚 run（p5-24..p6-05）贴 12 上限：p5-23 threads-not-tools 与 p6-06 的
 *    邻接 cue 是 run 边界，不得挪动。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ClockFace} from '../components/clock-face';
import {QuoteCard} from '../components/cards';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {
  DUR,
  clamp01,
  progress,
  useDim,
  useDraw,
  useEnter,
  useFlowDash,
  useImpulse,
  useProgress,
  useReveal,
  useStagger,
  useTravel,
} from '../motion';

/** 常驻系列条定位：与 SceneTag 同行（P1–P6 同值，由 Integrate 统一核对） */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** hex + 确定性透明度（帧驱动；无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 师傅剪影——text 白无彩（人一律无彩） */
const Person: React.FC<{x: number; y: number; scale?: number; opacity?: number}> = ({
  x,
  y,
  scale = 1,
  opacity = 0.88,
}) => (
  <svg
    width={120 * scale}
    height={180 * scale}
    viewBox="0 0 120 180"
    style={{position: 'absolute', left: x, top: y, opacity}}
  >
    <circle cx={60} cy={34} r={28} fill={theme.text} />
    <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={theme.text} />
  </svg>
);

// ── 5-A 大实话先行：打烊灯灭（p5-01..03） ───────────────────────────────

/** 秒针停摆角度（半途——停在 4 点多钟的位置，永不走完这一圈） */
const STOP_DEG = 137;

const ClosingDown: React.FC<{atDie: number; atGone: number}> = ({atDie, atGone}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const shell = useProgress(2, DUR.f5);
  // 顶灯熄灭：光锥随 deny 包络收黑（灯灭是渐暗不是闪断）
  const dieP = useProgress(atDie, DUR.f6);
  // 师傅离场：走开 + 淡出背影
  const leaveP = useProgress(atGone, DUR.f6);
  // 清洗槽滚筒：转到位即停（帧驱动纯函数——机械感等速）
  const drumStop = atDie + DUR.f4;
  const drumRot = 120 * clamp01(progress(frame, DUR.f5, drumStop - DUR.f5));
  const sinkDim = useDim({at: atDie, to: 0.4, dur: DUR.f5});
  // 定时钟：秒针匀速绕行 → 停在半途（useTravel 连续，停摆帧起冻结）
  const SEC_PER_LAP = 6;
  const travel = useTravel({cx: 0, cy: 0, r: 1, secPerLap: SEC_PER_LAP});
  const frozen = ((((drumStop / (fps * SEC_PER_LAP)) % 1) + 1) % 1) * 360;
  const secDeg = frame <= drumStop ? travel.angle + 90 : frozen;
  const dead = useProgress(drumStop, DUR.f5);

  return (
    <AbsoluteFill>
      {/* 工坊轮廓（dim——打烊的空壳） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: shell}}>
        <path
          d="M300 330 L960 190 L1620 330 V860 H300 Z"
          fill="none"
          stroke={theme.panelBorder}
          strokeWidth={5}
        />
        {/* 顶灯吊线 + 灯罩 */}
        <line x1={960} y1={232} x2={960} y2={330} stroke={theme.panelBorder} strokeWidth={4} />
        <path d="M920 330 L1000 330 L960 300 Z" fill={theme.panel} stroke={theme.dim} strokeWidth={3} />
        {/* 光锥：熄灭前可见（text 微光），deny 边环渐起 */}
        <polygon
          points={`918,332 1002,332 1240,860 680,860`}
          fill={withAlpha(theme.text, 0.07 * (1 - dieP))}
        />
        <polygon
          points={`918,332 1002,332 1240,860 680,860`}
          fill="none"
          stroke={withAlpha(theme.deny, 0.5 * dieP)}
          strokeWidth={3}
        />
      </svg>
      {/* deny 渐暗主调：全屏低透明包络（打烊氛围，非告警） */}
      <div style={{position: 'absolute', inset: 0, background: theme.deny, opacity: 0.1 * dieP}} />

      {/* 清洗槽（左）：滚筒停转 + mech→mechDeep 暗态 */}
      <div style={{position: 'absolute', left: 430, top: 560, opacity: sinkDim}}>
        <svg width={220} height={220}>
          <rect x={4} y={4} width={212} height={212} rx={18} fill={theme.panel} stroke={theme.mechDeep} strokeWidth={4} />
          <g transform={`rotate(${drumRot} 110 110)`}>
            <circle cx={110} cy={110} r={74} fill="none" stroke={theme.mechDeep} strokeWidth={6} />
            <line x1={110} y1={36} x2={110} y2={184} stroke={theme.mechDeep} strokeWidth={4} opacity={0.6} />
            <line x1={36} y1={110} x2={184} y2={110} stroke={theme.mechDeep} strokeWidth={4} opacity={0.6} />
          </g>
        </svg>
        <div
          style={{
            marginTop: 12,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 23,
            color: theme.dim,
          }}
        >
          {'清洗槽 · 断电'}
        </div>
      </div>

      {/* 定时钟（右）：秒针停在半途（deny 混入——进程死了钟停摆） */}
      <ClockFace cx={1440} cy={520} r={92} secDeg={secDeg} dead={dead} />
      <div
        style={{
          position: 'absolute',
          left: 1310,
          top: 650,
          width: 260,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 23,
          color: theme.dim,
          opacity: dead,
        }}
      >
        {'钟 · 停摆'}
      </div>

      {/* 师傅剪影：离场背影 */}
      <Person x={760 + 240 * leaveP} y={600} scale={0.9} opacity={0.88 * (1 - 0.7 * leaveP)} />

      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 250,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 42,
          fontWeight: 700,
          color: theme.text,
          opacity: shell,
        }}
      >
        <span style={{color: theme.deny}}>{'打烊'}</span>
        <span style={{color: theme.dim}}>{' · '}</span>
        <span>{'大实话在前'}</span>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B p5-04 空窗回落：设问小字 ────────────────────────────────────────

const AskWhat: React.FC = () => {
  const e = useEnter('fade', {at: 2, dur: DUR.f5});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', ...e}}>
      <div style={{fontFamily: theme.serif, fontSize: 54, fontWeight: 700, color: theme.text}}>
        {'存的是什么？'}
      </div>
      <div style={{marginTop: 20, fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>
        {'.scheduled_tasks.json'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C p5-11 空窗回落：过渡小字 ────────────────────────────────────────

const TransitionNote: React.FC = () => {
  const e = useEnter('fade', {at: 2, dur: DUR.f5});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', ...e}}>
      <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text}}>
        {'产品没停在这条边界上'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C p5-16 空窗回落：双栏小卡（教学版 vs 官方） ──────────────────────

const TwoColumnCard: React.FC = () => {
  const eL = useEnter('slideL', {at: 2, dur: DUR.f5, dist: 60});
  const eR = useEnter('slideR', {at: 2, dur: DUR.f5, dist: 60});
  const seam = useProgress(DUR.f5 + DUR.f4, DUR.f4);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', alignItems: 'stretch', gap: 26}}>
        <div style={{...eL}}>
          <Panel accent={theme.panelBorder} style={{width: 560, height: 300, boxSizing: 'border-box', padding: '30px 34px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim}}>{'教学版'}</div>
            <div style={{marginTop: 26, fontFamily: theme.sans, fontSize: 34, fontWeight: 700, color: theme.dim}}>
              {'进程外定时'}
            </div>
            <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 25, color: theme.dim}}>
              {'划给操作系统'}
            </div>
          </Panel>
        </div>
        <div style={{display: 'flex', alignItems: 'center', opacity: seam}}>
          <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>{'vs'}</span>
        </div>
        <div style={{...eR}}>
          <Panel accent={theme.mech} style={{width: 560, height: 300, boxSizing: 'border-box', padding: '30px 34px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.mech}}>{'官方'}</div>
            <div style={{marginTop: 26, fontFamily: theme.sans, fontSize: 34, fontWeight: 700, color: theme.text}}>
              {'同一条边界'}
            </div>
            <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 25, color: theme.mech}}>
              {'做成了产品'}
            </div>
          </Panel>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-D 空窗回落件 ──────────────────────────────────────────────────────

/** p5-18 开场：自白小字 + 师傅指向全景动势 */
const PanoramaOpen: React.FC = () => {
  const head = useEnter('fade', {at: 2, dur: DUR.f5});
  const frame = useCurrentFrame();
  const armSwing = 0.5 + 0.5 * Math.sin(frame / 9);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 300,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 46,
          fontWeight: 700,
          color: theme.text,
          ...head,
        }}
      >
        {'传送带的自白'}
      </div>
      {/* 全景预告框（dim 空框——内容在 archify 章里） */}
      <div
        style={{
          position: 'absolute',
          left: 660,
          top: 460,
          width: 600,
          height: 300,
          border: `3px dashed ${theme.panelBorder}`,
          borderRadius: 16,
          opacity: head.opacity,
        }}
      />
      <Person x={430} y={560} scale={0.85} />
      {/* 指向动势：手臂从剪影伸向全景框（帧驱动摆动） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: head.opacity}}>
        <line
          x1={560}
          y1={660}
          x2={560 + 90 * armSwing}
          y2={640 - 26 * armSwing}
          stroke={theme.text}
          strokeWidth={10}
          strokeLinecap="round"
        />
      </svg>
    </AbsoluteFill>
  );
};

/** p5-20 两个事实清单条 */
const FACTS = ['一 · 串行', '二 · 线程真有'];

const FactStrips: React.FC = () => {
  const strips = useStagger(FACTS.length, {at: 4, stride: 18, dur: DUR.f5});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 44}}>
        {FACTS.map((f, i) => (
          <div key={f} style={{opacity: strips[i], transform: `translateY(${(1 - strips[i]) * 24}px)`}}>
            <Panel accent={i === 0 ? theme.coreDeep : theme.mechDeep} style={{width: 760, padding: '30px 40px'}}>
              <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text}}>{f}</div>
            </Panel>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** p5-22 线程职能小图：甩活 + 看表两枚 icon（无工具执行） */
const ThreadJobs: React.FC = () => {
  const icons = useStagger(2, {at: 4, stride: 14, dur: DUR.f4});
  const note = useProgress(DUR.f5 + DUR.f4, DUR.f4);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', gap: 120}}>
        {/* 甩活：托盘离带（mech） */}
        <div style={{opacity: icons[0], transform: `scale(${0.9 + 0.1 * icons[0]})`}}>
          <svg width={200} height={170}>
            <line x1={10} y1={130} x2={190} y2={130} stroke={theme.coreDeep} strokeWidth={9} strokeLinecap="round" />
            <rect x={58} y={36} width={86} height={26} rx={5} fill={theme.panel} stroke={theme.mech} strokeWidth={3} />
            <path d="M100 62 Q112 92 96 118" fill="none" stroke={theme.mech} strokeWidth={4} strokeDasharray="7 7" />
            <path d="M86 110 L96 122 L108 112" fill="none" stroke={theme.mech} strokeWidth={4} />
          </svg>
          <div style={{textAlign: 'center', fontFamily: theme.sans, fontSize: 26, color: theme.mech, marginTop: 6}}>
            {'甩活'}
          </div>
        </div>
        {/* 看表：小钟面（mech） */}
        <div style={{opacity: icons[1], transform: `scale(${0.9 + 0.1 * icons[1]})`}}>
          <svg width={200} height={170}>
            <circle cx={100} cy={82} r={56} fill="none" stroke={theme.mech} strokeWidth={6} />
            <line x1={100} y1={82} x2={100} y2={48} stroke={theme.mech} strokeWidth={5} strokeLinecap="round" />
            <line x1={100} y1={82} x2={124} y2={94} stroke={theme.mechDeep} strokeWidth={4} strokeLinecap="round" />
          </svg>
          <div style={{textAlign: 'center', fontFamily: theme.sans, fontSize: 26, color: theme.mech, marginTop: 6}}>
            {'看表'}
          </div>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 760,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.dim,
          opacity: note,
        }}
      >
        {'两件事 · 不执行工具'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-E 产品侧单线圈图（p5-24..28） ─────────────────────────────────────

const SingleLoop: React.FC<{
  atDraw: number;
  atQuote: number;
  atLeave: number;
  atClash: number;
  atSeam: number;
  span: number;
}> = ({atDraw, atQuote, atLeave, atClash, atSeam, span}) => {
  const frame = useCurrentFrame();
  // 圈环描线（core 橙恒定〔M-001〕——与传送带同锚）
  const draw = useDraw(atDraw, DUR.f6);
  const drawVal = 1 - draw.strokeDashoffset;
  // 光点巡圈 → 发起后箭头离圈不回（exitPull 单调上升、永不回落）
  const dot = clamp01(progress(frame, atDraw + DUR.f5, span));
  const exitP = clamp01(progress(frame, atLeave + 4, DUR.f6));
  const dash = useFlowDash({dash: 10, gap: 13, period: 18});
  const launch = useImpulse({at: atLeave, dur: DUR.f5, peak: 1});
  const quoteIn = useProgress(atQuote, DUR.f4);
  const line = useReveal('跑在单线程的事件循环上', {at: atQuote + 6, cps: 9});
  const wordIn = useProgress(atLeave + DUR.f5, DUR.f5);
  const eL = useEnter('slideL', {at: atClash, dur: DUR.f5, dist: 70});
  const eR = useEnter('slideR', {at: atClash, dur: DUR.f5, dist: 70});
  const seam = useProgress(atSeam, DUR.f4);

  return (
    <AbsoluteFill>
      {/* 事件循环圈（左）：LoopRing 复用——core 描边与线宽恒定，只换周边标签 */}
      <div style={{position: 'absolute', left: 150, top: 340}}>
        <LoopRing
          size={380}
          draw={drawVal}
          dotProgress={dot * 2}
          exitPull={exitP}
          showLabels={false}
          showExit
        />
      </div>
      {/* 离圈箭头：行进虚线 + 发起一闪（发起之后 · 不去等） */}
      <svg width={560} height={200} style={{position: 'absolute', left: 560, top: 430, opacity: exitP > 0 ? 1 : 0}}>
        <path
          d={`M30 100 H${380 + 60 * launch}`}
          stroke={theme.core}
          strokeWidth={6}
          fill="none"
          strokeDasharray={dash.strokeDasharray}
          strokeDashoffset={dash.strokeDashoffset}
          opacity={0.25 + 0.75 * exitP}
        />
        <path d={`M${400 + 60 * launch - 26} 84 L${400 + 60 * launch} 100 L${400 + 60 * launch - 26} 116`} fill="none" stroke={theme.core} strokeWidth={6} />
        <text x={30} y={40} fontFamily={theme.sans} fontSize={24} fill={theme.core} opacity={exitP}>
          {'不回等'}
        </text>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 760,
          width: 420,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 34,
          fontWeight: 700,
          color: theme.text,
          opacity: wordIn,
        }}
      >
        {'发起之后 · 不去等'}
      </div>

      {/* 【三】归属引语卡（右） */}
      <div style={{position: 'absolute', left: 940, top: 330, width: 820, opacity: quoteIn}}>
        <Panel style={{padding: '26px 34px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <span
              style={{
                fontFamily: theme.sans,
                fontSize: 21,
                color: theme.dim,
                border: `2px solid ${theme.dim}`,
                borderRadius: 6,
                padding: '2px 10px',
              }}
            >
              {'【三】'}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>
              {'开源项目作者 · 源码分析'}
            </span>
          </div>
          <div style={{marginTop: 30, minHeight: 90}}>
            <span style={{fontFamily: theme.serif, fontSize: 62, color: theme.panelBorder}}>{'“'}</span>
            <div style={{fontFamily: theme.mono, fontSize: 34, lineHeight: 1.8, color: theme.text, whiteSpace: 'pre'}}>
              {line}
            </div>
          </div>
        </Panel>
      </div>

      {/* 拧巴一幕（p5-27）：教学版↔产品对撞双卡（deny↔mech） */}
      <div style={{position: 'absolute', left: 940, top: 580, width: 820}}>
        <div style={{display: 'flex', gap: 22}}>
          <div style={{flex: 1, ...eL}}>
            <Panel accent={theme.deny} style={{padding: '20px 22px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.deny}}>{'教学版'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text, marginTop: 8}}>
                {'真线程'}
              </div>
            </Panel>
          </div>
          <div style={{flex: 1, ...eR}}>
            <Panel accent={theme.mech} style={{padding: '20px 22px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.mech}}>{'产品'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text, marginTop: 8}}>
                {'无真线程'}
              </div>
            </Panel>
          </div>
        </div>
        {/* 中缝（p5-28）：语义一字不差 */}
        <div
          style={{
            marginTop: 22,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.dim,
            opacity: seam,
          }}
        >
          {'语义 · 一字不差'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-F 收束卡（p5-29..30） ──────────────────────────────────────────────

const ThreeQuestions: React.FC<{atThird: number}> = ({atThird}) => {
  const qs = useStagger(2, {at: 4, stride: 16, dur: DUR.f5});
  const third = useProgress(atThird, DUR.f4);
  const cross = useImpulse({at: atThird + DUR.f3, dur: DUR.f6, peak: 1});
  const epilogue = useEnter('fade', {at: atThird + DUR.f5, dur: DUR.f5});
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', gap: 80}}>
        {['谁按开始？', '要不要等？'].map((q, i) => (
          <div key={q} style={{opacity: qs[i], transform: `translateY(${(1 - qs[i]) * 22}px)`}}>
            <div
              style={{
                padding: '22px 44px',
                borderRadius: 14,
                border: `3px solid ${theme.mech}`,
                fontFamily: theme.serif,
                fontSize: 40,
                fontWeight: 700,
                color: theme.mech,
                boxShadow: `0 0 ${16 * qs[i]}px ${withAlpha(theme.mech, 0.35)}`,
              }}
            >
              {q}
            </div>
          </div>
        ))}
      </div>
      {/* 第三问：灰置 + deny 打叉（本层从没回答过的问题） */}
      <div style={{position: 'relative', marginTop: 70, opacity: third}}>
        <div
          style={{
            padding: '16px 36px',
            borderRadius: 12,
            border: `3px dashed ${theme.panelBorder}`,
            fontFamily: theme.serif,
            fontSize: 34,
            color: theme.dim,
          }}
        >
          {'同时能跑几个？'}
        </div>
        <svg width={340} height={92} style={{position: 'absolute', left: -14, top: -10}}>
          <g stroke={theme.deny} strokeWidth={8} strokeLinecap="round" opacity={clamp01(cross * 1.6)}>
            <line x1={30} y1={20} x2={110} y2={80} />
            <line x1={110} y1={20} x2={30} y2={80} />
          </g>
          <g stroke={theme.deny} strokeWidth={8} strokeLinecap="round" opacity={clamp01(cross * 1.6 - 0.6)}>
            <line x1={220} y1={20} x2={300} y2={80} />
            <line x1={300} y1={20} x2={220} y2={80} />
          </g>
        </svg>
      </div>
      {/* 衬线暗态预收小字（P6 终态伏笔） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 200,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 24,
          color: theme.dim,
          opacity: epilogue.opacity,
        }}
      >
        {'没有平行宇宙 · 收尾见'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P5Durable: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p5-01', 'p5-03');
  const bB = w('p5-04', 'p5-10');
  const bC = w('p5-11', 'p5-17');
  const bD = w('p5-18', 'p5-23');
  const bE = w('p5-24', 'p5-28');
  const bF = w('p5-29', 'p5-30');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="5-A 打烊灯灭">
        <SceneTag chapter="boundary" tagline="诚实的边界" />
        <ClosingDown atDie={at('p5-02') - bA.from} atGone={at('p5-03') - bA.from} />
        <Footnote delay={2}>{'daemon=True · in-process scheduler'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="5-B durable 边界">
        {/* P5 首个 archify 实例 → 默认 lead */}
        <ArchifyRecap
          slug="durable-lifecycle"
          caption="durable 生命周期"
          cues={[
            {chapterId: 'alarm-not-fires', at: at('p5-05') - bB.from, durationInFrames: dur('p5-05')},
            {chapterId: 'definition-on-disk', at: at('p5-06') - bB.from, durationInFrames: dur('p5-06')},
            {chapterId: 'restart-from-now', at: at('p5-07') - bB.from, durationInFrames: dur('p5-07')},
            {chapterId: 'boundary-verbatim', at: at('p5-08') - bB.from, durationInFrames: dur('p5-08')},
            {chapterId: 'no-catchup', at: at('p5-09') - bB.from, durationInFrames: dur('p5-09')},
          ]}
        />
        <Sequence from={at('p5-04') - bB.from} durationInFrames={dur('p5-04')} name="5-B 设问小字">
          <AskWhat />
        </Sequence>
        <Sequence from={at('p5-10') - bB.from} durationInFrames={dur('p5-10')} name="5-B 金句小卡">
          <QuoteCard zh="不是永生 · 闹钟没丢" />
        </Sequence>
        <Footnote delay={at('p5-04') - bB.from}>{'.scheduled_tasks.json · durable'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="5-C 官方三档阶梯">
        {/* 5-B 末章（no-catchup）隔 p5-10 空窗 ⇒ 默认 lead */}
        <ArchifyRecap
          slug="schedule-three-tiers"
          caption="官方三档"
          cues={[
            {chapterId: 'three-tiers', at: at('p5-12') - bC.from, durationInFrames: dur('p5-12')},
            {chapterId: 'session-loop', at: at('p5-13') - bC.from, durationInFrames: dur('p5-13')},
            {chapterId: 'desktop-tier', at: at('p5-14') - bC.from, durationInFrames: dur('p5-14')},
            {chapterId: 'cloud-tier', at: at('p5-15') - bC.from, durationInFrames: dur('p5-15')},
            {chapterId: 'same-edge-two-ways', at: at('p5-17') - bC.from, durationInFrames: dur('p5-17')},
          ]}
        />
        <Sequence from={at('p5-11') - bC.from} durationInFrames={dur('p5-11')} name="5-C 过渡小字">
          <TransitionNote />
        </Sequence>
        <Sequence from={at('p5-16') - bC.from} durationInFrames={dur('p5-16')} name="5-C 双栏小卡">
          <TwoColumnCard />
        </Sequence>
        <Footnote delay={at('p5-11') - bC.from}>{'/loop · desktop · routines'}</Footnote>
      </Sequence>

      <Sequence {...bD} name="5-D 传送带自白">
        {/* 5-C 末章（same-edge-two-ways）隔 p5-16/p5-18 空窗 ⇒ 默认 lead */}
        <ArchifyRecap
          slug="timing-panorama"
          caption="全景总装"
          cues={[
            {chapterId: 'panorama-live', at: at('p5-19') - bD.from, durationInFrames: dur('p5-19')},
            {chapterId: 'serial-trays', at: at('p5-21') - bD.from, durationInFrames: dur('p5-21')},
            {chapterId: 'threads-not-tools', at: at('p5-23') - bD.from, durationInFrames: dur('p5-23')},
          ]}
        />
        <Sequence from={at('p5-18') - bD.from} durationInFrames={dur('p5-18')} name="5-D 自白开场">
          <PanoramaOpen />
        </Sequence>
        <Sequence from={at('p5-20') - bD.from} durationInFrames={dur('p5-20')} name="5-D 事实清单条">
          <FactStrips />
        </Sequence>
        <Sequence from={at('p5-22') - bD.from} durationInFrames={dur('p5-22')} name="5-D 线程职能">
          <ThreadJobs />
        </Sequence>
        <Footnote delay={at('p5-18') - bD.from}>{'for loop（串行分发）'}</Footnote>
      </Sequence>

      <Sequence {...bE} name="5-E 单线圈图">
        <SingleLoop
          atDraw={at('p5-24') - bE.from}
          atQuote={at('p5-25') - bE.from}
          atLeave={at('p5-26') - bE.from}
          atClash={at('p5-27') - bE.from}
          atSeam={at('p5-28') - bE.from}
          span={bE.durationInFrames}
        />
        <Footnote delay={at('p5-24') - bE.from}>{'single-threaded event loop · not awaited'}</Footnote>
      </Sequence>

      <Sequence {...bF} name="5-F 收束三问">
        <ThreeQuestions atThird={at('p5-30') - bF.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5Durable;
