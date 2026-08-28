/** P6 落点与信源（分镜 6-A…6-B）
 *  6-A 一句话合同金句卡（serif keep 描边）→ 两行回收（体面地忘 / 固执地记）；
 *  6-B 信源卡（官方文档/工程博客/第三方源码分析/实测口径）→ 身份卡 → 渐黑。
 *  ★ 渐黑窗口从**末 beat 总时长**（beatDurationInFrames）推导，不是末句时长
 *    —— 第三集上线教训（skills/06 渲染红线四）。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel, SceneHeader} from '../components/motifs';

/** 6-A 一句话合同：keep 描边金句卡 + 两行对仗回收 */
const OneLineContract: React.FC<{recycleAt: number}> = ({recycleAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 4, fps, config: {damping: 200}});
  const recycle = interpolate(frame - recycleAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{textAlign: 'center', opacity: enter, transform: `translateY(${(1 - enter) * 24}px)`}}>
        {/* 合同卡：serif + keep 描边 */}
        <div
          style={{
            display: 'inline-block',
            padding: '40px 72px',
            borderRadius: 20,
            border: `4px solid ${theme.keep}`,
            background: 'rgba(169,196,108,0.05)',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginBottom: 20}}>
            {'一句话合同'}
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 62, fontWeight: 700, color: theme.text, lineHeight: 1.4}}>
            {'会丢的放桌面，'}
          </div>
          <div style={{fontFamily: theme.serif, fontSize: 62, fontWeight: 700, color: theme.keep, lineHeight: 1.4}}>
            {'不许丢的放本子'}
          </div>
        </div>
        {/* 两行回收：对仗浮现（contract 收缩让位） */}
        <div
          style={{
            marginTop: 44,
            opacity: recycle,
            transform: `translateY(${(1 - recycle) * 16}px)`,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, lineHeight: 1.8}}>
            {'一套负责体面地忘：分级收拾、先存再丢、压完往回捞'}
          </div>
          <div style={{fontFamily: theme.sans, fontSize: 30, color: theme.dim, lineHeight: 1.8}}>
            {'一套负责固执地记：一事一文件、索引常驻、先抢救再碎纸'}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * 6-B 信源卡 + 身份卡 + 渐黑。
 * `beatDurationInFrames` 是**本 beat 的总时长**，渐黑窗口据此反推（末 1.2s）。
 */
const SourceAndFade: React.FC<{beatDurationInFrames: number; idAt: number}> = ({
  beatDurationInFrames,
  idAt,
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
  const idT = interpolate(frame - idAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // 渐黑：末 1.2 秒线性压暗到全黑，窗口从 beat 总时长反推（红线四）
  const fadeFrames = Math.round(1.2 * fps);
  const fadeStart = beatDurationInFrames - fadeFrames;
  const dark = interpolate(frame, [fadeStart, beatDurationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: enter * (1 - idT * 0.9), transform: `translateY(${(1 - enter) * 20}px)`}}>
        <Panel style={{padding: '30px 40px', width: 960}}>
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
              <div style={{width: 150, fontFamily: theme.sans, fontSize: 23, color: theme.dim, flexShrink: 0}}>
                {k}
              </div>
              <div style={{fontFamily: theme.mono, fontSize: 23, color: theme.text}}>{v}</div>
            </div>
          ))}
          {/* 诚实行：涉内部分均为源码分析，片中逐处标注（三级证据的公开落点） */}
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
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
      {/* 身份卡（系列卡：口播不念，仅视觉层） */}
      {idT > 0 ? (
        <div
          style={{
            position: 'absolute',
            textAlign: 'center',
            opacity: idT,
            transform: `translateY(${(1 - idT) * 18}px)`,
          }}
        >
          <div style={{fontFamily: theme.serif, fontSize: 32, color: theme.dim, letterSpacing: 3}}>
            {'Claude Code Harness Engineering'}
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
            {'记忆层：会丢的和不能丢的'}
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
              {'下期 · 时机层'}
            </div>
            <div style={{fontFamily: theme.serif, fontSize: 31, color: theme.text, marginTop: 5}}>
              {'谁来按下开始'}
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
  const bA = w('p6-01', 'p6-06');
  const relA = (id: string) => at(id) - bA.from;
  const bB = w('p6-07', 'p6-10');
  const relB = (id: string) => at(id) - bB.from;
  return (
    <AbsoluteFill>
      <SceneHeader index="P6" title="落点与信源" meta="memory is context, not a gate" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="6-A 一句话合同金句卡">
        <OneLineContract recycleAt={relA('p6-03')} />
      </Sequence>
      <Sequence {...bB} name="6-B 信源卡与渐黑">
        {/* 渐黑窗口从**本 beat 总时长**推导，不是末句时长（红线四） */}
        <SourceAndFade beatDurationInFrames={bB.durationInFrames} idAt={relB('p6-10')} />
      </Sequence>
    </AbsoluteFill>
  );
};
