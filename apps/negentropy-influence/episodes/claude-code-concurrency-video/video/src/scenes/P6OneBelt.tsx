/** P6 收束（p6-01..18，3 镜 2 cue）——分镜 6-A…6-C。
 *
 *  cue 清单（2，全落 timing-panorama）：
 *   6-A one-belt-close@p6-06（全景对账终态·装置都在动带仍一条，默认入场）
 *   6-C where-waiting-goes@p6-13（读图法收束；与 6-A 实例隔 6 句空窗 → 默认入场）
 *
 *  ★ 6-A 的 3D 栈放大由 components/harness-stack.tsx 的 HarnessStackP6 承担；
 *    系列题字压栈底——top 由栈几何推导：310 + 5×56 + 4×8 = 622，3D 底边下探
 *    实测更深，安全距 +82 → 704（ep2 教训：写死 650 会与第五层 3D 底边叠压）。
 *  ★ 6-C 身份卡标题主段「谁来按下开始」／下期卡「从一个到一群」是 check_series
 *    规则 8 的受检硬编码（改标题先改 series.json 再同步此串）；层短名走
 *    series-layers.json 数据（NEXT_LAYER）。工坊地图开灯口径：lit = 层 index ≤
 *    本集（口播 p6-14「只剩最后一个区没亮灯」的画面契约），末区 dim 呼吸不亮。
 *  ★ 末 36 帧渐黑窗取整镜（6-C）时长——红线四：勿用末句时长。
 *  ★ 金句卡两张（p6-05 / p6-08）均为压短定格形态，caption-dup-ok 留痕见行内。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Footnote, LoopRing, Panel, SceneTag} from '../components/motifs';
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
  useFadeOut,
  useImpulse,
  useProgress,
  useStagger,
} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：与 P0–P5 同值（顶边 y<56 归 frozen ChapterProgress）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 传送带底盘左中锚位与巡游节律——与 P0 同位同尺同速（空间契约）。 */
const RING = {size: 300, left: 180, top: 390} as const;
const LAP_FRAMES = 75;

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 人形剪影（师傅 = text 白，无彩——与 P0 同形，scenes 不跨幕 import） */
const Person: React.FC<{color: string; scale?: number; opacity?: number}> = ({
  color,
  scale = 1,
  opacity = 0.9,
}) => (
  <svg width={120 * scale} height={180 * scale} viewBox="0 0 120 180" style={{opacity}}>
    <circle cx={60} cy={34} r={28} fill={color} />
    <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={color} />
  </svg>
);

// ── 6-A 两问对账：3D 栈 + 对账卡 + 金句收埋线 + 师傅走开 ─────────────────

/** 两问对账卡数据（p6-02／p6-03 逐句打钩）。 */
const LEDGER = [
  {q: '慢活等不等？', a: '不等 · 号牌先收'},
  {q: '到点的活谁来按？', a: '没人按 · 钟替看表'},
] as const;

/** 栈回答装置：HarnessStackP6 放大居中（并发层常亮）＋系列标语压栈底；
 *  两问题对账卡逐个打钩；p6-05 金句卡定格收埋线；p6-06 起整体淡出。 */
const STACK = {left: 750, top: 310} as const; // 题字避让几何见文件头

