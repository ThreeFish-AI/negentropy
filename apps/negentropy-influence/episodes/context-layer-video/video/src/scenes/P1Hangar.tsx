/** P1 机库全景：五源与三轴（p1-01..p1-25，25 句；storyboard「P1 机库全景」节）。
 *
 *  8 镜 / 14 条 archify cue（镜内锚点一律 at(句id) − 所在镜.from，ArchifyRecap 契约）：
 *   1-A 设问（装置：一扇窗）· 1-B fs-instr@03→fs-mem@05（隔句空窗，均入场）
 *   1-C fs-know@07→fs-tools@08→fs-session@10（首 cue 隔句入场）· 1-D fs-out@11（背靠背 1-C 尾 false）
 *   1-E ax-struct@14 + ax-accept@15（隔句入场）· 1-F lc-loop@16（背靠背 1-E 尾 false）
 *   1-Fb lc-verify@17（false）· 1-G ax-obj@18 + ax-time@19（false）+ lc-evolve@20（跨实例背靠背 false）
 *   1-H fm-silent@23 + 目标函数金句卡 · 1-Z 工卡第 1 格盖章（底部锚定，避让金句）
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
  // 各镜窗口（from 为幕内帧）。镜内 cue/装置锚点一律「at(句id) - 所在镜.from」——
  // ArchifyRecap 契约 + motion hooks 均按父 Sequence 局部帧解释，漏减会双重偏移。
  const bA = w('p1-01', 'p1-02');
  const bB = w('p1-03', 'p1-06');
  const bC = w('p1-07', 'p1-10');
  const bD = w('p1-11');
  const bE = w('p1-12', 'p1-15');
  const bF = w('p1-16', 'p1-17');
  const bFb = w('p1-17');
  const bG = w('p1-18', 'p1-20');
  const bH = w('p1-21', 'p1-25');
  const bZ = w('p1-25');

  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <SceneTag chapter="P1" tagline="机库全景 · 五源与三轴" accent={theme.concept} />

      {/* 1-A 设问 + 一扇窗装置 */}
      <Sequence from={bA.from} durationInFrames={bA.durationInFrames} name="1-A">
        <ModelWindow at={at('p1-02') - bA.from} />
      </Sequence>

      {/* 1-B/1-C/1-D 五源：三段接力全屏独占（1-D 背靠背 1-C 尾 → false；1-C 隔句空窗入场） */}
      <Sequence from={bB.from} durationInFrames={bB.durationInFrames} name="1-B">
        <ArchifyRecap
          slug="five-sources"
          caption="五源 · 身份与记忆"
          cues={[
            {chapterId: 'fs-instr', at: at('p1-03') - bB.from, durationInFrames: dur('p1-03')},
            {chapterId: 'fs-mem', at: at('p1-05') - bB.from, durationInFrames: dur('p1-05')},
          ]}
        />
      </Sequence>
      <Sequence from={bC.from} durationInFrames={bC.durationInFrames} name="1-C">
        <ArchifyRecap
          slug="five-sources"
          caption="五源 · 知识 / 能力 / 会话"
          cues={[
            {chapterId: 'fs-know', at: at('p1-07') - bC.from, durationInFrames: dur('p1-07')},
            {chapterId: 'fs-tools', at: at('p1-08') - bC.from, durationInFrames: dur('p1-08')},
            {chapterId: 'fs-session', at: at('p1-10') - bC.from, durationInFrames: dur('p1-10')},
          ]}
        />
      </Sequence>
      <Sequence from={bD.from} durationInFrames={bD.durationInFrames} name="1-D">
        <ArchifyRecap slug="five-sources" caption="五源汇流" cues={[{chapterId: 'fs-out', at: at('p1-11') - bD.from, durationInFrames: dur('p1-11')}]} lead={false} />
      </Sequence>

      {/* 1-E 结构轴五层 + 验收面（隔句空窗，首 cue 入场） */}
      <Sequence from={bE.from} durationInFrames={bE.durationInFrames} name="1-E">
        <ArchifyRecap
          slug="blueprint--architecture"
          caption="结构轴 · 五正交层"
          cues={[
            {chapterId: 'ax-struct', at: at('p1-14') - bE.from, durationInFrames: dur('p1-14')},
            {chapterId: 'ax-accept', at: at('p1-15') - bE.from, durationInFrames: dur('p1-15')},
          ]}
        />
      </Sequence>

      {/* 1-F/1-Fb 时间轴大回路：lc-loop 背靠背 1-E 尾（false）→ lc-verify 接力（false） */}
      <Sequence from={bF.from} durationInFrames={bF.durationInFrames} name="1-F">
        <ArchifyRecap slug="lifecycle" caption="时间轴 · CGAVE 回路" cues={[{chapterId: 'lc-loop', at: at('p1-16') - bF.from, durationInFrames: dur('p1-16')}]} lead={false} />
      </Sequence>
      <Sequence from={bFb.from} durationInFrames={bFb.durationInFrames} name="1-Fb">
        <ArchifyRecap slug="lifecycle" caption="验证 · 显式一环" cues={[{chapterId: 'lc-verify', at: at('p1-17') - bFb.from, durationInFrames: dur('p1-17')}]} lead={false} />
      </Sequence>

      {/* 1-G 正交性：对象轴×时间轴（承接 1-Fb 尾 → false）；lc-evolve 接 lifecycle 链尾（跨实例背靠背 false） */}
      <Sequence from={bG.from} durationInFrames={bG.durationInFrames} name="1-G">
        <ArchifyRecap
          slug="blueprint--architecture"
          caption="三轴正交 · 换 A 不动 B"
          cues={[
            {chapterId: 'ax-obj', at: at('p1-18') - bG.from, durationInFrames: dur('p1-18')},
            {chapterId: 'ax-time', at: at('p1-19') - bG.from, durationInFrames: dur('p1-19')},
          ]}
          lead={false}
        />
        <ArchifyRecap slug="lifecycle" caption="进化 · 复利一环" cues={[{chapterId: 'lc-evolve', at: at('p1-20') - bG.from, durationInFrames: dur('p1-20')}]} lead={false} />
      </Sequence>

      {/* 1-H 公理 + 目标函数金句卡（金句常驻至 p1-25 末，1-Z 工卡底部避让） */}
      <Sequence from={bH.from} durationInFrames={bH.durationInFrames} name="1-H">
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <QuoteCard zh="预算之内，只给最有用的那一小撮" accent={theme.concept} />
        </AbsoluteFill>
        <ArchifyRecap slug="failure-map" caption="静默退化 · context rot" cues={[{chapterId: 'fm-silent', at: at('p1-23') - bH.from, durationInFrames: dur('p1-23')}]} />
      </Sequence>

      {/* 幕尾：工卡第 1 格盖章（进度锚；底部锚定 200 避开字幕带/QA 安全区 + 收窄避让 1-H 金句） */}
      <Sequence from={bZ.from} durationInFrames={bZ.durationInFrames} name="1-Z">
        <AbsoluteFill style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 200}}>
          <WorkCard stamps={1} totalSlots={7} highlightSlot={0} w={320} />
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
