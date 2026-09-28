/** P6 收束（p6-01..19，5 镜 8 cue）——分镜 6-A…6-E。
 *
 *  cue 清单（8，全落 plan-panorama）：
 *   6-A question-return@p6-01 / workshop-answers@p6-02（实例一，默认入场）
 *   6-B m1-pinned@p6-03 … m5-protected@p6-07（实例二——承 6-A 背靠背 → lead={false}）
 *       visibility-only@p6-09（实例三：p6-08 空窗整句卸载后重现 → 默认入场，
 *       否则画框以全不透明一帧瞬现——ArchifyRecap 契约点名的缺陷形态）
 *   p6-08 空窗句回落：「零新本事」小卡（@enter:pop）
 *
 *  ★ 6-A/6-B 全屏回放主控（archify 独占），本两镜零自制装置；五装置逐一打钩
 *    （mech ×5）与台面 coreDeep 恒静〔M-001〕均由图内承担。
 *  ★ 6-C 金句卡终态〔M-003〕：全幅衬底 + 衬线定格（caption-dup-ok 豁免在案），
 *    一次性特效只作入场——句中点抽帧仍可读出该陈述。
 *  ★ 6-E 系列身份卡/下期卡：标题主段是 check_series 规则 8 的受检硬编码——
 *    本集「模型的视野是安排出来的」＋下集「会丢的和不能丢的」（改标题先改
 *    series.json 再同步此串）；层短名走 series-layers.json 数据（NEXT_LAYER）。
 *    灯牌收暗 + 末 36 帧渐黑（窗取整镜时长——红线四）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {DeskPlane, Footnote, Panel, SceneTag} from '../components/motifs';
import {
  ACTIVE_INDEX,
  HarnessBadge,
  HarnessStackP6,
  LAYERS,
  NEXT_LAYER,
} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, clamp01, progress, useBreathe, useDim, useEnter, useFadeOut, useProgress, useStagger} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：与 P0–P5 同值（顶边 y<56 归 frozen ChapterProgress；Integrate 统一核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** 本集层（series-layers.json 数据面——层短名走数据，标题主段走规则 8 受检硬编码） */
const ACTIVE_LAYER = LAYERS.find((l) => l.index === ACTIVE_INDEX) ?? null;

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 6-B p6-08 空窗回落：「零新本事」小卡 ────────────────────────────────

const ZeroCard: React.FC<{at08: number; at09: number}> = ({at08, at09}) => {
  const pop = useEnter('pop', {at: DUR.f2, dur: DUR.f4});
  // p6-09 画框回来前先退场（避免被入场弹簧半透明地压住）
  const out = useProgress(at09 - DUR.f3, DUR.f3);
  const o = pop.opacity * (1 - out);
  return (
    <div
      style={{
        position: 'absolute',
        left: 730,
        top: 420,
        width: 460,
        opacity: o,
        transform: pop.transform,
      }}
    >
      <Panel style={{boxSizing: 'border-box', padding: '20px 28px', textAlign: 'center'}}>
        <div style={{fontFamily: theme.sans, fontSize: 42, fontWeight: 700, color: theme.text}}>
          {'零新本事'}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 19, color: theme.dim, marginTop: 6}}>
          {'no new powers'}
        </div>
      </Panel>
    </div>
  );
};

// ── 6-C 金句卡终态〔M-003〕 ──────────────────────────────────────────────

/** 对开定格「师傅管想 · 工坊管看」：全幅衬底压住台面，衬线记忆点停驻到幕尾——
 *  一次性特效只作入场（淡入），无脉冲无巡游（持续陈述配持续态）。 */
