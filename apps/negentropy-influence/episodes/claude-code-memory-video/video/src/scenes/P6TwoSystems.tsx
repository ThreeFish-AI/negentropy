/** P6 两套机制（p6-01..21，4 镜 9 cue）——分镜 6-A…6-D。
 *
 *  cue 清单（9）：
 *   6-A memory-panorama/evolved-hint@p6-03 / roads-closed@p6-05（实例一，默认 lead）
 *   6-B memory-panorama/answer-panorama@p6-08 / lossy-side@p6-09 / ledger-side@p6-11
 *      / two-clamps@p6-13 / vow-cashed@p6-14（实例二；与实例一隔 p6-06..07 两句
 *      空窗——分镜「空窗后重现保持默认 lead」清单在案，lead={false} 会让画框
 *      全不透明一帧瞬现，见 ArchifyRecap 契约）
 *   6-D five-layer-dependency/read-two-books@p6-18 / two-dark-zones@p6-19
 *      （跨幕实例二；P0 0-C 实例隔全片 → 默认 lead，同口径）
 *
 *  ★ 6-B 的 3D 栈由 components/harness-stack.tsx 的 HarnessStackP6 承担
 *    （放大/层点亮全在其内）；scene 侧只补系列标语、两处空窗侧标注与碑兑现。
 *    下期层呼吸预告归 6-D 下期卡——本镜呼吸锚推到镜外恒不触发。
 *  ★ 6-B p6-14 碑兑现金句卡：叠在 vow-cashed cue 窗后段定格（先让画框入场
 *    约 7 帧再由衬线记忆点接管，ep1 AnswerQuote 同款口径；工单点名的收束前
 *    P6 金句卡即此——主字压短「两套咬合的机制」，重合 7 字 < 10 安全线）。
 *  ★ 6-D 系列身份卡/下期卡：标题主段是 check_series 规则 8 的受检硬编码——
 *    本集「会丢的和不能丢的」＋下集「一张回执和四层钟」（改标题先改 series.json
 *    再同步此串）；层名/下期层名走 series-layers.json 数据（NEXT_LAYER）。
 *  ★ 工坊地图开灯口径：lit = 层 index ≤ 本集——口播 p6-19「两个区没开灯」的
 *    画面契约（published 数据在生产中段尚未就位；发布时两口径收敛同值）。
 *  ★ 空间契约：6-B/6-D 为系列装置镜（3D 栈/工坊地图居左、卡片居右），
 *    6-C 天平对称悬停。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {Pill, QuoteCard} from '../components/cards';
import {
  ACTIVE_INDEX,
  HarnessBadge,
  HarnessStackP6,
  LAYERS,
  NEXT_LAYER,
  PlateSlab3D,
} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {
  DUR,
  clamp01,
  progress,
  useBreathe,
  useDim,
  useEnter,
  useFadeOut,
  useProgress,
  useStagger,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：与 P0–P5 同值（顶边 y<56 归 frozen ChapterProgress；Integrate 统一核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 6-A 演进彩蛋：后日谈 + 旧新条子对照 + 三枚小图标 + 提示条 ─────────────

/** p6-01 转场小卡「后日谈」（dim） */
const EpilogueCard: React.FC<{at02: number}> = ({at02}) => {
  const e = useEnter('fade', {at: 2, dur: DUR.f4});
  const out = useProgress(at02 - DUR.f4, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 216,
        width: 1920,
        textAlign: 'center',
        opacity: e.opacity * (1 - out),
      }}
    >
      <span style={{fontFamily: theme.serif, fontSize: 40, color: theme.dim, letterSpacing: 10}}>{'后日谈'}</span>
      <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginLeft: 18, letterSpacing: 1}}>
        {'afterword'}
      </span>
    </div>
  );
};

/** p6-02 旧条子→新条子对照卡：上行旧占位提示无地址（dim 灰置）／下行新条子
 *  带磁盘地址（mech 高亮地址段）。 */
