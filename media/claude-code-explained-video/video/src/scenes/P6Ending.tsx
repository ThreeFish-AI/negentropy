/** P6 收尾（分镜 6-A…6-B）
 *  ★ 渐黑窗口从**末 beat 总时长**推导（beatDurationInFrames），不是末句时长
 *    —— 第三集上线教训：末句短于 beat 时渐黑提前收尾，导致收尾长黑屏
 *    （skills/06 渲染红线四）。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {LoopRing, Panel, useRingDot} from '../components/motifs';

/** 6-A 壳的四层逐层点亮 */
const ShellLayers: React.FC<{layerAt: number[]}> = ({layerAt}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.8);
  const layers = [
    {t: '循环', s: '给它手脚', c: theme.core},
    {t: '分发表', s: '给它工具', c: theme.mech},
    {t: '闸门', s: '守着底线', c: theme.deny},
    {t: '插口', s: '留给你发挥', c: theme.mech},
  ];
  const allOn = frame >= layerAt[3];
  const breathe = allOn ? 1 - 0.02 * Math.max(0, Math.sin((frame - layerAt[3]) / 9)) : 1;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{transform: `scale(${breathe})`, display: 'flex', alignItems: 'center', gap: 70}}>
        <LoopRing size={300} draw={1} dotProgress={dot} showExit={false} />
        <div>
          {layers.map((l, i) => {
            const on = frame >= layerAt[i];
            const t = interpolate(frame - layerAt[i], [0, 14], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div
                key={l.t}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 20,
                  marginBottom: 20,
                  opacity: on ? t : 0.2,
                  transform: `translateX(${(1 - t) * 24}px)`,
                }}
              >
                <div
                  style={{
                    fontFamily: theme.serif,
                    fontSize: 44,
                    fontWeight: 700,
                    color: on ? l.c : theme.dim,
                    width: 170,
                  }}
                >
                  {l.t}
                </div>
                <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>{l.s}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * 6-B 信源卡 + 系列身份卡 + 渐黑。
 * `beatDurationInFrames` 是**本 beat 的总时长**，渐黑窗口据此反推。
 */
const SourceAndFade: React.FC<{beatDurationInFrames: number; seriesAt: number}> = ({
  beatDurationInFrames,
  seriesAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 4, fps, config: {damping: 200}});
  const rows = [
    ['课程', 'Learn Claude Code · 工具与执行四章'],
    ['仓库', 'github.com/shareAI-lab/learn-claude-code'],
    ['固定提交', 'f9e8b28'],
    ['访问日期', '2026-08-21'],
    ['许可', 'MIT'],
  ];
  const seriesT = interpolate(frame - seriesAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 渐黑：末 1.2 秒线性压暗到全黑，窗口从 beat 总时长反推
  const fadeFrames = Math.round(1.2 * fps);
  const fadeStart = beatDurationInFrames - fadeFrames;
  const dark = interpolate(frame, [fadeStart, beatDurationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: enter * (1 - seriesT * 0.85), transform: `translateY(${(1 - enter) * 20}px)`}}>
        <Panel style={{padding: '30px 40px', width: 900}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.core, marginBottom: 18}}>
            {'信源'}
          </div>
          {rows.map(([k, v], i) => (
            <div
              key={k}
              style={{
                display: 'flex',
                marginBottom: 10,
                opacity: interpolate(frame - 8 - i * 4, [0, 10], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              <div style={{width: 150, fontFamily: theme.sans, fontSize: 23, color: theme.dim}}>
                {k}
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 23, color: theme.text}}>{v}</div>
            </div>
          ))}
        </Panel>
      </div>
      {seriesT > 0 ? (
        <div
          style={{
            position: 'absolute',
            textAlign: 'center',
            opacity: seriesT,
            transform: `translateY(${(1 - seriesT) * 18}px)`,
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.dim, letterSpacing: 3}}>
            {'Claude Code 通俗全解'}
          </div>
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 62,
              fontWeight: 700,
              color: theme.core,
              marginTop: 18,
            }}
          >
            {'拆开 Claude Code'}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.text, marginTop: 14}}>
            {'让 AI 动手的四层机制'}
          </div>
        </div>
      ) : null}
      {/* 渐黑遮罩 */}
      <AbsoluteFill style={{background: '#000', opacity: dark, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

export const P6Ending: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const rel = (b: {from: number}, id: string) => w(id).from - b.from;
  const bA = w('p6-01', 'p6-04');
  const bB = w('p6-05', 'p6-08');
  return (
    <AbsoluteFill>
      <Sequence {...bA} name="6-A 壳的四层">
        <ShellLayers
          layerAt={[rel(bA, 'p6-01'), rel(bA, 'p6-02'), rel(bA, 'p6-03'), rel(bA, 'p6-04')]}
        />
      </Sequence>
      <Sequence {...bB} name="6-B 信源卡与渐黑">
        {/* 渐黑窗口从**本 beat 总时长**推导，不是末句时长（红线四） */}
        <SourceAndFade
          beatDurationInFrames={bB.durationInFrames}
          seriesAt={rel(bB, 'p6-08')}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
