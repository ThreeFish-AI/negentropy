/** P5 干净的核心（p5-01..p5-08，4 镜）——分镜 5-A / 5-B / 5-C / 5-D。
 *
 *  ★ 5-A 环体定格收束 + 金句卡（衬线体）「核心不变 · 能力正交叠加」（
 *    caption-dup-ok: 金句卡刻意复述〔收束定格仪式，承 ep1/ep2/ep3 5-A 豁免
 *    先例〕）；环体居中同形回归〔M-001〕（净化态——四紫点各驻一槽、互不
 *    连线：正交语义的空间陈述）；「降格成回调」闸卡小影滑入挂点位成串
 *    （1-C 迁移终态复认）、「固定挂点」四紫点槽位依次点亮、「零硬编码」环体
 *    整环静止一拍（静止即陈述）；背景生产元素整体退为暗层。
 *  ★ 5-B 泥球对比帧（单句重音镜）：左帧灰暗缠结泥球（复杂度压进核心——
 *    0-B 病灶的终局形态：环体轮廓被杂色缠线吞没）、「没人敢动」光标小影欲动
 *    又止；右帧干净环体（陶土橙 + 四紫点——5-A 收束态缩微）恒静恒净；两帧间
 *    左→右演化箭头。泥球帧无清扫动作（正解是挂出去不是清扫）；喻体边界随行
 *    （泥球喻耦合僵化非物理堆积）。
 *  ★ 5-C 下期问题卡（视觉层）：计划清单卡条目 stagger 漂移（一条游出对位线、
 *    一条掉队沉底——只点问题不预告机制）、漂移条目上位置/进度双问号浮起、
 *    「下期」字卡亮起定格（半拍收暗）；5-B 对比帧退居暗层。
 *  ★ 5-D 片尾署源卡（尾部署源位，RSI I-080 豁免；署源句 = p5-07）：主行
 *    Learn Claude Code / 次行仓库地址 / 角注 MIT（卡面 ≤3 行）；p5-08 漂移
 *    警示由口播承载、卡面零复述；全片在此卡收束。
 *  ★ 尾幕渐黑（红线四）：窗取末 beat 总时长（p5-07..p5-08 之和）——终点即
 *    本幕终点，勿改用末句单句窗。收尾版式不挂 SceneTag（承 ep1–ep3 先例）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {GateCard, HookPoint, LoopRing, Panel, ringPt} from '../components/motifs';
import {DUR, clamp01, progress, useBreathe, useEnter, useFadeOut, useImpulse, useProgress} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

const HOOK_ANGLES = [-90, 0, 90, 180] as const;

/** 金句关键词：重读排版 + 词落位各压一拍。强调字色钉 storyboard 契约色常量
 *  theme.mech（本集主题色 = 挂点紫——收束金句强调词即「本集之物」的收束指称；
 *  QA-14：color 为常量、不随词窗相位变化，辉光只改强度不改色相）。 */
const KeyWord: React.FC<{at: number; children: React.ReactNode}> = ({at, children}) => {
  const pop = useImpulse({at, dur: DUR.f6, peak: 0.06});
  const glow = useProgress(at, DUR.f5);
  return (
    <span
      style={{
        fontSize: 62,
        fontWeight: 700,
        color: theme.mech,
        display: 'inline-block',
        transform: `scale(${1 + pop})`,
        textShadow: glow > 0.01 ? `0 0 ${24 * glow}px ${withAlpha(theme.mech, 0.5)}` : 'none',
      }}
    >
      {children}
    </span>
  );
};

// ── 5-A 环体定格收束 + 金句卡 ───────────────────────────────────────────

const RING_5 = {cx: 960, cy: 680, size: 440} as const;

