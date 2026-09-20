/** P6 它没证明什么（p6-01..24）——批判性边界独立成节；
 *  收口用 guided-learn 的「同构变式复考」：不复读七点，而是换一个材料之外的
 *  新场景（上游把 grain 塌缩）反问「这时哪个机制先顶不住」。
 *  W6 起 6-B/6-C/6-E 全句由 archify 图主控（Fences 承接实例/塌方剖面+NumberClash/
 *  RentedSmart 退役），自制件仅存 6-A 栅栏岛+对撞数字、6-D 整队立起与 6-F 信源卡渐黑。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useFadeOut, useStagger} from '../motion';
import {Panel} from '../components/motifs';
import {EvidenceBadge, Stage} from '../components/devices';
import {ARCHIFY} from '../archify.manifest';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {ArchifyYield} from '../components/ArchifyYield';

const BOUNDS = [
  '提效数字多来自厂商自家基准，增益端无第三方复现',
  '不少先进组件仍在预览期，距普遍落地尚有距离',
  '安全边界严格限定在引擎周界之内，数据出楼即失效',
  '治理合法 ≠ 计算正确：上游塌缩了粒度，算式再对也没用',
  '多数人踩出来的近道，依然可能是错的',
];

/** 五道警示栅栏：讲完一条压暗一条（围住大厦，不是推倒它） */
const Fences: React.FC<{dimmed: number; at?: number}> = ({dimmed, at = 0}) => {
  const st = useStagger(5, {at, stride: 6, dur: DUR.f5});
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 14, width: 1280}}>
      {BOUNDS.map((b, i) => {
        const done = i < dimmed;
        return (
          <div
            key={b}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '18px 26px',
              borderRadius: 10,
              border: `2px ${done ? 'solid' : 'dashed'} ${done ? theme.danger : theme.dim}`,
              background: done ? `${theme.danger}12` : 'transparent',
              opacity: (done ? 1 : 0.42) * st[i],
            }}
          >
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 24,
                color: done ? theme.danger : theme.dim,
                width: 40,
              }}
            >
              {`0${i + 1}`}
            </span>
            <span style={{fontFamily: theme.sans, fontSize: 28, color: done ? theme.text : theme.dim}}>
              {b}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** 6-F 信源卡；图数取 manifest 实时计数——手写总数会随扩产再过期（v5 已犯一次） */
const SourceCard: React.FC = () => {
  const rows = useStagger(4, {at: 8, stride: 6, dur: DUR.f5});
  const items = [
    '精读笔记：docs/research/cognitive-context/011-horizon-context.md',
    '最小原型：assets/horizon_context_lab.py（十次破坏性实验实测）',
    `archify 工程图：docs/assets/architecture/cognitive-context/（${Object.keys(ARCHIFY).length} 张）`,
    'pinned commit：097076eb · 全部断言可回溯',
  ];
  return (
    <Panel accent={theme.dim} style={{width: 1240, padding: '30px 38px'}}>
      {items.map((s, i) => (
        <div
          key={s}
          style={{
            fontFamily: theme.mono,
            fontSize: 22,
            color: theme.dim,
            padding: '7px 0',
            opacity: rows[i],
          }}
        >
          {s}
        </div>
      ))}
    </Panel>
  );
};

