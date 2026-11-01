/** P5 收束与下期（p5-01..p5-07，3 镜）——分镜 5-A / 5-B / 5-C。
 *
 *  叙事链：5-A 环体定格收束（EWS）：环体居中同形回归（陶土橙描边承全片锚定，
 *  4-D 线稿→实线为状态升级非 morph）＋金句卡（衬线体）「错误按类型分径 ·
 *  每条路径有上界」两关键词各压一拍重读（caption-dup-ok：金句卡刻意复述，
 *  收束定格仪式，承 ep1/ep2/ep10 5-A 豁免先例）→ p5-02 四枚上界徽章沿环依次
 *  点亮（升 1 / 续 3 / 压 1 / 试 10——分类三行＋重试位的上界蒸馏，数字与全片
 *  机制计数一致）、「防的是救援变死循环」四徽章外圈界环亮起 → p5-03 金句卡
 *  下移半格、章铭小卡「错误不是终点，是重试的起点」淡入、环体与徽章静持 →
 *  5-B 下期卡前奏：环体继续缓转（居中偏右）、「模型」节点头颅内「目标」光点
 *  只在头颅内明灭、盘面/工作区空无一字（大目标不落盘的空间陈述）、任务越长
 *  闪烁频率渐快亮度渐弱、下期卡浮起定格（只点问题不预告机制）→ 5-C 片尾署源
 *  卡（尾部署源位，RSI I-080 豁免——署源句 p5-06 同拍淡入、p5-07 静持）：主行
 *  Learn Claude Code / 次行仓库地址 / 角注 MIT，全片在此卡收束。
 *
 *  空间契约：金句卡为唯一主体、衬线体、四徽章数字与 narration 口径一致
 *    （1/3/1/10）、卡外新增装饰元素禁；目标光点只在头颅节点内（不落盘面）、
 *    盘面恒空无一字、下期卡只含问题剪影不点机制名；署源卡为最后画面、卡面
 *    ≤3 行信息。
 *
 *  红线落实：词落位 = wa(id,f)（manifest 已就位；⑧ 轮已按句内字位复核一轮微调，词级实测复核留 ⑨ 轮 QA）；
 *    y≥56 / bottom≥176；尾幕渐黑（红线四）窗取末 beat 总时长（p5-06..p5-07
 *    之和）——终点即本幕终点；收尾版式不挂 SceneTag（承 ep1–ep10 先例）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, Panel} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFadeOut, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 5-A 环体定格收束：金句卡 + 四上界徽章 + 界环 + 章铭小卡 ────────────────

/** 收束环体位（居中——同形回归定格） */
const RING_5A = {x: 740, y: 220, size: 440} as const;
const RING_5AC = {cx: RING_5A.x + RING_5A.size / 2, cy: RING_5A.y + RING_5A.size / 2, r: RING_5A.size / 2 - 46} as const;
/** 四上界徽章（沿环外圈——分类三行＋重试位的上界蒸馏；数字与全片计数对账） */
const BADGES = [
  {t: '升 1', angle: -150},
  {t: '续 3', angle: -30},
  {t: '压 1', angle: 30},
  {t: '试 10', angle: 150},
] as const;

