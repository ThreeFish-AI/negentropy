/** P0 打烊清台（p0-01..13，3 镜 1 cue）——分镜 0-A…0-C。
 *
 *  cue 清单（1）：
 *   0-C five-layer-dependency/layer-flash@p0-12（立碑一闪；本片首个 archify 实例 → 默认 lead）
 *
 *  ★ 0-A 开场（系列片头铺开，2026-10-08，沿 ep1 先例 0fed97ec5）：五层栈落板/
 *    记忆层点亮职责已由系列片头 components/series-intro.tsx 吸收（压 leadIn 时段）——
 *    scene 侧补灯暗、师傅离场、主问题字卡与角标，常驻条 Badge（BADGE_STYLE top:64）
 *    直接淡入；HarnessStackP0 退役（Badge 顶边带冲突处理随落板一并退役）。
 *  ★ 恒定空间契约自此幕生效：台面（BenchTop，core 橙恒定描边+绝对线宽〔M-001〕）
 *    恒居左中锚位 BENCH = (96, 588)；「会丢的」堆叠动效自上缘压入、向下腾位；
 *    「不能丢的」登记簿自右缘挂入（mech）——两组动效互不侵入对方锚区。
 *  ★ BenchTop 为本集母题首现：形状/描边契约（core 6px 恒定、台腿 coreDeep）以本
 *    文件定义为准，P1/3-C/5-C 复制时逐字同形（scenes 不跨幕 import，同 ep1
 *    Person 先例）。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {DUR, clamp01, useBreathe, useDim, useEnter, useImpulse, useProgress, useStagger} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：与 P1–P6 同值（顶边 y<56 归 frozen ChapterProgress；Integrate 统一核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 人形剪影（师傅 = text 白，人一律无彩） */
const Person: React.FC<{x: number; y: number; color: string; scale?: number; opacity?: number}> = ({
  x,
  y,
  color,
  scale = 1,
  opacity = 0.9,
}) => (
  <svg
    width={120 * scale}
    height={180 * scale}
    viewBox="0 0 120 180"
    style={{position: 'absolute', left: x, top: y, opacity}}
  >
    <circle cx={60} cy={34} r={28} fill={color} />
    <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={color} />
  </svg>
);

// ── 台面母题（本集恒定视觉锚〔M-001〕：core 橙恒定描边 6px，恒左中锚位） ──

/** 台面锚位：svg 左上角（恒左中——P1/3-C/5-C 复制同值，勿动） */
const BENCH = {left: 96, top: 588, w: 820} as const;

/** 台面：顶板（core 6px 恒描边）+ 前挡内面（coreDeep）+ 双腿。物件堆在其上缘。
 *  不变量：stroke 恒 theme.core、strokeWidth 恒 6（绝对像素，不随宽度缩放）——
 *  「台面有限、压缩始终围绕它」靠被看见，调用点不得覆写。 */
const BenchTop: React.FC<{opacity?: number}> = ({opacity = 1}) => (
  <svg width={BENCH.w} height={250} style={{position: 'absolute', left: BENCH.left, top: BENCH.top, opacity}}>
    <rect x={0} y={118} width={BENCH.w} height={92} rx={12} fill={theme.panel} stroke={theme.core} strokeWidth={6} />
    <line x1={18} y1={196} x2={BENCH.w - 18} y2={196} stroke={theme.coreDeep} strokeWidth={3} opacity={0.85} />
    <line x1={78} y1={210} x2={78} y2={246} stroke={theme.coreDeep} strokeWidth={5} />
    <line x1={BENCH.w - 78} y1={210} x2={BENCH.w - 78} y2={246} stroke={theme.coreDeep} strokeWidth={5} />
  </svg>
);

// ── 0-A 打烊清台：五层栈开卷 + 灯暗 + 师傅离场 + 主问题字卡 ───────────────

/** 扳手 glyph（工具，人色系 dim——物件无彩） */
const Wrench: React.FC<{opacity?: number}> = ({opacity = 1}) => (
  <svg width={54} height={54} viewBox="0 0 54 54" style={{opacity}}>
    <circle cx={38} cy={16} r={11} fill="none" stroke={theme.dim} strokeWidth={6} />
    <line x1={30} y1={24} x2={10} y2={44} stroke={theme.dim} strokeWidth={8} strokeLinecap="round" />
  </svg>
);

