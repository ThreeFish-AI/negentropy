/** P5 收束与下期（p5-01..p5-08，3 镜）——分镜 5-A / 5-B / 5-C。
 *
 *  叙事链：5-A 装置定格收束（EWS）：四段卡 + 拼装流 + 缓存徽标全装置定格居中、
 *  金句卡（衬线体）覆上层「有什么，才写什么」两关键词各压一拍重读排版
 *  （caption-dup-ok 承 ep1/ep2/ep6 5-A 豁免先例）、灰色写死长卡 ghost 自旁淡出
 *  （前史退役）、四段微光各闪一次、环体同形回归定格、右侧两格状态小窗（0-A
 *  同形）复现 → p5-03 开场意象兑现：状态小窗再变化一拍、说明卡同步跟动（与
 *  0-A「毫无反应」首尾对照〔M-003〕）→ 5-B 报错钩子：一记红色报错波形自画外
 *  砸向环体〔M-001〕→ 环体骤停定格（不破碎）、「不重试」「不换模型」两枚 ✗
 *  小签并排（只点问题）、下期卡浮起定格（卡面无下期机制图形）→ 5-C 片尾署源卡
 *  （尾部署源位，RSI I-080 豁免——署源句 p5-07、漂移警示句 p5-08）：主行
 *  Learn Claude Code / 次行仓库地址 / 角注 MIT，p5-08 期间卡片静持，全片在此
 *  卡收束。
 *
 *  空间契约：金句卡衬线体为覆层主体、状态小窗与 0-A 同形（对照可核对）、喻体
 *    不展开、波形警示红且显为不可恢复形态禁（预告恢复机制违红线）、环体骤停
 *    为定格非破碎消散（系列母题不灭）、下期卡无机制细节、署源卡为最后画面、
 *    卡面 ≤3 行信息。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥176；Dream · MEMORY.md 只进
 *    角标；尾幕渐黑（红线四）窗取末 beat 总时长（p5-07..p5-08 之和）——终点即
 *    本幕终点；收尾版式不挂 SceneTag（承 ep1–ep9 先例）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {CacheBadge, LoopRing, Panel, SectionCardStack, StateManifestCard, StatusPairWindows} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFadeOut, useImpulse, useProgress, useShake} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 5-A 装置定格收束：金句卡 + ghost 退役 + 开场意象兑现 ──────────────────

/** 收束全景位：四段卡（中）+ 清单（左）+ 徽标（右）——全装置定格 */
const STACK_5A = {x: 580, y: 230, w: 700, h: 460} as const;
const MANI_5A = {x: 170, y: 290, w: 340, h: 210} as const;
const GHOST_5A = {x: 90, y: 580, w: 360, h: 260} as const;
const WIN_5A = {x: 1440, y: 560, w: 280, h: 330} as const;

