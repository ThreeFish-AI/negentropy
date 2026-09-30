/** P2 指针换空间（p2-01..29，7 镜 12 cue）——分镜 2-A…2-G。
 *
 *  ★ 本幕核心钉点：占位符形态（不携磁盘地址）与「先落盘再压条」的顺序力学——
 *    2-C 顺序金句卡 / 2-D 找不到的路（deny 断线）是全片记忆点落位。
 *  ★ 台面母题（P12BenchDevices.BenchTop，core 橙恒定描边〔M-001〕）恒居左中锚位：
 *    2-A 台面全景聚焦、2-D 台面上的最近窗口；取货条 ClaimTag 在 2-A/2-D 复用同形。
 *  archify 两图（pointer-trade / compact-entries）全屏独占：一章锚一句（at+dur 同句单参）；
 *  2-B 首章跨实例背靠背接 2-A，lead={false}；2-B 次章（p2-07 空窗后重现）与 2-F
 *  空窗后重现各自独立实例保持默认 lead（分镜 lead 清单）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {QuoteCard} from '../components/cards';
import {BenchTop, ClaimTag} from '../components/P12BenchDevices';
import {
  DUR,
  progress,
  useCount,
  useDraw,
  useEnter,
  useImpulse,
  useProgress,
  useReveal,
  useShake,
  useSpring,
  useStagger,
} from '../motion';

/** 常驻系列条定位：与 SceneTag 同行（P1–P6 同值，Integrate 统一核对） */
const BADGE_STYLE: React.CSSProperties = {top: 64};

// ── 2-A 台面全景 → 聚焦「搬仓库」工位（p2-01 引子） ──────────────────────

/** 台面全景容器：局部坐标里台面恒左中；聚焦原点 = 大件+取货条的工位中心 */
const TABLEAU = {left: 190, top: 430, w: 860, h: 330, ox: 635, oy: 68} as const;

