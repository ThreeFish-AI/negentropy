/** P2 口径与现算（p2-01..p2-28，27 句；storyboard v3「P2 口径与现算」节）。
 *
 *  10 镜 / 17 条 archify cue（chapterId 集合与画面列逐章一致）：
 *   2-A 术语卡三连（@stagger）· 2-B 两章接力 + p2-05 定义卡母题正式注册（金描边+五段式刻度）
 *   2-C 校验门单句图 · 2-D p2-07 空窗补「两条底线」开题装置 + 三章接力
 *   2-E / 2-F / 2-G 纯图回放接力 · 2-H Ann 走查签名镜（StateTrace + 右侧朴素路径对照，
 *   装置组止于 p2-20 句末卸载，让位 p2-21/22 两章全屏图）
 *   2-I 两章图接力 · 2-J p2-25 性能疑问钟 / p2-26 图 / p2-27 限定两卡+基线标尺 / p2-28 金句卡
 *
 *  偏离 storyboard 之处（全屏独占 1298×730 物理冲突，Stage ⑨ 复核）：
 *   - 2-I p2-23 AblationPair 主画面 + p2-24 nonkey-rejected 章（no-backdoor 密度锚已撤——视觉抽查发现整镜图例遮盖装置）
 *     全句 cue 无共存窗口（E2 纪律：装置只落 cue 空窗句/遮盖后窗口）——按 cue 优先落成；
 *     消融语义（垃圾定义入库 vs 注册期拦截）由两章图承担，D6/拦截日志文案随图。
 *   - 2-D 证据徽（虚线 <5% of 9,685）归属句 p2-10 被全句 cue 占据，框外角标破坏
 *     「cue 期间框外无件」不变量——省略，数字由 frozen-widetable 章图承担。
 *   - 2-J BaselineBar（59×–91×）归属句 p2-26 被 cue 占据——前移到设问句 p2-25 会逆旁白
 *     （先答案后问题，〔X-001〕同族），故落相邻空窗 p2-27（与限定两卡同窗）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {AblationPair} from '../components/devices';
import {theme} from '../design/theme';
import {DUR, progress, useBreathe, useCount, useDraw, useEnter, useFlowDash, useStagger} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {BaselineBar, DefinitionCard, QuoteCard, StateTrace, TermCard} from '../components/devices';

/** #RRGGBB → rgba（devices.tsx 同式本地替身；theme 未导出 withAlpha）。 */
const withA = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export const P2Caliber: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p2-01', 'p2-02');
  const bB = w('p2-03', 'p2-05');
  const bC = w('p2-06');
  const bD = w('p2-07', 'p2-10');
  const bE = w('p2-11', 'p2-13');
  const bF = w('p2-14', 'p2-15');
  const bG = w('p2-16');
  const bH = w('p2-18', 'p2-22');
  const bI = w('p2-23', 'p2-24');
  const bJ = w('p2-25', 'p2-28');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P2" tagline="口径与现算 · 语义视图" accent={theme.concept} />

      {/* 2-A 术语卡：三卡错峰（@stagger 驱动外层揭示；TermCard 内部 rise 提前 8 帧完成，避免双重位移） */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="2-A 术语卡">
        <TermsTrio at={at('p2-01') - bA.from} />
      </Sequence>

      {/* 2-B 两条底线：两章接力（第二实例背靠背 lead={false}）+ p2-05 定义卡母题正式注册 */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="2-B 两条底线">
        <ArchifyRecap
          slug="formula-vs-total"
          caption="口径 · 声明×执行两半"
          cues={[{chapterId: 'declare-execute-split', at: at('p2-03') - bB.from, durationInFrames: dur('p2-03')}]}
        />
        <ArchifyRecap
          slug="declaration-execution"
          caption="五段式声明语法"
          lead={false}
          cues={[{chapterId: 'declare', at: at('p2-04') - bB.from, durationInFrames: dur('p2-04')}]}
        />
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26}}>
          <DefinitionCard at={at('p2-05') - bB.from} title="净收入" note="口径单点 · 全公司唯一一份" />
          <RegisteredTag at={at('p2-05') - bB.from + 10} />
        </AbsoluteFill>
      </Sequence>

      {/* 2-C 校验门：单句全屏图（不叠卡片层——与 cue 同窗元素会被不透明画框罩住） */}
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="2-C 校验门">
        <ArchifyRecap
          slug="definition-registration"
          caption="注册期 · 结构校验门"
          cues={[{chapterId: 'strict-gate', at: at('p2-06') - bC.from, durationInFrames: dur('p2-06')}]}
        />
      </Sequence>

      {/* 2-D 现算与旧账：p2-07 空窗由「两条底线」开题装置填补（p2-08 起被三章画框连续遮盖至镜末） + 三章接力 */}
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="2-D 现算与旧账">
        <BottomLines at={at('p2-07') - bD.from} />
        <ArchifyRecap
          slug="declaration-execution"
          caption="执行开关分化"
          cues={[{chapterId: 'switch-divergence', at: at('p2-08') - bD.from, durationInFrames: dur('p2-08')}]}
        />
        <ArchifyRecap
          slug="on-demand-recompute"
          caption="只存算式 · 查询期现算"
          lead={false}
          cues={[
            {chapterId: 'formula-only', at: at('p2-09') - bD.from, durationInFrames: dur('p2-09')},
            {chapterId: 'frozen-widetable', at: at('p2-10') - bD.from, durationInFrames: dur('p2-10')},
          ]}
        />
      </Sequence>

      {/* 2-E 发票复印：三章接力（红绿分叉由图内路径承担） */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="2-E 发票复印">
        <ArchifyRecap
          slug="calc-discipline-matrix"
          caption="计算纪律 · 先聚后连"
          cues={[{chapterId: 'agg-before-join', at: at('p2-11') - bE.from, durationInFrames: dur('p2-11')}]}
        />
        <ArchifyRecap
          slug="fan-trap"
          caption="复印放大 vs 先聚后联"
          lead={false}
          cues={[
            {chapterId: 'copy-inflate', at: at('p2-12') - bE.from, durationInFrames: dur('p2-12')},
            {chapterId: 'aggregate-first', at: at('p2-13') - bE.from, durationInFrames: dur('p2-13')},
          ]}
        />
      </Sequence>

      {/* 2-F 平均的平均：两章接力（16 vs 4.8 对撞由图承担） */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="2-F 平均的平均">
        <ArchifyRecap
          slug="calc-discipline-matrix"
          caption="先聚后除"
          cues={[{chapterId: 'divide-after-agg', at: at('p2-14') - bF.from, durationInFrames: dur('p2-14')}]}
        />
        <ArchifyRecap
          slug="mean-of-means"
          caption="平均的平均 · 班级类比"
          lead={false}
          cues={[{chapterId: 'wrong-avg-of-avg', at: at('p2-15') - bF.from, durationInFrames: dur('p2-15')}]}
        />
      </Sequence>

      {/* 2-G 半可加：单句全屏图 */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="2-G 半可加">
        <ArchifyRecap
          slug="last-snapshot-gate"
          caption="半可加 · 跨时间不叠加"
          cues={[{chapterId: 'semi-additive', at: at('p2-16') - bG.from, durationInFrames: dur('p2-16')}]}
        />
      </Sequence>

      {/* 2-H Ann 走查：签名镜。装置组（StateTrace + 朴素路径对照 + 实心徽）止于 p2-20 句末卸载——
          总宽 1786 超画框 1298，若滞留会在 p2-21/22 两侧外露，破坏全屏独占；卸载即让位两章图 */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="2-H Ann 走查">
        <Sequence from={at('p2-18') - bH.from} durationInFrames={dur('p2-18', 'p2-20')} name="2-H-walk">
          <AnnTrace
            at={at('p2-18') - bH.from}
            askAt={at('p2-19') - bH.from}
            outAt={at('p2-20') - bH.from - 26}
            naiveAt={at('p2-20') - bH.from - 8}
            badgeAt={at('p2-20') - bH.from + 44}
          />
        </Sequence>
        <ArchifyRecap
          slug="event-fanout"
          caption="一单挂三事件 · 复制放大"
          cues={[{chapterId: 'hundred-three', at: at('p2-21') - bH.from, durationInFrames: dur('p2-21')}]}
        />
        <ArchifyRecap
          slug="fan-trap"
          caption="实测对照 · 复制退化"
          lead={false}
          cues={[{chapterId: 'measured-440', at: at('p2-22') - bH.from, durationInFrames: dur('p2-22')}]}
        />
      </Sequence>

      {/* 2-I 拆门消融：p2-23 红绿消融同屏主画面（视觉抽查修复：原实现整镜被全屏图例遮盖），
          p2-24 archify 接力非键外键被拒章 */}
      <Sequence from={bI.from} durationInFrames={bI.durationInFrames} name="2-I 拆门消融">
        <Sequence from={at('p2-23') - bI.from} durationInFrames={dur('p2-23')} name="2-I-ablation">
          <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
            <AblationPair
              at={0}
              width={1620}
              minHeight={430}
              left={{tag: '门拆掉', title: '注册期无校验', lines: ['外键 → 非键列 customers.plan', '垃圾定义静默入库', '行数失控的注册期引信'], flow: {}}}
              right={{tag: '门在位', title: '注册期拦截', lines: ['structure check：非法定义', 'referenced column is not', 'PRIMARY KEY / UNIQUE —— 拒']}}
            />
          </AbsoluteFill>
        </Sequence>
        <ArchifyRecap
          slug="definition-registration"
          caption="非键外键 · 注册期被拒"
          cues={[{chapterId: 'nonkey-rejected', at: at('p2-24') - bI.from, durationInFrames: dur('p2-24')}]}
        />
      </Sequence>

      {/* 2-J 物化与收口：p2-25 设问钟 / p2-26 图 / p2-27 限定+基线标尺 / p2-28 金句卡（at 门控，句前透明） */}
      <Sequence from={bJ.from} durationInFrames={bJ.durationInFrames} name="2-J 物化与收口">
        <Sequence from={at('p2-25') - bJ.from} durationInFrames={dur('p2-25')} name="2-J-question">
          {/* 窗即 p2-25：局部帧 0 = 句首 */}
          <PerfQuestion at={0} />
        </Sequence>
        <ArchifyRecap
          slug="on-demand-recompute"
          caption="物化 · 按粒度预卷"
          cues={[{chapterId: 'grain-recompute', at: at('p2-26') - bJ.from, durationInFrames: dur('p2-26')}]}
        />
        <Sequence from={at('p2-27') - bJ.from} durationInFrames={dur('p2-27')} name="2-J-gain">
          {/* 窗即 p2-27：局部帧 0 = 句首 */}
          <MaterializeGain at={0} />
        </Sequence>
        <QuoteCard at={at('p2-28') - bJ.from} zh={'SQL 合法 ≠ 答案对'} kicker="P2 · 一句收口" />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 2-A 术语卡三连

/** 术语卡文体即「词条 + 白话同位语」，同位语与口播定义重合是本装置的既定形态。 */
const TERMS = [
  // caption-dup-ok: 白话同位语即术语卡文体（storyboard 2-A「先释后用」）
  {term: '语义视图', gloss: '存进数据库的定义性对象 · 一段元数据', tag: 'Semantic View'},
  {term: '主键 · 外键', gloss: '主键唯一标识一行 · 外键指向别表主键', tag: 'PK / FK'},
  {term: '粒度', gloss: '汇总时按什么分组', tag: 'Grain'},
] as const;

const TermsTrio: React.FC<{at: number}> = ({at}) => {
  const ps = useStagger(3, {at, stride: 14, dur: DUR.f5});
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40}}>
      {TERMS.map((c, i) => (
        <div key={c.term} style={{opacity: ps[i], transform: `translateY(${(1 - ps[i]) * 26}px)`}}>
          {/* 内部 rise 提前 8 帧完成（≥ TermCard 缺省 7 帧入场），揭示位移只由外层承担 */}
          <TermCard at={at + i * 14 - 8} term={c.term} gloss={c.gloss} tag={c.tag} width={430} />
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 2-B 注册角标

const RegisteredTag: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('rise', {at, dur: DUR.f4, dist: 16});
  return (
    <div style={{...e, display: 'flex', alignItems: 'center', gap: 12}}>
      <div style={{width: 10, height: 10, background: theme.concept}} />
      <span style={{fontFamily: theme.mono, fontSize: 18, letterSpacing: 3, color: theme.dim}}>
        {'REGISTERED · 第一条底线'}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────── 2-D 两条底线开题

const BottomLines: React.FC<{at: number}> = ({at}) => {
  const e1 = useEnter('fall', {at, dur: DUR.f4, dist: 30});
  const e2 = useEnter('fall', {at: at + 10, dur: DUR.f5, dist: 34});
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24}}>
      <div style={{fontFamily: theme.mono, fontSize: 17, letterSpacing: 5, color: theme.dim}}>
        {'TWO BASELINES'}
      </div>
      <div
        style={{
          ...e1,
          opacity: e1.opacity * 0.78,
          width: 800,
          borderRadius: 12,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.panel,
          padding: '18px 26px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{'01'}</span>
        <div style={{flex: 1}}>
          <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>{'口径单点'}</div>
          <div style={{marginTop: 4, fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
            {'全公司只允许一份定义'}
          </div>
        </div>
        <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.verify}}>{'✓ 已立'}</span>
      </div>
      <div
        style={{
          ...e2,
          width: 800,
          borderRadius: 12,
          border: `2px solid ${theme.concept}`,
          background: theme.panel,
          padding: '18px 26px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.concept}}>{'02'}</span>
        <div style={{flex: 1}}>
          <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>{'查询期重算'}</div>
          <div style={{marginTop: 4, fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>
            {'视图不存算好的数字'}
          </div>
        </div>
        <span style={{fontFamily: theme.mono, fontSize: 19, color: theme.concept}}>{'本条 ▶'}</span>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 2-H Ann 走查（签名镜）

const AnnTrace: React.FC<{at: number; askAt: number; outAt: number; naiveAt: number; badgeAt: number}> = ({
  at,
  askAt,
  outAt,
  naiveAt,
  badgeAt,
}) => (
  <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36}}>
    <StateTrace
      at={at}
      inputs={[
        {label: 'ORD #1 · Ann', sub: '$100'},
        {label: 'ORD #2 · Ann', sub: '$100'},
        {label: 'ORD #3 · Ann', sub: '$100'},
      ]}
      inputAt={at + 8}
      engineTitle="引擎 · 本表聚合"
      engineTag="SEMANTIC VIEW"
      stages={[
        {label: '问：Ann 的总收入', at: askAt},
        {label: '本表内聚合 SUM(amount)', at: askAt + 20},
        {label: '三单收敛一行', at: askAt + 44},
      ]}
      output={{label: 'ENGINE', value: '$300', tone: theme.concept, countTo: 300}}
      outputAt={outAt}
      aside={{label: '事件表 EVT', note: '全程未触碰'}}
      width={1320}
    />
    {/* 右半屏朴素路径对照：六行复制 → 600 翻牌 → 翻红（@count；底部错误链路行进虚线） */}
    <NaiveLane at={naiveAt} countAt={naiveAt + 36} redAt={naiveAt + 50} />
    <div style={{position: 'absolute', bottom: 150, left: 80}}>
      <EvidenceBadge level="filled" at={badgeAt} note="engine 300 vs naive 600" />
    </div>
  </AbsoluteFill>
);

const NaiveLane: React.FC<{at: number; countAt: number; redAt: number}> = ({at, countAt, redAt}) => {
  const frame = useCurrentFrame();
  const e = useEnter('rise', {at, dur: DUR.f4, dist: 22});
  const rows = useStagger(6, {at: at + 6, stride: 6, dur: DUR.f3});
  const v = useCount({to: 600, at: countAt, dur: 20});
  // 翻红走 effects 通道（时长+缓动，不吃弹簧）：描边叠加透明度渐入
  const red = progress(frame, redAt, DUR.f4);
  const hot = red >= 1;
  const flow = useFlowDash({dash: 8, gap: 10, period: 20});
  return (
    <div
      style={{
        ...e,
        position: 'relative',
        width: 430,
        borderRadius: 14,
        border: `2px solid ${theme.panelBorder}`,
        background: theme.panel,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{position: 'absolute', inset: -2, borderRadius: 16, border: `2px solid ${theme.danger}`, opacity: red}} />
      <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 16,
            letterSpacing: 2,
            color: hot ? theme.danger : theme.dim,
            border: `1.5px solid ${withA(hot ? theme.danger : theme.dim, 0.6)}`,
            borderRadius: 6,
            padding: '2px 8px',
          }}
        >
          {'NAIVE'}
        </span>
        <span style={{fontFamily: theme.sans, fontSize: 23, fontWeight: 600, color: theme.text}}>
          {'朴素写法 · 先拼表再求和'}
        </span>
      </div>
      <div style={{marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6}}>
        {rows.map((p, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              opacity: p,
              fontFamily: theme.mono,
              fontSize: 18,
              lineHeight: 1.45,
              color: hot ? withA(theme.danger, 0.85) : theme.dim,
            }}
          >
            <span>{`ORD-${(i % 3) + 1} × EVT`}</span>
            <span>{'$100'}</span>
          </div>
        ))}
      </div>
      <div style={{marginTop: 'auto', paddingTop: 14, display: 'flex', alignItems: 'baseline', gap: 12}}>
        <span
          style={{
            fontFamily: theme.mono,
            fontVariantNumeric: 'tabular-nums',
            fontSize: 52,
            color: hot ? theme.danger : theme.dim,
          }}
        >
          {'$'}
          {Math.round(v)}
        </span>
        <span style={{fontFamily: theme.sans, fontSize: 19, color: theme.dim}}>{'六行复制 · 答案翻倍'}</span>
      </div>
      <svg width="100%" height="10" viewBox="0 0 380 10" preserveAspectRatio="none" style={{marginTop: 8}}>
        <line
          x1={2}
          y1={5}
          x2={378}
          y2={5}
          stroke={hot ? theme.danger : theme.dim}
          strokeWidth={2}
          opacity={hot ? 0.9 : 0.5}
          {...flow}
        />
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────── 2-J 性能疑问钟

const PerfQuestion: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const e = useEnter('rise', {at, dur: DUR.f4, dist: 24});
  const ring = useDraw(at, DUR.f5);
  const breathe = useBreathe({period: 80, base: 0.45, amp: 0.55});
  // 等速扫针（机械感即主题）：1.2°/帧 ≈ 10s/圈
  const handDeg = (frame * 1.2) % 360;
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{...e, display: 'flex', alignItems: 'center', gap: 44}}>
        <svg width={130} height={130} viewBox="0 0 130 130">
          <circle cx={65} cy={65} r={63} fill="none" stroke={theme.concept} strokeWidth={2} opacity={0.12 + 0.18 * breathe} />
          <circle cx={65} cy={65} r={56} fill="none" stroke={withA(theme.concept, 0.25 + 0.35 * breathe)} strokeWidth={2} {...ring} />
          {[
            [65, 11, 65, 19],
            [119, 65, 111, 65],
            [65, 119, 65, 111],
            [11, 65, 19, 65],
          ].map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.dim} strokeWidth={2} />
          ))}
          <line
            x1={65}
            y1={65}
            x2={65}
            y2={65 - 42}
            stroke={theme.concept}
            strokeWidth={3}
            strokeLinecap="round"
            transform={`rotate(${handDeg} 65 65)`}
          />
          <circle cx={65} cy={65} r={4} fill={theme.concept} />
        </svg>
        <div>
          <div style={{fontFamily: theme.mono, fontSize: 17, letterSpacing: 4, color: theme.dim}}>
            {'PERFORMANCE QUESTION'}
          </div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 46, fontWeight: 700, color: theme.text}}>
            {'每次现算 · 会不会慢？'}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 2-J 限定两卡 + 基线标尺

const LIMITS = [
  {k: 'LIMIT 01 · 范围', t: '只加速 · 语义层查询', s: 'SCOPE', sTone: theme.dim},
  {k: 'LIMIT 02 · 优先级', t: '安全策略列 · 改写放弃', s: '治理压过性能', sTone: theme.concept},
] as const;

const MaterializeGain: React.FC<{at: number}> = ({at}) => {
  const chips = useStagger(2, {at, stride: 10, dur: DUR.f4});
  const barAt = at + 12;
  return (
    <AbsoluteFill>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, height: '100%'}}>
        <div style={{display: 'flex', gap: 22}}>
          {LIMITS.map((c, i) => (
            <div
              key={c.k}
              style={{
                opacity: chips[i],
                transform: `translateY(${(1 - chips[i]) * 18}px)`,
                width: 560,
                borderRadius: 12,
                border: `2px solid ${theme.panelBorder}`,
                background: theme.panel,
                padding: '16px 22px',
              }}
            >
              <div style={{fontFamily: theme.mono, fontSize: 15, letterSpacing: 2, color: theme.dim}}>{c.k}</div>
              <div style={{marginTop: 8, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12}}>
                <span style={{fontFamily: theme.sans, fontSize: 26, fontWeight: 600, color: theme.text}}>{c.t}</span>
                <span style={{fontFamily: theme.mono, fontSize: 17, color: c.sTone}}>{c.s}</span>
              </div>
            </div>
          ))}
        </div>
        <BaselineBar at={barAt} from={59} to={91} unit={'×'} caption={'TPC-DS 4 查询 · 359GB→120MB'} />
      </div>
      <div style={{position: 'absolute', bottom: 150, left: 80}}>
        <EvidenceBadge level="dashed" at={barAt + 8} note={'TPC-DS · 厂商自报'} />
      </div>
    </AbsoluteFill>
  );
};
