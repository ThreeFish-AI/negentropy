/** P6 供给与生态（p6-01..p6-18，18 句；storyboard「P6 供给与生态」节）。
 *
 *  8 镜 / 15 条 archify cue：
 *   6-A collect@01→activate@02（实例内背靠背）
 *   6-B 表海先导 T6B → stale-manual@03（隔 T6B 空窗恢复入场）；valgate@04（跨实例
 *       背靠背 lead={false}）→ inputs@05（实例内背靠背）
 *   6-C Cortex Sense（私预）角标先导 T6C → factors@06（隔 T6C 恢复入场）→ signals@07
 *   6-D 纯装置：CONFLICT 卡阵 ×12 + 人工裁决印章（无 cue，p6-08/09 为本幕空窗句）
 *   6-E 消融声量柱 @p6-10（cue 空窗句）→ popularity-wins@11（尾让 T6E 金句窗）
 *   6-F 增益角标先导 T6F → topk@12
 *   6-G portable@13（跨镜背靠背 lead={false}）→ feedback@14 → socket@15（尾让 T6G 导出桥）
 *   6-H stage-objects@16（隔 T6G 恢复入场）→ stage-governed-enrich@17 →
 *       stage-ecosystem@18（尾让 T6H 金句卡收幕）
 *
 *  偏离登记（v4 全屏独占契约 vs 分镜「装置 + archify 同句叠写」）：
 *  - 6-B/6-C/6-E/6-F/6-G/6-H 六处按「句内先导 / 尾让」拆窗：cue 的 at/dur 仍锚分镜
 *    声明的同一句 id，取 `dur('句id') - T` 偏移形态（覆盖门 extract_cues 的锚句/时长
 *    一致性断言照过）。先导侧装置先演、画框入场弹簧自然压上（E2 4-D② c 模式遮盖，
 *    装置保持挂载在 DOM 前序）；尾让侧在判词语拍上硬切（cut on beat：6-E「习惯≠真理」/
 *    6-G「静默丢弃」/6-H 收幕金句）。
 *  - 6-B「两条生产线传送带」销账：valgate/inputs 两章即生产线机理（验证门入库 / 六路
 *    输入面），其语义时位属 p6-04/05 章窗，先导窗内再画传送带与口播错位。
 *  - 6-B「表海滚动」以整格错峰落格呈现（TableSea 无滚动模式；~3.5s 先导窗不引入
 *    裁切滚动）。6-C 私预角标按先导窗呈现（本镜两句均有 cue，无空窗句可挂）。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useCount, useEnter, useImpulse} from '../motion';
import {SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {EvidenceBadge} from '../components/EvidenceBadge';
import {AblationPair, ConflictCards, QuoteCard, TableSea} from '../components/devices';

export const P6Supply: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p6-01', 'p6-02');
  const bB = w('p6-03', 'p6-05');
  const bC = w('p6-06', 'p6-07');
  const bD = w('p6-08', 'p6-09');
  const bE = w('p6-10', 'p6-11');
  const bF = w('p6-12');
  const bG = w('p6-13', 'p6-15');
  const bH = w('p6-16', 'p6-18');
  // 句内拆窗偏移（比例取值，TTS 实测时长变化时随 dur() 自动重定时）
  const T6B = Math.round(dur('p6-03') * 0.58);
  const T6C = Math.round(dur('p6-06') * 0.2);
  const T6E = Math.round(dur('p6-11') * 0.26);
  const T6F = Math.round(dur('p6-12') * 0.24);
  const T6G = Math.round(dur('p6-15') * 0.32);
  const T6H = Math.round(dur('p6-18') * 0.48);

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P6" tagline="供给与生态" accent={theme.concept} />

      {/* 6-A 三动词：两章接力（实例内背靠背） */}
      <Sequence {...bA} name="6-A 三动词">
        <ArchifyRecap
          slug="collect-enrich-activate"
          caption="官方叙事 · 三动词"
          cues={[
            {chapterId: 'collect', at: at('p6-01') - bA.from, durationInFrames: dur('p6-01')},
            {chapterId: 'activate', at: at('p6-02') - bA.from, durationInFrames: dur('p6-02')},
          ]}
        />
      </Sequence>

      {/* 6-B 缺口：表海先导（9,685 计数 + 虚线徽）→ stale-manual 压上（c 模式遮盖）；
          valgate 跨实例背靠背 lead={false}，inputs 实例内接力 */}
      <Sequence {...bB} name="6-B 缺口">
        <SeaLead at={at('p6-03') - bB.from} />
        <ArchifyRecap
          slug="dictionary-drift"
          caption="缺口 · 按旧手册猜"
          cues={[
            {chapterId: 'stale-manual', at: at('p6-03') - bB.from + T6B, durationInFrames: dur('p6-03') - T6B},
          ]}
        />
        <ArchifyRecap
          slug="autopilot-loop"
          caption="显式轨 · 验证门入库"
          cues={[
            {chapterId: 'valgate', at: at('p6-04') - bB.from, durationInFrames: dur('p6-04')},
            {chapterId: 'inputs', at: at('p6-05') - bB.from, durationInFrames: dur('p6-05')},
          ]}
          lead={false}
        />
      </Sequence>

      {/* 6-C 隐式轨：私预角标先导 → factors/signals 两章接力 */}
      <Sequence {...bC} name="6-C 隐式轨">
        <PreviewChip at={at('p6-06') - bC.from} />
        <ArchifyRecap
          slug="four-factor-ranking"
          caption="隐式轨 · 四因子"
          cues={[
            {chapterId: 'factors', at: at('p6-06') - bC.from + T6C, durationInFrames: dur('p6-06') - T6C},
            {chapterId: 'signals', at: at('p6-07') - bC.from, durationInFrames: dur('p6-07')},
          ]}
        />
      </Sequence>

      {/* 6-D 冲突裁决：纯装置（无 cue）——卡阵推挤 → 停下盖章定归属 */}
      <Sequence {...bD} name="6-D 冲突裁决">
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36}}>
          <DauChip at={at('p6-09') - bD.from + 6} />
          {/* 12 张是抽样示意（评审 H 轮）：口播 p6-09「测出几十种」——× 12 的精确
              计数与量级对不上，角标改定性文案 */}
          <ConflictCards
            at={4}
            labels={DAU_DEFS}
            verdictAt={at('p6-09') - bD.from + Math.round(dur('p6-09') * 0.2)}
            stampText="人工裁决"
            note={'口径归属 · 团队定'}
            badgeText={'CONFLICT · 定义漂移样本'}
          />
        </AbsoluteFill>
        <StepNote at={at('p6-09') - bD.from + Math.round(dur('p6-09') * 0.48)} />
      </Sequence>

      {/* 6-E 拆给热度：消融声量柱 @p6-10（空窗句）→ popularity-wins（尾让金句窗，语拍硬切） */}
      <Sequence {...bE} name="6-E 拆给热度">
        <Sequence from={0} durationInFrames={dur('p6-10')} name="6-E-ablation">
          <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26}}>
            <AblationPair
              at={2}
              left={{
                tag: 'D4 · 交给热度',
                title: '声量自动选多数',
                lines: ['声量统计 inferred · 200 次', '多数即胜 · 无人工门', '错误口径胜出'],
                meter: {label: '声量 · 错误口径', from: 0, to: 200, at: 10},
                flow: {},
              }}
              right={{
                tag: 'D4 · 冲突浮出',
                title: '人工裁决定归属',
                lines: ['CONFLICT 卡阵上桌', '停下 · 口径归团队', '治理定义权威最高'],
                meter: {label: '声量 · 正确口径', from: 0, to: 5, at: 16},
                flow: {},
              }}
            />
            <VoiceDuel at={at('p6-10') - bE.from + 20} />
          </AbsoluteFill>
          <div style={{position: 'absolute', bottom: 150, left: 80}}>
            <EvidenceBadge level="filled" at={at('p6-10') - bE.from + 26} note="本仓复算 · D4" />
          </div>
        </Sequence>
        <ArchifyRecap
          slug="majority-shortcut"
          caption="消融 · 热度裁决"
          cues={[
            {chapterId: 'popularity-wins', at: at('p6-11') - bE.from, durationInFrames: dur('p6-11') - T6E},
          ]}
        />
        <QuoteCard at={at('p6-11') - bE.from + dur('p6-11') - T6E + 4} zh={'习惯 ≠ 真理'} kicker={'消融判词 · D4'} />
      </Sequence>

      {/* 6-F 检索：增益角标先导（0.22→0.59 · 虚线徽）→ topk 压上 */}
      <Sequence {...bF} name="6-F 检索">
        <GainLead at={at('p6-12') - bF.from} />
        <ArchifyRecap
          slug="four-factor-ranking"
          caption="检索 · 合成与显式裁决"
          cues={[
            {chapterId: 'topk', at: at('p6-12') - bF.from + T6F, durationInFrames: dur('p6-12') - T6F},
          ]}
        />
      </Sequence>

      {/* 6-G 出口三路：三章接力（portable 跨镜背靠背 lead={false}）；socket 尾让导出桥 */}
      <Sequence {...bG} name="6-G 出口三路">
        <ArchifyRecap
          slug="open-interop"
          caption="出口 · 开放互操作"
          cues={[
            {chapterId: 'portable', at: at('p6-13') - bG.from, durationInFrames: dur('p6-13')},
            {chapterId: 'feedback', at: at('p6-14') - bG.from, durationInFrames: dur('p6-14')},
            {chapterId: 'socket', at: at('p6-15') - bG.from, durationInFrames: dur('p6-15') - T6G},
          ]}
          lead={false}
        />
        <Sequence from={at('p6-15') - bG.from + dur('p6-15') - T6G} durationInFrames={T6G} name="6-G-bridge">
          <ExportBridge at={2} flashAt={Math.round(T6G * 0.4)} />
        </Sequence>
      </Sequence>

      {/* 6-H 演进：三阶段接力；尾让金句卡收幕（「没有对象化的开放」判词） */}
      <Sequence {...bH} name="6-H 演进">
        <ArchifyRecap
          slug="evolution-timeline"
          caption="演进 · 三阶段"
          cues={[
            {chapterId: 'stage-objects', at: at('p6-16') - bH.from, durationInFrames: dur('p6-16')},
            {chapterId: 'stage-governed-enrich', at: at('p6-17') - bH.from, durationInFrames: dur('p6-17')},
            {chapterId: 'stage-ecosystem', at: at('p6-18') - bH.from, durationInFrames: dur('p6-18') - T6H},
          ]}
        />
        <QuoteCard at={at('p6-18') - bH.from + dur('p6-18') - T6H + 3} zh={'没有对象化的开放 ＝ 换个格式分发混乱'} />
        <VerdictKicker at={at('p6-18') - bH.from + dur('p6-18') - T6H + 8} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ── 6-B 表海先导：9,685 计数（@count）+ TableSea 占比计量 + 虚线徽 ──────────