const OldNewCard: React.FC<{at02: number; at03: number}> = ({at02, at03}) => {
  const card = useEnter('pop', {at: at02 + 2, dur: DUR.f5});
  const out = useProgress(at03 - DUR.f4, DUR.f4);
  const addr = useProgress(at02 + DUR.f4, DUR.f4);
  const tag = (color: string): React.CSSProperties => ({
    marginLeft: 'auto',
    fontFamily: theme.mono,
    fontSize: 18,
    color,
    border: `2px solid ${color}`,
    borderRadius: 999,
    padding: '2px 12px',
    whiteSpace: 'nowrap',
  });
  return (
    <div style={{position: 'absolute', left: 470, top: 330, opacity: card.opacity * (1 - out), transform: card.transform}}>
      <Panel style={{width: 980, boxSizing: 'border-box', padding: '26px 32px'}}>
        {/* 旧条子：压扁后的通用提示，无地址 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '14px 18px',
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 10,
            background: theme.bg,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 25, color: theme.dim}}>
            {'[Earlier tool result compacted. Re-run if needed.]'}
          </span>
          <span style={tag(theme.panelBorder)}>{'无地址'}</span>
        </div>
        {/* 新条子：占位符带上磁盘地址（地址段 mech） */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginTop: 16,
            padding: '14px 18px',
            border: `2px solid ${theme.mech}`,
            borderRadius: 10,
            background: theme.bg,
          }}
        >
          <span style={{fontFamily: theme.mono, fontSize: 25, color: theme.text}}>
            {'[Earlier tool result '}
            <span style={{color: theme.mech, opacity: addr}}>{'saved at .persist/9f2a.bin'}</span>
            <span style={{opacity: addr}}>{']'}</span>
          </span>
          <span style={tag(theme.mech)}>{'带地址'}</span>
        </div>
      </Panel>
    </div>
  );
};

/** 三枚小图标 glyph（mech 描边线画）：指针认得自己／先存再压／掐口不二刀 */
const FixGlyph: React.FC<{kind: 'self' | 'store' | 'cut'; color: string}> = ({kind, color}) => {
  if (kind === 'self') {
    return (
      <svg width={96} height={64} viewBox="0 0 96 64">
        <rect x={8} y={22} width={54} height={28} rx={5} fill="none" stroke={color} strokeWidth={4} />
        <circle cx={26} cy={36} r={5} fill={color} />
        <line x1={38} y1={36} x2={54} y2={36} stroke={color} strokeWidth={3} opacity={0.6} />
        <path d="M68 34 Q90 28 82 10 Q74 -4 54 12" fill="none" stroke={color} strokeWidth={3.5} strokeDasharray="5 5" />
      </svg>
    );
  }
  if (kind === 'store') {
    return (
      <svg width={96} height={64} viewBox="0 0 96 64">
        <rect x={4} y={26} width={30} height={24} rx={3} fill="none" stroke={color} strokeWidth={4} />
        <line x1={10} y1={34} x2={28} y2={34} stroke={color} strokeWidth={2.5} opacity={0.6} />
        <line x1={10} y1={42} x2={24} y2={42} stroke={color} strokeWidth={2.5} opacity={0.6} />
        <path d="M40 38 L56 38 M50 32 L57 38 L50 44" fill="none" stroke={color} strokeWidth={3.5} />
        <rect x={62} y={22} width={30} height={32} rx={3} fill="none" stroke={color} strokeWidth={4} />
        <line x1={62} y1={12} x2={92} y2={12} stroke={color} strokeWidth={3} />
        <path d="M70 8 L77 12 L70 16 M84 8 L91 12 L84 16" fill="none" stroke={color} strokeWidth={3} />
      </svg>
    );
  }
  return (
    <svg width={96} height={64} viewBox="0 0 96 64">
      <rect x={4} y={26} width={88} height={16} rx={3} fill="none" stroke={color} strokeWidth={4} />
      <line x1={34} y1={18} x2={34} y2={50} stroke={color} strokeWidth={4} />
      <line x1={66} y1={18} x2={66} y2={50} stroke={theme.dim} strokeWidth={3} strokeDasharray="4 4" />
      <line x1={58} y1={20} x2={74} y2={48} stroke={theme.deny} strokeWidth={3.5} />
    </svg>
  );
};

const FIXES = [
  {zh: '指针认得自己', en: 'self-addressed', kind: 'self' as const},
  {zh: '先存再压', en: 'store-first', kind: 'store' as const},
  {zh: '掐口不二刀', en: 'one-cut-only', kind: 'cut' as const},
];

