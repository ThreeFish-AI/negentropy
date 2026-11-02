/** P5 收束与下期（p5-01..p5-06，4 镜）——分镜 5-A / 5-B / 5-C / 5-D。
 *
 *  叙事链：5-A 环体群定格收束＋金句卡（EWS）：金句卡（衬线体）随 p5-01 淡入
 *  定格、「不是另一个大脑」「同款循环」两词各压一拍重读排版〔M-005〕
 *  （caption-dup-ok 豁免登记——收束定格仪式，承 ep1/ep2/ep14 5-A 先例）→ 三环
 *  同转速定格一拍（同款=循环没换的空间陈述）〔M-003〕、湛蓝信箱串联其间 →
 *  5-B 递话链收束：p5-02「没换循环」词落位三环轮廓同时亮一拍、「全落在下一轮」
 *  词落位信箱→下一轮箭头链点亮〔M-005〕→ p5-03「会递信不等于会商量」词落位
 *  两枚问号签先后浮起（只点问题不预告机制）、箭头链尾端浮出问号断口 → 5-C
 *  下期卡（视觉层）：p5-04「下期」「算这本账」词落位下期卡浮起定格、信件在
 *  两环之间来回轻摆、摆动衰减至停（递得出、谈不拢——谁也不接）→ 5-D 片尾
 *  署源卡（尾部署源位，豁免登记于工作区配置）：p5-05 同拍淡入两行先后落定、
 *  p5-06 静持（漂移警示由口播承载，卡面零复述），全片在此卡收束。
 *
 *  空间契约：金句卡为唯一主体、衬线体、三环同款同转速、卡外无新增装饰；问号
 *    签 ≤8 字、断口在链尾（问题未解）；下期卡环体同款签名、信悬摆无一方接住、
 *    卡面仅「下期」一签；署源卡为最后画面、卡面 ≤3 行信息。
 *  红线落实：问号签禁获得答案元素、协商机制图形禁（下期正源）、任一环体接信
 *    禁（暗示解法）、信件落定任一侧禁（问题须悬置）、卡面复述口播整句禁、字号
 *    低于可读阈值禁；词落位 = wa(id,f)；y≥56 / bottom≥176；尾幕渐黑窗 = 末镜
 *    总时长。
 *
 *  承接登记：4-D→5-A SceneFade＋环群同形回归（镜间身份恒常，非 morph——承
 *    ep2/ep14 4-D→5-A 判例）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, MailboxFile, Panel, TeammateRing, useRingDot} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFadeOut, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 5-A 环体群定格收束：三环同款并列 + 信箱串联 + 金句卡（衬线体） ──────────

const RINGS_5A = [
  {x: 200, y: 190},
  {x: 770, y: 190},
  {x: 1340, y: 190},
] as const;
const RING_5A_SIZE = 380;
const QUOTE_Y = 700;

const FiveA: React.FC<{atQuote: number; atK1: number; atK2: number}> = ({atQuote, atK1, atK2}) => {
  const frame = useCurrentFrame();
  // 金句卡淡入定格（收束仪式——衬线体覆层）
  const quote = useProgress(atQuote, DUR.f5);
  // 两关键词各压一拍重读（「不是另一个大脑」/「同款循环」）
  const k1 = Math.sin(Math.PI * clamp01(progress(frame, atK1, DUR.f6)));
  const k2 = Math.sin(Math.PI * clamp01(progress(frame, atK2, DUR.f6)));
  const k1G = clamp01(progress(frame, atK1, DUR.f5));
  const k2G = clamp01(progress(frame, atK2, DUR.f5));
  // 湛蓝信箱串联其间（两只 mini——环缘-箱-环缘连线）
  const dot = useRingDot(2.5);
  return (
    <AbsoluteFill>
      {/* 背景拓扑元素退为暗层（4-A 生产拓扑的暗化缩影——收束不抢焦） */}
      {[{x: 60, y: 620}, {x: 1760, y: 600}, {x: 1660, y: 760}].map((p, i) => (
        <svg key={`bg${i}`} width={120} height={120} viewBox="0 0 120 120" style={{position: 'absolute', left: p.x, top: p.y, opacity: 0.18}}>
          <circle cx={60} cy={60} r={44} fill="none" stroke={theme.mate} strokeWidth={5} />
        </svg>
      ))}
      {/* 三环同款并列（橙居中、品红两侧——同转速定格一拍：循环没换的空间陈述） */}
      {RINGS_5A.map((r, i) => (
        <div key={`r5a${i}`} style={{position: 'absolute', left: r.x, top: r.y}}>
          {i === 1 ? <LoopRing size={RING_5A_SIZE} nodes={[]} showExit={false} dotProgress={dot} /> : <TeammateRing size={RING_5A_SIZE} dotProgress={dot} />}
        </div>
      ))}
      {/* 湛蓝信箱串联（环间两只 mini + 连线——递话的实体通道） */}
      {[
        {x: RINGS_5A[0].x + RING_5A_SIZE + 14, y: 330},
        {x: RINGS_5A[1].x + RING_5A_SIZE + 14, y: 330},
      ].map((m, i) => (
        <React.Fragment key={`m5a${i}`}>
          <svg width={220} height={120} viewBox="0 0 220 120" style={{position: 'absolute', left: m.x - 105, top: m.y + 40}}>
            <line x1={0} y1={60} x2={52} y2={60} stroke={withAlpha(theme.inbox, 0.6)} strokeWidth={3.5} strokeDasharray="10 8" />
            <line x1={168} y1={60} x2={220} y2={60} stroke={withAlpha(theme.inbox, 0.6)} strokeWidth={3.5} strokeDasharray="10 8" />
          </svg>
          <div style={{position: 'absolute', left: m.x, top: m.y + 6}}>
            <MailboxFile x={0} y={0} w={116} h={108} name="t.jsonl" litP={1} />
          </div>
        </React.Fragment>
      ))}
      {/* 金句卡（衬线体覆层——唯一主体；两关键词各压一拍重读排版） */}
      {quote > 0.02 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: QUOTE_Y, display: 'flex', justifyContent: 'center', zIndex: 3}}>
          <div style={{opacity: quote, transform: `translateY(${(1 - quote) * 20}px)`}}>
            <Panel accent={withAlpha(theme.core, 0.55)} style={{padding: '24px 54px'}}>
              <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.text, whiteSpace: 'nowrap'}}>
                {/* caption-dup-ok: 金句卡刻意复述（收束定格仪式，承 ep1/ep2/ep14
                    5-A 豁免先例——storyboard 5-A 行登记） */}
                <span>{'队友'}</span>
                <span style={{fontWeight: 700, color: theme.mate, display: 'inline-block', transform: `scale(${1 + 0.05 * k1})`, textShadow: k1G > 0.01 ? `0 0 ${22 * k1G}px ${withAlpha(theme.mate, 0.5)}` : 'none'}}>{'不是另一个大脑'}</span>
                <span>{' · 是又一条'}</span>
                <span style={{fontWeight: 700, color: theme.core, display: 'inline-block', transform: `scale(${1 + 0.05 * k2})`, textShadow: k2G > 0.01 ? `0 0 ${22 * k2G}px ${withAlpha(theme.core, 0.5)}` : 'none'}}>{'同款循环'}</span>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'组队没换循环 · 只是多了几条'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 递话链收束：三环同亮一拍 + 信箱→下一轮箭头链 + 两枚问号签 ────────────

