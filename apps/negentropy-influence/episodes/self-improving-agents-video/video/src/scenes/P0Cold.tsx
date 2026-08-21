import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {FadeUp, Pill, QuoteCard} from '../components/cards';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';

/** 0-A：Good 预言打字机金句卡 */
const GoodQuote: React.FC = () => {
  const frame = useCurrentFrame();
  const zh = '"第一台超智能机器，将是人类需要做出的最后一项发明。"';
  const shown = Math.min(zh.length, Math.floor(frame / 2.2));
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 180px'}}>
      <div style={{textAlign: 'center'}}>
        <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, letterSpacing: 6}}>
          1966 · I. J. GOOD
        </div>
        <div
          style={{
            marginTop: 40,
            fontFamily: theme.serif,
            fontSize: 62,
            fontWeight: 700,
            color: theme.text,
            lineHeight: 1.6,
            minHeight: 200,
          }}
        >
          {zh.slice(0, shown)}
          <span style={{opacity: frame % 20 < 10 ? 1 : 0, color: theme.brain}}>▎</span>
        </div>
        <div
          style={{
            marginTop: 36,
            fontFamily: theme.serif,
            fontStyle: 'italic',
            fontSize: 28,
            color: theme.dim,
            opacity: interpolate(frame, [70, 100], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          "The first ultraintelligent machine is the last invention that man need ever make."
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 0-B：现代 AI 能力环绕 */
const ModernAI: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const icons = ['💬', '⌨️', '📄', '✈️', '📅', '🔍'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 200,
          height: 200,
          borderRadius: 48,
          background: `linear-gradient(135deg, ${theme.brainDeep}, ${theme.panel})`,
          border: `3px solid ${theme.brain}`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: 90,
          boxShadow: `0 0 80px ${theme.brain}44`,
        }}
      >
        🤖
      </div>
      {icons.map((icon, i) => {
        const angle = (i / icons.length) * Math.PI * 2 + frame * 0.008;
        const enter = spring({frame: frame - i * 4, fps, config: {damping: 200}});
        return (
          <div
            key={icon}
            style={{
              position: 'absolute',
              fontSize: 64,
              opacity: enter,
              transform: `translate(${Math.cos(angle) * 360 * enter}px, ${Math.sin(angle) * 300 * enter}px)`,
            }}
          >
            {icon}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** 0-C：出厂重置——对话清空 + 电脑重启进度条弹回"出厂设置" */
const FactoryReset: React.FC<{wipeAt: number}> = ({wipeAt}) => {
  const frame = useCurrentFrame();
  const wipe = interpolate(frame, [wipeAt, wipeAt + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const progress = interpolate(frame, [wipeAt + 25, wipeAt + 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', gap: 80, flexDirection: 'row'}}>
      <div
        style={{
          width: 560,
          height: 480,
          borderRadius: 20,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          padding: 28,
          overflow: 'hidden',
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim, marginBottom: 20}}>
          对话记录
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: 52,
              marginBottom: 18,
              marginLeft: i % 2 === 0 ? 0 : 120,
              borderRadius: 26,
              background: i % 2 === 0 ? theme.brainDeep : theme.panelBorder,
              opacity: (1 - wipe) * (1 - i * 0.08),
              transform: `translateX(${wipe * (i % 2 === 0 ? -600 : 600)}px)`,
            }}
          />
        ))}
      </div>
      <div
        style={{
          width: 560,
          height: 400,
          borderRadius: 24,
          background: '#05070B',
          border: `3px solid ${theme.panelBorder}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 36,
        }}
      >
        <div style={{fontSize: 72, opacity: progress < 1 ? 1 : 0.3}}>🔄</div>
        <div style={{width: 380, height: 14, borderRadius: 7, background: theme.panelBorder}}>
          <div
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              borderRadius: 7,
              background: theme.danger,
            }}
          />
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 30, color: progress >= 1 ? theme.danger : theme.dim}}>
          {progress >= 1 ? '已恢复出厂设置' : '正在清空记忆…'}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 0-E：论文卡 */
const PaperCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 16}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 1080,
          padding: '64px 72px',
          borderRadius: 24,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          transform: `rotateY(${(1 - enter) * 60}deg) scale(${0.9 + enter * 0.1})`,
          boxShadow: '0 40px 120px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.gear}}>arXiv:2607.13104 · 2026-07</div>
        <div
          style={{
            marginTop: 28,
            fontFamily: theme.serif,
            fontSize: 52,
            fontWeight: 700,
            color: theme.text,
            lineHeight: 1.35,
          }}
        >
          Self-Improvements in Modern Agentic Systems: A Survey
        </div>
        <div style={{marginTop: 32, fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
          Jürgen Schmidhuber 团队 · KAUST / 吉林大学 / IDSIA
        </div>
        <div style={{marginTop: 28, display: 'flex', gap: 16}}>
          <Pill color={theme.brain}>第 5 章 · 改大脑</Pill>
          <Pill color={theme.gear}>第 6 章 · 改装备</Pill>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 0-F：片名标题卡 */
const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const split = interpolate(frame, [10, 40], [0, 420], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{position: 'absolute', width: '100%', height: 8, top: '50%'}}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: `translateX(${-split - 400}px) rotate(-12deg)`,
            width: 400,
            height: 8,
            borderRadius: 4,
            background: `linear-gradient(90deg, transparent, ${theme.brain})`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: `translateX(${split}px) rotate(12deg)`,
            width: 400,
            height: 8,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${theme.gear}, transparent)`,
          }}
        />
      </div>
      <div
        style={{
          fontFamily: theme.sans,
          fontWeight: 900,
          fontSize: 130,
          color: theme.text,
          opacity: enter,
          transform: `scale(${0.8 + enter * 0.2})`,
          textShadow: `0 0 100px ${theme.brain}66`,
        }}
      >
        AI 如何自己变强？
      </div>
      <FadeUp delay={20} style={{marginTop: 40}}>
        <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.dim}}>
          自我进化的两条路 · 一篇综述讲明白
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

export const P0Cold: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p0-01', 'p0-03')} name="0-A 金句卡">
        <GoodQuote />
      </Sequence>
      <Sequence {...w('p0-04', 'p0-05')} name="0-B 现代AI">
        <ModernAI />
      </Sequence>
      <Sequence {...w('p0-06', 'p0-08')} name="0-C 出厂重置">
        <FactoryReset wipeAt={10} />
      </Sequence>
      <Sequence {...w('p0-10', 'p0-11')} name="0-D 主线问题">
        <QuoteCard zh="AI 能不能越用越强？" accent={theme.text} />
      </Sequence>
      <Sequence {...w('p0-12', 'p0-13')} name="0-E 论文卡">
        <PaperCard />
      </Sequence>
      <Sequence {...w('p0-14')} name="0-F 标题卡">
        <TitleCard />
      </Sequence>
    </AbsoluteFill>
  );
};