const FiveA: React.FC<{atQuote: number; atK1: number; atK2: number; atGhost: number; atGlow: number; atStep: number}> = ({atQuote, atK1, atK2, atGhost, atGlow, atStep}) => {
  const frame = useCurrentFrame();
  // 装置定格（先立——EWS 全景静持）
  const settle = useProgress(0, DUR.f5);
  // 金句卡淡入 + 两关键词各压一拍重读（scale + 辉光脉冲）
  const quote = useProgress(atQuote, DUR.f5);
  const k1 = useImpulse({at: atK1, dur: DUR.f6, peak: 0.05});
  const k2 = useImpulse({at: atK2, dur: DUR.f6, peak: 0.05});
  const k1Glow = useProgress(atK1, DUR.f5);
  const k2Glow = useProgress(atK2, DUR.f5);
  // 长卡 ghost 淡出（前史退役——不复燃）
  const ghostOut = useProgress(atGhost, DUR.f6);
  // 四段微光各闪一次（stagger——「各管各」的回扣一拍）
  const pulses = [0, 1, 2, 3].map((i) => Math.sin(Math.PI * clamp01(progress(frame, atGlow + i * 6, DUR.f4))));
  // 开场意象兑现：状态小窗再变化一拍 + 说明卡记忆行同步跟动（首尾对照）
  const step = useProgress(atStep, DUR.f5);
  const stepFlash = useImpulse({at: atStep + DUR.f4, dur: DUR.f6, peak: 1});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, opacity: settle * 0.95}}>
        {/* 状态清单卡（左——终态：记忆行有内容） */}
        <StateManifestCard x={MANI_5A.x} y={MANI_5A.y} w={MANI_5A.w} h={MANI_5A.h} rowsLit={2} memHas={1} />
        {/* 拼装流（清单 → 四段——收束定格的流向件） */}
        <svg width={80} height={60} viewBox="0 0 80 60" style={{position: 'absolute', left: 516, top: 380, overflow: 'visible'}}>
          <line x1={0} y1={30} x2={56} y2={30} stroke={withAlpha(theme.sky, 0.6)} strokeWidth={3.5} strokeDasharray="8 7" />
          <path d="M 48 20 L 64 30 L 48 40" fill="none" stroke={withAlpha(theme.sky, 0.75)} strokeWidth={3.5} strokeLinecap="round" />
        </svg>
        {/* 四段卡（居中定格——记忆卡同步跟动 chip：有内容） */}
        <SectionCardStack x={STACK_5A.x} y={STACK_5A.y} w={STACK_5A.w} h={STACK_5A.h} litP={[1, 1, 1, 1]} pulseP={pulses} />
        {step > 0.02 ? (
          <div
            style={{
              position: 'absolute',
              left: STACK_5A.x + 24,
              top: STACK_5A.y + 372,
              padding: '3px 12px',
              borderRadius: 7,
              border: `2.5px solid ${theme.mech}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 14,
              fontWeight: 700,
              color: theme.mech,
              whiteSpace: 'nowrap',
              opacity: step,
              transform: `translateY(${(1 - step) * 10}px)`,
              boxShadow: stepFlash > 0.05 ? `0 0 ${14 * stepFlash}px ${withAlpha(theme.mech, 0.5)}` : 'none',
            }}
          >
            {'记忆 · 有内容'}
          </div>
        ) : null}
        {/* 缓存徽标（拼装流出口——命中态定格；与状态小窗左缘净空 ≥30px） */}
        <CacheBadge x={1306} y={396} size={62} hitP={0.9} />
        {/* 灰色写死长卡 ghost（前史退役——淡出不复燃） */}
        <div style={{position: 'absolute', left: GHOST_5A.x, top: GHOST_5A.y, opacity: settle * (1 - ghostOut)}}>
          <SectionCardStack x={0} y={0} w={GHOST_5A.w} h={GHOST_5A.h} splitP={0} tintP={0} ghostP={1} />
          <div style={{position: 'absolute', left: 0, right: 0, bottom: -32, textAlign: 'center', fontFamily: theme.sans, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap', opacity: 0.8 * (1 - ghostOut)}}>
            {'写死的长卡 · 退役'}
          </div>
        </div>
        {/* 右侧两格状态小窗（0-A 同形复现——兑现拍再变化） */}
        <StatusPairWindows x={WIN_5A.x} y={WIN_5A.y} w={WIN_5A.w} h={WIN_5A.h} toolNewP={0} memOnP={0.85} stepP={step} />
      </div>
      {/* 金句卡（衬线体覆上层——收束定格仪式；与四段卡组顶缘净空 ≥6px 收排版距） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 84, display: 'flex', justifyContent: 'center', zIndex: 3}}>
        {quote > 0.02 ? (
          <div style={{opacity: quote, transform: `translateY(${(1 - quote) * 20}px)`}}>
            <Panel accent={theme.mech} style={{padding: '22px 56px'}}>
              <div style={{fontFamily: theme.serif, fontSize: 52, color: theme.text, whiteSpace: 'nowrap'}}>
                {/* caption-dup-ok: 金句卡刻意复述（收束定格仪式，承 ep1 5-A / ep2 5-A / ep6 3-C 豁免先例） */}
                <span style={{fontWeight: 700, color: theme.sky, display: 'inline-block', transform: `scale(${1 + k1})`, textShadow: k1Glow > 0.01 ? `0 0 ${22 * k1Glow}px ${withAlpha(theme.sky, 0.5)}` : 'none'}}>{'有什么'}</span>
                <span>{'，'}</span>
                <span style={{fontWeight: 700, color: theme.mech, display: 'inline-block', transform: `scale(${1 + k2})`, textShadow: k2Glow > 0.01 ? `0 0 ${22 * k2Glow}px ${withAlpha(theme.mech, 0.5)}` : 'none'}}>{'才写什么'}</span>
              </div>
            </Panel>
          </div>
        ) : null}
      </div>
      {/* 环体同形回归定格（右上一角——恒定描边/线宽） */}
      <div style={{position: 'absolute', left: 1690, top: 84, opacity: 0.5}}>
        <LoopRing size={120} nodes={[]} showExit={false} dotProgress={(frame / 85) % 1} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'分段 · 拼装 · 缓存——状态说了算'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 报错钩子：波形砸停环体 → ✗✗ 小签 → 下期卡 ────────────────────────

/** 环体位（5-B 主体——被砸停的循环） */
const RING_5B = {x: 770, y: 230, size: 380} as const;

const FiveB: React.FC<{atWave: number; atStop: number; atX1: number; atX2: number; atNext: number; stopAt: number}> = ({atWave, atStop, atX1, atX2, atNext, stopAt}) => {
  const frame = useCurrentFrame();
  // 红色报错波形自画外砸向环体（自右向左一记——jag 折线 + 冲击闪）
  const wave = clamp01(progress(frame, atWave, 16));
  const waveX = 2100 - 1500 * wave;
  const impact = Math.sin(Math.PI * clamp01(progress(frame, atWave + 14, 10)));
  // 环体骤停定格（定格非破碎：巡游点冻结在停拍位；环体不灭）
  const frozen = clamp01(progress(frame, atStop, 8));
  const dotPos = Math.min(frame, stopAt + 8) / 85;
  // 冲击微抖（砸停一拍——轻幅衰减）
  const shake = useShake({at: atWave + 14, dur: 18, amp: 5, freq: 1.7, decay: true});
  // 两枚 ✗ 小签（不重试 / 不换模型——只点问题）
  const x1 = useProgress(atX1, DUR.f4);
  const x2 = useProgress(atX2, DUR.f4);
  // 下期卡浮起定格（卡面无下期机制图形）
  const next = useProgress(atNext, DUR.f5);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: `translateX(${shake}px)`}}>
        {/* 环体（骤停定格——系列母题不灭） */}
        <div style={{position: 'absolute', left: RING_5B.x, top: RING_5B.y, opacity: 1 - 0.25 * frozen}}>
          <LoopRing size={RING_5B.size} nodes={[]} showExit={false} dotProgress={dotPos % 1} />
        </div>
        {/* 冲击闪（砸中位一拍——core 环上的红闪圈） */}
        {impact > 0.03 ? (
          <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
            <circle cx={RING_5B.x + RING_5B.size - 60} cy={RING_5B.y + RING_5B.size / 2} r={30 + 60 * impact} fill="none" stroke={theme.danger} strokeWidth={4} opacity={impact * 0.8} />
          </svg>
        ) : null}
        {/* 报错波形（红色 jag 折线——自画外砸入；定格后驻停拍位） */}
        <svg width={640} height={160} viewBox="0 0 640 160" style={{position: 'absolute', left: waveX, top: RING_5B.y + RING_5B.size / 2 - 80, overflow: 'visible', opacity: 0.95}}>
          <path
            d="M 620 80 L 540 80 L 512 24 L 478 136 L 448 40 L 420 96 L 388 80 L 300 80 L 272 34 L 240 130 L 214 52 L 188 84 L 150 80 L 60 80"
            fill="none"
            stroke={theme.danger}
            strokeWidth={5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <text x={540} y={-14} textAnchor="middle" fontFamily={theme.mono} fontSize={20} fontWeight={700} fill={theme.danger}>
            {'500'}
          </text>
        </svg>
      </div>
      {/* ✗✗ 小签（不重试 / 不换模型——并排；与环体底缘净空 ≥24px） */}
      {[
        {t: '不重试', p: x1, x: 700},
        {t: '不换模型', p: x2, x: 980},
      ].map((s) => (
        <div
          key={s.t}
          style={{
            position: 'absolute',
            left: s.x,
            top: 648,
            padding: '8px 24px',
            borderRadius: 10,
            border: `3px solid ${theme.danger}`,
            background: theme.panel,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: theme.sans,
            fontSize: 22,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: clamp01(s.p),
            transform: `translateY(${(1 - clamp01(s.p)) * 14}px)`,
          }}
        >
          <span style={{color: theme.danger}}>{'✗'}</span>
          {s.t}
        </div>
      ))}
      {/* 下期卡（视觉层——无机制图形；浮起定格） */}
      {next > 0.02 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 726, display: 'flex', justifyContent: 'center', opacity: next}}>
          <div style={{transform: `translateY(${(1 - next) * 22}px)`}}>
            <Panel accent={theme.core} style={{padding: '18px 54px', textAlign: 'center'}}>
              <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text, letterSpacing: 12, paddingLeft: 12, whiteSpace: 'nowrap'}}>{'下期'}</div>
              <div style={{fontFamily: theme.sans, fontSize: 17, color: theme.dim, marginTop: 6, whiteSpace: 'nowrap'}}>{'出错就停 · 怎么办'}</div>
            </Panel>
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'一撞就停 · 定格不灭'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 片尾署源卡（尾部署源位，RSI I-080 豁免） ──────────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-07 口播同拍淡入；两行先后落定（署源专名口播例外随行）
  const card = useEnter('rise', {at: atCard + 2, dur: DUR.f6, dist: 24, restBottom: 560});
  // ⑨ QA N2：主行落位 0.6→0.4——署源句长（~5s）下空面板悬 3.1s 压到 ~1.9s
  const l1At = atCard + Math.round(durCard * 0.4);
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

/** 幕末渐黑（红线四）：窗 = 末 beat 总时长（p5-07..p5-08 之和），终点即本幕终点 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P5WrapAndNext: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p5-01', 'p5-03');
  const bB = w('p5-04', 'p5-06');
  const bC = w('p5-07', 'p5-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <FiveA
          atQuote={wa('p5-01', 0.18) - bA.from}
          atK1={wa('p5-01', 0.32) - bA.from}
          atK2={wa('p5-01', 0.5) - bA.from}
          atGhost={wa('p5-02', 0.2) - bA.from}
          atGlow={wa('p5-02', 0.46) - bA.from}
          atStep={wa('p5-03', 0.36) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <FiveB
          atWave={wa('p5-04', 0.6) - bB.from}
          atStop={wa('p5-05', 0.16) - bB.from}
          atX1={wa('p5-05', 0.42) - bB.from}
          atX2={wa('p5-05', 0.64) - bB.from}
          atNext={wa('p5-06', 0.36) - bB.from}
          stopAt={wa('p5-05', 0.16) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <CreditCard atCard={at('p5-07') - bC.from} durCard={span('p5-07')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bC.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5WrapAndNext;