const SeaLead: React.FC<{at: number}> = ({at}) => {
  const total = useCount({to: 9685, at, dur: 40});
  return (
    <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 16}}>
        <span style={{fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', fontSize: 58, color: theme.text}}>
          {Math.round(total).toLocaleString('en-US')}
        </span>
        <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{'张表'}</span>
      </div>
      {/* litRatio 显式覆写（评审 H 轮）：缺省 0.05 定格「5.0%」与口播 p6-03「覆盖率
          不到 5%」相抵——4.8% 是「<5%」的合法示值（信源只锚 <5%，无更精确口径） */}
      <TableSea
        at={at + 4}
        countAt={at + 12}
        cols={30}
        rows={10}
        totalLabel={'Snowflake 全库'}
        litNote={'语义视图已覆盖'}
        litRatio={0.048}
      />
      <EvidenceBadge level="dashed" at={at + 14} note="Snowflake 自报" />
    </AbsoluteFill>
  );
};

// ── 6-C 私预角标（章窗先导；E2 先例——角标无空窗句时前移句首） ──────────────

const PreviewChip: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('rise', {at, dur: DUR.f4, dist: 18});
  return (
    <AbsoluteFill style={{...e, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14}}>
      <div
        style={{
          border: `1.5px dashed ${theme.dim}`,
          borderRadius: 10,
          padding: '14px 30px',
          fontFamily: theme.mono,
          fontSize: 30,
          color: theme.text,
          letterSpacing: 2,
        }}
      >
        {'Cortex Sense · 私预'}
      </div>
      <div style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim, letterSpacing: 4}}>
        {'IMPLICIT RANKING TRACK'}
      </div>
    </AbsoluteFill>
  );
};

