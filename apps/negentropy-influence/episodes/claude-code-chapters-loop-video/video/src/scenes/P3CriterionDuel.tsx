/** P3 判据之争（p3-01..p3-14，5 镜）——分镜 3-A…3-E（全片张力峰值）。
 *
 *  叙事链：两版判据卡对举（左「查收尾字段」末尾徽章+开关 / 右「翻内容」放大镜+
 *  调用块，中置「？」；演示次序严格=口播次序 p3-03→p3-04）→ 流式显形（字符流
 *  逐字到达，字段徽章慢半拍仍灰，p3-06「流式」角标贴上）→ 时间轴错位双指针
 *  （内容指针到点绿 / 字段指针滞后一档灰；p3-08「迟到的信号」锁链只自字段指针
 *  垂下——错绑因果是红线）→ 火警调度台插曲 ≤2s（两词到位即派车、不等收尾；
 *  p3-10 边界标记「补派 ✓ / 第二回 ✗」划掉收束）→ 消融对比裁决幕（左红右绿
 *  恒定：左轨丢两枚调用块〔坠落淡出轨迹可见=静默丢弃〕十格亮八格七件掉五件、
 *  右轨十格全亮七件全落地；双计数条 10→8 / 7→5 基线锚定；p3-14 教训金句短卡
 *  「字段晚到＝丢调用」闪现定格）。
 *  色彩纪律：左红=warn（反例/退化）/ 右绿=ok（机制在位）全幕恒定不互换（X-001）；
 *  调用块恒 tool 青（P1 建锚语义）；循环继续恒 core。动画时点全部自句边界推导。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../design/theme';
import {FPS, beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {Pill} from '../components/cards';
import {
  DUR,
  clamp01,
  revealCharCount,
  useCount,
  useDim,
  useDraw,
  useEnter,
  useImpulse,
  useProgress,
  useSpring,
} from '../motion';

// ── 3-A 判据卡对举 ───────────────────────────────────────────────────────

/** 「停 ⇄ 转」拨动开关：滑块位移走弹簧（空间），轨道/滑块显色走缓动（effects） */
const ToggleSwitch: React.FC<{at: number}> = ({at}) => {
  const knob = useSpring('settle', {at, dur: DUR.f4});
  const on = useProgress(at, DUR.f4);
  const TRACK_W = 150;
  const KNOB = 40;
  const PAD = 7;
  return (
    <div
      style={{
        position: 'relative',
        width: TRACK_W,
        height: 54,
        borderRadius: 27,
        border: `2px solid ${theme.panelBorder}`,
        background: theme.bg,
      }}
    >
      <div
        style={{position: 'absolute', inset: -2, borderRadius: 27, border: `2px solid ${theme.core}`, opacity: on}}
      />
      <div
        style={{
          position: 'absolute',
          left: PAD + knob * (TRACK_W - KNOB - 2 * PAD),
          top: PAD,
          width: KNOB,
          height: KNOB,
        }}
      >
        <div style={{position: 'absolute', inset: 0, borderRadius: 999, background: theme.dim}} />
        <div style={{position: 'absolute', inset: 0, borderRadius: 999, background: theme.core, opacity: on}} />
      </div>
    </div>
  );
};

/** 循环继续箭头（core）：一次性脉冲强调，终态停驻 */
const LoopArrow: React.FC<{p: number; pulse: number}> = ({p, pulse}) => (
  <svg
    width={44}
    height={44}
    viewBox="0 0 44 44"
    style={{opacity: p, transform: `scale(${1 + pulse})`, display: 'block'}}
  >
    <path d="M35 22 A 13 13 0 1 1 22 9" fill="none" stroke={theme.core} strokeWidth={4} strokeLinecap="round" />
    <path d="M14 3 L30 9 L14 15 Z" fill={theme.core} />
  </svg>
);

