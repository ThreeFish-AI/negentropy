/** P6 它没证明什么（p6-01..24）——批判性边界独立成节；
 *  收口用 guided-learn 的「同构变式复考」：不复读七点，而是换一个材料之外的
 *  新场景（上游把 grain 塌缩）反问「这时哪个机制先顶不住」。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useDraw, useFadeOut, useProgress, useStagger} from '../motion';
import {Panel} from '../components/motifs';
import {BuildingSection, EvidenceBadge, NumberClash, Stage} from '../components/devices';
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
const Fences: React.FC<{
  dimmed: number;
  at?: number;
  dimAts?: readonly number[];
  /** 跨镜常驻实例用：跳过入场 stagger，直接承接上一镜已入场的栅栏。
   *  6-B 承接 6-A；6-D 的重新「整队立起」有 storyboard 背书，不传。 */
  entered?: boolean;
}> = ({dimmed, at = 0, dimAts, entered = false}) => {
  const frame = useCurrentFrame();
  const st = useStagger(5, {at, stride: 6, dur: DUR.f5});
  const ps = entered ? [1, 1, 1, 1, 1] : st;
  // dimAts 给出每道栅栏各自压暗的帧（与口播逐句同步）；缺省则退回 dimmed 计数
  const lit = dimAts ? dimAts.filter((a) => frame >= a).length : dimmed;
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 14, width: 1280}}>
      {BOUNDS.map((b, i) => {
        const done = i < lit;
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
              opacity: (done ? 1 : 0.42) * ps[i],
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

/** 6-E 租来的聪明：拔掉电源线，光环熄灭 */
const RentedSmart: React.FC<{lineAt: number; quoteAt: number; pullAt: number}> = ({
  lineAt,
  quoteAt,
  pullAt,
}) => {
  // 四句四拍：机器人在场 → 金句上屏 → 电源线描出 → 拔线熄灭
  const line = useDraw(lineAt, DUR.f6);
  const quote = useProgress(quoteAt, DUR.f6);
  const off = useProgress(pullAt, DUR.f6);
  return (
    <div style={{textAlign: 'center'}}>
      <div style={{position: 'relative', display: 'inline-block'}}>
        <div style={{fontSize: 108, opacity: 1 - 0.55 * off}}>🤖</div>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: -22,
            transform: 'translateX(-50%)',
            width: 120,
            height: 22,
            borderRadius: '50%',
            border: `4px solid ${theme.manual}`,
            opacity: 1 - off,
            boxShadow: `0 0 ${26 * (1 - off)}px ${theme.manual}`,
          }}
        />
      </div>
      <svg width={520} height={90} style={{display: 'block', margin: '0 auto'}}>
        <path
          d="M 260 0 C 260 50, 430 40, 470 84"
          stroke={theme.engine}
          strokeWidth={4}
          fill="none"
          opacity={1 - off}
          {...line}
        />
      </svg>
      <div
        style={{
          marginTop: 10,
          fontFamily: theme.serif,
          fontSize: 56,
          color: theme.text,
          lineHeight: 1.45,
          opacity: quote,
          transform: `translateY(${(1 - quote) * 14}px)`,
        }}
      >
        上下文被治理好之前，
        <br />
        <span style={{color: theme.manual}}>AI 的聪明本质上都是租来的</span>
      </div>
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
        {/* b：栅栏跨镜常驻（6-B entered 承接），与 6-B 同批回收 top、同批套 wrapper 保像素同位 */}
        <ArchifyYield
          cues={[
            {at: at('p6-05') - bA.from, durationInFrames: dur('p6-05')},
            {at: at('p6-06') - bA.from, durationInFrames: dur('p6-06')},
          ]}
        >
          <Stage>
            <Fences dimmed={1} at={at('p6-03') - bA.from} />
            <NumberClash
              badLabel="官方称准确率"
              bad="86%"
              goodLabel="独立复测基线"
              good="21%"
              at={at('p6-05') - bA.from}
            />
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
        {/* 默认 top 与 6-A 一致：栅栏承接 6-A 的像素位置（6-A 的 NumberClash 只占其下方），
            6-B 单子项时 Stage 从 paddingTop 起排，故同 top 即同位置 */}
        <ArchifyYield
          cues={[
            {at: at('p6-07') - bB.from, durationInFrames: dur('p6-07')},
            {at: at('p6-08') - bB.from, durationInFrames: dur('p6-08')},
            {at: at('p6-09') - bB.from, durationInFrames: dur('p6-09')},
          ]}
        >
          <Stage>
            {/* entered：承接 6-A 已入场的栅栏，避免 p6-06→07 边界清零重入（压暗走 dimAts） */}
            <Fences
              dimmed={1}
              entered
              dimAts={[
                0,
                at('p6-07') - bB.from,
                at('p6-08') - bB.from,
                Number.MAX_SAFE_INTEGER,
                Number.MAX_SAFE_INTEGER,
              ]}
            />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="preview-gap"
          caption="落地鸿沟"
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
        <Stage top={120}>
          <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
            <BuildingSection focus={null} scale={0.8} collapsed />
            <div>
              <div
                style={{
                  fontFamily: theme.sans,
                  fontSize: 30,
                  color: theme.text,
                  marginBottom: 24,
                  lineHeight: 1.55,
                  width: 560,
                }}
              >
                图纸金色合法、七柱全亮 ——
                <br />
                但<span style={{color: theme.danger}}>地基已被上游按天打包塌缩</span>
              </div>
              {/* p6-16 入场：full 画框（p6-13..15）盖住本镜装置，入场须排在 full 窗外（同 5-A badgeAt 范式） */}
              <NumberClash
                badLabel="治理后仍算出"
                bad="477"
                goodLabel="真实值"
                good="48"
                at={at('p6-16') - bC.from}
              />
            </div>
          </div>
        </Stage>
        <EvidenceBadge grade="thirdparty" at={at('p6-11') - bC.from} />
        <ArchifyRecap
          slug="grain-collapse"
          caption="上游塌方"
          cues={[
            {chapterId: 'day-pack-collapse', at: at('p6-13') - bC.from, durationInFrames: dur('p6-13')},
            {chapterId: 'legal-but-wrong', at: at('p6-14') - bC.from, durationInFrames: dur('p6-14')},
            {chapterId: 'measured-477-48', at: at('p6-15') - bC.from, durationInFrames: dur('p6-15')},
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
        {/* b：机器人光环/金句/拔线是跨句连续演出，只让位 p6-19 归结窗，payoff 全在窗外 */}
        <ArchifyYield cues={[{at: at('p6-19') - bE.from, durationInFrames: dur('p6-19')}]}>
          <Stage top={200}>
            <RentedSmart
              quoteAt={at('p6-20') - bE.from}
              lineAt={at('p6-21') - bE.from}
              pullAt={at('p6-22') - bE.from}
            />
          </Stage>
        </ArchifyYield>
        <ArchifyRecap
          slug="four-factor-ranking"
          caption="四因子称重"
          cues={[
            {chapterId: 'signals', at: at('p6-19') - bE.from, durationInFrames: dur('p6-19')},
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