const WarehouseFocus: React.FC<{zoomDur: number}> = ({zoomDur}) => {
  // 聚焦框收缩：decelerate（机械对焦感）
  const p = useProgress(2, Math.max(1, zoomDur - 4), 'decelerate');
  const s = 1 + 0.28 * p;
  const L = (a: number, b: number) => a + (b - a) * p;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: TABLEAU.left,
          top: TABLEAU.top,
          width: TABLEAU.w,
          height: TABLEAU.h,
          transformOrigin: '0 0',
          transform: `translate(${(1 - s) * TABLEAU.ox}px, ${(1 - s) * TABLEAU.oy}px) scale(${s})`,
        }}
      >
        {/* 存量物件（无彩 data 色） */}
        <svg width={TABLEAU.w} height={130} style={{display: 'block'}}>
          <rect x={60} y={40} width={96} height={86} rx={4} fill={theme.panel} stroke={theme.dim} strokeWidth={2} />
          <path d="M132 40 L156 64 L132 64 Z" fill="none" stroke={theme.dim} strokeWidth={2} />
          <rect x={190} y={96} width={170} height={34} rx={6} fill={theme.panel} stroke={theme.dim} strokeWidth={2} />
          <line x1={204} y1={113} x2={330} y2={113} stroke={theme.panelBorder} strokeWidth={3} />
          <rect x={390} y={48} width={84} height={82} rx={20} fill={theme.panel} stroke={theme.dim} strokeWidth={2} />
          {/* 大件：最新一批里最占地方的结果（搬仓库工位的主角） */}
          <rect x={460} y={6} width={170} height={124} rx={6} fill={theme.panel} stroke={theme.dim} strokeWidth={2.5} />
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={476} y1={30 + i * 24} x2={614} y2={30 + i * 24} stroke={theme.panelBorder} strokeWidth={3} />
          ))}
        </svg>
        {/* 台面母题〔M-001〕：左中锚位 */}
        <div style={{position: 'absolute', left: 20, top: 130}}>
          <BenchTop width={720} />
        </div>
        {/* 取货条（mech）：大件落盘后留在台面上的包裹标签 */}
        <div style={{position: 'absolute', left: 648, top: 76}}>
          <ClaimTag flat={0} w={170} />
        </div>
      </div>

      {/* 聚焦框（舞台坐标，不随缩放）：收缩套住工位 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <rect
          x={L(210, 690)}
          y={L(444, 442)}
          width={L(730, 270)}
          height={L(262, 116)}
          rx={10}
          fill="none"
          stroke={theme.mech}
          strokeWidth={3.5}
          strokeDasharray="14 10"
          opacity={p}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 620,
          top: 386,
          fontFamily: theme.sans,
          fontSize: 26,
          fontWeight: 600,
          color: theme.mech,
          opacity: p,
        }}
      >
        {'搬仓库'}
      </div>
      <Footnote delay={4}>{'<persisted-output>'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-B 空窗回落：占位符引语卡（p2-07）／判断小卡（p2-09） ───────────────

const PLACEHOLDER_LINE = '[Earlier tool result compacted. Re-run if needed.]';

const PlaceholderQuote: React.FC = () => {
  const card = useEnter('fade', {at: 2, dur: DUR.f5});
  const line = useReveal(PLACEHOLDER_LINE, {at: 8, cps: 22});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 320, top: 428, ...card}}>
        <Panel style={{width: 1280, padding: '26px 40px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginBottom: 12}}>{'placeholder'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 34, color: theme.text, whiteSpace: 'pre', minHeight: 48}}>
            <span style={{fontFamily: theme.serif, fontSize: 52, color: theme.panelBorder}}>{'“'}</span>
            {line}
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

const ReplayJudgement: React.FC = () => {
  const pop = useEnter('pop', {at: 2, dur: DUR.f4});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 560, top: 430, ...pop}}>
        <Panel style={{width: 800, padding: '30px 36px', textAlign: 'center'}}>
          <div style={{display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 22}}>
            <span style={{fontFamily: theme.sans, fontSize: 44, fontWeight: 700, color: theme.mech}}>{'可重放'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 44, color: theme.dim}}>{'≠'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 44, fontWeight: 700, color: theme.deny, textDecoration: 'line-through'}}>
              {'可归档'}
            </span>
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 16}}>{'replayable ≠ archived'}</div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 2-C 顺序力学对撞卡（p2-10..12） ──────────────────────────────────────

const LaneChip: React.FC<{children: React.ReactNode}> = ({children}) => (
  <span
    style={{
      display: 'inline-block',
      padding: '10px 24px',
      border: `2px solid ${theme.panelBorder}`,
      borderRadius: 10,
      fontFamily: theme.sans,
      fontSize: 34,
      color: theme.text,
    }}
  >
    {children}
  </span>
);

const OrderMechanics: React.FC<{atCross: number; atOk: number; atQuote: number}> = ({atCross, atOk, atQuote}) => {
  // 双路对开
  const top = useEnter('slideL', {at: 2, dur: DUR.f5, springPreset: 'settle', dist: 70});
  const bottom = useEnter('slideR', {at: 2 + DUR.f3, dur: DUR.f5, springPreset: 'settle', dist: 70});
  // 红叉抖动（衰减包络）／绿勾一次性强调
  const shakeX = useShake({at: atCross + 6, amp: 6, decay: true, dur: DUR.f6});
  const checkPulse = useImpulse({at: atOk + 4, dur: DUR.f5});
  // 金句卡落位时双路压暗让位
  const lanesDim = 1 - 0.78 * useProgress(atQuote, DUR.f4);

  return (
    <AbsoluteFill>
      {/* 上路：先落盘 → 再压条（ok 放行） */}
      <div style={{position: 'absolute', left: 400, top: 268, transform: top.transform, opacity: top.opacity * lanesDim}}>
        <Panel style={{width: 1120, padding: '26px 34px'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
              <LaneChip>{'先落盘'}</LaneChip>
              <span style={{fontFamily: theme.mono, fontSize: 34, color: theme.dim}}>{'→'}</span>
              <LaneChip>{'再压条'}</LaneChip>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 14, transform: `scale(${1 + 0.1 * checkPulse})`}}>
              <span style={{fontFamily: theme.sans, fontSize: 48, fontWeight: 700, color: theme.ok, textShadow: `0 0 ${22 * checkPulse}px ${theme.ok}`}}>
                {'✓'}
              </span>
              <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.ok}}>{'放行'}</span>
            </div>
          </div>
        </Panel>
      </div>
      {/* 下路：先压条 → 再落盘（deny：原文已没） */}
      <div style={{position: 'absolute', left: 400, top: 496, transform: bottom.transform, opacity: bottom.opacity * lanesDim}}>
        <Panel style={{width: 1120, padding: '26px 34px'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
              <LaneChip>{'先压条'}</LaneChip>
              <span style={{fontFamily: theme.mono, fontSize: 34, color: theme.dim}}>{'→'}</span>
              <LaneChip>{'再落盘'}</LaneChip>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 14, transform: `translateX(${shakeX}px)`}}>
              <span style={{fontFamily: theme.sans, fontSize: 48, fontWeight: 700, color: theme.deny}}>{'✗'}</span>
              <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.deny}}>{'原文已没'}</span>
            </div>
          </div>
        </Panel>
      </div>
      <Footnote delay={4}>{'顺序不能换'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-D 找不到的路（p2-13..16，「教学版」徽标置顶限定） ───────────────────

const LostPathDemo: React.FC<{atOut: number; atFlat: number; atGone: number}> = ({atOut, atFlat, atGone}) => {
  const frame = useCurrentFrame();
  const stage = useEnter('fade', {at: 2, dur: DUR.f5});
  // 大结果连同取货条滑出最近窗口
  const slide = useProgress(atOut + 4, DUR.f5, 'decelerate');
  // 取货条压扁成无地址通用提示（局部帧弹簧；mech→dim 交叉淡化在 ClaimTag 内）
  const flat = useSpring('settle', {at: atFlat + 4, dur: DUR.f5});
  const flatIn = useProgress(atFlat + 2, DUR.f3);
  // 断线描出 + 「无路可达」红标闪
  const drawL = useDraw(atGone + 2, DUR.f5);
  const drawR = useDraw(atGone + 10, DUR.f5);
  const settle = progress(frame, atGone + 24, DUR.f3);
  const goneLabel = useProgress(atGone + 8, DUR.f3);
  const goneFlash = useImpulse({at: atGone + 14, dur: DUR.f6});

  const outDx = -470 * slide;
  const outOp = 1 - 0.9 * slide;

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, opacity: stage.opacity}}>
        {/* 「教学版」徽标（置顶限定） */}
        <div
          style={{
            position: 'absolute',
            left: 880,
            top: 64,
            padding: '5px 18px',
            border: `2px solid ${theme.dim}`,
            borderRadius: 999,
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.dim,
          }}
        >
          {'教学版'}
        </div>

        {/* 左：台面（左中锚位〔M-001〕）+ 最近窗口 */}
        <div style={{position: 'absolute', left: 110, top: 600}}>
          <BenchTop width={420} />
        </div>
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          <rect x={150} y={470} width={440} height={170} rx={10} fill="none" stroke={theme.dim} strokeWidth={2.5} strokeDasharray="10 8" opacity={0.8} />
        </svg>
        <div style={{position: 'absolute', left: 150, top: 440, fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'最近窗口'}</div>

        {/* 大结果块 + 取货条：一起滑出窗口 */}
        <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `translateX(${outDx}px)`, opacity: outOp}}>
          <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
            <rect x={180} y={486} width={240} height={108} rx={6} fill={theme.panel} stroke={theme.dim} strokeWidth={2.5} />
            {[0, 1, 2].map((i) => (
              <line key={i} x1={196} y1={512 + i * 26} x2={404} y2={512 + i * 26} stroke={theme.panelBorder} strokeWidth={3} />
            ))}
          </svg>
          <div style={{position: 'absolute', left: 448, top: 540}}>
            <ClaimTag flat={0} w={170} />
          </div>
        </div>

        {/* 压扁后的无地址通用提示（弹簧压扁，落在窗口内原位） */}
        <div
          style={{
            position: 'absolute',
            left: 200,
            top: 538,
            opacity: flatIn,
            transform: `scaleY(${1 + 2.2 * (1 - flat)})`,
            transformOrigin: '50% 100%',
          }}
        >
          <ClaimTag flat={flat} w={380} />
        </div>

        {/* 右：磁盘仓库（dim 灰置，原件仍在） */}
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          <rect x={1420} y={440} width={380} height={330} rx={10} fill="none" stroke={theme.dim} strokeWidth={3} opacity={0.75} />
          <rect x={1490} y={486} width={200} height={132} rx={5} fill={theme.panel} stroke={theme.dim} strokeWidth={2} />
          <path d="M1658 486 L1690 518 L1658 518 Z" fill="none" stroke={theme.dim} strokeWidth={2} />
          {[0, 1, 2].map((i) => (
            <line key={i} x1={1506} y1={532 + i * 26} x2={1664} y2={532 + i * 26} stroke={theme.panelBorder} strokeWidth={3} />
          ))}
        </svg>
        <div style={{position: 'absolute', left: 1420, top: 792, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
          {'磁盘仓库'}
          <span style={{fontFamily: theme.mono, fontSize: 18, marginLeft: 12}}>{'disk'}</span>
        </div>

        {/* 中缝断线：两段不相连（描出后落定为虚线路） */}
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          <g opacity={1 - settle}>
            <path d="M 640 560 H 950" fill="none" stroke={theme.deny} strokeWidth={4} {...drawL} />
            <path d="M 1090 560 H 1400" fill="none" stroke={theme.deny} strokeWidth={4} {...drawR} />
          </g>
          <g opacity={settle}>
            <path d="M 640 560 H 950" fill="none" stroke={theme.deny} strokeWidth={3} strokeDasharray="10 9" />
            <path d="M 1090 560 H 1400" fill="none" stroke={theme.deny} strokeWidth={3} strokeDasharray="10 9" />
          </g>
          {/* 断口 ✗ */}
          <g opacity={goneLabel}>
            <line x1={1004} y1={544} x2={1036} y2={576} stroke={theme.deny} strokeWidth={6} strokeLinecap="round" />
            <line x1={1036} y1={544} x2={1004} y2={576} stroke={theme.deny} strokeWidth={6} strokeLinecap="round" />
          </g>
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 940,
            top: 486,
            width: 160,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 26,
            fontWeight: 700,
            color: theme.deny,
            opacity: goneLabel,
            transform: `scale(${1 + 0.1 * goneFlash})`,
            textShadow: `0 0 ${20 * goneFlash}px ${theme.deny}`,
          }}
        >
          {'无路可达'}
        </div>

        <Footnote delay={4}>{'claim tag → generic hint'}</Footnote>
      </div>
    </AbsoluteFill>
  );
};

