/** P5 收束与下期（p5-01..p5-07，3 镜）——分镜 5-A / 5-B / 5-C。
 *
 *  幕间转场（4-D→5-A，头注明示）：生产对照 → 收束定格属语义断裂，走
 *  SceneFade；值班钟以主装置签名 + 环体〔M-001〕同形回归（镜间身份恒常，
 *  非 morph，承 ep2/ep15/ep16 4-D→5-A 形态）。
 *
 *  叙事链：5-A 值班钟定格收束 + 金句卡（衬线体）：p5-01「一句话收束」金句卡
 *  淡入定格、「看见不等于抢到」「一口气锁完」两词各压一拍重读排版、钟摆落定
 *  停摆（定格即陈述）→ p5-02「自己看板、自己认领」任务墙缩微中名字签齐闪
 *  一拍、「全靠这把锁兜底」一枚锁扣小形扣上钟摆转轴（值班钟主喻与锁合框，
 *  重音镜——A#4 回扣）→ 5-B 下期问题+下期卡：p5-03「谁干活说清了」问签一翻
 *  成勾、「在哪干活，还没说」问签二保持问号悬停 → p5-04「同改一个文件」双
 *  光标同落文件卡、「正踩在别人的改动上」下一行文字条压上前一行、红色踩印
 *  闪一拍（踩脚具象——只点问题）→ p5-05「下期」下期卡浮起定格、「下期」签
 *  点亮（只点问题不预告机制）→ 5-C 片尾署源卡：p5-06 卡随口播同拍淡入两行
 *  先后落定、p5-07 静持（漂移警示由口播承载，卡面零复述），全片在此卡收束。
 *
 *  空间契约：金句卡为唯一衬线体主体、钟与锁合框为收束构图、四绿一红缩微
 *  可数、卡外禁新增装饰、锁扣禁遮钟面读数、双光标为两队友品红系色签名、
 *  踩印为唯一红闪、下期卡仅剪影（禁出现房间/隔离等下期机制图形、「下期」外
 *  禁出现预告词）、署源卡为最后画面、卡面 ≤3 行信息、字号禁低于可读阈值。
 *  红线落实：金句卡刻意复述（收束定格仪式，承 ep1/ep2/ep15/ep16 5-A 豁免
 *  先例——storyboard 5-A 行登记 caption-dup-ok）；卡面禁复述口播整句；
 *  词落位 = wa(id,f)；y≥56 / bottom≥176；尾幕渐黑窗 = 末镜总时长。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {DutyClock, LoopRing, Panel, TrapCard, WallTaskCard} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFadeOut, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 5-A 值班钟定格收束 + 金句卡（衬线体）+ 锁扣回扣 ──────────────────────────

/** 5-A 布局（安全带红线：钟落点签底 ≈ 170+800+38=838、任务墙缩微底 620+84=
 *  704，恒 ≤ 860。 */
const CLOCK_5A = {x: 430, y: 170, size: 500} as const;
const MINIWALL_5A = {x: 140, y: 620, w: 130, h: 84, gap: 12} as const;
const RING_5A = {x: 1030, y: 640, size: 170} as const;
const QUOTE_5A = {x: 1120, y: 330} as const;

