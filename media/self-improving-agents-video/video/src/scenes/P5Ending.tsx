import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {FadeUp, Pill} from '../components/cards';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';

/* ================= P5 收尾（storyboard.md 镜 5-A..5-F）=================
 * 主调：蓝橙两路汇合，收束回衬线金句；验证语义统一用绿。
 * 画布 1920x1080，底部 160px(≥y920) 为字幕区，关键内容全部收在 y<920。
 */

/** 双端 clamp 的 0→1 进度 */
const ci = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

/** 确定性伪随机（sin 哈希：散布均匀且渲染可复现；取模线性法会使坐标周期性重叠） */
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* ------------------------------ 5-A 回望 ------------------------------
 * p5-01..03：回到 P1 分叉地图——两条路均已点亮，流向地平线；
 * p5-02 "最初的几公里已跑通" → 路上 ✓ 里程桩；p5-03 "离科幻还很远" → 地平线外的科幻标记。
 */
const LookBack: React.FC<{farAt: number}> = ({farAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const zoom = interpolate(frame, [0, 80], [1.16, 0.95], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const drawL = ci(frame, 2, 30);
  const drawR = ci(frame, 6, 34);
  const flow = -frame * 0.008;
  const farIn = ci(frame, farAt, farAt + 18);

  const leftD = 'M 960 830 C 830 720 720 500 645 255';
  const rightD = 'M 960 830 C 1090 720 1200 500 1275 255';
  const checkpoints: Array<[number, number]> = [
    [848, 703],
    [736, 500],
    [1072, 703],
    [1184, 500],
  ];

  return (
    <AbsoluteFill
      style={{transform: `scale(${zoom})`, transformOrigin: '960px 540px', opacity: enter}}
    >
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        {/* 地平线 */}
        <line x1={320} y1={212} x2={1600} y2={212} stroke={theme.panelBorder} strokeWidth={2} opacity={0.3 * ci(frame, 6, 20)} />
        {/* 两条路的辉光 + 主体 + 流动虚线 */}
        {[leftD, rightD].map((d, i) => {
          const color = i === 0 ? theme.brain : theme.gear;
          const draw = i === 0 ? drawL : drawR;
          return (
            <g key={d}>
              <path d={d} fill="none" stroke={color} strokeWidth={22} opacity={0.14 * draw} strokeLinecap="round" />
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={9}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - draw}
                strokeLinecap="round"
              />
              <path
                d={d}
                fill="none"
                stroke={theme.text}
                strokeWidth={5}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="0.015 0.06"
                strokeDashoffset={flow}
                opacity={0.45 * ci(frame, 24, 42)}
              />
            </g>
          );
        })}
        {/* 已跑通里程桩 */}
        {checkpoints.map(([cx, cy], i) => (
          <g key={i} transform={`translate(${cx} ${cy})`} opacity={ci(frame, 22 + i * 8, 34 + i * 8)}>
            <circle r={15} fill={theme.bg} stroke={theme.ok} strokeWidth={3} />
            <polyline points="-6,0 -1,6 8,-6" fill="none" stroke={theme.ok} strokeWidth={3.5} strokeLinecap="round" />
          </g>
        ))}
        {/* 通向"科幻"的虚线（离得很远） */}
        <path
          d={`M 645 255 L 920 178`}
          fill="none"
          stroke={theme.dim}
          strokeWidth={2.5}
          strokeDasharray="7 11"
          opacity={0.32 * farIn}
        />
        <path
          d={`M 1275 255 L 1000 178`}
          fill="none"
          stroke={theme.dim}
          strokeWidth={2.5}
          strokeDasharray="7 11"
          opacity={0.32 * farIn}
        />
      </svg>

      {/* 起点：回到开头的问题 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 830,
          transform: 'translate(-50%,-50%)',
          padding: 2.5,
          borderRadius: 999,
          background: `linear-gradient(90deg, ${theme.brain}, ${theme.gear})`,
          opacity: enter,
        }}
      >
        <div
          style={{
            padding: '12px 36px',
            borderRadius: 999,
            background: '#10141C',
            fontFamily: theme.sans,
            fontSize: 34,
            fontWeight: 700,
            color: theme.text,
          }}
        >
          AI 能自己变强吗？
        </div>
      </div>

      {/* 左右路标 */}
      <FadeUp delay={14} style={{position: 'absolute', left: 600, top: 400, transform: 'translate(-50%,-50%)', textAlign: 'center'}}>
        <div style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 800, color: theme.brain}}>🧠 改大脑</div>
        <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginTop: 6}}>θ · 第 5 章</div>
      </FadeUp>
      <FadeUp delay={18} style={{position: 'absolute', left: 1320, top: 400, transform: 'translate(-50%,-50%)', textAlign: 'center'}}>
        <div style={{fontFamily: theme.sans, fontSize: 34, fontWeight: 800, color: theme.gear}}>🧰 改装备</div>
        <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.dim, marginTop: 6}}>Σ · 第 6 章</div>
      </FadeUp>

      {/* 最初的几公里已跑通 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 892,
          transform: 'translate(-50%,-50%)',
          fontFamily: theme.sans,
          fontSize: 24,
          color: theme.ok,
          letterSpacing: 2,
          opacity: ci(frame, 34, 48),
        }}
      >
        两条路最初的几公里 · 已跑通 ✓
      </div>

      {/* 远处的科幻 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 148,
          transform: 'translate(-50%,-50%)',
          fontFamily: theme.sans,
          fontSize: 28,
          color: theme.dim,
          letterSpacing: 3,
          opacity: farIn,
        }}
      >
        ✨ 科幻 · 还很远
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 5-B 哥德尔机 ------------------------------
 * p5-04 钩子闪回（1980s 小字卡）→ p5-05..06 星空中的 Gödel Machine 发光线框 + 理论天花板
 * → p5-07..08 下方现实层："有边界、可验证的循环"围栏点亮，三条现实约束逐条落下。
 */
const StarField: React.FC<{from: number}> = ({from}) => {
  const frame = useCurrentFrame();
  const on = ci(frame, from, from + 25);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: 46}, (_, i) => {
        const x = rnd(i, 1) * 1840 + 40;
        const y = rnd(i, 2) * 1000 + 40;
        const s = 2 + rnd(i, 3) * 2.5;
        const tw = 0.35 + 0.35 * Math.sin(frame * 0.03 + i * 1.7);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: s,
              height: s,
              borderRadius: '50%',
              background: theme.text,
              opacity: on * tw,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** CSS 3D 线框立方体（外蓝内橙：机器里套着改写自己的机器） */
const WireCube: React.FC<{t: number; size: number; color: string; glow: string; spin: number}> = ({
  t,
  size,
  color,
  glow,
  spin,
}) => {
  const h = size / 2;
  const faces = [
    `rotateY(0deg) translateZ(${h}px)`,
    `rotateY(90deg) translateZ(${h}px)`,
    `rotateY(180deg) translateZ(${h}px)`,
    `rotateY(270deg) translateZ(${h}px)`,
    `rotateX(90deg) translateZ(${h}px)`,
    `rotateX(-90deg) translateZ(${h}px)`,
  ];
  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        transformStyle: 'preserve-3d',
        transform: `rotateX(-18deg) rotateY(${t * spin}deg)`,
      }}
    >
      {faces.map((tr) => (
        <div
          key={tr}
          style={{
            position: 'absolute',
            inset: 0,
            border: `2px solid ${color}`,
            background: 'rgba(74,158,255,0.04)',
            boxShadow: `inset 0 0 34px ${glow}`,
            transform: tr,
          }}
        />
      ))}
    </div>
  );
};

