/** P0 钥匙给了，还是答错（p0-01..10）——guided-learn Phase 0「准入体检」的视频形态：
 *  不讲机制，先让观众亲身失语一次（看不懂的物理列名墙）。
 *  W6 起 0-B/0-C 全句由 archify 图主控（ColumnWall/ThreeDefs 退役），自制件仅存
 *  0-D TitleCard 与 0-A EvidenceBadge。 */
import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, useDraw, useSpring} from '../motion';
import {EvidenceBadge, Stage} from '../components/devices';
import {ArchifyRecap} from '../components/ArchifyRecap';

/** 0-D 片名卡 */
const TitleCard: React.FC = () => {
  const line = useDraw(2, DUR.f6);
  const t = useSpring('settle', {at: 12, dur: DUR.f6});
  return (
    <div style={{textAlign: 'center'}}>
      <svg width={900} height={4} style={{display: 'block', margin: '0 auto 34px'}}>
        <line x1={0} y1={2} x2={900} y2={2} stroke={theme.engine} strokeWidth={3} {...line} />
      </svg>
      <div
        style={{
          fontFamily: theme.serif,
          fontSize: 78,
          color: theme.text,
          opacity: t,
          transform: `translateY(${(1 - t) * 18}px)`,
          letterSpacing: 2,
        }}
      >
        拆解 Horizon Context
      </div>
      <div
        style={{
          marginTop: 20,
          fontFamily: theme.sans,
          fontSize: 32,
          color: theme.manual,
          opacity: t,
        }}
      >
        功能、治理、安全与开放性
      </div>
    </div>
  );
};

export const P0Cold: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const bA = w('p0-01', 'p0-03');
  const bB = w('p0-04', 'p0-06');
  const bC = w('p0-07', 'p0-08');
  const bD = w('p0-09', 'p0-10');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="0-A 终端问答翻红叉">
        <Stage>
          <EvidenceBadge grade="vendor" at={at('p0-03') - bA.from} />
        </Stage>
        <ArchifyRecap
          slug="bare-key-baseline"
          caption="裸库基线"
          cues={[
            {chapterId: 'whole-key', at: at('p0-01') - bA.from, durationInFrames: dur('p0-01')},
            {chapterId: 'blind-wrong', at: at('p0-02') - bA.from, durationInFrames: dur('p0-02')},
            {chapterId: 'baseline-two', at: at('p0-03') - bA.from, durationInFrames: dur('p0-03')},
          ]}
        />
      </Sequence>
      <Sequence {...bB} name="0-B 乱码列名墙">
        {/* p0-03→04（bare-key-baseline 末 cue）、04→05（本镜双实例交界）均跨实例背靠背
            → 两实例都 lead={false}；05→06 同实例连续换章由 enters 抑制 */}
        <ArchifyRecap
          slug="dual-baseline-evidence"
          caption="双基线证据链"
          lead={false}
          cues={[
            {chapterId: 'two-benchmarks', at: at('p0-04') - bB.from, durationInFrames: dur('p0-04')},
          ]}
        />
        <ArchifyRecap
          slug="cipher-translate"
          caption="密文对译"
          lead={false}
          cues={[
            {chapterId: 'not-model-dumb', at: at('p0-05') - bB.from, durationInFrames: dur('p0-05')},
            {chapterId: 'cipher-wall', at: at('p0-06') - bB.from, durationInFrames: dur('p0-06')},
          ]}
        />
      </Sequence>
      <Sequence {...bC} name="0-C 净收入三算法对撞">
        {/* cipher-translate 跨镜续章（同图独立实例）：p0-06→07 跨实例背靠背，enters 只在
            单实例内生效，续章实例仍须 lead={false}；p0-07→08 换图背靠背 → caliber-clash 同 */}
        <ArchifyRecap
          slug="cipher-translate"
          caption="密文对译"
          lead={false}
          cues={[
            {chapterId: 'letters-not-meaning', at: at('p0-07') - bC.from, durationInFrames: dur('p0-07')},
          ]}
        />
        <ArchifyRecap
          slug="caliber-clash"
          caption="口径打架"
          lead={false}
          cues={[
            {chapterId: 'three-dashboards', at: at('p0-08') - bC.from, durationInFrames: dur('p0-08')},
          ]}
        />
      </Sequence>
      <Sequence {...bD} name="0-D 片名卡">
        <Stage top={340}>
          <TitleCard />
        </Stage>
      </Sequence>
    </AbsoluteFill>
  );
};
