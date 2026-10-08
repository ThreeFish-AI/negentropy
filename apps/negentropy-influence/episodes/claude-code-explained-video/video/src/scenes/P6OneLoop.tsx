/** P6 收束（p6-01..21，4 镜 5 cue）——分镜 6-A…6-D。
 *
 *  cue 清单（5，全落 five-layer-dependency）：
 *   6-A debt-chain@p6-01 / one-loop@p6-04 / grown-where@p6-05（实例一，默认入场）
 *   6-D read-map@p6-17 / four-dark-zones@p6-18（实例二）
 *
 *  ★ 分镜 6-D 注「跨实例背靠背，后段 lead={false}」按 ArchifyRecap 契约校正为
 *    默认入场：实例一末窗（p6-05）与实例二首窗（p6-17）之间隔 11 句（自检对账的
 *    最长无锚 run），画框已卸载一分钟——lead 只服务「同一位置背靠背」的实例，
 *    空窗后 lead={false} 会以全不透明一帧瞬现（组件文档点名的缺陷）。与 0-E
 *    「p0-06 后空窗长 → 默认入场」同一裁决口径；评审如持异议，补一个 prop 即回摆。
 *  ★ 6-A 金句卡「机制很多 · 循环一个」按分镜落 p6-04（caption-dup-ok 豁免在案）：
 *    该句同窗锚 one-loop 章（全屏独占），金句卡故以衬底 scrim 叠在 cue 窗后段定格
 *    ——先让画框入场约 7 帧，再由衬线记忆点接管；刻意不进 ArchifyYield。
 *  ★ 6-D 系列身份卡/下期卡：标题主段是 check_series 规则 8 的受检硬编码——
 *    本集「一个循环，三层装置」＋下集「视野错位的五种修正手法」（改标题先改
 *    series.json 再同步此串）；层名/下期层名走 series-layers.json 数据（NEXT_LAYER）。
 *  ★ 空间契约：6-A/6-D 为系列装置镜（3D 栈/工坊地图居中），6-B/6-C 卡片对称分置。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Footnote, Panel, SceneTag} from '../components/motifs';
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
  useImpulse,
  useProgress,
  useReveal,
  useStagger,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：与 P0–P4 同值（顶边 y<56 归 frozen ChapterProgress；Integrate 统一核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 人形剪影（师傅 = text 白，无彩）——与 P0 同形（scenes 不跨集/跨幕 import） */
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

// ── 6-A 回答主线：3D 栈放大居中 + 金句卡 + 代码页翻页 ────────────────────

/** 栈回答句装置：HarnessStackP6 放大居中（p6-02 起）＋系列标语压栈底；p6-05 窗尾
 *  整体淡出，把末句让给代码页翻页装置。cue 窗内由幕组装层 ArchifyYield 淡出让位。 */
const StackAnswer: React.FC<{at02: number; at03: number; at06: number}> = ({at02, at03, at06}) => {
  const stackIn = useProgress(at02, DUR.f4);
  // 下期层呼吸预告锚在 p6-03 中段（「一层一层加上去」——还有下一层）
  const nextBreathAt = at03 + Math.round(DUR.f5 * 1.5);
  const slogan = useProgress(at02 + DUR.f4, DUR.f4);
  const out = useProgress(at06 - DUR.f5, DUR.f5);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 750, top: 318, opacity: stackIn * (1 - out)}}>
        <HarnessStackP6 at={at02 + 2} nextBreathAt={nextBreathAt} />
      </div>
      {/* 系列标语压在栈底（08「P6 收尾用法」） */}
      <div
        style={{
          position: 'absolute',
          left: 750,
          top: 660,
          width: 420,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 22,
          color: theme.dim,
          letterSpacing: 3,
          opacity: slogan * (1 - out),
        }}
      >
        {'Claude Code Harness Engineering'}
      </div>
    </AbsoluteFill>
  );
};

/** 金句卡接管层（p6-04 同窗叠 one-loop 章之上）：衬底先让画框入场约 7 帧再压暗，
 *  衬线记忆点定格到窗尾（caption-dup-ok：主字压短非逐字，storyboard 已豁免）。 */
const AnswerQuote: React.FC = () => {
  const o = useProgress(DUR.f4, DUR.f4);
  return (
    <AbsoluteFill style={{background: withAlpha(theme.bg, 0.84 * o), pointerEvents: 'none'}}>
      {/* caption-dup-ok: 金句定格记忆点，主字已压短非逐字（storyboard 6-A 同款豁免） */}
      <QuoteCard zh="机制很多 · 循环一个" />
    </AbsoluteFill>
  );
};