const GoedelBeat: React.FC<{
  flashDur: number;
  machineAt: number;
  ceilingAt: number;
  realityAt: number;
  dutiesAt: number;
}> = ({flashDur, machineAt, ceilingAt, realityAt, dutiesAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  /* 钩子闪回卡 */
  const flashOp = Math.min(ci(frame, 0, 6), 1 - ci(frame, flashDur - 9, flashDur - 1));

  /* 线框机 */
  const mEnter = spring({frame: frame - machineAt, fps, config: {damping: 16}});
  const mDim = interpolate(frame, [realityAt, realityAt + 20], [1, 0.7], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ceilingIn = ci(frame, ceilingAt, ceilingAt + 22);
  const penIn = ci(frame, realityAt, realityAt + 18);
  const capOut = 1 - ci(frame, realityAt, realityAt + 8);

  const posts = [90, 210, 330, 450, 550, 670, 790, 910];

  return (
    <AbsoluteFill>
      <StarField from={machineAt} />

      {/* —— 阶段一：1980s 闪回 —— */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 470,
          transform: `translate(-50%,-50%) scale(${1.05 - 0.05 * ci(frame, 0, 10)})`,
          width: 780,
          padding: '44px 56px',
          borderRadius: 18,
          background: theme.panel,
          border: '2px solid rgba(206,174,96,0.35)',
          opacity: flashOp,
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 7px)',
          }}
        />
        <div style={{fontFamily: theme.mono, fontSize: 22, color: '#C9A65A', letterSpacing: 6}}>闪回 · 1980s</div>
        <div style={{marginTop: 22, fontFamily: theme.sans, fontSize: 38, fontWeight: 700, color: theme.text}}>
          Schmidhuber：让程序自己改自己
        </div>
        <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>开头埋的钩子 · 现在兑现</div>
      </div>

      {/* —— 理论天花板 —— */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 104,
          transform: 'translateX(-50%)',
          fontFamily: theme.mono,
          fontSize: 24,
          color: theme.dim,
          letterSpacing: 4,
          opacity: ceilingIn,
        }}
      >
        理论天花板 · 至今仍未触及
      </div>
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 150,
          transform: 'translateX(-50%)',
          height: 0,
          borderTop: `2px dashed rgba(74,158,255,0.55)`,
          width: `${ceilingIn * 920}px`,
        }}
      />

      {/* —— 发光线框：Gödel Machine —— */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 350,
          transform: `translate(-50%,-50%) scale(${0.55 + 0.45 * mEnter}) translateY(${interpolate(frame, [realityAt, realityAt + 20], [0, -36], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}px)`,
          perspective: '900px',
          opacity: mEnter * mDim,
        }}
      >
        <WireCube t={Math.max(0, frame - machineAt)} size={240} color={theme.brain} glow="rgba(74,158,255,0.28)" spin={0.55} />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%,-50%)`,
            transformStyle: 'preserve-3d',
          }}
        >
          <WireCube t={Math.max(0, frame - machineAt)} size={110} color={theme.gear} glow="rgba(255,159,69,0.3)" spin={-0.85} />
        </div>
      </div>
      <FadeUp delay={machineAt + 10} style={{position: 'absolute', left: 960, top: 512, transform: 'translateX(-50%)', opacity: mDim}}>
        <Pill color={theme.brain}>Gödel Machine · 哥德尔机</Pill>
      </FadeUp>
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 566,
          transform: 'translateX(-50%)',
          maxWidth: 900,
          textAlign: 'center',
          fontFamily: theme.sans,
          fontSize: 30,
          color: theme.text,
          opacity: ci(frame, machineAt + 18, machineAt + 34) * capOut * mDim,
        }}
      >
        只要能从数学上证明改动有益，就重写自己的代码
      </div>

      {/* —— 现实层：有边界、可验证的循环（围栏） —— */}
      <svg
        width={1000}
        height={290}
        viewBox="0 0 1000 290"
        style={{position: 'absolute', left: 460, top: 598, opacity: penIn}}
      >
        <rect x={8} y={8} width={984} height={274} rx={34} fill="rgba(126,211,33,0.03)" stroke={theme.ok} strokeWidth={2.5} opacity={0.55} />
        {posts.map((x, i) => (
          <line
            key={x}
            x1={x}
            y1={2}
            x2={x}
            y2={20}
            stroke={theme.ok}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={ci(frame, realityAt + 4 + i * 2, realityAt + 10 + i * 2) * 0.9}
          />
        ))}
        {/* 双色循环 */}
        <g transform="translate(500 168)">
          <path d="M -56 0 A 56 56 0 0 1 56 0" fill="none" stroke={theme.brain} strokeWidth={6} strokeLinecap="round" opacity={penIn} />
          <path d="M 56 0 A 56 56 0 0 1 -56 0" fill="none" stroke={theme.gear} strokeWidth={6} strokeLinecap="round" opacity={penIn} />
          <path d="M -56 0 A 56 56 0 0 1 56 0" fill="none" stroke={theme.text} strokeWidth={3} strokeLinecap="round" pathLength={1} strokeDasharray="0.06 0.1" strokeDashoffset={-frame * 0.012} opacity={0.35 * penIn} />
          <path d="M 56 0 A 56 56 0 0 1 -56 0" fill="none" stroke={theme.text} strokeWidth={3} strokeLinecap="round" pathLength={1} strokeDasharray="0.06 0.1" strokeDashoffset={-frame * 0.012} opacity={0.35 * penIn} />
          <polygon points="56,15 45,-2 67,-2" fill={theme.brain} opacity={penIn} />
          <polygon points="-56,-15 -45,2 -67,2" fill={theme.gear} opacity={penIn} />
        </g>
      </svg>
      <FadeUp delay={realityAt + 6} style={{position: 'absolute', left: 960, top: 660, transform: 'translateX(-50%)'}}>
        <div style={{fontFamily: theme.sans, fontSize: 32, fontWeight: 800, color: theme.text, textAlign: 'center'}}>
          现实：有边界、可验证的循环
        </div>
      </FadeUp>
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 818,
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 26,
        }}
      >
        {[
          {icon: '🎯', text: '人类划定目标', color: theme.brain},
          {icon: '✅', text: '验证器把守大门', color: theme.ok},
          {icon: '↩️', text: '每一步可撤回', color: theme.gear},
        ].map((d, i) => {
          const o = ci(frame, dutiesAt + i * 14, dutiesAt + i * 14 + 12);
          return (
            <div key={d.text} style={{opacity: o, transform: `translateY(${(1 - o) * 16}px)`}}>
              <Pill color={d.color} style={{fontSize: 26, padding: '6px 18px'}}>
                {d.icon} {d.text}
              </Pill>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 5-C 三缺口 ------------------------------
 * p5-09 展望引入 → p5-10..11 "一次性工具 → 越用越强的系统" 转变
 * → p5-12..14 三个拼图槽依次落位：可靠反馈(蓝)/安全自改架构(橙)/评估=持续体检(绿)。
 */
const PuzzleSlot: React.FC<{
  x: number;
  icon: string;
  label: string;
  sub?: string;
  color: string;
  deep: string;
  dropAt: number;
}> = ({x, icon, label, sub, color, deep, dropAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dropped = frame >= dropAt;
  const e = spring({frame: frame - dropAt, fps, config: {damping: 12}});
  const badge = spring({frame: frame - dropAt - 14, fps, config: {damping: 14}});
  return (
    <div style={{position: 'absolute', left: x, top: 462, width: 400, height: 288}}>
      {/* 空槽 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 18,
          border: `3px dashed ${theme.panelBorder}`,
          background: 'rgba(23,28,38,0.35)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: dropped ? 0.22 : 0.85,
        }}
      >
        <div style={{fontSize: 60, opacity: 0.4}}>{icon}</div>
        <div style={{fontFamily: theme.serif, fontSize: 64, color: theme.dim, opacity: 0.35}}>{'?'}</div>
      </div>
      {/* 拼图块 */}
      {dropped ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 18,
            background: deep,
            border: `3px solid ${color}`,
            opacity: e,
            transform: `translateY(${(1 - e) * -300}px) scale(${0.92 + 0.08 * e})`,
            boxShadow: `0 24px 70px rgba(0,0,0,0.45), 0 0 44px ${color}33`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -20,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: deep,
              border: `3px solid ${color}`,
            }}
          />
          <div style={{fontSize: 54}}>{icon}</div>
          <div style={{fontFamily: theme.sans, fontSize: 36, fontWeight: 800, color}}>{label}</div>
          {sub ? <div style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{sub}</div> : null}
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: theme.ok,
              color: '#0E1116',
              fontFamily: theme.sans,
              fontWeight: 900,
              fontSize: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${badge})`,
            }}
          >
            ✓
          </div>
        </div>
      ) : null}
    </div>
  );
};

