/** P3 压缩即遗忘（p3-01..20，5 镜 5 cue）——分镜 3-A…3-E。
 *
 *  叙事链：账单卡「代价 · 到账」落下 → 有损塌缩图四接力（口味原话 → 几轮塌缩 →
 *  压一次丢一层）→ 存档≠记忆双物卡（左厚册 dim／右薄摘要 core，中缝断线 deny）→
 *  根因金句「没有持久状态」＋台面清空 → 官方对照卡＋教学版丢弃面回放＋产品保留面
 *  清单 → 第二本账开张：登记簿剪影自右缘挂入，台面侧压暗让位。
 *  空间契约：台面母题恒居左中锚位（core，M-001：恒定描边色＋绝对线宽 4px，
 *  本幕内 3-C／3-E 同形出场）；登记簿自右缘挂入（mech），不触碰左中锚区。
 *  archify 背靠背：3-A 首实例默认入场（前镜 2-D 为自制装置）；3-D 单章实例
 *  前有官方卡（p3-14..15）隔开 → 默认入场。
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';
import {DUR, useBreathe, useDim, useDraw, useEnter, useImpulse, useProgress, useStagger} from '../motion';

/** 常驻系列条定位：顶边 y<56 归 frozen ChapterProgress，Badge 下移到 SceneTag
 *  同行（P1–P6 同值，Integrate 统一核对）。 */
const BADGE_STYLE: React.CSSProperties = {top: 64};

// ── 台面母题（本幕局部实现；M-001 契约：core 恒定描边＋绝对线宽） ────────

const BENCH = {x: 140, y: 600, w: 560, h: 150} as const;
const BENCH_STROKE = 4;

/** 台面剪影：一块 core 描边的板面（左中锚位）；物件由调用方叠加 */
const BenchSil: React.FC<{opacity?: number; labelY?: number}> = ({opacity = 1, labelY = 775}) => (
  <AbsoluteFill style={{opacity}}>
    <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
      <rect
        x={BENCH.x}
        y={BENCH.y}
        width={BENCH.w}
        height={BENCH.h}
        rx={16}
        fill={theme.panel}
        stroke={theme.core}
        strokeWidth={BENCH_STROKE}
      />
      <line
        x1={BENCH.x + 26}
        y1={BENCH.y + 34}
        x2={BENCH.x + BENCH.w - 26}
        y2={BENCH.y + 34}
        stroke={theme.panelBorder}
        strokeWidth={2}
      />
    </svg>
    <div
      style={{
        position: 'absolute',
        left: BENCH.x,
        top: labelY,
        width: BENCH.w,
        textAlign: 'center',
        fontFamily: theme.mono,
        fontSize: 20,
        color: theme.dim,
      }}
    >
      {'台面'}
    </div>
  </AbsoluteFill>
);

// ── 3-A 引子：账单卡「代价 · 到账」（p3-01） ─────────────────────────────

const BillIntro: React.FC = () => {
  const fall = useEnter('fall', {at: 2, dur: DUR.f5, dist: 130, easing: 'decelerate'});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 650, top: 300, width: 620, ...fall}}>
        <Panel accent={theme.coreDeep} style={{padding: '30px 40px 26px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 1}}>
            {'compact · summary'}
          </div>
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 58,
              fontWeight: 700,
              color: theme.coreDeep,
              marginTop: 14,
            }}
          >
            {'代价 · 到账'}
          </div>
          <div style={{display: 'flex', gap: 40, marginTop: 22}}>
            <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>
              {'留 · 目标'}
            </div>
            <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.deny}}>
              {'丢 · 口味'}
            </div>
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 存档≠记忆双物卡（p3-07..10） ────────────────────────────────────

