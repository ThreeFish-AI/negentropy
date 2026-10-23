/** P1 收台四步（p1-01..22，5 镜 11 cue）——分镜 1-A…1-E。
 *
 *  ★ 本幕落台面母题的收敛首锚：3D 台面堆高一现（planning §3 唯二 3D 点缀之一）
 *    → 收敛为 2D BenchTop（components/P12BenchDevices，core 橙恒定描边+绝对线宽〔M-001〕，
 *    恒居左中锚位）；会丢侧动效自上缘压入（3D 物件自上而下落堆）。
 *  ★ 3D 组合件守 solids-3d 三宪法：只做直角体、静置俯角/偏航（相机零动画）、
 *    面色取已过对比度的 SHELL_FACES、概念色只走棱线；零 motion hook，
 *    运动量（enters/fade）由本幕以 prop 注入。
 *  archify 两图（compact-pipeline / pair-guard）全屏独占：一章锚一句（at+dur 同句单参）；
 *  1-B 跨实例背靠背接 1-A，lead={false}（分镜 lead 清单）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {SHELL_FACES, Slab3D, Stage3D, axoRotation} from '../components/solids-3d';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {BenchTop, withAlpha} from '../components/P12BenchDevices';
import {DUR, clamp01, progress, useBreathe, useEnter, useImpulse, useProgress, useStagger} from '../motion';

/** 常驻系列条定位：顶边 y<56 归章节条，Badge 与 SceneTag 同行（P1–P6 同值，Integrate 统一核对） */
const BADGE_STYLE: React.CSSProperties = {top: 64};

// ── 1-A 台面堆高一现 → 收敛为 2D 台面母题 ────────────────────────────────

/** 3D 画布紧贴 3D 区域（不铺满幅），台面锚位：画布中心 ≈ (550, 545) 左中 */
const PILE_CANVAS = {w: 640, h: 430} as const;

/** 确定性堆叠布局（零随机）：三层——薄页/厚条/方盒，逼满台面后收敛 */
const PILE_ITEMS = [
  {w: 190, h: 14, d: 130, x: -168, z: -34, t: 0},
  {w: 120, h: 88, d: 110, x: 44, z: 8, t: 0},
  {w: 150, h: 30, d: 90, x: 186, z: -46, t: 0},
  {w: 96, h: 20, d: 96, x: -62, z: 52, t: 1},
  {w: 170, h: 26, d: 70, x: 96, z: 58, t: 1},
  {w: 110, h: 16, d: 120, x: -192, z: 44, t: 1},
  {w: 88, h: 54, d: 66, x: -34, z: -8, t: 2},
  {w: 70, h: 40, d: 70, x: 118, z: 18, t: 2},
  {w: 120, h: 18, d: 56, x: 214, z: 16, t: 2},
] as const;
const TIER_PITCH = 54;

/** 3D 台面堆叠：台板 + 逐件落堆。零 motion hook——enters/fade 由调用方注入；
 *  上层关 edges（多层嵌套降线密），面色梯度 SHELL_FACES 自内向外变暗。 */
const BenchPile3D: React.FC<{enters: readonly number[]; fade: number}> = ({enters, fade}) => (
  <Stage3D width={PILE_CANVAS.w} height={PILE_CANVAS.h}>
    {/* 静置俯角 22°/偏航 8°：深度靠物体姿态，相机全程不动 */}
    <group rotation={axoRotation({pitch: 22, yaw: 8})}>
      <Slab3D width={560} height={24} depth={210} skin={{face: SHELL_FACES[3], edge: theme.core, edgeOpacity: 0.85, opacity: fade}} />
      {PILE_ITEMS.map((it, i) => (
        <Slab3D
          key={i}
          width={it.w}
          height={it.h}
          depth={it.d}
          position={[it.x, 12 + it.t * TIER_PITCH + it.h / 2 + (1 - enters[i]) * 220, it.z]}
          skin={{face: SHELL_FACES[i % 3], edge: theme.core, opacity: fade * clamp01(enters[i] * 1.3), noEdges: i > 5}}
        />
      ))}
    </group>
  </Stage3D>
);