const GapsBeat: React.FC<{
  fromAt: number;
  toAt: number;
  modelAt: number;
  fbAt: number;
  evalAt: number;
}> = ({fromAt, toAt, modelAt, fbAt, evalAt}) => {
  const frame = useCurrentFrame();
  const bIn = ci(frame, toAt, toAt + 14);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 104,
          transform: 'translateX(-50%)',
          fontFamily: theme.sans,
          fontSize: 30,
          color: theme.dim,
          letterSpacing: 4,
          opacity: ci(frame, 2, 16),
        }}
      >
        论文结尾的展望 · 反而比科幻更有意思
      </div>

      {/* 一次性工具 → 越用越强的系统 */}
      <div
        style={{
          position: 'absolute',
          left: 300,
          top: 200,
          width: 560,
          height: 160,
          borderRadius: 18,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: ci(frame, fromAt, fromAt + 12),
        }}
      >
        <div style={{fontFamily: theme.sans, fontSize: 38, fontWeight: 700, color: theme.dim}}>💬 一次性工具</div>
        <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>每次对话归零</div>
      </div>

      <svg width={180} height={60} viewBox="0 0 180 60" style={{position: 'absolute', left: 872, top: 250, opacity: ci(frame, fromAt + 16, fromAt + 30)}}>
        <defs>
          <linearGradient id="p5cArrow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={theme.brain} />
            <stop offset="1" stopColor={theme.gear} />
          </linearGradient>
        </defs>
        <path
          d="M 8 30 L 150 30"
          stroke="url(#p5cArrow)"
          strokeWidth={8}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - ci(frame, fromAt + 18, fromAt + 34)}
        />
        <polygon points="146,12 178,30 146,48" fill={theme.gear} />
      </svg>

      <div
        style={{
          position: 'absolute',
          left: 1060,
          top: 200,
          width: 560,
          height: 160,
          padding: 2.5,
          borderRadius: 20,
          background: `linear-gradient(120deg, ${theme.brain}, ${theme.gear})`,
          opacity: bIn,
          transform: `translateY(${(1 - bIn) * -16}px) scale(${0.96 + 0.04 * bIn})`,
          boxShadow: '0 0 60px rgba(255,159,69,0.18)',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 18,
            background: theme.panel,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <div style={{fontFamily: theme.sans, fontSize: 40, fontWeight: 800, color: theme.text}}>📈 越用越强的系统</div>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>经验沉淀 · 今天变强明天还在</div>
        </div>
      </div>

      {/* 缺口板 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 418,
          transform: 'translateX(-50%)',
          fontFamily: theme.sans,
          fontSize: 36,
          color: theme.dim,
          opacity: ci(frame, modelAt, modelAt + 14),
        }}
      >
        缺的不只是更大的模型 ——
      </div>
      <PuzzleSlot x={300} icon="🔁" label="可靠的反馈" color={theme.brain} deep={theme.brainDeep} dropAt={fbAt + 8} />
      <PuzzleSlot x={760} icon="🛡️" label="安全的自我修改架构" color={theme.gear} deep={theme.gearDeep} dropAt={fbAt + 55} />
      <PuzzleSlot x={1220} icon="🩺" label="评估 = 持续体检" sub="不再是一次性考试" color={theme.ok} deep="#1E3213" dropAt={evalAt + 8} />
    </AbsoluteFill>
  );
};

/* ------------------------------ 5-D 首尾呼应 ------------------------------
 * Good 金句卡泛黄重现（p5-15），蓝橙汇合分隔线之下打字打出新行（p5-16..17），
 * p5-18 "死死握住验证之门" → 绿色验证之门 Pill + 蓝橙渐变下划线扫过。
 */
const GoodEcho: React.FC<{typeAt: number; doorAt: number}> = ({typeAt, doorAt}) => {
  const frame = useCurrentFrame();
  const zh = '六十年后，人类装上第一节可自我升级的零件——并握住验证之门。';
  const shown = Math.min(zh.length, Math.max(0, Math.floor((frame - typeAt) / 2.3)));
  const cardIn = ci(frame, 2, 18);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 1240,
          padding: '52px 64px',
          borderRadius: 22,
          textAlign: 'center',
          background: 'linear-gradient(165deg, rgba(206,174,96,0.10), rgba(206,174,96,0.02) 55%, rgba(23,28,38,0))',
          border: '2px solid rgba(206,174,96,0.28)',
          boxShadow: 'inset 0 0 90px rgba(140,105,40,0.14), 0 30px 90px rgba(0,0,0,0.45)',
          opacity: cardIn,
          transform: `translateY(${(1 - cardIn) * 24}px)`,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 26, color: '#C9A65A', letterSpacing: 6, opacity: ci(frame, 4, 16)}}>
          1966 · I. J. GOOD
        </div>
        <div
          style={{
            marginTop: 26,
            fontFamily: theme.serif,
            fontSize: 48,
            fontWeight: 700,
            color: theme.text,
            lineHeight: 1.55,
            filter: 'sepia(0.18)',
            opacity: ci(frame, 8, 24),
          }}
        >
          「第一台超智能机器，将是人类需要做出的最后一项发明。」
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: theme.serif,
            fontStyle: 'italic',
            fontSize: 25,
            color: theme.dim,
            opacity: ci(frame, 26, 46) * 0.9,
          }}
        >
          "The first ultraintelligent machine is the last invention that man need ever make."
        </div>

        {/* 蓝橙汇合分隔线 */}
        <div
          style={{
            margin: '30px auto 22px',
            height: 2,
            borderRadius: 1,
            background: `linear-gradient(90deg, ${theme.brain}, ${theme.gear})`,
            width: `${ci(frame, typeAt - 14, typeAt - 2) * 560}px`,
          }}
        />
        {/* 蓝橙双章印记 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 18,
            opacity: ci(frame, typeAt - 10, typeAt),
          }}
        >
          <div style={{width: 14, height: 14, borderRadius: 4, background: theme.brain}} />
          <div style={{width: 14, height: 14, borderRadius: 4, background: theme.gear}} />
        </div>

        {/* 新行打字 */}
        <div style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.text, lineHeight: 1.5, minHeight: 132}}>
          {zh.slice(0, shown)}
          <span style={{opacity: frame % 20 < 10 ? 1 : 0, color: theme.brain, fontWeight: 400}}>▎</span>
        </div>
        <div
          style={{
            margin: '16px auto 0',
            height: 3,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${theme.brain}, ${theme.gear}, ${theme.ok})`,
            width: `${ci(frame, doorAt, doorAt + 16) * 70}%`,
          }}
        />
        <FadeUp delay={doorAt + 8} style={{marginTop: 26, opacity: shown >= zh.length ? 1 : 0.25}}>
          <Pill color={theme.ok}>🚪 死死握住验证之门</Pill>
        </FadeUp>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 5-E 开放问题 ------------------------------
 * p5-19 旧问句（灰暗）→ p5-20 大字问句 + 由验证闸门图标汇聚而成的门（拱线描绘 + 闸门飞入）
 * → p5-21 门内机器人被绿光罩住："在门里面，安全地进化"。
 */
const SmartDoor: React.FC<{askAt: number; safeAt: number}> = ({askAt, safeAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ask = spring({frame: frame - askAt, fps, config: {damping: 15}});
  const robot = spring({frame: frame - safeAt, fps, config: {damping: 13}});
  const archDraw = ci(frame, askAt + 4, askAt + 34);
  const barsDraw = ci(frame, safeAt + 6, safeAt + 26);
  const gates: Array<{left: number; top: number; dx: number; dy: number}> = [
    {left: 754, top: 512, dx: -420, dy: -140},
    {left: 754, top: 652, dx: -480, dy: 90},
    {left: 1134, top: 512, dx: 420, dy: -180},
    {left: 1134, top: 652, dx: 480, dy: 120},
  ];
  return (
    <AbsoluteFill>
      {/* 旧问题（被让位） */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 150,
          transform: 'translateX(-50%)',
          fontFamily: theme.sans,
          fontSize: 32,
          color: theme.dim,
          opacity: ci(frame, 2, 14) * 0.9,
        }}
      >
        真正的问题，也许不是——
      </div>
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 212,
          transform: 'translateX(-50%)',
          padding: '8px 26px',
          borderRadius: 999,
          border: `2px solid ${theme.panelBorder}`,
          fontFamily: theme.sans,
          fontSize: 28,
          color: theme.dim,
          opacity: ci(frame, 10, 24) * 0.7,
        }}
      >
        AI 会不会自我进化
      </div>

      {/* 大字问句 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 316,
          transform: `translate(-50%,-50%) scale(${0.88 + 0.12 * ask})`,
          opacity: ask,
          fontFamily: theme.serif,
          fontSize: 74,
          fontWeight: 900,
          color: theme.text,
          textShadow: '0 0 70px rgba(126,211,33,0.22)',
          whiteSpace: 'nowrap',
        }}
      >
        我们能不能造出一道足够聪明的门？
      </div>

      {/* 门：拱线 + 验证闸门 */}
      <svg
        width={480}
        height={460}
        viewBox="0 0 480 460"
        style={{position: 'absolute', left: 720, top: 392, filter: 'drop-shadow(0 0 14px rgba(126,211,33,0.4))'}}
      >
        <path
          d="M 60 440 L 60 200 A 180 180 0 0 1 420 200 L 420 440"
          fill="none"
          stroke={theme.ok}
          strokeWidth={9}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - archDraw}
          opacity={0.85}
        />
        <line
          x1={30}
          y1={440}
          x2={450}
          y2={440}
          stroke={theme.ok}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.5 * ci(frame, askAt + 28, askAt + 42)}
        />
        {[160, 320].map((x) => (
          <line
            key={x}
            x1={x}
            y1={x === 160 ? 40 : 40}
            x2={x}
            y2={436}
            stroke={theme.ok}
            strokeWidth={3}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - barsDraw}
            opacity={0.32}
          />
        ))}
      </svg>

      {/* 验证闸门图标飞入汇聚 */}
      {gates.map((g, i) => {
        const e = spring({frame: frame - (askAt + 12 + i * 6), fps, config: {damping: 13}});
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: g.left,
              top: g.top,
              width: 52,
              height: 40,
              borderRadius: 8,
              border: `3px solid ${theme.ok}`,
              background: theme.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 24,
              fontWeight: 800,
              color: theme.ok,
              opacity: e,
              transform: `translate(${g.dx * (1 - e)}px, ${g.dy * (1 - e)}px)`,
              boxShadow: `0 0 22px rgba(126,211,33,0.35)`,
            }}
          >
            ✓
          </div>
        );
      })}

      {/* 门内：安全进化 */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 640,
          transform: 'translate(-50%,-50%)',
          width: 260,
          height: 260,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(126,211,33,0.28), transparent 70%)',
          filter: 'blur(6px)',
          opacity: robot,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 634,
          transform: `translate(-50%,-50%) scale(${0.5 + 0.5 * robot})`,
          opacity: robot,
          fontSize: 92,
        }}
      >
        🤖
      </div>
      <FadeUp delay={safeAt + 8} style={{position: 'absolute', left: 960, top: 722, transform: 'translateX(-50%)'}}>
        <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.ok, whiteSpace: 'nowrap'}}>
          在门里面，安全地进化
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/* ------------------------------ 5-F 活地图（v3 新增） ------------------------------
 * p5-22a..22d：官方工程站点的收录统计——三色计数条并行生长（蓝 77 / 橙 176 / 灰 59），
 * 数字 counter 滚动，随后合拢成环形统计图；橙段最长 = 「装备最火」的定量印证。
 * 角标注明信源等级（官方工程站点统计，非论文正文数字）。
 */
const LivingMap: React.FC<{countAt: number; ringAt: number; insightAt: number}> = ({countAt, ringAt, insightAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const bars = [
    {label: '改大脑 θ', en: 'FM improvement', n: 77, color: theme.brain, deep: theme.brainDeep},
    {label: '改装备 Σ', en: 'Scaffolding improvement', n: 176, color: theme.gear, deep: theme.gearDeep},
    {label: '评测', en: 'Evaluation & Benchmarking', n: 59, color: theme.dim, deep: '#2A2F3A'},
  ];
  const total = 312;
  const grow = ci(frame, countAt, countAt + 42);
  const ring = ci(frame, ringAt, ringAt + 36);
  const insight = ci(frame, insightAt, insightAt + 16);
  const orangePulse = insight > 0 ? 0.85 + 0.15 * Math.sin(frame * 0.1) : 1;
  // 环形图几何（viewBox 360x360，中心 180,180，半径 110；蓝从顶部顺时针、橙紧随、灰收尾）
  const R = 110;
  const C = 2 * Math.PI * R;
  const segs = [77 / total, 176 / total, 59 / total];
  const offsets = [0, segs[0], segs[0] + segs[1]];
  const enters = spring({frame, fps, config: {damping: 200}});
  return (
    <AbsoluteFill style={{opacity: enters}}>
      {/* 左：三色计数条 */}
      <div style={{position: 'absolute', left: 210, top: 250, width: 640, display: 'flex', flexDirection: 'column', gap: 44}}>
        {bars.map((b, i) => {
          const v = Math.round(b.n * ci(frame, countAt + i * 10, countAt + i * 10 + 36));
          return (
            <div key={b.label}>
              <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10}}>
                <div style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 800, color: b.color}}>
                  {b.label} <span style={{fontSize: 20, color: theme.dim, fontWeight: 400, fontFamily: theme.mono}}>{b.en}</span>
                </div>
                <div style={{fontFamily: theme.mono, fontSize: 44, fontWeight: 700, color: b.color}}>{v}</div>
              </div>
              <div style={{height: 26, borderRadius: 13, background: theme.panel, border: `2px solid ${theme.panelBorder}`, overflow: 'hidden'}}>
                <div
                  style={{
                    height: '100%',
                    width: `${(b.n / 176) * 100 * grow}%`,
                    borderRadius: 11,
                    background: b.color,
                    boxShadow: i === 1 && insight > 0 ? `0 0 18px ${b.color}` : 'none',
                    opacity: i === 1 ? orangePulse : 1,
                  }}
                />
              </div>
            </div>
          );
        })}
        <FadeUp delay={countAt + 30}>
          <div style={{fontFamily: theme.sans, fontSize: 26, color: theme.dim, marginTop: 4}}>
            合计 <span style={{fontFamily: theme.mono, fontSize: 34, fontWeight: 700, color: theme.text}}>{Math.round(total * grow)}</span> 项收录
          </div>
        </FadeUp>
      </div>

      {/* 右：环形统计图合拢 */}
      <svg width={360} height={360} viewBox="0 0 360 360" style={{position: 'absolute', left: 1020, top: 210, opacity: ring}}>
        <circle cx={180} cy={180} r={R} fill="none" stroke={theme.panel} strokeWidth={40} opacity={0.5} />
        {bars.map((b, i) => (
          <circle
            key={b.label}
            cx={180}
            cy={180}
            r={R}
            fill="none"
            stroke={b.color}
            strokeWidth={i === 1 && insight > 0 ? 46 : 40}
            strokeLinecap="butt"
            pathLength={1}
            strokeDasharray={`${segs[i] * ring} ${1 - segs[i] * ring}`}
            strokeDashoffset={-offsets[i]}
            transform="rotate(-90 180 180)"
            opacity={i === 1 ? orangePulse : 1}
            style={i === 1 && insight > 0 ? {filter: `drop-shadow(0 0 10px ${b.color})`} : undefined}
          />
        ))}
        <text x={180} y={172} textAnchor="middle" fill={theme.text} style={{fontFamily: theme.mono, fontSize: 56, fontWeight: 700}}>
          {Math.round(total * Math.max(grow, ring))}
        </text>
        <text x={180} y={212} textAnchor="middle" fill={theme.dim} style={{fontFamily: theme.sans, fontSize: 22}}>
          curated entries
        </text>
      </svg>

      {/* p5-22d 洞察行：橙条两倍多 */}
      <FadeUp delay={insightAt}>
        <div
          style={{
            position: 'absolute',
            left: 960,
            top: 640,
            transform: 'translateX(-50%)',
            fontFamily: theme.sans,
            fontSize: 30,
            fontWeight: 700,
            color: theme.text,
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          装备条目数 ≈ 大脑的 <span style={{color: theme.gear}}>2.3 倍</span> —— 「最火的方向」就在这组数字里
        </div>
      </FadeUp>

      {/* 信源等级角标（bottom≥150 避字幕条） */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 880,
          transform: 'translateX(-50%)',
          fontFamily: theme.mono,
          fontSize: 21,
          color: theme.dim,
          opacity: ci(frame, 8, 22),
        }}
      >
        living research map · 官方工程站点统计（2026-08）
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ 5-G 敲门砖墙（v3 新增） ------------------------------
 * p5-22e/f：站点 Quick-start 九篇论文卡片墙——3×3 交错飞入后按蓝/橙双色分拣重排（呼应 P1 分叉）。
 */
const QuickStartWall: React.FC<{sortAt: number}> = ({sortAt}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cards = [
    {t: 'Self-Instruct', side: 0},
    {t: 'Constitutional AI', side: 0},
    {t: 'WebRL', side: 0},
    {t: 'Web Agents with\nWorld Models', side: 0},
    {t: 'Self-Refine', side: 1},
    {t: 'TextGrad', side: 1},
    {t: 'MemoryBank', side: 1},
    {t: 'Voyager', side: 1},
    {t: 'Darwin Gödel\nMachine', side: 1},
  ];
  const sorted = ci(frame, sortAt, sortAt + 30);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 130,
          transform: 'translateX(-50%)',
          fontFamily: theme.sans,
          fontSize: 32,
          fontWeight: 800,
          color: theme.text,
          opacity: ci(frame, 2, 16),
        }}
      >
        站点敲门砖 · 九篇上手清单
      </div>

      {cards.map((c, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        // 网格位置（未分拣）
        const gx = 960 + (col - 1) * 400;
        const gy = 420 + row * 180;
        // 分拣目标位置（蓝左列 / 橙右列，竖排 5+4）
        const blueIdx = cards.slice(0, i).filter((x) => x.side === 0).length;
        const blueRow = c.side === 0 ? blueIdx : 0;
        const orangeIdx = cards.slice(0, i).filter((x) => x.side === 1).length;
        const orangeRow = c.side === 1 ? orangeIdx : 0;
        const sx = c.side === 0 ? 620 : 1300;
        const sy = 250 + (c.side === 0 ? blueRow : orangeRow) * 132;
        const x = gx + (sx - gx) * sorted;
        const y = gy + (sy - gy) * sorted;
        const e = spring({frame: frame - 4 - i * 5, fps, config: {damping: 13}});
        const color = c.side === 0 ? theme.brain : theme.gear;
        const deep = c.side === 0 ? theme.brainDeep : theme.gearDeep;
        return (
          <div
            key={c.t}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              transform: `translate(-50%,-50%) scale(${0.86 + 0.14 * e})`,
              width: 340,
              padding: '16px 20px',
              borderRadius: 14,
              background: deep,
              border: `2.5px solid ${color}`,
              fontFamily: theme.mono,
              fontSize: 25,
              fontWeight: 700,
              color,
              textAlign: 'center',
              lineHeight: 1.3,
              whiteSpace: 'pre-line',
              opacity: e,
              boxShadow: `0 12px 36px rgba(0,0,0,0.4)`,
            }}
          >
            {c.t}
          </div>
        );
      })}

      {/* 分拣后出现两路标签 */}
      <FadeUp delay={sortAt + 10}>
        <div
          style={{
            position: 'absolute',
            left: 620,
            top: 130,
            transform: 'translateX(-50%)',
            fontFamily: theme.sans,
            fontSize: 28,
            fontWeight: 800,
            color: theme.brain,
            opacity: sorted,
          }}
        >
          🧠 改大脑
        </div>
        <div
          style={{
            position: 'absolute',
            left: 1300,
            top: 130,
            transform: 'translateX(-50%)',
            fontFamily: theme.sans,
            fontSize: 28,
            fontWeight: 800,
            color: theme.gear,
            opacity: sorted,
          }}
        >
          🧰 改装备
        </div>
      </FadeUp>

      <FadeUp delay={sortAt + 24}>
        <div
          style={{
            position: 'absolute',
            left: 960,
            top: 900,
            transform: 'translateX(-50%)',
            fontFamily: theme.sans,
            fontSize: 28,
            color: theme.dim,
            opacity: sorted,
          }}
        >
          这期讲过的名字 · 都在上面
        </div>
      </FadeUp>
    </AbsoluteFill>
  );
};

/* ------------------------------ 5-H 原文卡 ------------------------------
 * p5-23 论文引用卡 → p5-24 下期再见 + 渐黑收尾（时长从末 beat 实时推导）。
 */
const CitationBeat: React.FC<{recAt: number; byeAt: number; dur: number}> = ({recAt, byeAt, dur}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 16}});
  const blackout = ci(frame, dur - 45, dur - 8);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: 460,
          transform: `translate(-50%,-50%) rotateY(${(1 - enter) * 55}deg) scale(${0.92 + 0.08 * enter})`,
          width: 1120,
          padding: '52px 64px',
          borderRadius: 24,
          background: theme.panel,
          border: `2px solid ${theme.panelBorder}`,
          boxShadow: '0 40px 120px rgba(0,0,0,0.5)',
          textAlign: 'center',
          opacity: enter,
        }}
      >
        <div style={{fontFamily: theme.mono, fontSize: 26, color: theme.gear}}>arXiv:2607.13104 · 2026-07 · Survey</div>
        <div
          style={{
            marginTop: 24,
            fontFamily: theme.serif,
            fontSize: 50,
            fontWeight: 700,
            color: theme.text,
            lineHeight: 1.32,
          }}
        >
          Self-Improvements in Modern Agentic Systems: A Survey
        </div>
        <div style={{marginTop: 24, fontFamily: theme.sans, fontSize: 28, color: theme.dim}}>
          Jürgen Schmidhuber 团队 · KAUST / 吉林大学 / IDSIA
        </div>
        <div style={{marginTop: 26, display: 'flex', justifyContent: 'center', gap: 16}}>
          <Pill color={theme.brain}>第 5 章 · 改大脑</Pill>
          <Pill color={theme.gear}>第 6 章 · 改装备</Pill>
        </div>
        <FadeUp delay={recAt} style={{marginTop: 32}}>
          <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18}}>
            <div
              style={{
                padding: '10px 22px',
                borderRadius: 12,
                border: `2px solid ${theme.panelBorder}`,
                fontFamily: theme.mono,
                fontSize: 26,
                color: theme.text,
              }}
            >
              arxiv.org/abs/2607.13104
            </div>
            <Pill color={theme.ok}>📖 强烈推荐去读原文</Pill>
          </div>
        </FadeUp>
        <FadeUp delay={byeAt} style={{marginTop: 30}}>
          <div style={{fontFamily: theme.sans, fontSize: 32, color: theme.dim}}>我们下期再见 👋</div>
        </FadeUp>
      </div>

      {/* 渐黑收尾 */}
      <AbsoluteFill style={{background: '#000', opacity: blackout, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

/* ------------------------------ 场景组装 ------------------------------ */
export const P5Ending: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => {
    const s = scene.sentences.find((x) => x.id === id);
    if (!s) {
      throw new Error(`P5Ending: 未找到句 id ${id}`);
    }
    return s.from - scene.from;
  };

  const winA = w('p5-01', 'p5-03');
  const winB = w('p5-04', 'p5-08');
  const winC = w('p5-09', 'p5-14');
  const winD = w('p5-15', 'p5-18');
  const winE = w('p5-19', 'p5-21');
  const winF = w('p5-22', 'p5-22d');
  const winG = w('p5-22e', 'p5-22f');
  const winH = w('p5-23', 'p5-24');

  return (
    <AbsoluteFill>
      <Sequence {...winA} name="5-A 回望">
        <LookBack farAt={at('p5-03') - winA.from} />
      </Sequence>
      <Sequence {...winB} name="5-B 哥德尔机">
        <GoedelBeat
          flashDur={w('p5-04', 'p5-04a').durationInFrames}
          machineAt={at('p5-05') - winB.from}
          ceilingAt={at('p5-06') - winB.from}
          realityAt={at('p5-07') - winB.from}
          dutiesAt={at('p5-08') - winB.from}
        />
      </Sequence>
      <Sequence {...winC} name="5-C 三缺口">
        <GapsBeat
          fromAt={at('p5-10') - winC.from}
          toAt={at('p5-11') - winC.from}
          modelAt={at('p5-12') - winC.from}
          fbAt={at('p5-13') - winC.from}
          evalAt={at('p5-14') - winC.from}
        />
      </Sequence>
      <Sequence {...winD} name="5-D 首尾呼应">
        <GoodEcho typeAt={at('p5-16') - winD.from} doorAt={at('p5-18') - winD.from} />
      </Sequence>
      <Sequence {...winE} name="5-E 开放问题">
        <SmartDoor askAt={at('p5-20') - winE.from} safeAt={at('p5-21') - winE.from} />
      </Sequence>
      <Sequence {...winF} name="5-F 活地图">
        <LivingMap countAt={at('p5-22b') - winF.from} ringAt={at('p5-22c') - winF.from} insightAt={at('p5-22d') - winF.from} />
      </Sequence>
      <Sequence {...winG} name="5-G 敲门砖墙">
        <QuickStartWall sortAt={at('p5-22f') - winG.from - 10} />
      </Sequence>
      <Sequence {...winH} name="5-H 原文卡">
        <CitationBeat recAt={at('p5-23') - winH.from} byeAt={at('p5-24') - winH.from} dur={winH.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