/** 开卷（片头铺开简化版）：五层展示已在系列片头完成，本组件管工坊夜收工
 *  （灯暗 useDim / 师傅撂下工具离场 / 主问题字卡 useEnter:fall）与常驻条 Badge 淡入。 */
const OpeningNight: React.FC<{durA: number; at02: number; at03: number; at04: number}> = ({
  durA,
  at02,
  at03,
  at04,
}) => {
  // 常驻条：片头渐出后直接淡入（f3 起手 + f4 时长，早于工坊场景）
  const badgeIn = useProgress(DUR.f3, DUR.f4);

  // 工坊场景进场（开镜即起，师傅在右侧干活）
  const sceneIn = useProgress(2, DUR.f4);
  // 灯暗（p0-02「把工坊的灯调暗了看」）：全幅压暗叠层，字卡与其后 chrome 不吃暗
  const dimK = useDim({at: at02 + 4, to: 0, dur: DUR.f5});
  // 师傅撂下工具（p0-02 起，加速下落）＋ 离场步态（跨 p0-02..03，匀速——不加戏）
  const toolFall = useProgress(at02 + 4, DUR.f5, 'accelerate');
  const walk = useProgress(at02 + 10, Math.max(1, at04 - at02 - 10), 'linear');

  // 主问题字卡：p0-03 起（「明天你再进门」），落下进场、句尾自淡出（问号 deny 红点睛）
  const atCard = at03 + 4;
  const card = useEnter('fall', {at: atCard, dur: DUR.f5, dist: 110});
  const cardOut = useProgress(durA - DUR.f5, DUR.f5);
  const q = useImpulse({at: atCard + DUR.f3, dur: DUR.f6, peak: 1});

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* 工坊夜收工：地板线 + 师傅（text 白无彩）撂下工具、走出画面 */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, opacity: sceneIn}}>
        <line x1={980} y1={842} x2={1860} y2={842} stroke={theme.panelBorder} strokeWidth={4} opacity={0.9} />
      </svg>
      <Person x={1150 + walk * 700} y={600} color={theme.text} scale={0.95} opacity={0.92 * sceneIn} />
      <div style={{position: 'absolute', left: 1104, top: 548 + toolFall * 240, opacity: sceneIn}}>
        <Wrench />
      </div>

      {/* 灯暗叠层（压师傅与地板，不压 chrome 与字卡） */}
      <AbsoluteFill style={{background: '#000', opacity: 0.42 * (1 - dimK)}} />

      <HarnessBadge style={{...BADGE_STYLE, opacity: badgeIn}} />

      {/* 主问题字卡（≤6 字形态 + 问号 deny 红点睛；caption 与口播重合 6 字 < 10 安全线） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 748,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 66,
          fontWeight: 700,
          color: theme.text,
          opacity: card.opacity * (1 - cardOut),
          transform: card.transform,
        }}
      >
        <span>{'它还记得什么'}</span>
        <span
          style={{
            color: theme.deny,
            display: 'inline-block',
            transform: `translateY(${-4 * q}px) scale(${1 + 0.1 * q})`,
            textShadow: `0 0 ${26 * q}px ${withAlpha(theme.deny, 0.9)}`,
          }}
        >
          {'？'}
        </span>
      </div>

      <Footnote delay={at02}>{'session end'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 0-B 台面堆满：物件自上缘压入 + 拒收印章 + 大输出条铺满 ────────────────

type PileKind = 'page' | 'bar' | 'bubble';
type PileItem = {kind: PileKind; x: number; y: number; w: number; h: number; tilt: number};

/** 堆叠位次（自下而上）：文件页 / 命令输出条 / 回复气泡交错——全部人色系无彩 */
const PILE: PileItem[] = [
  {kind: 'page', x: 128, y: 640, w: 204, h: 54, tilt: -4},
  {kind: 'bar', x: 366, y: 632, w: 300, h: 46, tilt: 2},
  {kind: 'bubble', x: 692, y: 642, w: 188, h: 50, tilt: 3},
  {kind: 'page', x: 208, y: 574, w: 222, h: 54, tilt: 5},
  {kind: 'bar', x: 472, y: 566, w: 320, h: 46, tilt: -3},
  {kind: 'bubble', x: 158, y: 508, w: 198, h: 50, tilt: -6},
  {kind: 'page', x: 442, y: 500, w: 208, h: 54, tilt: 8},
];

/** 单件物（纯函数渲染——hook 只在 BenchPile 顶层） */
const pileShape = (it: PileItem, p: number) => {
  const common = {
    opacity: p,
    transform: `translateY(${-(1 - p) * 320}px) rotate(${it.tilt}deg)`,
  };
  if (it.kind === 'page') {
    return (
      <div key={`${it.kind}-${it.x}-${it.y}`} style={{position: 'absolute', left: it.x, top: it.y, ...common}}>
        <svg width={it.w} height={it.h}>
          <rect x={1} y={1} width={it.w - 2} height={it.h - 2} rx={4} fill={withAlpha(theme.text, 0.1)} stroke={theme.dim} strokeWidth={2.5} />
          {[14, 26, 38].map((ly) =>
            ly < it.h - 10 ? (
              <line key={ly} x1={12} y1={ly} x2={it.w - 12} y2={ly} stroke={theme.dim} strokeWidth={2} opacity={0.55} />
            ) : null,
          )}
        </svg>
      </div>
    );
  }
  if (it.kind === 'bar') {
    return (
      <div key={`${it.kind}-${it.x}-${it.y}`} style={{position: 'absolute', left: it.x, top: it.y, ...common}}>
        <svg width={it.w} height={it.h}>
          <rect x={1} y={1} width={it.w - 2} height={it.h - 2} rx={6} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2.5} />
          <line x1={12} y1={it.h / 2} x2={it.w - 12} y2={it.h / 2} stroke={theme.dim} strokeWidth={3} strokeDasharray="14 10" />
        </svg>
      </div>
    );
  }
  return (
    <div key={`${it.kind}-${it.x}-${it.y}`} style={{position: 'absolute', left: it.x, top: it.y, ...common}}>
      <svg width={it.w} height={it.h + 12}>
        <rect x={1} y={1} width={it.w - 2} height={it.h - 2} rx={16} fill={withAlpha(theme.dim, 0.08)} stroke={theme.dim} strokeWidth={2.5} />
        <line x1={18} y1={it.h / 2} x2={it.w - 18} y2={it.h / 2} stroke={theme.dim} strokeWidth={2} opacity={0.6} />
        <path d={`M${it.w / 2 - 8} ${it.h - 2} L${it.w / 2 + 8} ${it.h - 2} L${it.w / 2} ${it.h + 10} Z`} fill={withAlpha(theme.dim, 0.08)} stroke={theme.dim} strokeWidth={2} />
      </svg>
    </div>
  );
};