// ── 6-D：「日活」设问 chip（@enter:pop）与裁决四步注（@enter:fall） ──────────

const DauChip: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('pop', {at, dur: DUR.f4});
  return (
    <div style={{...e, fontFamily: theme.mono, fontSize: 26, color: theme.concept, letterSpacing: 2}}>
      {'「日活」＝ ？'}
    </div>
  );
};

const StepNote: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('fall', {at, dur: DUR.f4, dist: 22});
  return (
    <div
      style={{
        ...e,
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 168,
        textAlign: 'center',
        fontFamily: theme.mono,
        fontSize: 22,
        color: theme.dim,
        letterSpacing: 3,
      }}
    >
      {'停 · 摆给人 · 定归属 · 再继续'}
    </div>
  );
};

/** 「日活」定义漂移样本：kicker 标三种来源（定义漂移的产地），title 为口径变体。 */
const DAU_DEFS: readonly {kicker: string; title: string}[] = [
  {kicker: '指标库', title: '登录即活跃'},
  {kicker: 'SQL 视图', title: '当日下过单'},
  {kicker: '看板局部', title: '打开过 App'},
  {kicker: '指标库', title: '去重设备数'},
  {kicker: 'SQL 视图', title: '完成一次会话'},
  {kicker: '看板局部', title: '超过三分钟'},
  {kicker: '指标库', title: '点过推送'},
  {kicker: 'SQL 视图', title: '付费用户'},
  {kicker: '看板局部', title: '30 天回访'},
  {kicker: '指标库', title: '跨端去重'},
  {kicker: 'SQL 视图', title: '活跃租户'},
  {kicker: '看板局部', title: '查过看板'},
];

