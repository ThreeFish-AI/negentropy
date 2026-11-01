/** P5 收束与下期（p5-01..p5-08，4 镜）——分镜 5-A / 5-B / 5-C / 5-D。
 *
 *  叙事链：5-A 收束大全景（EWS）：索引页定格居中（主装置终态）、库体与开场白
 *  条分列两侧（开场白内一页索引 ↔ 库内正文的分层关系复盘一拍——全片坐标复盘）；
 *  金句卡（衬线体）两行先后压屏（「常驻开场白」「用到才取」两短语重读排版 /
 *  「有门」「有底」重读——caption-dup-ok 承 ep1/ep2/ep6 5-A 豁免先例）→ 5-B 幸存
 *  回扣（单句镜）：压缩清场波扫过（4-D 同款同向）、波下方库体纹丝不动（稳态微
 *  光）、「从磁盘重新注入」注入流自磁盘文件图标升起注入一枚新会话窗（单向向上、
 *  持续态收定）、出处小签「官方文档 · 2026-10」（【二】级日期口径视觉承接）→
 *  5-C 下期卡（视觉层）：一枚开场白文档卡剪影（首日起锁定——锁扣 + 定照纹），
 *  上方状态问号悬空、「此刻」「刚才」两枚空槽扫过皆空（一概不知）、问号加重悬
 *  停、「下期」签点亮（只点问题不预告机制——承系列收尾纪律）→ 5-D 片尾署源卡
 *  （尾部署源位——署源句 p5-07、漂移警示句 p5-08）：主行 Learn Claude Code /
 *  次行仓库地址 / 角注 MIT（卡面 ≤3 行），p5-08 期间卡片静持（漂移警示由口播
 *  承载、卡面零复述），全片在此卡收束。
 *
 *  空间契约：金句卡为唯一主体时段、衬线体、两行先后、三层复盘不抢焦；注入流
 *    源头必为磁盘文件图标（非对话内）、清场扫与 4-D 同款同向、出处小签带日期
 *    口径；下期卡为剪影级（内部不展开——下期域）、问号为唯一悬念元素、无集数
 *    序号词；署源卡为最后画面、卡面 ≤3 行信息。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥176；Dream · MEMORY.md 只进
 *    角标；尾幕渐黑（红线四）窗取末 beat 总时长（p5-07..p5-08 之和）——终点即
 *    本幕终点；收尾版式不挂 SceneTag（承 ep1–ep8 先例）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ChatWindow, ClearWave, IndexPage, MemoryVault, Panel} from '../components/motifs';
import {DUR, clamp01, progress, useBreathe, useEnter, useFadeOut, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 5-A 收束大全景：索引页定格 + 三层复盘 + 金句卡两行 ────────────────────

const FiveA: React.FC<{atCard: number; atK1a: number; atK1b: number; atL2: number; atK2a: number; atK2b: number}> = ({atCard, atK1a, atK1b, atL2, atK2a, atK2b}) => {
  // 三层微缩同构静持（背景复盘——索引页居中 · 库体左 · 开场白条右）
  const settle = useProgress(0, DUR.f6);
  // 金句卡第一行压屏 + 两短语重读排版；第二行随后压屏
  const l1 = useProgress(atCard, DUR.f6);
  const k1a = useImpulse({at: atK1a, dur: DUR.f6, peak: 0.05});
  const k1b = useImpulse({at: atK1b, dur: DUR.f6, peak: 0.05});
  const k1aGlow = useProgress(atK1a, DUR.f5);
  const k1bGlow = useProgress(atK1b, DUR.f5);
  const l2 = useProgress(atL2, DUR.f6);
  const k2a = useImpulse({at: atK2a, dur: DUR.f6, peak: 0.05});
  const k2b = useImpulse({at: atK2b, dur: DUR.f6, peak: 0.05});
  const k2aGlow = useProgress(atK2a, DUR.f5);
  const k2bGlow = useProgress(atK2b, DUR.f5);
  return (
    <AbsoluteFill>
      {/* 三层复盘（微缩同构——索引页居中（终态静持）· 库体左 · 开场白条右） */}
      <div style={{position: 'absolute', inset: 0, opacity: settle * 0.9}}>
        <IndexPage x={680} y={420} w={560} h={420} scale={0.92} rowsLit={6} writeP={1} />
        <MemoryVault x={150} y={430} w={400} h={240} scale={0.9} doorP={0.5} ghostP={1} slotsLit={12} label={'.memory/'} />
        {/* 开场白条（右——内嵌一页索引缩微：分层关系复盘） */}
        <div style={{position: 'absolute', left: 1330, top: 430, width: 440, height: 300, boxSizing: 'border-box', borderRadius: 12, border: `3px solid ${withAlpha(theme.index, 0.6)}`, background: withAlpha(theme.panel, 0.9), padding: '10px 14px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 12, color: theme.index}}>{'开场白 · 固定开头'}</div>
          <IndexPage x={0} y={0} w={400} h={230} scale={0.88} rowsLit={6} dim={0.15} />
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 860, textAlign: 'center', fontFamily: theme.mono, fontSize: 15, color: theme.dim, opacity: 0.75}}>
          {'开场白内一页索引 ↔ 库内正文'}
        </div>
      </div>
      {/* 金句卡（衬线体·两行先后压屏——caption-dup-ok: 金句卡刻意复述（收束定格仪式，
          承 ep1/ep2/ep6 5-A 豁免先例）） */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, zIndex: 3}}>
        {l1 > 0.02 ? (
          <div style={{opacity: l1, transform: `translateY(${(1 - l1) * 22}px)`}}>
            <Panel accent={theme.index} style={{padding: '20px 46px'}}>
              <div style={{fontFamily: theme.serif, fontSize: 46, color: theme.text, whiteSpace: 'nowrap'}}>
                <span>{'一页索引，'}</span>
                <span style={{fontWeight: 700, color: theme.index, display: 'inline-block', transform: `scale(${1 + k1a})`, textShadow: k1aGlow > 0.01 ? `0 0 ${22 * k1aGlow}px ${withAlpha(theme.index, 0.5)}` : 'none'}}>{'常驻开场白'}</span>
                <span>{'；'}</span>
              </div>
              <div style={{fontFamily: theme.serif, fontSize: 46, color: theme.text, whiteSpace: 'nowrap', marginTop: 6}}>
                <span>{'一库正文，'}</span>
                <span style={{fontWeight: 700, color: theme.mech, display: 'inline-block', transform: `scale(${1 + k1b})`, textShadow: k1bGlow > 0.01 ? `0 0 ${22 * k1bGlow}px ${withAlpha(theme.mech, 0.5)}` : 'none'}}>{'用到才取'}</span>
              </div>
            </Panel>
          </div>
        ) : null}
        {l2 > 0.02 ? (
          <div style={{opacity: l2, transform: `translateY(${(1 - l2) * 22}px)`}}>
            <Panel accent={theme.mech} style={{padding: '16px 40px'}}>
              <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.text, whiteSpace: 'nowrap'}}>
                <span>{'写入'}</span>
                <span style={{fontWeight: 700, color: theme.mech, display: 'inline-block', transform: `scale(${1 + k2a})`, textShadow: k2aGlow > 0.01 ? `0 0 ${20 * k2aGlow}px ${withAlpha(theme.mech, 0.5)}` : 'none'}}>{'有门'}</span>
                <span>{'，整理'}</span>
                <span style={{fontWeight: 700, color: theme.ok, display: 'inline-block', transform: `scale(${1 + k2b})`, textShadow: k2bGlow > 0.01 ? `0 0 ${20 * k2bGlow}px ${withAlpha(theme.ok, 0.5)}` : 'none'}}>{'有底'}</span>
              </div>
            </Panel>
          </div>
        ) : null}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'MEMORY.md · 索引常驻 · 正文按需'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 幸存回扣：清场波 + 库体稳态 + 磁盘注入流 ──────────────────────────

