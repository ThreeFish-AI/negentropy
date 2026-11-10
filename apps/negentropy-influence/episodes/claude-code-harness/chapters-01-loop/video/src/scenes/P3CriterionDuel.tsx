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
import {Footnote, LoopRing, Panel, SceneTag, type RingNode} from '../components/motifs';
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
  useShake,
  useSpring,
} from '../motion';

/** 幕级 M-001 缩悬环：P2 同款同形（160/140px、五站、关标签），挂 Sequence 外跨镜
 *  不断相——P3 口播「每圈转完凭什么判断」直指环体，62s 缺席即全片中段锚断裂；
 *  3-E 左轨「提前中断」词窗冻结停转（P2 atStop 同式）。顶中偏左位避开六镜全部
 *  既有装置（SceneTag x≤400、各镜首元素 y≥316、3-E 双轨 header x120-460/1000-1340） */
const SCENE_RING = {size: 140, x: 560, y: 62} as const;
const SCENE_RING_LAP = 75;
const PENT_NODES: RingNode[] = [0, 1, 2, 3, 4].map((i) => ({label: `s${i + 1}`, angle: -90 + i * 72}));

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

/** 两版判据卡（同构等大 660×400）：field=p3-03 演示、content=p3-04 演示（次序=口播）。
 *  词窗纪律（M-005）：field 徽章翻色锚「结束原因标记」词（≈0.6·p3-03）、
 *  content 调用块点亮锚「工具调用块」词（≈0.75·p3-04）——不再抢跑整句 */
const CriterionCard: React.FC<{variant: 'field' | 'content'; atDemo: number; litAt: number}> = ({
  variant,
  atDemo,
  litAt,
}) => {
  const isField = variant === 'field';
  const accent = isField ? theme.warn : theme.ok;
  // 演示链（Visual Lock：任一卡不得先动——atDemo 分别锚 p3-03 / p3-04）：
  // field：徽章翻色 → 拨开关；content：放大镜滑行 → 调用块点亮 → 拨开关
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

const DuelCards: React.FC<{at03: number; litLAt: number; at04: number; litRAt: number; qAt: number}> = ({
  at03,
  litLAt,
  at04,
  litRAt,
  qAt,
}) => {
  const left = useEnter('rise', {at: 2, dur: DUR.f5, springPreset: 'settle', restBottom: 720});
  const right = useEnter('rise', {at: 2 + DUR.f2, dur: DUR.f5, springPreset: 'settle', restBottom: 720});
  // 「？」随问句核心词弹出（「凭什么继续还是该停」≈0.55·p3-01），不再提前 4s 定格
  const q = useEnter('pop', {at: qAt, dur: DUR.f4});
  const qPulse = useImpulse({at: qAt, dur: DUR.f5, peak: 0.08});
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 150, top: 320, ...left}}>
        <CriterionCard variant="field" atDemo={at03} litAt={litLAt} />
      </div>
      <div style={{position: 'absolute', left: 1110, top: 320, ...right}}>
        <CriterionCard variant="content" atDemo={at04} litAt={litRAt} />
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
          transform: `${q.transform} scale(${1 + qPulse})`,
          opacity: q.opacity,
        }}
      >
        {'？'}
      </div>
    </AbsoluteFill>
  );
};

// ── 3-B 两态演示：一次性整块亮（p3-05）→ 流式逐字重打（p3-06）+ 字段迟到翻转 ──

