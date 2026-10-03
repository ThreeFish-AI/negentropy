/** P0 失忆的楼（p0-01..12，3 镜 4 cue）——分镜 0-A…0-C。
 *
 *  cue 清单（4，全落 seven-artifacts——换房预告的逐章全屏回放）：
 *   0-C overview@p0-08（楼体总图）→ public-five@p0-09（楼下五设施）
 *   0-C private-rooms@p0-10（楼上房带）→ corridor@p0-11（走廊环点亮〔M-001〕）
 *   章毕 p0-12 缩为右上角 LodgeMap 常驻坐标装置（第七位留「?」预告态）。
 *
 *  ★ 0-A 开篇首镜视听合力（RSI-039）：首秒全黑城市 → 单楼 flyIn + 逐窗 stagger
 *    亮灯，与 p0-01「这是」同步发力，严禁静止文字卡。
 *  ★ 0-A p0-03 起 HarnessStackP0 落板（五层落板+本集层脉冲+缩退，≤3 句内完成，
 *    编排在 harness-stack 内；此处只做 Badge 位置迁移——ep4 先例）。
 *  ★ 0-B 四模块细节卡溢出掉落（@enter:fall）＋旧清单蒸发（@dim）＋p0-07 主问题
 *    金句卡浮起（@enter:rise＋弹簧）——该问句 6-J 天亮回收。
 *  ★ 空间契约自此幕立起：楼下=公共设施层（赭金）、楼上=私人房层（深赭装饰线）
 *    〔X-001〕；走廊环本幕不出现（0-C 由 archify 定妆、6-A 本集母题放大揭晓）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {QuoteCard} from '../components/cards';
import {Footnote, LODGE_INK, LodgeMap, NumberedCard, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge, HarnessStackP0, harnessStackCrossAt} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {DUR, clamp01, progress, useDim, useEnter, useImpulse, useProgress, useStagger} from '../motion';

// ── 本幕通用 ────────────────────────────────────────────────────────────

/** 常驻系列条定位：顶边 y<56 归 frozen ChapterProgress，Badge 挂其下（ep4 裁决形态）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

/** hex + 动态透明度（帧驱动，无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

/** 夜空天际线基色（bg 族深面——模块内面色常量，不进 theme） */
const SKYLINE = '#121820';
/** 开场黑罩（bg 族深面·一次性——模块内装饰底，不进 theme；storyboard 契约「母题装饰底」行登记） */
const NIGHT_VEIL = '#04060a';
/** 亮窗暖光（accent 的低透明身位） */
const WIN = (a: number) => withAlpha(theme.accent, a);

/** 师傅剪影（text 白，无彩——「师傅一律无彩」空间契约） */
const Person: React.FC<{x: number; y: number; scale?: number; opacity?: number}> = ({
  x,
  y,
  scale = 1,
  opacity = 0.9,
}) => (
  <svg
    width={120 * scale}
    height={180 * scale}
    viewBox="0 0 120 180"
    style={{position: 'absolute', left: x, top: y, opacity}}
  >
    <circle cx={60} cy={34} r={28} fill={theme.text} />
    <path d="M0 180 Q0 76 60 70 Q120 76 120 180 Z" fill={theme.text} />
  </svg>
);

// ── 0-A 钩子·楼亮灯 ─────────────────────────────────────────────────────

/** 楼体几何（居中两层剖面）：上层 4 暗格、下层 5 设施虚位＋走廊位留白。 */
const LODGE = {left: 560, top: 190, w: 800, h: 560} as const;
const UPPER = {y: 0, h: 250} as const;
const LOWER = {y: 250, h: 310} as const;

/** Harness 落板：栈编排在 HarnessStackP0 内；此处只做 Badge 位置迁移
 *  （内置 top:12 常驻条在 crossAt 前整层淡杀、同拍淡入本幕 top:64 条——ep4 先例）。
 *  RECEDE_AT=64：落板 39f＋两轮呼吸 30f 后缩退，p0-03 句窗（~97f）内完成（≤3 句）。 */
const RECEDE_AT = 64;

const StackReveal: React.FC = () => {
  const crossAt = harnessStackCrossAt(RECEDE_AT);
  const kill = useProgress(crossAt, DUR.f3);
  const badgeIn = useProgress(crossAt, 8);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{opacity: 1 - kill}}>
        <HarnessStackP0 recedeAt={RECEDE_AT} />
      </div>
      <HarnessBadge style={{...BADGE_STYLE, opacity: badgeIn}} />
    </AbsoluteFill>
  );
};