const BenchPile: React.FC<{at06: number; at07: number; at08: number}> = ({at06, at07, at08}) => {
  const benchIn = useProgress(2, DUR.f4);
  // 堆叠逐层压入（p0-05..06 句内完成；自上缘落下）
  const drops = useStagger(PILE.length, {at: 6, stride: 7, dur: DUR.f4});
  // 红色印章「提示太长」盖下（p0-07 拒收句）+ 红闪
  const stamp = useEnter('fall', {at: at07, dur: DUR.f4, dist: 90});
  const flash = useImpulse({at: at07 + DUR.f3, dur: DUR.f5, peak: 1});
  // 大输出条横占整幅台面（p0-08）
  const bigP = useProgress(at08 + 2, DUR.f5, 'decelerate');
  const bigW = Math.round(140 + 624 * bigP);
  const tagIn = useProgress(at06 - DUR.f3, DUR.f4);

  return (
    <AbsoluteFill>
      {/* 台面母题首现（恒左中锚位，core 恒描边〔M-001〕） */}
      <BenchTop opacity={benchIn} />
      {/* 堆叠物（无彩：page=text 系 / bar=panel / bubble=dim） */}
      <div style={{opacity: benchIn}}>{PILE.map((it, i) => pileShape(it, drops[i]))}</div>

      {/* 角标 messages（API 口径的堆总名） */}
      <div
        style={{
          position: 'absolute',
          left: 104,
          top: 236,
          fontFamily: theme.mono,
          fontSize: 20,
          color: theme.dim,
          opacity: tagIn,
          letterSpacing: 1,
        }}
      >
        {'messages'}
      </div>

      {/* 大输出条：横占整幅台面（p0-08 读一个大文件）。先于印章渲染——p0-08 起
          印章盖在条上（「装不下→拒收」因果同帧可读），勿把印章压回条下层
          （复核修复：原序副标被框缘截半悬空）。 */}
      <div
        style={{
          position: 'absolute',
          left: 116,
          top: 396,
          width: bigW,
          height: 104,
          borderRadius: 8,
          background: theme.panel,
          border: `3px solid ${theme.panelBorder}`,
          opacity: bigP,
          padding: '14px 18px',
          boxSizing: 'border-box',
        }}
      >
        <svg width={bigW - 36} height={72}>
          {[14, 32, 50, 68].map((ly) => (
            <line
              key={ly}
              x1={0}
              y1={ly}
              x2={(bigW - 36) * (0.55 + 0.4 * ((ly % 36) / 36))}
              y2={ly}
              stroke={ly === 68 ? theme.dim : theme.text}
              strokeWidth={3}
              opacity={ly === 68 ? 0.4 : 0.16}
            />
          ))}
        </svg>
      </div>

      {/* 拒收印章：盖在堆右上（deny——拒绝唯一语义），z 序在输出条之上 */}
      <div
        style={{
          position: 'absolute',
          left: 560,
          top: 428,
          opacity: stamp.opacity,
          transform: `rotate(-9deg) ${stamp.transform}`,
        }}
      >
        <div
          style={{
            border: `4px solid ${theme.deny}`,
            borderRadius: 10,
            padding: '10px 22px',
            background: withAlpha(theme.deny, 0.08 * (0.4 + flash)),
            boxShadow: `0 0 ${26 * flash}px ${withAlpha(theme.deny, 0.8 * flash)}`,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 700, color: theme.deny}}>{'提示太长'}</span>
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.deny, marginTop: 8, textAlign: 'center', opacity: 0.8}}>
          {'prompt_too_long'}
        </div>
      </div>

      <Footnote delay={at08}>{'tool_result ≤ 500KB'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 0-C 两本账预告：右缘挂入双剪影 + 立碑一闪 + 碑卡定格 ──────────────────

/** 收台剪影 glyph：三层条子被逐层清走（mech 描边） */
const SweepGlyph: React.FC<{color: string}> = ({color}) => (
  <svg width={120} height={96} viewBox="0 0 120 96">
    <rect x={8} y={64} width={104} height={13} rx={3} fill="none" stroke={color} strokeWidth={4} />
    <rect x={30} y={42} width={72} height={13} rx={3} fill="none" stroke={color} strokeWidth={4} opacity={0.8} transform="translate(10 -4) rotate(-4 66 48)" />
    <rect x={52} y={20} width={44} height={13} rx={3} fill="none" stroke={color} strokeWidth={4} opacity={0.6} transform="translate(20 -8) rotate(-9 74 26)" />
    <path d="M96 78 Q112 60 108 40" fill="none" stroke={color} strokeWidth={3} strokeDasharray="6 6" opacity={0.7} />
  </svg>
);

/** 登记簿剪影 glyph：册子 + 书脊 + 页行（mech 描边） */
const LedgerGlyph: React.FC<{color: string}> = ({color}) => (
  <svg width={120} height={96} viewBox="0 0 120 96">
    <rect x={14} y={10} width={92} height={76} rx={7} fill="none" stroke={color} strokeWidth={4} />
    <line x1={32} y1={10} x2={32} y2={86} stroke={color} strokeWidth={4} />
    {[30, 46, 62, 74].map((ly) => (
      <line key={ly} x1={44} y1={ly} x2={94} y2={ly} stroke={color} strokeWidth={3} opacity={0.65} />
    ))}
  </svg>
);

const BookCard: React.FC<{
  y: number;
  glow: number;
  enter: {opacity: number; transform: string};
  zh: string;
  en: string;
  glyph: React.ReactNode;
}> = ({y, glow, enter, zh, en, glyph}) => (
  <div style={{position: 'absolute', left: 1420, top: y, ...enter}}>
    <Panel
      accent={theme.mech}
      style={{
        width: 320,
        boxSizing: 'border-box',
        padding: '18px 24px',
        boxShadow: `0 0 ${18 * glow}px ${withAlpha(theme.mech, 0.45 * glow)}`,
      }}
    >
      <div style={{height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{glyph}</div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10}}>
        <span style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.mech}}>{zh}</span>
        <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>{en}</span>
      </div>
    </Panel>
  </div>
);