/** 四章翻页装置（p6-06 空窗岛）：章标签逐个点亮（号码簿→门禁→插线口→扫码），
 *  循环页逐字同头一行不改——「几乎不用重印」以恒 0 的重印行收束。 */
const FLIP_TABS = ['号码簿', '门禁', '插线口', '扫码'] as const;
const LOOP_SKELETON = [
  'while True:',
  '    msg = ask(model)',
  '    for c in msg.tools:',
  '        run(c)',
] as const;

const CodePageFlip: React.FC<{span06: number}> = ({span06}) => {
  const frame = useCurrentFrame();
  const cardIn = useProgress(2, DUR.f4);
  // 翻页指针：本镜唯一 @progress——章标签线性轮转（机械感即主题）
  const flip = useProgress(DUR.f3, Math.max(1, span06 - DUR.f4), 'linear');
  const idx = Math.min(FLIP_TABS.length - 1, Math.floor(flip * FLIP_TABS.length));
  // 换章瞬间的页面轻闪（纯函数求值，非 hook）
  const per = Math.max(1, Math.round((span06 - DUR.f4) / FLIP_TABS.length));
  const flash = FLIP_TABS.slice(1).some((_, k) => {
    const b = DUR.f3 + (k + 1) * per;
    return frame >= b && frame < b + 5;
  })
    ? 0.55
    : 1;
  const reprint = useProgress(DUR.f4, DUR.f4);

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 610, top: 300, opacity: cardIn}}>
        <Panel accent={theme.core} style={{width: 700, padding: '22px 28px'}}>
          {/* 章标签行：翻到哪章亮哪章 */}
          <div style={{display: 'flex', gap: 12, marginBottom: 16}}>
            {FLIP_TABS.map((t, i) => (
              <div
                key={t}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '8px 0',
                  borderRadius: 8,
                  border: `2px solid ${i === idx ? theme.mech : theme.panelBorder}`,
                  color: i === idx ? theme.mech : theme.dim,
                  background: i === idx ? withAlpha(theme.mech, 0.1) : 'transparent',
                  fontFamily: theme.sans,
                  fontSize: 24,
                  fontWeight: i === idx ? 600 : 400,
                }}
              >
                {t}
              </div>
            ))}
          </div>
          {/* 循环页：四章逐字同头（换章轻闪＝翻页 tactile） */}
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: 27,
              lineHeight: 1.72,
              opacity: flash,
              padding: '10px 16px',
              border: `2px solid ${theme.panelBorder}`,
              borderRadius: 10,
              background: theme.bg,
            }}
          >
            {LOOP_SKELETON.map((ln, i) => (
              <div key={i} style={{color: i === 0 ? theme.core : theme.text, whiteSpace: 'pre'}}>
                {ln}
              </div>
            ))}
          </div>
          {/* 重印账：恒 0（「几乎不用重印」的画面代言） */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginTop: 14,
              opacity: reprint,
            }}
          >
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'循环页'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.core}}>
              {'重印 0 行'}
            </span>
          </div>
        </Panel>
      </div>
      <Footnote delay={DUR.f3}>{'while True'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 6-B 分工双人卡：决定权 ≠ 放行权 ─────────────────────────────────────

/** 门禁 glyph（右卡）：mech 描边门框 + 三根竖闩——「放行 · 放不放」的装置语义。 */
const GateGlyph: React.FC<{color: string; opacity?: number}> = ({color, opacity = 1}) => (
  <svg width={150} height={200} viewBox="0 0 150 200" style={{opacity}}>
    <rect x={8} y={8} width={134} height={184} rx={10} fill="none" stroke={color} strokeWidth={5} />
    {[44, 75, 106].map((x) => (
      <line key={x} x1={x} y1={22} x2={x} y2={178} stroke={color} strokeWidth={4} opacity={0.65} />
    ))}
    <circle cx={75} cy={100} r={7} fill={color} />
  </svg>
);

const DivisionCards: React.FC<{
  at08: number;
  at09: number;
  at10: number;
  at11: number;
  at12: number;
}> = ({at08, at09, at10, at11, at12}) => {
  // 双人卡对开（p6-07）
  const cards = useStagger(2, {at: 2, stride: 8, dur: DUR.f5});
  // p6-09 两侧题词随口播序点亮：先师傅、后工坊
  const leftOn = useProgress(at09, DUR.f4);
  const rightOn = useProgress(at09 + 10, DUR.f4);
  // 金句卡带（p6-08 定格 → p6-11 让位官方引语卡）
  const quoteIn = useProgress(at08, DUR.f4);
  const quoteOut = useProgress(at11 - DUR.f4, DUR.f4);
  // 官方 Note 引语卡（p6-11 起，mono 引语态）；双人卡同拍压暗
  const noteIn = useProgress(at11, DUR.f4);
  const cardsDim = useProgress(at11, DUR.f5);
  const line = useReveal('Permission rules are enforced by Claude Code, not by the model', {
    at: at11 + 6,
    cps: 18,
  });
  // p6-12「值得说两遍」：二次脉冲强调引语卡
  const again = useImpulse({at: at12 + DUR.f3, dur: DUR.f6});
  const foreshadow = useProgress(at10, DUR.f4);

  const sideCard = (
    on: number,
    title: string,
    sub: string,
    en: string,
    accent: string,
    children: React.ReactNode,
  ) => (
    <Panel
      accent={on > 0.5 ? accent : theme.panelBorder}
      style={{
        width: 580,
        height: 320,
        boxSizing: 'border-box',
        padding: '26px 30px',
        opacity: 0.55 + 0.45 * on,
        boxShadow: on > 0.5 ? `0 0 ${14 * on}px ${withAlpha(accent, 0.35 * on)}` : undefined,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 24, height: 190, position: 'relative'}}>
        {children}
      </div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 14}}>
        <span
          style={{
            fontFamily: theme.sans,
            fontSize: 44,
            fontWeight: 700,
            color: on > 0.5 ? theme.text : theme.dim,
          }}
        >
          {title}
        </span>
        <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>{sub}</span>
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 6}}>{en}</div>
    </Panel>
  );

  return (
    <AbsoluteFill>
      {/* 左：师傅（决定 · 调什么）——p6-11 起压暗到 ~38%（引语卡的所指在场） */}
      <div style={{position: 'absolute', left: 250, top: 310, opacity: cards[0] * (1 - 0.62 * cardsDim)}}>
        {sideCard(
          leftOn,
          '决定',
          '调什么',
          'decide · which tool',
          theme.core,
          <Person x={20} y={0} color={theme.text} scale={0.98} opacity={0.9} />,
        )}
      </div>
      {/* 右：门禁（放行 · 放不放） */}
      <div style={{position: 'absolute', left: 1090, top: 310, opacity: cards[1] * (1 - 0.62 * cardsDim)}}>
        {sideCard(
          rightOn,
          '放行',
          '放不放',
          'permit · yes / no',
          theme.mech,
          <GateGlyph color={theme.mech} />,
        )}
      </div>

      {/* 中缝分界线 */}
      <div
        style={{
          position: 'absolute',
          left: 958,
          top: 300,
          width: 2,
          height: 340,
          background: theme.panelBorder,
          opacity: (cards[0] + cards[1]) / 2,
        }}
      />

      {/* 金句卡带：整屏居中卡下移到卡下题词带（p6-08 费曼遗产句，压短形态） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: quoteIn * (1 - quoteOut),
          transform: 'translateY(206px)',
          pointerEvents: 'none',
        }}
      >
        <QuoteCard zh="决定权 ≠ 放行权" />
      </div>

      {/* p6-10 开头伏笔句回放小字（1-A 埋的「想 / 干 · ↺ 收尾收账」到站） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 852,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.dim,
          letterSpacing: 2,
          opacity: foreshadow,
        }}
      >
        {'想 · 干 ↺ 收账'}
      </div>

      {/* 官方 Note 引语卡（p6-11，mono 引语态逐字） */}
      <div
        style={{
          position: 'absolute',
          left: 360,
          top: 336,
          opacity: noteIn,
          transform: `translateY(${(1 - noteIn) * 16}px)`,
        }}
      >
        <Panel style={{width: 1200, padding: '26px 34px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16}}>
            <span
              style={{
                fontFamily: theme.sans,
                fontSize: 22,
                color: theme.dim,
                border: `2px solid ${theme.dim}`,
                borderRadius: 6,
                padding: '2px 10px',
              }}
            >
              {'官'}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
              {'官方文档 · Note'}
            </span>
          </div>
          <div
            style={{
              fontFamily: theme.mono,
              fontSize: 30,
              lineHeight: 1.6,
              color: theme.text,
              whiteSpace: 'pre',
              minHeight: 100,
              textShadow: `0 0 ${18 * again}px ${withAlpha(theme.mech, 0.5 * again)}`,
            }}
          >
            {line}
          </div>
        </Panel>
      </div>

      <Footnote delay={at11}>{'decide ≠ permit'}</Footnote>
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
    <div
      style={{
        position: 'absolute',
        left: pos.x - 215,
        top: 585,
        ...enter,
      }}
    >
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

      {/* 左盘：教学版（第一个插头 · 结构美感，mech） */}
      {pan(endL, left, '教学版', '第一个插头', '结构美感', theme.mech)}
      {/* 右盘：产品（独立成层 · 安全底线，mechDeep） */}
      {pan(endR, right, '产品', '独立成层', '安全底线', theme.mechDeep)}

      {/* p6-16 末句题词：留白不裁决 */}
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
        <span style={{color: theme.dim}}>{'各对规模负责'}</span>
        <span style={{color: theme.dim}}>{' · '}</span>
        <span style={{color: theme.text, fontWeight: 700}}>{'不站队'}</span>
      </div>
    </AbsoluteFill>
  );
};

// ── 6-D 收尾装置串：3D 工坊地图暗态 + 身份卡/下期卡 + 灯牌收暗 ──────────

/** 工坊地图（3D，零 motion hook）：五区板复用 PlateSlab3D（板+文字对位经 harness-stack
 *  实证）；本集区点亮（core 棱线），四区暗态（panel 面 + 压暗）。「没开灯」由
 *  dim 表达；区名 = 系列层短名（与常驻 Badge 同源，非他集标题）。 */
const ZONE_W = 250;
const ZONE_H = 150;
const ZONE_POS: {left: number; top: number}[] = [
  {left: 110, top: 300},
  {left: 385, top: 300},
  {left: 660, top: 300},
  {left: 248, top: 500},
  {left: 523, top: 500},
];

const WorkshopDarkMap: React.FC<{mapIn: number; lit: number[]}> = ({mapIn, lit}) => (
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
      const on = lit[i] ?? 0;
      const isLit = l.index === ACTIVE_INDEX;
      const pos = ZONE_POS[i];
      return (
        <div
          key={l.index}
          style={{
            position: 'absolute',
            left: pos.left,
            top: pos.top,
            opacity: mapIn * (isLit ? 0.4 + 0.6 * on : 0.5),
          }}
        >
          <PlateSlab3D
            layer={l}
            active={isLit}
            dim={isLit ? 1 : 0.55}
            glow={isLit ? on * 0.7 : 0}
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
      <div style={{position: 'absolute', left: 980, top: 310, opacity: cards[0], transform: `translateY(${(1 - cards[0]) * 18}px)`}}>
        <Panel accent={theme.core} style={{width: 820, boxSizing: 'border-box', padding: '30px 36px'}}>
          <div style={{fontFamily: theme.serif, fontSize: 24, color: theme.dim, letterSpacing: 3}}>
            {'Claude Code Harness Engineering'}
          </div>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 22}}>
            <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>{'工具与执行'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.panelBorder}}>{'|'}</span>
            <span style={{fontFamily: theme.serif, fontSize: 56, fontWeight: 700, color: theme.core}}>
              {'一个循环，三层装置'}
            </span>
          </div>
        </Panel>
      </div>
      {/* 下期卡：标题只在画面（口播只说「下期 + 话题」，反串线纪律） */}
      <div style={{position: 'absolute', left: 980, top: 640, opacity: cards[1], transform: `translateY(${(1 - cards[1]) * 18}px)`}}>
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
          <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text, marginTop: 8}}>
            {'视野错位的五种修正手法'}
          </div>
        </div>
      </div>
    </>
  );
};