/** 深夜城市一角：天际线剪影＋两层小楼。首秒高反差——全黑罩 8 帧内掀起、
 *  楼体 flyIn，窗口自左向右 stagger 亮灯（与 p0-01「这是」同步）；
 *  p0-02 师傅伏案又擦除重来（纸面压暗＋碎屑掉落）；p0-03 舞台压暗让位落板栈。 */
const LodgeStage: React.FC<{at02: number; at03: number}> = ({at02, at03}) => {
  const frame = useCurrentFrame();
  const fly = useEnter('flyIn', {at: 2, dur: DUR.f5, springPreset: 'settle', easing: 'decelerate'});
  // 全黑城市 → 单楼亮起（首秒高反差；「这是」≈ 前 0.5s）
  const nightLift = useProgress(0, 10);
  // 逐窗亮灯：上层 4 窗在前、下层 5 窗在后，自左向右
  const ups = useStagger(4, {at: 8, dur: DUR.f3, stride: 4});
  const lows = useStagger(5, {at: 8 + 4 * 4, dur: DUR.f3, stride: 4});
  // p0-02「装不下的直接丢」：纸面压暗＋碎屑掉落（擦除重来）
  const eraseDim = useDim({at: at02 + 10, to: 0.3, dur: DUR.f5});
  const crumbIn = useProgress(at02 + 12, DUR.f3);
  const crumbs = useStagger(3, {at: at02 + 14, dur: DUR.f4, stride: 3});
  // p0-03「这就是灾难」：舞台压暗 65% 作栈的背景
  const stageDim = useDim({at: at03, to: 0.35, dur: DUR.f5});
  const o = stageDim;

  const upperWins = [0, 1, 2, 3].map((i) => ({x: LODGE.left + 90 + i * 170}));
  const lowerBays = [0, 1, 2, 3, 4].map((i) => ({x: LODGE.left + 65 + i * 140}));

  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: o}}>
      {/* 天际线剪影（深面族，恒比 bg 亮半档） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {[
          {x: 40, w: 130, h: 300},
          {x: 210, w: 100, h: 220},
          {x: 330, w: 160, h: 380},
          {x: 1560, w: 120, h: 260},
          {x: 1710, w: 150, h: 340},
        ].map((b) => (
          <rect key={b.x} x={b.x} y={750 - b.h} width={b.w} height={b.h} fill={SKYLINE} />
        ))}
        <rect x={0} y={750} width={1920} height={330} fill={SKYLINE} opacity={0.6} />
      </svg>

      {/* 两层小楼（flyIn 弹簧落位） */}
      <div style={{position: 'absolute', left: LODGE.left, top: LODGE.top, width: LODGE.w, height: LODGE.h, ...fly}}>
        <svg width={LODGE.w} height={LODGE.h}>
          {/* 楼体轮廓 */}
          <rect x={0} y={0} width={LODGE.w} height={LODGE.h} rx={12} fill={LODGE_INK} stroke={theme.panelBorder} strokeWidth={3} />
          {/* 楼层分隔线（楼上私人层 / 楼下公共层〔X-001〕） */}
          <line x1={0} y1={250} x2={LODGE.w} y2={250} stroke={theme.panelBorder} strokeWidth={2} opacity={0.8} />
          {/* 楼顶小檐 */}
          <rect x={-14} y={-16} width={LODGE.w + 28} height={18} rx={4} fill={LODGE_INK} stroke={theme.panelBorder} strokeWidth={2} />
          {/* 上层房带：暗格（深赭装饰线，亮窗微光） */}
          {upperWins.map((w, i) => (
            <g key={i}>
              <rect x={w.x} y={UPPER.y + 48} width={110} height={120} rx={6} fill={WIN(0.1 + 0.38 * ups[i])} stroke={theme.mechDeep} strokeWidth={2} />
              <line x1={w.x + 55} y1={UPPER.y + 48} x2={w.x + 55} y2={UPPER.y + 168} stroke={theme.mechDeep} strokeWidth={1.4} opacity={0.7} />
            </g>
          ))}
          {/* 楼下五设施虚位（虚线格——今晚挨个亮灯的空位） */}
          {lowerBays.map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={LOWER.y + 46} width={104} height={130} rx={6} fill={WIN(0.12 + 0.5 * lows[i])} stroke={theme.panelBorder} strokeWidth={2} strokeDasharray="9 7" />
              <text
                x={b.x + 52}
                y={LOWER.y + 200}
                textAnchor="middle"
                fontFamily={theme.sans}
                fontSize={26}
                fill={lows[i] > 0.5 ? theme.dim : theme.panelBorder}
                opacity={0.5 + 0.5 * lows[i]}
              >
                {['墙', '口', '簿', '钟', '座'][i]}
              </text>
            </g>
          ))}
        </svg>
        {/* 师傅伏案（右二窗前；p0-02 擦除重来——纸面碎屑） */}
        <Person x={620} y={300} scale={0.42} opacity={0.85 * o * (0.4 + 0.6 * (ups[3] ?? 0))} />
        <div style={{position: 'absolute', left: 700, top: 330, width: 64, height: 44, background: theme.panel, border: `2px solid ${theme.panelBorder}`, borderRadius: 4, opacity: eraseDim * o}}>
          {[0, 1].map((i) => (
            <div key={i} style={{height: 3, margin: '7px 6px', background: theme.dim, opacity: 0.7}} />
          ))}
        </div>
        {/* 碎屑掉落（装不下的直接丢） */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 712 + i * 14,
              top: 380 + 60 * crumbs[i],
              width: 6,
              height: 6,
              borderRadius: 2,
              background: theme.dim,
              opacity: crumbIn * (1 - crumbs[i]) * o,
            }}
          />
        ))}
      </div>

      {/* 首秒全黑罩（高反差开场：全黑城市→楼亮起） */}
      <AbsoluteFill style={{background: NIGHT_VEIL, opacity: 1 - nightLift, pointerEvents: 'none'}} />
      {/* 开场角标（画面备注声明） */}
      <Footnote delay={18}>{'agent loop · context window'}</Footnote>
      {/* p0-02 尾：警句小字（关键词锚点，非逐字；口播「明天从零开始」约在句内 151f——锚 +130 落字先行） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 812,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 30,
          color: theme.dim,
          letterSpacing: 2,
          opacity: progress(frame, at02 + 130, DUR.f4) * o,
        }}
      >
        {'明天 · 从零开始'}
      </div>
    </AbsoluteFill>
  );
};

// ── 0-B 单干塌 ──────────────────────────────────────────────────────────

/** 四模块细节卡（NumberedCard 系，fall 入场——从对话窗口边缘溢出掉落）。 */
const FallingCard: React.FC<{index: number; label: string; sub: string; delay: number}> = ({
  index,
  label,
  sub,
  delay,
}) => {
  const fall = useEnter('fall', {at: delay, dur: DUR.f5, springPreset: 'settleSoft', dist: 210});
  return (
    <div style={{width: 250, ...fall}}>
      <NumberedCard index={index} label={label} sub={sub} delay={delay + 2} accent={theme.accent} />
    </div>
  );
};

/** 单师傅工位放大：对话窗口卡＋四模块细节卡溢出掉落；p0-06 旧待办清单蒸发；
 *  p0-07 主问题金句卡浮起（衬线金句卡——6-J 天亮回收的伏笔）。 */
const SoloCollapse: React.FC<{at06: number; at07: number; span07: number}> = ({at06, at07, span07}) => {
  // 对话窗口（居中偏左，内容行随帧缓慢下移——「写到一半回头补」的推移感）
  const frame = useCurrentFrame();
  const scroll = (frame / 2.2) % 3;
  // 四卡掉落：p0-04 句内 stagger
  const drops = [0, 1, 2, 3].map((i) => 8 + i * 7);
  // p0-06 旧清单蒸发（上浮淡出）
  const evap = useProgress(at06, DUR.f5);
  // p0-07 金句卡（rise＋settle 弹簧）
  const rise = useEnter('rise', {at: at07, dur: DUR.f5, springPreset: 'settle', dist: 34});
  const riseIn = useProgress(at07, DUR.f4);
  const quoteSpan = Math.max(1, span07);

  return (
    <AbsoluteFill>
      {/* 对话窗口（context window——装不下） */}
      <div style={{position: 'absolute', left: 170, top: 170}}>
        <Panel style={{width: 700, height: 560, padding: 0, overflow: 'hidden'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 18px', borderBottom: `2px solid ${theme.panelBorder}`}}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{width: 12, height: 12, borderRadius: 999, background: theme.panelBorder}} />
            ))}
            <div style={{marginLeft: 10, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'session'}</div>
          </div>
          <div style={{padding: '20px 24px', fontFamily: theme.mono, fontSize: 25, lineHeight: 1.7, color: theme.text}}>
            {Array.from({length: 11}, (_, i) => (
              <div key={i} style={{height: 12, marginBottom: 14, borderRadius: 4, background: theme.panelBorder, opacity: 0.28 + 0.3 * (((i + Math.floor(scroll)) % 3) / 2), width: `${58 + ((i * 37) % 40)}%`}} />
            ))}
          </div>
        </Panel>
      </div>

      {/* 四模块细节卡：从窗口边缘溢出掉落（p0-04） */}
      <div style={{position: 'absolute', left: 900, top: 210, display: 'flex', flexDirection: 'column', gap: 18}}>
        <FallingCard index={1} label="认证" sub="auth" delay={drops[0]} />
        <FallingCard index={2} label="数据库" sub="database" delay={drops[1]} />
        <FallingCard index={3} label="路由" sub="routing" delay={drops[2]} />
        <FallingCard index={4} label="测试" sub="testing" delay={drops[3]} />
      </div>

      {/* 旧待办清单（会话内执行清单——p0-06 蒸发） */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 640,
          opacity: (1 - evap) * 0.9,
          transform: `translateY(${-40 * evap}px)`,
        }}
      >
        <Panel style={{width: 380, boxSizing: 'border-box', padding: '16px 20px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'todo（旧）'}</div>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{height: 8, marginTop: 12, borderRadius: 4, background: theme.panelBorder, opacity: 0.6, width: `${80 - i * 18}%`}} />
          ))}
        </Panel>
      </div>

      {/* p0-07 主问题金句卡（衬线——「计划放在谁手里？」6-J 回收） */}
      <Sequence from={at07} durationInFrames={quoteSpan} name="0-B 主问题金句卡">
        <div style={{position: 'absolute', left: 0, right: 0, top: 250, ...rise, opacity: riseIn}}>
          <QuoteCard zh="计划放在谁手里？" accent={theme.accent} />
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};