/** p6-04 回落三枚小图标：演进要点照单收录（stagger 逐枚点亮） */
const ThreeFixIcons: React.FC<{at04: number; at05: number}> = ({at04, at05}) => {
  const cards = useStagger(FIXES.length, {at: at04 + 2, stride: 8, dur: DUR.f5});
  const out = useProgress(at05 - DUR.f4, DUR.f4);
  return (
    <div
      style={{
        position: 'absolute',
        left: 410,
        top: 440,
        width: 1100,
        display: 'flex',
        gap: 40,
        opacity: 1 - out,
      }}
    >
      {FIXES.map((f, i) => (
        <div key={f.zh} style={{opacity: cards[i], transform: `translateY(${(1 - cards[i]) * 18}px)`, flex: 1}}>
          <Panel accent={theme.mech} style={{padding: '20px 22px', textAlign: 'center'}}>
            <div style={{height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <FixGlyph kind={f.kind} color={theme.mech} />
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text, marginTop: 10}}>
              {f.zh}
            </div>
            <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, marginTop: 4}}>{f.en}</div>
          </Panel>
        </div>
      ))}
    </div>
  );
};

/** p6-06 回落「不宣称因果」提示条（dim 横条）。锚 p6-06 句边界——本条在 beat 内
 *  第 6 句才回落，镜首即现会与后日谈卡／对照卡／三图标纵向重叠（复核修复）。 */
const CautionBar: React.FC<{at06: number}> = ({at06}) => {
  const e = useEnter('fade', {at: at06 + 2, dur: DUR.f4});
  return (
    <div style={{position: 'absolute', left: 360, top: 470, width: 1200, ...e}}>
      <div
        style={{
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 999,
          background: theme.panel,
          padding: '16px 28px',
          textAlign: 'center',
        }}
      >
        <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, letterSpacing: 4}}>{'不宣称因果'}</span>
        <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginLeft: 16}}>{'recorded as-is'}</span>
      </div>
    </div>
  );
};

// ── 6-B 回答主线：3D 栈 + 空窗侧标注 + 碑兑现 ────────────────────────────

/** 栈回答装置：HarnessStackP6 放大居左（p6-07）＋系列标语压栈底；空窗回落时
 *  随 ArchifyYield 重现，两侧标注（p6-10 收台侧 / p6-12 登记簿侧）fade 浮现。 */
const StackReturn: React.FC<{at07: number; at10: number; at12: number}> = ({at07, at10, at12}) => {
  const stackIn = useProgress(at07, DUR.f4);
  const slogan = useProgress(at07 + DUR.f4, DUR.f4);
  const annA = useEnter('fade', {at: at10 + 2, dur: DUR.f4});
  // 标注槽位单Slot：annB（p6-12）进场前 annA 淡出——两标注同位（left 1120 top 388），
  // 不交换会文字互叠（复核修复）
  const annAOut = useProgress(at12 - DUR.f4, DUR.f4);
  const annB = useEnter('fade', {at: at12 + 2, dur: DUR.f4});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 520, top: 336, opacity: stackIn}}>
        {/* 下期层呼吸预告归 6-D 下期卡：呼吸锚推到镜外恒不触发（nextOn 恒 0） */}
        <HarnessStackP6 at={at07 + 2} nextBreathAt={at07 + 1000000} />
      </div>
      {/* 系列标语压在栈底（08「P6 收尾用法」） */}
      <div
        style={{
          position: 'absolute',
          left: 520,
          top: 700,
          width: 420,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 22,
          color: theme.dim,
          letterSpacing: 3,
          opacity: slogan,
        }}
      >
        {'Claude Code Harness Engineering'}
      </div>

      {/* p6-10 空窗回落：收台侧标注（便宜先跑／配对不拆）；p6-12 前让位给登记簿侧 */}
      <div style={{position: 'absolute', left: 1120, top: 388, opacity: annA.opacity * (1 - annAOut), transform: annA.transform}}>
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 2}}>{'收台侧'}</div>
        <div style={{display: 'flex', gap: 18, marginTop: 14}}>
          <Pill color={theme.mech}>{'便宜先跑'}</Pill>
          <Pill color={theme.mech}>{'配对不拆'}</Pill>
        </div>
      </div>

      {/* p6-12 空窗回落：登记簿侧标注（写权在工坊） */}
      <div style={{position: 'absolute', left: 1120, top: 388, ...annB}}>
        <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 2}}>{'登记簿侧'}</div>
        <div style={{marginTop: 14}}>
          <Pill color={theme.mech}>{'写权在工坊'}</Pill>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 碑兑现（p6-14 同窗叠 vow-cashed 章之上）：衬底先让画框入场约 7 帧再压暗，
 *  衬线记忆点定格到窗尾。caption-dup-ok：主字压短非逐字（重合 7 字 < 10 安全线；
 *  分镜 6-B「碑兑现」注记 + 工单点名的收束前 P6 金句卡）。 */