/** 收尾编排：地图回落（p6-19）→ 身份卡/下期卡浮现（p6-20，@stagger）→
 *  灯牌收暗 + 全镜末 36 帧渐黑（p6-21；窗取整镜时长——红线四）。 */
const Finale: React.FC<{span: number; at19: number; at20: number; at21: number}> = ({
  span,
  at19,
  at20,
  at21,
}) => {
  const mapIn = useProgress(at19, DUR.f5);
  // 本集区点亮随 p6-19 收束句完成（地图进场后补一次辉光脉冲）
  const litZone = [useProgress(at19 + DUR.f4, DUR.f5), 0, 0, 0, 0];
  // 灯牌（1-A 同款 24h）收暗——「灯还亮着」直到渐黑前一刻
  const lamp = useDim({at: at21, to: 0.5, dur: DUR.f5});
  const keep = useFadeOut(span, {frames: 36});

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <WorkshopDarkMap mapIn={mapIn} lit={litZone} />
      {/* 灯牌：地图右上角，随收尾句压暗 */}
      <div
        style={{
          position: 'absolute',
          left: 806,
          top: 252,
          opacity: mapIn * lamp,
        }}
      >
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

export const P6OneLoop: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p6-01', 'p6-06');
  const bB = w('p6-07', 'p6-12');
  const bC = w('p6-13', 'p6-16');
  const bD = w('p6-17', 'p6-21');

  // 常驻条三段调度：6-A 栈在场窗口（p6-02..05）让位——五层信息已在栈上；6-B/C
  // 恢复；6-D 身份卡接管。progress 纯函数且恒 clamp 在 1，故「让位」必须写成
  // 窗（进场×退场），否则 6-A 之后永远为 0。
  const frame = useCurrentFrame();
  const stackShown =
    progress(frame, at('p6-02') - DUR.f3, DUR.f4) *
    (1 - progress(frame, at('p6-06') - DUR.f5, DUR.f5));
  const backIn = progress(frame, bB.from, DUR.f4);
  const hideForCard = progress(frame, bD.from, DUR.f4);
  const badgeO = (1 - stackShown) * backIn * (1 - hideForCard);

  return (
    <AbsoluteFill>
      <HarnessBadge style={{...BADGE_STYLE, opacity: badgeO}} />

      <Sequence {...bA} name="6-A 回答主线（3D）">
        <SceneTag chapter="One Loop" tagline="一个循环" />
        {/* 可见岛 p6-02..03（3D 栈）/ p6-06（代码页）；窗 = 本镜 3 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p6-01') - bA.from, durationInFrames: dur('p6-01')},
            {at: at('p6-04') - bA.from, durationInFrames: dur('p6-04')},
            {at: at('p6-05') - bA.from, durationInFrames: dur('p6-05')},
          ]}
        >
          <StackAnswer
            at02={at('p6-02') - bA.from}
            at03={at('p6-03') - bA.from}
            at06={at('p6-06') - bA.from}
          />
          <Sequence from={at('p6-06') - bA.from}>
            <CodePageFlip span06={dur('p6-06')} />
          </Sequence>
        </ArchifyYield>
        {/* cue 1..3/5：five-layer-dependency 实例一（本镜首图 → 默认入场） */}
        <ArchifyRecap
          slug="five-layer-dependency"
          caption="五层依赖"
          cues={[
            {chapterId: 'debt-chain', at: at('p6-01') - bA.from, durationInFrames: dur('p6-01')},
            {chapterId: 'one-loop', at: at('p6-04') - bA.from, durationInFrames: dur('p6-04')},
            {chapterId: 'grown-where', at: at('p6-05') - bA.from, durationInFrames: dur('p6-05')},
          ]}
        />
        {/* 金句卡定格：叠在 one-loop cue 窗后段（见文件头第二注） */}
        <Sequence from={at('p6-04') - bA.from} durationInFrames={dur('p6-04')} name="6-A 金句定格">
          <AnswerQuote />
        </Sequence>
      </Sequence>

      <Sequence {...bB} name="6-B 分工双人卡">
        <DivisionCards
          at08={at('p6-08') - bB.from}
          at09={at('p6-09') - bB.from}
          at10={at('p6-10') - bB.from}
          at11={at('p6-11') - bB.from}
          at12={at('p6-12') - bB.from}
        />
      </Sequence>

      <Sequence {...bC} name="6-C 开放天平">
        <BalanceOpen at16={at('p6-16') - bC.from} />
      </Sequence>

      <Sequence {...bD} name="6-D 收尾装置串（3D）">
        {/* 可见岛 p6-19..21（地图/身份卡/灯牌）；窗 = 本镜 2 条 cue 窗 */}
        <ArchifyYield
          cues={[
            {at: at('p6-17') - bD.from, durationInFrames: dur('p6-17')},
            {at: at('p6-18') - bD.from, durationInFrames: dur('p6-18')},
          ]}
        >
          <Finale
            span={bD.durationInFrames}
            at19={at('p6-19') - bD.from}
            at20={at('p6-20') - bD.from}
            at21={at('p6-21') - bD.from}
          />
        </ArchifyYield>
        {/* cue 4..5/5：five-layer-dependency 实例二——隔 p6-06..16 共 11 句空窗，
            画框已卸载 ⇒ 默认入场（分镜「背靠背」前提不成立，见文件头第一注） */}
        <ArchifyRecap
          slug="five-layer-dependency"
          caption="五层依赖"
          cues={[
            {chapterId: 'read-map', at: at('p6-17') - bD.from, durationInFrames: dur('p6-17')},
            {chapterId: 'four-dark-zones', at: at('p6-18') - bD.from, durationInFrames: dur('p6-18')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P6OneLoop;
