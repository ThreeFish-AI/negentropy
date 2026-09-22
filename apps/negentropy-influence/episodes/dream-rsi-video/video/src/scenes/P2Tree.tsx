/** P2 机制一：台账与同一套决策（p2-01..13）——sun 暖白昼：
 *  2-A 发现树图（archify）· 2-B 批次自由度（archify）· 2-C 玩具队三 worker 分叉落格
 *  · 2-D 决策接口图（archify）+ 昼夜分屏收尾。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useCount, useDraw, useEnter, useFlowDash, useImpulse, useStagger} from '../motion';
import {Backdrop, Footnote, NumberedCard, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';

/** 2-C：三支小队分叉出发，编号卡分数滚动落格；0.80 稳定突破格 grow 辉光。 */
const ToyFork: React.FC<{scoresAt: number[]; heroAt: number}> = ({scoresAt, heroAt}) => {
  const forks = useStagger(3, {at: 4, dur: DUR.f5, stride: 9});
  const counts = [
    useCount({to: 0.5, at: scoresAt[0], dur: DUR.f5}),
    useCount({to: 0.35, at: scoresAt[1], dur: DUR.f5}),
    useCount({to: 0.8, at: scoresAt[2], dur: DUR.f5}),
  ];
  const hero = useImpulse({at: heroAt, dur: DUR.f4});
  const arrow = useDraw(2, DUR.f5);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {/* 出发点 + 三条分叉线（SVG，描线生长） */}
      <svg width={1300} height={240} viewBox="0 0 1300 240" style={{position: 'absolute', top: 320}}>
        <line x1={80} y1={120} x2={380} y2={120} stroke={theme.sun} strokeWidth={3} {...arrow} />
        {[40, 120, 200].map((y, i) => (
          <line
            key={y}
            x1={380}
            y1={120}
            x2={640}
            y2={y}
            stroke={i === 2 ? theme.grow : theme.dim}
            strokeWidth={2.5}
            {...arrow}
          />
        ))}
      </svg>
      <Panel accent={theme.sun} style={{padding: '12px 26px', position: 'absolute', left: 90, top: 410}}>
        <span style={{fontFamily: theme.mono, fontSize: 24, color: theme.sun}}>营地出发点 · 批次×3</span>
      </Panel>
      {/* 三块编号卡（panel 底反枚举；突破卡激活才染 grow） */}
      <div style={{display: 'flex', gap: 40, position: 'absolute', top: 470}}>
        {[
          {label: '开局平平', sub: 's=0.50'},
          {label: '误入陷阱', sub: 's=0.35'},
          {label: '稳稳突破', sub: 's=0.80'},
        ].map((c, i) => (
          <div key={c.label} style={{opacity: forks[i], transform: `translateY(${(1 - forks[i]) * 22}px)`}}>
            <div
              style={{
                boxShadow:
                  i === 2 ? `0 0 ${14 + hero * 26}px ${theme.grow}88` : undefined,
              }}
            >
              <NumberedCard
                index={i + 1}
                label={c.label}
                sub={`s=${counts[i].toFixed(2)}`}
                active={i === 2}
                accent={i === 2 ? theme.grow : undefined}
              />
            </div>
          </div>
        ))}
      </div>
      <Footnote delay={8}>原型 dream_rsi_lab.py 实测输出（一级证据）</Footnote>
    </AbsoluteFill>
  );
};

/** 2-D 后半：昼夜分屏——左 sun 进山、右 dream 沙盘，同一份章程卡居中贯通。 */
const DayNightBridge: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const open = progress(frame, at, DUR.f5);
  const flow = useFlowDash({dash: 12, gap: 10, period: 22});
  return (
    <AbsoluteFill>
      {/* 左右两半对开（宽度由 0 → 47%） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${open * 47}%`,
          background: `${theme.sun}0D`,
          borderRight: `2px solid ${theme.sun}66`,
        }}
      >
        <div style={{padding: '110px 0 0 80px', fontFamily: theme.sans, fontSize: 34, color: theme.sun}}>
          白天 · 真实进山
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: `${open * 47}%`,
          background: `${theme.dream}0D`,
          borderLeft: `2px solid ${theme.dream}66`,
        }}
      >
        <div style={{padding: '110px 60px 0 0', fontFamily: theme.sans, fontSize: 34, color: theme.dream, textAlign: 'right'}}>
          夜里 · 沙盘推演
        </div>
      </div>
      {/* 居中章程卡：贯通两个世界（双向流动线） */}
      <div style={{position: 'absolute', left: '50%', top: '42%', transform: 'translate(-50%, -50%)'}}>
        <Panel accent={theme.grow} style={{padding: '18px 40px'}}>
          <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>同一份章程</div>
          <div style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 700, color: theme.text, marginTop: 4}}>
            只管挑批次
          </div>
        </Panel>
      </div>
      <svg width={520} height={80} viewBox="0 0 520 80" style={{position: 'absolute', left: '50%', top: '58%', transform: 'translateX(-50%)'}}>
        <line x1={20} y1={40} x2={500} y2={40} stroke={theme.dim} strokeWidth={2} opacity={open} {...flow} />
      </svg>
    </AbsoluteFill>
  );
};

export const P2Tree: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const b2A = w('p2-01', 'p2-04');
  const b2B = w('p2-05', 'p2-07');
  const b2C = w('p2-08', 'p2-10');
  const b2D = w('p2-11', 'p2-13');
  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <Backdrop tint={theme.sun} />
      <SceneTag chapter="P2" tagline="机制一 · 台账与同一套决策" accent={theme.sun} />
      <Sequence {...b2A} name="2-A 发现树生长">
        <ArchifyRecap
          slug="discovery-tree"
          caption="台账长成树"
          cues={[
            {chapterId: 'pages', at: at('p2-02') - b2A.from, durationInFrames: dur('p2-02')},
            {chapterId: 'grow', at: at('p2-04') - b2A.from, durationInFrames: dur('p2-04')},
          ]}
        />
      </Sequence>
      <Sequence {...b2B} name="2-B 批次与自由度">
        <ArchifyRecap
          slug="replay-simulator"
          caption="批次即全部自由度"
          lead={false}
          cues={[
            {chapterId: 'freedom', at: at('p2-06') - b2B.from, durationInFrames: dur('p2-06')},
          ]}
        />
      </Sequence>
      <Sequence {...b2C} name="2-C 玩具队三连">
        <ToyFork
          scoresAt={[
            at('p2-09') - b2C.from,
            at('p2-10') - b2C.from + 6,
            at('p2-10') - b2C.from + 18,
          ]}
          heroAt={at('p2-10') - b2C.from + 30}
        />
      </Sequence>
      <Sequence {...b2D} name="2-D 同一接口">
        <ArchifyRecap
          slug="discovery-tree"
          caption="同一套决策接口"
          cues={[{chapterId: 'interface', at: at('p2-11') - b2D.from, durationInFrames: dur('p2-11')}]}
        />
        <ArchifyRecap
          slug="two-phase-loop"
          caption="白天进山：章程带队"
          lead={false}
          cues={[{chapterId: 'online', at: at('p2-12') - b2D.from, durationInFrames: dur('p2-12')}]}
        />
        <DayNightBridge at={at('p2-13') - b2D.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
