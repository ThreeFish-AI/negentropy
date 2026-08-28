/** P6 落点与信源（分镜 6-A…6-B）
 *  ★ 渐黑窗口从**末 beat 总时长**推导（beatDurationInFrames），不是末句时长
 *    —— 第三集上线教训：末句短于 beat 时渐黑提前收尾，导致收尾长黑屏
 *    （skills/06 渲染红线四）。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel, SceneHeader} from '../components/motifs';

/** 6-A 一句话合同金句卡（serif，view 描边）→ p6-04「同一门手艺」次行浮现。 */
const ContractCard: React.FC<{nextAt: number}> = ({nextAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 4, fps, config: {damping: 200}});
  const next = interpolate(frame - nextAt, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: enter, transform: `translateY(${(1 - enter) * 24}px)`, textAlign: 'center'}}>
        <Panel accent={theme.view} style={{padding: '44px 64px', background: `${theme.panel}e6`}}>
          <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim, marginBottom: 20}}>
            {'一句话合同'}
          </div>
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 62,
              fontWeight: 700,
              color: theme.text,
              lineHeight: 1.55,
            }}
          >
            {'视野是安排出来的。'}
            <br />
            {'安排它的，不是模型自己。'}
          </div>
        </Panel>
        {/* 三行人味延伸小字 + 「同一门手艺」次行 */}
        <div style={{marginTop: 30, opacity: next}}>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, lineHeight: 1.7}}>
            {'你的注意力在哪，多半也不是你自己定的——'}
            <br />
            {'是你桌上摆了什么、谁在什么时候塞了张纸给你。'}
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 34, color: theme.view, marginTop: 18}}>
            {'管好自己的桌子和管好它的，是同一门手艺。'}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * 6-B 信源卡（官方文档 + 取数日期 / 第三方源码分析 / 实测口径；
 * 「产品内部均为第三方的源码分析」诚实行）→ 系列身份卡 → 渐黑。
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
    ['官方文档', 'code.claude.com/docs · 取数2026年8月'],
    ['工程博客', 'anthropic.com/engineering'],
    ['源码分析', '第三方逆向分析 · 片中逐处标注'],
    ['数字口径', '开源仓库钉版 67a9126c 实测 · 字节归档'],
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
        <Panel style={{padding: '28px 38px', width: 980}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.view, marginBottom: 16}}>
            {'信源'}
          </div>
          {rows.map(([k, v], i) => (
            <div
              key={k}
              style={{
                display: 'flex',
                marginBottom: 9,
                opacity: interpolate(frame - 8 - i * 4, [0, 10], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              <div style={{width: 130, fontFamily: theme.sans, fontSize: 21, color: theme.dim, flexShrink: 0}}>
                {k}
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.text}}>{v}</div>
            </div>
          ))}
          {/* 诚实行：产品内部断言均为第三方的源码分析 */}
          <div
            style={{
              marginTop: 12,
              paddingTop: 11,
              borderTop: `1px solid ${theme.panelBorder}`,
              fontFamily: theme.sans,
              fontSize: 20,
              color: theme.dim,
              opacity: interpolate(frame - 8 - rows.length * 4, [0, 10], [0, 0.9], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {'涉及产品内部的部分，均为第三方的源码分析，片中已逐处标注'}
          </div>
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
          <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.dim, letterSpacing: 3}}>
            {'Claude Code Harness Engineering'}
          </div>
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 58,
              fontWeight: 700,
              color: theme.core,
              marginTop: 16,
            }}
          >
            {'规划层：模型的视野是安排出来的'}
          </div>
          {/* 下期预告卡：标题只在画面（反串线纪律） */}
          <div
            style={{
              marginTop: 26,
              padding: '13px 28px',
              border: `1.5px solid ${theme.panelBorder}`,
              borderRadius: 12,
              background: theme.panel,
            }}
          >
            <div style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim, letterSpacing: 2}}>
              {'下期 · 记忆层'}
            </div>
            <div style={{fontFamily: theme.serif, fontSize: 31, color: theme.text, marginTop: 5}}>
              {'会丢的和不能丢的'}
            </div>
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
  const at = (id: string) => w(id).from;
  const rel = (b: {from: number}, id: string) => at(id) - b.from;
  const bA = w('p6-01', 'p6-04');
  const bB = w('p6-05', 'p6-09');
  return (
    <AbsoluteFill>
      <SceneHeader index="P6" title="落点与信源" meta="Claude Code Harness Engineering" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="6-A 一句话合同">
        {/* p6-04「同一门手艺」次行浮现 */}
        <ContractCard nextAt={rel(bA, 'p6-04')} />
      </Sequence>
      <Sequence {...bB} name="6-B 信源卡与渐黑">
        {/* 渐黑窗口从**本 beat 总时长**推导，不是末句时长（红线四）；
            身份卡在末句 p6-09（下期见）浮现 */}
        <SourceAndFade beatDurationInFrames={bB.durationInFrames} seriesAt={rel(bB, 'p6-09')} />
      </Sequence>
    </AbsoluteFill>
  );
};