const SteleCashed: React.FC = () => {
  const o = useProgress(DUR.f4, DUR.f4);
  const note = useProgress(DUR.f4 + 14, DUR.f4);
  return (
    <AbsoluteFill style={{background: withAlpha(theme.bg, 0.84 * o), pointerEvents: 'none'}}>
      <QuoteCard zh="两套咬合的机制" />
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
        {'碑 · 兑现'}
      </div>
    </AbsoluteFill>
  );
};

// ── 6-C 开放问题：天平悬停不裁决 ─────────────────────────────────────────

/** 天平几何：支点 (960,545)，横梁 y460 半长 300；两盘悬于梁端（随摆微移、恒正立）。 */
const SCALE = {cx: 960, beamY: 460, half: 300, swayDeg: 2.2} as const;

const BalanceOpen: React.FC<{at16: number}> = ({at16}) => {
  const left = useEnter('slideL', {at: 2, dur: DUR.f5, dist: 60});
  const right = useEnter('slideR', {at: 6, dur: DUR.f5, dist: 60});
  // 悬停呼吸（dim）：正弦微摆永不停驻单侧——「不裁决」被看见
  const sway = useBreathe({period: 72, amp: 1, base: 0});
  const theta = (SCALE.swayDeg * sway * Math.PI) / 180;
  const verdict = useProgress(at16, DUR.f4);

  const endL = {x: SCALE.cx - SCALE.half * Math.cos(theta), y: SCALE.beamY - SCALE.half * Math.sin(theta)};
  const endR = {x: SCALE.cx + SCALE.half * Math.cos(theta), y: SCALE.beamY + SCALE.half * Math.sin(theta)};

  const pan = (
    pos: {x: number; y: number},
    enter: {opacity: number; transform: string},
    tag: string,
    title: string,
    sub: string,
    accent: string,
  ) => (
    <div style={{position: 'absolute', left: pos.x - 215, top: 585, ...enter}}>
      <Panel accent={accent} style={{width: 430, padding: '18px 24px'}}>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 12px',
            borderRadius: 999,
            border: `2px solid ${accent}`,
            color: accent,
            fontFamily: theme.mono,
            fontSize: 18,
          }}
        >
          {tag}
        </span>
        <div style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 700, color: theme.text, marginTop: 10}}>
          {title}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 4}}>{sub}</div>
      </Panel>
    </div>
  );

  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {/* 横梁（dim——悬停态本体） */}
        <line
          x1={endL.x}
          y1={endL.y}
          x2={endR.x}
          y2={endR.y}
          stroke={theme.dim}
          strokeWidth={9}
          strokeLinecap="round"
          opacity={(left.opacity + right.opacity) / 2}
        />
        {/* 吊线：梁端垂到盘沿 */}
        <line x1={endL.x} y1={endL.y} x2={endL.x} y2={585} stroke={theme.dim} strokeWidth={3} opacity={left.opacity} />
        <line x1={endR.x} y1={endR.y} x2={endR.x} y2={585} stroke={theme.dim} strokeWidth={3} opacity={right.opacity} />
        {/* 支点与底座 */}
        <path
          d={`M${SCALE.cx} ${SCALE.beamY + 14} L${SCALE.cx - 34} ${SCALE.beamY + 92} L${SCALE.cx + 34} ${SCALE.beamY + 92} Z`}
          fill={theme.panel}
          stroke={theme.dim}
          strokeWidth={3}
        />
        <line
          x1={SCALE.cx - 70}
          y1={SCALE.beamY + 92}
          x2={SCALE.cx + 70}
          y2={SCALE.beamY + 92}
          stroke={theme.panelBorder}
          strokeWidth={5}
          strokeLinecap="round"
        />
      </svg>

      {/* 左盘：模型自选（mech——教学版与源码分析同站） */}
      {pan(endL, left, 'model', '模型自选', '教学版 · 源码分析', theme.mech)}
      {/* 右盘：向量检索（dim——官方不表态，无人度量） */}
      {pan(endR, right, 'vectors', '向量检索', '官方不表态', theme.dim)}

      {/* 题词：召回 · 没人量过（p6-16 起；刻意不停驻单侧） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 856,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 34,
          opacity: verdict,
        }}
      >
        <span style={{color: theme.dim}}>{'召回 · '}</span>
        <span style={{color: theme.text, fontWeight: 700}}>{'没人量过'}</span>
      </div>

      <Footnote delay={at16}>{'recall: 未度量'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 6-D 收尾装置串：3D 工坊地图暗态 + 身份卡/下期卡 + 灯牌收暗 ───────────

/** 工坊地图（3D，零 motion hook）：五区板复用 PlateSlab3D；开灯 = 本集及其前
 *  （口播「两个区没开灯」的画面契约，见文件头），下两区暗态（panel 面 + 压暗）。
 *  区名 = 系列层短名（与常驻 Badge 同源）。 */
const ZONE_W = 250;
const ZONE_H = 150;
const ZONE_POS: {left: number; top: number}[] = [
  {left: 110, top: 300},
  {left: 385, top: 300},
  {left: 660, top: 300},
  {left: 248, top: 500},
  {left: 523, top: 500},
];

const WorkshopDarkMap: React.FC<{mapIn: number; litZone: number}> = ({mapIn, litZone}) => (
  <>
    {/* 地图边界（虚线）＋图题 */}
    <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}} opacity={mapIn}>
      <rect
        x={104}
        y={288}
        width={812}
        height={406}
        rx={16}
        fill="none"
        stroke={theme.panelBorder}
        strokeWidth={2.5}
        strokeDasharray="10 8"
      />
    </svg>
    <div
      style={{
        position: 'absolute',
        left: 110,
        top: 252,
        fontFamily: theme.mono,
        fontSize: 22,
        color: theme.dim,
        opacity: mapIn,
      }}
    >
      {'工坊地图'}
    </div>
    {LAYERS.map((l, i) => {
      const lit = l.index <= ACTIVE_INDEX;
      const isFocus = l.index === ACTIVE_INDEX;
      const pos = ZONE_POS[i];
      return (
        <div
          key={l.index}
          style={{
            position: 'absolute',
            left: pos.left,
            top: pos.top,
            opacity: mapIn * (lit ? 1 : 0.5),
          }}
        >
          <PlateSlab3D
            layer={l}
            active={lit}
            dim={isFocus ? 1 : lit ? 0.82 : 0.45}
            glow={isFocus ? litZone * 0.7 : 0}
            width={ZONE_W}
            height={ZONE_H}
            p6
          />
        </div>
      );
    })}
  </>
);