const ClosingStack: React.FC<{at02: number; at03: number; at04: number; at06: number}> = ({
  at02,
  at03,
  at04,
  at06,
}) => {
  const stackIn = useProgress(2, DUR.f4);
  const slogan = useProgress(2 + DUR.f4, DUR.f4);
  const out = useProgress(at06 - DUR.f5, DUR.f5);
  // 对账卡骨架（p6-01「回到开头那两个问题」中段入场），打钩逐句点亮
  const cards = useStagger(2, {at: 30, dur: DUR.f5, stride: 8});
  const check1 = useProgress(at02 + DUR.f3, DUR.f4);
  const check2 = useProgress(at03 + DUR.f3, DUR.f4);
  const checks = [check1, check2];
  // p6-04「两类时间，都还回来了」收拢行；下期层呼吸预告压在其后
  const tagline = useProgress(at04, DUR.f4);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: STACK.left, top: STACK.top, opacity: stackIn * (1 - out)}}>
        <HarnessStackP6 at={4} nextBreathAt={at04 + DUR.f6} />
      </div>
      {/* 系列标语压在栈底（08「P6 收尾用法」）；top 由栈几何推导＋82 安全距（文件头） */}
      <div
        style={{
          position: 'absolute',
          left: STACK.left,
          top: STACK.top + 5 * 56 + 4 * 8 + 82,
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

      {/* 两问题对账卡（逐个打钩；p6-06 起随栈同拍退场） */}
      {LEDGER.map((l, i) => (
        <div
          key={l.q}
          style={{
            position: 'absolute',
            left: 120,
            top: 330 + i * 200,
            opacity: cards[i] * (1 - out),
            transform: `translateY(${(1 - cards[i]) * 18}px)`,
          }}
        >
          <Panel
            accent={checks[i] > 0.5 ? theme.mech : theme.panelBorder}
            style={{width: 560, boxSizing: 'border-box', padding: '22px 28px'}}
          >
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16}}>
              <div>
                <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.dim}}>{l.q}</div>
                <div
                  style={{
                    fontFamily: theme.sans,
                    fontSize: 34,
                    fontWeight: 600,
                    color: checks[i] > 0.5 ? theme.text : theme.dim,
                    marginTop: 8,
                  }}
                >
                  {l.a}
                </div>
              </div>
              {/* 打钩：逐句点亮（mech——装置给出的回答） */}
              <span
                style={{
                  fontFamily: theme.sans,
                  fontSize: 46,
                  fontWeight: 700,
                  color: theme.mech,
                  opacity: checks[i],
                  transform: `scale(${0.7 + 0.3 * checks[i]})`,
                  textShadow: `0 0 ${12 * checks[i]}px ${withAlpha(theme.mech, 0.45 * checks[i])}`,
                }}
              >
                {'✓'}
              </span>
            </div>
          </Panel>
        </div>
      ))}

      {/* p6-04 收拢行 */}
      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 742,
          width: 560,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.dim,
          letterSpacing: 2,
          opacity: tagline * (1 - out),
        }}
      >
        {'都还回来了'}
      </div>
    </AbsoluteFill>
  );
};

/** 金句卡接管层（p6-05 同窗定格）：衬底先入场数帧再压暗，衬线记忆点定格到
 *  窗尾（caption-dup-ok：主字压短非逐字，storyboard 6-A 豁免在案）。 */
const AnswerQuote: React.FC = () => {
  const o = useProgress(DUR.f4, DUR.f4);
  return (
    <AbsoluteFill style={{background: withAlpha(theme.bg, 0.84 * o), pointerEvents: 'none'}}>
      {/* caption-dup-ok: 金句卡定格记忆点，主字已压短非逐字（storyboard 6-A 豁免在案） */}
      <QuoteCard zh="后台 · 没有平行宇宙" />
    </AbsoluteFill>
  );
};

/** p6-07「师傅不站着等」：底盘在 archify 窗内归位（窗外不可见，切换零跳变），
 *  师傅剪影从干站位走开（带仍恒转——装置时代「带不停」的空间契约）。 */
const WalkAway: React.FC<{at06: number; at07: number; span: number}> = ({at06, at07, span}) => {
  const ringIn = useProgress(at06, DUR.f4);
  const rest = Math.max(1, span - at07);
  const laps = useProgress(at07, rest, 'linear') * (rest / LAP_FRAMES);
  // 走开动势：向右离场（约 2/3 句窗内完成行程，余下渐隐）
  const walk = useProgress(at07 + 2, Math.max(1, Math.round(rest * 0.66)));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: RING.left, top: RING.top, opacity: ringIn}}>
        <LoopRing size={RING.size} dotProgress={laps} showLabels={false} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 512,
          top: 550,
          opacity: ringIn * (1 - 0.45 * walk),
          transform: `translateX(${280 * walk}px)`,
        }}
      >
        <Person color={theme.text} opacity={0.92} />
      </div>
    </AbsoluteFill>
  );
};

// ── 6-B 遗产句 + 三装置对账 ──────────────────────────────────────────────

/** 三装置对账卡（清洗槽／叫号器／定时钟——幕序排列，mech ×3 逐一打钩）。 */
const DEVICES = ['清洗槽', '叫号器', '定时钟'] as const;