// ── 6-E：200:5 声量角标（@count；inferred vs governed） ─────────────────────

const VoiceDuel: React.FC<{at: number}> = ({at}) => {
  const big = useCount({to: 200, at, dur: 38});
  const small = useCount({to: 5, at: at + 5, dur: 30});
  return (
    <div style={{display: 'flex', alignItems: 'baseline', gap: 18}}>
      <span style={{fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', fontSize: 54, color: theme.danger}}>
        {Math.round(big)}
      </span>
      <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.dim}}>{':'}</span>
      <span style={{fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', fontSize: 54, color: theme.ok}}>
        {Math.round(small)}
      </span>
      <span style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim, marginLeft: 8}}>
        {'inferred vs governed · 声量'}
      </span>
    </div>
  );
};

// ── 6-F：增益角标（@count · NDCG 0.22→0.59）+ 虚线徽同窗 ────────────────────

const GainLead: React.FC<{at: number}> = ({at}) => {
  const v = useCount({from: 0.22, to: 0.59, at, dur: 34});
  return (
    <AbsoluteFill style={{flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 22,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 14,
          padding: '28px 44px',
        }}
      >
        <span style={{fontFamily: theme.mono, fontVariantNumeric: 'tabular-nums', fontSize: 76, color: theme.concept}}>
          {v.toFixed(2)}
        </span>
        <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>{'NDCG@10 · 0.22 → 0.59'}</span>
      </div>
      <EvidenceBadge level="dashed" at={at + 6} note="官方基准 · 全部自报" />
    </AbsoluteFill>
  );
};