const FiveA: React.FC<{atQuote: number; atStop: number; atK1: number; atK2: number; atSigns: number; atClasp: number}> = ({
  atQuote,
  atStop,
  atK1,
  atK2,
  atSigns,
  atClasp,
}) => {
  const frame = useCurrentFrame();
  // 金句卡淡入定格（收束仪式——衬线体覆层）
  const quote = useProgress(atQuote, DUR.f5);
  // 钟摆落定停摆（定格即陈述——摆幅收敛到两落点之间停住）
  const stop = clamp01(progress(frame, atStop, 16));
  const swing = (1 - stop) * Math.sin(frame / 26) * 0.6 + 0.1;
  // 两关键词各压一拍重读（看见不等于抢到 / 一口气锁完）
  const k1 = Math.sin(Math.PI * clamp01(progress(frame, atK1, DUR.f6)));
  const k2 = Math.sin(Math.PI * clamp01(progress(frame, atK2, DUR.f6)));
  const k1G = clamp01(progress(frame, atK1, DUR.f5));
  const k2G = clamp01(progress(frame, atK2, DUR.f5));
  // 任务墙缩微中名字签齐闪一拍（自己看板、自己认领）
  const signs = Math.sin(Math.PI * clamp01(progress(frame, atSigns, 22)));
  // 锁扣小形扣上钟摆转轴（全靠这把锁兜底——值班钟主喻与锁合框，重音镜）
  const clasp = clamp01(progress(frame, atClasp, 14));
  const claspFlash = Math.sin(Math.PI * clamp01(progress(frame, atClasp, 26)));
  return (
    <AbsoluteFill>
      {/* 背景 P4 元素退为暗层（生产对照缩影——收束不抢焦） */}
      {[{x: 90, y: 200}, {x: 1720, y: 190}, {x: 1760, y: 700}].map((p, i) => (
        <svg key={`bg${i}`} width={120} height={110} viewBox="0 0 120 110" style={{position: 'absolute', left: p.x, top: p.y, opacity: 0.14}}>
          <rect x={14} y={12} width={92} height={84} rx={9} fill="none" stroke={i === 1 ? theme.lock : theme.watch} strokeWidth={4} />
        </svg>
      ))}
      {/* 值班钟满幅居中定格（钟摆停在两落点之间——主装置收束签名） */}
      <DutyClock x={CLOCK_5A.x} y={CLOCK_5A.y} size={CLOCK_5A.size} litP={1} swing={swing} landing1P={1} landing2P={1} />
      {/* 锁扣小形（扣上钟摆转轴——不遮钟面读数，置于轴心旁） */}
      {clasp > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: CLOCK_5A.x + CLOCK_5A.size / 2 - 26,
            top: CLOCK_5A.y + CLOCK_5A.size / 2 - 30,
            transform: `scale(${0.7 + 0.3 * clasp})`,
            opacity: clasp,
          }}
        >
          <svg width={52} height={60} viewBox="0 0 52 60">
            <rect x={8} y={24} width={36} height={26} rx={6} fill={theme.panel} stroke={theme.lock} strokeWidth={4} />
            <path d="M17 24 v-6 a9 9 0 0 1 18 0 v6" fill="none" stroke={theme.lock} strokeWidth={4} />
            <circle cx={26} cy={37} r={4.5} fill={theme.lock} />
          </svg>
          {claspFlash > 0.03 ? (
            <div
              style={{
                position: 'absolute',
                inset: -14,
                borderRadius: 14,
                boxShadow: `0 0 ${30 * claspFlash}px ${withAlpha(theme.lock, 0.6 * claspFlash)}`,
                pointerEvents: 'none',
              }}
            />
          ) : null}
        </div>
      ) : null}
      {/* 环体〔M-001〕同形回归缩悬钟侧（定格收束——恒 core 描边） */}
      <div style={{position: 'absolute', left: RING_5A.x, top: RING_5A.y}}>
        <LoopRing size={RING_5A.size} nodes={[]} showExit={false} showLabels={false} dotProgress={undefined} />
      </div>
      {/* 任务墙缩微（四绿卡 + 红灯陷阱卡同框可数——承 2-D 末态） */}
      <div style={{position: 'absolute', left: MINIWALL_5A.x, top: MINIWALL_5A.y, display: 'flex', gap: MINIWALL_5A.gap, alignItems: 'flex-start'}}>
        {['初稿', '配图', '排版', '发布'].map((t) => (
          <div key={`mw${t}`} style={{position: 'relative'}}>
            <WallTaskCard x={0} y={0} w={MINIWALL_5A.w} h={MINIWALL_5A.h} id="task_005" title={t} micro greenP={1} claimP={1} signer="队友" />
            <div style={{position: 'absolute', inset: 0, boxShadow: signs > 0.03 ? `0 0 ${16 * signs}px ${withAlpha(theme.mate, 0.6 * signs)}` : 'none', borderRadius: 12, pointerEvents: 'none'}} />
          </div>
        ))}
        <div style={{position: 'relative'}}>
          <TrapCard x={0} y={0} w={MINIWALL_5A.w} h={MINIWALL_5A.h} litP={1} ghostP={1} redP={1} gateP={1} />
        </div>
      </div>
      {/* 金句卡（衬线体覆层——唯一衬线体主体；两关键词各压一拍重读排版） */}
      {quote > 0.02 ? (
        <div style={{position: 'absolute', left: QUOTE_5A.x, top: QUOTE_5A.y, zIndex: 3, opacity: quote, transform: `translateY(${(1 - quote) * 20}px)`}}>
          <Panel accent={withAlpha(theme.core, 0.55)} style={{padding: '30px 48px'}}>
            <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.text, whiteSpace: 'nowrap'}}>
              {/* caption-dup-ok: 金句卡刻意复述（收束定格仪式，承 ep1/ep2/ep15/
                  ep16 5-A 豁免先例——storyboard 5-A 行登记） */}
              <span style={{fontWeight: 700, color: theme.danger, display: 'inline-block', transform: `scale(${1 + 0.06 * k1})`, textShadow: k1G > 0.01 ? `0 0 ${22 * k1G}px ${withAlpha(theme.danger, 0.5)}` : 'none'}}>{'看见 ≠ 抢到 · '}</span>
              <span>{'查与写，'}</span>
              <span style={{fontWeight: 700, color: theme.core, display: 'inline-block', transform: `scale(${1 + 0.06 * k2})`, textShadow: k2G > 0.01 ? `0 0 ${22 * k2G}px ${withAlpha(theme.core, 0.5)}` : 'none'}}>{'一口气锁完'}</span>
            </div>
          </Panel>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'值班钟 × 锁扣 · 自治的兜底'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 下期问题 + 共享文件卡双光标踩脚 + 下期卡（只点问题） ──────────────────

