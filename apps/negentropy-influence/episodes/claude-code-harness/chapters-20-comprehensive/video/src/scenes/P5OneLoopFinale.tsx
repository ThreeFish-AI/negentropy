/** P5 收束：循环一个（p5-01..p5-09，5 镜）——分镜 5-A / 5-B / 5-C / 5-D / 5-E。
 *
 *  幕间转场（4-D→5-A，头注明示）：语义断裂（消融裁决→终态定格）走 SceneFade，
 *  环体同形签名回归（承 ep2/ep19 判例）。终章特例：无下期卡（收尾不预告，
 *  综合回合挂回同一循环收束全系列——5-D 回环长镜头 + 5-E 署源卡收束）。
 *
 *  叙事链：5-A 环体终态定格收束：p5-01「十八条全绿」词落位跑条 18 格逐格
 *  点亮全绿定格（数字镜：18 格逐格可数）＋日志行数滚动定格、「本地原型」词
 *  落位口径字幕亮〔M-005〕；p5-02「机制很多，循环一个」词落位跑条整条退役
 *  淡出〔M-006〕、金句卡淡入定格（衬线体，重音镜——系列收官金句；caption-dup-ok
 *  豁免登记承 storyboard 5-A 行）、「很多」「一个」两词压拍重读排版；p5-03
 *  「芯子始终是那四句」词落位金句卡侧移半格、环体剖面主位亮出——设施层环绕
 *  中细线中线四拍节拍签微光逐一确认（芯子＝四句的剖面陈述）〔M-003〕→ 5-B
 *  对照帧（单句镜）：p5-04「复杂的不是另一个大脑」词落位左大脑卡亮出且全程
 *  静止〔M-002〕（静止＝没变复杂的具象）、「是外围那圈设施」词落位指向签自
 *  大脑卡划向环体剖面、剖面设施层增亮一拍（复杂所在位移的可视，misconception
 *  破除帧）〔M-005〕、「成熟 Harness 的复杂」词落位剖面底「成熟 Harness」
 *  小签落定（口播例外词随签）→ 5-C 分工铭牌特写（单句镜，承 ep1 铭牌形态系列
 *  回扣）：p5-05「模型管判断」词落位上行铭牌落定〔M-005〕、「它管组织」词落位
 *  下行铭牌落定、「各干各的，谁也不抢谁的活」词落位分工界线亮起贯通＋两行各
 *  闪一拍（互不越界的定格，重音镜收拍）〔M-003〕→ 5-D 回环长镜头（终章仪式
 *  双拍——回 0-A 开篇构图）：p5-06「终点回头望」词落位五段组弧自第一段起
 *  依次全亮（五大组进度全亮——系列收官仪式，视觉层：组名与集数序号均不上屏）
 *  〔M-005〕、「最初那声心跳」词落位环体中线心跳脉冲一拍（心跳意象首扣）、
 *  「一路没停」词落位四拍字卡逐一亮起（四签沿 0-B 同序复亮——首尾同签回扣）；
 *  p5-07「没有下期了」词落位画面净空一拍（无下期卡——空白即陈述，终章特例）
 *  〔M-002〕、「工具还会再长」词落位收点周围极淡设施微光缓增一圈（生长感
 *  ——不实化具体工具形态）、「循环还是那一个」词落位环体收成一枚点、脉冲
 *  一次定格（开篇心跳回扣终帧，重音镜——全片最后动效事件）〔M-003〕→ 5-E
 *  片尾署源卡：卡片随 p5-08 口播同拍淡入、两行先后落定（署源专名口播例外
 *  随行）；p5-09 期间卡片静持（漂移警示由口播承载，卡面零复述），全片在此
 *  卡收束（黑场前最后画面）。
 *
 *  空间契约（安全带实算）：5-A 跑条 250..390 / 金句卡 470..580 / 剖面
 *  560..860 底 860；5-B 大脑卡 290..680 底 680 / 剖面 340..640 / 小签底 ≤ 740；
 *  5-C 铭牌两行 400..612 底 612 / 背景退暗层 ≤ 760；5-D 环体组 150..750 /
 *  while True 卡 240..450 / 四签 ≤ 634 / 收点脉冲 ≤ 770；5-E 署源卡居中
 *  ——全部 ≤ 860、装置 y ≥ 240（5-E 除外）。红线落实：跑条 18 格与口播一致、
 *  金句卡为唯一衬线体主体、剖面＝设施层环绕细线（复杂在外围的终态构图）、
 *  剖面里第二中线禁（循环一个）、格数不越 18、跑条与金句卡退役制不同帧抢焦、
 *  大脑卡灰且零动效（静＝陈述）、指向签单向（大脑→外围）、剖面与 5-A 同形
 *  （镜间身份恒常）、铭牌两行等宽对仗、界线单一贯通、铭牌 ≤6 字/行、组弧为
 *  进度语义五段零文字（反串线）、四签与 0-B 同形同序（首尾回扣）、下期卡或
 *  任何预告元素禁（终章无下期）、微光不实化具体工具形态、脉冲一次（一次即
 *  心跳回扣）、署源卡为最后画面且卡面 ≤3 行信息、字号不低于可读阈值。词落位
 *  = wa(id,f)；尾幕渐黑窗 = 末镜总时长。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {BeatTag, CrossSection, GroupArcs, LoopRing, PairCard, Panel, SelfTestBar, WhileTrueCard, ease} from '../components/motifs';
import {DUR, clamp01, progress, useEnter, useFadeOut, useProgress} from '../motion';

const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 四签（0-B 建锚 / 5-D 回扣——同签同形同序） */
const BEAT_LABELS = ['调模型', '看响应', '有就执行', '结果回填'] as const;

