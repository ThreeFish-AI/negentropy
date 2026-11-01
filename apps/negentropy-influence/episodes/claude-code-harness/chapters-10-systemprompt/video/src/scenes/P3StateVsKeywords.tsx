/** P3 看状态，不看话术（p3-01..p3-08，3 镜）——分镜 3-A / 3-B / 3-C。
 *
 *  叙事链：3-A 左红右绿消融同屏（每幕首镜全景坐标锚；全片张力峰值）：双轨
 *  框架立起——左轨「关键词判据」（警示红）：同款消息气泡 + 新规则签（消息→
 *  关键词→拼段旁路箭头，判据位空置）；右轨「状态判据」（确认绿）：同款气泡 +
 *  清单卡缩微 → p3-02 左轨规则签贴上、旁路箭头接通 → p3-03 气泡内「记忆」
 *  二字高亮、半透空记忆段卡被旁路箭头拉入提示条（误拼过程可见）→ p3-04 误注入
 *  计数 0→1、字符计数 113→147 跳变 punch（1–2s 重音镜；@pushIn 压向双计数位）；
 *  右轨同帧恒稳 113 对照 → 3-B 提示条双帧并列特写：左帧轻微抖动（被撬动）↔
 *  右帧恒稳、「每轮都要看」回环虚线绕住左帧提示条 → 3-C 判据卡定格：两行关键
 *  词签「看状态 ✓ / 看话术 ✗」先后定格、远处暗层七段卡阵列淡入半拍即收
 *  （P4 主角预显〔M-006〕）。
 *
 *  空间契约：红左绿右恒定、双轨除判据路外全同构（同一句输入/同一提示条位）、
 *    双口径（次数/字符）分列且与口播一致（0→1 · 113→147 ↔ 0 · 113 恒稳）、
 *    抖动幅度轻（撬动≠崩坏）、回环虚线为唯一新增元素且不绕向右帧、判据卡为
 *    唯一前景主体、七段阵列仅暗层轮廓（不显段名细节）。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥176；--experiment 4 ·
 *    keyword matching 只进角标；右轨出现任何变化禁（逆旁白）；只给结论不给
 *    误拼过程禁；左帧崩裂/报错形态禁（后果只到「被撬动」）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {MessageBubble, PromptBar, SectionCardStack, StateManifestCard} from '../components/motifs';
import {DUR, clamp01, progress, useCount, useImpulse, useProgress, usePushIn} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 3-A 消融双轨（左红右绿——除判据路外全同构） ────────────────────────────

const TRACKS = {lx: 120, rx: 980, y: 160, w: 820, h: 610} as const;

/** 双口径计数位（误注入次数 / 字符数——分列、与口播一致） */
const DualCounter: React.FC<{x: number; y: number; inj: number; chars: number; flash?: number; steady?: boolean}> = ({x, y, inj, chars, flash = 0, steady = false}) => (
  <div style={{position: 'absolute', left: x, top: y, display: 'flex', gap: 40}}>
    <div>
      <div style={{fontFamily: theme.sans, fontSize: 14, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>{'误注入 · 次'}</div>
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: 40,
          fontWeight: 700,
          color: steady ? theme.ok : theme.danger,
          fontVariantNumeric: 'tabular-nums',
          marginTop: 2,
          whiteSpace: 'nowrap',
          textShadow: !steady && flash > 0.05 ? `0 0 ${18 * flash}px ${withAlpha(theme.danger, 0.6)}` : 'none',
        }}
      >
        {Math.round(inj)}
      </div>
    </div>
    <div>
      <div style={{fontFamily: theme.sans, fontSize: 14, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap'}}>{'提示 · 字符'}</div>
      <div
        style={{
          fontFamily: theme.mono,
          fontSize: 40,
          fontWeight: 700,
          color: steady ? theme.ok : theme.text,
          fontVariantNumeric: 'tabular-nums',
          marginTop: 2,
          whiteSpace: 'nowrap',
          textShadow: !steady && flash > 0.05 ? `0 0 ${18 * flash}px ${withAlpha(theme.danger, 0.5)}` : 'none',
        }}
      >
        {Math.round(chars)}
      </div>
    </div>
  </div>
);

const ThreeA: React.FC<{atFrame: number; atRule: number; atArrow: number; atHl: number; atPull: number; atInj: number; atChars: number; atPush: number}> = ({
  atFrame,
  atRule,
  atArrow,
  atHl,
  atPull,
  atInj,
  atChars,
  atPush,
}) => {
  const frame = useCurrentFrame();
  // 双轨框架立起（stagger——左先右后半拍）
  const frameL = useProgress(atFrame, DUR.f5);
  const frameR = useProgress(atFrame + 6, DUR.f5);
  // 左轨：新规则签贴上 + 旁路箭头接通（消息 → 关键词 → 拼段；判据位空置）
  const rule = useProgress(atRule, DUR.f4);
  const arrow = clamp01(progress(frame, atArrow, 20));
  // 「话音刚落」气泡内「记忆」二字高亮（误拼触发位）
  const hl = useProgress(atHl, DUR.f4);
  // 半透空记忆段卡被旁路箭头拉入提示条（误拼过程可见——飞行 + 就位红染）
  const pull = clamp01(progress(frame, atPull, 24));
  const mis = clamp01(progress(frame, atPull + 18, DUR.f4));
  // 双计数位：误注入 0→1、字符 113→147 跳变 punch（重音镜；数据禁过冲弹簧）
  const inj = useCount({to: 1, at: atInj, dur: 12});
  const chars = useCount({from: 113, to: 147, at: atChars, dur: 22});
  const punch = useImpulse({at: atChars + 22, dur: DUR.f6, peak: 1});
  // @pushIn（动机：p3-04 数字揭示压向双计数位——P3 紧张段唯一一次推近）
  const push = usePushIn(atPush, {scale: 0.05, dur: DUR.f6});
  // 拉入飞行的起终点（轨内相对坐标：判据位空框 → 提示条记忆段位）
  const flyFrom = {x: 380, y: 196};
  const flyTo = {x: 592, y: 382};
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, transform: push, transformOrigin: '38% 76%'}}>
        {/* ── 左轨 · 关键词判据（警示红） ── */}
        <div
          style={{
            position: 'absolute',
            left: TRACKS.lx,
            top: TRACKS.y,
            width: TRACKS.w,
            height: TRACKS.h,
            boxSizing: 'border-box',
            borderRadius: 16,
            border: `3.5px solid ${withAlpha(theme.danger, 0.5)}`,
            background: withAlpha(theme.panel, 0.9),
            opacity: frameL,
            transform: `translateY(${(1 - frameL) * 22}px)`,
            padding: '14px 20px',
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.danger}}>{'关键词判据'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'消息 → 关键词'}</span>
          </div>
          {/* 同款消息气泡（同一句输入——左轨被误拼的触发源） */}
          <div style={{marginTop: 12}}>
            {/* caption-dup-ok: 引语为走查输入数据本体（与 2-B 同款输入在场，消融两轨同构对照的前提件） */}
            <MessageBubble x={0} y={0} w={560} lit={frameL} hlP={hl} scale={0.72} />
          </div>
          {/* 新规则签 + 判据位空置（清单位被绕开——空框打叉） */}
          <div style={{position: 'relative', height: 120, marginTop: 16}}>
            {rule > 0.02 ? (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  padding: '6px 18px',
                  borderRadius: 9,
                  border: `3px solid ${theme.danger}`,
                  background: withAlpha(theme.danger, 0.08),
                  fontFamily: theme.sans,
                  fontSize: 18,
                  fontWeight: 700,
                  color: theme.text,
                  whiteSpace: 'nowrap',
                  opacity: rule,
                  transform: `translateY(${(1 - rule) * -12}px)`,
                }}
              >
                {'新规则 · 猜关键词'}
              </div>
            ) : null}
            <div
              style={{
                position: 'absolute',
                left: 330,
                top: -4,
                width: 300,
                height: 74,
                borderRadius: 9,
                border: `2.5px dashed ${withAlpha(theme.dim, 0.55)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontFamily: theme.mono,
                fontSize: 13,
                color: theme.dim,
                whiteSpace: 'nowrap',
                opacity: frameL * 0.85,
              }}
            >
              {'清单位 · 被绕开'}
              <span style={{color: theme.danger, opacity: rule}}>{'✗'}</span>
            </div>
          </div>
          {/* 旁路箭头（气泡 → 关键词 → 提示条；接通一拍） */}
          <svg width={700} height={190} viewBox="0 0 700 190" style={{position: 'absolute', left: 0, top: 240, overflow: 'visible', opacity: 0.95}}>
            <path d={`M 90 -46 C 90 40, 360 30, 360 96`} fill="none" stroke={withAlpha(theme.danger, 0.7)} strokeWidth={3.5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - arrow} />
            <path d={`M 352 82 L 360 98 L 368 82`} fill="none" stroke={theme.danger} strokeWidth={3.5} strokeLinecap="round" opacity={arrow} />
          </svg>
          {/* 提示条（左轨——空记忆段被拉入：飞行中 + 就位红染误拼块） */}
          <div style={{position: 'absolute', left: 40, top: 340, width: 700}}>
            <PromptBar
              x={0}
              y={0}
              w={700}
              h={84}
              mode={'assembled'}
              chips={[
                {zh: '身份', en: 'identity'},
                {zh: '工具', en: 'tools'},
                {zh: '工作目录', en: 'workspace'},
                {zh: '记忆 · 空', en: 'memory'},
              ]}
              chipsLit={[1, 1, 1, mis]}
              misIdx={3}
              misP={mis}
            />
          </div>
          {/* 半透空记忆段卡（被旁路箭头拉入——飞行体；到达即成为误拼块） */}
          {pull > 0.02 && pull < 0.98 ? (
            <div
              style={{
                position: 'absolute',
                left: flyFrom.x + (flyTo.x - flyFrom.x) * pull,
                top: flyFrom.y + (flyTo.y - flyFrom.y) * pull,
                width: 150,
                height: 64,
                boxSizing: 'border-box',
                borderRadius: 9,
                border: `3px dashed ${withAlpha(theme.mech, 0.75)}`,
                background: withAlpha(theme.panel, 0.9),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.sans,
                fontSize: 17,
                fontWeight: 700,
                color: theme.dim,
                whiteSpace: 'nowrap',
                opacity: 0.75,
              }}
            >
              {'记忆段 · 空'}
            </div>
          ) : null}
          {/* 双计数位（误注入 0→1 / 字符 113→147 punch） */}
          <DualCounter x={44} y={452} inj={inj} chars={chars} flash={punch} />
        </div>
        {/* ── 右轨 · 状态判据（确认绿——同帧恒稳对照） ── */}
        <div
          style={{
            position: 'absolute',
            left: TRACKS.rx,
            top: TRACKS.y,
            width: TRACKS.w,
            height: TRACKS.h,
            boxSizing: 'border-box',
            borderRadius: 16,
            border: `3.5px solid ${withAlpha(theme.ok, 0.5)}`,
            background: withAlpha(theme.panel, 0.9),
            opacity: frameR,
            transform: `translateY(${(1 - frameR) * 22}px)`,
            padding: '14px 20px',
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 700, color: theme.ok}}>{'状态判据'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 12, color: theme.dim}}>{'清单 → 拼段'}</span>
          </div>
          {/* 同款消息气泡（同一句输入——右轨扫过即过、零反应） */}
          <div style={{marginTop: 12}}>
            <MessageBubble x={0} y={0} w={560} lit={frameR} scale={0.72} />
          </div>
          {/* 清单卡缩微（判据在位——记忆行无 → 记忆段不拼） */}
          <div style={{marginTop: 12}}>
            <StateManifestCard x={0} y={0} w={420} h={190} scale={0.78} lit={frameR} rowsLit={2} memHas={0} />
          </div>
          {/* 清单 → 提示条 直连（判据路在场——清单底缘下行至提示条顶） */}
          <svg width={80} height={40} viewBox="0 0 80 40" style={{position: 'absolute', left: 130, top: 312, overflow: 'visible', opacity: frameR}}>
            <line x1={34} y1={0} x2={34} y2={22} stroke={withAlpha(theme.ok, 0.65)} strokeWidth={3.5} strokeDasharray="8 6" />
            <path d="M 24 18 L 34 32 L 44 18" fill="none" stroke={withAlpha(theme.ok, 0.75)} strokeWidth={3.5} strokeLinecap="round" />
          </svg>
          {/* 提示条（右轨——三段恒稳 113） */}
          <div style={{position: 'absolute', left: 40, top: 340, width: 700}}>
            <PromptBar
              x={0}
              y={0}
              w={700}
              h={84}
              mode={'assembled'}
              chips={[
                {zh: '身份', en: 'identity'},
                {zh: '工具', en: 'tools'},
                {zh: '工作目录', en: 'workspace'},
              ]}
              chipsLit={[1, 1, 1]}
            />
          </div>
          {/* 双计数位（恒稳：0 误注入 / 113 不动——同帧对照） */}
          <DualCounter x={44} y={452} inj={0} chars={113} steady />
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'--experiment 4 · keyword matching'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 双帧并列特写：左帧被撬动 ↔ 右帧恒稳 + 回环虚线 ────────────────────

const ThreeB: React.FC<{atShake: number; atLoop: number; atFreeze: number}> = ({atShake, atLoop, atFreeze}) => {
  const frame = useCurrentFrame();
  // 左帧轻微抖动（撬动≠崩坏——幅度轻、衰减收）
  const shakeEnv = Math.sin(Math.PI * clamp01(progress(frame, atShake, 26)));
  const shake = shakeEnv * Math.sin(frame / 1.7) * 4;
  // 「每轮都要看」回环虚线绕上左帧提示条（唯一新增元素；不绕向右帧）
  const loopP = clamp01(progress(frame, atLoop, 24));
  // 双帧对照定格（A#5 尾拍定格）
  const freeze = useProgress(atFreeze, DUR.f5);
  return (
    <AbsoluteFill>
      {/* 左帧 · 被撬动（轻微抖动——用户一句闲聊撬动的） */}
      <div style={{position: 'absolute', left: 200, top: 360, transform: `translateX(${shake}px) rotate(${shake * 0.25}deg)`}}>
        <PromptBar
          x={0}
          y={0}
          w={640}
          h={92}
          mode={'assembled'}
          chips={[
            {zh: '身份', en: 'identity'},
            {zh: '工具', en: 'tools'},
            {zh: '工作目录', en: 'workspace'},
            {zh: '记忆 · 空', en: 'memory'},
          ]}
          chipsLit={[1, 1, 1, 1]}
          misIdx={3}
          misP={1}
        />
        <div style={{position: 'absolute', left: 0, top: -40, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap'}}>
          {'话术撬得动'}
        </div>
      </div>
      {/* 回环虚线（绕住左帧——「每轮都要看」的风险敞口；循环小箭头） */}
      {loopP > 0.02 ? (
        <svg width={760} height={240} viewBox="0 0 760 240" style={{position: 'absolute', left: 140, top: 288, overflow: 'visible'}}>
          <rect x={10} y={26} width={680} height={168} rx={18} fill="none" stroke={theme.danger} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - loopP} opacity={0.75} />
          {/* 循环小箭头（回环——每轮都绕回来再看一遍） */}
          <path d="M 356 -2 L 344 10 M 356 -2 L 368 10 M 356 -2 L 356 22" fill="none" stroke={theme.danger} strokeWidth={3} strokeLinecap="round" opacity={loopP} />
        </svg>
      ) : null}
      {loopP > 0.3 ? (
        <div style={{position: 'absolute', left: 396, top: 232, padding: '4px 16px', borderRadius: 8, border: `2.5px solid ${theme.danger}`, background: theme.panel, fontFamily: theme.sans, fontSize: 17, fontWeight: 700, color: theme.danger, whiteSpace: 'nowrap', opacity: clamp01((loopP - 0.3) * 2)}}>
          {'每轮都要看'}
        </div>
      ) : null}
      {/* 右帧 · 恒稳（状态判据——纹丝不动） */}
      <div style={{position: 'absolute', left: 1080, top: 360}}>
        <PromptBar
          x={0}
          y={0}
          w={640}
          h={92}
          mode={'assembled'}
          chips={[
            {zh: '身份', en: 'identity'},
            {zh: '工具', en: 'tools'},
            {zh: '工作目录', en: 'workspace'},
          ]}
          chipsLit={[1, 1, 1]}
        />
        <div style={{position: 'absolute', left: 0, top: -40, fontFamily: theme.sans, fontSize: 19, fontWeight: 700, color: theme.ok, whiteSpace: 'nowrap'}}>
          {'状态稳得住'}
        </div>
      </div>
      {/* 对照定格裁决线（中缝——freeze 收束一拍） */}
      {freeze > 0.02 ? (
        <div style={{position: 'absolute', left: 960, top: 320, height: 200, width: 0, borderLeft: `3px solid ${withAlpha(theme.dim, 0.6 * freeze)}`}} />
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'提示的稳定性 · 撬动 ≠ 崩坏'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 判据卡定格 + 七段阵列暗层预告 ─────────────────────────────────────

/** P4 右栏/暗层预告的七段卡（identity/tools/tasks/teams/workspace/memory/compaction） */
const CARDS_7 = [
  {zh: '身份', en: 'identity'},
  {zh: '工具', en: 'tools'},
  {zh: '任务', en: 'tasks'},
  {zh: '团队', en: 'teams'},
  {zh: '工作目录', en: 'workspace'},
  {zh: '记忆', en: 'memory'},
  {zh: '压缩', en: 'compaction'},
] as const;

const ThreeC: React.FC<{atCard: number; atRow1: number; atRow2: number; atSeven: number}> = ({atCard, atRow1, atRow2, atSeven}) => {
  const frame = useCurrentFrame();
  // 判据卡两行先后定格（教训签——关键词化不复述整句）
  const card = useProgress(atCard, DUR.f5);
  const row1 = useProgress(atRow1, DUR.f4);
  const row2 = useProgress(atRow2, DUR.f4);
  // 远处暗层七段阵列淡入半拍即收（P4 主角预显——仅轮廓、不显段名细节）
  const sevenEnv = Math.sin(Math.PI * clamp01(progress(frame, atSeven, 34)));
  const sevenSeat = clamp01(progress(frame, atSeven, 12));
  return (
    <AbsoluteFill>
      {/* 判据卡（唯一前景主体——两行关键词签） */}
      <div style={{position: 'absolute', left: 300, top: 300, opacity: card, transform: `translateY(${(1 - card) * 20}px)`}}>
        <div
          style={{
            width: 660,
            boxSizing: 'border-box',
            borderRadius: 16,
            border: `3.5px solid ${theme.panelBorder}`,
            background: withAlpha(theme.panel, 0.96),
            padding: '30px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {[
            {t: '看状态', mark: '✓', p: row1, on: theme.ok},
            {t: '看话术', mark: '✗', p: row2, on: theme.danger},
          ].map((r) => (
            <div key={r.t} style={{display: 'flex', alignItems: 'center', gap: 22, opacity: 0.35 + 0.65 * clamp01(r.p)}}>
              <span
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  border: `3px solid ${r.on}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.sans,
                  fontSize: 30,
                  fontWeight: 700,
                  color: r.on,
                }}
              >
                {r.mark}
              </span>
              <span style={{fontFamily: theme.serif, fontSize: 46, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap'}}>{r.t}</span>
            </div>
          ))}
        </div>
      </div>
      {/* 远处暗层 · 七段卡阵列（半透明轮廓——细节不显；半拍即收驻暗） */}
      <div style={{position: 'absolute', left: 1290, top: 210, opacity: 0.2 + 0.45 * sevenEnv, filter: `brightness(${0.55 + 0.45 * sevenEnv})`}}>
        <SectionCardStack x={0} y={0} w={420} h={560} cards={CARDS_7} lit={sevenSeat} dim={0.25} />
      </div>
      {sevenEnv > 0.2 ? (
        <div style={{position: 'absolute', left: 1240, top: 158, fontFamily: theme.sans, fontSize: 16, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap', opacity: sevenEnv}}>
          {'另一套拼法 · 预告'}
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'段加载判据 · 看状态 ✓ 看话术 ✗'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P3StateVsKeywords: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-06');
  const bC = w('p3-07', 'p3-08');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <ThreeA
          atFrame={wa('p3-01', 0.2) - bA.from}
          atRule={wa('p3-02', 0.14) - bA.from}
          atArrow={wa('p3-02', 0.56) - bA.from}
          atHl={wa('p3-03', 0.3) - bA.from}
          atPull={wa('p3-03', 0.52) - bA.from}
          atInj={wa('p3-04', 0.14) - bA.from}
          atChars={wa('p3-04', 0.56) - bA.from}
          atPush={wa('p3-04', 0.48) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="3-B">
        <ThreeB atShake={wa('p3-05', 0.34) - bB.from} atLoop={wa('p3-05', 0.6) - bB.from} atFreeze={wa('p3-06', 0.5) - bB.from} />
      </Sequence>
      <Sequence {...bC} name="3-C">
        <ThreeC atCard={wa('p3-07', 0.16) - bC.from} atRow1={wa('p3-07', 0.3) - bC.from} atRow2={wa('p3-07', 0.62) - bC.from} atSeven={wa('p3-08', 0.52) - bC.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3StateVsKeywords;