const RINGS_5B = [
  {x: 340, y: 130},
  {x: 810, y: 130},
  {x: 1280, y: 130},
] as const;
const RING_5B_SIZE = 300;
const CHAIN_MAIL = {x: 300, y: 560, w: 150, h: 132} as const;
const QS_5B = [
  {x: 700, y: 560, zh: '关机谁说了算？'},
  {x: 1130, y: 560, zh: '审批找谁拍板？'},
] as const;

const FiveB: React.FC<{atGlow: number; atChain: number; atQ1: number; atQ2: number; atBreak: number}> = ({atGlow, atChain, atQ1, atQ2, atBreak}) => {
  const frame = useCurrentFrame();
  // 三环轮廓同时亮一拍（「没换循环」——同款并列即陈述）
  const glow = Math.sin(Math.PI * clamp01(progress(frame, atGlow, 24)));
  // 信箱→下一轮箭头链点亮（「全落在下一轮」——谁影响谁，全落在信箱和下一轮）
  const chain = clamp01(progress(frame, atChain, 22));
  // 两枚问号签先后浮起（只点问题不预告机制）
  const q1 = clamp01(progress(frame, atQ1, DUR.f5));
  const q2 = clamp01(progress(frame, atQ2, DUR.f5));
  // 链尾问号断口（问题未解——虚线断开 + 问号）
  const brk = clamp01(progress(frame, atBreak, 14));
  const dot = useRingDot(2.5);
  const leadCx = RINGS_5B[1].x + RING_5B_SIZE / 2;
  const leadCy = RINGS_5B[1].y + RING_5B_SIZE / 2;
  const mailCx = CHAIN_MAIL.x + CHAIN_MAIL.w / 2;
  const mailCy = CHAIN_MAIL.y + 40;
  return (
    <AbsoluteFill>
      {/* 三环群（收束主体延续——同转速） */}
      {RINGS_5B.map((r, i) => (
        <div key={`r5b${i}`} style={{position: 'absolute', left: r.x, top: r.y, filter: glow > 0.05 ? `drop-shadow(0 0 ${14 * glow}px ${i === 1 ? withAlpha(theme.core, 0.8) : withAlpha(theme.mate, 0.8)})` : 'none'}}>
          {i === 1 ? <LoopRing size={RING_5B_SIZE} nodes={[]} showExit={false} dotProgress={dot} /> : <TeammateRing size={RING_5B_SIZE} dotProgress={dot} />}
        </div>
      ))}
      {/* 「下一轮」签（主环内——队友靠写收件箱影响主代理的下一轮） */}
      <div
        style={{
          position: 'absolute',
          left: leadCx - 62,
          top: leadCy - 24,
          padding: '8px 20px',
          borderRadius: 10,
          border: `3px solid ${withAlpha(theme.core, 0.85)}`,
          background: withAlpha(theme.panel, 0.97),
          fontFamily: theme.sans,
          fontSize: 23,
          fontWeight: 700,
          color: theme.text,
          whiteSpace: 'nowrap',
          opacity: chain,
        }}
      >
        下一轮
      </div>
      {/* 递话链：信箱 → 主环「下一轮」位箭头链（点亮） */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <path
          d={`M ${mailCx} ${mailCy} Q ${(mailCx + leadCx) / 2} ${mailCy - 80} ${leadCx - 20} ${leadCy + 130}`}
          fill="none"
          stroke={withAlpha(theme.inbox, 0.85)}
          strokeWidth={4.5}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - chain}
        />
        {chain > 0.9 ? <path d={`M ${leadCx - 40} ${leadCy + 118} L ${leadCx - 20} ${leadCy + 130} L ${leadCx - 30} ${leadCy + 152}`} fill="none" stroke={withAlpha(theme.inbox, 0.85)} strokeWidth={4} strokeLinecap="round" /> : null}
      </svg>
      {/* 链首信箱（递话起点——湛蓝同款） */}
      <div style={{position: 'absolute', left: CHAIN_MAIL.x, top: CHAIN_MAIL.y}}>
        <MailboxFile x={0} y={0} w={CHAIN_MAIL.w} h={CHAIN_MAIL.h} name="lead.jsonl" litP={1} />
      </div>
      {/* 两枚问号签（先后浮起——只点问题；≤8 字/条） */}
      {QS_5B.map((q, i) => {
        const o = i === 0 ? q1 : q2;
        return (
          <div
            key={`q${i}`}
            style={{
              position: 'absolute',
              left: q.x,
              top: q.y - o * 24,
              padding: '12px 26px',
              borderRadius: 11,
              border: `2.5px dashed ${withAlpha(theme.dim, 0.85)}`,
              background: withAlpha(theme.panel, 0.97),
              fontFamily: theme.serif,
              fontSize: 26,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              opacity: o,
            }}
          >
            {q.zh}
          </div>
        );
      })}
      {/* 链尾问号断口（箭头链末端——虚线断开处悬一枚问号：问题未解） */}
      {brk > 0.05 ? (
        <div style={{position: 'absolute', left: leadCx + 96, top: leadCy - 46, fontFamily: theme.serif, fontSize: 42, fontWeight: 700, color: withAlpha(theme.dim, 0.95), opacity: brk}}>
          ？
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'会递信 ≠ 会商量 · 下期来算这本账'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 下期卡：两环对望 + 信件悬摆衰减至停（递得出、谈不拢） ─────────────────

const CARD_5C = {x: 460, y: 200, w: 1000, h: 560} as const;

const FiveC: React.FC<{atCard: number; atStill: number}> = ({atCard, atStill}) => {
  const frame = useCurrentFrame();
  // 下期卡浮起定格（「下期」——只点问题不预告机制）
  const card = useEnter('rise', {at: atCard, dur: DUR.f6, dist: 26, restBottom: 760});
  // 信件摆动衰减至停（「算这本账」——递得出谈不拢：衰减正弦，停在中间悬空位）
  const t = Math.max(0, frame - atStill) / 30;
  const decay = Math.exp(-t * 1.6) * Math.sin(t * 4.2) * 26;
  const dot = useRingDot(2.5);
  // 卡内几何：橙环左 / 品红环右 / 信箱中央下 / 信件悬两环之间
  const inL = {x: 90, y: 120, size: 300};
  const inR = {x: 610, y: 120, size: 300};
  const inMail = {x: 430, y: 330, w: 140, h: 124};
  const pivot = {x: CARD_5C.w / 2, y: 120};
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: CARD_5C.x, top: CARD_5C.y, opacity: card.opacity, transform: card.transform}}>
        <Panel accent={withAlpha(theme.core, 0.6)} style={{position: 'relative', width: CARD_5C.w, height: CARD_5C.h}}>
          {/* 两枚同款环体对望（一橙一品红——隔着信箱；谁也不接） */}
          <div style={{position: 'absolute', left: inL.x, top: inL.y}}>
            <LoopRing size={inL.size} nodes={[]} showExit={false} dotProgress={dot} />
          </div>
          <div style={{position: 'absolute', left: inR.x, top: inR.y}}>
            <TeammateRing size={inR.size} dotProgress={dot} />
          </div>
          {/* 信箱（中央下——递话的实体在，商量没发生） */}
          <div style={{position: 'absolute', left: inMail.x, top: inMail.y}}>
            <MailboxFile x={0} y={0} w={inMail.w} h={inMail.h} name="lead.jsonl" litP={1} />
          </div>
          {/* 悬摆信件（两环之间——绕悬点轻摆、衰减至停；无一方接住、不落定任一侧） */}
          <div style={{position: 'absolute', left: pivot.x - 110, top: pivot.y + 60, width: 220, height: 190}}>
            <svg width={220} height={190} viewBox="0 0 220 190" style={{overflow: 'visible'}}>
              <line x1={110} y1={0} x2={110} y2={44} stroke={withAlpha(theme.dim, 0.7)} strokeWidth={2.5} />
              <g transform={`rotate(${decay} 110 0)`}>
                {/* 信件（小信封——悬在两环之间来回轻摆） */}
                <rect x={78} y={44} width={64} height={44} rx={6} fill={withAlpha(theme.panel, 0.98)} stroke={theme.inbox} strokeWidth={3} />
                <path d={`M 78 50 L 110 74 L 142 50`} fill="none" stroke={theme.inbox} strokeWidth={2.5} />
                <line x1={110} y1={0} x2={110} y2={44} stroke={withAlpha(theme.dim, 0.7)} strokeWidth={2.5} />
              </g>
            </svg>
          </div>
          {/* 「下期」签（卡面唯一预告词——右上角缀） */}
          <div
            style={{
              position: 'absolute',
              top: 20,
              right: 28,
              fontFamily: theme.serif,
              fontSize: 30,
              fontWeight: 700,
              color: theme.text,
              letterSpacing: 8,
              whiteSpace: 'nowrap',
            }}
          >
            下期
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'递得出 · 谈不拢——下期算这本账'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-D 片尾署源卡（尾部署源位——豁免登记于工作区配置） ─────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-05 口播同拍淡入；两行先后落定（署源专名口播例外随行）
  const card = useEnter('rise', {at: atCard + 2, dur: DUR.f6, dist: 24, restBottom: 560});
  const l1At = atCard + Math.round(durCard * 0.3);
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
      <Panel accent={withAlpha(theme.inbox, 0.4)} style={{position: 'relative', padding: '46px 64px', textAlign: 'center'}}>
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

/** 幕末渐黑（红线四）：窗 = 末镜总时长（p5-05..p5-06 之和），终点即本幕终点 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P5RingsAndNext: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p5-01', 'p5-01');
  const bB = w('p5-02', 'p5-03');
  const bC = w('p5-04', 'p5-04');
  const bD = w('p5-05', 'p5-06');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <FiveA atQuote={wa('p5-01', 0.05) - bA.from} atK1={wa('p5-01', 0.36) - bA.from} atK2={wa('p5-01', 0.82) - bA.from} />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <FiveB
          atGlow={wa('p5-02', 0.15) - bB.from}
          atChain={wa('p5-02', 0.8) - bB.from}
          atQ1={wa('p5-03', 0.6) - bB.from}
          atQ2={wa('p5-03', 0.82) - bB.from}
          atBreak={wa('p5-03', 0.94) - bB.from}
        />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <FiveC atCard={wa('p5-04', 0.1) - bC.from} atStill={wa('p5-04', 0.5) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="5-D">
        <CreditCard atCard={at('p5-05') - bD.from} durCard={span('p5-05')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bD.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5RingsAndNext;