/** 收敛后的 2D 台面堆（无彩 data 色：panel 底 + dim 描边）——台面上的存量物件 */
const BenchStack2D: React.FC<{o: number}> = ({o}) => (
  <svg width={660} height={130} style={{display: 'block', opacity: o}}>
    {/* 文件页（折角） */}
    <rect x={30} y={40} width={110} height={86} rx={4} fill={theme.panel} stroke={theme.dim} strokeWidth={2} />
    <path d="M116 40 L140 64 L116 64 Z" fill="none" stroke={theme.dim} strokeWidth={2} />
    {[0, 1, 2].map((i) => (
      <line key={i} x1={44} y1={78 + i * 16} x2={110} y2={78 + i * 16} stroke={theme.panelBorder} strokeWidth={3} />
    ))}
    {/* 命令输出条 */}
    <rect x={168} y={72} width={192} height={54} rx={6} fill={theme.panel} stroke={theme.dim} strokeWidth={2} />
    {[0, 1].map((i) => (
      <line key={i} x1={182} y1={92 + i * 18} x2={344} y2={92 + i * 18} stroke={theme.panelBorder} strokeWidth={3} />
    ))}
    {/* 回复气泡 */}
    <rect x={388} y={42} width={96} height={84} rx={20} fill={theme.panel} stroke={theme.dim} strokeWidth={2} />
    <line x1={404} y1={74} x2={456} y2={74} stroke={theme.panelBorder} strokeWidth={3} />
    <line x1={404} y1={94} x2={440} y2={94} stroke={theme.panelBorder} strokeWidth={3} />
  </svg>
);

const CompactionOpening: React.FC<{atWorker: number; atMorph: number; atMotto: number}> = ({atWorker, atMorph, atMotto}) => {
  const pileEnters = useStagger(PILE_ITEMS.length, {at: 3, stride: 5, dur: DUR.f4});
  const pileOut = useProgress(atMorph, DUR.f5);
  const benchIn = useProgress(atMorph + 4, DUR.f3);
  const stackIn = useProgress(atMorph + 6, DUR.f4);
  const worker = useEnter('fade', {at: atWorker, dur: DUR.f5});
  const motto = useEnter('rise', {at: atMotto, dur: DUR.f5, dist: 26});

  return (
    <AbsoluteFill>
      {/* 3D 一现：只在出场窗口内挂载，画布紧贴 3D 区域 */}
      <Sequence durationInFrames={atMorph + DUR.f5 + 1} layout="none">
        <div style={{position: 'absolute', left: 230, top: 330, opacity: 1 - pileOut}}>
          <BenchPile3D enters={pileEnters} fade={1} />
        </div>
      </Sequence>

      {/* 收敛定格：2D 台面母题〔M-001〕（左中锚位） */}
      <div
        style={{
          position: 'absolute',
          left: 240,
          top: 560,
          opacity: benchIn,
          transform: `translateY(${-16 * (1 - benchIn)}px)`,
        }}
      >
        <BenchStack2D o={stackIn} />
        <BenchTop width={720} />
      </div>

      {/* 收台工剪影（mech，装置色）：立台侧，手朝台面 */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...worker}}>
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          <circle cx={1072} cy={596} r={26} fill={theme.mech} />
          <path d="M1018 772 Q1018 650 1072 642 Q1126 650 1126 772 Z" fill={theme.mech} />
          <path d="M1024 668 L 948 634" stroke={theme.mech} strokeWidth={9} strokeLinecap="round" />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 1010,
            top: 790,
            width: 130,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 22,
            color: theme.dim,
          }}
        >
          {'收台工'}
        </div>
      </div>

      {/* 章标语字卡（p1-02）：压短形态 */}
      <div style={{position: 'absolute', left: 620, top: 176, ...motto}}>
        <Panel style={{width: 760, padding: '20px 34px'}}>
          <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between'}}>
            <span style={{fontFamily: theme.sans, fontSize: 40, fontWeight: 700, color: theme.text}}>{'上下文总会满'}</span>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'README'}</span>
          </div>
        </Panel>
      </div>

      <Footnote delay={6}>{'context window'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-B 空窗伏笔小条（p1-10） ────────────────────────────────────────────

const OrderTeaseStrip: React.FC = () => {
  const pop = useEnter('pop', {at: 2, dur: DUR.f4});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 640, top: 452, ...pop}}>
        <Panel accent={theme.dim} style={{width: 640, padding: '20px 30px', textAlign: 'center'}}>
          <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>{'顺序不能换'}</span>
          <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>{' · 下一幕'}</span>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 1-C 四层速览小卡（p1-11..15，每句点亮对应卡） ────────────────────────

