/** P1 章程写死的探险队（p1-01..17）——sun 暖白基调：
 *  1-A 章程卡+写死印章 · 1-B 两难图（archify）· 1-C 破局金句卡 · 1-D 三件套总装（archify）+冰冻罩覆层。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useBreathe, useEnter, useImpulse, useStagger} from '../motion';
import {Backdrop, Footnote, Panel, SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {ArchifyRecap} from '../components/ArchifyRecap';

/** 1-A：章程卡（三栏：方向/深挖/并行）+「写死」印章 + 算力箭头砸向灰色无效区。 */
const CharterStamp: React.FC<{stampAt: number; wasteAt: number}> = ({stampAt, wasteAt}) => {
  const cols = useStagger(3, {at: 6, dur: DUR.f4, stride: 7});
  const stamp = useImpulse({at: stampAt, dur: DUR.f4, peak: 1});
  const frame = useCurrentFrame();
  const waste = progress(frame, wasteAt, DUR.f6);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'relative'}}>
        <Panel accent={theme.sun} style={{padding: '34px 50px', minWidth: 760}}>
          <div style={{fontFamily: theme.serif, fontSize: 40, color: theme.text}}>领队选路章程</div>
          <div style={{display: 'flex', gap: 22, marginTop: 22}}>
            {['往哪走', '深挖还是绕路', '几队并行'].map((t, i) => (
              <div key={t} style={{opacity: cols[i], transform: `translateY(${(1 - cols[i]) * 18}px)`, flex: 1}}>
                <Panel style={{padding: '16px 18px', textAlign: 'center'}}>
                  <div style={{fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{fontFamily: theme.sans, fontSize: 28, fontWeight: 600, color: theme.text}}>{t}</div>
                </Panel>
              </div>
            ))}
          </div>
        </Panel>
        {/* 「写死」印章：盖章脉冲 + 红描边 */}
        <div
          style={{
            position: 'absolute',
            right: -36,
            top: -34,
            transform: `rotate(-12deg) scale(${1 + stamp * 0.25})`,
            opacity: progress(frame, stampAt, 2),
            border: `4px solid ${theme.danger}`,
            borderRadius: 10,
            padding: '8px 20px',
            fontFamily: theme.serif,
            fontSize: 40,
            fontWeight: 700,
            color: theme.danger,
            background: '#1a0d0d',
          }}
        >
          写 死
        </div>
      </div>
      {/* 算力箭头砸向灰色无效区（弱化词「可能」的画面配重：箭头多数落灰区、少数亮区） */}
      <div style={{position: 'absolute', bottom: 210, display: 'flex', gap: 26, alignItems: 'center', opacity: waste > 0 ? 1 : 0.55}}>
        <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.sun}}>算力 ↓↓</div>
        {['无效方向', '无效方向', '小有收获'].map((t, i) => (
          <div key={i} style={{opacity: waste > 0 ? (i === 2 ? 0.9 : 1) : 0.5}}>
            <Panel
              accent={i === 2 ? theme.grow : theme.panelBorder}
              style={{padding: '10px 22px', opacity: i === 2 ? 0.4 + waste * 0.6 : 1 - waste * 0.3}}
            >
              <span style={{fontFamily: theme.sans, fontSize: 22, color: i === 2 ? theme.grow : theme.dim}}>{t}</span>
            </Panel>
          </div>
        ))}
      </div>
      <Footnote delay={6}>固定章程代表系统：AlphaEvolve 谱系等（名见片尾信源卡）</Footnote>
    </AbsoluteFill>
  );
};

/** 1-D 尾句覆层：冰冻罩微光（「原封不动」的视觉承诺，压角不遮图）。 */
const FreezeOverlay: React.FC<{at: number}> = ({at}) => {
  const glow = useBreathe({period: DUR.f6 * 2, amp: 0.18, base: 0.42, offset: at});
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        top: 150,
        padding: '10px 22px',
        border: `2px solid ${theme.dream}`,
        borderRadius: 10,
        background: '#0A1822AA',
        boxShadow: `0 0 ${12 + glow * 20}px ${theme.dream}66`,
        opacity: progress(frame, at, 6),
      }}
    >
      <span style={{fontFamily: theme.mono, fontSize: 22, color: theme.dream}}>❄ 模型 · 评审 · 接口：原封不动</span>
    </div>
  );
};

export const P1Dilemma: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const b1B = w('p1-06', 'p1-09');
  const b1C2 = w('p1-12');
  const b1D = w('p1-13', 'p1-17');
  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <Backdrop tint={theme.sun} />
      <SceneTag chapter="P1" tagline="章程写死的探险队" accent={theme.sun} />
      <Sequence {...w('p1-01', 'p1-05')} name="1-A 章程与写死">
        <CharterStamp stampAt={at('p1-04') - w('p1-01', 'p1-05').from} wasteAt={at('p1-05') - w('p1-01', 'p1-05').from} />
      </Sequence>
      <Sequence {...b1B} name="1-B 两难">
        <ArchifyRecap
          slug="dilemma-cost"
          caption="两条路都堵"
          cues={[
            {chapterId: 'dilemma', at: at('p1-06') - b1B.from, durationInFrames: dur('p1-06')},
            {chapterId: 'stuck', at: at('p1-08') - b1B.from, durationInFrames: dur('p1-08')},
            {chapterId: 'verdict', at: at('p1-09') - b1B.from, durationInFrames: dur('p1-09')},
          ]}
        />
      </Sequence>
      <Sequence {...w('p1-10', 'p1-11')} name="1-C1 破局金句">
        <div style={{background: theme.bg}}>
          <QuoteCard
            zh="又快又便宜的发现模拟器，让大量章程在烧钱上线前先被筛一遍"
            en="a fast and inexpensive simulator of discovery would allow many exploration policies to be evaluated before costly online deployment"
            cite="Dream-RSI §1"
            accent={theme.dream}
          />
        </div>
      </Sequence>
      <Sequence {...b1C2} name="1-C2 台账揭示">
        <ArchifyRecap
          slug="history-as-simulator"
          caption="历史已是模拟器"
          cues={[
            {chapterId: 'origin', at: at('p1-12') - b1C2.from, durationInFrames: dur('p1-12')},
          ]}
        />
      </Sequence>
      <Sequence {...b1D} name="1-D 三件套总装">
        <ArchifyRecap
          slug="expedition-setup"
          caption="探险队三件套"
          lead={false}
          cues={[
            {chapterId: 'ledger', at: at('p1-13') - b1D.from, durationInFrames: dur('p1-13')},
            {chapterId: 'sandbox', at: at('p1-15') - b1D.from, durationInFrames: dur('p1-15')},
            {chapterId: 'staff', at: at('p1-16') - b1D.from, durationInFrames: dur('p1-16')},
          ]}
        />
        <FreezeOverlay at={at('p1-17') - b1D.from} />
      </Sequence>
    </AbsoluteFill>
  );
};