/** 两版判据卡（同构等大 660×400）：field=p3-03 演示、content=p3-04 演示（次序=口播） */
const CriterionCard: React.FC<{variant: 'field' | 'content'; atDemo: number}> = ({variant, atDemo}) => {
  const isField = variant === 'field';
  const accent = isField ? theme.warn : theme.ok;
  // 演示链（Visual Lock：任一卡不得先动——atDemo 分别锚 p3-03 / p3-04）：
  // field：徽章翻色 → 拨开关；content：放大镜滑行 → 调用块点亮 → 拨开关
  const litAt = atDemo + (isField ? 0 : DUR.f5);
  const lit = useProgress(litAt, DUR.f4);
  const flip = useImpulse({at: litAt, dur: DUR.f5, peak: 0.45});
  const scan = useSpring('settle', {at: atDemo, dur: DUR.f5});
  const toggleAt = litAt + (isField ? DUR.f4 : DUR.f3);
  const on = useProgress(toggleAt, DUR.f4);
  const arrowPulse = useImpulse({at: toggleAt, dur: DUR.f5, peak: 0.3});

  return (
    <Panel
      accent={accent}
      style={{width: 660, height: 400, boxSizing: 'border-box', position: 'relative'}}
    >
      <div
        style={{position: 'absolute', left: 34, top: 30, fontFamily: theme.sans, fontSize: 36, fontWeight: 700, color: theme.text}}
      >
        {isField ? '查收尾字段' : '翻内容'}
      </div>
      <div style={{position: 'absolute', right: 34, top: 42, fontFamily: theme.mono, fontSize: 19, color: theme.dim}}>
        {isField ? 'stop_reason' : 'tool_use'}
      </div>

      {/* 回答流条：field 版右端让位给末尾徽章；content 版内嵌调用块段 */}
      <div
        style={{
          position: 'absolute',
          left: 32,
          top: 130,
          width: isField ? 430 : 596,
          height: 66,
          background: theme.bg,
          border: `2px solid ${theme.panelBorder}`,
          borderRadius: 10,
        }}
      >
        {Array.from({length: isField ? 8 : 12}, (_, i) => {
          const seg = !isField && i >= 8;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 14 + i * (isField ? 50 : 46),
                top: 15,
                width: isField ? 40 : 36,
                height: 36,
                borderRadius: 5,
                background: seg ? theme.tool : theme.panelBorder,
                opacity: seg ? 0.3 + 0.58 * lit : 0.55,
              }}
            />
          );
        })}
        {/* 调用块段描边（检出即亮） */}
        {!isField ? (
          <div
            style={{
              position: 'absolute',
              left: 372,
              top: 7,
              width: 148,
              height: 52,
              borderRadius: 8,
              border: `2px solid ${theme.tool}`,
              opacity: 0.9 * lit,
            }}
          />
        ) : null}
      </div>

      {/* 末尾徽章（仅 field）：翻色＝灰底叠 warn 层 + scaleX 翻面包络 */}
      {isField ? (
        <div
          style={{
            position: 'absolute',
            left: 452,
            top: 139,
            width: 176,
            height: 48,
            borderRadius: 999,
            background: theme.bg,
            border: `2px solid ${theme.panelBorder}`,
            transform: `scaleX(${1 - flip})`,
          }}
        >
          <div
            style={{position: 'absolute', inset: -2, borderRadius: 999, border: `2px solid ${theme.warn}`, opacity: lit}}
          />
          <span
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: theme.mono,
              fontSize: 19,
              color: theme.dim,
              lineHeight: '44px',
            }}
          >
            {'stop_reason'}
          </span>
          <span
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: theme.mono,
              fontSize: 19,
              color: theme.warn,
              opacity: lit,
              lineHeight: '44px',
            }}
          >
            {'stop_reason'}
          </span>
        </div>
      ) : null}

      {/* 放大镜（仅 content）：滑行到调用块段（空间弹簧） */}
      {!isField ? (
        <div style={{position: 'absolute', left: 90 + scan * 366, top: 62}}>
          <svg width={56} height={56} viewBox="0 0 56 56">
            <circle cx={22} cy={22} r={15} fill="none" stroke={theme.tool} strokeWidth={4} />
            <line x1={33} y1={33} x2={50} y2={50} stroke={theme.tool} strokeWidth={5} strokeLinecap="round" />
          </svg>
        </div>
      ) : null}

      {/* 判定行：停 ⇄ 转 */}
      <div style={{position: 'absolute', left: 44, top: 302, fontFamily: theme.sans, fontSize: 26, color: theme.dim}}>
        {'停'}
      </div>
      <div style={{position: 'absolute', left: 108, top: 290}}>
        <ToggleSwitch at={toggleAt} />
      </div>
      <div style={{position: 'absolute', left: 282, top: 302, width: 30, height: 36, fontFamily: theme.sans, fontSize: 26}}>
        <span style={{position: 'absolute', left: 0, top: 0, color: theme.dim}}>{'转'}</span>
        <span style={{position: 'absolute', left: 0, top: 0, color: theme.core, opacity: on}}>{'转'}</span>
      </div>
      <div style={{position: 'absolute', left: 396, top: 296}}>
        <LoopArrow p={on} pulse={arrowPulse} />
      </div>
    </Panel>
  );
};