// ── 2-E 空窗回落：开新一轮小卡（p2-20） ─────────────────────────────────

const NewRoundCard: React.FC = () => {
  const pop = useEnter('pop', {at: 2, dur: DUR.f4});
  const receipt = useEnter('fall', {at: 8, dur: DUR.f4, dist: 44});
  const jump = useProgress(18, DUR.f4);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 620, top: 372, ...pop}}>
        <Panel accent={theme.mech} style={{width: 680, padding: '26px 34px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 700, color: theme.text}}>{'开新一轮'}</div>
          {/* 回执条落下 */}
          <div style={{marginTop: 18, ...receipt}}>
            <Panel style={{padding: '10px 18px', display: 'inline-flex', gap: 14, alignItems: 'baseline'}}>
              <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.text}}>{'compact'}</span>
              <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.ok}}>{'✓'}</span>
            </Panel>
          </div>
          {/* 新一轮起跳线（mech） */}
          <svg width={600} height={26} style={{display: 'block', marginTop: 22, opacity: jump}}>
            <line x1={0} y1={13} x2={556} y2={13} stroke={theme.mech} strokeWidth={3} strokeDasharray="12 9" />
            <path d="M552 3 L 582 13 L 552 23 Z" fill={theme.mech} />
          </svg>
        </Panel>
      </div>
      <Footnote delay={2}>{'compact · /compact'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-F 空窗回落：尺子不准小卡（p2-24..25） ──────────────────────────────

const RulerCard: React.FC<{atFlash: number}> = ({atFlash}) => {
  const card = useEnter('pop', {at: 2, dur: DUR.f4});
  // 刻度滚动（帧驱动计数驱动刻度相位与测量头）
  const roll = useCount({from: 0, to: 34, at: 6, dur: DUR.f6});
  const flash = useImpulse({at: atFlash + 2, dur: DUR.f6});
  const tickOffset = (roll * 4) % 16;
  const markerX = 40 + roll * 21.8;

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 510, top: 316, ...card}}>
        <Panel style={{width: 900, padding: '26px 32px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10}}>
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>{'尺子不准'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'estimate'}</span>
          </div>
          <svg width={836} height={260}>
            {/* 估算：字符数当用量（mech 虚线，缓坡） */}
            <polyline points="40,192 760,152" fill="none" stroke={theme.mech} strokeWidth={3} strokeDasharray="12 9" />
            {/* 实际占用：上翘曲线（无彩） */}
            <path d="M40 192 Q 460 168 760 58" fill="none" stroke={theme.text} strokeWidth={3.5} />
            {/* 偏差带（deny 填充 + 闪） */}
            <polygon points="600,161 760,152 760,58 600,96" fill={theme.deny} opacity={0.1 + 0.45 * flash} />
            <line x1={600} y1={161} x2={600} y2={96} stroke={theme.deny} strokeWidth={2.5} opacity={0.4 + 0.6 * flash} />
            {/* 测量头（mech，随刻度滚动推进） */}
            <line x1={markerX} y1={178} x2={markerX} y2={224} stroke={theme.mech} strokeWidth={2.5} opacity={0.85} />
            {/* 刻度尺（密集刻度，滚动） */}
            <g transform={`translateX(${-tickOffset})`}>
              {Array.from({length: 50}, (_, i) => (
                <line
                  key={i}
                  x1={24 + i * 16}
                  y1={i % 4 === 0 ? 206 : 214}
                  x2={24 + i * 16}
                  y2={224}
                  stroke={theme.panelBorder}
                  strokeWidth={2}
                />
              ))}
            </g>
            <text x={40} y={248} fontFamily={theme.mono} fontSize={16} fill={theme.dim}>
              {'chars'}
            </text>
            <text x={612} y={142} fontFamily={theme.sans} fontSize={22} fill={theme.mech}>
              {'估算'}
            </text>
            <text x={640} y={52} fontFamily={theme.sans} fontSize={22} fill={theme.text}>
              {'实际'}
            </text>
          </svg>
        </Panel>
      </div>
      <Footnote delay={2}>{'estimate · [auto compact] · [reactive compact]'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 2-G 官方对照卡（p2-26..29） ──────────────────────────────────────────

const OFFICIAL_ROWS = [
  {zh: '自动压缩', en: 'auto'},
  {zh: '手动同机制', en: '/compact'},
  {zh: '阈值可调', en: 'threshold'},
] as const;

const OfficialDoc: React.FC = () => {
  const card = useEnter('fade', {at: 2, dur: DUR.f5});
  const rows = useStagger(OFFICIAL_ROWS.length, {at: 4, stride: 12, dur: DUR.f5});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 300, top: 232, ...card}}>
        <Panel style={{width: 1020, padding: '24px 36px'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              paddingBottom: 12,
              borderBottom: `2px solid ${theme.panelBorder}`,
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>{'docs'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'official'}</span>
          </div>
          {OFFICIAL_ROWS.map((r, i) => (
            <div key={r.zh} style={{display: 'flex', alignItems: 'center', height: 92, opacity: rows[i], transform: `translateY(${(1 - rows[i]) * 14}px)`}}>
              <svg width={26} height={26}>
                <circle cx={13} cy={13} r={5} fill={theme.panelBorder} />
              </svg>
              <span style={{fontFamily: theme.sans, fontSize: 32, color: theme.text, marginLeft: 18}}>{r.zh}</span>
              <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginLeft: 'auto'}}>{r.en}</span>
            </div>
          ))}
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

/** 次序条（p2-28）：先清旧输出 → 再摘要 */
const OrderStrip2G: React.FC = () => {
  const rise = useEnter('rise', {at: 2, dur: DUR.f5, dist: 24});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 330, top: 690, ...rise}}>
        <Panel accent={theme.mech} style={{width: 960, padding: '20px 30px', textAlign: 'center'}}>
          <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>{'先清旧输出'}</span>
          <span style={{fontFamily: theme.mono, fontSize: 32, color: theme.mech, margin: '0 22px'}}>{'→'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>{'再摘要'}</span>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

/** 子代理侧间小工位（p2-29 一闪）：无收台工，题词「自己的台面」 */
const SubAgentDesk: React.FC<{span: number}> = ({span}) => {
  const inn = useProgress(2, DUR.f4);
  const out = useProgress(Math.max(DUR.f4 + 4, span - 12), 12);
  const o = inn * (1 - out);
  return (
    <div style={{position: 'absolute', left: 1420, top: 352, opacity: o}}>
      <div style={{width: 360, height: 340, border: `2.5px dashed ${theme.panelBorder}`, borderRadius: 14, padding: '22px 30px'}}>
        <svg width={250} height={36} style={{display: 'block'}}>
          <rect x={40} y={4} width={92} height={30} rx={4} fill={theme.panel} stroke={theme.dim} strokeWidth={2} />
          <rect x={150} y={12} width={70} height={22} rx={5} fill={theme.panel} stroke={theme.dim} strokeWidth={2} />
        </svg>
        <BenchTop width={250} />
        <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{'自己的台面'}</div>
        <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 4}}>{'subagent'}</div>
      </div>
    </div>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P2CompactSteps: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p2-01', 'p2-05');
  const bB = w('p2-06', 'p2-09');
  const bC = w('p2-10', 'p2-12');
  const bD = w('p2-13', 'p2-16');
  const bE = w('p2-17', 'p2-20');
  const bF = w('p2-21', 'p2-25');
  const bG = w('p2-26', 'p2-29');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="2-A 聚焦搬仓库">
        <SceneTag chapter="Pointer Trade" tagline="指针换空间" />
        <ArchifyYield
          cues={[
            {at: at('p2-02') - bA.from, durationInFrames: dur('p2-02')},
            {at: at('p2-03') - bA.from, durationInFrames: dur('p2-03')},
            {at: at('p2-04') - bA.from, durationInFrames: dur('p2-04')},
            {at: at('p2-05') - bA.from, durationInFrames: dur('p2-05')},
          ]}
        >
          <Sequence durationInFrames={at('p2-02') - bA.from + DUR.f3}>
            <WarehouseFocus zoomDur={dur('p2-01')} />
          </Sequence>
        </ArchifyYield>
        <ArchifyRecap
          slug="pointer-trade"
          caption="指针换空间"
          cues={[
            {chapterId: 'batch-account', at: at('p2-02') - bA.from, durationInFrames: dur('p2-02')},
            {chapterId: 'size-queue', at: at('p2-03') - bA.from, durationInFrames: dur('p2-03')},
            {chapterId: 'parcel-tag', at: at('p2-04') - bA.from, durationInFrames: dur('p2-04')},
            {chapterId: 'full-on-disk', at: at('p2-05') - bA.from, durationInFrames: dur('p2-05')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="2-B 占位符与通用提示">
        {/* 跨实例背靠背接 2-A：lead={false}（仅为首章所需） */}
        <ArchifyRecap
          slug="pointer-trade"
          caption="指针换空间"
          lead={false}
          cues={[{chapterId: 'slide-and-flatten', at: at('p2-06') - bB.from, durationInFrames: dur('p2-06')}]}
        />
        {/* hint-no-address 在 p2-07 空窗后重现 → 独立实例默认入场（4-D cache-stakes 同款拆分） */}
        <ArchifyRecap
          slug="pointer-trade"
          caption="指针换空间"
          cues={[{chapterId: 'hint-no-address', at: at('p2-08') - bB.from, durationInFrames: dur('p2-08')}]}
        />
        <Sequence from={at('p2-07') - bB.from} durationInFrames={dur('p2-07') + DUR.f3} name="2-B 占位符引语卡">
          <PlaceholderQuote />
        </Sequence>
        <Sequence from={at('p2-09') - bB.from} name="2-B 判断小卡">
          <ReplayJudgement />
        </Sequence>
      </Sequence>

      <Sequence {...bC} name="2-C 顺序力学对撞">
        <OrderMechanics atCross={at('p2-10') - bC.from} atOk={at('p2-11') - bC.from} atQuote={at('p2-12') - bC.from} />
        <Sequence from={at('p2-12') - bC.from} name="2-C 顺序金句">
          <QuoteCard zh="先抄地址 · 再扔东西" accent={theme.mech} />
        </Sequence>
      </Sequence>

      <Sequence {...bD} name="2-D 找不到的路">
        <LostPathDemo atOut={at('p2-14') - bD.from} atFlat={at('p2-15') - bD.from} atGone={at('p2-16') - bD.from} />
      </Sequence>

      <Sequence {...bE} name="2-E 压缩入口">
        <ArchifyRecap
          slug="compact-entries"
          caption="压缩入口"
          cues={[
            // fit='trim' 显式留痕：章 4 拍 4.46s vs 句窗 3.07s（rate 1.45），前后句均有
            // 专属 cue/装置无法扩窗，末拍被切属已接受决策（2026-09-30 评审）
            {chapterId: 'entries-overview', at: at('p2-17') - bE.from, durationInFrames: dur('p2-17'), fit: 'trim'},
            {chapterId: 'auto-gate', at: at('p2-18') - bE.from, durationInFrames: dur('p2-18')},
            {chapterId: 'manual-tool', at: at('p2-19') - bE.from, durationInFrames: dur('p2-19')},
          ]}
        />
        <Sequence from={at('p2-20') - bE.from} name="2-E 开新一轮小卡">
          <NewRoundCard />
        </Sequence>
      </Sequence>

      <Sequence {...bF} name="2-F 应急与尺子">
        {/* 空窗后重现（隔 p2-20）：保持默认 lead */}
        <ArchifyRecap
          slug="compact-entries"
          caption="压缩入口"
          cues={[
            {chapterId: 'rescue-lane', at: at('p2-21') - bF.from, durationInFrames: dur('p2-21')},
            {chapterId: 'tail-five', at: at('p2-22') - bF.from, durationInFrames: dur('p2-22')},
            {chapterId: 'once-only', at: at('p2-23') - bF.from, durationInFrames: dur('p2-23')},
          ]}
        />
        <Sequence from={at('p2-24') - bF.from} name="2-F 尺子不准小卡">
          {/* atFlash 锚须相对本子 Sequence（0 = p2-24 起点）而非 bF——bF 基准超出
              序列寿命致 deny 偏差带闪永不触发（2026-09-30 评审实录，remotion still 验证） */}
          <RulerCard atFlash={at('p2-25') - at('p2-24')} />
        </Sequence>
      </Sequence>

      <Sequence {...bG} name="2-G 官方对照">
        <OfficialDoc />
        <Sequence from={at('p2-28') - bG.from} name="2-G 次序条">
          <OrderStrip2G />
        </Sequence>
        <Sequence from={at('p2-29') - bG.from} name="2-G 子代理小工位">
          <SubAgentDesk span={dur('p2-29')} />
        </Sequence>
        <Footnote delay={at('p2-29') - bG.from}>{'subagent'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P2CompactSteps;