// ── 6-G：导出桥断点（@impulse 闪红）+ 实线徽（第三方指出） ──────────────────

const ExportBridge: React.FC<{at: number; flashAt: number}> = ({at, flashAt}) => {
  const frame = useCurrentFrame();
  const e = progress(frame, at, DUR.f4);
  const flash = useImpulse({at: flashAt, dur: 18, peak: 1});
  return (
    <AbsoluteFill style={{opacity: e, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26}}>
      <svg width={1160} height={320} viewBox="0 0 1160 320">
        {/* 左右节点：语义视图（金 · 口径主线）→ 外部系统（中性） */}
        <rect x={40} y={100} width={250} height={120} rx={12} fill={theme.panel} stroke={theme.concept} strokeWidth={2} />
        <text x={165} y={152} textAnchor="middle" fill={theme.text} fontSize={26} fontFamily={theme.sans}>
          {'语义视图'}
        </text>
        <text x={165} y={186} textAnchor="middle" fill={theme.dim} fontSize={15} fontFamily={theme.mono}>
          {'SEMANTIC VIEW'}
        </text>
        <rect x={870} y={100} width={250} height={120} rx={12} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={2} />
        <text x={995} y={152} textAnchor="middle" fill={theme.text} fontSize={26} fontFamily={theme.sans}>
          {'外部系统'}
        </text>
        <text x={995} y={186} textAnchor="middle" fill={theme.dim} fontSize={15} fontFamily={theme.mono}>
          {'OSI · OSSIE'}
        </text>
        {/* 桥面：等值连接段（金实线）→ 断口（时点对齐关系过不去） */}
        <line x1={290} y1={160} x2={660} y2={160} stroke={theme.concept} strokeWidth={4} />
        <line x1={660} y1={148} x2={660} y2={172} stroke={theme.concept} strokeWidth={4} />
        <line x1={820} y1={148} x2={820} y2={172} stroke={theme.dim} strokeWidth={4} />
        <line x1={820} y1={160} x2={870} y2={160} stroke={theme.dim} strokeWidth={4} />
        {/* 断口闪红（@impulse）：丢弃关系在此坠桥 */}
        <g opacity={0.55 + 0.45 * flash}>
          <line x1={672} y1={160} x2={808} y2={160} stroke={theme.danger} strokeWidth={3} strokeDasharray="7 9" />
          <text x={740} y={140} textAnchor="middle" fill={theme.danger} fontSize={30} fontFamily={theme.mono}>
            {'✕'}
          </text>
        </g>
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={700 + i * 40} cy={200 + i * 26} r={5} fill={theme.danger} opacity={0.65 - i * 0.18} />
        ))}
        <text x={475} y={208} textAnchor="middle" fill={theme.concept} fontSize={21} fontFamily={theme.mono}>
          {'等值连接 · 导出'}
        </text>
        <text x={740} y={296} textAnchor="middle" fill={theme.danger} fontSize={21} fontFamily={theme.mono}>
          {'时点对齐 · 静默丢弃'}
        </text>
      </svg>
      <EvidenceBadge level="solid" at={at + 10} note="第三方对比文指出" />
    </AbsoluteFill>
  );
};

// ── 6-H：收幕判词 kicker（@enter:pop；金句卡本体由 devices.QuoteCard 承担） ──

const VerdictKicker: React.FC<{at: number}> = ({at}) => {
  const e = useEnter('pop', {at, dur: DUR.f4});
  return (
    <div
      style={{
        ...e,
        position: 'absolute',
        left: 0,
        right: 0,
        top: 188,
        textAlign: 'center',
        fontFamily: theme.mono,
        fontSize: 20,
        color: theme.dim,
        letterSpacing: 6,
      }}
    >
      {'三阶段演进 · 收束判词'}
    </div>
  );
};