const FiveB: React.FC<{atWave: number; atInject: number; waveSpan: number}> = ({atWave, atInject, waveSpan}) => {
  const frame = useCurrentFrame();
  // 清场波扫过（4-D 同款同向——自上而下）
  const wave = clamp01(progress(frame, atWave, Math.max(30, waveSpan)));
  // 库体稳态微光（波下方纹丝不动——零位移）
  const glow = useBreathe({period: 60, amp: 0.35, base: 0.55});
  // 注入流自磁盘文件图标升起、注入新会话窗（单向向上——持续态收定）
  const inject = useProgress(atInject, 40, 'decelerate');
  const injectPulse = useImpulse({at: atInject + 34, dur: DUR.f6, peak: 1});
  // 流光相位（帧驱动行进——注入中的活水感）
  const streamPhase = (frame / 18) % 1;
  return (
    <AbsoluteFill>
      {/* 库体（波下稳态——左侧驻位） */}
      <div style={{position: 'absolute', left: 170, top: 460}}>
        <MemoryVault x={0} y={0} w={430} h={250} scale={0.92} doorP={0.6} ghostP={1} slotsLit={12} glow={glow} label={'.memory/'} />
        <div style={{position: 'absolute', left: 20, top: 268, fontFamily: theme.sans, fontSize: 16, color: theme.dim, whiteSpace: 'nowrap'}}>{'库体 · 稳态微光不动'}</div>
      </div>
      {/* 磁盘文件图标（注入流源头——必为磁盘文件，非对话内） */}
      <div style={{position: 'absolute', left: 980, top: 770}}>
        <svg width={86} height={104} viewBox="0 0 86 104" style={{overflow: 'visible'}}>
          <path d="M 10 6 L 56 6 L 76 26 L 76 98 L 10 98 Z" fill={withAlpha(theme.panel, 0.97)} stroke={theme.mech} strokeWidth={3.5} strokeLinejoin="round" />
          <path d="M 56 6 L 56 26 L 76 26" fill="none" stroke={theme.mech} strokeWidth={3.5} strokeLinejoin="round" />
          <line x1={22} y1={46} x2={62} y2={46} stroke={withAlpha(theme.mech, 0.5)} strokeWidth={3} strokeLinecap="round" />
          <line x1={22} y1={62} x2={62} y2={62} stroke={withAlpha(theme.mech, 0.38)} strokeWidth={3} strokeLinecap="round" />
        </svg>
        <div style={{textAlign: 'center', fontFamily: theme.mono, fontSize: 12, color: theme.mech, marginTop: 6}}>{'.memory/'}</div>
      </div>
      {/* 注入流（自磁盘升起——mech 流光带 + 行进纹，单向向上持续态收定） */}
      {inject > 0.02 ? (
        <div style={{position: 'absolute', left: 1015, top: 330, width: 56, height: 430, opacity: clamp01(inject)}}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 28,
              background: `linear-gradient(${withAlpha(theme.mech, 0)}, ${withAlpha(theme.mech, 0.34)}, ${withAlpha(theme.mech, 0.55)})`,
              clipPath: `inset(${(1 - inject) * 100}% 0 0 0)`,
            }}
          />
          {/* 行进纹（帧驱动上移——注入中的活水） */}
          {[0, 1, 2, 3].map((k) => {
            const ph = ((streamPhase + k / 4) % 1 + 1) % 1;
            return <div key={`st${k}`} style={{position: 'absolute', left: 10, right: 10, top: (1 - ph) * 400, height: 6, borderRadius: 3, background: withAlpha(theme.text, 0.35)}} />;
          })}
        </div>
      ) : null}
      {/* 新会话窗（注入对象——窗内落一枚记忆签） */}
      <div style={{position: 'absolute', left: 900, top: 200, opacity: clamp01(inject)}}>
        <ChatWindow x={0} y={0} w={280} h={150} scale={0.85} rows={[]} rowsLit={0} emptyAwait={1 - injectPulse} glowP={injectPulse} header={'新会话 · 重新注入'} />
        {injectPulse > 0.05 ? (
          <div style={{position: 'absolute', left: 30, top: 66, padding: '3px 12px', borderRadius: 7, border: `2.5px solid ${theme.mech}`, background: theme.panel, fontFamily: theme.sans, fontSize: 13, fontWeight: 700, color: theme.mech, whiteSpace: 'nowrap', opacity: injectPulse}}>
            {'偏好 · 已注入'}
          </div>
        ) : null}
      </div>
      {/* 出处小签（【二】级日期口径视觉承接——官方文档 · 2026-10） */}
      <div style={{position: 'absolute', right: 100, top: 260, padding: '4px 14px', borderRadius: 8, border: `2px solid ${withAlpha(theme.dim, 0.8)}`, background: theme.panel, fontFamily: theme.mono, fontSize: 14, color: theme.dim, whiteSpace: 'nowrap', opacity: clamp01(inject) * 0.95}}>
        {'官方文档 · 2026-10'}
      </div>
      {/* 清场波（4-D 同款同向） */}
      <ClearWave sweepP={wave} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'压缩清场也轮不到它 · 从磁盘重新注入'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 下期卡（视觉层——开场白文档卡剪影 + 状态问号 + 下期签） ────────────

