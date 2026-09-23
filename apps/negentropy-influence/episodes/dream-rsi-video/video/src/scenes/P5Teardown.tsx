/** P5 我们亲手拆坏它（p5-01..19）——danger 红压场（幕基调切换）：
 *  5-A 工具箱开箱 D1–D5 · 5-B/C/D 三张拆解图（archify）· 5-E D2/D3 快闪 + 收幕金句。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useEnter, useImpulse, usePushIn, useStagger} from '../motion';
import {Backdrop, BeatHeadline, Footnote, NumberedCard, Panel, SceneTag} from '../components/motifs';
import {QuoteCard} from '../components/cards';
import {ArchifyRecap} from '../components/ArchifyRecap';

/** 5-A：工具箱开箱，五把扳手编号 D1–D5（panel 底反枚举 + danger 描边）。 */
const Toolbox: React.FC = () => {
  const fall = useEnter('fall', {dist: 46});
  const tools = useStagger(5, {at: 8, dur: DUR.f4, stride: 7});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div {...fall}>
        <Panel accent={theme.danger} style={{padding: '40px 60px'}}>
          <div style={{fontFamily: theme.serif, fontSize: 44, color: theme.danger}}>拆解工具箱</div>
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginTop: 8}}>
            玩具模型照论文搭 · 五次破坏实验 · 全是真跑出来的数
          </div>
          <div style={{display: 'flex', gap: 22, marginTop: 30}}>
            {['D1', 'D2', 'D3', 'D4', 'D5'].map((d, i) => (
              <div key={d} style={{opacity: tools[i], transform: `translateY(${(1 - tools[i]) * 26}px)`}}>
                <NumberedCard index={i + 1} label={d} accent={theme.danger} width={130} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Footnote delay={12}>一级证据：dream_rsi_lab.py --break D1..D5 实测输出</Footnote>
    </AbsoluteFill>
  );
};

/** 5-E：D2/D3 快闪卡（数字翻牌）+ 收幕金句卡。 */
const FlashAndQuote: React.FC<{d2At: number; d3At: number; quoteAt: number}> = ({d2At, d3At, quoteAt}) => {
  const frame = useCurrentFrame();
  const d2 = useImpulse({at: d2At, dur: DUR.f4});
  const d3 = useImpulse({at: d3At, dur: DUR.f4});
  const quoteIn = progress(frame, quoteAt, 6);
  const quotePush = usePushIn(quoteAt, {scale: 0.05});
  return (
    <AbsoluteFill>
      {quoteIn < 1 ? (
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
          <div style={{display: 'flex', gap: 60}}>
            <div style={{transform: `scale(${1 + d2 * 0.06})`}}>
              <Panel accent={theme.danger} style={{padding: '26px 40px', minWidth: 480}}>
                <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.danger}}>D2 · 拔掉并行奖励</div>
                <div style={{fontFamily: theme.mono, fontSize: 40, color: theme.text, marginTop: 10}}>
                  V 0.83 <span style={{color: theme.danger}}>→ 0.54</span>
                </div>
                <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 8}}>
                  满批干活的章程被严重低估
                </div>
              </Panel>
            </div>
            <div style={{transform: `scale(${1 + d3 * 0.06})`}}>
              <Panel accent={theme.danger} style={{padding: '26px 40px', minWidth: 480}}>
                <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.danger}}>D3 · 拔掉成本罚款</div>
                <div style={{fontFamily: theme.mono, fontSize: 40, color: theme.text, marginTop: 10}}>
                  胜者 = <span style={{color: theme.danger}}>铺张扩张者</span>
                </div>
                <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginTop: 8}}>
                  目标退化成只看最高分
                </div>
              </Panel>
            </div>
          </div>
        </AbsoluteFill>
      ) : null}
      {quoteIn > 0 ? (
        <div style={{position: 'absolute', inset: 0, opacity: quoteIn, transform: quotePush}}>
          <div style={{background: theme.bg, height: '100%'}}>
            <QuoteCard
              zh="断言，必须以真跑输出为准"
              en="Trust the measured result over what the proposal claims about itself."
              cite="原型 D4 复现实录"
              accent={theme.danger}
            />
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const P5Teardown: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const b5B = w('p5-03', 'p5-05');
  const b5C = w('p5-06', 'p5-10');
  const b5D = w('p5-11', 'p5-15');
  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <Backdrop tint={theme.danger} opacity={0.07} />
      <SceneTag chapter="P5" tagline="我们亲手拆坏它" accent={theme.danger} />
      <Sequence {...w('p5-01', 'p5-02')} name="5-A 拆解宣言">
        <Toolbox />
      </Sequence>
      <Sequence {...b5B} name="5-B 拆保险（D1）">
        <ArchifyRecap
          slug="teardown-d1-guard"
          caption="D1 · 拆掉防回退保险"
          cues={[
            {chapterId: 'intact', at: at('p5-03') - b5B.from, durationInFrames: dur('p5-03')},
            {chapterId: 'removed', at: at('p5-04') - b5B.from, durationInFrames: dur('p5-04')},
            {chapterId: 'insurance', at: at('p5-05') - b5B.from, durationInFrames: dur('p5-05')},
          ]}
        />
      </Sequence>
      <Sequence {...b5C} name="5-C 拆规矩（D4）">
        <BeatHeadline title="D4 · 拆重放的规矩" until={at('p5-07') - b5C.from} accent={theme.danger} />
        <ArchifyRecap
          slug="teardown-d4-peek"
          caption="D4 · 拆重放的规矩"
          lead={false}
          cues={[
            {chapterId: 'legal', at: at('p5-07') - b5C.from, durationInFrames: dur('p5-07')},
            {chapterId: 'cheat', at: at('p5-08') - b5C.from, durationInFrames: dur('p5-08')},
            {chapterId: 'reversal', at: at('p5-09') - b5C.from, durationInFrames: dur('p5-09')},
            {chapterId: 'lesson', at: at('p5-10') - b5C.from, durationInFrames: dur('p5-10')},
          ]}
        />
      </Sequence>
      <Sequence {...b5D} name="5-D 拆用法（D5）">
        <ArchifyRecap
          slug="teardown-d5-lockin"
          caption="D5 · 换一种用历史的办法"
          lead={false}
          cues={[
            {chapterId: 'inject', at: at('p5-11') - b5D.from, durationInFrames: dur('p5-11')},
            {chapterId: 'replay', at: at('p5-14') - b5D.from, durationInFrames: dur('p5-14')},
            {chapterId: 'diversity', at: at('p5-15') - b5D.from, durationInFrames: dur('p5-15')},
          ]}
        />
      </Sequence>
      <Sequence {...w('p5-16', 'p5-19')} name="5-E 快闪与金句">
        <FlashAndQuote
          d2At={at('p5-16') - w('p5-16', 'p5-19').from}
          d3At={at('p5-17') - w('p5-16', 'p5-19').from}
          quoteAt={at('p5-18') - w('p5-16', 'p5-19').from}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