const FiveA: React.FC<{
  atQuote: number;
  atK1: number;
  atK2: number;
  atBadges: number[];
  atBound: number;
  atSink: number;
  atMotto: number;
}> = ({atQuote, atK1, atK2, atBadges, atBound, atSink, atMotto}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  // 金句卡淡入定格（收束仪式）
  const quote = useProgress(atQuote, DUR.f5);
  // 两关键词各压一拍重读（scale + 辉光脉冲——mech/backoff 双主题色）
  const k1 = Math.sin(Math.PI * clamp01(progress(frame, atK1, DUR.f6)));
  const k2 = Math.sin(Math.PI * clamp01(progress(frame, atK2, DUR.f6)));
  const k1Glow = clamp01(progress(frame, atK1, DUR.f5));
  const k2Glow = clamp01(progress(frame, atK2, DUR.f5));
  // 四徽章沿环依次点亮
  const badgePs = atBadges.map((a) => clamp01(progress(frame, a, DUR.f4)));
  // 界环（上界的界——有界的空间陈述）
  const bound = clamp01(progress(frame, atBound, DUR.f5 + 8));
  // 金句卡下移半格 + 章铭小卡淡入
  const sink = clamp01(progress(frame, atSink, DUR.f5));
  const motto = clamp01(progress(frame, atMotto, DUR.f6));
  const dot = ((frame + 12) / (fps * 5)) % 1;
  return (
    <AbsoluteFill>
      {/* 背景各幕装置元素退为暗层（残影暗层——不抢焦） */}
      <div style={{position: 'absolute', left: 120, top: 640, opacity: 0.12}}>
        <Panel accent={theme.mech} style={{width: 210, height: 120, padding: 10}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            {[0, 1, 2].map((k) => (
              <span key={`gt${k}`} style={{height: 8, borderRadius: 3, background: theme.mech, width: `${80 - k * 18}%`}} />
            ))}
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 1560, top: 660, opacity: 0.12}}>
        <svg width={220} height={110} viewBox="0 0 220 110">
          <path d="M 6 96 L 46 96 L 46 70 L 78 70 L 78 40 L 110 40 L 110 10" fill="none" stroke={theme.backoff} strokeWidth={5} strokeLinecap="round" />
        </svg>
      </div>
      {/* 环体（居中同形回归——陶土橙实线；静持缓转） */}
      <div style={{position: 'absolute', left: RING_5A.x, top: RING_5A.y}}>
        <LoopRing size={RING_5A.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {/* 四上界徽章（沿环外圈依次点亮） */}
      {BADGES.map((b, i) => {
        const p = badgePs[i];
        if (p <= 0.02) return null;
        const rad = (b.angle * Math.PI) / 180;
        const bx = RING_5AC.cx + (RING_5AC.r + 62) * Math.cos(rad);
        const by = RING_5AC.cy + (RING_5AC.r + 62) * Math.sin(rad);
        return (
          <div
            key={`bg${i}`}
            style={{
              position: 'absolute',
              left: bx - 46,
              top: by - 26,
              width: 92,
              padding: '7px 0',
              borderRadius: 12,
              border: `3px solid ${withAlpha(theme.mech, 0.55 + 0.45 * p)}`,
              background: theme.panel,
              fontFamily: theme.mono,
              fontSize: 24,
              fontWeight: 700,
              color: p > 0.5 ? theme.mech : theme.dim,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              opacity: p,
              transform: `scale(${0.8 + 0.2 * p})`,
              boxShadow: p > 0.9 ? `0 0 ${14 * p}px ${withAlpha(theme.mech, 0.4)}` : 'none',
            }}
          >
            {b.t}
          </div>
        );
      })}
      {/* 界环（四徽章外圈——上界的界） */}
      {bound > 0.02 ? (
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <circle cx={RING_5AC.cx} cy={RING_5AC.cy} r={RING_5AC.r + 118} fill="none" stroke={withAlpha(theme.mech, 0.55)} strokeWidth={3} strokeDasharray="12 10" opacity={bound} />
        </svg>
      ) : null}
      {/* 金句卡（衬线体覆上层——两关键词重读；p5-03 下移半格） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 92 + 54 * sink, display: 'flex', justifyContent: 'center', zIndex: 3}}>
        {quote > 0.02 ? (
          <div style={{opacity: quote, transform: `translateY(${(1 - quote) * 20}px)`}}>
            <Panel accent={theme.mech} style={{padding: '22px 56px'}}>
              <div style={{fontFamily: theme.serif, fontSize: 50, color: theme.text, whiteSpace: 'nowrap'}}>
                {/* caption-dup-ok: 金句卡刻意复述（收束定格仪式，承 ep1/ep2/ep10 5-A 豁免先例） */}
                <span style={{fontWeight: 700, color: theme.mech, display: 'inline-block', transform: `scale(${1 + 0.05 * k1})`, textShadow: k1Glow > 0.01 ? `0 0 ${22 * k1Glow}px ${withAlpha(theme.mech, 0.5)}` : 'none'}}>{'按类型分径'}</span>
                <span>{' · '}</span>
                <span style={{fontWeight: 700, color: theme.backoff, display: 'inline-block', transform: `scale(${1 + 0.05 * k2})`, textShadow: k2Glow > 0.01 ? `0 0 ${22 * k2Glow}px ${withAlpha(theme.backoff, 0.5)}` : 'none'}}>{'有上界'}</span>
              </div>
            </Panel>
          </div>
        ) : null}
      </div>
      {/* 章铭小卡（衬线体引言式——p5-03 淡入一拍） */}
      {motto > 0.02 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 236 + 54 * sink, display: 'flex', justifyContent: 'center', zIndex: 3}}>
          <div
            style={{
              padding: '12px 34px',
              borderRadius: 12,
              border: `2.5px solid ${withAlpha(theme.dim, 0.55)}`,
              background: withAlpha(theme.panel, 0.88),
              fontFamily: theme.serif,
              fontSize: 28,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: motto,
              transform: `translateY(${(1 - motto) * 14}px)`,
            }}
          >
            {'错误不是终点，是重试的起点'}
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'升 1 · 续 3 · 压 1 · 试 10'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 下期卡前奏：目标光点头颅明灭 + 空盘面 + 下期卡 ─────────────────────