const FiveC: React.FC<{atLock: number; atNow: number; atJust: number; atScan: number; atNext: number}> = ({atLock, atNow, atJust, atScan, atNext}) => {
  const frame = useCurrentFrame();
  // 锁扣落定 + 定照纹亮（首日起锁定）
  const lock = useProgress(atLock, DUR.f4);
  const lockFlash = useImpulse({at: atLock + DUR.f3, dur: DUR.f5, peak: 1});
  const freeze = useProgress(atLock + 6, DUR.f5);
  // 「此刻」「刚才」两枚空槽浮现 → 扫过皆空 → 问号加重悬停
  const nowSlot = useProgress(atNow, DUR.f4);
  const justSlot = useProgress(atJust, DUR.f4);
  const scan = clamp01(progress(frame, atScan, 26));
  const qHeavy = useProgress(atScan + 18, DUR.f5);
  const qShake = Math.sin(frame / 1.6) * 2 * qHeavy;
  // 「下期」签点亮（只点问题不预告机制）
  const next = useProgress(atNext, DUR.f5);
  return (
    <AbsoluteFill>
      {/* 开场白文档卡剪影（内部不展开——下期域） */}
      <div style={{position: 'absolute', left: 730, top: 300, width: 440, height: 500}}>
        <div
          style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            borderRadius: 14,
            border: `3.5px dashed ${withAlpha(theme.dim, 0.75)}`,
            background: withAlpha(theme.panel, 0.55),
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 折角（文档卡形） */}
          <svg width={54} height={54} viewBox="0 0 54 54" style={{position: 'absolute', right: 0, top: 0}}>
            <path d="M 4 0 L 54 50 L 54 0 Z" fill={withAlpha(theme.bg, 0.8)} />
          </svg>
          {/* 定照纹（首日定格——斜纹纱） */}
          {freeze > 0.02 ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `repeating-linear-gradient(135deg, ${withAlpha(theme.dim, 0.14 * freeze)} 0 10px, transparent 10px 26px)`,
                pointerEvents: 'none',
              }}
            />
          ) : null}
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 22, textAlign: 'center', fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>
            {'开场白 · 首日定稿（剪影）'}
          </div>
        </div>
        {/* 锁扣（卡顶落锁——写死） */}
        <div style={{position: 'absolute', left: 196, top: -34, opacity: lock}}>
          <svg width={50} height={50} viewBox="0 0 50 50" style={{overflow: 'visible', filter: `drop-shadow(0 0 ${10 * lockFlash}px ${withAlpha(theme.dim, 0.6)})`, transform: `translateY(${(1 - lock) * -26}px)`}}>
            <rect x={8} y={20} width={34} height={24} rx={6} fill={withAlpha(theme.dim, 0.25)} stroke={theme.dim} strokeWidth={3.5} />
            <path d={`M 15 20 V 14 a 10 10 0 0 1 20 0 V 20`} fill="none" stroke={theme.dim} strokeWidth={3.5} />
          </svg>
        </div>
      </div>
      {/* 状态问号（悬空加重——两空槽扫过皆空后） */}
      <div style={{position: 'absolute', left: 1180, top: 200}}>
        <span
          style={{
            fontFamily: theme.serif,
            fontSize: 96,
            fontWeight: 700,
            color: theme.text,
            opacity: 0.5 + 0.5 * qHeavy,
            display: 'inline-block',
            transform: `translateX(${qShake}px) scale(${1 + 0.12 * qHeavy})`,
            textShadow: qHeavy > 0.05 ? `0 0 ${30 * qHeavy}px ${withAlpha(theme.text, 0.5)}` : 'none',
          }}
        >
          {'？'}
        </span>
      </div>
      {/* 「此刻」「刚才」两枚空槽（扫过皆空——一概不知） */}
      <div style={{position: 'absolute', left: 700, top: 170, display: 'flex', gap: 40}}>
        {[
          {t: '此刻', p: nowSlot},
          {t: '刚才', p: justSlot},
        ].map((s, i) => {
          // 扫带（自左向右扫过两槽——皆空：槽内无内容显形）
          const swept = clamp01(scan * 2.4 - i);
          return (
            <div key={s.t} style={{position: 'relative', opacity: clamp01(s.p)}}>
              <div
                style={{
                  padding: '8px 26px',
                  borderRadius: 9,
                  border: `2.5px dashed ${withAlpha(theme.dim, 0.7)}`,
                  fontFamily: theme.sans,
                  fontSize: 20,
                  color: theme.dim,
                  whiteSpace: 'nowrap',
                }}
              >
                {`${s.t}：空`}
              </div>
              {swept > 0.02 && swept < 0.98 ? (
                <div style={{position: 'absolute', left: swept * 130, top: -8, bottom: -8, width: 8, borderRadius: 4, background: withAlpha(theme.danger, 0.4), pointerEvents: 'none'}} />
              ) : null}
            </div>
          );
        })}
      </div>
      {/* 下期签（旁缀——点亮；只点问题不预告机制） */}
      {next > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 1240,
            top: 480,
            padding: '12px 30px',
            borderRadius: 12,
            border: `3px solid ${theme.core}`,
            background: theme.panel,
            fontFamily: theme.serif,
            fontSize: 40,
            fontWeight: 700,
            color: theme.text,
            letterSpacing: 10,
            paddingLeft: 40,
            whiteSpace: 'nowrap',
            opacity: next,
            transform: `translateY(${(1 - next) * 20}px)`,
            boxShadow: `0 0 ${24 * next}px ${withAlpha(theme.core, 0.35)}`,
          }}
        >
          {'下期'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'写死的开场白 · 此刻 / 刚才一概不知'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-D 片尾署源卡（尾部署源位，RSI I-080 豁免） ──────────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-07 口播同拍淡入；两行先后落定（署源专名口播例外随行）
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

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P5FinaleAndNext: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p5-01', 'p5-02');
  const bB = w('p5-03');
  const bC = w('p5-04', 'p5-06');
  const bD = w('p5-07', 'p5-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <FiveA
          atCard={wa('p5-01', 0.24) - bA.from}
          atK1a={wa('p5-01', 0.42) - bA.from}
          atK1b={wa('p5-01', 0.66) - bA.from}
          atL2={wa('p5-02', 0.28) - bA.from}
          atK2a={wa('p5-02', 0.46) - bA.from}
          atK2b={wa('p5-02', 0.7) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <FiveB atWave={wa('p5-03', 0.2) - bB.from} atInject={wa('p5-03', 0.58) - bB.from} waveSpan={bB.durationInFrames - (wa('p5-03', 0.58) - bB.from)} />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <FiveC
          atLock={wa('p5-04', 0.5) - bC.from}
          atNow={wa('p5-05', 0.18) - bC.from}
          atJust={wa('p5-05', 0.42) - bC.from}
          atScan={wa('p5-05', 0.66) - bC.from}
          atNext={wa('p5-06', 0.4) - bC.from}
        />
      </Sequence>
      <Sequence {...bD} name="5-D">
        <CreditCard atCard={at('p5-07') - bD.from} durCard={span('p5-07')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bD.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5FinaleAndNext;