const ArchiveVsMemory: React.FC<{atX: number}> = ({atX}) => {
  const volL = useEnter('slideL', {at: 2, dur: DUR.f5, dist: 260, easing: 'decelerate'});
  const cardR = useEnter('slideR', {at: 2, dur: DUR.f5, dist: 260, easing: 'decelerate'});
  // 断线描出：pathLength 归一化（红线三——不与像素 dasharray 混用），虚线形态由
  // 「分段路径 + 段内归一化」表达，两段之间的空档即「断」
  const draw = useDraw(DUR.f6, DUR.f6);
  const xFlash = useImpulse({at: atX, dur: DUR.f5});

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 150,
          width: 1920,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 40,
          color: theme.text,
        }}
      >
        {'存档 · 记忆'}
      </div>

      {/* 左：压缩前写盘的完整卷宗（dim 灰置，厚册＝层叠纸页） */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...volL}}>
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect
              key={i}
              x={232 + i * 9}
              y={312 + i * 13}
              width={360}
              height={400}
              rx={6}
              fill={theme.panel}
              stroke={theme.dim}
              strokeWidth={2.5}
              opacity={0.55 + i * 0.09}
            />
          ))}
          <rect x={244} y={332} width={26} height={380} rx={4} fill={theme.panelBorder} opacity={0.8} />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 200,
            top: 750,
            width: 420,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 30,
            color: theme.dim,
          }}
        >
          {'完整卷宗'}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 200,
            top: 790,
            width: 420,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.dim,
          }}
        >
          {'.transcripts/'}
        </div>
      </div>

      {/* 右：台面摘要（core 橙，薄卡） */}
      <div style={{position: 'absolute', left: 1130, top: 420, width: 480, ...cardR}}>
        <Panel accent={theme.core} style={{padding: '26px 32px'}}>
          <div style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 600, color: theme.text}}>
            {'台面摘要'}
          </div>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginTop: 8}}>
            {'summary'}
          </div>
          <div
            style={{
              marginTop: 18,
              height: 3,
              background: theme.coreDeep,
              borderRadius: 2,
            }}
          />
          <div style={{marginTop: 10, height: 3, width: 220, background: theme.panelBorder, borderRadius: 2}} />
        </Panel>
      </div>

      {/* 中缝：断线（两段虚线不相连）＋ deny 叉标（p3-08 句闪） */}
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <path
          d="M680 530 H850"
          fill="none"
          stroke={theme.deny}
          strokeWidth={5}
          strokeLinecap="round"
          {...draw}
        />
        <path
          d="M1070 530 H1240"
          fill="none"
          stroke={theme.deny}
          strokeWidth={5}
          strokeLinecap="round"
          {...draw}
        />
        <g
          opacity={0.4 + 0.6 * xFlash}
          transform={`translate(960 530) scale(${1 + 0.25 * xFlash}) translate(-960 -530)`}
        >
          <line x1={930} y1={500} x2={990} y2={560} stroke={theme.deny} strokeWidth={7} strokeLinecap="round" />
          <line x1={990} y1={500} x2={930} y2={560} stroke={theme.deny} strokeWidth={7} strokeLinecap="round" />
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 860,
          top: 590,
          width: 200,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.deny,
          opacity: 0.45 + 0.55 * xFlash,
        }}
      >
        {'无检索工具'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 根因金句卡＋新会话空台面（p3-11..13） ───────────────────────────

/** 台面上的物件（0-B 的缩微回声）：淡出清空＝「会话一结束连摘要也没了」 */
const BENCH_ITEMS = [
  {x: 200, y: 508, w: 100, h: 88},
  {x: 340, y: 544, w: 230, h: 52},
  {x: 608, y: 512, w: 120, h: 84},
  {x: 500, y: 552, w: 64, h: 44},
] as const;

const StatelessRoot: React.FC<{span: number; atQuote: number}> = ({span, atQuote}) => {
  // 台面物件淡出：清空窗取本镜一半（显式帧窗注释——beat 级动作，标尺六档无对应）
  const clear = useProgress(10, Math.max(DUR.f6, Math.round(span * 0.5)), 'standard');
  const quote = useEnter('rise', {at: atQuote, dur: DUR.f6, dist: 70, easing: 'decelerate'});
  return (
    <AbsoluteFill>
      <BenchSil />
      <AbsoluteFill style={{opacity: 1 - clear}}>
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          {BENCH_ITEMS.map((it, i) => (
            <rect
              key={i}
              x={it.x}
              y={it.y}
              width={it.w}
              height={it.h}
              rx={8}
              fill={theme.panel}
              stroke={theme.dim}
              strokeWidth={2.5}
            />
          ))}
        </svg>
      </AbsoluteFill>
      {/* caption-dup-ok: 金句卡定格记忆点——storyboard 3-C 明写压短形态（6 字 < 10 字安全线），与口播同拍点属刻意 */}
      <div style={{position: 'absolute', left: 0, top: 200, width: 1920, height: 440, ...quote}}>
        <QuoteCard zh="没有持久状态" />
      </div>
    </AbsoluteFill>
  );
};

// ── 3-D 官方对照卡＋产品保留面清单（p3-14..18） ─────────────────────────

const OfficialFresh: React.FC = () => {
  const fade = useEnter('fade', {at: 2, dur: DUR.f5});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 560, top: 280, width: 800, ...fade}}>
        <Panel style={{padding: '26px 36px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, letterSpacing: 1}}>
            {'docs · memory'}
          </div>
          <div style={{marginTop: 18, fontFamily: theme.sans, fontSize: 32, color: theme.text}}>
            {'全新窗口'}
          </div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 32, color: theme.text}}>
            {'两套机制 · 跨会话'}
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