const TwoBooks: React.FC<{at10: number}> = ({at10}) => {
  const benchIn = useProgress(2, DUR.f4);
  // 两剪影自右缘挂入（mech ×2，不触碰左中 core 台面锚位）
  const hang0 = useEnter('slideR', {at: at10 + 6, dur: DUR.f5, dist: 80});
  const hang1 = useEnter('slideR', {at: at10 + 16, dur: DUR.f5, dist: 80});
  // 常驻辉光（mech，相位错峰）
  const glow0 = useBreathe({period: 46, amp: 0.4, base: 0.6});
  const glow1 = useBreathe({period: 46, amp: 0.4, base: 0.6, offset: 23});
  return (
    <AbsoluteFill>
      <BenchTop opacity={0.92 * benchIn} />
      <BookCard y={300} glow={glow0} enter={hang0} zh="会丢的" en="lossy" glyph={<SweepGlyph color={theme.mech} />} />
      <BookCard y={556} glow={glow1} enter={hang1} zh="不能丢的" en="ledger" glyph={<LedgerGlyph color={theme.mech} />} />
    </AbsoluteFill>
  );
};

/** 碑卡定格（p0-13 悬念态）：衬底 scrim + 衬线主字 + 右下小字。
 *  caption-dup-ok：金句卡压短形态（分镜金句卡三张之一，豁免在案）。 */
