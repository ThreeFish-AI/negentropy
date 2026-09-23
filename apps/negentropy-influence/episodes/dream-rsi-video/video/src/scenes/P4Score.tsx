/** P4 机制三：评分与防回退（p4-01..19）——dream 冰蓝夜：
 *  4-A 重放分三件图（archify）· 4-B 幕僚长改章程+防回退闸门（Remotion，中段两章 archify）
 *  · 4-C 冰冻罩全家福 · 4-D 两轮递归（archify）。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useBreathe, useDraw, useEnter, useImpulse, usePushIn, useReveal, useStagger} from '../motion';
import {Backdrop, Footnote, NumberedCard, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';

/** 4-B 开场过渡卡（p4-07）：幕僚长卷轴一行预告——随即全屏图接管（p4-08..12）。 */
const ChiefIntro: React.FC = () => {
  const scroll = useReveal('轨迹 r1…r5 · 得分 0.8280 → 0.8520 · 反复失败：浅尝即止', {cps: 16});
  const scrollIn = useEnter('rise', {restBottom: 620});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', justifyContent: 'center', ...scrollIn}}>
        <Panel accent={theme.dream} style={{padding: '18px 34px', minWidth: 900}}>
          <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dream}}>幕僚长 · 重放轨迹与得分</div>
          <div style={{fontFamily: theme.mono, fontSize: 25, color: theme.text, marginTop: 8}}>{scroll || ' '}</div>
        </Panel>
      </div>
      <Footnote delay={10}>候选集包含当前策略 ⇒ 平均重放分意义上防回退（§3）</Footnote>
    </AbsoluteFill>
  );
};

/** 4-C：系统全家福——三模块冰冻玻璃罩（微尘静止），顶部章程卡换版闪烁。 */
const FrozenDome: React.FC<{swapAt: number[]}> = ({swapAt}) => {
  const frame = useCurrentFrame();
  const push = usePushIn(0, {scale: 0.05});
  const glow = useBreathe({period: DUR.f6 * 2.6, amp: 0.25, base: 0.55, offset: 8});
  const swaps = useStagger(swapAt.length, {at: swapAt[0], dur: DUR.f3, stride: DUR.f5});
  const activeVersion = swapAt.filter((s) => frame >= s).length;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', transform: push}}>
      {/* 顶部：唯一在变的章程卡（版本号翻动） */}
      <Panel accent={theme.grow} style={{padding: '20px 46px', boxShadow: `0 0 ${16 + glow * 18}px ${theme.grow}55`}}>
        <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.grow}}>
          探索策略代码 · v{activeVersion + 1}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 700, color: theme.text, marginTop: 4}}>
          唯一在变的，只有章程
        </div>
      </Panel>
      {/* 三模块：冰冻罩（半透明玻璃 + 静止微尘点） */}
      <div style={{display: 'flex', gap: 44, marginTop: 70}}>
        {['模型', '评审器', '执行接口'].map((m, i) => (
          <div
            key={m}
            style={{
              position: 'relative',
              background: `${theme.panel}CC`,
              border: `2px solid ${theme.dream}55`,
              borderRadius: 14,
              padding: '26px 40px',
              backdropFilter: 'blur(1px)',
              opacity: 0.55 + swaps[i] * 0,
            }}
          >
            <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.dim}}>❄</div>
            <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.text, marginTop: 6}}>{m}</div>
            <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dream, marginTop: 6}}>冻结 · 一个字节不动</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const P4Score: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const b4A = w('p4-01', 'p4-06');
  const b4B2 = w('p4-08', 'p4-12');
  const b4D = w('p4-15', 'p4-19');
  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <Backdrop tint={theme.dream} opacity={0.1} />
      <SceneTag chapter="P4" tagline="机制三 · 评分与防回退" accent={theme.dream} />
      <Sequence {...b4A} name="4-A 重放分三件">
        <ArchifyRecap
          slug="v-three-terms"
          caption="重放分 = 三项折算"
          cues={[
            {chapterId: 'quality', at: at('p4-02') - b4A.from, durationInFrames: dur('p4-02')},
            {chapterId: 'cost', at: at('p4-03') - b4A.from, durationInFrames: dur('p4-03')},
            {chapterId: 'parallel', at: at('p4-05') - b4A.from, durationInFrames: dur('p4-05')},
            {chapterId: 'total', at: at('p4-06') - b4A.from, durationInFrames: dur('p4-06')},
          ]}
        />
      </Sequence>
      <Sequence {...w('p4-07')} name="4-B1 幕僚长卷轴">
        <ChiefIntro />
      </Sequence>
      <Sequence {...b4B2} name="4-B2 图承章节">
        <ArchifyRecap
          slug="two-phase-loop"
          caption="做梦内环与防回退闸"
          tailFrames={b4B2.durationInFrames - (at('p4-10') - b4B2.from + dur('p4-10'))}
          cues={[
            {chapterId: 'revise', at: at('p4-08') - b4B2.from, durationInFrames: dur('p4-08')},
            {chapterId: 'guard', at: at('p4-10') - b4B2.from, durationInFrames: dur('p4-10')},
          ]}
        />
      </Sequence>
      <Sequence {...w('p4-13', 'p4-14')} name="4-C 只有章程在变">
        <FrozenDome swapAt={[at('p4-13'), at('p4-14')].map((f) => f - w('p4-13', 'p4-14').from)} />
      </Sequence>
      <Sequence {...b4D} name="4-D 两轮递归">
        <ArchifyRecap
          slug="proto-two-rounds"
          caption="两轮递归（原型实录）"
          cues={[
            {chapterId: 't1', at: at('p4-15') - b4D.from, durationInFrames: dur('p4-15')},
            {chapterId: 'dream', at: at('p4-17') - b4D.from, durationInFrames: dur('p4-17')},
            {chapterId: 't2', at: at('p4-18') - b4D.from, durationInFrames: dur('p4-18')},
            {chapterId: 'combo', at: at('p4-19') - b4D.from, durationInFrames: dur('p4-19')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