const RING_5B = {x: 980, y: 240, size: 400} as const;
const HEAD_ANGLE = 0; // 「模型」节点 = 3 点方向（头颅位）

const FiveB: React.FC<{atBlink: number; atGhostFile: number; atFaster: number; atNext: number}> = ({atBlink, atGhostFile, atFaster, atNext}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const faster = clamp01(progress(frame, atFaster, 60));
  // 目标光点头颅内明灭（频率随 faster 渐快、亮度渐弱——丢得快的抽象化）
  const freq = 6 + 13 * faster;
  const blink = 0.5 + 0.5 * Math.sin((frame / freq) * (Math.PI / 2) * 2);
  const brightness = (0.95 - 0.55 * faster) * clamp01(progress(frame, atBlink, DUR.f4));
  // 盘面文件轮廓虚影（想落盘而不得——闪现即灭）
  const ghostFile = Math.sin(Math.PI * clamp01(progress(frame, atGhostFile, 26)));
  // 下期卡浮起定格（只点问题不预告机制）
  const next = clamp01(progress(frame, atNext, DUR.f5));
  const ringR = RING_5B.size / 2 - 46;
  const cx = RING_5B.x + RING_5B.size / 2;
  const cy = RING_5B.y + RING_5B.size / 2;
  const hx = cx + ringR * Math.cos((HEAD_ANGLE * Math.PI) / 180);
  const hy = cy + ringR * Math.sin((HEAD_ANGLE * Math.PI) / 180);
  const dot = ((frame + 30) / (fps * 6)) % 1;
  return (
    <AbsoluteFill>
      {/* 环体（居中偏右继续缓转） */}
      <div style={{position: 'absolute', left: RING_5B.x, top: RING_5B.y}}>
        <LoopRing size={RING_5B.size} nodes={[]} showExit={false} dotProgress={dot} />
        {/* 「模型」节点头颅 + 目标光点（只在头颅内——不落盘面） */}
        <svg width={RING_5B.size} height={RING_5B.size} viewBox={`0 0 ${RING_5B.size} ${RING_5B.size}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          <g>
            <circle cx={hx - cx + RING_5B.size / 2} cy={hy - cy + RING_5B.size / 2} r={34} fill={withAlpha(theme.panel, 0.96)} stroke={theme.core} strokeWidth={4} />
            {/* 目标光点（头颅内明灭——大目标只在模型记忆里） */}
            <circle
              cx={hx - cx + RING_5B.size / 2}
              cy={hy - cy + RING_5B.size / 2}
              r={9 + 4 * blink}
              fill={theme.core}
              opacity={brightness * (0.35 + 0.65 * blink)}
            />
          </g>
          <text x={hx - cx + RING_5B.size / 2 + 44} y={hy - cy + RING_5B.size / 2 - 34} fontFamily={theme.sans} fontSize={20} fontWeight={600} fill={theme.dim}>
            {'模型'}
          </text>
        </svg>
      </div>
      {/* 盘面 / 工作区（空无一字——大目标不落盘的空间陈述；虚影闪现即灭） */}
      <div
        style={{
          position: 'absolute',
          left: 250,
          top: 350,
          width: 480,
          height: 300,
          borderRadius: 14,
          border: `3px dashed ${withAlpha(theme.dim, 0.55)}`,
          background: withAlpha(theme.panel, 0.45),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: clamp01(progress(frame, atBlink, DUR.f5)),
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.7}}>{'工作区'}</span>
        {/* 文件轮廓虚影（闪现即灭） */}
        {ghostFile > 0.03 ? (
          <svg width={74} height={96} viewBox="0 0 74 96" style={{position: 'absolute', opacity: ghostFile * 0.8}}>
            <path d="M 12 6 L 46 6 L 62 24 L 62 90 L 12 90 Z" fill="none" stroke={theme.dim} strokeWidth={3} strokeDasharray="6 5" />
            <path d="M 44 6 L 44 26 L 62 26" fill="none" stroke={theme.dim} strokeWidth={3} />
          </svg>
        ) : null}
      </div>
      {/* 下期卡（浮起定格——只点问题不点机制） */}
      {next > 0.02 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 742, display: 'flex', justifyContent: 'center', opacity: next}}>
          <div style={{transform: `translateY(${(1 - next) * 22}px)`}}>
            <Panel accent={theme.core} style={{padding: '18px 54px', textAlign: 'center'}}>
              <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text, letterSpacing: 12, paddingLeft: 12, whiteSpace: 'nowrap'}}>{'下期'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 6, whiteSpace: 'nowrap'}}>{'大目标，只在记忆里'}</div>
            </Panel>
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'盘面空 · 头颅亮'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 片尾署源卡（尾部署源位，RSI I-080 豁免） ──────────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-06 口播同拍淡入；两行先后落定（署源专名口播例外随行）
  const card = useEnter('rise', {at: atCard + 2, dur: DUR.f6, dist: 24, restBottom: 560});
  const l1At = atCard + Math.round(durCard * 0.32);
  const l1 = useProgress(l1At, DUR.f5);
  const l2At = l1At + DUR.f6;
  const l2 = useProgress(l2At, DUR.f5);
  const mit = useProgress(l2At + 8, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: 316,
        opacity: card.opacity,
        transform: card.transform,
      }}
    >
      <Panel accent={withAlpha(theme.mech, 0.4)} style={{position: 'relative', padding: '46px 64px', textAlign: 'center'}}>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: 56,
            fontWeight: 700,
            color: theme.text,
            letterSpacing: 2,
            whiteSpace: 'nowrap',
            opacity: l1,
            transform: `translateY(${(1 - l1) * 12}px)`,
          }}
        >
          {'Learn Claude Code'}
        </div>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: 28,
            color: theme.dim,
            marginTop: 20,
            whiteSpace: 'nowrap',
            opacity: l2,
            transform: `translateY(${(1 - l2) * 10}px)`,
          }}
        >
          {'github.com/shareAI-lab/learn-claude-code'}
        </div>
        {/* 角注（卡面第 3 行信息，≤3 行封顶） */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 20,
            fontFamily: theme.mono,
            fontSize: 16,
            color: theme.dim,
            letterSpacing: 1,
            opacity: mit * 0.9,
          }}
        >
          {'MIT'}
        </div>
      </Panel>
    </div>
  );
};

/** 幕末渐黑（红线四）：窗 = 末 beat 总时长（p5-06..p5-07 之和），终点即本幕终点 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P5BoundsAndNext: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p5-01', 'p5-03');
  const bB = w('p5-04', 'p5-05');
  const bC = w('p5-06', 'p5-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <FiveA
          atQuote={wa('p5-01', 0.08) - bA.from}
          atK1={wa('p5-01', 0.32) - bA.from}
          atK2={wa('p5-01', 0.6) - bA.from}
          atBadges={[wa('p5-02', 0.1), wa('p5-02', 0.28), wa('p5-02', 0.44), wa('p5-02', 0.58)].map((v) => v - bA.from)}
          atBound={wa('p5-02', 0.8) - bA.from}
          atSink={wa('p5-03', 0.1) - bA.from}
          atMotto={wa('p5-03', 0.32) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <FiveB
          atBlink={wa('p5-04', 0.5) - bB.from}
          atGhostFile={wa('p5-04', 0.66) - bB.from}
          atFaster={wa('p5-05', 0.15) - bB.from}
          atNext={wa('p5-05', 0.7) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <CreditCard atCard={at('p5-06') - bC.from} durCard={span('p5-06')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bC.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5BoundsAndNext;