const LegacyCards: React.FC<{at08: number; at09: number; at10: number; at11: number}> = ({
  at08,
  at09,
  at10,
  at11,
}) => {
  // 遗产句金句卡：终态定格〔M-003〕——一次性入场，句中点抽帧仍可读
  const legacyIn = useProgress(at08, DUR.f5);
  // 三装置对账卡：逐一打钩（stagger 骨架即打钩节奏）
  const devs = useStagger(3, {at: at09 + 4, dur: DUR.f4, stride: 10});
  // 边界重申小卡（deny 描边）＋轻脉冲
  const boundIn = useProgress(at10, DUR.f4);
  const pulse = useImpulse({at: at10 + 8, dur: DUR.f6, peak: 1});
  // p6-11 边界内外两侧小标
  const edgesIn = useProgress(at11, DUR.f4);
  // core 橙底盘恒静于卡底（〔M-001〕：恒色恒线宽，无光点——静止代言）
  const baseIn = useProgress(at08 + 10, DUR.f5);

  return (
    <AbsoluteFill>
      {/* 遗产句金句卡（主字＋对句小字） */}
      <div
        style={{
          position: 'absolute',
          left: 500,
          top: 200,
          opacity: legacyIn,
          transform: `translateY(${(1 - legacyIn) * 16}px)`,
        }}
      >
        <Panel accent={theme.core} style={{width: 920, boxSizing: 'border-box', padding: '30px 40px'}}>
          {/* caption-dup-ok: 遗产句金句卡刻意定格，主字已压短非逐字（storyboard 6-B 豁免在案） */}
          <div style={{fontFamily: theme.serif, fontSize: 54, fontWeight: 700, color: theme.text}}>
            {'等待可以外包'}
          </div>
          {/* caption-dup-ok: 对句小字压短非逐字（同上豁免） */}
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 14}}>
            {'外包的是等待 · 不是永动'}
          </div>
        </Panel>
      </div>

      {/* 边界重申小卡（deny 描边＋轻脉冲）＋p6-11 两侧小标 */}
      <div style={{position: 'absolute', left: 810, top: 424, opacity: boundIn}}>
        <Panel
          accent={theme.deny}
          style={{
            width: 300,
            boxSizing: 'border-box',
            padding: '12px 0',
            textAlign: 'center',
            boxShadow: `0 0 ${18 * pulse}px ${withAlpha(theme.deny, 0.4 * pulse)}`,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.deny}}>
            {'打烊 · 钟停'}
          </span>
        </Panel>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 500,
          top: 436,
          width: 280,
          textAlign: 'right',
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
          opacity: edgesIn,
        }}
      >
        {'边界之内 · 尽管挂'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1140,
          top: 436,
          width: 280,
          fontFamily: theme.sans,
          fontSize: 22,
          color: theme.dim,
          opacity: edgesIn,
        }}
      >
        {'边界之外 · 系统云端'}
      </div>

      {/* 三装置对账卡（mech ×3 逐一打钩） */}
      {DEVICES.map((d, i) => (
        <div
          key={d}
          style={{
            position: 'absolute',
            left: 350 + i * 420,
            top: 540,
            opacity: devs[i],
            transform: `translateY(${(1 - devs[i]) * 16}px)`,
          }}
        >
          <Panel accent={theme.mech} style={{width: 380, boxSizing: 'border-box', padding: '24px 30px'}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <span style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 600, color: theme.text}}>
                {d}
              </span>
              <span
                style={{
                  fontFamily: theme.sans,
                  fontSize: 42,
                  fontWeight: 700,
                  color: theme.mech,
                  transform: `scale(${0.7 + 0.3 * devs[i]})`,
                }}
              >
                {'✓'}
              </span>
            </div>
          </Panel>
        </div>
      ))}

      {/* core 橙底盘恒静于卡底（〔M-001〕小尺档：无标签无出口，静止＝收束） */}
      <div style={{position: 'absolute', left: 880, top: 705, opacity: baseIn}}>
        <LoopRing size={200} showLabels={false} showExit={false} />
      </div>
    </AbsoluteFill>
  );
};

// ── 6-C 读图法与系列收尾 ────────────────────────────────────────────────

/** 读图法两问小卡（p6-12 空窗回落）。 */
const GUIDE = ['等待放哪里', '开始交给谁'] as const;