const RETAIN = ['请求意图', '关键概念', '文件片段', '错误与修法', '待办'] as const;

const RetainRow: React.FC<{text: string; p: number}> = ({text, p}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      height: 52,
      opacity: p,
      transform: `translateX(${(1 - p) * 18}px)`,
    }}
  >
    <span
      style={{
        width: 12,
        height: 12,
        borderRadius: 999,
        background: theme.mech,
        opacity: p > 0.6 ? 1 : 0.35,
      }}
    />
    <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.text}}>{text}</span>
  </div>
);

const RetentionList: React.FC = () => {
  const rows = useStagger(RETAIN.length, {at: 4, stride: 9, dur: DUR.f4});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 610, top: 250, width: 700}}>
        <Panel accent={theme.mech} style={{padding: '24px 34px'}}>
          <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.mech}}>{'产品保留面'}</div>
          <div style={{marginTop: 16}}>
            {RETAIN.map((r, i) => (
              <RetainRow key={r} text={r} p={rows[i]} />
            ))}
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 3-E 第二本账开张（p3-19..20） ───────────────────────────────────────

const LedgerAnnounce: React.FC<{at19: number}> = ({at19}) => {
  const slide = useEnter('slideR', {at: 2, dur: DUR.f5, dist: 320, easing: 'decelerate'});
  const glow = useBreathe({period: 76, base: 0.45, amp: 0.3});
  const card = useEnter('rise', {at: at19 + 10, dur: DUR.f5, dist: 50, easing: 'decelerate'});
  const dimB = useDim({at: at19, to: 0.28, dur: DUR.f6});
  return (
    <AbsoluteFill>
      <BenchSil opacity={dimB} />
      {/* 登记簿剪影：自右缘挂入（mech），常驻辉光；不触碰左中台面锚区 */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...slide}}>
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
          <g
            style={{
              filter: `drop-shadow(0 0 ${18 * glow}px ${theme.mech})`,
            }}
          >
            <rect
              x={1280}
              y={360}
              width={320}
              height={420}
              rx={10}
              fill={theme.panel}
              stroke={theme.mech}
              strokeWidth={5}
            />
          </g>
          <line x1={1316} y1={380} x2={1316} y2={760} stroke={theme.mechDeep} strokeWidth={4} />
          {[0, 1, 2, 3].map((i) => (
            <line
              key={i}
              x1={1348}
              y1={430 + i * 56}
              x2={1560}
              y2={430 + i * 56}
              stroke={theme.dim}
              strokeWidth={3}
              opacity={0.6}
            />
          ))}
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 1280,
            top: 800,
            width: 320,
            textAlign: 'center',
            fontFamily: theme.sans,
            fontSize: 28,
            color: theme.mech,
          }}
        >
          {'登记簿'}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, top: 250, width: 1920, textAlign: 'center', ...card}}>
        <div style={{fontFamily: theme.serif, fontSize: 52, fontWeight: 700, color: theme.text}}>
          {'要有一层不丢的'}
        </div>
        <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim, marginTop: 16}}>
          {'book two · never compacted'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P3LossySummary: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  // at() = 时点锚（某句起始帧）；dur() = 与 at 对称的单句取长（cue 窗必须落在同一句 id 上）
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p3-01', 'p3-06');
  const bB = w('p3-07', 'p3-10');
  const bC = w('p3-11', 'p3-13');
  const bD = w('p3-14', 'p3-18');
  const bE = w('p3-19', 'p3-20');

  return (
    <AbsoluteFill>
      <HarnessBadge style={BADGE_STYLE} />

      <Sequence {...bA} name="3-A 代价到账">
        <SceneTag chapter="Lossy Summary" tagline="压缩即遗忘" />
        {/* 窗 = 本镜 4 条 cue 窗：archify 全屏期间账单卡淡出让位 */}
        <ArchifyYield
          cues={[
            {at: at('p3-02') - bA.from, durationInFrames: dur('p3-02')},
            {at: at('p3-03') - bA.from, durationInFrames: dur('p3-03')},
            {at: at('p3-04') - bA.from, durationInFrames: dur('p3-04')},
            {at: at('p3-06') - bA.from, durationInFrames: dur('p3-06')},
          ]}
        >
          <BillIntro />
        </ArchifyYield>
        <ArchifyRecap
          slug="lossy-summary"
          caption="有损塌缩"
          cues={[
            {chapterId: 'taste-lost', at: at('p3-02') - bA.from, durationInFrames: dur('p3-02')},
            {chapterId: 'tabs-verbatim', at: at('p3-03') - bA.from, durationInFrames: dur('p3-03')},
            {chapterId: 'collapse-rounds', at: at('p3-04') - bA.from, durationInFrames: dur('p3-04')},
            {chapterId: 'forgetting-per-round', at: at('p3-06') - bA.from, durationInFrames: dur('p3-06')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="3-B 存档不等于记忆">
        <ArchiveVsMemory atX={at('p3-08') - bB.from} />
        <Footnote delay={2}>{'.transcripts/ · retrieval: none'}</Footnote>
      </Sequence>

      <Sequence {...bC} name="3-C 没有持久状态">
        <StatelessRoot span={bC.durationInFrames} atQuote={at('p3-12') - bC.from} />
        <Footnote delay={2}>{'stateless · session ends, summary gone'}</Footnote>
      </Sequence>

      <Sequence {...bD} name="3-D 官方对照与保留面">
        {/* 窗终点=all-for-one-line cue 起点（默认 lead 画框弹簧 at:2 起步）⇒ 补 f3 骑过画框入场段 */}
        <Sequence from={at('p3-14') - bD.from} durationInFrames={dur('p3-14') + dur('p3-15') + DUR.f3}>
          <OfficialFresh />
        </Sequence>
        <ArchifyRecap
          slug="lossy-summary"
          caption="有损塌缩"
          cues={[{chapterId: 'all-for-one-line', at: at('p3-16') - bD.from, durationInFrames: dur('p3-16')}]}
        />
        <Sequence from={at('p3-17') - bD.from} durationInFrames={dur('p3-17') + dur('p3-18')}>
          <RetentionList />
        </Sequence>
      </Sequence>

      <Sequence {...bE} name="3-E 第二本账开张">
        <LedgerAnnounce at19={at('p3-19') - bE.from} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3LossySummary;
