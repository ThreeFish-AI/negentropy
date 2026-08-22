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

/** 6-A 壳的四层：三张挂件卡沿径向滑入、逐一「咬合」上环（骨架 vs 挂件的物理化收束）。
 *  循环层不用卡——它就是环本身（p6-03 的口播顺序：循环→分发表→闸门→插口）。
 *  卡片恒正立（见下方 `rotate(${-a.ang})`），只有挂脚吃挂点角度。 */
const ShellLayers: React.FC<{layerAt: number[]}> = ({layerAt}) => {
  const frame = useCurrentFrame();
  const dot = useRingDot(2.8);
  const R = 210; // LoopRing 的外框半参（size = 2R + 76）
  // 环线真实半径：LoopRing 内部取 size/2 - 46，与 R 差 8px。夹爪要咬在**环线**上，
  // 所以必须由 size 反算，直接用 R 会差出 8px 的悬空。
  const RING_R = (R * 2 + 76) / 2 - 46;
  const CX = 560;
  const CY = 540;
  // 字幕安全带上沿：与 qa_frames.py 的 SUBTITLE_BAND_PX = 160 同口径（比 skills/06
  // 红线二「角标 bottom ≥ 150」再严 10px，留出体检余量）。入场轨迹必须自己让开它——
  // **落位态干净、入场越界**这一类缺陷 `--check` 每幕只抽 ~8 帧，结构性看不见。
  const SAFE_TOP_Y = 1080 - 160;
  const CARD_HALF_H = 36; // 卡片 rect 半高 34 + 描边 2.5 的一半，向上取整
  // 三张挂件卡沿环 120° 均分，且刻意避开 0/±90/180 —— LoopRing 的四个节点文案
  // （问模型/看回答/执行工具/填回结果）就画在那四个方位上，挂脚会横穿它们。
  const attach = [
    {t: '分发表', s: '给它工具', c: theme.mech, ang: -45},
    {t: '闸门', s: '守着底线', c: theme.deny, ang: 75},
    {t: '插口', s: '留给你发挥', c: theme.mech, ang: 195},
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
            // 卡片中心的落位半径：环外一圈（dist > RING_R，卡片整体在环之外——
            // 底部那句「挂件 ×3，都挂在外面」是字面意思，卡片不得压在环线上）
            const dist = R + 96;
            // 挂脚长度 = 卡心到环线的径向距离；本组已按 ang 旋转，故 -x 指向环心
            const stem = dist - RING_R;
            // 入场自环外 startPx 倍半径径向滑入。**向下**的卡（sin > 0）滑到最远处时
            // 会探进字幕安全带（1.6 倍时闸门卡下沿到 y≈1047，被字幕条切掉半张），
            // 故其起步倍率按「卡片下沿贴住 SAFE_TOP_Y」封顶；向上的两张不受此限，
            // 仍走完整行程。三张卡入场时刻错开，行程长短不同不构成可比性问题。
            const sinA = Math.sin(rad);
            const startPx = Math.min(
              1.6,
              sinA > 0 ? (SAFE_TOP_Y - CARD_HALF_H - CY) / (sinA * dist) : Infinity,
            );
            const px = startPx - (startPx - 1) * t;
            const x = Math.cos(rad) * dist * px;
            const y = Math.sin(rad) * dist * px;
            return (
              <g key={a.t} transform={`translate(${x} ${y}) rotate(${a.ang})`} opacity={t}>
                {/* 挂脚：自环线伸到卡片内缘，末端夹爪咬在环线上 */}
                <line
                  x1={-stem}
                  y1={0}
                  x2={-40}
                  y2={0}
                  stroke={a.c}
                  strokeWidth={4}
                  strokeLinecap="round"
                />
                <path d={`M${-stem} 0 l12 -9 v18 Z`} fill={a.c} />
                {/* 卡片反向抵消 ang：挂点角度不该变成文字角度（否则 75° 侧倒、
                    195° 倒置，文字直接不可读） */}
                <g transform={`rotate(${-a.ang})`}>
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
    ['官方文档', 'code.claude.com/docs · 取数 2026-08'],
    ['工程博客', 'anthropic.com/engineering'],
    ['源码分析', '第三方逆向分析 · 片中逐处标注'],
    ['仓库钉版', 'main @ f9e8b28（2026-08-18）'],
    ['数字口径', '画面行数均为固定提交实测'],
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
            {'画面中的行数均为本片在固定提交上的实测（非空非注释口径）'}
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
            {'执行层：一个循环，就是全部'}
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
