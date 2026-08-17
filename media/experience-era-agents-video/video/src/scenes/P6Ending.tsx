import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {FadeUp, QuoteCard} from '../components/cards';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';

/** 6-A：星空开放问题 */
const OpenQuestions: React.FC = () => {
  const frame = useCurrentFrame();
  const qs = [
    {q: '新本事，还是本来就有的潜能？', icon: '🌱'},
    {q: '一直吃自己产的经验，会越吃越窄吗？', icon: '🌀'},
    {q: '图片视频经验，怎么压缩归档？', icon: '🖼️'},
  ];
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        background: `radial-gradient(ellipse at 50% 30%, #131a2a 0%, ${theme.bg} 70%)`,
      }}
    >
      {/* 星星 */}
      {Array.from({length: 26}).map((_, i) => {
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(frame * 0.04 + i * 2.1));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${(i * 37 + 13) % 96}%`,
              top: `${(i * 53 + 7) % 88}%`,
              width: 3 + (i % 3),
              height: 3 + (i % 3),
              borderRadius: '50%',
              background: theme.text,
              opacity: tw * 0.7,
            }}
          />
        );
      })}
      <div style={{display: 'flex', flexDirection: 'column', gap: 40}}>
        {qs.map((q, i) => {
          const enter = spring({frame: frame - i * 14, fps: 30, config: {damping: 200}});
          return (
            <FadeUp key={q.q} delay={i * 14}>
              <div
                style={{
                  display: 'flex',
                  gap: 20,
                  alignItems: 'center',
                  padding: '22px 36px',
                  borderRadius: 16,
                  background: 'rgba(23,28,38,0.7)',
                  border: `2px solid ${theme.panelBorder}`,
                  opacity: enter,
                }}
              >
                <span style={{fontSize: 40}}>{q.icon}</span>
                <span style={{fontFamily: theme.sans, fontSize: 29, color: theme.text}}>{q.q}</span>
                <span style={{fontFamily: theme.serif, fontSize: 30, color: theme.exp, marginLeft: 8}}>?</span>
              </div>
            </FadeUp>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 6-C：三块拼图 */
const ThreePuzzles: React.FC = () => {
  const frame = useCurrentFrame();
  const pieces = [
    {zh: '可靠的反馈', icon: '📡'},
    {zh: '安全的自我修改架构', icon: '🛡️'},
    {zh: '评测 = 持续体检', icon: '🩺'},
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <FadeUp style={{marginBottom: 46}}>
        <div style={{fontFamily: theme.sans, fontSize: 34, color: theme.text, fontWeight: 700}}>
          这条路还缺的三块拼图
        </div>
      </FadeUp>
      <div style={{display: 'flex', gap: 40}}>
        {pieces.map((p, i) => {
          const drop = spring({frame: frame - i * 12, fps: 30, config: {damping: 14}});
          return (
            <div
              key={p.zh}
              style={{
                width: 340,
                height: 240,
                borderRadius: 20,
                background: theme.panel,
                border: `3px dashed ${drop > 0.95 ? theme.ok : theme.panelBorder}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 16,
                transform: `translateY(${(1 - drop) * -160}px) rotate(${(1 - drop) * 12}deg)`,
                opacity: drop,
              }}
            >
              <span style={{fontSize: 64}}>{p.icon}</span>
              <span style={{fontFamily: theme.sans, fontSize: 27, color: theme.ok, fontWeight: 700, textAlign: 'center'}}>
                {p.zh}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** 6-D：系列呼应——上一集与本集并排 */