export const P6Ending: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p6-01', 'p6-06');
  const bB = w('p6-07', 'p6-09');
  const bC = w('p6-10', 'p6-16');
  const bD = w('p6-17');
  const bE = w('p6-19', 'p6-22');
  const bF = w('p6-23', 'p6-24');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="6-A 五道警示栅栏与第一条">
        {/* b：栅栏可见岛 p6-01..04，p6-05/06 cue 窗让位（86% vs 21% 对撞已由 vendor-claim 图承接） */}
        <ArchifyYield
          cues={[
            {at: at('p6-05') - bA.from, durationInFrames: dur('p6-05')},
            {at: at('p6-06') - bA.from, durationInFrames: dur('p6-06')},
          ]}
        >
          <Stage>
            <Fences dimmed={1} at={at('p6-03') - bA.from} />
          </Stage>
        </ArchifyYield>
        <EvidenceBadge grade="vendor" at={at('p6-04') - bA.from} />
        <ArchifyRecap
          slug="evidence-grading"
          caption="证据分级"
          cues={[
            {chapterId: 'vendor-claim', at: at('p6-05') - bA.from, durationInFrames: dur('p6-05')},
            {chapterId: 'not-industry-norm', at: at('p6-06') - bA.from, durationInFrames: dur('p6-06')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="6-B 第二三条边界">
        {/* 07..09 全句 cue（W6）：Fences 承接实例退役，本镜转纯图主控 */}
        <ArchifyRecap
          slug="preview-gap"
          caption="落地鸿沟"
          lead={false}
          cues={[
            {chapterId: 'preview-band', at: at('p6-07') - bB.from, durationInFrames: dur('p6-07')},
          ]}
        />
        <ArchifyRecap
          slug="perimeter-loss"
          caption="安全周界"
          lead={false}
          cues={[
            {chapterId: 'inside-effective', at: at('p6-08') - bB.from, durationInFrames: dur('p6-08')},
            {chapterId: 'outside-void', at: at('p6-09') - bB.from, durationInFrames: dur('p6-09')},
          ]}
        />
      </Sequence>

      <Sequence {...bC} name="6-C 地基塌方与 477 vs 48">
        {/* 10..16 全句 cue（W6）：塌方剖面+NumberClash 嵌套退役，本镜转纯图主控。
            p6-09(outside-void)→10、12→13、15→16 三处跨实例背靠背 → 后一实例均 lead={false} */}
        <EvidenceBadge grade="thirdparty" at={at('p6-11') - bC.from} />
        <ArchifyRecap
          slug="govern-vs-verify"
          caption="治理合法不等于计算正确"
          lead={false}
          cues={[
            {chapterId: 'fourth-boundary', at: at('p6-10') - bC.from, durationInFrames: dur('p6-10')},
            {chapterId: 'third-party-critique', at: at('p6-11') - bC.from, durationInFrames: dur('p6-11')},
            {chapterId: 'upstream-collapse', at: at('p6-12') - bC.from, durationInFrames: dur('p6-12')},
          ]}
        />
        <ArchifyRecap
          slug="grain-collapse"
          caption="上游塌方"
          lead={false}
          cues={[
            {chapterId: 'day-pack-collapse', at: at('p6-13') - bC.from, durationInFrames: dur('p6-13')},
            {chapterId: 'legal-but-wrong', at: at('p6-14') - bC.from, durationInFrames: dur('p6-14')},
            {chapterId: 'measured-477-48', at: at('p6-15') - bC.from, durationInFrames: dur('p6-15')},
          ]}
        />
        <ArchifyRecap
          slug="blueprint-foundation"
          caption="图纸合法救不了塌方地基"
          lead={false}
          cues={[
            {chapterId: 'blueprint-vs-foundation', at: at('p6-16') - bC.from, durationInFrames: dur('p6-16')},
          ]}
        />
      </Sequence>

      <Sequence {...bD} name="6-D 第五条边界">
        {/* habit-not-truth cue 已删、实例随之移除（majority-shortcut 图仍被 P5 引用）：
            栅栏「整队立起」payoff 在 p6-17 恢复装置可见 */}
        <Stage>
          <Fences dimmed={5} />
        </Stage>
      </Sequence>

      <Sequence {...bE} name="6-E 租来的聪明">
        {/* 19..22 全句 cue（W6）：RentedSmart 退役（租用→自有的状态迁移由 lifecycle 图接管），
            本镜转纯图主控；p6-19(signals)→20、21→22 跨实例背靠背 → 后两实例 lead={false} */}
        <ArchifyRecap
          slug="four-factor-ranking"
          caption="四因子称重"
          cues={[
            {chapterId: 'signals', at: at('p6-19') - bE.from, durationInFrames: dur('p6-19')},
          ]}
        />
        <ArchifyRecap
          slug="attribution-balance"
          caption="归因天平"
          lead={false}
          cues={[
            {chapterId: 'not-the-brain', at: at('p6-20') - bE.from, durationInFrames: dur('p6-20')},
            {chapterId: 'cast-into-infra', at: at('p6-21') - bE.from, durationInFrames: dur('p6-21')},
          ]}
        />
        <ArchifyRecap
          slug="rented-brilliance"
          caption="租来的聪明"
          lead={false}
          cues={[
            {chapterId: 'rented-to-owned', at: at('p6-22') - bE.from, durationInFrames: dur('p6-22')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="6-F 下期钩子与信源卡（渐黑）">
        <Fade durationInFrames={bF.durationInFrames}>
          <Stage top={230}>
            <div
              style={{
                fontFamily: theme.serif,
                fontSize: 50,
                color: theme.text,
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              下期，我们把上下文层的蓝图抽出来
              <br />
              <span style={{color: theme.engine}}>大家亲手搭一搭这方积木</span>
            </div>
            <SourceCard />
          </Stage>
        </Fade>
        {/* p6-22(rented-to-owned)→23 跨镜背靠背 → lead={false}；blueprint-blocks 章不接——
            p6-24 留给信源卡+渐黑（渐黑/信源卡逻辑不动，Recap 写 Fade 之后保 z 序盖住 p6-23 钩子文案） */}
        <ArchifyRecap
          slug="next-episode-blueprint"
          caption="下期蓝图"
          lead={false}
          cues={[
            {chapterId: 'self-build', at: at('p6-23') - bF.from, durationInFrames: dur('p6-23')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

/** 片尾渐黑：窗口必须取**整个 beat 的总时长**（红线四）——
 *  取末句时长会让淡出在 beat 开头就把画面黑掉，收尾留一大段黑屏。 */
const Fade: React.FC<{durationInFrames: number; children: React.ReactNode}> = ({
  durationInFrames,
  children,
}) => {
  const o = useFadeOut(durationInFrames, {frames: 90});
  return <AbsoluteFill style={{opacity: o}}>{children}</AbsoluteFill>;
};