const SteleSuspense: React.FC = () => {
  const o = useProgress(DUR.f2, DUR.f4);
  const note = useProgress(DUR.f4 + 10, DUR.f4);
  return (
    <AbsoluteFill style={{background: withAlpha(theme.bg, 0.9 * o), pointerEvents: 'none'}}>
      <QuoteCard zh="记忆不是一个功能" />
      <div
        style={{
          position: 'absolute',
          right: 190,
          bottom: 208,
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.dim,
          letterSpacing: 2,
          opacity: note,
        }}
      >
        {'等两本账翻完'}
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P0MemoryHook: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p0-01', 'p0-04');
  const bB = w('p0-05', 'p0-09');
  const bC = w('p0-10', 'p0-13');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 打烊清台·五层栈（3D）">
        <SceneTag chapter="Memory Hook" tagline="打烊清台" />
        <OpeningNight
          durA={bA.durationInFrames}
          at02={at('p0-02') - bA.from}
          at03={at('p0-03') - bA.from}
          at04={at('p0-04') - bA.from}
        />
      </Sequence>

      <Sequence {...bB} name="0-B 台面堆满">
        <HarnessBadge style={BADGE_STYLE} />
        <BenchPile at06={at('p0-06') - bB.from} at07={at('p0-07') - bB.from} at08={at('p0-08') - bB.from} />
      </Sequence>

      <Sequence {...bC} name="0-C 两本账预告">
        <HarnessBadge style={BADGE_STYLE} />
        {/* 可见岛 p0-10..11 / p0-13（碑卡）；窗 = 本镜 1 条 cue 窗 */}
        <ArchifyYield cues={[{at: at('p0-12') - bC.from, durationInFrames: dur('p0-12')}]}>
          <TwoBooks at10={at('p0-10') - bC.from} />
          <Sequence from={at('p0-13') - bC.from} durationInFrames={dur('p0-13')} name="0-C 碑卡定格">
            <SteleSuspense />
          </Sequence>
        </ArchifyYield>
        {/* cue 1/1：five-layer-dependency/layer-flash（立碑一闪；本片首个实例 → 默认 lead） */}
        <ArchifyRecap
          slug="five-layer-dependency"
          caption="五层依赖"
          cues={[{chapterId: 'layer-flash', at: at('p0-12') - bC.from, durationInFrames: dur('p0-12')}]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0MemoryHook;
