import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {FadeUp, QuoteCard} from '../components/cards';

/** 6-A 地图回顾：四元素拼图合拢 */
const MapRecap: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const e = spring({frame, fps, config: {damping: 200}});
  const quads = [
    {title: '五个对象', sub: '框架 · 记忆 · 技能 · 模型 · 工作流', color: theme.evo, icon: '🗺️'},
    {title: '三个时刻', sub: '干活时 · 下班后 · 攒批换代', color: theme.evo, icon: '⏱️'},
    {title: '三类证据', sub: '结果 · 环境反馈 · 轨迹', color: theme.code, icon: '⚖️'},
    {title: '一道门', sub: '可信 · trustworthy', color: theme.code, icon: '🚪'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: e, display: 'grid', gridTemplateColumns: 'repeat(2, 480px)', gap: 24}}>
        {quads.map((q, i) => (
          <FadeUp key={q.title} delay={i * 10}>
            <div
              style={{
                padding: '28px 32px',
                borderRadius: 16,
                background: theme.panel,
                border: `2px solid ${q.color}`,
                display: 'flex',
                alignItems: 'center',
                gap: 20,
              }}
            >
              <span style={{fontSize: 46}}>{q.icon}</span>
              <div>
                <div style={{fontFamily: theme.serif, fontSize: 32, fontWeight: 700, color: q.color}}>{q.title}</div>
                <div style={{marginTop: 6, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{q.sub}</div>
              </div>
            </div>
          </FadeUp>
        ))}
      </div>
      <FadeUp delay={60}>
        <div style={{marginTop: 44, fontFamily: theme.sans, fontSize: 28, color: theme.text}}>
          还有一个考场 <span style={{color: theme.code}}>SWE-bench</span>，把它们串在一起
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 6-B 开放问题：星空问号 */
const OpenQuestion: React.FC = () => {
  const frame = useCurrentFrame();
  const stars = Array.from({length: 26}).map((_, i) => ({
    x: (i * 173) % 1700 + 90,
    y: (i * 397) % 780 + 60,
    tw: Math.sin(frame / 12 + i) * 0.5 + 0.5,
  }));
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 40%, ${theme.panel}, ${theme.bg} 75%)`}}>
      {stars.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: 5,
            height: 5,
            borderRadius: 3,
            background: theme.text,
            opacity: 0.25 + s.tw * 0.5,
          }}
        />
      ))}
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
        <FadeUp>
          <div style={{textAlign: 'center'}}>
            <div style={{fontFamily: theme.serif, fontSize: 56, fontWeight: 700, color: theme.text, lineHeight: 1.6}}>
              代码世界学到的进化，
              <br />
              能带出代码世界吗？
            </div>
            <div
              style={{
                marginTop: 36,
                fontFamily: theme.mono,
                fontSize: 24,
                color: theme.dim,
                opacity: interpolate(frame, [40, 70], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
              }}
            >
              “remains largely unexplored”
            </div>
          </div>
        </FadeUp>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 6-C 系列三卡 */
const SeriesThree: React.FC = () => {
  const frame = useCurrentFrame();
  const eps = [
    {title: 'AI 如何自己变强？', sub: '自我进化 · 改什么', c1: '#4A9EFF', c2: '#FF9F45', ep: '第一集'},
    {title: '上线之后，AI 才开始上学', sub: '经验 · 怎么攒', c1: '#F5C542', c2: '#2DD4BF', ep: '第二集'},
    {title: '会写代码的 AI，开始给自己写代码', sub: '代码田野 · 全图', c1: '#4ADE80', c2: '#FF6EC7', ep: '第三集 · 本集'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 40, alignItems: 'center'}}>
        {eps.map((ep, i) => (
          <FadeUp key={ep.title} delay={i * 16}>
            <div
              style={{
                width: 420,
                padding: '30px 26px',
                borderRadius: 16,
                background: theme.panel,
                border: `2px solid ${i === 2 ? theme.text : theme.panelBorder}`,
                boxShadow: i === 2 ? `0 0 44px ${theme.codeDeep}` : 'none',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  height: 10,
                  borderRadius: 5,
                  background: `linear-gradient(90deg, ${ep.c1}, ${ep.c2})`,
                  opacity: 0.9,
                }}
              />
              <div style={{marginTop: 18, fontFamily: theme.mono, fontSize: 20, color: theme.dim}}>{ep.ep}</div>
              <div style={{marginTop: 10, fontFamily: theme.serif, fontSize: 26, fontWeight: 700, color: theme.text, lineHeight: 1.5}}>
                《{ep.title}》
              </div>
              <div style={{marginTop: 10, fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>{ep.sub}</div>
            </div>
          </FadeUp>
        ))}
      </div>
      <FadeUp delay={70}>
        <div style={{marginTop: 50, fontFamily: theme.sans, fontSize: 28, color: theme.text}}>
          三块拼图：改什么 → 怎么攒 → <span style={{color: theme.code, fontWeight: 700}}>代码领域全图</span>
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 6-D 配套仓库卡 */
const RepoCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const e = spring({frame, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          opacity: e,
          width: 1000,
          padding: '40px 50px',
          borderRadius: 16,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          display: 'flex',
          alignItems: 'center',
          gap: 34,
        }}
      >
        <div style={{fontSize: 74}}>📚</div>
        <div>
          <div style={{fontFamily: theme.serif, fontSize: 34, fontWeight: 700, color: theme.text}}>
            Awesome-Self-Evolving-Coding-Agents
          </div>
          <div style={{marginTop: 12, fontFamily: theme.mono, fontSize: 24, color: theme.code}}>
            github.com/zhouhao1024/Awesome-Self-Evolving-Coding-Agents
          </div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>
            论文作者维护的配套论文清单
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 6-E 引用卡收束（末尾渐黑：窗口从本 beat 实际时长推导，不写死帧数） */
const CitationFade: React.FC<{beatDurationInFrames: number}> = ({beatDurationInFrames}) => {
  const frame = useCurrentFrame();
  const fadeStart = beatDurationInFrames - Math.round(1.6 * 30);
  const fadeOut = interpolate(frame, [Math.max(fadeStart, 40), beatDurationInFrames - 2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{background: theme.bg}}>
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: fadeOut}}>
        <FadeUp>
          <div style={{textAlign: 'center'}}>
            <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text, lineHeight: 1.6}}>
              会写代码的 AI，
              <br />
              开始给自己写代码
            </div>
            <div style={{marginTop: 34, fontFamily: theme.mono, fontSize: 28, color: theme.code}}>arXiv:2608.03392</div>
            <div style={{marginTop: 14, fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>
              南京理工大学 × 南京大学 · 2026 年 8 月
            </div>
            <div style={{marginTop: 30, display: 'flex', justifyContent: 'center', gap: 18}}>
              <span style={{fontSize: 40}}>🚪</span>
              <span style={{fontSize: 40}}>🧑‍⚖️</span>
            </div>
          </div>
        </FadeUp>
      </AbsoluteFill>
      {/* 渐黑遮罩（独立于内容，保证纯黑收尾） */}
      <AbsoluteFill style={{background: '#000', opacity: 1 - fadeOut, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

export const P6Ending: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const endingBeat = w('p6-14', 'p6-17');
  return (
    <AbsoluteFill>
      <Sequence {...w('p6-01', 'p6-03')} name="6-A 地图回顾">
        <MapRecap />
      </Sequence>
      <Sequence {...w('p6-04', 'p6-07')} name="6-B 开放问题">
        <OpenQuestion />
      </Sequence>
      <Sequence {...w('p6-08', 'p6-11')} name="6-C 系列三卡">
        <SeriesThree />
      </Sequence>
      <Sequence {...w('p6-12', 'p6-13')} name="6-D 配套仓库">
        <RepoCard />
      </Sequence>
      <Sequence {...endingBeat} name="6-E 引用卡收束">
        <CitationFade beatDurationInFrames={endingBeat.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