/** 5-B 布局（安全带红线：问签底 ~230、文件卡底 300+420=720、下期卡底
 *  580+230=810，恒 ≤ 860。 */
const QS_5B = [
  {x: 480, y: 150, q: '谁干活', a: '已说清 ✓'},
  {x: 1150, y: 150, q: '在哪干活', a: '还没说 ?'},
] as const;
const FILE_5B = {x: 460, y: 300, w: 760, h: 420} as const;
const NEXT_5B = {x: 1300, y: 560, w: 320, h: 230} as const;

const FiveB: React.FC<{atQ1: number; atQ2: number; atCursors: number; atStep: number; atFoot: number; atNext: number}> = ({
  atQ1,
  atQ2,
  atCursors,
  atStep,
  atFoot,
  atNext,
}) => {
  const frame = useCurrentFrame();
  // 问签一翻成勾（谁干活说清了）；问签二随「在哪干活」亮出并保持问号悬停
  const q1 = clamp01(progress(frame, atQ1, 12));
  const q2Lit = clamp01(progress(frame, atQ2, 12));
  const q2Hover = q2Lit * (0.55 + 0.45 * Math.sin(frame / 9));
  // 双光标同落文件卡（两队友品红系色签名——先后落位）
  const cursors = clamp01(progress(frame, atCursors, 14));
  // 「下一行」文字条压上前一行（正踩在别人的改动上）
  const step = clamp01(progress(frame, atStep, 16));
  // 红色踩印闪一拍（踩脚具象——只点问题，唯一红闪）
  const foot = Math.sin(Math.PI * clamp01(progress(frame, atFoot, 18)));
  // 下期卡浮起定格 + 「下期」签点亮
  const next = clamp01(progress(frame, atNext, DUR.f5));
  return (
    <AbsoluteFill>
      {/* 两枚问签 */}
      {QS_5B.map((qs, i) => (
        <div
          key={`qs${i}`}
          style={{
            position: 'absolute',
            left: qs.x,
            top: qs.y,
            padding: '14px 30px',
            borderRadius: 12,
            border: `3px solid ${withAlpha(i === 0 ? theme.ok : theme.dim, i === 0 ? 0.85 : 0.45 + 0.4 * q2Lit)}`,
            background: withAlpha(theme.panel, 0.97),
            fontFamily: theme.sans,
            fontSize: 24,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{color: theme.text}}>{`${qs.q} · `}</span>
          {i === 0 ? (
            <span style={{color: theme.ok, opacity: q1}}>{qs.a}</span>
          ) : (
            <span style={{color: theme.dim, opacity: q2Hover}}>{qs.a}</span>
          )}
        </div>
      ))}
      {/* 共享文件卡（两个队友同改一个文件——行文本 + 双光标 + 踩脚印） */}
      <div style={{position: 'absolute', left: FILE_5B.x, top: FILE_5B.y, width: FILE_5B.w, height: FILE_5B.h}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 14,
            border: `3px solid ${withAlpha(theme.panelBorder, 0.95)}`,
            background: withAlpha(theme.panel, 0.96),
            padding: '20px 26px',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.inbox, whiteSpace: 'nowrap', marginBottom: 14}}>{'shared/launch.md'}</div>
          {/* 既有行（前一行——别人的改动，被踩对象） */}
          {[0, 1].map((r) => (
            <div key={`ln${r}`} style={{display: 'flex', alignItems: 'center', gap: 12, height: 44}}>
              <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, width: 30}}>{`${r + 12}`}</span>
              <span style={{flexGrow: 1, height: 10, borderRadius: 3, background: withAlpha(theme.dim, 0.3)}} />
            </div>
          ))}
          {/* 被改的前一行（改动段亮起——别人的改动） */}
          <div style={{display: 'flex', alignItems: 'center', gap: 12, height: 44, position: 'relative'}}>
            <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, width: 30}}>14</span>
            <span style={{width: 320, height: 12, borderRadius: 3, background: withAlpha(theme.ok, 0.5), border: `2px solid ${withAlpha(theme.ok, 0.7)}`}} />
            {/* 「下一行」文字条踩上前一行（你写的下一行压在别人的改动上） */}
            <div
              style={{
                position: 'absolute',
                left: 42 + step * 260,
                top: 20 + (1 - step) * -64,
                width: 300,
                height: 26,
                borderRadius: 5,
                border: `2.5px solid ${withAlpha(theme.mate, 0.9)}`,
                background: withAlpha(theme.mate, 0.16),
                opacity: step,
              }}
            >
              <span style={{fontFamily: theme.sans, fontSize: 15, fontWeight: 700, color: theme.mate, marginLeft: 10, lineHeight: '26px', whiteSpace: 'nowrap'}}>你写的下一行</span>
            </div>
          </div>
          {/* 红色踩印（一闪——踩脚具象） */}
          {foot > 0.05 ? (
            <div
              style={{
                position: 'absolute',
                left: 300,
                top: 118,
                fontFamily: theme.serif,
                fontSize: 64,
                fontWeight: 700,
                color: theme.danger,
                opacity: foot,
                transform: `rotate(${foot * -14}deg) scale(${1 + 0.3 * foot})`,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              踩
            </div>
          ) : null}
          {/* 空行若干 */}
          {[0, 1].map((r) => (
            <div key={`em${r}`} style={{display: 'flex', alignItems: 'center', gap: 12, height: 44}}>
              <span style={{fontFamily: theme.mono, fontSize: 15, color: theme.dim, width: 30}}>{`${r + 15}`}</span>
              <span style={{width: r === 0 ? 260 : 180, height: 10, borderRadius: 3, background: withAlpha(theme.dim, 0.22)}} />
            </div>
          ))}
        </div>
        {/* 双光标（两队友品红系色——先后落位文件卡上） */}
        {[0, 1].map((i) => {
          const cx = FILE_5B.w - 150 - i * 130;
          const cy = -40 - (1 - cursors) * 90 + i * 6;
          const tone = i === 0 ? theme.mate : withAlpha(theme.mate, 0.75);
          return (
            <svg key={`cur${i}`} width={54} height={54} viewBox="0 0 54 54" style={{position: 'absolute', left: cx, top: cy, opacity: cursors, overflow: 'visible'}}>
              <path d="M27 4 L27 46 M27 4 L14 19 M27 4 L40 19" stroke={tone} strokeWidth={5} strokeLinecap="round" fill="none" transform="rotate(180 27 25)" />
            </svg>
          );
        })}
      </div>
      {/* 下期卡（浮起定格——双光标对峙剪影；只点问题不预告机制图形） */}
      {next > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: NEXT_5B.x,
            top: NEXT_5B.y,
            width: NEXT_5B.w,
            height: NEXT_5B.h,
            borderRadius: 14,
            border: `3px solid ${withAlpha(theme.dim, 0.85)}`,
            background: withAlpha(theme.panel, 0.97),
            opacity: next,
            transform: `translateY(${(1 - next) * 26}px)`,
            padding: '18px 22px',
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 30, fontWeight: 700, color: theme.text, letterSpacing: 8, whiteSpace: 'nowrap'}}>下期</div>
          {/* 双光标对峙剪影（两枚光标相对而立——问题悬置） */}
          <svg width={260} height={110} viewBox="0 0 260 110" style={{marginTop: 18, opacity: 0.85}}>
            <path d="M60 14 L60 70 M60 14 L44 34 M60 14 L76 34" stroke={theme.mate} strokeWidth={6} strokeLinecap="round" fill="none" transform="rotate(180 60 42)" />
            <path d="M200 14 L200 70 M200 14 L184 34 M200 14 L216 34" stroke={withAlpha(theme.mate, 0.7)} strokeWidth={6} strokeLinecap="round" fill="none" transform="rotate(180 200 42)" />
            <line x1={92} y1={42} x2={168} y2={42} stroke={withAlpha(theme.dim, 0.7)} strokeWidth={3} strokeDasharray="7 7" />
          </svg>
          <div style={{marginTop: 6, fontFamily: theme.sans, fontSize: 17, color: theme.dim, whiteSpace: 'nowrap'}}>双光标对峙 · 只点问题</div>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 210, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'同一文件 · 你写的下一行，正踩在别人的改动上'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 片尾署源卡（尾部署源位——豁免登记于工作区配置） ────────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-06 口播同拍淡入；两行先后落定（署源专名口播例外随行）
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
      <Panel accent={withAlpha(theme.watch, 0.4)} style={{position: 'relative', padding: '46px 64px', textAlign: 'center'}}>
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

/** 幕末渐黑（红线四）：窗 = 末镜总时长（p5-06..p5-07 之和），终点即本幕终点 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P5ClockAndNext: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p5-01', 'p5-02');
  const bB = w('p5-03', 'p5-05');
  const bC = w('p5-06', 'p5-07');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <FiveA
          atQuote={wa('p5-01', 0.08) - bA.from}
          atStop={wa('p5-01', 0.22) - bA.from}
          atK1={wa('p5-01', 0.4) - bA.from}
          atK2={wa('p5-01', 0.74) - bA.from}
          atSigns={wa('p5-02', 0.3) - bA.from}
          atClasp={wa('p5-02', 0.66) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <FiveB
          atQ1={wa('p5-03', 0.25) - bB.from}
          atQ2={wa('p5-03', 0.6) - bB.from}
          atCursors={wa('p5-04', 0.18) - bB.from}
          atStep={wa('p5-04', 0.55) - bB.from}
          atFoot={wa('p5-04', 0.78) - bB.from}
          atNext={wa('p5-05', 0.3) - bB.from}
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

export default P5ClockAndNext;