// ── 0-C 换房·七件套预告 ─────────────────────────────────────────────────

/** 章毕缩角：p0-12 LodgeMap 常驻坐标装置入场（@enter:fade；第七位「?」预告态）。 */
const MapCorner: React.FC<{at12: number}> = ({at12}) => {
  const fade = useEnter('fade', {at: at12, dur: DUR.f4});
  const pulse = useImpulse({at: at12 + DUR.f4, dur: DUR.f6, peak: 1});
  return (
    <div style={{position: 'absolute', left: 1668, top: 56, ...fade}}>
      {/* 装置底衬（与画框右缘 1609 保持 31px 净空） */}
      <div
        style={{
          padding: '8px 10px',
          borderRadius: 10,
          background: withAlpha(theme.bg, 0.55),
          border: `2px solid ${withAlpha(theme.panelBorder, 0.6 + 0.4 * pulse)}`,
        }}
      >
        <LodgeMap active={null} corridorHidden />
      </div>
      <div style={{marginTop: 6, textAlign: 'center', fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>
        {'坐标 · 第七件 ?'}
      </div>
    </div>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P0ForgetfulLodge: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-07');
  const bC = w('p0-08', 'p0-12');

  return (
    <AbsoluteFill>
      <SceneTag chapter="P0" tagline="失忆的楼" accent={theme.accent} />

      <Sequence {...bA} name="0-A 钩子·楼亮灯">
        <LodgeStage at02={at('p0-02') - bA.from} at03={at('p0-03') - bA.from} />
        {/* p0-03 起 Harness 落板（含 Badge 位置迁移），延伸到镜尾 */}
        <Sequence from={at('p0-03') - bA.from} name="0-A Harness 落板">
          <StackReveal />
        </Sequence>
      </Sequence>

      <Sequence {...bB} name="0-B 单干塌">
        <HarnessBadge style={BADGE_STYLE} />
        <SoloCollapse at06={at('p0-06') - bB.from} at07={at('p0-07') - bB.from} span07={dur('p0-07')} />
      </Sequence>

      <Sequence {...bC} name="0-C 换房·七件套预告">
        <HarnessBadge style={BADGE_STYLE} />
        {/* cue 1-4/4：seven-artifacts 逐章（本集首图 → 默认入场） */}
        <ArchifyRecap
          slug="seven-artifacts"
          caption="七件设施总览"
          cues={[
            {chapterId: 'overview', at: at('p0-08') - bC.from, durationInFrames: dur('p0-08')},
            {chapterId: 'public-five', at: at('p0-09') - bC.from, durationInFrames: dur('p0-09')},
            {chapterId: 'private-rooms', at: at('p0-10') - bC.from, durationInFrames: dur('p0-10')},
            {chapterId: 'corridor', at: at('p0-11') - bC.from, durationInFrames: dur('p0-11')},
          ]}
        />
        {/* 章毕缩角：p0-12 常驻坐标装置（第七位「?」） */}
        <MapCorner at12={at('p0-12') - bC.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P0ForgetfulLodge;