// ── 5-A 终态定格：自检跑条 → 收官金句 → 环体剖面 ───────────────────────────

const FiveA: React.FC<{atCells: number; atLog: number; atCap: number; atRetire: number; atQuote: number; atKw: number; atShift: number; atSection: number}> = ({
  atCells,
  atLog,
  atCap,
  atRetire,
  atQuote,
  atKw,
  atShift,
  atSection,
}) => {
  const frame = useCurrentFrame();
  // 18 格断言逐格点亮（离散——Math.round 先行）+ 日志行数滚动定格
  const cellP = ease(clamp01(progress(frame, atCells, 34)));
  const n = Math.min(18, Math.round(cellP * 18));
  const cellLits = Array.from({length: 18}, (_, i) => (i < n ? 1 : 0));
  const logP = ease(clamp01(progress(frame, atLog, 40)));
  const logN = Math.round(logP * 128);
  const cap = clamp01(progress(frame, atCap, 12));
  const retire = clamp01(progress(frame, atRetire, 16));
  // 金句卡（衬线体唯一主体——系列收官金句）+ 两词压拍重读
  const quote = clamp01(progress(frame, atQuote, 16));
  const kw = Math.sin(Math.PI * clamp01(progress(frame, atKw, 20)));
  // 金句卡侧移半格 + 剖面主位亮出（四拍逐一确认）
  const shift = ease(clamp01(progress(frame, atShift, 18)));
  const section = clamp01(progress(frame, atSection, 14));
  const beatPs = [0, 1, 2, 3].map((k) => clamp01(progress(frame, atSection + 6 + k * 7, 10)));
  return (
    <AbsoluteFill>
      {/* 自检跑条（先行驻屏——跑条退役后环体定格主位） */}
      <SelfTestBar x={510} y={250} w={900} cellLits={cellLits} logN={logN} capP={cap} retireP={retire} />
      {/* 金句卡（唯一衬线体主体；「很多」「一个」压拍重读排版——zIndex 压过剖面辉光防笔触穿卡） */}
      <div style={{position: 'absolute', left: 410 + shift * 230, top: 470, width: 1100, opacity: quote, zIndex: 2}}>
        {/* caption-dup-ok: 金句卡复述收束句（收束定格仪式，承系列 5-A 豁免先例） */}
        <Panel accent={withAlpha(theme.core, 0.55)} style={{padding: '26px 40px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.serif, fontSize: 44, color: theme.text, whiteSpace: 'nowrap'}}>
            <span style={{fontWeight: 700, color: theme.merge, display: 'inline-block', transform: `scale(${1 + 0.06 * kw})`}}>机制很多</span>
            <span>{' · '}</span>
            <span style={{fontWeight: 700, color: theme.core, display: 'inline-block', transform: `scale(${1 + 0.08 * kw})`}}>循环一个</span>
          </div>
        </Panel>
      </div>
      {/* 环体剖面（设施层环绕细线循环——复杂在外围的终态构图；四拍逐一确认） */}
      <div style={{position: 'absolute', left: 0, top: 0, opacity: section * (shift > 0.4 ? 1 : 0)}}>
        <CrossSection cx={960 - shift * 230} cy={710} size={220} facilityP={section} beatPs={beatPs} />
      </div>
    </AbsoluteFill>
  );
};

// ── 5-B 对照帧：大脑卡（灰·静止）↔ 环体剖面（承 5-A 末态同形） ──────────────

const FiveB: React.FC<{atBrain: number; atPoint: number; atHot: number; atSign: number}> = ({atBrain, atPoint, atHot, atSign}) => {
  const frame = useCurrentFrame();
  const brain = clamp01(progress(frame, atBrain, 14));
  // 指向签（单向：大脑→外围）+ 剖面设施层增亮一拍
  const point = ease(clamp01(progress(frame, atPoint, 16)));
  const hot = Math.sin(Math.PI * clamp01(progress(frame, atHot, 14)));
  const sign = clamp01(progress(frame, atSign, 12));
  return (
    <AbsoluteFill>
      {/* 左：大脑卡（灰色·静止——无新器官生长；亮出后零动效＝没变复杂的具象） */}
      <div style={{position: 'absolute', left: 190, top: 290, opacity: brain}}>
        <PairCard x={0} y={0} w={580} h={390} litP={brain}>
          <svg width={520} height={300} viewBox="0 0 520 300" style={{position: 'absolute', left: 30, top: 0}}>
            {/* 大脑剪影（灰调静止——两条对称叶 + 静态褶皱线，零动效） */}
            <path
              d="M 260 40 C 200 40 160 80 160 130 C 130 145 118 180 130 210 C 118 240 150 268 190 260 C 210 276 250 270 260 250 C 270 270 310 276 330 260 C 370 268 402 240 390 210 C 402 180 390 145 360 130 C 360 80 320 40 260 40 Z"
              fill={withAlpha(theme.dim, 0.16)}
              stroke={theme.dim}
              strokeWidth={4}
              opacity={0.85}
            />
            <path d="M 260 52 C 240 90 266 120 248 160 C 236 190 262 210 254 244" fill="none" stroke={withAlpha(theme.dim, 0.6)} strokeWidth={3} strokeLinecap="round" />
            <path d="M 300 60 C 288 96 312 124 296 158" fill="none" stroke={withAlpha(theme.dim, 0.5)} strokeWidth={2.5} strokeLinecap="round" />
            <path d="M 220 66 C 210 100 232 130 218 164" fill="none" stroke={withAlpha(theme.dim, 0.5)} strokeWidth={2.5} strokeLinecap="round" />
          </svg>
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 10, textAlign: 'center', fontFamily: theme.sans, fontSize: 18, fontWeight: 700, color: theme.dim, whiteSpace: 'nowrap', opacity: brain}}>
            另一个大脑？· 没长
          </div>
        </PairCard>
      </div>
      {/* 指向签（大脑→外围——复杂所在位移的可视） */}
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <g opacity={point}>
          <line x1={800} y1={480} x2={800 + point * 330} y2={480} stroke={theme.text} strokeWidth={4} strokeLinecap="round" />
          <path d={`M ${1130 * point + 800 * (1 - point)} 480 l -18 -10 M ${1130 * point + 800 * (1 - point)} 480 l -18 10`} stroke={theme.text} strokeWidth={4} strokeLinecap="round" fill="none" />
        </g>
      </svg>
      {/* 右：环体剖面（承 5-A 末态同形——镜间身份恒常；设施层增亮一拍） */}
      <CrossSection cx={1370} cy={470} size={220} litP={brain} facilityP={1} hotP={hot} beatPs={[1, 1, 1, 1]} />
      {/* 「成熟 Harness」小签（口播例外词随签） */}
      {sign > 0.02 ? (
        <div
          style={{
            position: 'absolute',
            left: 1258,
            top: 656,
            padding: '5px 18px',
            borderRadius: 10,
            border: `2.5px solid ${withAlpha(theme.dim, 0.4 + 0.6 * sign)}`,
            background: withAlpha(theme.panel, 0.98),
            fontFamily: theme.sans,
            fontSize: 18,
            fontWeight: 700,
            color: theme.text,
            whiteSpace: 'nowrap',
            opacity: sign,
            transform: `translateY(${(1 - sign) * 12}px)`,
          }}
        >
          成熟 Harness
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ── 5-C 分工铭牌：模型 = 判断 / 程序 = 组织（承 ep1 铭牌形态系列回扣）─────────

const FiveC: React.FC<{atTop: number; atBottom: number; atLine: number}> = ({atTop, atBottom, atLine}) => {
  const frame = useCurrentFrame();
  const top = ease(clamp01(progress(frame, atTop, 14)));
  const bottom = ease(clamp01(progress(frame, atBottom, 14)));
  const line = clamp01(progress(frame, atLine, 12));
  const flash = Math.sin(Math.PI * clamp01(progress(frame, atLine + 6, 14)));
  const plate = (y: number, p: number, label: string) => (
    <div
      style={{
        position: 'absolute',
        left: 610,
        top: y + (1 - p) * -26,
        width: 700,
        height: 96,
        borderRadius: 14,
        border: `4px solid ${p > 0.4 ? theme.dim : withAlpha(theme.dim, 0.4)}`,
        background: withAlpha(theme.panel, 0.96),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.serif,
        fontSize: 38,
        fontWeight: 700,
        color: theme.text,
        letterSpacing: 6,
        whiteSpace: 'nowrap',
        opacity: p,
        transform: `scale(${1 + 0.03 * flash})`,
      }}
    >
      {label}
    </div>
  );
  return (
    <AbsoluteFill>
      {/* 背景对照帧退暗层（5-B 末态压暗——焦点让位铭牌） */}
      <div style={{position: 'absolute', inset: 0, opacity: 0.22}}>
        <CrossSection cx={1370} cy={470} size={220} litP={1} facilityP={1} beatPs={[1, 1, 1, 1]} />
      </div>
      {plate(400, top, '模型 = 判断')}
      {plate(560, bottom, '程序 = 组织')}
      {/* 分工界线（单一贯通——互不越界的定格） */}
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
        <line x1={460} y1={528} x2={460 + 1000 * line} y2={528} stroke={theme.core} strokeWidth={5} strokeLinecap="round" opacity={0.8} />
      </svg>
    </AbsoluteFill>
  );
};

// ── 5-D 回环长镜头：五段组弧 + 心跳脉冲 + 四拍字卡回扣 + 收点终帧 ─────────────

/** 5-D 环体全局位（回 0-A 开篇构图）：环心 (960,450)、size 460 */
const RD = {x: 730, y: 220, size: 460} as const;
const RD_C = {cx: 960, cy: 450} as const;

const FiveD: React.FC<{atArcs: number; atHeart: number; atTags: number; atClear: number; atGrow: number; atCollapse: number}> = ({
  atArcs,
  atHeart,
  atTags,
  atClear,
  atGrow,
  atCollapse,
}) => {
  const frame = useCurrentFrame();
  // 五段组弧自第一段起依次全亮（五大组进度全亮——零文字零序号）
  const arcLits = [0, 1, 2, 3, 4].map((k) => clamp01(progress(frame, atArcs + k * 7, 10)));
  // 心跳脉冲一拍（impulse 锁存——sin 包络）
  const heart = Math.sin(Math.PI * clamp01(progress(frame, atHeart, 16)));
  // 四拍字卡（while True 代码剪影为底 + 四签沿 0-B 同序复亮）
  const tagLits = [0, 1, 2, 3].map((k) => clamp01(progress(frame, atTags + k * 7, 10)));
  const lineLits = tagLits;
  // 画面净空一拍（无下期卡——空白即陈述）
  const clear = clamp01(progress(frame, atClear, 14));
  // 收点周围极淡设施微光缓增一圈（生长感——不实化具体工具形态）
  const grow = clamp01(progress(frame, atGrow, 24));
  // 环体收成一枚点、脉冲一次定格（全片最后动效事件）
  const collapse = ease(clamp01(progress(frame, atCollapse, 22)));
  const pulse = Math.sin(Math.PI * clamp01(progress(frame, atCollapse + 18, 16)));
  const ringScale = (1 + 0.045 * heart) * (1 - collapse * 0.955);
  const stay = 1 - clear;
  return (
    <AbsoluteFill>
      {/* 环体（回开篇构图——细线四拍；组弧环绕；随净空与收点渐隐） */}
      <div
        style={{
          position: 'absolute',
          left: RD.x,
          top: RD.y,
          width: RD.size,
          height: RD.size,
          transform: `scale(${ringScale})`,
          transformOrigin: '50% 50%',
          opacity: (1 - collapse * 0.35) * stay,
        }}
      >
        <LoopRing size={RD.size} nodes={[]} showExit={false} dotProgress={(frame / 96) % 1} />
      </div>
      {/* 心跳脉冲辉光（中线一拍） */}
      {heart > 0.05 ? (
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <circle cx={RD_C.cx} cy={RD_C.cy} r={(RD.size / 2 - 46) * (1 + 0.045 * heart)} fill="none" stroke={theme.core} strokeWidth={26} opacity={0.2 * heart} />
        </svg>
      ) : null}
      {/* 五段组弧（承片头五进度点形态——进度语义五段，零文字） */}
      <div style={{position: 'absolute', inset: 0, opacity: stay}}>
        <GroupArcs cx={RD_C.cx} cy={RD_C.cy} r={300} arcLits={arcLits} />
      </div>
      {/* 四拍字卡位（while True 代码框剪影为底 + 四枚节拍签——首尾同签回扣） */}
      <div style={{position: 'absolute', inset: 0, opacity: stay}}>
        <WhileTrueCard x={1300} y={240} w={380} h={210} litP={1} lineLits={lineLits} />
        {BEAT_LABELS.map((label, k) => {
          const pos = [
            {x: 1410, y: 540},
            {x: 1660, y: 540},
            {x: 1410, y: 620},
            {x: 1660, y: 620},
          ][k];
          return <BeatTag key={`dt${k}`} x={pos.x} y={pos.y} label={label} litP={tagLits[k]} w={230} />;
        })}
      </div>
      {/* 收点周围极淡设施微光（生长感一圈——不实化） */}
      {grow > 0.02 && collapse < 0.4 ? (
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <circle cx={RD_C.cx} cy={RD_C.cy} r={90 + grow * 190} fill="none" stroke={withAlpha(theme.merge, 0.35)} strokeWidth={30} opacity={0.3 * grow} />
          <circle cx={RD_C.cx} cy={RD_C.cy} r={90 + grow * 190} fill="none" stroke={withAlpha(theme.merge, 0.5)} strokeWidth={2.5} opacity={0.5 * grow} />
        </svg>
      ) : null}
      {/* 收点（环体收成一枚点——脉冲一次定格，开篇心跳回扣终帧） */}
      {collapse > 0.3 ? (
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <circle cx={RD_C.cx} cy={RD_C.cy} r={13 + 10 * pulse} fill={theme.core} opacity={1} />
          {pulse > 0.05 ? <circle cx={RD_C.cx} cy={RD_C.cy} r={26 + 44 * pulse} fill="none" stroke={theme.core} strokeWidth={3} opacity={0.6 * pulse} /> : null}
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};

// ── 5-E 片尾署源卡（尾部署源位——豁免登记于工作区配置） ────────────────────────

const CreditCard: React.FC<{atCard: number; durCard: number}> = ({atCard, durCard}) => {
  // 卡随 p5-08 口播同拍淡入；两行先后落定（署源专名口播例外随行）
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
      <Panel accent={withAlpha(theme.merge, 0.4)} style={{position: 'relative', padding: '46px 64px', textAlign: 'center'}}>
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

/** 幕末渐黑（红线四）：窗 = 末镜总时长（p5-08..p5-09 之和），终点即本幕终点 */
const FadeTail: React.FC<{span: number}> = ({span}) => {
  const keep = useFadeOut(span, {frames: 36});
  return <AbsoluteFill style={{background: '#000', opacity: 1 - keep, pointerEvents: 'none'}} />;
};

// ── 幕入口 ──────────────────────────────────────────────────────────────

export const P5OneLoopFinale: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const span = (id: string) => w(id).durationInFrames;
  const wa = (id: string, f: number) => at(id) + Math.round(span(id) * f);

  const bA = w('p5-01', 'p5-03');
  const bB = w('p5-04');
  const bC = w('p5-05');
  const bD = w('p5-06', 'p5-07');
  const bE = w('p5-08', 'p5-09');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="5-A">
        <FiveA
          atCells={wa('p5-01', 0.14) - bA.from}
          atLog={wa('p5-01', 0.2) - bA.from}
          atCap={wa('p5-01', 0.66) - bA.from}
          atRetire={wa('p5-02', 0.2) - bA.from}
          atQuote={wa('p5-02', 0.3) - bA.from}
          atKw={wa('p5-02', 0.55) - bA.from}
          atShift={wa('p5-03', 0.3) - bA.from}
          atSection={wa('p5-03', 0.42) - bA.from}
        />
      </Sequence>
      <Sequence {...bB} name="5-B">
        <FiveB atBrain={wa('p5-04', 0.12) - bB.from} atPoint={wa('p5-04', 0.48) - bB.from} atHot={wa('p5-04', 0.56) - bB.from} atSign={wa('p5-04', 0.8) - bB.from} />
      </Sequence>
      <Sequence {...bC} name="5-C">
        <FiveC atTop={wa('p5-05', 0.16) - bC.from} atBottom={wa('p5-05', 0.46) - bC.from} atLine={wa('p5-05', 0.76) - bC.from} />
      </Sequence>
      <Sequence {...bD} name="5-D">
        <FiveD
          atArcs={wa('p5-06', 0.12) - bD.from}
          atHeart={wa('p5-06', 0.42) - bD.from}
          atTags={wa('p5-06', 0.7) - bD.from}
          atClear={wa('p5-07', 0.08) - bD.from}
          atGrow={wa('p5-07', 0.42) - bD.from}
          atCollapse={wa('p5-07', 0.72) - bD.from}
        />
      </Sequence>
      <Sequence {...bE} name="5-E">
        <CreditCard atCard={at('p5-08') - bE.from} durCard={span('p5-08')} />
        {/* 幕末渐黑：最后子节点，盖过署源卡（全片最后画面在此收束） */}
        <FadeTail span={bE.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P5OneLoopFinale;
