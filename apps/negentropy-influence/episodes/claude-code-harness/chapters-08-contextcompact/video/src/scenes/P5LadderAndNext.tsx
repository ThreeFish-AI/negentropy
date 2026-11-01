/** P5 收束与下期（p5-01..p5-07，3 镜）——分镜 5-A / 5-B / 5-C。
 *
 *  ★ 5-A 四步阶梯定格收束（EWS）：阶梯放大居中、双轴展开（横失真轴 + 纵成本
 *    轴——4-D 末帧右上缩影四格全亮为 Morph 起点：放大过程中四格次序、色值、
 *    成本升序逐帧不变，仅尺度与轴向标注展开）；摘要卡居最高档（第四格上叠）；
 *    三档标注（无损 / 可恢复 / 不可恢复）逐档点亮（档位高低=成本高低=运行先
 *    后：低先跑、最高档垫底压轴——X-001）；环体同形回归定格于阶梯旁（纸挂
 *    环侧）；金句卡（衬线体）覆上层「便宜的先跑 · 贵的后跑」两关键词各压一拍
 *    重读排版（caption-dup-ok：金句卡刻意复述——收束定格仪式，承 ep1–ep6
 *    5-A 豁免先例）。
 *  ★ 5-B 草稿纸回扣：0-A 同款草稿纸回场（同形签名——镜间身份恒常），纸面
 *    清爽、边角留白、水位低位；紫面驻旁；「到线就腾地方」水位贴线一拍、一块
 *    大件落进紫面、纸面回落清爽（0-A 泛红终态的反演）；「新开一场对话」新纸
 *    翻入、「连摘要都不剩」摘要卡淡出消散、「什么都不记得」纸面完全空白定格
 *    半拍（「忘」的静默预演）；「下期」下期卡浮起（一道渐隐纸影 + 「下期」签，
 *    不预告机制——下集本体零机制图形）。
 *  ★ 5-C 片尾署源卡（尾部署源位，RSI I-080 豁免；署源句 = p5-06、漂移警示句
 *    = p5-07）：主行 Learn Claude Code / 次行仓库地址 / 角注 MIT（卡面 ≤3 行）；
 *    p5-07 期间卡片静持（漂移警示由口播承载、卡面零复述）；全片在此卡收束。
 *  ★ 尾幕渐黑（红线四）：窗取末 beat 总时长（p5-06..p5-07 之和）——终点即本幕
 *    终点。收尾版式不挂 SceneTag（承 ep1–ep7 先例）。
 *
 *  空间契约：金句卡衬线体为唯一主体时段、双轴档位与四步对应（摘要居双轴最高
 *    档）、环体同形回归；回扣纸与 0-A 同款同形、新纸完全空白（忘的判据，非
 *    原纸被清空）、下期卡无机制细节；署源卡为最后画面、卡面 ≤3 行信息。
 *
 *  红线落实：词落位 = wa(id,f)；y≥56 / bottom≥168；「下期」为唯一顺序词；
 *    金句卡 caption-dup-ok 豁免登记。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {ContextPaper, LoopRing, Panel, StepLadder, ThresholdWaterline, TransferArrow} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFadeOut, useImpulse, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 5-A 阶梯双轴定格收束 + 金句卡 ───────────────────────────────────────

const FiveA: React.FC<{atScale: number; atCard: number; atK1: number; atK2: number; atTiers: number}> = ({
  atScale,
  atCard,
  atK1,
  atK2,
  atTiers,
}) => {
  const frame = useCurrentFrame();
  // 阶梯自缩影位放大居中（Morph：四格次序/色值/成本升序不变，仅尺度与轴向展开）
  const scaleUp = useProgress(atScale, DUR.f6, 'decelerate');
  const settleGlow = useImpulse({at: atScale + DUR.f5, dur: DUR.f6, peak: 1});
  // 金句卡淡入定格 + 两关键词各压一拍重读（衬线——caption-dup-ok 豁免）
  const card = useProgress(atCard, DUR.f6);
  const k1 = useImpulse({at: atK1, dur: DUR.f6, peak: 0.06});
  const k2 = useImpulse({at: atK2, dur: DUR.f6, peak: 0.06});
  const k1Glow = useProgress(atK1, DUR.f5);
  const k2Glow = useProgress(atK2, DUR.f5);
  // 双轴展开（失真轴）+ 三档标注逐档点亮
  const distort = useProgress(atScale + 6, DUR.f5);
  const tiers = useProgress(atTiers, DUR.f6);
  // 摘要卡（居最高档——第四格上叠小卡）
  const sumCard = useProgress(atScale + 10, DUR.f5);
  // 缩影位 → 主景位的放大插值（4-D 末帧右上缩影 = Morph 起点；scale 0.2→1.0
  // ——axes 容器 1080 宽，×1.0 落 x500..1580 屏内，×1.8 会溢屏）
  const sx = 1630 - 1130 * scaleUp;
  const sy = 68 + 120 * scaleUp;
  const sScale = 0.2 + 0.8 * scaleUp;
  const dot = ((frame / 80) % 1 + 1) % 1;
  return (
    <AbsoluteFill>
      {/* 四步阶梯（放大居中·axes 态——双轴 + 三档标注） */}
      <StepLadder
        x={sx}
        y={sy}
        scale={sScale}
        mode="axes"
        litMask={4}
        axisP={1}
        distortP={distort}
        tiersLit={tiers}
        settleGlow={settleGlow}
      />
      {/* 摘要卡（居最高档——第四格上叠：不可恢复档的具象） */}
      {sumCard > 0.02 ? (
        <div style={{position: 'absolute', left: 500 + (1400 - 500) * 0.52, top: 230, opacity: clamp01(sumCard)}}>
          <div
            style={{
              padding: '10px 18px',
              borderRadius: 9,
              border: `2.5px solid ${theme.core}`,
              background: theme.panel,
              fontFamily: theme.sans,
              fontSize: 17,
              fontWeight: 700,
              color: theme.text,
              whiteSpace: 'nowrap',
              transform: `translateY(${(1 - clamp01(sumCard)) * 14}px)`,
            }}
          >
            {'摘要卡 · 居最高档'}
          </div>
        </div>
      ) : null}
      {/* 环体同形回归定格于阶梯旁（纸挂环侧——清爽态） */}
      <div style={{position: 'absolute', left: 200, top: 420, opacity: clamp01(scaleUp)}}>
        <LoopRing size={200} nodes={[]} showExit={false} dotProgress={dot} />
        {/* 环侧挂的纸（清爽——终态：纸清爽、环常转） */}
        <div style={{position: 'absolute', left: 168, top: 60, width: 96, height: 70, borderRadius: 6, border: `2.5px solid ${withAlpha(theme.mech, 0.7)}`, background: withAlpha(theme.panel, 0.9), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.sans, fontSize: 12, color: theme.mech}}>
          {'纸 · 清爽'}
        </div>
      </div>
      {/* 金句卡（衬线体——覆上层；caption-dup-ok: 金句卡刻意复述（收束定格仪式，
          承 ep1–ep6 5-A 豁免先例）） */}
      <div
        style={{
          position: 'absolute',
          left: 400,
          top: 92,
          opacity: clamp01(card),
          transform: `translateY(${(1 - clamp01(card)) * 22}px)`,
          zIndex: 3,
        }}
      >
        <Panel accent={theme.core} style={{padding: '24px 48px', display: 'inline-block'}}>
          <div style={{fontFamily: theme.serif, fontSize: 46, color: theme.text, lineHeight: 1.3, whiteSpace: 'nowrap'}}>
            <span style={{fontWeight: 700, color: theme.ok, display: 'inline-block', transform: `scale(${1 + k1})`, textShadow: k1Glow > 0.01 ? `0 0 ${22 * k1Glow}px ${withAlpha(theme.ok, 0.5)}` : 'none'}}>
              {'便宜的先跑'}
            </span>
            <span style={{color: theme.dim}}>{' · '}</span>
            <span style={{fontWeight: 700, color: theme.danger, display: 'inline-block', transform: `scale(${1 + k2})`, textShadow: k2Glow > 0.01 ? `0 0 ${22 * k2Glow}px ${withAlpha(theme.danger, 0.5)}` : 'none'}}>
              {'贵的后跑'}
            </span>
          </div>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'成本 × 失真 · 低先跑 最高档垫底压轴'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 草稿纸回扣：贴线腾地方 → 新纸翻入全空白 → 下期卡 ────────────────

