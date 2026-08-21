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

/** 6-A 壳的四层：三张挂件卡从右侧滑入、逐一「咬合」上环（骨架 vs 挂件的物理化收束）。
 *  循环层不用卡——它就是环本身（p6-03 的口播顺序：循环→分发表→闸门→插口）。 */
const ShellLayers: React.FC<{layerAt: number[]}> = ({layerAt}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.8);
  const R = 210; // 环半径
  const CX = 560;
  const CY = 540;
  // 三张挂件卡挂在环的三个方位（与 P2/P3/P4 的挂靠语言一致）；入射角决定卡片转角
  const attach = [
    {t: '分发表', s: '给它工具', c: theme.mech, ang: -30},
    {t: '闸门', s: '守着底线', c: theme.deny, ang: 90},
    {t: '插口', s: '留给你发挥', c: theme.mech, ang: 210},
  ];
  const allOn = frame >= layerAt[3];
  const breathe = allOn ? 1 - 0.02 * Math.max(0, Math.sin((frame - layerAt[3]) / 9)) : 1;
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <g transform={`translate(${CX} ${CY}) scale(${breathe})`}>
          <g transform={`translate(${-R - 38} ${-R - 38})`}>
            <LoopRing size={R * 2 + 76} draw={1} dotProgress={dot} showExit={false} />
          </g>
          {attach.map((a, i) => {
            const on = frame >= layerAt[i + 1];
            const t = interpolate(frame - layerAt[i + 1], [0, 16], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            if (!on) return null;
            const rad = (a.ang * Math.PI) / 180;
            // 卡片从远处（1.6×）滑到挂点，最后一程 spring 过冲轻微「咬合」
            const dist = R + 96;
            const px = 1.6 - 0.6 * t;
            const x = Math.cos(rad) * dist * px;
            const y = Math.sin(rad) * dist * px;
            return (
              <g key={a.t} transform={`translate(${x} ${y}) rotate(${a.ang})`} opacity={t}>
                {/* 挂脚：卡片与环之间的短连线，末端一个小夹爪 */}
                <line
                  x1={-Math.cos(0) * 0}
                  y1={0}
                  x2={-72}
                  y2={0}
                  stroke={a.c}
                  strokeWidth={4}
                  strokeLinecap="round"
                />
                <path d="M-72 0 l-12 -9 v18 Z" fill={a.c} />
                <g transform="translate(-104 0)">
                  <rect
                    x={-84}
                    y={-34}
                    width={168}
                    height={68}
                    rx={10}
                    fill={theme.panel}
                    stroke={a.c}
                    strokeWidth={2.5}
                  />
                  <text
                    x={0}
                    y={-6}
                    textAnchor="middle"
                    fontFamily={theme.serif}
                    fontSize={30}
                    fontWeight={700}
                    fill={a.c}
                  >
                    {a.t}
                  </text>
                  <text
                    x={0}
                    y={22}
                    textAnchor="middle"
                    fontFamily={theme.sans}
                    fontSize={19}
                    fill={theme.dim}
                  >
                    {a.s}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>
      {/* 循环层 = 环本体：p6-01 点亮时环描线一次 + 左侧短标签（不用卡片，强调「骨架不是挂件」） */}
      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 220,
          opacity: interpolate(frame - layerAt[0], [0, 12], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.core}}>
          {'循环'}
        </div>
        <div style={{fontFamily: theme.sans, fontSize: 28, color: theme.dim, marginTop: 6}}>
          {'给它手脚 —— 骨架'}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 120,
          bottom: 220,
          fontFamily: theme.sans,
          fontSize: 26,
          color: theme.mech,
          opacity: interpolate(frame - layerAt[3], [0, 14], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        {'挂件 ×3，都挂在外面'}
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
    ['站点', 'learn.shareai.run/zh/s01..s04'],
    ['仓库', 'github.com/shareAI-lab/learn-claude-code'],
    ['仓库钉版', 'main @ f9e8b28（2026-08-18）'],
    ['站点同源修订', '67a9126c（2026-07-28，20 章版）'],
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
          {/* 诚实行：画面数字均为实测口径（ISSUE-165 的公开落点） */}
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
            {'画面中的行数均为本片在钉定提交上的实测（非空非注释口径），非课程标注'}
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