const DuelCards: React.FC<{at03: number; at04: number}> = ({at03, at04}) => {
  const left = useEnter('rise', {at: 2, dur: DUR.f5, springPreset: 'settle', restBottom: 720});
  const right = useEnter('rise', {at: 2 + DUR.f2, dur: DUR.f5, springPreset: 'settle', restBottom: 720});
  const q = useEnter('pop', {at: DUR.f4, dur: DUR.f4});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 150, top: 320, ...left}}>
        <CriterionCard variant="field" atDemo={at03} />
      </div>
      <div style={{position: 'absolute', left: 1110, top: 320, ...right}}>
        <CriterionCard variant="content" atDemo={at04} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 810,
          top: 436,
          width: 300,
          textAlign: 'center',
          fontFamily: theme.serif,
          fontSize: 128,
          color: theme.dim,
          ...q,
        }}
      >
        {'？'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 流式显形：字符流逐字到达，字段徽章慢半拍仍灰 ─────────────────────

const StreamLag: React.FC<{at06: number; span: number}> = ({at06, span}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = useEnter('rise', {at: 0, dur: DUR.f5, springPreset: 'settle', restBottom: 770});
  const tag = useEnter('pop', {at: at06, dur: DUR.f4});

  const CELLS = 30;
  const SEG0 = 18; // 调用块段 [SEG0, SEG1)
  const SEG1 = 25;
  // 打字节奏自适应 beat 窗（约 62% 处打完——段落落在 p3-06「流式」附近）
  const cps = CELLS / Math.max(1, (span / FPS) * 0.62);
  const arrived = revealCharCount(frame - DUR.f4, fps, cps);
  const segOn = clamp01((arrived - SEG0) / 2);

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, ...enter}}>
        <div style={{position: 'absolute', left: 214, top: 346, fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>
          {'回答流'}
        </div>
        {/* 字符流横条 */}
        <div
          style={{
            position: 'absolute',
            left: 210,
            top: 390,
            width: 1500,
            height: 96,
            background: theme.panel,
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 12,
          }}
        >
          {Array.from({length: CELLS}, (_, i) => {
            const on = i < arrived;
            const seg = i >= SEG0 && i < SEG1;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 63 + i * 46,
                  top: 28,
                  width: 40,
                  height: 40,
                  borderRadius: 6,
                  background: seg ? theme.tool : theme.panelBorder,
                  opacity: on ? (seg ? 0.88 : 0.55) : 0,
                }}
              />
            );
          })}
          {/* 打字光标（帧驱动呼吸，打完即隐） */}
          {arrived < CELLS ? (
            <div
              style={{
                position: 'absolute',
                left: 63 + arrived * 46 - 3,
                top: 28,
                width: 4,
                height: 40,
                background: theme.dim,
                opacity: Math.floor((frame / fps) * 2) % 2 === 0 ? 0.9 : 0.15,
              }}
            />
          ) : null}
          {/* 调用块段检出框（内容已到） */}
          <div
            style={{
              position: 'absolute',
              left: 880,
              top: 20,
              width: 332,
              height: 56,
              borderRadius: 10,
              border: `2px solid ${theme.tool}`,
              opacity: 0.9 * segOn,
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 880,
            width: 332,
            top: 500,
            textAlign: 'center',
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.tool,
            opacity: segOn,
          }}
        >
          {'tool_use'}
        </div>

        {/* 字段徽章：滞后停在旧值（灰）——与字符流同帧可对比 */}
        <div
          style={{
            position: 'absolute',
            left: 1290,
            top: 640,
            width: 420,
            height: 130,
            background: theme.panel,
            border: `2px solid ${theme.panelBorder}`,
            borderRadius: 14,
          }}
        >
          <div style={{position: 'absolute', left: 28, top: 24, fontFamily: theme.mono, fontSize: 26, color: theme.dim}}>
            {'stop_reason'}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 28,
              top: 68,
              width: 132,
              height: 44,
              borderRadius: 8,
              border: `2px solid ${theme.panelBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 24,
              color: theme.dim,
            }}
          >
            {'旧值'}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 184,
              top: 86,
              width: 16,
              height: 16,
              borderRadius: 999,
              background: theme.panelBorder,
            }}
          />
        </div>
        {/* 连接线：流末端 → 字段徽章（灰的还在原地） */}
        <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
          <line
            x1={1660}
            y1={488}
            x2={1660}
            y2={640}
            stroke={theme.panelBorder}
            strokeWidth={3}
            strokeDasharray="4 8"
            opacity={0.65}
          />
        </svg>

        {/* p3-06「流式」角标贴上 */}
        <Pill
          color={theme.tool}
          style={{...tag, position: 'absolute', left: 246, top: 350, transform: `${tag.transform} rotate(-6deg)`}}
        >
          {'流式'}
        </Pill>
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 时间轴错位：内容指针到点（绿）vs 字段指针滞后一档（灰） ───────────

const LagTimeline: React.FC<{at08: number}> = ({at08}) => {
  const axis = useDraw(0, DUR.f5);
  const ticks = useProgress(DUR.f3, DUR.f4);
  // 双指针同刻出发、同束同窗：内容走到第 8 档，字段停在第 7 档（滞后一档）
  const move = useSpring('settle', {at: DUR.f5, dur: DUR.f6});
  const arrive = useProgress(DUR.f5 + DUR.f6 - DUR.f3, DUR.f3);
  const lockPulse = useImpulse({at: DUR.f5 + DUR.f6, dur: DUR.f5, peak: 0.6});
  // p3-08「迟到的信号」：锁链自字段指针垂下（只连字段指针——错绑因果是红线）
  const chain = useSpring('settle', {at: at08, dur: DUR.f5});
  const chainO = useProgress(at08, DUR.f3);
  const lateLabel = useEnter('rise', {at: at08 + DUR.f2, dur: DUR.f4, dist: 14});

  const X0 = 240;
  const STEP = 144;
  const CONTENT_X = X0 + 8 * STEP; // 1392
  const FIELD_X = X0 + 7 * STEP; // 1248

  const needle = (
    targetX: number,
    color: string,
    handleStroke: string,
    label: string,
  ) => (
    <g transform={`translate(${X0 + (targetX - X0) * move}, 0)`}>
      <line x1={0} y1={468} x2={0} y2={552} stroke={color} strokeWidth={4} />
      <rect x={-24} y={438} width={48} height={26} rx={13} fill={theme.bg} stroke={handleStroke} strokeWidth={3.5} />
      <line x1={-10} y1={451} x2={10} y2={451} stroke={handleStroke} strokeWidth={2.5} opacity={0.7} />
      <text
        x={0}
        y={416}
        textAnchor="middle"
        fontFamily={theme.sans}
        fontSize={30}
        fontWeight={700}
        fill={color}
      >
        {label}
      </text>
    </g>
  );

  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        {/* 时间轴（draw 描线；pathLength 归一化三元组，不与像素 dasharray 同元素） */}
        <line x1={X0} y1={560} x2={1680} y2={560} stroke={theme.dim} strokeWidth={4} {...axis} />
        {Array.from({length: 11}, (_, i) => (
          <line
            key={i}
            x1={X0 + i * STEP}
            y1={552}
            x2={X0 + i * STEP}
            y2={572}
            stroke={theme.panelBorder}
            strokeWidth={3}
            opacity={0.85 * ticks}
          />
        ))}
        {/* 到点 / 滞后刻位 */}
        <line x1={CONTENT_X} y1={548} x2={CONTENT_X} y2={576} stroke={theme.ok} strokeWidth={5} opacity={arrive} />
        <circle cx={CONTENT_X} cy={560} r={7 + lockPulse} fill={theme.ok} opacity={arrive} />
        <circle cx={FIELD_X} cy={560} r={6} fill="none" stroke={theme.dim} strokeWidth={2.5} opacity={arrive} />

        {needle(CONTENT_X, theme.ok, theme.ok, '内容')}
        {needle(FIELD_X, theme.dim, theme.panelBorder, '字段')}

        {/* 锁链：自字段指针垂下（迟到的具象） */}
        <g transform={`translate(${FIELD_X}, ${(chain - 1) * -44})`} opacity={chainO}>
          <ellipse cx={0} cy={588} rx={10} ry={13} fill="none" stroke={theme.warn} strokeWidth={3.5} />
          <ellipse cx={0} cy={616} rx={10} ry={13} fill="none" stroke={theme.warn} strokeWidth={3.5} />
          <ellipse cx={0} cy={644} rx={10} ry={13} fill="none" stroke={theme.warn} strokeWidth={3.5} />
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 700,
          top: 606,
          width: 460,
          textAlign: 'right',
          fontFamily: theme.sans,
          fontSize: 32,
          fontWeight: 700,
          color: theme.warn,
          ...lateLabel,
        }}
      >
        {'迟到的信号'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-D 火警调度台插曲（≤2s 即收）+ 边界标记 ─────────────────────────────

const FireDispatch: React.FC<{at10: number; dur09: number}> = ({at10, dur09}) => {
  const consoleIn = useEnter('pop', {at: DUR.f3, dur: DUR.f4});
  const chip1 = useEnter('rise', {at: DUR.f4 + DUR.f2, dur: DUR.f3, dist: 18});
  const chip2 = useEnter('rise', {at: DUR.f4 + DUR.f3, dur: DUR.f3, dist: 18});
  const dispatchAt = DUR.f6; // 「着火 · 地址」两词到位即派车（不等收尾）
  const slip = useEnter('slideR', {at: dispatchAt, dur: DUR.f5, dist: 240, springPreset: 'settle'});
  const stamp = useEnter('pop', {at: dispatchAt + DUR.f3, dur: DUR.f4});
  // 插曲 ≤2s 即收：听筒台自入场起 2 秒内退场（时长上限经 FPS 换算，非绝对锚）
  const outEnd = Math.min(2 * FPS, Math.max(dispatchAt + DUR.f5, dur09 - DUR.f5));
  const consoleOut = useProgress(outEnd - DUR.f4, DUR.f4);
  // 派车单留守并滑至画面中央（插曲收、单据在——因果链不断）
  const slipGlide = useSpring('settle', {at: outEnd + DUR.f2, dur: DUR.f5});
  // p3-10 边界标记：「补派 ✓ / 第二回 ✗」打上、「第二回」划掉
  const mark1 = useEnter('pop', {at: at10 + DUR.f4, dur: DUR.f4});
  const mark2 = useEnter('pop', {at: at10 + DUR.f4 + DUR.f3, dur: DUR.f4});
  const strike = useProgress(at10 + DUR.f6, DUR.f4);

  return (
    <AbsoluteFill>
      {/* 调度台（听筒 + 两词；短促插曲，退场后不常驻） */}
      <div
        style={{
          position: 'absolute',
          left: 480,
          top: 330,
          width: 760,
          height: 380,
          background: theme.panel,
          border: `2px solid ${theme.core}`,
          borderRadius: 14,
          opacity: consoleIn.opacity * (1 - consoleOut),
          transform: consoleIn.transform,
        }}
      >
        <svg width={88} height={70} viewBox="0 0 88 70" style={{position: 'absolute', left: 60, top: 150}}>
          <rect x={8} y={30} width={18} height={36} rx={8} fill={theme.core} />
          <rect x={62} y={30} width={18} height={36} rx={8} fill={theme.core} />
          <path d="M17 30 C 17 8, 71 8, 71 30" fill="none" stroke={theme.core} strokeWidth={7} strokeLinecap="round" />
        </svg>
        <div
          style={{
            ...chip1,
            position: 'absolute',
            left: 220,
            top: 150,
            padding: '10px 26px',
            borderRadius: 999,
            border: `2px solid ${theme.warn}`,
            background: theme.bg,
            fontFamily: theme.sans,
            fontSize: 34,
            fontWeight: 700,
            color: theme.warn,
          }}
        >
          {'着火'}
        </div>
        <div
          style={{
            ...chip2,
            position: 'absolute',
            left: 400,
            top: 150,
            padding: '10px 26px',
            borderRadius: 999,
            border: `2px solid ${theme.panelBorder}`,
            background: theme.bg,
            fontFamily: theme.sans,
            fontSize: 34,
            fontWeight: 700,
            color: theme.text,
          }}
        >
          {'地址'}
        </div>
        <div
          style={{position: 'absolute', left: 220, top: 262, fontFamily: theme.mono, fontSize: 19, color: theme.dim}}
        >
          {'两词到位 · 即派车'}
        </div>
      </div>

      {/* 派车单：滑出调度台 → 留守滑至中央 */}
      <div
        style={{
          position: 'absolute',
          left: 1300,
          top: 372,
          width: 300,
          height: 176,
          background: theme.panel,
          border: `2px solid ${theme.core}`,
          borderRadius: 12,
          opacity: slip.opacity,
          transform: `${slip.transform} translateX(${(slipGlide - 1) * -490}px)`,
        }}
      >
        <div style={{position: 'absolute', left: 24, top: 18, fontFamily: theme.mono, fontSize: 24, color: theme.dim}}>
          {'派车单'}
        </div>
        <div
          style={{
            ...stamp,
            position: 'absolute',
            right: 22,
            top: 56,
            width: 96,
            height: 96,
            borderRadius: 999,
            border: `3px solid ${theme.core}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: theme.sans,
            fontSize: 30,
            fontWeight: 700,
            color: theme.core,
            transform: `${stamp.transform} rotate(-14deg)`,
          }}
        >
          {'已派'}
        </div>
        <div style={{position: 'absolute', left: 24, bottom: 16, fontFamily: theme.mono, fontSize: 17, color: theme.dim}}>
          {'不等收尾'}
        </div>
      </div>

      {/* 边界小标记（p3-10）：补派 ✓ / 第二回 ✗（划掉） */}
      <div
        style={{
          ...mark1,
          position: 'absolute',
          left: 620,
          top: 640,
          padding: '12px 28px',
          borderRadius: 999,
          border: `2px solid ${theme.panelBorder}`,
          background: theme.bg,
          fontFamily: theme.sans,
          fontSize: 30,
          fontWeight: 600,
        }}
      >
        <span style={{color: theme.dim}}>{'补派'}</span>
        <span style={{color: theme.ok}}>{' ✓'}</span>
      </div>
      <div
        style={{
          ...mark2,
          position: 'absolute',
          left: 985,
          top: 640,
          padding: '12px 28px',
          borderRadius: 999,
          border: `2px solid ${theme.warn}`,
          background: theme.bg,
          fontFamily: theme.sans,
          fontSize: 30,
          fontWeight: 600,
          color: theme.warn,
        }}
      >
        <span style={{position: 'relative', display: 'inline-block'}}>
          {'第二回'}
          <span
            style={{
              position: 'absolute',
              left: 4,
              right: 4,
              top: '52%',
              height: 3,
              background: theme.warn,
              transform: `scaleX(${strike})`,
              transformOrigin: 'left center',
            }}
          />
        </span>
        {' ✗'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-E 消融对比（左红右绿恒定）──────────────────────────────────────────

/** 单轨回答流：字符格 + 两枚调用块；degraded 轨在 p3-13 坠落淡出（轨迹可见） */
const TrackStream: React.FC<{degraded: boolean; at13: number; cellsAt: number}> = ({degraded, at13, cellsAt}) => {
  const cells = useProgress(cellsAt, DUR.f5);
  const fall = useProgress(at13, DUR.f6, 'accelerate'); // 空间：坠落加速离场
  const fade = useProgress(at13 + DUR.f4, DUR.f5); // effects：迟一拍淡出
  const guide = useProgress(at13 + DUR.f2, DUR.f3);
  const g1 = useProgress(at13 + DUR.f3, DUR.f2);
  const g2 = useProgress(at13 + DUR.f3 + DUR.f2, DUR.f2);
  const label = useProgress(at13 + DUR.f6, DUR.f4);
  const kept = useProgress(at13 + DUR.f3, DUR.f3);
  const blocks = [412, 458];

  return (
    <div style={{position: 'relative', width: 560, height: 224}}>
      <div style={{position: 'absolute', left: 0, top: -28, fontFamily: theme.mono, fontSize: 16, color: theme.dim}}>
        {'回答流'}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 560,
          height: 64,
          borderRadius: 10,
          background: theme.bg,
          border: `2px solid ${theme.panelBorder}`,
        }}
      >
        {Array.from({length: 12}, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 14 + i * 32,
              top: 17,
              width: 26,
              height: 30,
              borderRadius: 4,
              background: theme.panelBorder,
              opacity: 0.5 * cells,
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 506,
          top: 66,
          fontFamily: theme.mono,
          fontSize: 16,
          color: theme.tool,
          opacity: cells,
        }}
      >
        {'调用块 ×2'}
      </div>
      {blocks.map((bx, k) => (
        <div key={k}>
          {/* 坠落轨迹：虚线引导 + 两枚残影（静默丢弃的过程证据） */}
          {degraded ? (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: bx + 17,
                  top: 62,
                  width: 2,
                  height: 150,
                  backgroundImage: `repeating-linear-gradient(to bottom, ${theme.warn} 0 6px, transparent 6px 12px)`,
                  opacity: 0.75 * guide,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: bx,
                  top: 116,
                  width: 36,
                  height: 46,
                  borderRadius: 6,
                  background: theme.tool,
                  opacity: 0.28 * g1,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: bx,
                  top: 164,
                  width: 36,
                  height: 46,
                  borderRadius: 6,
                  background: theme.tool,
                  opacity: 0.14 * g2,
                }}
              />
            </>
          ) : null}
          {/* 调用块本体 */}
          <div
            style={{
              position: 'absolute',
              left: bx,
              top: 9 + (degraded ? 150 * fall : 0),
              width: 36,
              height: 46,
              borderRadius: 6,
              background: theme.tool,
              opacity: degraded ? 1 - fade : 0.92,
            }}
          />
        </div>
      ))}
      {degraded ? (
        <div
          style={{
            position: 'absolute',
            left: 506,
            top: 96,
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.warn,
            opacity: label,
          }}
        >
          {'静默丢弃'}
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            left: 506,
            top: 96,
            fontFamily: theme.mono,
            fontSize: 20,
            color: theme.ok,
            opacity: kept,
          }}
        >
          {'在位'}
        </div>
      )}
    </div>
  );
};