const ReadGuide: React.FC = () => {
  const cards = useStagger(2, {at: 2, dur: DUR.f5, stride: 8});
  return (
    <AbsoluteFill>
      {GUIDE.map((g, i) => (
        <div
          key={g}
          style={{
            position: 'absolute',
            left: 520 + i * 480,
            top: 400,
            opacity: cards[i],
            transform: `translateY(${(1 - cards[i]) * 18}px)`,
          }}
        >
          <Panel style={{width: 400, boxSizing: 'border-box', padding: '26px 32px'}}>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 600, color: theme.text, marginTop: 6}}>
              {g}
            </div>
          </Panel>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** 工坊地图五区板（3D，零 motion hook——数值全由 props 注入）：lit = 层 index ≤
 *  本集（1..4 亮），末区（多 Agent 平台）dim 呼吸不亮。区名 = 系列层短名。 */
const ZONE_W = 250;
const ZONE_H = 150;
const ZONE_POS: {left: number; top: number}[] = [
  {left: 110, top: 300},
  {left: 385, top: 300},
  {left: 660, top: 300},
  {left: 248, top: 500},
  {left: 523, top: 500},
];

const WorkshopMap: React.FC<{mapIn: number; zoneLit: number[]; lastBreath: number}> = ({
  mapIn,
  zoneLit,
  lastBreath,
}) => (
  <>
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
      // 末区（下期层）不亮灯：dim 低频呼吸（0.35±0.25·breathe）——「没亮」被看见
      const zoneO = lit ? mapIn * (0.35 + 0.65 * (zoneLit[i] ?? 0)) : mapIn * (0.35 + 0.25 * lastBreath);
      return (
        <div key={l.index} style={{position: 'absolute', left: pos.left, top: pos.top, opacity: zoneO}}>
          <PlateSlab3D
            layer={l}
            active={lit}
            dim={isFocus ? 1 : lit ? 0.86 : 0.45}
            glow={isFocus ? (zoneLit[i] ?? 0) * 0.7 : 0}
            width={ZONE_W}
            height={ZONE_H}
            p6
          />
        </div>
      );
    })}
  </>
);

/** 身份卡 + 下期卡（chip 档）：标题主段受检硬编码（规则 8，见文件头）；层短名走数据。 */
const SeriesCards: React.FC<{at14: number; at16: number}> = ({at14, at16}) => {
  const cardsAt = at14 + DUR.f4;
  // 身份卡随地图到场（p6-14），下期卡压到下期句（p6-16）——stride 由句边界推导
  const cards = useStagger(2, {at: cardsAt, stride: Math.max(24, at16 - cardsAt), dur: DUR.f5});
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
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 22, whiteSpace: 'nowrap'}}>
            <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>
              {LAYERS[ACTIVE_INDEX - 1]?.layer ?? ''}
            </span>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.panelBorder}}>{'|'}</span>
            <span style={{fontFamily: theme.serif, fontSize: 48, fontWeight: 700, color: theme.core}}>
              {'谁来按下开始'}
            </span>
          </div>
        </Panel>
      </div>
      {/* 下期卡：标题只在画面（口播只说「下期」，反串线纪律）；层短名走数据 */}
      <div
        style={{
          position: 'absolute',
          left: 980,
          top: 620,
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
          <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.text, marginTop: 8}}>
            {'从一个到一群'}
          </div>
        </div>
      </div>
    </>
  );
};

/** 收尾编排：读图法（p6-12）→ 地图亮灯＋身份卡（p6-14..15）→ 下期卡（p6-16..17）
 *  → 灯牌收暗＋末 36 帧渐黑（p6-18；窗取整镜时长——红线四）。 */
