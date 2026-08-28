/** P6 落点与信源（分镜 6-A…6-C，2026-08-28 改序：免责前置）
 *  6-A 信源前置（p6-07..08）→ 6-B 一句话合同金句 + 人味延伸 + 赌注到期（p6-01..06）
 *  → 6-C 五格层进度条 + 0-C 标尺缩略 + 下期文案 + 渐黑（p6-09）。
 *  ★ 渐黑窗口从**末 beat 总时长**推导（beatDurationInFrames），不是末句时长
 *    —— 第三集上线教训：末句短于 beat 时渐黑提前收尾，导致收尾长黑屏
 *    （skills/06 渲染红线四）。 */
import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Panel, SceneHeader} from '../components/motifs';

/** 6-A 信源前置：信源卡两行压屏（官方文档+取数日期 / 第三方源码分析已逐处标注）。
 *  前置到幕首——免责只走画面，不占情绪高点（storyboard 改序说明）。 */
const SourcesFirst: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 4, fps, config: {damping: 200}});
  const rows = [
    ['官方文档', 'code.claude.com/docs · 取数2026年8月 · 以官方最新表述为准'],
    ['源码分析', '第三方逆向分析 · 片中逐处标注'],
  ];
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: enter, transform: `translateY(${(1 - enter) * 20}px)`}}>
        <Panel style={{padding: '26px 38px', width: 1000}}>
          <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.view, marginBottom: 16}}>
            {'信源'}
          </div>
          {rows.map(([k, v], i) => (
            <div
              key={k}
              style={{
                display: 'flex',
                marginBottom: 10,
                opacity: interpolate(frame - 10 - i * 6, [0, 12], [0, 1], {
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
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

/** 6-B 一句话合同金句卡（serif，view 描边）→ 三行人味延伸小字 → 赌注到期 + 自省句 +「循环没停过」收进底部。 */
const ContractCard: React.FC<{humanAt: number; betAt: number; loopAt: number}> = ({
  humanAt,
  betAt,
  loopAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 4, fps, config: {damping: 200}});
  const human = interpolate(frame - humanAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bet = interpolate(frame - betAt, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const loop = interpolate(frame - loopAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: enter, transform: `translateY(${(1 - enter) * 24}px)`, textAlign: 'center'}}>
        <Panel accent={theme.view} style={{padding: '38px 60px', background: `${theme.panel}e6`}}>
          <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.dim, marginBottom: 18}}>
            {'一句话合同'}
          </div>
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 58,
              fontWeight: 700,
              color: theme.text,
              lineHeight: 1.55,
            }}
          >
            {'视野是安排出来的。'}
            <br />
            {'安排它的，不是模型自己。'}
          </div>
          {/* p6-02/03 人味延伸两行 */}
          <div style={{marginTop: 26, opacity: human}}>
            <div style={{fontFamily: theme.sans, fontSize: 25, color: theme.dim, lineHeight: 1.7}}>
              {'你的注意力在哪，多半也不是你自己定的——'}
              <br />
              {'是你桌上摆了什么、谁在什么时候塞了张纸给你。'}
            </div>
          </div>
          {/* p6-04/05 赌注到期 + 官方自省句短卡 */}
          <div
            style={{
              marginTop: 22,
              display: 'flex',
              justifyContent: 'center',
              gap: 18,
              opacity: bet,
              transform: `translateY(${(1 - bet) * 12}px)`,
            }}
          >
            <div style={{border: `2px solid ${theme.deny}`, borderRadius: 10, padding: '10px 18px', fontFamily: theme.sans, fontSize: 22, color: theme.deny, background: `${theme.deny}10`}}>
              {'清单退位'}
            </div>
            <div style={{border: `2px solid ${theme.panelBorder}`, borderRadius: 10, padding: '10px 18px', fontFamily: theme.sans, fontSize: 22, color: theme.dim}}>
              {'官方自省：常问自己，可以停掉哪一件'}
            </div>
          </div>
          {/* p6-06「循环没停过」一行收进金句卡底部 */}
          <div
            style={{
              marginTop: 22,
              paddingTop: 14,
              borderTop: `1px solid ${theme.panelBorder}`,
              fontFamily: theme.serif,
              fontSize: 27,
              color: theme.view,
              opacity: loop,
            }}
          >
            {'桌子会换，零件会瘦，那个循环一直没停过。'}
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

/** 五格层进度条（执行/规划/记忆/时机/协作）：反枚举——不用五色；
 *  已播层 dim 常亮、当前层（本集=规划）core 高亮描边 + 底部指示条、未播层 panel 底 + 编号。
 *  6-C 上方压 0-C 四件套标尺定格缩略（「上下文管理」格保持半亮）。 */
const LayerProgress: React.FC<{slideInAt: number}> = ({slideInAt}) => {
  const frame = useCurrentFrame();
  const slide = interpolate(frame - slideInAt, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const LAYERS = ['执行', '规划', '记忆', '时机', '协作'] as const;
  const CURRENT = 1; // 本集=规划层
  const FOUR_PIECES = ['循环', '工具', '上下文管理', '护栏'] as const;
  return (
    <div style={{opacity: slide, transform: `translateX(${(1 - slide) * -40}px)`}}>
      {/* 0-C 四件套标尺定格缩略：「上下文管理」格保持半亮（一帧完成「轮内四件套 / 轮外五层」映射） */}
      <div style={{display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 26, opacity: 0.85}}>
        {FOUR_PIECES.map((p) => {
          const hot = p === '上下文管理';
          return (
            <div
              key={p}
              style={{
                width: 128,
                padding: '6px 0',
                textAlign: 'center',
                fontFamily: theme.sans,
                fontSize: 17,
                color: hot ? theme.view : theme.dim,
                border: `2px ${hot ? 'solid' : 'dashed'} ${hot ? theme.view : theme.panelBorder}`,
                borderRadius: 7,
                background: hot ? theme.viewDeep : 'transparent',
                opacity: hot ? 0.9 : 1,
              }}
            >
              {p}
            </div>
          );
        })}
      </div>
      {/* 五格层进度条 */}
      <div style={{display: 'flex', gap: 16}}>
        {LAYERS.map((l, i) => {
          const played = i < CURRENT;
          const cur = i === CURRENT;
          return (
            <div key={l} style={{position: 'relative', width: 150, textAlign: 'center'}}>
              <div
                style={{
                  padding: '14px 0',
                  borderRadius: 10,
                  fontFamily: theme.sans,
                  fontSize: 24,
                  color: cur ? theme.core : played ? theme.dim : theme.dim,
                  border: `2.5px solid ${cur ? theme.core : theme.panelBorder}`,
                  background: !played && !cur ? theme.panel : played ? `${theme.panel}` : `${theme.core}14`,
                  opacity: played ? 0.75 : 1,
                }}
              >
                <span style={{fontFamily: theme.mono, fontSize: 18, marginRight: 8, opacity: 0.8}}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {l}
              </div>
              {/* 当前层底部指示条 */}
              {cur ? (
                <div
                  style={{
                    marginTop: 8,
                    height: 5,
                    borderRadius: 3,
                    background: theme.core,
                    opacity: interpolate(frame - slideInAt - 12, [0, 10], [0, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    }),
                  }}
                />
              ) : (
                <div style={{marginTop: 8, height: 5}} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 6-C 收束：五格层进度条 + 标尺缩略 + 身份卡 + 下期文案 + 渐黑。
 * `beatDurationInFrames` 是**本 beat 的总时长**，渐黑窗口据此反推（红线四）。
 */
const FinalProgressAndFade: React.FC<{beatDurationInFrames: number}> = ({beatDurationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: frame - 4, fps, config: {damping: 200}});
  // 下期文案：打字机两拍。标题只在画面（反串线纪律），为 series.json 派生数据的
  // 硬编码镜像（下期=记忆层：会丢的和不能丢的）；口播 p6-09 为话题描述不重复标题。
  const NEXT_LINE = '下期 · 记忆层：会丢的和不能丢的';
  const typed = Math.min(NEXT_LINE.length, Math.floor(frame / 3));
  // 渐黑：末 1.2 秒线性压暗到全黑，窗口从 beat 总时长反推
  const fadeFrames = Math.round(1.2 * fps);
  const fadeStart = beatDurationInFrames - fadeFrames;
  const dark = interpolate(frame, [fadeStart, beatDurationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{opacity: enter, transform: `translateY(${(1 - enter) * 22}px)`, textAlign: 'center'}}>
        {/* 身份卡 */}
        <div style={{marginBottom: 40}}>
          <div style={{fontFamily: theme.serif, fontSize: 30, color: theme.dim, letterSpacing: 3}}>
            {'Claude Code Harness Engineering'}
          </div>
          <div
            style={{
              fontFamily: theme.serif,
              fontSize: 56,
              fontWeight: 700,
              color: theme.core,
              marginTop: 14,
            }}
          >
            {'规划层：模型的视野是安排出来的'}
          </div>
        </div>
        {/* 五格层进度条（当前层=规划） + 0-C 标尺缩略 */}
        <LayerProgress slideInAt={24} />
        {/* 下期文案：打字机两拍（反串线纪律：标题只进画面不进口播） */}
        <div style={{marginTop: 34, fontFamily: theme.mono, fontSize: 24, color: theme.dim, minHeight: 34}}>
          {NEXT_LINE.slice(0, typed)}
          {typed < NEXT_LINE.length ? <span style={{color: theme.view}}>{'▌'}</span> : null}
        </div>
      </div>
      {/* 渐黑遮罩 */}
      <AbsoluteFill style={{background: '#000', opacity: dark, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

export const P6Ending: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const rel = (b: {from: number}, id: string) => at(id) - b.from;
  const bA = w('p6-07', 'p6-08');
  const bB = w('p6-01', 'p6-06');
  const bC = w('p6-09', 'p6-09');
  return (
    <AbsoluteFill>
      <SceneHeader index="P6" title="落点与信源" meta="Claude Code Harness Engineering" durationInFrames={scene.durationInFrames} />
      <Sequence {...bA} name="6-A 信源前置">
        {/* p6-07/p6-08 免责两句前置：信源卡逐行浮现（不占情绪高点） */}
        <SourcesFirst />
      </Sequence>
      <Sequence {...bB} name="6-B 一句话合同">
        {/* p6-02/03 人味延伸；p6-04/05 赌注到期+自省句；p6-06「循环没停过」收进底部 */}
        <ContractCard
          humanAt={rel(bB, 'p6-02')}
          betAt={rel(bB, 'p6-04')}
          loopAt={rel(bB, 'p6-06')}
        />
      </Sequence>
      <Sequence {...bC} name="6-C 层进度条与渐黑">
        {/* 渐黑窗口从**本 beat 总时长**推导，不是末句时长（红线四） */}
        <FinalProgressAndFade beatDurationInFrames={bC.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