const StreamLag: React.FC<{
  bulkAt: number;
  streamAt: number;
  flipAt: number;
  span: number;
}> = ({bulkAt, streamAt, flipAt, span}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = useEnter('rise', {at: 0, dur: DUR.f5, springPreset: 'settle', restBottom: 770});
  const tag = useEnter('pop', {at: streamAt, dur: DUR.f4});

  const CELLS = 30;
  const SEG0 = 18; // 调用块段 [SEG0, SEG1)
  const SEG1 = 25;
  // 两态：p3-05「一次性返回全部内容」整块亮（两版判据几乎没区别的铺垫态）；
  // p3-06「流式」词落位整块隐去、逐字重打——形态对比即本镜教学点（§5.2 画面替代语言）
  const bulk = useProgress(bulkAt, DUR.f4);
  const reset = useProgress(streamAt, DUR.f3);
  // 打字节奏自适应：streamAt 起约占余窗的 62% 打完
  const typeWin = Math.max(DUR.f5, (span - streamAt) * 0.62);
  const cps = CELLS / Math.max(1, typeWin / FPS);
  const arrived = revealCharCount(frame - streamAt - DUR.f3, fps, cps);
  const segOn = clamp01((arrived - SEG0) / 2);

  // 字段徽章迟到翻转：打完后 f6 帧「旧值」翻「新值」（迟≠永不到，gl-notes §3.4）
  // + warn「迟到」微签一拍即驻——「晚一拍才更新」的可视化
  const flipP = useProgress(flipAt, DUR.f4);
  const lateTag = useEnter('pop', {at: flipAt + DUR.f3, dur: DUR.f4});

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
            const seg = i >= SEG0 && i < SEG1;
            const on = i < arrived;
            const o = Math.max(bulk * (1 - reset), on ? (seg ? 0.88 : 0.55) : 0);
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
                  opacity: o,
                }}
              />
            );
          })}
          {/* 打字光标（帧驱动呼吸，流式态打完即隐；一次性态无光标） */}
          {reset > 0.5 && arrived < CELLS ? (
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
          {/* 调用块段检出框（流式重打中内容先到） */}
          <div
            style={{
              position: 'absolute',
              left: 880,
              top: 20,
              width: 332,
              height: 56,
              borderRadius: 10,
              border: `2px solid ${theme.tool}`,
              opacity: 0.9 * segOn * reset,
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
            opacity: segOn * reset,
          }}
        >
          {'tool_use'}
        </div>

        {/* 字段徽章：流式期滞后停旧值（灰）→ 打完后迟到翻新值——与字符流同帧可对比 */}
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
          {/* 旧值层（翻新时退场） */}
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
              opacity: 1 - flipP,
            }}
          >
            {'旧值'}
          </div>
          {/* 新值层（迟到翻转：warn 边框 + 「迟到」微签） */}
          <div
            style={{
              position: 'absolute',
              left: 28,
              top: 68,
              width: 132,
              height: 44,
              borderRadius: 8,
              border: `2px solid ${theme.warn}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.sans,
              fontSize: 24,
              color: theme.warn,
              opacity: flipP,
            }}
          >
            {'新值'}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 184,
              top: 86,
              width: 16,
              height: 16,
              borderRadius: 999,
              background: flipP > 0.5 ? theme.warn : theme.panelBorder,
            }}
          />
          <div style={{position: 'absolute', left: 322, top: 76, ...lateTag}}>
            <Pill color={theme.warn} style={{padding: '4px 12px', fontSize: 20}}>
              {'迟到'}
            </Pill>
          </div>
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

        {/* p3-06「流式」角标贴上（词窗锚定；错开「回答流」标签防压字） */}
        <Pill
          color={theme.tool}
          style={{...tag, position: 'absolute', left: 350, top: 338, transform: `${tag.transform} rotate(-6deg)`}}
        >
          {'流式'}
        </Pill>
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 时间轴错位：内容指针到点（绿）vs 字段指针滞后一档（灰） ───────────

const LagTimeline: React.FC<{moveDur: number; arriveAt: number; chainAt: number}> = ({
  moveDur,
  arriveAt,
  chainAt,
}) => {
  const axis = useDraw(0, DUR.f5);
  const ticks = useProgress(DUR.f3, DUR.f4);
  // 双指针同刻出发、同束同窗（行程铺满 p3-07 打字句）：内容走到第 8 档，
  // 字段停在第 7 档（滞后一档）；到点绿/锁链脉冲落 p3-08 词位——不再句首耗尽事件
  const move = useSpring('settle', {at: DUR.f5, dur: moveDur});
  const arrive = useProgress(arriveAt, DUR.f3);
  const lockPulse = useImpulse({at: arriveAt, dur: DUR.f5, peak: 0.6});
  // p3-08 尾「就已就位」词窗：锁链自字段指针垂下（只连字段指针——错绑因果是红线）
  const chain = useSpring('settle', {at: chainAt, dur: DUR.f5});
  const chainO = useProgress(chainAt, DUR.f3);
  const lateLabel = useEnter('rise', {at: chainAt + DUR.f2, dur: DUR.f4, dist: 14});

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

// ── 3-D 火警调度台插曲（短促即收）+ 出警车 + 边界标记 ────────────────────

const FireDispatch: React.FC<{
  chip1At: number;
  dispatchAt: number;
  at10: number;
  mark1At: number;
  mark2At: number;
  strikeAt: number;
  outEnd: number;
}> = ({chip1At, dispatchAt, at10, mark1At, mark2At, strikeAt, outEnd}) => {
  const consoleIn = useEnter('pop', {at: DUR.f3, dur: DUR.f4});
  const chip1 = useEnter('rise', {at: chip1At, dur: DUR.f3, dist: 18});
  const chip2 = useEnter('rise', {at: chip1At + DUR.f3, dur: DUR.f3, dist: 18});
  // 「车就该立刻派出去」词落位：派车单滑出 + 已派章 + 出警车开出（分镜承诺元素）
  const slip = useEnter('slideR', {at: dispatchAt, dur: DUR.f5, dist: 240, springPreset: 'settle'});
  const stamp = useEnter('pop', {at: dispatchAt + DUR.f3, dur: DUR.f4});
  const truckP = useProgress(dispatchAt + DUR.f4, 40, 'accelerate');
  const truckO = useProgress(dispatchAt, DUR.f3);
  const siren = useImpulse({at: dispatchAt, dur: 12});
  const consoleOut = useProgress(outEnd - DUR.f4, DUR.f4);
  // 派车单留守并滑移（插曲收、单据在——因果链不断）
  const slipGlide = useSpring('settle', {at: outEnd + DUR.f2, dur: DUR.f5});
  // p3-10 边界标记：「补派 ✓」先落词、「第二回 ✗」随后、「第二回」划掉不提前剧透收束
  const mark1 = useEnter('pop', {at: mark1At, dur: DUR.f4});
  const mark2 = useEnter('pop', {at: mark2At, dur: DUR.f4});
  const strike = useProgress(strikeAt, DUR.f4);

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

      {/* 出警车：两词到位即开出（分镜「出警车开出」承诺；派出的物象是车不是纸） */}
      {truckP < 1 ? (
        <svg
          width={200}
          height={90}
          viewBox="0 0 200 90"
          style={{
            position: 'absolute',
            left: 700 + truckP * 760,
            top: 540,
            opacity: (1 - truckP * 0.35) * (0.65 + 0.35 * truckO),
            overflow: 'visible',
          }}
        >
          <g stroke={theme.core} strokeWidth={4} fill="none" strokeLinejoin="round">
            <rect x={8} y={18} width={112} height={44} rx={8} />
            <path d="M120 30 L158 30 L178 52 L178 62 L120 62 Z" />
          </g>
          <rect x={122} y={34} width={28} height={18} rx={3} fill={theme.core} opacity={0.7} />
          <circle cx={40} cy={68} r={12} fill={theme.bg} stroke={theme.core} strokeWidth={4} />
          <circle cx={148} cy={68} r={12} fill={theme.bg} stroke={theme.core} strokeWidth={4} />
          <circle cx={40} cy={68} r={4} fill={theme.core} />
          <circle cx={148} cy={68} r={4} fill={theme.core} />
          {/* 警灯闪（帧驱动，无随机） */}
          <circle cx={30} cy={12} r={6} fill={theme.warn} opacity={siren} />
        </svg>
      ) : null}

      {/* 派车单：滑出调度台 → 留守滑移（因果链不断） */}
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

      {/* 边界小标记（p3-10）：补派 ✓ / 第二回 ✗（划掉落词，不提前剧透） */}
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

/** 单轨回答流：字符格 + 两枚调用块；degraded 轨在 p3-13「提前中断」词窗坠落
 *  （轨迹可见）；「静默丢弃」标签独立锚「静默丢弃」词（≈0.85·p3-13） */
const TrackStream: React.FC<{degraded: boolean; at13: number; atLabel: number; cellsAt: number}> = ({
  degraded,
  at13,
  atLabel,
  cellsAt,
}) => {
  const cells = useProgress(cellsAt, DUR.f5);
  const fall = useProgress(at13, DUR.f6, 'accelerate'); // 空间：坠落加速离场
  const fade = useProgress(at13 + DUR.f4, DUR.f5); // effects：迟一拍淡出
  const guide = useProgress(at13 + DUR.f2, DUR.f3);
  const g1 = useProgress(at13 + DUR.f3, DUR.f2);
  const g2 = useProgress(at13 + DUR.f3 + DUR.f2, DUR.f2);
  const label = useProgress(atLabel, DUR.f4);
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

const AblationCompare: React.FC<{
  at12: number;
  dur12: number;
  at11: number;
  at13: number;
  atLabel: number;
  at14: number;
}> = ({at12, dur12, at11, at13, atLabel, at14}) => {
  const leftIn = useEnter('rise', {at: DUR.f2, dur: DUR.f5, springPreset: 'settle', restBottom: 800});
  // 组级入场错峰拉开（A-04 边缘缓解）：右轨晚一档
  const rightIn = useEnter('rise', {at: DUR.f2 + DUR.f4, dur: DUR.f5, springPreset: 'settle', restBottom: 800});
  const swap = useEnter('pop', {at: DUR.f4, dur: DUR.f4});
  // p3-11「误判为已经结束」：因果链第一环——左轨头盖「判停」warn 章（读旧值→判停）；
  // p3-13 坠落时左轨整轨 useShake 一拍（错误路径 shake 合法包装，代价落回轨上）
  const haltStamp = useEnter('pop', {at: at11, dur: DUR.f4});
  const railShake = useShake({at: at13, amp: 3.5, freq: 1.6, decay: true, dur: DUR.f6});
  // p3-12 计数事件：带格先点亮 → 读数滚动 → 重音脉冲（先后串行，不叠主动画）
  const fillWin = Math.max(DUR.f5, Math.round(dur12 / 2));
  const fill = useProgress(at12, fillWin);
  const counterIn = useEnter('fade', {at: at12, dur: DUR.f4});
  const countAt = at12 + fillWin;
  const pulse = useImpulse({at: countAt + DUR.f6 + DUR.f2, dur: DUR.f5, peak: 0.22});
  // p3-14 教训金句：对账面压暗、短卡闪现定格（文案=分镜 SSOT）
  const dim = useDim({at: at14, to: 0.22, dur: DUR.f5});
  const quote = useEnter('pop', {at: at14, dur: DUR.f4});

  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: dim}}>
        {/* 左轨：判据换回收尾字段（红）；坠落拍整轨 shake（错误路径合法包装） */}
        <div
          style={{
            position: 'absolute',
            left: 120,
            top: 100,
            width: 800,
            height: 720,
            ...leftIn,
            transform: `${leftIn.transform} translateX(${railShake}px)`,
          }}
        >
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
            {/* 「判停」章：误判瞬间的画面化（因果链第一环——读旧值→判停） */}
            <span
              style={{
                ...haltStamp,
                padding: '4px 14px',
                borderRadius: 8,
                border: `2.5px solid ${theme.warn}`,
                fontFamily: theme.sans,
                fontSize: 26,
                fontWeight: 700,
                color: theme.warn,
                transform: `${haltStamp.transform} rotate(-8deg)`,
              }}
            >
              {'判停'}
            </span>
          </Panel>
          <div style={{position: 'absolute', left: 60, top: 130}}>
            <TrackStream degraded at13={at13} atLabel={atLabel} cellsAt={DUR.f2 + DUR.f5 + DUR.f6} />
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
            <TrackStream degraded={false} at13={at13} atLabel={atLabel} cellsAt={DUR.f2 + DUR.f5} />
          </div>
          <div style={{position: 'absolute', left: 60, top: 356}}>
            <TaskBand fill={fill} litCount={10} accent={theme.ok} markAt={countAt + DUR.f2} showMark={false} />
          </div>
          <div style={{position: 'absolute', left: 60, top: 452}}>
            <Checklist degraded={false} at13={at13} />
          </div>
        </div>

        {/* 双计数条 10→8 / 7→5（基线锚定，p3-12 重音）——两条都是左轨（退化侧）度量，
            归拢左轨名下，红数字不再停在右轨（绿）门口（X-001 空间归属） */}
        <div style={{position: 'absolute', left: 220, top: 845, ...counterIn}}>
          <CountBar label={'轮次'} from={10} to={8} base={10} at={countAt} pulse={pulse} />
        </div>
        <div style={{position: 'absolute', left: 600, top: 845, ...counterIn}}>
          <CountBar label={'落地'} from={7} to={5} base={7} at={countAt + DUR.f3} pulse={pulse} />
        </div>
      </div>

      {/* p3-14 教训金句短卡（关键词化，闪现定格；文案回分镜 SSOT「认内容事实 · 不认派生字段」） */}
      <div style={{position: 'absolute', left: 520, top: 430, width: 880, ...quote}}>
        <Panel accent={theme.warn} style={{padding: '34px 44px', textAlign: 'center'}}>
          <div style={{fontFamily: theme.serif, fontSize: 54, fontWeight: 700, color: theme.warn}}>
            {'认内容事实 · 不认派生字段'}
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
  // 词窗锚 = 句首 + 句长分数（无词级时间戳，比例即词窗；TTS 变更自动重定时）
  const wa = (id: string, f: number) => at(id) + Math.round(dur(id) * f);

  const bA = w('p3-01', 'p3-04');
  const bB = w('p3-05', 'p3-06');
  const bC = w('p3-07', 'p3-08');
  const bD = w('p3-09', 'p3-10');
  const bE = w('p3-11', 'p3-14');

  // —— 3-B 两态词窗：p3-05 整块亮（「一次性返回」0.35）→ p3-06「流式」词（≈0.55）重打；
  //    打完（streamAt 起余窗 62%）再 f6 迟到翻转
  const bulkAt = wa('p3-05', 0.35);
  const streamAt = wa('p3-06', 0.55);
  const typeEnd = streamAt + Math.round((bB.durationInFrames - streamAt) * 0.62);
  const badgeFlipAt = typeEnd + DUR.f6;
  // —— 3-D 词窗链：「灾情和地址」0.4 → 「立刻派出去」0.72；标记落 p3-10 词位
  const chip1At = wa('p3-09', 0.4);
  const dispatchAt = wa('p3-09', 0.72);
  const mark1At = wa('p3-10', 0.55);
  const mark2At = wa('p3-10', 0.7);
  const strikeAt = wa('p3-10', 0.92);
  // 调度台退场：派车事件后一拍（单据滑出+章+车），且先于 p3-10 标记
  const outEnd = Math.min(at('p3-10') - bD.from - DUR.f5, dispatchAt + 50);

  // 幕级缩悬环：M-001 恒定锚跨镜在场；3-E 左轨「提前中断」词窗冻结（环停=误判退出）
  const frame = useCurrentFrame();
  const ringO = useProgress(2, DUR.f5);
  const ringFreeze = wa('p3-13', 0.32) - 0; // act 局部帧（Sequence 外挂载，帧同幕）
  const ringDot =
    ((Math.min(frame / SCENE_RING_LAP, ringFreeze / SCENE_RING_LAP) % 1) + 1) % 1;

  return (
    <AbsoluteFill>
      {/* M-001 缩悬环（Sequence 外，跨五镜不断相；3-E 冻结=提前中断的空间对偶） */}
      <div style={{position: 'absolute', left: SCENE_RING.x, top: SCENE_RING.y, opacity: 0.9 * ringO}}>
        <LoopRing
          size={SCENE_RING.size}
          dotProgress={ringDot}
          nodes={PENT_NODES}
          showLabels={false}
          showExit={false}
        />
      </div>

      <Sequence {...bA} name="3-A">
        <SceneTag chapter={'判据之争'} tagline={'凭什么继续 · 凭什么停'} accent={theme.core} />
        <DuelCards
          at03={at('p3-03') - bA.from}
          litLAt={wa('p3-03', 0.6) - bA.from}
          at04={at('p3-04') - bA.from}
          litRAt={wa('p3-04', 0.75) - bA.from}
          qAt={wa('p3-01', 0.55) - bA.from}
        />
        <Footnote delay={12}>{'stop_reason vs tool_use'}</Footnote>
      </Sequence>

      <Sequence {...bB} name="3-B">
        <StreamLag bulkAt={bulkAt - bB.from} streamAt={streamAt - bB.from} flipAt={badgeFlipAt - bB.from} span={bB.durationInFrames} />
      </Sequence>

      <Sequence {...bC} name="3-C">
        <LagTimeline
          moveDur={Math.round(dur('p3-07') * 0.85)}
          arriveAt={wa('p3-08', 0.45) - bC.from}
          chainAt={wa('p3-08', 0.85) - bC.from}
        />
      </Sequence>

      <Sequence {...bD} name="3-D">
        <FireDispatch
          chip1At={chip1At - bD.from}
          dispatchAt={dispatchAt - bD.from}
          at10={at('p3-10') - bD.from}
          mark1At={mark1At - bD.from}
          mark2At={mark2At - bD.from}
          strikeAt={strikeAt - bD.from}
          outEnd={outEnd}
        />
      </Sequence>

      <Sequence {...bE} name="3-E">
        <AblationCompare
          at12={at('p3-12') - bE.from}
          dur12={dur('p3-12')}
          at11={wa('p3-11', 0.55) - bE.from}
          at13={wa('p3-13', 0.32) - bE.from}
          atLabel={wa('p3-13', 0.85) - bE.from}
          at14={at('p3-14') - bE.from}
        />
        <Footnote delay={12}>{'消融对照 · 只换判据 · 其余全不动'}</Footnote>
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3CriterionDuel;
