/** P4 插线口（p4-01..29，8 镜 8 cue）——分镜 4-A…4-H。
 *
 *  叙事链：循环体膨胀（认不出来了）→ 插线口母题（SlotRing 四角插槽 + plug-pulse
 *  Lottie 点缀，planning §3 唯二之一）→ 返回值唯一信道 → 权限搬家（全片最漂亮的
 *  一次：门禁降级为第一个插头）→ 退出否决 → 三瑕疵账 → 官方并行对照。
 *  空间契约：传送带锁芯恒 core 橙恒静〔M-001〕，插口装置自右缘挂入（mech 青），
 *  「加机制」的动效永不触碰内核图形。
 *  archify 三图全屏独占；4-C→4-D 跨实例背靠背（p4-08→p4-09 无空窗句），
 *  后挂的 4-D 实例 lead={false}。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, LoopRing, NumberedCard, Panel, SceneTag, SlotRing, Terminal} from '../components/motifs';
import type {Slot} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {HarnessBadge} from '../components/harness-stack';
import {LottieEmphasis} from '../components/LottieEmphasis';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {
  DUR,
  clamp01,
  useCount,
  useDim,
  useDraw,
  useEnter,
  useImpulse,
  useProgress,
  useReveal,
  useSpring,
  useStagger,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：顶边 y<56 归 frozen ChapterProgress，Badge 下移到 SceneTag
 *  同行（P1–P6 同值，Integrate 统一核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** LoopRing 巡游节律：2.5s/圈（全片同值） */
const LAP_FRAMES = 75;

/** 左中内核：恒定锚 + 匀速巡游光点（锁芯恒静＝环不动，只有光点在走） */
const KernelCore: React.FC<{size: number; left: number; top: number; span: number}> = ({
  size,
  left,
  top,
  span,
}) => {
  const laps = useProgress(0, Math.max(1, span), 'linear') * (span / LAP_FRAMES);
  return (
    <div style={{position: 'absolute', left, top}}>
      <LoopRing size={size} dotProgress={laps} showLabels={false} showExit={false} />
    </div>
  );
};

// ── 4-A 循环体膨胀滚屏复现（p4-01..02） ─────────────────────────────────

const BLOAT_LINES = [
  '    ask_model()',
  '    run_tool(block)',
  '    git add .',
  '    auto_commit()',
  '    log_step(n)',
] as const;