const QuoteShot: React.FC<{atCard: number; atCore: number; atStack: number; atGate: number; atSlots: number; atStill: number}> = ({
  atCard,
  atCore,
  atStack,
  atGate,
  atSlots,
  atStill,
}) => {
  const frame = useCurrentFrame();
  const r = RING_5.size / 2 - 46;
  const card = useEnter('pop', {at: atCard + 4, dur: DUR.f6});
  // 「降格成回调」：闸卡小影滑入挂点位成串（1-C 迁移终态复认——ep3 签名紫）
  const gateIn = useProgress(atGate, DUR.f5, 'decelerate');
  const p2 = ringPt(RING_5.cx, RING_5.cy, r, 0);
  // 「固定挂点」：四紫点槽位依次点亮（依次脉冲——槽位间明确无连线）
  const slots = [0, 1, 2, 3].map((i) => clamp01(progress(frame, atSlots + i * 5, DUR.f3)));
  // 「零硬编码」：环体整环静止一拍（静止即陈述——巡游点定格 + 辉光一次）
  const still = frame >= atStill;
  const stillGlow = useImpulse({at: atStill, dur: DUR.f6});
  const dot = still ? 0.34 : ((frame / (30 * 3.4)) % 1 + 1) % 1;
  return (
    <AbsoluteFill>
      {/* 背景生产元素退为暗层（增长条/装置残影——收束水印） */}
      <div style={{position: 'absolute', inset: 0, opacity: 0.12, pointerEvents: 'none'}}>
        <div style={{position: 'absolute', left: 240, top: 130, display: 'flex', gap: 8}}>
          {Array.from({length: 27}, (_, i) => (
            <div key={`g${i}`} style={{width: i < 4 ? 50 : 20, height: 58, borderRadius: 6, border: `2px solid ${theme.panelBorder}`}} />
          ))}
          <div style={{width: 26, height: 58, borderRadius: 6, border: `2px dashed ${theme.panelBorder}`}} />
        </div>
      </div>
      {/* 金句卡（唯一主体，衬线体） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 240,
          display: 'flex',
          justifyContent: 'center',
          opacity: card.opacity,
          transform: card.transform,
        }}
      >
        <Panel accent={theme.mech} style={{padding: '44px 72px'}}>
          <div style={{fontFamily: theme.serif, fontSize: 52, color: theme.text, lineHeight: 1.3, whiteSpace: 'nowrap'}}>
            <KeyWord at={atCore}>{'核心不变'}</KeyWord>
            {' · '}
            <KeyWord at={atStack}>{'能力正交叠加'}</KeyWord>
          </div>
        </Panel>
      </div>
      {/* 环体（M-001 同形净化态：四紫点各驻一槽——互不连线；静止一拍） */}
      <div style={{position: 'absolute', left: RING_5.cx - RING_5.size / 2, top: RING_5.cy - RING_5.size / 2, opacity: 0.9}}>
        <LoopRing size={RING_5.size} nodes={[]} showExit={false} dotProgress={dot} />
      </div>
      {stillGlow > 0.01 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          <circle cx={RING_5.cx} cy={RING_5.cy} r={r} fill="none" stroke={theme.core} strokeWidth={10} opacity={0.6 * stillGlow} />
        </svg>
      ) : null}
      {/* 四紫点（槽位依次点亮——脉冲波次；槽位间明确无连线） */}
      {HOOK_ANGLES.map((a, i) => (
        <HookPoint
          key={`pt${i}`}
          cx={ringPt(RING_5.cx, RING_5.cy, r, a).x}
          cy={ringPt(RING_5.cx, RING_5.cy, r, a).y}
          lit={1}
          pulse={Math.sin(Math.PI * slots[i])}
        />
      ))}
      {/* 闸卡小影滑入挂点位成串（1-C 迁移终态复认——ep3 签名，缩微不重绘） */}
      <div style={{position: 'absolute', left: p2.x + 70 + (p2.x - 130 - (p2.x + 70)) * gateIn, top: p2.y + 96 - 30 * gateIn, opacity: gateIn}}>
        <div style={{transform: `scale(${0.42 + 0.08 * gateIn})`, transformOrigin: 'left top'}}>
          <GateCard x={0} y={0} w={140} h={130} kind="deny" lit={1} />
        </div>
      </div>
      {/* 挂点下回调串（日志小卡在位——闸卡小影与之成串） */}
      <div style={{position: 'absolute', left: p2.x - 10, top: p2.y + 96, opacity: 0.9}}>
        <div
          style={{
            width: 96,
            height: 44,
            boxSizing: 'border-box',
            borderRadius: 8,
            border: `2px solid ${theme.hook}`,
            background: withAlpha(theme.hook, 0.14),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 17, fontWeight: 600, color: theme.text}}>{'日志'}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 泥球对比帧（单句重音镜） ────────────────────────────────────────

const BallShot: React.FC<{atTangle: number; atSwallow: number; atCursor: number}> = ({atTangle, atSwallow, atCursor}) => {
  const frame = useCurrentFrame();
  // 左帧：缠线加速缠结（「不守它」）→ 收拢吞没环体轮廓（「缠成」）
  const tangle = useProgress(atTangle, DUR.f5, 'accelerate');
  const swallow = useProgress(atSwallow, DUR.f5, 'decelerate');
  // 「没人敢动」：光标小影悬在泥球上欲动又止（逼近—悬停—缩回）
  const cursor = useProgress(atCursor, DUR.f5);
  const hesitate = Math.sin(Math.PI * clamp01(progress(frame, atCursor + DUR.f4, DUR.f5))) * 12;
  // 右帧：干净环体（5-A 收束态缩微——恒静恒净，对照锚）
  const RR = {cx: 1440, cy: 560, size: 380} as const;
  const rr = RR.size / 2 - 46;
  // 泥球缠线（确定性乱线簇——i*137° 黄金角布点，无随机数；svg 本地坐标：
  // 缠线 svg 置于 left 0 / top 200，左帧环心本地 (430, 360) = 绝对 (430, 560)）
  const TC = {x: 430, y: 360} as const;
  const TANGLES = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const a0 = (i * 137) % 360;
    const a1 = a0 + 130 + (i % 3) * 55;
    const rad0 = (a0 * Math.PI) / 180;
    const rad1 = (a1 * Math.PI) / 180;
    const rr2 = 90 + (i % 4) * 26;
    return {
      x1: TC.x + rr2 * Math.cos(rad0),
      y1: TC.y + rr2 * Math.sin(rad0),
      x2: TC.x + (rr2 + 60) * Math.cos(rad1),
      y2: TC.y + (rr2 + 60) * Math.sin(rad1),
      qx: TC.x + 40 * Math.cos(rad0 + 1.2),
      qy: TC.y + 80 * Math.sin(rad0),
      delay: i % 4,
    };
  });
  return (
    <AbsoluteFill>
      {/* ── 左帧：灰暗缠结泥球 ── */}
      <div style={{position: 'absolute', left: 120, top: 190, fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>
        {'复杂度压进核心'}
      </div>
      {/* 环体轮廓（被吞没——轮廓随 swallow 淡出） */}
      <div style={{position: 'absolute', left: 430 - 190, top: 560 - 190, opacity: 0.5 * (1 - swallow)}}>
        <LoopRing size={380} nodes={[]} showExit={false} />
      </div>
      {/* 杂色缠线（灰暗缠结——缠线收拢吞没轮廓） */}
      <svg width={900} height={740} style={{position: 'absolute', left: 0, top: 200, overflow: 'visible'}}>
        {TANGLES.map((t, i) => {
          const p = clamp01(progress(frame, atTangle - 24 + t.delay * 8, DUR.f6) * (0.4 + 0.6 * tangle));
          const pull = 1 - 0.45 * swallow * (((i % 3) + 1) / 3);
          return (
            <path
              key={`t${i}`}
              d={`M ${TC.x + (t.x1 - TC.x) * pull} ${TC.y + (t.y1 - TC.y) * pull} Q ${t.qx} ${t.qy}, ${TC.x + (t.x2 - TC.x) * pull} ${TC.y + (t.y2 - TC.y) * pull}`}
              fill="none"
              stroke={i % 4 === 0 ? withAlpha(theme.danger, 0.4) : withAlpha(theme.dim, 0.6)}
              strokeWidth={3.5}
              opacity={p * (0.6 + 0.4 * swallow)}
            />
          );
        })}
      </svg>
      {/* 光标小影（欲动又止——逼近、悬停、缩回半步） */}
      {cursor > 0.01 ? (
        <div style={{position: 'absolute', left: 560 + 60 * cursor - hesitate, top: 480 + 40 * cursor, opacity: clamp01(cursor) * 0.9}}>
          <svg width={40} height={52} viewBox="0 0 40 52" style={{overflow: 'visible'}}>
            <path d="M6 4 L6 42 L16 32 L24 50 L32 46 L24 30 L36 28 Z" fill={theme.bg} stroke={theme.dim} strokeWidth={3} strokeLinejoin="round" />
          </svg>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 300, top: 860, fontFamily: theme.sans, fontSize: 22, fontWeight: 600, color: theme.dim, opacity: clamp01(cursor)}}>
        {'没人敢动'}
      </div>
      {/* 中缝演化箭头（左→右——不守 → 守的读向） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
        <line x1={940} y1={560} x2={1090} y2={560} stroke={withAlpha(theme.dim, 0.6)} strokeWidth={4} strokeDasharray="10 9" />
        <path d="M 1086 548 L 1108 560 L 1086 572 Z" fill={withAlpha(theme.dim, 0.6)} />
      </svg>
      {/* ── 右帧：干净环体（恒静恒净） ── */}
      <div style={{position: 'absolute', left: 1380, top: 190, fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>
        {'挂出去 · 核心干净'}
      </div>
      <div style={{position: 'absolute', left: RR.cx - RR.size / 2, top: RR.cy - RR.size / 2, opacity: 0.95}}>
        <LoopRing size={RR.size} nodes={[]} showExit={false} dotProgress={(frame / 128) % 1} />
      </div>
      {HOOK_ANGLES.map((a, i) => (
        <HookPoint key={`rpt${i}`} cx={ringPt(RR.cx, RR.cy, rr, a).x} cy={ringPt(RR.cx, RR.cy, rr, a).y} lit={1} />
      ))}
    </AbsoluteFill>
  );
};

// ── 5-C 下期问题卡：计划漂移 ────────────────────────────────────────────

const PLAN_ROWS = ['梳理结构', '改接入层', '补测试', '过评审', '收尾归档'] as const;

const NextShot: React.FC<{atCard: number; atAlign: number; atDrift: number; atQ: number; atNext: number; atDim: number}> = ({
  atCard,
  atAlign,
  atDrift,
  atQ,
  atNext,
  atDim,
}) => {
  const frame = useCurrentFrame();
  // 清单卡浮起（「管不住」）；条目初始对位齐整一拍（「开头定好的计划」）
  const card = useEnter('rise', {at: atCard, dur: DUR.f5, dist: 26, springPreset: 'settle'});
  const align = useProgress(atAlign, DUR.f4);
  // 条目 stagger 漂移（「做着做着就漂了」——游出对位线 / 掉队沉底两形态；
  // 只显形态不显机制，下期正主不剧透）
  const drift = [0, 1, 2, 3, 4].map((i) => clamp01(progress(frame, atDrift + i * 6, DUR.f5)));
  const ROW_DX = [0, 150, 0, 0, -60];
  const ROW_DY = [0, 0, 0, 130, 0];
  // 「说不清」：漂移条目上位置/进度双问号浮起
  const qs = clamp01(progress(frame, atQ, DUR.f4));
  // 「下期」字卡亮起定格（半拍收暗）
  const next = useProgress(atNext, DUR.f4);
  const nextBreathe = useBreathe({period: 110, amp: 0.25, base: 0.75});
  const dimAll = useProgress(atDim, DUR.f4);
  return (
    <AbsoluteFill>
      {/* 计划清单卡（视觉层——条目 + 对位线） */}
      <div style={{...card, position: 'absolute', left: 330, top: 240}}>
        <Panel style={{width: 760, boxSizing: 'border-box', padding: '20px 30px', position: 'relative'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 16}}>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'plan'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'开头定好的计划'}</span>
          </div>
          {/* 对位线（条目的对齐基准——漂移的参照） */}
          <div style={{position: 'absolute', left: 30, top: 88, bottom: 20, width: 2, background: withAlpha(theme.dim, 0.3 * align + 0.08)}} />
          {PLAN_ROWS.map((row, i) => {
            const d = drift[i];
            return (
              <div
                key={row}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  height: 62,
                  opacity: 0.55 + 0.45 * align,
                  transform: `translate(${ROW_DX[i] * d}px, ${ROW_DY[i] * d}px) rotate(${ROW_DX[i] * d * 0.04}deg)`,
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    border: `2.5px solid ${theme.dim}`,
                    background: 'transparent',
                    flexShrink: 0,
                  }}
                />
                <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.text, whiteSpace: 'nowrap'}}>{row}</span>
                {/* 漂移条目上的位置/进度双问号（「说不清」） */}
                {(ROW_DX[i] !== 0 || ROW_DY[i] !== 0) && qs > 0.01 ? (
                  <span style={{display: 'flex', gap: 8, opacity: qs}}>
                    {['位置', '进度'].map((k) => (
                      <span
                        key={k}
                        style={{
                          fontFamily: theme.sans,
                          fontSize: 16,
                          color: theme.mech,
                          border: `2px solid ${withAlpha(theme.mech, 0.7)}`,
                          borderRadius: 6,
                          padding: '1px 8px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {k + ' ?'}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            );
          })}
        </Panel>
      </div>
      {/* 「下期」字卡（唯一文字新元素——亮起定格） */}
      <div style={{position: 'absolute', left: 1250, top: 480, opacity: next * nextBreathe}}>
        <Panel accent={theme.core} style={{padding: '20px 40px'}}>
          <span style={{fontFamily: theme.serif, fontSize: 48, fontWeight: 700, color: theme.text, letterSpacing: 12, paddingLeft: 12}}>{'下期'}</span>
        </Panel>
      </div>
      {/* 半拍收暗（盖场景不盖字幕） */}
      <AbsoluteFill style={{background: '#000', opacity: 0.7 * dimAll, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

// ── 5-D 片尾署源卡（尾部署源位，RSI I-080 豁免） ────────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-07 口播同拍淡入；两行先后落定（署源专名约 0.6 处被念到，次行隔拍跟落）
  const card = useEnter('rise', {at: atCard + 2, dur: DUR.f6, dist: 24, restBottom: 560});
  const l1At = atCard + Math.round(durCard * 0.6);
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

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P5CleanCore: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p5-01', 'p5-02');
  const bB = w('p5-03');
  const bC = w('p5-04', 'p5-06');
  const bD = w('p5-07', 'p5-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <QuoteShot
          atCard={wa('p5-01', 0.08) - bA.from}
          atCore={wa('p5-01', 0.3) - bA.from}
          atStack={wa('p5-01', 0.78) - bA.from}
          atGate={wa('p5-02', 0.22) - bA.from}
          atSlots={wa('p5-02', 0.6) - bA.from}
          atStill={wa('p5-02', 0.88) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <BallShot atTangle={wa('p5-03', 0.08) - bB.from} atSwallow={wa('p5-03', 0.55) - bB.from} atCursor={wa('p5-03', 0.78) - bB.from} />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <NextShot
          atCard={wa('p5-04', 0.4) - bC.from}
          atAlign={wa('p5-04', 0.72) - bC.from}
          atDrift={wa('p5-05', 0.15) - bC.from}
          atQ={wa('p5-05', 0.75) - bC.from}
          atNext={wa('p5-06', 0.12) - bC.from}
          atDim={at('p5-06') + dur('p5-06') - Math.min(10, dur('p5-06') / 4) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="5-D">
        <CreditCard atCard={at('p5-07') - bD.from} durCard={dur('p5-07')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bD.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5CleanCore;