const SeriesEcho: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const prev = spring({frame: frame - 6, fps, config: {damping: 200}});
  const curr = spring({frame: frame - 20, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{display: 'flex', gap: 60, alignItems: 'center'}}>
        <div
          style={{
            width: 480,
            padding: 40,
            borderRadius: 20,
            background: theme.panel,
            border: `3px solid #4A9EFF`,
            opacity: prev * 0.92,
            transform: `translateY(${(1 - prev) * 40}px)`,
          }}
        >
          <div style={{display: 'flex', gap: 8, marginBottom: 18}}>
            <span style={{width: 40, height: 8, borderRadius: 4, background: '#4A9EFF'}} />
            <span style={{width: 40, height: 8, borderRadius: 4, background: '#FF9F45'}} />
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>
            上期：AI 如何自己变强？
          </div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 24, color: theme.dim, lineHeight: 1.6}}>
            改大脑，还是改装备？
            <br />
            ——「改什么」
          </div>
        </div>
        <div style={{fontSize: 50, color: theme.exp, opacity: curr}}>＋</div>
        <div
          style={{
            width: 480,
            padding: 40,
            borderRadius: 20,
            background: theme.panel,
            border: `3px solid ${theme.exp}`,
            opacity: curr,
            transform: `translateY(${(1 - curr) * 40}px)`,
            boxShadow: `0 0 70px ${theme.exp}22`,
          }}
        >
          <div style={{display: 'flex', gap: 8, marginBottom: 18}}>
            <span style={{width: 40, height: 8, borderRadius: 4, background: theme.exp}} />
            <span style={{width: 40, height: 8, borderRadius: 4, background: theme.harness}} />
            <span style={{width: 40, height: 8, borderRadius: 4, background: theme.params}} />
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.text}}>
            本期：上线之后，AI 才开始上学
          </div>
          <div style={{marginTop: 12, fontFamily: theme.sans, fontSize: 24, color: theme.dim, lineHeight: 1.6}}>
            上了班之后，经验怎么攒？
            <br />
            ——「怎么攒」
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 6-E：论文引用卡（fade-out 窗口收在本 beat 末帧内，避免渐黑被 Sequence 截断硬切） */
const FinalCard: React.FC<{endFrame: number}> = ({endFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const fadeStart = Math.max(0, endFrame - 50);
  const fade = interpolate(frame, [fadeStart, endFrame], [1, 0], {extrapolateRight: 'clamp', extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: fade}}>
      <div
        style={{
          width: 1080,
          padding: '60px 72px',
          borderRadius: 24,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          opacity: enter,
          transform: `scale(${0.9 + enter * 0.1})`,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.exp}}>88 页综述 · 2026-06</div>
        <div
          style={{
            marginTop: 26,
            fontFamily: theme.serif,
            fontSize: 44,
            fontWeight: 700,
            color: theme.text,
            lineHeight: 1.4,
          }}
        >
          Self-Improving Agents in the Era of Experience:
          <br />
          A Survey of Self- to Meta-Evolution
        </div>
        <div style={{marginTop: 30, fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
          C. Jiang, J. Zhong, Y. Fu, et al. · 清华大学 × Horizon Research (Frontis.AI)
        </div>
        <div style={{marginTop: 34, fontFamily: theme.sans, fontSize: 30, color: theme.exp}}>
          📖 推荐读原文
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const P6Ending: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  /** 某句在本 Sequence 内的结束帧（局部坐标），供结尾渐黑对齐 beat 实际时长 */
  const endFrame = (id: string) => {
    const s = scene.sentences.find((x) => x.id === id);
    if (!s) {
      throw new Error(`endFrame: 未找到句 id ${id}`);
    }
    return s.from + s.durationInFrames - scene.from;
  };
  return (
    <AbsoluteFill>
      <Sequence {...w('p6-01', 'p6-04')} name="6-A 星空问题">
        <OpenQuestions />
      </Sequence>
      <Sequence {...w('p6-05', 'p6-07')} name="6-B 总金句">
        <QuoteCard
          zh="部署后变聪明 = 从流水到能力"
          en="Making agents smarter after deployment is a trace-to-capability problem."
          cite="本片综述 · Abstract"
          accent={theme.exp}
        />
      </Sequence>
      <Sequence {...w('p6-08', 'p6-10')} name="6-C 三块拼图">
        <ThreePuzzles />
      </Sequence>
      <Sequence {...w('p6-11', 'p6-13')} name="6-D 系列呼应">
        <SeriesEcho />
      </Sequence>
      <Sequence {...w('p6-14', 'p6-15')} name="6-E 原文卡">
        <FinalCard endFrame={endFrame('p6-15')} />
      </Sequence>
    </AbsoluteFill>
  );
};