/** 十格任务带：clamp01 单进度顺序点亮（计数语义永不过冲）；missed 格打 ✗ */
const TaskBand: React.FC<{fill: number; litCount: number; accent: string; markAt: number; showMark: boolean}> = ({
  fill,
  litCount,
  accent,
  markAt,
  showMark,
}) => {
  const mark = useProgress(markAt, DUR.f3);
  return (
    <div style={{position: 'relative', display: 'flex', gap: 8}}>
      {Array.from({length: 10}, (_, i) => {
        const on = clamp01(fill * litCount - i);
        const missed = showMark && i >= litCount;
        return (
          <div
            key={i}
            style={{
              position: 'relative',
              width: 58,
              height: 58,
              borderRadius: 9,
              border: `2px solid ${on > 0.5 ? accent : theme.panelBorder}`,
              background: on > 0.5 ? `${accent}26` : 'transparent',
            }}
          >
            {missed ? (
              <svg width={58} height={58} viewBox="0 0 58 58" style={{position: 'absolute', inset: 0, opacity: mark}}>
                <line x1={18} y1={18} x2={40} y2={40} stroke={theme.warn} strokeWidth={5} strokeLinecap="round" />
                <line x1={40} y1={18} x2={18} y2={40} stroke={theme.warn} strokeWidth={5} strokeLinecap="round" />
              </svg>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

/** 七件落地清单：degraded 轨末两件坠落淡出（七件掉到五件） */
const Checklist: React.FC<{degraded: boolean; at13: number}> = ({degraded, at13}) => {
  const fall = useProgress(at13 + DUR.f5, DUR.f6, 'accelerate');
  const fade = useProgress(at13 + DUR.f5 + DUR.f4, DUR.f5);
  const guide = useProgress(at13 + DUR.f5 + DUR.f2, DUR.f3);
  return (
    <div style={{position: 'relative', width: 460, height: 252}}>
      {Array.from({length: 7}, (_, i) => {
        const dropped = degraded && i >= 5;
        const y = i * 36;
        return (
          <div key={i}>
            {dropped ? (
              <div
                style={{
                  position: 'absolute',
                  left: 8,
                  top: y + 24,
                  width: 2,
                  height: 104,
                  backgroundImage: `repeating-linear-gradient(to bottom, ${theme.panelBorder} 0 5px, transparent 5px 10px)`,
                  opacity: 0.8 * guide,
                }}
              />
            ) : null}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: y + (dropped ? 104 * fall : 0),
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                opacity: dropped ? 1 - fade : 1,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  background: degraded ? theme.warn : theme.ok,
                  opacity: 0.8,
                }}
              />
              <div style={{width: 400, height: 20, borderRadius: 4, background: theme.panelBorder, opacity: 0.4}} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** 计数条：基线锚定（满刻度描边 + 基线刻度），读数滚动 + p3-12 重音脉冲 */
const CountBar: React.FC<{
  label: string;
  from: number;
  to: number;
  base: number;
  at: number;
  pulse: number;
}> = ({label, from, to, base, at, pulse}) => {
  const v = useCount({from, to, at, dur: DUR.f6});
  const n = Math.round(Math.max(Math.min(from, to), Math.min(Math.max(from, to), v)));
  const BAR_W = 240;
  return (
    <div style={{position: 'relative', width: 360, height: 64}}>
      <div style={{position: 'absolute', left: 0, top: 0, fontFamily: theme.mono, fontSize: 22, color: theme.dim}}>
        {label}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 38,
          width: BAR_W,
          height: 14,
          borderRadius: 7,
          border: `2px solid ${theme.panelBorder}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: (n / base) * (BAR_W - 4),
            height: 10,
            borderRadius: 5,
            background: theme.warn,
          }}
        />
      </div>
      {/* 基线刻度：满值位置立标（10 / 7 的锚） */}
      <div style={{position: 'absolute', left: BAR_W - 2, top: 30, width: 2, height: 30, background: theme.dim}} />
      <div
        style={{
          position: 'absolute',
          left: BAR_W - 26,
          top: 2,
          width: 50,
          textAlign: 'right',
          fontFamily: theme.mono,
          fontSize: 15,
          color: theme.dim,
        }}
      >
        {`${base}`}
      </div>
      <div
        style={{
          position: 'absolute',
          left: BAR_W + 22,
          top: 16,
          fontFamily: theme.mono,
          fontSize: 42,
          fontWeight: 700,
          color: theme.warn,
          fontVariantNumeric: 'tabular-nums',
          transform: `scale(${1 + pulse})`,
          transformOrigin: 'left center',
        }}
      >
        {`${n}`}
      </div>
      <div
        style={{
          position: 'absolute',
          left: BAR_W + 30,
          top: 44,
          fontFamily: theme.mono,
          fontSize: 18,
          color: theme.dim,
          opacity: 0.8,
        }}
      >
        {`/ ${base}`}
      </div>
    </div>
  );
};

const AblationCompare: React.FC<{at12: number; dur12: number; at13: number; at14: number}> = ({
  at12,
  dur12,
  at13,
  at14,
}) => {
  const leftIn = useEnter('rise', {at: DUR.f2, dur: DUR.f5, springPreset: 'settle', restBottom: 800});
  const rightIn = useEnter('rise', {at: DUR.f2 + DUR.f3, dur: DUR.f5, springPreset: 'settle', restBottom: 800});
  const swap = useEnter('pop', {at: DUR.f4, dur: DUR.f4});
  // p3-12 计数事件：带格先点亮 → 读数滚动 → 重音脉冲（先后串行，不叠主动画）
  const fillWin = Math.max(DUR.f5, Math.round(dur12 / 2));
  const fill = useProgress(at12, fillWin);
  const counterIn = useEnter('fade', {at: at12, dur: DUR.f4});
  const countAt = at12 + fillWin;
  const pulse = useImpulse({at: countAt + DUR.f6 + DUR.f2, dur: DUR.f5, peak: 0.22});
  // p3-14 教训金句：对账面压暗、短卡闪现定格
  const dim = useDim({at: at14, to: 0.22, dur: DUR.f5});
  const quote = useEnter('pop', {at: at14, dur: DUR.f4});

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: dim}}>
        {/* 左轨：判据换回收尾字段（红） */}
        <div style={{position: 'absolute', left: 120, top: 100, width: 800, height: 720, ...leftIn}}>
          <Panel accent={theme.warn} style={{display: 'inline-flex', alignItems: 'center', gap: 14, padding: '12px 22px'}}>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'判据'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.warn}}>{'收尾字段'}</span>
            <span style={{display: 'inline-block', ...swap}}>
              <svg width={30} height={26} viewBox="0 0 30 26">
                <path
                  d="M4 8 H 24 M 24 8 L 18 3 M 24 8 L 18 13"
                  fill="none"
                  stroke={theme.warn}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M26 18 H 6 M 6 18 L 12 13 M 6 18 L 12 23"
                  fill="none"
                  stroke={theme.warn}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </Panel>
          <div style={{position: 'absolute', left: 60, top: 130}}>
            <TrackStream degraded at13={at13} cellsAt={DUR.f2 + DUR.f5 + DUR.f6} />
          </div>
          <div style={{position: 'absolute', left: 60, top: 356}}>
            <TaskBand fill={fill} litCount={8} accent={theme.warn} markAt={countAt + DUR.f2} showMark />
          </div>
          <div style={{position: 'absolute', left: 60, top: 452}}>
            <Checklist degraded at13={at13} />
          </div>
        </div>

        {/* 右轨：内容块判据在位（绿）——右侧不出现任何退化 */}
        <div style={{position: 'absolute', left: 1000, top: 100, width: 800, height: 720, ...rightIn}}>
          <Panel accent={theme.ok} style={{display: 'inline-flex', alignItems: 'center', gap: 14, padding: '12px 22px'}}>
            <span style={{fontFamily: theme.mono, fontSize: 18, color: theme.dim}}>{'判据'}</span>
            <span style={{fontFamily: theme.sans, fontSize: 30, fontWeight: 700, color: theme.ok}}>{'内容块'}</span>
          </Panel>
          <div style={{position: 'absolute', left: 60, top: 130}}>
            <TrackStream degraded={false} at13={at13} cellsAt={DUR.f2 + DUR.f5} />
          </div>
          <div style={{position: 'absolute', left: 60, top: 356}}>
            <TaskBand fill={fill} litCount={10} accent={theme.ok} markAt={countAt + DUR.f2} showMark={false} />
          </div>
          <div style={{position: 'absolute', left: 60, top: 452}}>
            <Checklist degraded={false} at13={at13} />
          </div>
        </div>

        {/* 双计数条 10→8 / 7→5（基线锚定，p3-12 重音） */}
        <div style={{position: 'absolute', left: 620, top: 845, ...counterIn}}>
          <CountBar label={'轮次'} from={10} to={8} base={10} at={countAt} pulse={pulse} />
        </div>
        <div style={{position: 'absolute', left: 1000, top: 845, ...counterIn}}>
          <CountBar label={'落地'} from={7} to={5} base={7} at={countAt + DUR.f3} pulse={pulse} />
        </div>
      </div>

      {/* p3-14 教训金句短卡（关键词化，闪现定格） */}
      <div style={{position: 'absolute', left: 520, top: 430, width: 880, ...quote}}>
        <Panel accent={theme.warn} style={{padding: '34px 44px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.serif, fontSize: 54, fontWeight: 700, color: theme.warn}}>
            {'字段晚到＝丢调用'}
          </div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P3CriterionDuel: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-06');
  const bC = w('p3-07', 'p3-08');
  const bD = w('p3-09', 'p3-10');
  const bE = w('p3-11', 'p3-14');

  return (
    <AbsoluteFill>
      <Sequence {...bA} name="3-A">
        <SceneTag chapter={'判据之争'} tagline={'凭什么继续 · 凭什么停'} accent={theme.core} />
        <DuelCards at03={at('p3-03') - bA.from} at04={at('p3-04') - bA.from} />
        <Footnote delay={12}>{'stop_reason vs tool_use'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="3-B">
        <StreamLag at06={at('p3-06') - bB.from} span={bB.durationInFrames} />
      </Sequence>

      <Sequence {...bC} name="3-C">
        <LagTimeline at08={at('p3-08') - bC.from} />
      </Sequence>

      <Sequence {...bD} name="3-D">
        <FireDispatch at10={at('p3-10') - bD.from} dur09={dur('p3-09')} />
      </Sequence>

      <Sequence {...bE} name="3-E">
        <AblationCompare
          at12={at('p3-12') - bE.from}
          dur12={dur('p3-12')}
          at13={at('p3-13') - bE.from}
          at14={at('p3-14') - bE.from}
        />
        <Footnote delay={12}>{'消融对照 · 只换判据 · 其余全不动'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3CriterionDuel;