const LAYERS4 = [
  {zh: '裁中段', sub: '保头尾'},
  {zh: '压条子', sub: '一行小字'},
  {zh: '搬仓库', sub: '留取货条'},
  {zh: '记录员', sub: '摘要卡'},
] as const;

const FourLayerCards: React.FC<{atIntro: number; atCards: readonly number[]}> = ({atIntro, atCards}) => {
  const frame = useCurrentFrame();
  const stag = useStagger(LAYERS4.length, {at: atIntro + 2, stride: 10, dur: DUR.f4});
  // 每句对应卡强调一次：sin(πp) 包络即衰减峰
  const pulse0 = useImpulse({at: atCards[0] + 2, dur: DUR.f5});
  const pulse1 = useImpulse({at: atCards[1] + 2, dur: DUR.f5});
  const pulse2 = useImpulse({at: atCards[2] + 2, dur: DUR.f5});
  const pulse3 = useImpulse({at: atCards[3] + 2, dur: DUR.f5});
  const pulses = [pulse0, pulse1, pulse2, pulse3];
  // 点亮后常驻（句中点抽帧仍可读出当前讲到哪层——持续陈述配持续态）
  const lit = atCards.map((a) => progress(frame, a, DUR.f4));

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 240, top: 372, display: 'flex', gap: 40}}>
        {LAYERS4.map((c, i) => (
          <div key={c.zh} style={{opacity: stag[i], transform: `translateY(${(1 - stag[i]) * 22}px) scale(${1 + 0.04 * pulses[i]})`}}>
            <Panel
              accent={lit[i] > 0.5 ? theme.mech : theme.panelBorder}
              style={{
                width: 330,
                padding: '22px 24px',
                minHeight: 168,
                boxShadow: lit[i] > 0.5 ? `0 0 ${26 * pulses[i] + 6}px ${withAlpha(theme.mech, 0.35)}` : undefined,
              }}
            >
              {/* 卡角讲课编号 */}
              <div style={{fontFamily: theme.mono, fontSize: 20, color: lit[i] > 0.5 ? theme.mech : theme.dim}}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 700, color: theme.text, marginTop: 6}}>{c.zh}</div>
              <div style={{fontFamily: theme.sans, fontSize: 22, color: theme.dim, marginTop: 8}}>{c.sub}</div>
            </Panel>
          </div>
        ))}
      </div>
      <Footnote delay={atIntro + 2}>{'[snipped N messages]'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 1-E 常量打码卡（p1-21..22） ──────────────────────────────────────────

const REDACT_ROWS = ['触发条数', '保留窗口', '长度门'] as const;

const RedactedConstants: React.FC<{atRows: number; atStable: number}> = ({atRows, atStable}) => {
  const rows = useStagger(REDACT_ROWS.length, {at: atRows + 2, stride: 9, dur: DUR.f4});
  const card = useEnter('rise', {at: atRows, dur: DUR.f5});
  // 恒亮行呼吸：mech 低频（周期 ~2.8s）
  const breathe = useBreathe({period: 84, amp: 0.3, base: 0.7});
  const stable = useProgress(atStable, DUR.f4);

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 520, top: 264, ...card}}>
        <Panel style={{width: 880, padding: '26px 36px'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16}}>
            <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{'constants'}</span>
            <span
              style={{
                fontFamily: theme.sans,
                fontSize: 22,
                color: theme.dim,
                border: `2px solid ${theme.dim}`,
                borderRadius: 999,
                padding: '3px 16px',
              }}
            >
              {'随版本漂移'}
            </span>
          </div>
          {REDACT_ROWS.map((r, i) => (
            <div key={r} style={{display: 'flex', alignItems: 'center', height: 74, opacity: rows[i]}}>
              <span style={{width: 260, fontFamily: theme.sans, fontSize: 30, color: theme.text}}>{r}</span>
              <span style={{fontFamily: theme.mono, fontSize: 32, color: theme.panelBorder, letterSpacing: 6}}>{'■■■■'}</span>
            </div>
          ))}
        </Panel>
      </div>
      {/* 恒亮行：顺序与铁律不随版本漂移（mech 描边 + 低频辉光） */}
      <div style={{position: 'absolute', left: 620, top: 704, opacity: stable}}>
        <Panel
          accent={theme.mech}
          style={{
            width: 680,
            padding: '20px 32px',
            textAlign: 'center',
            boxShadow: `0 0 ${8 + 26 * breathe}px ${withAlpha(theme.mech, 0.4)}`,
          }}
        >
          <span style={{fontFamily: theme.sans, fontSize: 40, fontWeight: 700, color: theme.mech}}>{'顺序 · 铁律'}</span>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P1FullTable: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p1-01', 'p1-06');
  const bB = w('p1-07', 'p1-10');
  const bC = w('p1-11', 'p1-15');
  const bD = w('p1-16', 'p1-20');
  const bE = w('p1-21', 'p1-22');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="1-A 台面堆高与收敛（3D 一现）">
        <SceneTag chapter="Compaction" tagline="收台四步" />
        {/* 自制装置在首 cue 前持有画面；cue 窗内淡出让位（多挂 f3 盖满淡出再卸载） */}
        <ArchifyYield
          cues={[
            {at: at('p1-03') - bA.from, durationInFrames: dur('p1-03')},
            {at: at('p1-04') - bA.from, durationInFrames: dur('p1-04')},
            {at: at('p1-05') - bA.from, durationInFrames: dur('p1-05')},
            {at: at('p1-06') - bA.from, durationInFrames: dur('p1-06')},
          ]}
        >
          <Sequence durationInFrames={at('p1-03') - bA.from + DUR.f3}>
            <CompactionOpening
              atWorker={at('p1-01') + Math.round(dur('p1-01') * 0.45) - bA.from}
              atMorph={at('p1-02') + Math.round(dur('p1-02') * 0.35) - bA.from}
              atMotto={at('p1-02') - bA.from}
            />
          </Sequence>
        </ArchifyYield>
        {/* p1-03..06：四层手段与成本分级（第一章起默认入场） */}
        <ArchifyRecap
          slug="compact-pipeline"
          caption="收台管线"
          cues={[
            {chapterId: 'four-layers', at: at('p1-03') - bA.from, durationInFrames: dur('p1-03')},
            {chapterId: 'cost-ladder', at: at('p1-04') - bA.from, durationInFrames: dur('p1-04')},
            {chapterId: 'text-vs-llm', at: at('p1-05') - bA.from, durationInFrames: dur('p1-05')},
            {chapterId: 'one-llm-call', at: at('p1-06') - bA.from, durationInFrames: dur('p1-06')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="1-B 编号与实序对撞">
        {/* 跨实例背靠背接 1-A：lead={false} 抑制换章重放入场 */}
        <ArchifyRecap
          slug="compact-pipeline"
          caption="收台管线"
          lead={false}
          cues={[
            {chapterId: 'teach-vs-real', at: at('p1-07') - bB.from, durationInFrames: dur('p1-07')},
            {chapterId: 'real-order', at: at('p1-08') - bB.from, durationInFrames: dur('p1-08')},
          ]}
        />
        <Sequence from={at('p1-10') - bB.from} name="1-B 空窗伏笔小条">
          <OrderTeaseStrip />
        </Sequence>
      </Sequence>

      <Sequence {...bC} name="1-C 四层速览">
        <FourLayerCards
          atIntro={at('p1-11') - bC.from}
          atCards={[
            at('p1-12') - bC.from,
            at('p1-13') - bC.from,
            at('p1-14') - bC.from,
            at('p1-15') - bC.from,
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="1-D 配对铁律">
        {/* 五句五接力无空窗：archify 全屏回放主控，本镜无自制动效 */}
        <ArchifyRecap
          slug="pair-guard"
          caption="配对铁律"
          cues={[
            {chapterId: 'pair-rule', at: at('p1-16') - bD.from, durationInFrames: dur('p1-16')},
            {chapterId: 'pair-bound', at: at('p1-17') - bD.from, durationInFrames: dur('p1-17')},
            {chapterId: 'orphan-rejected', at: at('p1-18') - bD.from, durationInFrames: dur('p1-18')},
            {chapterId: 'cut-yields', at: at('p1-19') - bD.from, durationInFrames: dur('p1-19')},
            {chapterId: 'content-vs-structure', at: at('p1-20') - bD.from, durationInFrames: dur('p1-20')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="1-E 常量打码">
        <RedactedConstants atRows={at('p1-21') - bE.from} atStable={at('p1-22') - bE.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P1FullTable;