const BloatRecap: React.FC<{atBlur: number}> = ({atBlur}) => {
  const card = useEnter('fade', {at: 2, dur: DUR.f5});
  // 一行行叠进循环体（固定五行：顶层固定次序的 useReveal，不入 map）
  const l0 = useReveal(BLOAT_LINES[0], {at: 6, cps: 16});
  const l1 = useReveal(BLOAT_LINES[1], {at: 6 + 8, cps: 16});
  const l2 = useReveal(BLOAT_LINES[2], {at: 6 + 16, cps: 16});
  const l3 = useReveal(BLOAT_LINES[3], {at: 6 + 24, cps: 16});
  const l4 = useReveal(BLOAT_LINES[4], {at: 6 + 32, cps: 16});
  const lines = [l0, l1, l2, l3, l4];
  // p4-02：整框毛玻璃模糊——想扩展的是行为，动的却是心脏（模糊度推进）
  const blur = useProgress(atBlur, DUR.f6);
  const label = useProgress(atBlur + DUR.f4, DUR.f4);

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...card}}>
        <div style={{position: 'absolute', left: 610, top: 250, filter: `blur(${blur * 7}px)`, opacity: 1 - 0.25 * blur}}>
          <Panel accent={theme.core} style={{width: 700, boxSizing: 'border-box', padding: '24px 32px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 36, color: theme.core}}>{'while True:'}</div>
            {lines.map((ln, i) => (
              <div key={i} style={{fontFamily: theme.mono, fontSize: 28, color: i === 2 ? theme.text : theme.dim, whiteSpace: 'pre', minHeight: 46}}>
                {ln || ' '}
              </div>
            ))}
          </Panel>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 660,
            width: 1920,
            textAlign: 'center',
            fontFamily: theme.serif,
            fontSize: 44,
            fontWeight: 700,
            color: theme.dim,
            opacity: label,
          }}
        >
          {'认不出来了'}
        </div>
      </div>
      <Footnote delay={6 + 16}>{'git add · 横切行为示意'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-B 插线口母题（p4-03..06） ─────────────────────────────────────────

/** SlotRing 容器：左 90 / 顶 260 / 1120×600（母题定位契约的最小尺寸） */
const SLOT_BOX = {left: 90, top: 260, w: 1120, h: 600} as const;
/** 环 size 380 → 容器内居中：页位 (460, 370)，环心 (650, 560) */
const SLOT_RING = {size: 380, inLeft: 370, inTop: 110} as const;

const SOCKETS: Slot[] = [
  {name: '用户递话', when: 'UserPromptSubmit', callbacks: []},
  {name: '执行前', when: 'PreToolUse', callbacks: []},
  {name: '执行后', when: 'PostToolUse', callbacks: []},
  {name: '收工', when: 'Stop', callbacks: []},
];

/** 插头（日志装置）：右缘弹出 → 沿描线挂进「执行前」口 */
const PLUG = {w: 260, h: 70, fromX: 1440, fromY: 120, toX: 900, toY: 330} as const;

const SocketMotif: React.FC<{
  span: number;
  atPlug: number;
  seatAt: number;
  atQuote: number;
  atAll: number;
}> = ({span, atPlug, seatAt, atQuote, atAll}) => {
  const frame = useCurrentFrame();
  // 插口描线展开：环沿 →「执行前」口
  const draw = useDraw(2, DUR.f5);
  const plugPop = useEnter('pop', {at: atPlug, dur: DUR.f4});
  // 到站减速（decelerate）：挂入的动作是「对准」不是「砸进」
  const travel = useProgress(atPlug + DUR.f4, DUR.f6, 'decelerate');
  const seatGlow = useImpulse({at: seatAt, dur: DUR.f6});
  // 点亮锚（显式帧）：咬合 beat（seatAt）点亮前两口、p4-06 全亮 beat（atAll）
  // 点亮后两口。lit 的翻转与 SlotRing 的 enterAt 同帧——翻转若晚于弹簧起跳，
  // 入场前几帧会被 on 门控吞掉，点亮处出现透明度跳变
  const enterAt = [seatAt, seatAt, atAll, atAll];
  const lit = frame >= atAll ? 3 : frame >= seatAt ? 1 : -1;

  return (
    <AbsoluteFill>
      <KernelCore size={SLOT_RING.size} left={SLOT_BOX.left + SLOT_RING.inLeft} top={SLOT_BOX.top + SLOT_RING.inTop} span={span} />

      <div style={{position: 'absolute', left: SLOT_BOX.left, top: SLOT_BOX.top, width: SLOT_BOX.w, height: SLOT_BOX.h}}>
        <SlotRing slots={SOCKETS} lit={lit} enterAt={enterAt} size={SLOT_RING.size} />
      </div>

      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <path
          d="M650 416 C 724 382, 806 358, 886 364"
          fill="none"
          stroke={theme.mech}
          strokeWidth={4}
          opacity={0.9}
          {...draw}
        />
      </svg>

      {/* 插头卡：弹出（pop）→ 沿线滑移 → 咬合 */}
      <div style={{position: 'absolute', left: PLUG.fromX, top: PLUG.fromY, width: PLUG.w, ...plugPop}}>
        <div style={{transform: `translate(${(PLUG.toX - PLUG.fromX) * travel}px, ${(PLUG.toY - PLUG.fromY) * travel}px)`}}>
          <Panel
            accent={theme.mech}
            style={{
              width: PLUG.w,
              boxSizing: 'border-box',
              padding: '10px 18px',
              background: theme.mechDeep,
              boxShadow: `0 0 ${26 * seatGlow}px ${theme.mech}`,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.mech}}>{'日志装置'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'log()'}</div>
          </Panel>
        </div>
      </div>

      {/* 插入脉冲（Lottie 点缀之二）：与咬合同帧起跳 */}
      <LottieEmphasis
        src="lottie/plug-pulse.json"
        at={seatAt}
        duration={DUR.f6}
        style={{position: 'absolute', left: PLUG.toX + PLUG.w / 2 - 110, top: PLUG.toY - 76, width: 220, height: 220, opacity: 0.9}}
      />

      {/* 金句卡（p4-04）：挂在循环上，不写进循环里 */}
      <Sequence from={atQuote} layout="none">
        <div style={{position: 'absolute', left: 310, top: 90, width: 1300, height: 160}}>
          {/* caption-dup-ok: 金句定格记忆点——storyboard 4-B 明写全句定格（未标压短形态），衬线卡与口播同拍点属刻意 */}
          <QuoteCard zh="挂在循环上 · 不写进循环里" />
        </div>
      </Sequence>
      <Footnote delay={2 + DUR.f5}>{'HOOKS · register_hook() / trigger_hooks()'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-E 权限搬家：降级为第一个插头（p4-12..15） ─────────────────────────

/** 模块起点（内核旁）/ 弧线控制点 / 落位（执行前首口） */
const MOVE = {from: {x: 560, y: 480}, cp: {x: 930, y: 300}, to: {x: 1290, y: 434}} as const;

const PermissionMove: React.FC<{
  span: number;
  atMove: number;
  seatAt: number;
  atTag: number;
  atFlip: number;
}> = ({span, atMove, seatAt, atTag, atFlip}) => {
  const module0 = useEnter('fade', {at: 2, dur: DUR.f5});
  // 滑移：snap 弹簧钳行程 min(1,·)（ISSUE-180 口径——过冲不穿透插槽，转为辉光）
  const raw = useSpring('snap', {at: atMove, dur: DUR.f6});
  const t = Math.min(1, raw);
  const overshoot = clamp01(raw - 1) * 9;
  const x = (1 - t) ** 2 * MOVE.from.x + 2 * (1 - t) * t * MOVE.cp.x + t ** 2 * MOVE.to.x;
  const y = (1 - t) ** 2 * MOVE.from.y + 2 * (1 - t) * t * MOVE.cp.y + t ** 2 * MOVE.to.y;
  // 残影原地淡出 + 咬合脉冲
  const detach = useProgress(atMove, DUR.f3);
  const ghostFade = useProgress(atMove, DUR.f5);
  const ghostO = detach * (1 - ghostFade);
  const seatGlow = useImpulse({at: seatAt, dur: DUR.f6});
  const slotsIn = useProgress(2, DUR.f5);
  const tag = useProgress(atTag, DUR.f4);

  const gateModule = (glow: number) => (
    <Panel
      accent={theme.mech}
      style={{
        width: 250,
        boxSizing: 'border-box',
        padding: '14px 20px',
        background: theme.mechDeep,
        boxShadow: `0 0 ${20 * glow}px ${theme.mech}`,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
        {/* 焊死门微缩：三竖杠（deny/mech/dim 次序锁死） */}
        <svg width={44} height={34}>
          <rect x={2} y={2} width={8} height={30} rx={2} fill={theme.deny} />
          <rect x={18} y={2} width={8} height={30} rx={2} fill={theme.mech} />
          <rect x={34} y={2} width={8} height={30} rx={2} fill={theme.dim} opacity={0.7} />
        </svg>
        <div>
          <div style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>{'门禁'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>{'check_permission'}</div>
        </div>
      </div>
    </Panel>
  );

  return (
    <AbsoluteFill>
      <KernelCore size={280} left={150} top={400} span={span} />

      {/* 残影：原位淡出的 core 残像（搬家前门禁是内核旁的特权逻辑） */}
      <div
        style={{
          position: 'absolute',
          left: MOVE.from.x,
          top: MOVE.from.y,
          opacity: ghostO * 0.8,
          border: `2px dashed ${theme.core}`,
          borderRadius: 14,
          width: 250,
          height: 92,
          boxSizing: 'border-box',
        }}
      />

      {/* 模块本体：搬家前停在原位（t=0），弹簧起跳后沿弧线滑移；辉光＝咬合脉冲＋钳掉的过冲 */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: module0.opacity}}>
        <div style={{position: 'absolute', left: x, top: y}}>{gateModule(seatGlow + overshoot)}</div>
      </div>

      {/* 执行前插口：首口 [0] mech 描边加粗（落位目标） */}
      <div style={{position: 'absolute', left: 1250, top: 380, opacity: slotsIn}}>
        <Panel accent={theme.mech} style={{width: 420, boxSizing: 'border-box', padding: '16px 22px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 12, paddingBottom: 10, borderBottom: `2px solid ${theme.panelBorder}`}}>
            <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 700, color: theme.text}}>{'执行前'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{'PreToolUse'}</span>
          </div>
          <div
            style={{
              marginTop: 12,
              height: 56,
              borderRadius: 10,
              border: `3px solid ${theme.mech}`,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 16,
              fontFamily: theme.mono,
              fontSize: 22,
              color: theme.mech,
              background: theme.panel,
              boxShadow: `0 0 ${24 * seatGlow}px ${theme.mech}`,
            }}
          >
            {'[0] 首口'}
          </div>
          <div style={{marginTop: 10, height: 48, borderRadius: 10, border: `2px dashed ${theme.panelBorder}`, display: 'flex', alignItems: 'center', paddingLeft: 16, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
            {'[1] …'}
          </div>
          <div style={{marginTop: 10, height: 48, borderRadius: 10, border: `2px dashed ${theme.panelBorder}`, display: 'flex', alignItems: 'center', paddingLeft: 16, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
            {'[2] …'}
          </div>
        </Panel>
      </div>

      {/* 插入脉冲呼应 4-B 的 plug-pulse（咬合瞬间） */}
      <LottieEmphasis
        src="lottie/plug-pulse.json"
        at={seatAt}
        duration={DUR.f6}
        style={{position: 'absolute', left: MOVE.to.x + 125 - 110, top: MOVE.to.y - 64, width: 220, height: 220, opacity: 0.9}}
      />

      {/* 题词：特权 → 第一个插件 */}
      <div
        style={{
          position: 'absolute',
          left: 460,
          top: 250,
          width: 1000,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 46,
          fontWeight: 700,
          opacity: tag,
        }}
      >
        <span style={{color: theme.dim}}>{'特权'}</span>
        <span style={{color: theme.mech}}>{' → '}</span>
        <span style={{color: theme.mech}}>{'第一个插件'}</span>
      </div>

      {/* 末句翻牌：循环内单行代码，点名门禁 → 统一触发（Terminal 承担） */}
      <div style={{position: 'absolute', left: 460, top: 690}}>
        <Terminal
          width={1000}
          height={210}
          title="loop"
          lines={[
            {text: 'check_permission(block)', delay: 10, color: theme.dim, prompt: '-'},
            {text: "trigger_hooks('PreToolUse')", delay: atFlip, color: theme.mech, prompt: '+'},
          ]}
        />
      </div>
      <Footnote delay={seatAt}>{'PreToolUse [0] · check_permission → permission_hook'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-G 三瑕疵账（p4-19..23） ────────────────────────────────────────────

const FLAWS = [
  {zh: '串行短路', en: 'first non-None wins'},
  {zh: '返回值丢弃', en: 'PostToolUse rv dropped'},
  {zh: '注入落差', en: 'print only, none reads'},
] as const;

const ThreeFlaws: React.FC<{atLast: number}> = ({atLast}) => {
  const badge = useEnter('fade', {at: 2, dur: DUR.f4});
  const cards = useStagger(FLAWS.length, {at: 6, stride: 16, dur: DUR.f4});
  // 提示条升起时三卡压暗：账本翻页，焦点交给「不外推」
  const dim = useDim({at: atLast, to: 0.55, dur: DUR.f5});
  const strip = useEnter('fade', {at: atLast, dur: DUR.f5});

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...badge}}>
        <div
          style={{
            position: 'absolute',
            left: 810,
            top: 150,
            padding: '6px 24px',
            borderRadius: 999,
            border: `2px solid ${theme.dim}`,
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.dim,
          }}
        >
          {'教学版'}
        </div>
      </div>

      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: dim}}>
        {FLAWS.map((f, i) => (
          <div
            key={f.zh}
            style={{
              position: 'absolute',
              left: 210 + i * 480,
              top: 320,
              opacity: cards[i],
              transform: `translateY(${(1 - cards[i]) * 20}px)`,
            }}
          >
            <div style={{position: 'relative'}}>
              <NumberedCard index={i + 1} label={f.zh} sub={f.en} active={cards[i] > 0.5} width={420} />
              {/* 逐条打勾：账目核对完一项勾一项 */}
              <div
                style={{
                  position: 'absolute',
                  right: -18,
                  top: -18,
                  width: 52,
                  height: 52,
                  borderRadius: 999,
                  background: theme.panel,
                  border: `3px solid ${cards[i] > 0.6 ? theme.mech : theme.panelBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.sans,
                  fontSize: 30,
                  fontWeight: 700,
                  color: theme.mech,
                  opacity: cards[i] > 0.6 ? 1 : 0.2,
                }}
              >
                {'✓'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 不外推提示条：教学版的账，不算到产品头上 */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...strip}}>
        <div style={{position: 'absolute', left: 460, top: 700}}>
          <Panel
            accent={theme.dim}
            style={{
              width: 1000,
              boxSizing: 'border-box',
              padding: '16px 28px',
              borderStyle: 'dashed',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 18,
            }}
          >
            <span style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.dim}}>{'教学版的账'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'不外推'}</span>
          </Panel>
        </div>
      </div>
      <Footnote delay={6}>{'serial short-circuit · rv dropped · print-only'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 4-H 官方双向对照（p4-25 引子）+ 回落三件（p4-27..29） ────────────────

const CompareIntro: React.FC = () => {
  const left = useEnter('slideL', {at: 2, dur: DUR.f5, dist: 60});
  const right = useEnter('slideR', {at: 2, dur: DUR.f5, dist: 60});
  const clash = useProgress(2 + DUR.f5, DUR.f4);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 330, top: 400, ...left}}>
        <Panel style={{width: 440, boxSizing: 'border-box', padding: '24px 30px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 700, color: theme.text}}>{'教学版'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 8}}>{'串行 · 短路'}</div>
        </Panel>
      </div>
      <div style={{position: 'absolute', left: 1150, top: 400, ...right}}>
        <Panel accent={theme.mech} style={{width: 440, boxSizing: 'border-box', padding: '24px 30px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 700, color: theme.mech}}>{'产品'}</div>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 8}}>{'并行 · 合并'}</div>
        </Panel>
      </div>
      {/* 箭头对张：两张运行图相互对照 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <g opacity={clash}>
          <path d="M830 452 L790 452 M802 444 L790 452 L802 460" fill="none" stroke={theme.dim} strokeWidth={4} />
          <path d="M1090 452 L1130 452 M1118 444 L1130 452 L1118 460" fill="none" stroke={theme.mech} strokeWidth={4} />
          <text x={960} y={462} textAnchor="middle" fontFamily={theme.sans} fontSize={30} fontWeight={700} fill={theme.dim}>
            {'对照'}
          </text>
        </g>
      </svg>
      <Footnote delay={2}>{'All matching hooks run in parallel · deny > defer > ask > allow'}</Footnote>
    </AbsoluteFill>
  );
};

/** p4-27 执行后真实语义：能反馈 / 能改写 */
const PostSemantics: React.FC = () => {
  const card = useEnter('rise', {at: 2, dur: DUR.f5, dist: 30, restBottom: 660});
  const rows = useStagger(2, {at: 2 + DUR.f5, stride: 10, dur: DUR.f4});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...card}}>
        <div style={{position: 'absolute', left: 560, top: 260}}>
          <Panel accent={theme.mech} style={{width: 800, boxSizing: 'border-box', padding: '22px 32px'}}>
            <div style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.text}}>
              {'执行后 · 真实语义'}
            </div>
            {[
              {zh: '能反馈', en: 'feedback'},
              {zh: '能改写', en: 'updatedToolOutput'},
            ].map((r, i) => (
              <div
                key={r.zh}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 16,
                  marginTop: 16,
                  opacity: rows[i],
                  transform: `translateX(${(1 - rows[i]) * 18}px)`,
                }}
              >
                <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.mech}}>{'✓'}</span>
                <span style={{fontFamily: theme.sans, fontSize: 32, color: theme.text}}>{r.zh}</span>
                <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{r.en}</span>
              </div>
            ))}
          </Panel>
        </div>
      </div>
      <Footnote delay={2}>{'PostToolUse: block / updatedToolOutput'}</Footnote>
    </AbsoluteFill>
  );
};

/** p4-28 副作用警示条 + p4-29 退出护栏数字卡 */
const Irreversible: React.FC<{atCap: number}> = ({atCap}) => {
  const warn = useEnter('fade', {at: 2, dur: DUR.f5});
  const capCard = useEnter('rise', {at: atCap, dur: DUR.f5, dist: 34, restBottom: 840});
  const count = useCount({from: 0, to: 8, at: atCap + DUR.f4, dur: DUR.f6});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...warn}}>
        <div style={{position: 'absolute', left: 460, top: 520}}>
          <Panel
            accent={theme.deny}
            style={{width: 1000, boxSizing: 'border-box', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18}}
          >
            <span style={{fontFamily: theme.mono, fontSize: 34, fontWeight: 700, color: theme.deny}}>{'!'}</span>
            <span style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.deny}}>{'副作用 · 不可撤销'}</span>
          </Panel>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...capCard}}>
        <div style={{position: 'absolute', left: 660, top: 660}}>
          <Panel accent={theme.core} style={{width: 600, boxSizing: 'border-box', padding: '20px 32px', textAlign: 'center'}}>
            <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 12}}>
              <span style={{fontFamily: theme.mono, fontSize: 84, fontWeight: 700, color: theme.core, fontVariantNumeric: 'tabular-nums'}}>
                {Math.round(count)}
              </span>
              <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>{'次拽回'}</span>
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 6}}>{'强制收工'}</div>
            <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 8}}>{'stop_hook_active'}</div>
          </Panel>
        </div>
      </div>
      <Footnote delay={atCap}>{'stop_hook_active · 8-cap'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P4HookSockets: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗必须落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p4-01', 'p4-02');
  const bB = w('p4-03', 'p4-06');
  const bC = w('p4-07', 'p4-08');
  const bD = w('p4-09', 'p4-11');
  const bE = w('p4-12', 'p4-15');
  const bF = w('p4-16', 'p4-17');
  const bG = w('p4-19', 'p4-23');
  const bH = w('p4-25', 'p4-29');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="4-A 循环体膨胀">
        <SceneTag chapter="Hooks" tagline="插线口" />
        <BloatRecap atBlur={at('p4-02') - bA.from} />
      </Sequence>

      <Sequence {...bB} name="4-B 插线口母题">
        <SocketMotif
          span={bB.durationInFrames}
          atPlug={at('p4-03') - bB.from + 8}
          seatAt={at('p4-03') - bB.from + 8 + DUR.f4 + DUR.f6}
          atQuote={at('p4-04') - bB.from}
          atAll={at('p4-06') - bB.from}
        />
      </Sequence>

      <Sequence {...bC} name="4-C 四事件口与两函数">
        {/* 3-G denied-receipt（p3-25）之后隔多句空档 → 首章默认入场 */}
        <ArchifyRecap
          slug="hook-channels"
          caption="插线口信道"
          cues={[
            {chapterId: 'four-event-sockets', at: at('p4-07') - bC.from, durationInFrames: dur('p4-07')},
            {chapterId: 'two-functions', at: at('p4-08') - bC.from, durationInFrames: dur('p4-08')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="4-D 返回值唯一信道">
        {/* 4-C 两-function（p4-08）与本镜首章（p4-09）背靠背 → lead={false} */}
        <ArchifyRecap
          slug="hook-channels"
          caption="插线口信道"
          lead={false}
          cues={[
            {chapterId: 'return-channel', at: at('p4-09') - bD.from, durationInFrames: dur('p4-09')},
            {chapterId: 'none-vs-object', at: at('p4-10') - bD.from, durationInFrames: dur('p4-10')},
            {chapterId: 'brake-gas', at: at('p4-11') - bD.from, durationInFrames: dur('p4-11')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="4-E 权限搬家">
        <PermissionMove
          span={bE.durationInFrames}
          atMove={at('p4-12') - bE.from + 8}
          seatAt={at('p4-12') - bE.from + 8 + DUR.f6}
          atTag={at('p4-14') - bE.from}
          atFlip={at('p4-15') - bE.from}
        />
      </Sequence>

      <Sequence {...bF} name="4-F 退出否决">
        {/* 4-D brake-gas（p4-11）之后隔 4-E 自制装置 → 默认入场 */}
        <ArchifyRecap
          slug="stop-veto"
          caption="退出否决"
          cues={[
            {chapterId: 'stop-not-solo', at: at('p4-16') - bF.from, durationInFrames: dur('p4-16')},
            {chapterId: 'message-yank', at: at('p4-17') - bF.from, durationInFrames: dur('p4-17')},
          ]}
        />
      </Sequence>

      <Sequence {...bG} name="4-G 三瑕疵账">
        <ThreeFlaws atLast={at('p4-23') - bG.from} />
      </Sequence>

      <Sequence {...bH} name="4-H 官方并行对照">
        {/* 可见岛 p4-25；窗 = 本镜 1 条 cue 窗 */}
        <ArchifyYield cues={[{at: at('p4-26') - bH.from, durationInFrames: dur('p4-26')}]}>
          <Sequence durationInFrames={dur('p4-25') + DUR.f3}>
            <CompareIntro />
          </Sequence>
        </ArchifyYield>
        {/* 4-F message-yank（p4-17）之后隔 4-G 与 p4-25 空档 → 默认入场 */}
        <ArchifyRecap
          slug="hook-channels"
          caption="插线口信道"
          cues={[{chapterId: 'parallel-merge', at: at('p4-26') - bH.from, durationInFrames: dur('p4-26')}]}
        />
        <Sequence from={at('p4-27') - bH.from} durationInFrames={dur('p4-27')} name="4-H 执行后语义">
          <PostSemantics />
        </Sequence>
        <Sequence from={at('p4-28') - bH.from} name="4-H 副作用与护栏">
          <Irreversible atCap={at('p4-29') - at('p4-28')} />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P4HookSockets;
