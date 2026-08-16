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

/** 0-A：经验时代宣言打字机金句卡 */
const Manifesto: React.FC = () => {
  const frame = useCurrentFrame();
  const zh = '"AI 的下一个时代，叫经验时代。"';
  const shown = Math.min(zh.length, Math.floor(frame / 2.2));
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 180px'}}>
      <div style={{textAlign: 'center'}}>
        <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, letterSpacing: 6}}>
          2025 · THE ERA OF EXPERIENCE
        </div>
        <div
          style={{
            marginTop: 40,
            fontFamily: theme.serif,
            fontSize: 62,
            fontWeight: 700,
            color: theme.exp,
            lineHeight: 1.6,
            minHeight: 200,
          }}
        >
          {zh.slice(0, shown)}
          <span style={{opacity: frame % 20 < 10 ? 1 : 0, color: theme.exp}}>▎</span>
        </div>
        <div
          style={{
            marginTop: 36,
            fontFamily: theme.serif,
            fontStyle: 'italic',
            fontSize: 28,
            color: theme.dim,
            opacity: interpolate(frame, [60, 90], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          "Progress will come from experience generated as agents interact with their environments."
        </div>
        <div
          style={{
            marginTop: 24,
            fontFamily: theme.sans,
            fontSize: 26,
            color: theme.dim,
            opacity: interpolate(frame, [80, 110], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          —— Silver & Sutton, 2025
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 0-B：永远入职第一天——日历翻页盖章 */
const DayOne: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pages = Math.min(5, Math.floor(frame / 14) + 1);
  const stamp = interpolate(frame, [8, 16], [2.4, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 36, alignItems: 'center'}}>
        <div style={{fontSize: 110, opacity: spring({frame: frame - 4, fps, config: {damping: 200}})}}>🤖</div>
        <div style={{position: 'relative', width: 420, height: 330}}>
          {Array.from({length: pages}).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: i * 14,
                left: i * 10,
                width: 360,
                height: 280,
                borderRadius: 18,
                background: theme.panel,
                border: `2px solid ${theme.panelBorder}`,
                padding: 24,
                opacity: 0.35 + i * 0.16,
                transform: `rotate(${(i - 2) * 2}deg)`,
              }}
            >
              <div style={{fontFamily: theme.mono, fontSize: 30, color: theme.dim}}>DAY {100 + i * 37}</div>
              <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 40, color: theme.text}}>
                入职第 {i + 1} 天
              </div>
            </div>
          ))}
          <div
            style={{
              position: 'absolute',
              top: 60,
              right: -30,
              transform: `rotate(-18deg) scale(${pages >= 2 ? stamp : 0.001})`,
              border: `6px solid ${theme.danger}`,
              borderRadius: 12,
              color: theme.danger,
              fontFamily: theme.sans,
              fontWeight: 900,
              fontSize: 44,
              padding: '8px 20px',
              opacity: 0.92,
            }}
          >
            又是第 1 天
          </div>
        </div>
      </div>
      <FadeUp delay={30} style={{marginTop: 56}}>
        <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.dim}}>
          干完活 · 聊天记录一关 · 学到的东西跟着就没了
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/** 0-D：论文卡 */
const PaperCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 16}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 1120,
          padding: '64px 72px',
          borderRadius: 24,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          transform: `rotateY(${(1 - enter) * 60}deg) scale(${0.9 + enter * 0.1})`,
          boxShadow: '0 40px 120px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.exp}}>88 页综述 · 2026-06</div>
        <div
          style={{
            marginTop: 28,
            fontFamily: theme.serif,
            fontSize: 46,
            fontWeight: 700,
            color: theme.text,
            lineHeight: 1.35,
          }}
        >
          Self-Improving Agents in the Era of Experience:
          <br />
          A Survey of Self- to Meta-Evolution
        </div>
        <div style={{marginTop: 32, fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
          清华大学 × Horizon Research (Frontis.AI)
        </div>
        <div style={{marginTop: 28, display: 'flex', gap: 16}}>
          <Pill color={theme.exp}>经验如何变成实力</Pill>
          <Pill color={theme.harness}>部署之后</Pill>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 0-E：片名标题卡——三色光带 */
const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const flow = interpolate(frame, [0, 60], [0, 1], {extrapolateRight: 'clamp'});
  const bands: Array<{color: string; angle: number; delay: number}> = [
    {color: theme.exp, angle: -70, delay: 0},
    {color: theme.harness, angle: 0, delay: 6},
    {color: theme.params, angle: 70, delay: 12},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      {bands.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${50 - Math.sin((b.angle * Math.PI) / 180) * 40}%`,
            top: `${50 + Math.cos((b.angle * Math.PI) / 180) * 18}%`,
            width: 8,
            height: 420 * Math.min(1, Math.max(0, (flow - b.delay / 60) * 1.6)),
            borderRadius: 4,
            background: `linear-gradient(180deg, transparent, ${b.color})`,
            transformOrigin: 'top center',
            transform: `rotate(${180 - b.angle}deg)`,
            opacity: 0.9,
          }}
        />
      ))}
      <div
        style={{
          fontFamily: theme.sans,
          fontWeight: 900,
          fontSize: 118,
          color: theme.text,
          opacity: enter,
          transform: `scale(${0.8 + enter * 0.2})`,
          textShadow: `0 0 100px ${theme.exp}66`,
        }}
      >
        上线之后，AI 才开始上学
      </div>
      <FadeUp delay={20} style={{marginTop: 40}}>
        <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.dim}}>
          经验时代的自我进化 · 一篇 88 页综述讲明白
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

export const P0Hook: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  return (
    <AbsoluteFill>
      <Sequence {...w('p0-01', 'p0-04')} name="0-A 宣言卡">
        <Manifesto />
      </Sequence>
      <Sequence {...w('p0-05', 'p0-08')} name="0-B 入职循环">
        <DayOne />
      </Sequence>
      <Sequence {...w('p0-09', 'p0-10')} name="0-C 主线问题">
        <QuoteCard zh="上线之后，AI 能越干越熟练吗？" accent={theme.exp} />
      </Sequence>
      <Sequence {...w('p0-11', 'p0-12')} name="0-D 论文卡">
        <PaperCard />
      </Sequence>
      <Sequence {...w('p0-13')} name="0-E 标题卡">
        <TitleCard />
      </Sequence>
    </AbsoluteFill>
  );
};