/** 身份卡 + 下期卡（chip 档）：标题主段受检硬编码（规则 8，见文件头）；下期层名走数据。 */
const SeriesCards: React.FC<{at20: number}> = ({at20}) => {
  const cards = useStagger(2, {at: at20 + 2, stride: 8, dur: DUR.f5});
  return (
    <>
      {/* 系列身份卡 */}
      <div
        style={{
          position: 'absolute',
          left: 980,
          top: 310,
          opacity: cards[0],
          transform: `translateY(${(1 - cards[0]) * 18}px)`,
        }}
      >
        <Panel accent={theme.core} style={{width: 820, boxSizing: 'border-box', padding: '30px 36px'}}>
          <div style={{fontFamily: theme.serif, fontSize: 24, color: theme.dim, letterSpacing: 3}}>
            {'Claude Code Harness Engineering'}
          </div>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 22}}>
            <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>{'记忆管理'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.panelBorder}}>{'|'}</span>
            <span style={{fontFamily: theme.serif, fontSize: 56, fontWeight: 700, color: theme.core}}>
              {'会丢的和不能丢的'}
            </span>
          </div>
        </Panel>
      </div>
      {/* 下期卡：标题只在画面（口播只说「下期 + 话题」，反串线纪律） */}
      <div
        style={{
          position: 'absolute',
          left: 980,
          top: 640,
          opacity: cards[1],
          transform: `translateY(${(1 - cards[1]) * 18}px)`,
        }}
      >
        <div
          style={{
            width: 820,
            boxSizing: 'border-box',
            padding: '20px 30px',
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 14,
            background: theme.panel,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 21, color: theme.dim, letterSpacing: 2}}>
            {`下期 · ${NEXT_LAYER?.layer ?? ''}`}
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text, marginTop: 8}}>{'一张回执和四层钟'}</div>
        </div>
      </div>
    </>
  );
};

