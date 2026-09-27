/** P1 机库全景：五源与三轴（p1-01..p1-25，25 句；storyboard「P1 机库全景」节）。
 *
 *  8 镜 / 12 条 archify cue：
 *   1-A 设问（装置：一扇窗）· 1-B fs-instr@03→fs-mem@05（同实例接力 false）
 *   1-C fs-know@07→fs-tools@08→fs-session@10（接力 false）· 1-D fs-out@11
 *   1-E ax-struct@14 + ax-accept@15（false）· 1-F lc-loop@16→lc-verify@17→lc-evolve@20（接力）
 *   1-G ax-obj@18 + ax-time@19（false）· 1-H fm-silent@23 + 目标函数金句卡
 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {useEnter} from '../motion';
import {SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {WorkCard} from '../components/WorkCard';

export const P1Hangar: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P1" tagline="机库全景 · 五源与三轴" accent={theme.concept} />

      {/* 1-A 设问 + 一扇窗装置 */}
      <Sequence from={0} durationInFrames={dur('p1-01', 'p1-02')} name="1-A">
        <ModelWindow at={at('p1-02')} />
      </Sequence>

      {/* 1-B/1-C/1-D 五源：三段接力全屏独占 */}
      <Sequence from={at('p1-03')} durationInFrames={dur('p1-03', 'p1-06')} name="1-B">
        <ArchifyRecap
          slug="five-sources"
          caption="五源 · 身份与记忆"
          cues={[
            {chapterId: 'fs-instr', at: at('p1-03'), durationInFrames: dur('p1-03')},
            {chapterId: 'fs-mem', at: at('p1-05'), durationInFrames: dur('p1-05')},
          ]}
        />
      </Sequence>
      <Sequence from={at('p1-07')} durationInFrames={dur('p1-07', 'p1-10')} name="1-C">
        <ArchifyRecap
          slug="five-sources"
          caption="五源 · 知识 / 能力 / 会话"
          cues={[
            {chapterId: 'fs-know', at: at('p1-07'), durationInFrames: dur('p1-07')},
            {chapterId: 'fs-tools', at: at('p1-08'), durationInFrames: dur('p1-08')},
            {chapterId: 'fs-session', at: at('p1-10'), durationInFrames: dur('p1-10')},
          ]}
          lead={false}
        />
      </Sequence>
      <Sequence from={at('p1-11')} durationInFrames={dur('p1-11')} name="1-D">
        <ArchifyRecap slug="five-sources" caption="五源汇流" cues={[{chapterId: 'fs-out', at: at('p1-11'), durationInFrames: dur('p1-11')}]} />
      </Sequence>

      {/* 1-E 结构轴五层 + 验收面 */}
      <Sequence from={at('p1-12')} durationInFrames={dur('p1-12', 'p1-15')} name="1-E">
        <ArchifyRecap
          slug="blueprint--architecture"
          caption="结构轴 · 五正交层"
          cues={[
            {chapterId: 'ax-struct', at: at('p1-14'), durationInFrames: dur('p1-14')},
            {chapterId: 'ax-accept', at: at('p1-15'), durationInFrames: dur('p1-15')},
          ]}
        />
      </Sequence>

      {/* 1-F 时间轴大回路：三段接力 */}
      <Sequence from={at('p1-16')} durationInFrames={dur('p1-16', 'p1-17')} name="1-F">
        <ArchifyRecap slug="lifecycle" caption="时间轴 · CGAVE 回路" cues={[{chapterId: 'lc-loop', at: at('p1-16'), durationInFrames: dur('p1-16')}]} />
      </Sequence>
      <Sequence from={at('p1-17')} durationInFrames={dur('p1-17')} name="1-Fb">
        <ArchifyRecap slug="lifecycle" caption="验证 · 显式一环" cues={[{chapterId: 'lc-verify', at: at('p1-17'), durationInFrames: dur('p1-17')}]} lead={false} />
      </Sequence>

      {/* 1-G 正交性：对象轴×时间轴 */}
      <Sequence from={at('p1-18')} durationInFrames={dur('p1-18', 'p1-20')} name="1-G">
        <ArchifyRecap
          slug="blueprint--architecture"
          caption="三轴正交 · 换 A 不动 B"
          cues={[
            {chapterId: 'ax-obj', at: at('p1-18'), durationInFrames: dur('p1-18')},
            {chapterId: 'ax-time', at: at('p1-19'), durationInFrames: dur('p1-19')},
          ]}
        />
      </Sequence>

      {/* 1-H 公理 + 目标函数金句卡 + 进化环补位 */}
      <Sequence from={at('p1-21')} durationInFrames={dur('p1-21', 'p1-25')} name="1-H">
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <QuoteCard zh="预算之内，只给最有用的那一小撮" accent={theme.concept} />
        </AbsoluteFill>
        <ArchifyRecap slug="lifecycle" caption="进化 · 复利一环" cues={[{chapterId: 'lc-evolve', at: at('p1-20'), durationInFrames: dur('p1-20')}]} lead={false} />
        <ArchifyRecap slug="failure-map" caption="静默退化 · context rot" cues={[{chapterId: 'fm-silent', at: at('p1-23'), durationInFrames: dur('p1-23')}]} />
      </Sequence>

      {/* 幕尾：工卡第 1 格盖章（进度锚） */}
      <Sequence from={at('p1-25')} durationInFrames={dur('p1-25')} name="1-Z">
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <WorkCard stamps={1} totalSlots={7} highlightSlot={0} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

/** 「一扇窗」装置：模型窗口框 + 五色流光涌入。 */
const ModelWindow: React.FC<{at: number}> = ({at}) => {
  const enter = useEnter('pop', {at, dur: 20});
  const flows = ['#5B8DC9', '#F5A623', '#7ED321', '#C9A0FF', '#FF9F6B'];
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{...enter, position: 'relative', width: 640, height: 360, border: `3px solid ${theme.concept}`, borderRadius: 14, background: theme.panel}}>
        {flows.map((c, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${18 + i * 14}%`,
              left: 0,
              width: `${30 + i * 12}%`,
              height: 10,
              borderRadius: 5,
              background: c,
              opacity: 0.75,
            }}
          />
        ))}
        <div style={{position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', fontSize: 20, color: theme.dim}}>
          模型一次能读的 · 就这么一扇窗
        </div>
      </div>
    </AbsoluteFill>
  );
};