const FinalQuote: React.FC = () => {
  const scrim = useProgress(DUR.f3, DUR.f4);
  const fade = useEnter('fade', {at: DUR.f2, dur: DUR.f4});
  return (
    <AbsoluteFill>
      {/* 台面恒静（承图集对账后的同一张台面；衬底之下只余框体的存在感） */}
      <DeskPlane />
      <AbsoluteFill style={{background: withAlpha(theme.bg, 0.9 * scrim)}} />
      <AbsoluteFill style={{opacity: fade.opacity}}>
        {/* caption-dup-ok: 金句卡定格记忆点，主字已压短非逐字（storyboard 6-C 同款豁免） */}
        <QuoteCard zh="师傅管想 · 工坊管看" />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── 6-D 开放问题：天平悬停不裁决 ─────────────────────────────────────────

/** 天平几何：支点 (960,545)，横梁 y460 半长 300；两盘悬于梁端（随摆微移、恒正立）。 */
const SCALE = {cx: 960, beamY: 460, half: 300, swayDeg: 2.2} as const;

const BalanceOpen: React.FC<{at14: number; at15: number}> = ({at14, at15}) => {
  const left = useEnter('slideL', {at: 2, dur: DUR.f5, dist: 60});
  const right = useEnter('slideR', {at: 6, dur: DUR.f5, dist: 60});
  // 悬停呼吸（dim）：正弦微摆永不停驻单侧——「不裁决」被看见
  const sway = useBreathe({period: 72, amp: 1, base: 0});
  const theta = (SCALE.swayDeg * sway * Math.PI) / 180;
  // 官方两头后手注记条（p6-14）与收束题词（p6-15）
  const stripIn = useProgress(at14, DUR.f4);
  const verdict = useProgress(at15, DUR.f4);

  const endL = {x: SCALE.cx - SCALE.half * Math.cos(theta), y: SCALE.beamY - SCALE.half * Math.sin(theta)};
  const endR = {x: SCALE.cx + SCALE.half * Math.cos(theta), y: SCALE.beamY + SCALE.half * Math.sin(theta)};

  const pan = (
    pos: {x: number; y: number},
    enter: {opacity: number; transform: string},
    tag: string,
    title: string,
    sub: string,
  ) => (
    <div style={{position: 'absolute', left: pos.x - 215, top: 585, ...enter}}>
      <Panel style={{width: 430, boxSizing: 'border-box', padding: '18px 24px'}}>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 12px',
            borderRadius: 999,
            border: `2px solid ${theme.dim}`,
            color: theme.dim,
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
        {/* 横梁（dim——悬停态本体，刻意不偏沉任何一侧） */}
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

      {/* 左盘：随模型进步逐件拆掉 / 右盘：本来就长在工坊身上（两头都无彩——不站队） */}
      {pan(endL, left, '脚手架', '逐件拆掉', '随模型进步')}
      {pan(endR, right, '工坊', '长在工坊身上', '结构自带')}

      {/* 官方两头后手注记条（dim 页样——同一文档里两头都留了后手） */}
      <div
        style={{
          position: 'absolute',
          left: 510,
          top: 792,
          width: 900,
          opacity: stripIn,
          transform: `translateY(${(1 - stripIn) * 12}px)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxSizing: 'border-box',
            padding: '14px 22px',
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 12,
            background: theme.panel,
          }}
        >
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
          <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.dim}}>
            {'关了清单 · 留了计划 · 任务能存'}
          </span>
        </div>
      </div>

      {/* p6-15 收束题词：留白不裁决 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 872,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 34,
          opacity: verdict,
        }}
      >
        <span style={{color: theme.dim}}>{'拆还是留'}</span>
        <span style={{color: theme.dim}}>{' · '}</span>
        <span style={{color: theme.text, fontWeight: 700}}>{'值得盯'}</span>
      </div>

      <Footnote delay={at14}>{'plan mode · tasks persist across compactions'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 6-E 收尾装置串：3D 栈放大 + 身份卡/下期卡 + 灯牌收暗渐黑 ────────────

/** 身份卡 + 下期卡（chip 档）：标题主段受检硬编码（规则 8，见文件头）；层短名走数据。 */
const SeriesCards: React.FC<{at16: number; at18: number}> = ({at16, at18}) => {
  const cardsAt = at16 + DUR.f4;
  // 身份卡随栈到场（p6-16），下期卡压到下期句（p6-18）——stride 由两句边界推导
  const cards = useStagger(2, {at: cardsAt, stride: Math.max(24, at18 - cardsAt), dur: DUR.f5});
  return (
    <>
      {/* 系列身份卡 */}
      <div
        style={{
          position: 'absolute',
          left: 980,
          top: 300,
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
              {ACTIVE_LAYER?.layer ?? ''}
            </span>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.panelBorder}}>{'|'}</span>
            <span style={{fontFamily: theme.serif, fontSize: 48, fontWeight: 700, color: theme.core}}>
              {'模型的视野是安排出来的'}
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
            {'会丢的和不能丢的'}
          </div>
        </div>
      </div>
    </>
  );
};

/** 收尾编排：3D 栈放大居中（p6-16）→ 下期层呼吸（p6-18）→ 灯牌收暗（p6-19）
 *  → 末 36 帧渐黑（窗取整镜时长——红线四，勿用末句时长）。 */
const Finale: React.FC<{at16: number; at18: number; at19: number; span: number}> = ({
  at16,
  at18,
  at19,
  span,
}) => {
  const stackIn = useProgress(at16, DUR.f4);
  const slogan = useProgress(at16 + DUR.f4, DUR.f4);
  // 灯牌（工坊不打烊）随栈进场；p6-19「灯还亮着」直到收暗前一刻
  const lampIn = useProgress(at16 + DUR.f5, DUR.f4);
  const lamp = useDim({at: at19, to: 0.45, dur: DUR.f5});
  const keep = useFadeOut(span, {frames: 36});

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 380, top: 310, opacity: stackIn}}>
        <HarnessStackP6 at={at16 + 2} nextBreathAt={at18 + DUR.f3} />
      </div>
      {/* 系列标语压在栈底（08「P6 收尾用法」）；top 由栈几何推导：
          栈顶 310 + 5 层×56 + 4 间距×8 = 622，PlateSlab3D 3D 厚度下探约 28px，
          实测 3D 底边下探更深，留足呼吸 → 704（原写死 650 与第五层 3D 底边叠压，草渲 t845 目检发现） */}
      <div
        style={{
          position: 'absolute',
          left: 380,
          top: 310 + 5 * 56 + 4 * 8 + 82,
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
      {/* 工坊灯牌：栈侧上方，随收尾句压暗（「灯还亮着」的落点） */}
      <div style={{position: 'absolute', left: 828, top: 300, opacity: lampIn * lamp}}>
        <Panel style={{padding: '6px 16px'}}>
          <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{'24h'}</span>
        </Panel>
      </div>
      <SeriesCards at16={at16} at18={at18} />
      {/* 渐黑遮罩：末 36 帧，窗取整镜时长（红线四——勿用末句时长） */}
      <AbsoluteFill style={{background: '#000', opacity: 1 - keep}} />
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P6Arranged: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p6-01', 'p6-02');
  const bB = w('p6-03', 'p6-09');
  const bC = w('p6-10', 'p6-11');
  const bD = w('p6-12', 'p6-15');
  const bE = w('p6-16', 'p6-19');

  // 常驻条调度：6-A..6-D 在场；6-E 身份卡接管后淡出（progress 恒 clamp 1，
  // 「让位」写成 1 - progress 窗即单程退场）
  const frame = useCurrentFrame();
  const badgeO = 1 - progress(frame, bE.from, DUR.f4);

  return (
    <AbsoluteFill>
      <HarnessBadge style={{...BADGE_STYLE, opacity: badgeO}} />

      <Sequence {...bA} name="6-A 总装回放起手">
        <SceneTag chapter="Arranged View" tagline="收束" />
        {/* cue 1..2/8：plan-panorama 实例一（本幕首图 → 默认入场；章间背靠背不重弹） */}
        <ArchifyRecap
          slug="plan-panorama"
          caption="规划全景"
          cues={[
            {chapterId: 'question-return', at: at('p6-01') - bA.from, durationInFrames: dur('p6-01')},
            {chapterId: 'workshop-answers', at: at('p6-02') - bA.from, durationInFrames: dur('p6-02')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="6-B 五机制收账">
        {/* p6-08 空窗句回落小卡（画框卸载的一句里，唯一的画面元素） */}
        <ZeroCard at08={at('p6-08') - bB.from} at09={at('p6-09') - bB.from} />
        {/* cue 3..7/8：plan-panorama 实例二——承 6-A 背靠背 → lead={false}（章间本就
            连续换章，实例级关入场防画框重放约 12 帧弹簧） */}
        <ArchifyRecap
          slug="plan-panorama"
          caption="规划全景"
          lead={false}
          cues={[
            {chapterId: 'm1-pinned', at: at('p6-03') - bB.from, durationInFrames: dur('p6-03')},
            {chapterId: 'm2-isolated', at: at('p6-04') - bB.from, durationInFrames: dur('p6-04')},
            {chapterId: 'm3-two-books', at: at('p6-05') - bB.from, durationInFrames: dur('p6-05')},
            {chapterId: 'm4-relaid', at: at('p6-06') - bB.from, durationInFrames: dur('p6-06')},
            {chapterId: 'm5-protected', at: at('p6-07') - bB.from, durationInFrames: dur('p6-07')},
          ]}
        />
        {/* cue 8/8：plan-panorama 实例三——p6-08 空窗整句卸载后重现 → 默认入场
            （lead={false} 会连空窗后重现一起压掉入场，一帧瞬现即缺陷） */}
        <ArchifyRecap
          slug="plan-panorama"
          caption="规划全景"
          cues={[
            {chapterId: 'visibility-only', at: at('p6-09') - bB.from, durationInFrames: dur('p6-09')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="6-C 金句卡终态">
        <FinalQuote />
      </Sequence>

      <Sequence {...bD} name="6-D 开放天平">
        <BalanceOpen at14={at('p6-14') - bD.from} at15={at('p6-15') - bD.from} />
      </Sequence>

      <Sequence {...bE} name="6-E 收尾装置串（3D）">
        <Finale
          at16={at('p6-16') - bE.from}
          at18={at('p6-18') - bE.from}
          at19={at('p6-19') - bE.from}
          span={bE.durationInFrames}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P6Arranged;
