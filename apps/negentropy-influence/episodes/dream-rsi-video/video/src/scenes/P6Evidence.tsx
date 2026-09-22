/** P6 实证、批判与收尾（p6-01..22）——昼夜双色合流：
 *  6-A..D 四组图（archify）· 6-E 双色合流 + 总金句 + 引用卡 + 从末 beat 推导的渐黑。 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import type {SceneRange} from '../types';
import {beatWindow} from '../timing';
import {theme} from '../design/theme';
import {DUR, progress, useEnter, useFadeOut, useFlowDash, useStagger} from '../motion';
import {Backdrop, Panel, SceneTag} from '../components/motifs';
import {ArchifyRecap} from '../components/ArchifyRecap';

/** 6-E：sun 与 dream 双色对向合流 → 总金句 → 引用卡（四行错峰）→ 渐黑。
 *  渐黑窗口从**本 beat 总时长**推导（红线四：勿用末句时长）。 */
const Finale: React.FC<{mergeAt: number; quoteAt: number; citeAt: number; beatFrames: number}> = ({
  mergeAt,
  quoteAt,
  citeAt,
  beatFrames,
}) => {
  const frame = useCurrentFrame();
  const merge = progress(frame, mergeAt, DUR.f6);
  const flow = useFlowDash({dash: 14, gap: 10, period: 20});
  const fade = useFadeOut(beatFrames, {frames: Math.min(50, Math.round(beatFrames * 0.4))});
  const cite = useStagger(4, {at: citeAt, dur: DUR.f4, stride: 7});
  const quoteIn = progress(frame, quoteAt, 8);
  return (
    <AbsoluteFill style={{opacity: fade}}>
      {/* 双色对向合流：sun 左起、dream 右起，中央交汇成一幅昼夜图 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 210,
          bottom: 420,
          width: `${merge * 50}%`,
          background: `linear-gradient(to right, ${theme.sun}26, ${theme.sun}0A)`,
          borderRight: `2px solid ${theme.sun}77`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 210,
          bottom: 420,
          width: `${merge * 50}%`,
          background: `linear-gradient(to left, ${theme.dream}26, ${theme.dream}0A)`,
          borderLeft: `2px solid ${theme.dream}77`,
        }}
      />
      <svg width={1100} height={90} viewBox="0 0 1100 90" style={{position: 'absolute', top: 300, left: 410}}>
        <line x1={10} y1={45} x2={540} y2={45} stroke={theme.sun} strokeWidth={3} opacity={merge} {...flow} />
        <line x1={560} y1={45} x2={1090} y2={45} stroke={theme.dream} strokeWidth={3} opacity={merge} {...flow} />
      </svg>
      <div style={{position: 'absolute', top: 200, width: '100%', textAlign: 'center', opacity: merge}}>
        <span style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim}}>
          <span style={{color: theme.sun}}>白天进山烧钱</span> · <span style={{color: theme.dream}}>夜里翻账免费</span>
        </span>
      </div>
      {/* 总金句 */}
      <div
        style={{
          position: 'absolute',
          top: 430,
          width: '100%',
          textAlign: 'center',
          opacity: quoteIn,
          transform: `translateY(${(1 - quoteIn) * 20}px)`,
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 54, fontWeight: 700, color: theme.text}}>
          把历史从落灰的档案
        </div>
        <div style={{fontFamily: theme.serif, fontSize: 54, fontWeight: 700, color: theme.dream, marginTop: 8}}>
          变成能反复推演的模拟器
        </div>
      </div>
      {/* 引用卡：四行错峰 */}
      <div style={{position: 'absolute', bottom: 220, width: '100%', display: 'flex', justifyContent: 'center'}}>
        <Panel style={{padding: '22px 44px', minWidth: 1150}}>
          {[
            '[1] T. Zheng et al., "Dream-RSI: Recursive Self-Improvement through Evolving Worlds," arXiv:2609.14858, Sep. 2026.',
            '代码仓 github.com/zhengkid/Dream-RSI · 画面数字均为论文/原型实测口径',
            '玩具原型与五次破坏实验：本仓 dream_rsi_lab.py（一级证据）',
            '合成语音：IndexTTS-2.5 本人音色克隆',
          ].map((line, i) => (
            <div
              key={i}
              style={{
                fontFamily: theme.mono,
                fontSize: 21,
                color: i === 0 ? theme.text : theme.dim,
                marginTop: i === 0 ? 0 : 8,
                opacity: cite[i],
              }}
            >
              {line}
            </div>
          ))}
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

export const P6Evidence: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (a: string, b?: string) => beatWindow(scene.sentences, scene.from, a, b);
  const at = (id: string) => w(id).from;
  const dur = (a: string, b?: string) => w(a, b).durationInFrames;
  const b6A = w('p6-01', 'p6-05');
  const b6B = w('p6-06', 'p6-10');
  const b6C = w('p6-11', 'p6-16');
  const b6D = w('p6-17', 'p6-20');
  const b6E = w('p6-21', 'p6-22');
  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <Backdrop />
      <SceneTag chapter="P6" tagline="实证、批判与收尾" />
      <Sequence {...b6A} name="6-A 三柱对撞">
        <ArchifyRecap
          slug="evidence-162x-caliber"
          caption="317 vs 550 vs 51200"
          cues={[
            {chapterId: 'bars', at: at('p6-03') - b6A.from, durationInFrames: dur('p6-03')},
            {chapterId: 'ratio', at: at('p6-05') - b6A.from, durationInFrames: dur('p6-05')},
          ]}
        />
      </Sequence>
      <Sequence {...b6B} name="6-B 口径与拆解">
        <ArchifyRecap
          slug="evidence-162x-caliber"
          caption="口径警示 · 拆开看"
          lead={false}
          cues={[
            {chapterId: 'warn', at: at('p6-07') - b6B.from, durationInFrames: dur('p6-07')},
            {chapterId: 'split', at: at('p6-09') - b6B.from, durationInFrames: dur('p6-09')},
          ]}
        />
      </Sequence>
      <Sequence {...b6C} name="6-C 先省后探">
        <ArchifyRecap
          slug="behavior-adaptive"
          caption="先省后探：学出来的章程"
          cues={[
            {chapterId: 'early', at: at('p6-12') - b6C.from, durationInFrames: dur('p6-12')},
            {chapterId: 'save', at: at('p6-13') - b6C.from, durationInFrames: dur('p6-13')},
            {chapterId: 're-explore', at: at('p6-14') - b6C.from, durationInFrames: dur('p6-14')},
            {chapterId: 'perf', at: at('p6-15') - b6C.from, durationInFrames: dur('p6-15')},
          ]}
        />
      </Sequence>
      <Sequence {...b6D} name="6-D 未证明清单">
        <ArchifyRecap
          slug="unproven-list"
          caption="论文没有证明的三件事"
          lead={false}
          cues={[
            {chapterId: 'head', at: at('p6-17') - b6D.from, durationInFrames: dur('p6-17')},
            {chapterId: 'gap-12', at: at('p6-18') - b6D.from, durationInFrames: dur('p6-18')},
            {chapterId: 'gap-345', at: at('p6-20') - b6D.from, durationInFrames: dur('p6-20')},
          ]}
        />
      </Sequence>
      <Sequence {...b6E} name="6-E 总金句与渐黑">
        <Finale
          mergeAt={0}
          quoteAt={at('p6-22') - b6E.from}
          citeAt={at('p6-22') - b6E.from + 20}
          beatFrames={b6E.durationInFrames}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