const Finale: React.FC<{at14: number; at16: number; at18: number; span: number}> = ({
  at14,
  at16,
  at18,
  span,
}) => {
  const mapIn = useProgress(at14, DUR.f5);
  // 数区亮灯：四区（层 1..4）随 p6-14..15 逐区点亮
  const zones = useStagger(4, {at: at14 + 10, dur: DUR.f4, stride: 14});
  // 末区暗态呼吸（dim 低频）
  const lastBreath = useBreathe({period: 130, amp: 0.5, base: 0.5});
  // 灯牌（工坊不打烊）随地图进场；p6-18「灯还亮着」直到收暗前一刻
  const lamp = useDim({at: at18, to: 0.45, dur: DUR.f5});
  const keep = useFadeOut(span, {frames: 36});

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <WorkshopMap mapIn={mapIn} zoneLit={zones} lastBreath={lastBreath} />
      {/* 工坊灯牌：地图右上角，随收尾句压暗 */}
      <div style={{position: 'absolute', left: 830, top: 240, opacity: mapIn * lamp}}>
        <Panel style={{padding: '6px 16px', display: 'flex', gap: 10, alignItems: 'baseline'}}>
          <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{'24h'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{'不打烊'}</span>
        </Panel>
      </div>
      <SeriesCards at14={at14} at16={at16} />
      {/* 渐黑遮罩：末 36 帧，窗取整镜时长（红线四——勿用末句时长） */}
      <AbsoluteFill style={{background: '#000', opacity: 1 - keep}} />
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P6OneBelt: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p6-01', 'p6-07');
  const bB = w('p6-08', 'p6-11');
  const bC = w('p6-12', 'p6-18');

  // 常驻条调度：6-A 栈在场（五层信息已在栈上）隐藏；6-B 恢复；6-C 身份卡接管再隐藏
  const frame = useCurrentFrame();
  const backIn = progress(frame, bB.from, DUR.f4);
  const hideForCard = progress(frame, bC.from, DUR.f4);
  const badgeO = backIn * (1 - hideForCard);

  return (
    <AbsoluteFill>
      <HarnessBadge style={{...BADGE_STYLE, opacity: badgeO}} />

      <Sequence {...bA} name="6-A 两问对账（3D）">
        <SceneTag chapter="One Belt" tagline="收束" />
        {/* 可见岛 p6-01..05（栈/对账卡）与 p6-07（师傅走开）；窗 = 本镜 1 条 cue 窗 */}
        <ArchifyYield cues={[{at: at('p6-06') - bA.from, durationInFrames: dur('p6-06')}]}>
          <ClosingStack
            at02={at('p6-02') - bA.from}
            at03={at('p6-03') - bA.from}
            at04={at('p6-04') - bA.from}
            at06={at('p6-06') - bA.from}
          />
          <WalkAway at06={at('p6-06') - bA.from} at07={at('p6-07') - bA.from} span={bA.durationInFrames} />
          {/* 金句卡定格：p6-05 收开头埋的那句话（窗尽即让位 archify） */}
          <Sequence from={at('p6-05') - bA.from} durationInFrames={dur('p6-05')} name="6-A 金句定格">
            <AnswerQuote />
          </Sequence>
        </ArchifyYield>
        {/* cue 1/2：timing-panorama/one-belt-close（全景对账终态；本镜首图 → 默认入场） */}
        <ArchifyRecap
          slug="timing-panorama"
          caption="时机全景"
          cues={[
            {chapterId: 'one-belt-close', at: at('p6-06') - bA.from, durationInFrames: dur('p6-06')},
          ]}
        />
        <Footnote>{'run_in_background · agent_lock · cron'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="6-B 遗产句与三装置">
        <LegacyCards
          at08={at('p6-08') - bB.from}
          at09={at('p6-09') - bB.from}
          at10={at('p6-10') - bB.from}
          at11={at('p6-11') - bB.from}
        />
      </Sequence>

      <Sequence {...bC} name="6-C 读图法与系列收尾">
        {/* 可见岛 p6-12（读图法）/ p6-14..18（地图+卡+灯牌）；窗 = 本镜 1 条 cue 窗 */}
        <ArchifyYield cues={[{at: at('p6-13') - bC.from, durationInFrames: dur('p6-13')}]}>
          <Sequence from={0} durationInFrames={at('p6-13') - bC.from}>
            <ReadGuide />
          </Sequence>
          <Finale
            at14={at('p6-14') - bC.from}
            at16={at('p6-16') - bC.from}
            at18={at('p6-18') - bC.from}
            span={bC.durationInFrames}
          />
        </ArchifyYield>
        {/* cue 2/2：timing-panorama/where-waiting-goes（读图法收束；与 6-A 实例隔 6 句空窗 → 默认入场） */}
        <ArchifyRecap
          slug="timing-panorama"
          caption="时机全景"
          cues={[
            {chapterId: 'where-waiting-goes', at: at('p6-13') - bC.from, durationInFrames: dur('p6-13')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P6OneBelt;