/** 收尾编排：地图/灯牌回落（p6-20 起）→ 身份卡/下期卡浮现（@stagger）→
 *  灯牌收暗 + 全镜末 36 帧渐黑（p6-21；窗取整镜时长——红线四）。 */
const Finale: React.FC<{span: number; at20: number; at21: number}> = ({span, at20, at21}) => {
  const mapIn = useProgress(at20, DUR.f5);
  // 本集区点亮随地图进场补一次辉光脉冲
  const litZone = useProgress(at20 + DUR.f4, DUR.f5);
  // 灯牌（工坊不打烊）收暗——「灯还亮着」直到渐黑前一刻
  const lamp = useDim({at: at21, to: 0.5, dur: DUR.f5});
  const keep = useFadeOut(span, {frames: 36});

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <WorkshopDarkMap mapIn={mapIn} litZone={litZone} />
      {/* 灯牌：地图右上角，随收尾句压暗 */}
      <div style={{position: 'absolute', left: 806, top: 252, opacity: mapIn * lamp}}>
        <Panel style={{padding: '6px 16px'}}>
          <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{'24h'}</span>
        </Panel>
      </div>
      <SeriesCards at20={at20} />
      {/* 渐黑遮罩：末 36 帧，窗取整镜时长（红线四——勿用末句时长） */}
      <AbsoluteFill style={{background: '#000', opacity: 1 - keep}} />
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P6TwoSystems: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p6-01', 'p6-06');
  const bB = w('p6-07', 'p6-14');
  const bC = w('p6-15', 'p6-17');
  const bD = w('p6-18', 'p6-21');

  // 常驻条调度：3D 栈在场窗（p6-07 落场 / p6-10 / p6-12 空窗回落）让位——
  // 五层信息已在栈上；6-D 身份卡接管。progress 纯函数恒 clamp 在 1，故「让位」
  // 写成窗（进场×退场），否则栈窗之后永远为 0。
  const frame = useCurrentFrame();
  const inWin = (a: number, b: number) =>
    progress(frame, a - DUR.f3, DUR.f4) * (1 - progress(frame, b - DUR.f5, DUR.f5));
  const stackA = inWin(at('p6-07'), at('p6-08'));
  const stackB1 = inWin(at('p6-10'), at('p6-11'));
  const stackB2 = inWin(at('p6-12'), at('p6-13'));
  const hideForCard = progress(frame, bD.from, DUR.f4);
  const badgeO = (1 - stackA) * (1 - stackB1) * (1 - stackB2) * (1 - hideForCard);

  return (
    <AbsoluteFill>
      <HarnessBadge style={{...BADGE_STYLE, opacity: badgeO}} />

      <Sequence {...bA} name="6-A 演进彩蛋">
        <SceneTag chapter="Two Systems" tagline="两套机制" />
        {/* 可见岛 p6-01..02 / p6-04 / p6-06；窗 = 本镜 2 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p6-03') - bA.from, durationInFrames: dur('p6-03')},
            {at: at('p6-05') - bA.from, durationInFrames: dur('p6-05')},
          ]}
        >
          <EpilogueCard at02={at('p6-02') - bA.from} />
          <OldNewCard at02={at('p6-02') - bA.from} at03={at('p6-03') - bA.from} />
          <ThreeFixIcons at04={at('p6-04') - bA.from} at05={at('p6-05') - bA.from} />
          <CautionBar at06={at('p6-06') - bA.from} />
        </ArchifyYield>
        {/* cue 1..2/7：memory-panorama 实例一（本镜首图 → 默认入场） */}
        <ArchifyRecap
          slug="memory-panorama"
          caption="记忆全景"
          cues={[
            {chapterId: 'evolved-hint', at: at('p6-03') - bA.from, durationInFrames: dur('p6-03')},
            {chapterId: 'roads-closed', at: at('p6-05') - bA.from, durationInFrames: dur('p6-05')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="6-B 回答主线（3D）">
        {/* 可见岛 p6-07（3D 栈）/ p6-10 / p6-12（空窗侧标注）；窗 = 本镜 5 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p6-08') - bB.from, durationInFrames: dur('p6-08')},
            {at: at('p6-09') - bB.from, durationInFrames: dur('p6-09')},
            {at: at('p6-11') - bB.from, durationInFrames: dur('p6-11')},
            {at: at('p6-13') - bB.from, durationInFrames: dur('p6-13')},
            {at: at('p6-14') - bB.from, durationInFrames: dur('p6-14')},
          ]}
        >
          <StackReturn
            at07={at('p6-07') - bB.from}
            at10={at('p6-10') - bB.from}
            at12={at('p6-12') - bB.from}
          />
        </ArchifyYield>
        {/* cue 3..7/7：memory-panorama 实例二——与实例一隔 p6-06..07 两句空窗，
            画框已卸载 ⇒ 默认入场（分镜「空窗后重现保持默认 lead」清单在案） */}
        <ArchifyRecap
          slug="memory-panorama"
          caption="记忆全景"
          cues={[
            // fit='trim' 显式留痕：章 7 拍 7.76s vs 句窗 1.95s（rate 3.98），前句是
            // StackReturn 归位岛、后句 lossy-side 专属 cue，无法扩窗——全景仅作开答
            // 过渡（前两拍），完整兑现由 two-clamps@p6-13 / vow-cashed@p6-14 承接
            {chapterId: 'answer-panorama', at: at('p6-08') - bB.from, durationInFrames: dur('p6-08'), fit: 'trim'},
            {chapterId: 'lossy-side', at: at('p6-09') - bB.from, durationInFrames: dur('p6-09')},
            {chapterId: 'ledger-side', at: at('p6-11') - bB.from, durationInFrames: dur('p6-11')},
            {chapterId: 'two-clamps', at: at('p6-13') - bB.from, durationInFrames: dur('p6-13')},
            {chapterId: 'vow-cashed', at: at('p6-14') - bB.from, durationInFrames: dur('p6-14')},
          ]}
        />
        {/* 碑兑现金句卡：叠在 vow-cashed cue 窗后段（见文件头注） */}
        <Sequence from={at('p6-14') - bB.from} durationInFrames={dur('p6-14')} name="6-B 碑兑现">
          <SteleCashed />
        </Sequence>
      </Sequence>

      <Sequence {...bC} name="6-C 开放天平">
        <BalanceOpen at16={at('p6-16') - bC.from} />
      </Sequence>

      <Sequence {...bD} name="6-D 收尾装置串（3D）">
        {/* 可见岛 p6-20..21（地图/身份卡/灯牌）；窗 = 本镜 2 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p6-18') - bD.from, durationInFrames: dur('p6-18')},
            {at: at('p6-19') - bD.from, durationInFrames: dur('p6-19')},
          ]}
        >
          <Finale
            span={bD.durationInFrames}
            at20={at('p6-20') - bD.from}
            at21={at('p6-21') - bD.from}
          />
        </ArchifyYield>
        {/* cue 6..7/7：five-layer-dependency 跨幕实例二——P0 0-C 之后隔全片空窗
            ⇒ 默认入场（与分镜 lead 清单口径一致） */}
        <ArchifyRecap
          slug="five-layer-dependency"
          caption="五层依赖"
          cues={[
            {chapterId: 'read-two-books', at: at('p6-18') - bD.from, durationInFrames: dur('p6-18')},
            {chapterId: 'two-dark-zones', at: at('p6-19') - bD.from, durationInFrames: dur('p6-19')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P6TwoSystems;