/** 主装置回扣位（0-A 同款同形——首尾对照的可核对判据） */
const PAPER = {x: 470, y: 200, w: 980, h: 660} as const;

const FiveB: React.FC<{atBack: number; atTrim: number; atNewPaper: number; atSummaryOut: number; atBlank: number; atNext: number}> = ({
  atBack,
  atTrim,
  atNewPaper,
  atSummaryOut,
  atBlank,
  atNext,
}) => {
  const frame = useCurrentFrame();
  // 「还是那张纸」草稿纸回场（同款同形）——纸面清爽、边角留白、水位低位
  const back = useProgress(atBack, DUR.f6);
  // 「到线就腾地方」水位贴线一拍 → 一块大件落进紫面 → 纸面回落清爽（反演）
  const trim = useProgress(atTrim, DUR.f4);
  const trimFall = useProgress(atTrim + 14, DUR.f5);
  const trimFlash = useImpulse({at: atTrim + 14 + DUR.f4, dur: DUR.f5, peak: 1});
  // 「新开一场对话」新纸翻入（ scaleX −1→1 翻面）+ 摘要卡淡出 + 纸面完全空白
  const newPaper = useProgress(atNewPaper, DUR.f6);
  const flip = clamp01(newPaper);
  const summaryOut = useProgress(atSummaryOut, DUR.f5);
  const blank = useProgress(atBlank, DUR.f6);
  // 「下期」下期卡浮起（一道渐隐纸影 + 「下期」签——不预告机制）
  const next = useProgress(atNext, DUR.f5);
  // 水位（低位 → 贴线一拍 → 回落低位）
  const level = 0.22 + 0.6 * trim - 0.6 * trimFall;
  return (
    <AbsoluteFill>
      {/* 草稿纸回扣（0-A 同款——同形签名；新纸翻入时旧纸让位淡出） */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: clamp01(back) * (1 - clamp01(flip))}}>
        <ContextPaper x={PAPER.x} y={PAPER.y} w={PAPER.w} h={PAPER.h} rowsLit={6} cleanP={0.6} thickness={0.3} />
      </div>
      {/* 新纸翻入（翻面变换——旧纸翻出、新纸完全空白） */}
      {flip > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            opacity: clamp01(flip * 2),
            transform: `scaleX(${Math.max(0.04, Math.abs(1 - 2 * flip))})`,
            transformOrigin: '50% 50%',
          }}
        >
          <ContextPaper x={PAPER.x} y={PAPER.y} w={PAPER.w} h={PAPER.h} rowsLit={0} blankP={blank} quotaLit={0} />
        </div>
      ) : null}
      {/* 摘要卡淡出消散（「连摘要都不剩」——飘散上移） */}
      {summaryOut > 0.02 && summaryOut < 0.98 ? (
        <div
          style={{
            position: 'absolute',
            left: 830,
            top: 380 - 90 * summaryOut,
            padding: '14px 26px',
            borderRadius: 10,
            border: `2.5px solid ${theme.core}`,
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 20,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: 1 - clamp01(summaryOut),
          }}
        >
          {'摘要卡'}
        </div>
      ) : null}
      {/* 水位条（列侧——低位贴线一拍回落） */}
      <ThresholdWaterline x={1490} y={240} h={480} level={clamp01(level)} lit={back} breach={0} caption={'到线就腾'} />
      {/* 蓝→紫箭头（一块大件落进紫面——腾地方动作） */}
      <TransferArrow x={1180} y={430} w={240} p={trimFall} lit={trimFall > 0.02 && trimFall < 0.98 ? 1 : 0} flowPhase={frame / 26} />
      {/* 紫面驻旁（磁盘——大件落进 + 轻闪） */}
      <div style={{position: 'absolute', left: 1450, top: 480, width: 330}}>
        <div
          style={{
            width: '100%',
            height: 200,
            boxSizing: 'border-box',
            borderRadius: 12,
            border: `3px solid ${theme.archive}`,
            background: withAlpha(theme.panel, 0.6),
            padding: '10px 12px',
            boxShadow: trimFlash > 0.05 ? `0 0 ${22 * clamp01(trimFlash)}px ${withAlpha(theme.archive, 0.5)}` : 'none',
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 14, fontWeight: 700, color: theme.archive}}>{'磁盘 · 驻旁'}</div>
          <div style={{marginTop: 8, height: 90, borderRadius: 8, border: `2.5px ${trimFall > 0.4 ? 'solid' : 'dashed'} ${theme.archive}`, opacity: 0.4 + 0.6 * trimFall, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.mono, fontSize: 12, color: theme.archive}}>
            {trimFall > 0.4 ? '大件 · 已落盘' : '待落盘'}
          </div>
        </div>
      </div>
      {/* 空白定格注（「忘」的静默预演——半拍） */}
      {blank > 0.6 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 150, textAlign: 'center', fontFamily: theme.serif, fontSize: 26, color: theme.dim, opacity: clamp01((blank - 0.6) * 2) * 0.8}}>
          {'什么都不记得'}
        </div>
      ) : null}
      {/* 下期卡（视觉层——一道渐隐纸影 + 「下期」签；不预告机制、零机制图形） */}
      {next > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 810,
            top: 420 - 40 * next,
            opacity: clamp01(next),
            transform: `translateY(${(1 - next) * 26}px)`,
          }}
        >
          <Panel accent={withAlpha(theme.core, 0.55)} style={{padding: '22px 44px', position: 'relative'}}>
            {/* 渐隐纸影（一道——问题意象） */}
            <svg width={280} height={72} viewBox="0 0 280 72">
              <rect x={12} y={10} width={256} height={52} rx={7} fill="none" stroke={withAlpha(theme.mech, 0.4)} strokeWidth={3} strokeDasharray="10 8" />
              <line x1={40} y1={28} x2={200} y2={28} stroke={withAlpha(theme.dim, 0.35)} strokeWidth={4} strokeLinecap="round" />
              <line x1={40} y1={44} x2={150} y2={44} stroke={withAlpha(theme.dim, 0.25)} strokeWidth={4} strokeLinecap="round" />
            </svg>
            <div style={{textAlign: 'center', fontFamily: theme.serif, fontSize: 46, fontWeight: 700, color: theme.text, letterSpacing: 14, paddingLeft: 14, marginTop: 10}}>
              {'下期'}
            </div>
          </Panel>
        </div>
      ) : null}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 176, textAlign: 'center', fontFamily: theme.mono, fontSize: 19, color: theme.dim, opacity: 0.7}}>
        {'草稿纸回扣 · 0-A 同款同形'}
      </div>
    </AbsoluteFill>
  );
};

// ── 5-C 片尾署源卡（尾部署源位，RSI I-080 豁免） ─────────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-06 口播同拍淡入；两行先后落定（署源专名约 0.6 处被念到，次行隔拍跟落）
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

/** 幕末渐黑（红线四）：窗 = 末 beat 总时长（p5-06..p5-07 之和），终点即本幕终点 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P5LadderAndNext: React.FC<{scene: SceneRange}> = ({scene}) => {
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
          atScale={0}
          atCard={wa('p5-01', 0.2) - bA.from}
          atK1={wa('p5-01', 0.44) - bA.from}
          atK2={wa('p5-01', 0.72) - bA.from}
          atTiers={wa('p5-02', 0.3) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <FiveB
          atBack={wa('p5-03', 0.2) - bB.from}
          atTrim={wa('p5-03', 0.62) - bB.from}
          atNewPaper={wa('p5-04', 0.24) - bB.from}
          atSummaryOut={wa('p5-04', 0.56) - bB.from}
          atBlank={wa('p5-04', 0.82) - bB.from}
          atNext={wa('p5-05', 0.5) - bB.from}
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

export default P5LadderAndNext;
