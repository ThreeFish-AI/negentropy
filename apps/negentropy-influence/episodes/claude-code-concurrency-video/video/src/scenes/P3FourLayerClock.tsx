/** P3 四层钟（p3-01..31，7 镜 11 cue）——分镜 3-A…3-G。
 *
 *  cue 清单（archify full 全屏独占，一 cue = 一章，dur 求和拼写）：
 *  - 3-A cron-four-layers「四层钟」：four-roles@p3-01(+02) / four-roles@p3-03(+04+05)
 *    ——同实例两 cue 背靠背，换章自动关入场（实例内抑制，非跨实例 lead）
 *  - 3-D cron-dom-dow-or「五段与或门」：and-or@p3-13(+14) / both-ways@p3-15(+16+17)
 *  - 3-E three-safeguards「三道保险」：mark-date@p3-18(+19+20+21) / per-task-guard@p3-22 / double-check@p3-23
 *  - 3-F knock-walk-away「敲门走开」：loop-wake@p3-24(+25) / door-busy@p3-26(+27) / door-open@p3-28
 *  - 3-G cron-four-layers「四层钟」：full-cycle@p3-29(+30+31)
 *    ——与 3-A 同 slug 实例隔 3-D..3-F 多镜（非背靠背）→ 默认 lead
 *  native：3-B 医院四联画 / 3-C 五段表达式。
 *
 *  ★要点：上缘定时线空间分轨——定时线横陈上缘、钟类装置挂其上（与右缘后台线
 *  不叠压，P1-C 首建的轨道在此延续）；原生钟面 svg 指针（秒针每秒 6°＋入场
 *  衰减正弦摆动），零 Lottie；3-B 末「比方到此为止」章（deny 红边）盖在
 *  「加急插队」小字上；3-C 五段格自左点亮＋三行示例上滚（表达式作 mono 角标）。
 *  画面文字只放关键词/数字/标签（RSI-007）；顶部 y<56 空（HarnessBadge 占用）、
 *  SceneTag top:64。
 */
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {theme} from '../design/theme';
import {beatWindow} from '../timing';
import type {SceneRange} from '../types';
import {Footnote, Panel, SceneTag} from '../components/motifs';
import {HarnessBadge} from '../components/harness-stack';
import {ArchifyRecap} from '../components/ArchifyRecap';
import {
  DUR,
  clamp01,
  progress,
  schedule,
  useDim,
  useDraw,
  useEnter,
  useImpulse,
  useProgress,
  useShake,
  useSpring,
  useStagger,
} from '../motion';

/** 「永不触发」锚（让可选动效缺省时不产生条件 hook） */
const FAR = 1e9;

/** hex + 动态透明度（帧驱动；无随机） */
const withAlpha = (hex: string, a: number): string =>
  `${hex}${Math.round(clamp01(a) * 255)
    .toString(16)
    .padStart(2, '0')}`;

// ── 上缘定时线（空间分轨锚：钟类装置挂上缘） ────────────────────────────

const RAIL_X0 = 200;
const RAIL_X1 = 1700; // 1500px = 20 格 × 75px，与刻度严格对齐
const RAIL_Y = 176;
const RAIL_STEP = 75; // 刻度间距（每格＝一秒）

/** 原生钟面：svg 指针。秒针每秒步进 6°，入场以衰减正弦摆动落定（useShake 衰减档）；
 *  时/分针钉在九点整——「每天九点」的视觉回声。 */
const ClockGlyph: React.FC<{cx: number; cy: number; r: number; at: number}> = ({cx, cy, r, at}) => {
  const frame = useCurrentFrame();
  const fade = useProgress(at, DUR.f4);
  const sway = useShake({at, amp: 24, freq: 2.4, decay: true, dur: DUR.f6});
  const secTicks = Math.floor(Math.max(0, frame - at) / 30); // 30fps → 每秒一格
  const secA = secTicks * 6 + sway;
  /** 表针：0° = 12 点方向，顺时针 */
  const hand = (angle: number, len: number, w: number, color: string, tail = 0) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return (
      <line
        x1={cx - Math.cos(rad) * tail}
        y1={cy - Math.sin(rad) * tail}
        x2={cx + Math.cos(rad) * len}
        y2={cy + Math.sin(rad) * len}
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
      />
    );
  };
  return (
    <svg width={1920} height={340} style={{position: 'absolute', left: 0, top: 0}}>
      <g opacity={fade}>
        <circle cx={cx} cy={cy} r={r} fill={theme.bg} stroke={theme.panelBorder} strokeWidth={2.5} />
        {Array.from({length: 12}, (_, i) => {
          const a = ((i * 30 - 90) * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * (r - 8)}
              y1={cy + Math.sin(a) * (r - 8)}
              x2={cx + Math.cos(a) * (r - 3)}
              y2={cy + Math.sin(a) * (r - 3)}
              stroke={theme.dim}
              strokeWidth={2.5}
              opacity={0.8}
            />
          );
        })}
        {hand(270, r * 0.5, 4.5, theme.text)}
        {hand(0, r * 0.72, 3.5, theme.text)}
        {hand(secA, r * 0.8, 2, theme.mech, r * 0.22)}
        <circle cx={cx} cy={cy} r={4} fill={theme.mech} />
      </g>
    </svg>
  );
};

/** 上缘定时线：横陈细轨＋刻度＋每秒一格的巡游脉冲（「每秒看一次表」的轨道化），
 *  钟面自轨下垂挂。后台线走右缘纵深，两线不叠压（本集空间分轨契约）。 */
const TimingRail: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const drawP = useProgress(at, DUR.f5); // 轨道延伸 0..1（useDraw 是 DrawProps 对象，此处需数值进度）
  const fade = useProgress(at, DUR.f4);
  const ticks = Math.round((RAIL_X1 - RAIL_X0) / RAIL_STEP) + 1;
  const step = Math.floor(Math.max(0, frame - at - DUR.f5) / 30);
  const px = RAIL_X0 + RAIL_STEP * (step % (ticks - 1));
  const clockCx = 1440;
  const clockCy = RAIL_Y + 18 + 52;
  return (
    <>
      <svg width={1920} height={340} style={{position: 'absolute', left: 0, top: 0}}>
        <line
          x1={RAIL_X0}
          y1={RAIL_Y}
          x2={RAIL_X0 + (RAIL_X1 - RAIL_X0) * drawP}
          y2={RAIL_Y}
          stroke={theme.panelBorder}
          strokeWidth={2.5}
        />
        {Array.from({length: ticks}, (_, i) => (
          <line
            key={i}
            x1={RAIL_X0 + i * RAIL_STEP}
            y1={RAIL_Y - 6}
            x2={RAIL_X0 + i * RAIL_STEP}
            y2={RAIL_Y + 6}
            stroke={theme.dim}
            strokeWidth={2}
            opacity={0.5 * fade}
          />
        ))}
        {/* 垂挂钟面的短茎 */}
        <line x1={clockCx} y1={RAIL_Y} x2={clockCx} y2={clockCy - 52} stroke={theme.panelBorder} strokeWidth={2} />
        {/* 每秒巡游脉冲 */}
        <circle cx={px} cy={RAIL_Y} r={5.5} fill={theme.mech} opacity={fade} />
      </svg>
      <ClockGlyph cx={clockCx} cy={clockCy} r={52} at={at + DUR.f4} />
    </>
  );
};

// ── 3-B 医院四联画（native svg 简笔） ────────────────────────────────────

const QUAD = [
  {name: '排班表', role: '判时'},
  {name: '候诊屏', role: '缓冲'},
  {name: '护士', role: '交付'},
  {name: '医生', role: '执行'},
] as const;
const QUAD_W = 336;
const QUAD_GAP = 36;
const QUAD_X0 = Math.round((1920 - (QUAD.length * QUAD_W + (QUAD.length - 1) * QUAD_GAP)) / 2);
const QUAD_Y = 330;
const QUAD_H = 430;
const quadX = (i: number): number => QUAD_X0 + i * (QUAD_W + QUAD_GAP);
const quadCx = (i: number): number => quadX(i) + QUAD_W / 2;

/** 排班表简笔：三行时刻，首行（九点）mech 高亮——「排班表定几点看谁」 */
const ScheduleBoardGlyph: React.FC<{at: number}> = ({at}) => {
  const rows = useStagger(3, {at: at + 6, dur: DUR.f3, stride: 6});
  return (
    <svg width={208} height={214}>
      <rect x={4} y={8} width={200} height={198} rx={10} fill={theme.bg} stroke={theme.panelBorder} strokeWidth={2} />
      {['09:00', '12:00', '17:00'].map((t, i) => (
        <g key={t} opacity={rows[i]}>
          <rect
            x={22}
            y={34 + i * 56}
            width={164}
            height={40}
            rx={6}
            fill={i === 0 ? withAlpha(theme.mech, 0.12) : 'transparent'}
            stroke={i === 0 ? theme.mechDeep : theme.panelBorder}
            strokeWidth={i === 0 ? 2 : 1.4}
          />
          <text
            x={104}
            y={61 + i * 56}
            textAnchor="middle"
            fontSize={24}
            fontFamily={theme.mono}
            fill={i === 0 ? theme.mech : theme.dim}
          >
            {t}
          </text>
        </g>
      ))}
    </svg>
  );
};

/** 候诊屏简笔：大号当前叫号＋下一号——「候诊屏排队」 */
const WaitingScreenGlyph: React.FC<{at: number}> = ({at}) => {
  const now = useProgress(at + 8, DUR.f4);
  const next = useProgress(at + 16, DUR.f4);
  return (
    <svg width={208} height={214}>
      <rect x={4} y={14} width={200} height={186} rx={10} fill={theme.bg} stroke={theme.mechDeep} strokeWidth={2} />
      <circle cx={104} cy={34} r={5} fill={theme.mech} opacity={now} />
      <text x={104} y={112} textAnchor="middle" fontSize={56} fontFamily={theme.mono} fill={theme.text} opacity={now}>
        {'A31'}
      </text>
      <text x={104} y={160} textAnchor="middle" fontSize={22} fontFamily={theme.mono} fill={theme.dim} opacity={next}>
        {'下一号 A32'}
      </text>
    </svg>
  );
};

/** 护士简笔：护士帽＋「叫人」手势一拍（手臂 spring 抬起＋声弧 impulse） */
const NurseGlyph: React.FC<{callAt: number}> = ({callAt}) => {
  const call = useImpulse({at: callAt, dur: DUR.f5, peak: 1});
  const arm = useSpring('settle', {at: callAt, dur: DUR.f5});
  return (
    <svg width={208} height={214} style={{overflow: 'visible'}}>
      <circle cx={92} cy={52} r={22} fill={theme.text} />
      <path d="M70 40 L114 40 L92 22 Z" fill={theme.mech} />
      <path d="M54 196 Q54 96 92 92 Q130 96 130 196 Z" fill={theme.text} />
      <line
        x1={122}
        y1={116}
        x2={124 + 42 * arm}
        y2={132 - 56 * arm}
        stroke={theme.text}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <path d="M178 60 a16 16 0 0 1 8 13" fill="none" stroke={theme.mech} strokeWidth={3} opacity={call} />
      <path d="M186 50 a28 28 0 0 1 14 22" fill="none" stroke={theme.mech} strokeWidth={3} opacity={call * 0.7} />
    </svg>
  );
};

/** 医生简笔：听诊器＋接诊脉冲圈（护士叫人后一拍） */
const DoctorGlyph: React.FC<{seeAt: number}> = ({seeAt}) => {
  const frame = useCurrentFrame();
  const see = Math.sin(Math.PI * progress(frame, seeAt, DUR.f5));
  return (
    <svg width={208} height={214}>
      <circle cx={104} cy={120} r={72} fill="none" stroke={theme.mech} strokeWidth={2.5} opacity={see} />
      <circle cx={104} cy={52} r={22} fill={theme.text} />
      <path d="M66 196 Q66 96 104 92 Q142 96 142 196 Z" fill={theme.text} />
      <circle cx={118} cy={150} r={9} fill="none" stroke={theme.mech} strokeWidth={3} opacity={0.9} />
      <path d="M92 108 Q98 132 118 141" fill="none" stroke={theme.mech} strokeWidth={3} />
    </svg>
  );
};

/** 四联画格：panel 底＋简笔＋名称＋角色 chip；点亮时边框 mech 一拍，可挂高亮/压暗锚 */
const QuadPanel: React.FC<{
  index: number;
  litAt: number;
  name: string;
  role: string;
  dimAt?: number;
  hotAt?: number[];
  children?: React.ReactNode;
}> = ({index, litAt, name, role, dimAt = FAR, hotAt = [], children}) => {
  const enter = useEnter('rise', {at: litAt, dur: DUR.f5, dist: 40, springPreset: 'settle', restBottom: QUAD_Y + QUAD_H});
  const dim = useDim({at: dimAt, to: 0.55, dur: DUR.f4});
  const frame = useCurrentFrame();
  const pulse = (t: number): number => Math.sin(Math.PI * progress(frame, t, DUR.f5));
  const glow = Math.max(pulse(litAt + DUR.f4), ...hotAt.map(pulse));
  return (
    <div
      style={{
        position: 'absolute',
        left: quadX(index),
        top: QUAD_Y,
        width: QUAD_W,
        height: QUAD_H,
        opacity: dim * enter.opacity,
        transform: enter.transform,
      }}
    >
      <Panel style={{width: '100%', height: '100%', padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{height: 214}}>{children}</div>
        <div style={{marginTop: 16, fontFamily: theme.sans, fontSize: 32, fontWeight: 700, color: theme.text}}>{name}</div>
        <div
          style={{
            marginTop: 14,
            padding: '6px 20px',
            borderRadius: 999,
            border: `2px solid ${theme.mech}`,
            fontFamily: theme.mono,
            fontSize: 21,
            color: theme.mech,
          }}
        >
          {role}
        </div>
      </Panel>
      {/* mech 高亮描边（点亮一拍 / 叫人与落活两次热身） */}
      <div
        style={{
          position: 'absolute',
          inset: -2,
          borderRadius: 16,
          border: `3px solid ${theme.mech}`,
          opacity: Math.max(glow, 0),
        }}
      />
    </div>
  );
};

/** 3-B 镜：四联画逐格点亮 → 护士叫人/医生接诊 → 盖章失配拦截 → 取活开工 */
const HospitalQuad: React.FC<{a06: number; a07: number; a08: number; a09: number}> = ({a06, a07, a08, a09}) => {
  // 逐格点亮：p3-06 排班表+候诊屏；p3-07 护士+医生
  const lit = [a06 + 3, a06 + 12, a07 + 3, a07 + 12];
  const nurseCallAt = lit[2] + DUR.f4;
  const doctorSeeAt = lit[3] + DUR.f4;
  // 「加急插队」小字先现 → 章（deny 红边）spring 下落盖住 → 落章衰减抖动
  const urg = useEnter('pop', {at: a08, dur: DUR.f4});
  const stampDrop = useSpring('snap', {at: a08 + DUR.f3, dur: DUR.f5});
  const stampInk = useProgress(a08 + DUR.f3 + DUR.f4, DUR.f4);
  const impact = useShake({at: a08 + DUR.f3 + DUR.f5 + 2, amp: 6, freq: 1.3, decay: true, dur: DUR.f5});
  // p3-09 取活开工：A31 号牌自候诊屏弧线飞向医生，落位弹「开工」
  const fly = useProgress(a09 + 4, DUR.f6, 'decelerate');
  const chipIn = useProgress(a09 + 4, 3);
  const flyEnd = a09 + 4 + DUR.f6;
  const workTag = useEnter('pop', {at: flyEnd, dur: DUR.f4});
  const chipX = quadCx(1) + (quadCx(3) - quadCx(1)) * fly;
  const chipY = 548 - 70 * Math.sin(Math.PI * fly);
  const chipOut = fly >= 0.98 ? 1 - (fly - 0.98) / 0.02 : 1;
  return (
    <AbsoluteFill>
      <SceneTag chapter="四层钟" tagline="医院类比 · 四联画" accent={theme.mech} />
      <TimingRail at={a06} />

      <QuadPanel index={0} litAt={lit[0]} name="排班表" role="判时" dimAt={a09}>
        <ScheduleBoardGlyph at={lit[0]} />
      </QuadPanel>
      <QuadPanel index={1} litAt={lit[1]} name="候诊屏" role="缓冲" dimAt={a09}>
        <WaitingScreenGlyph at={lit[1]} />
      </QuadPanel>
      <QuadPanel index={2} litAt={lit[2]} name="护士" role="交付" dimAt={a09} hotAt={[nurseCallAt]}>
        <NurseGlyph callAt={nurseCallAt} />
      </QuadPanel>
      <QuadPanel index={3} litAt={lit[3]} name="医生" role="执行" hotAt={[doctorSeeAt, flyEnd]}>
        <DoctorGlyph seeAt={doctorSeeAt} />
      </QuadPanel>

      {/* 失配拦截：医院能加急插队、教学版队列不能——章落其上（RSI-007：只关键词） */}
      <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `translateX(${impact}px)`}}>
        <div style={{position: 'absolute', left: quadCx(1) - 220, top: 572, width: 440, textAlign: 'center', ...urg}}>
          <span style={{fontFamily: theme.sans, fontSize: 26, color: theme.deny}}>{'加急插队'}</span>
        </div>
        <div
          style={{
            position: 'absolute',
            left: quadCx(1) - 215,
            top: 540,
            width: 430,
            height: 100,
            opacity: stampInk,
            transform: `rotate(-7deg) scale(${1.7 - 0.7 * stampDrop})`,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 12,
              border: `4px solid ${theme.deny}`,
              background: withAlpha(theme.bg, 0.86),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{fontFamily: theme.serif, fontSize: 44, fontWeight: 700, color: theme.deny, letterSpacing: 6}}>
              {'比方到此为止'}
            </span>
          </div>
        </div>
      </div>

      {/* 取活开工：A31 号牌弧线飞行（定时消息 → 执行） */}
      <div
        style={{
          position: 'absolute',
          left: chipX - 62,
          top: chipY - 26,
          width: 124,
          height: 52,
          borderRadius: 8,
          border: `2px solid ${theme.mech}`,
          background: withAlpha(theme.panel, 0.9),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: chipIn * chipOut,
        }}
      >
        <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.mech}}>{'A31'}</span>
      </div>
      <div style={{position: 'absolute', left: quadCx(3) - 62, top: 706, width: 124, textAlign: 'center', ...workTag}}>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 24,
            color: theme.mech,
            padding: '6px 18px',
            borderRadius: 8,
            border: `2px solid ${theme.mech}`,
          }}
        >
          {'开工'}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ── 3-C 五段表达式（native） ──────────────────────────────────────────────

const FIELDS = ['分', '时', '日', '月', '星期'] as const;
const EXAMPLES = [
  {expr: '0 9 * * *', label: '每天九点', vals: ['0', '9', '*', '*', '*']},
  {expr: '*/5 * * * *', label: '每五分钟', vals: ['*/5', '*', '*', '*', '*']},
  {expr: '0 9 * * 1-5', label: '工作日九点', vals: ['0', '9', '*', '*', '1-5']},
] as const;
const SYNTAX = [
  {sym: '9', label: '数字定死'},
  {sym: '*', label: '星号任意'},
  {sym: '1-5', label: '范围'},
  {sym: '*/5', label: '间隔'},
] as const;

const CELL_W = 176;
const CELL_GAP = 24;
const CELL_X0 = Math.round((1920 - (FIELDS.length * CELL_W + (FIELDS.length - 1) * CELL_GAP)) / 2);
const CELL_Y = 356;
const CELL_H = 150;

/** 五段格：当前值（示例行落位时切换并 mech 闪一拍）＋字段名 */
const ExprCell: React.FC<{litP: number; value: string; field: string; left: number; flashAt: number[]}> = ({
  litP,
  value,
  field,
  left,
  flashAt,
}) => {
  const frame = useCurrentFrame();
  const flash = flashAt.reduce((m, t) => Math.max(m, Math.sin(Math.PI * progress(frame, t, DUR.f4))), 0);
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: CELL_Y,
        width: CELL_W,
        height: CELL_H,
        opacity: litP,
        transform: `translateY(${(1 - litP) * 24}px)`,
      }}
    >
      <Panel
        accent={flash > 0.15 ? theme.mech : theme.panelBorder}
        style={{width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10}}
      >
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: value.length >= 3 ? 34 : 44,
            color: flash > 0.15 ? theme.mech : theme.text,
          }}
        >
          {value}
        </span>
        <span style={{fontFamily: theme.sans, fontSize: 24, color: theme.dim}}>{field}</span>
      </Panel>
    </div>
  );
};

/** 3-C 镜：五段格自左点亮 → 语法形态 chips → 三行示例上滚（格值随之切换） */
const FiveExpr: React.FC<{a10: number; a11: number; a12: number; end10: number; end12: number}> = ({
  a10,
  a11,
  a12,
  end10,
  end12,
}) => {
  const frame = useCurrentFrame();
  const lit = useStagger(5, {at: a10 + 4, dur: DUR.f4, fit: {total: Math.max(15, end10 - 16)}});
  const chips = useStagger(SYNTAX.length, {at: a11 + 3, dur: DUR.f4, stride: 8});
  const chipsDim = useDim({at: a12, to: 0.45, dur: DUR.f4});
  // 示例行上滚：fit 进 p3-12 句窗；plan 与 stagger 同源 → 落位帧可直接推导格值切换
  const rowsPlan = schedule(3, {dur: DUR.f5, fit: {total: Math.max(24, end12 - 16)}});
  const rows = useStagger(3, {at: a12 + 6, dur: DUR.f5, fit: {total: Math.max(24, end12 - 16)}});
  const lands = rowsPlan.starts.map((s) => a12 + 6 + s + DUR.f5);
  const active = lands.reduce((acc, t, i) => (frame >= t ? i : acc), -1);
  const cur = active < 0 ? ['*', '*', '*', '*', '*'] : EXAMPLES[active].vals;
  // 每格记录「值发生变化的落位帧」，供闪一拍
  const flashAt: number[][] = FIELDS.map((_, j) => {
    const times: number[] = [];
    let prev = '*';
    for (let i = 0; i < EXAMPLES.length; i++) {
      if (EXAMPLES[i].vals[j] !== prev) times.push(lands[i]);
      prev = EXAMPLES[i].vals[j];
    }
    return times;
  });
  return (
    <AbsoluteFill>
      <SceneTag chapter="四层钟" tagline="定时表达式 · 五段" accent={theme.mech} />
      <TimingRail at={a10} />

      {FIELDS.map((f, j) => (
        <ExprCell key={f} litP={lit[j]} value={cur[j]} field={f} left={CELL_X0 + j * (CELL_W + CELL_GAP)} flashAt={flashAt[j]} />
      ))}

      {/* 语法形态（p3-11）：符号＋关键词；示例行进场后压暗让位 */}
      <div style={{position: 'absolute', left: 0, top: 534, width: 1920, display: 'flex', justifyContent: 'center', gap: 20, opacity: chipsDim}}>
        {SYNTAX.map((s, i) => (
          <div
            key={s.sym}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 18px',
              borderRadius: 8,
              background: theme.panel,
              border: `2px solid ${theme.panelBorder}`,
              opacity: chips[i],
            }}
          >
            <span style={{fontFamily: theme.mono, fontSize: 26, color: theme.mech}}>{s.sym}</span>
            <span style={{fontFamily: theme.sans, fontSize: 20, color: theme.dim}}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* 三行示例上滚（p3-12）：表达式 mono ＋关键词；当前行 mech 描边 */}
      {EXAMPLES.map((ex, i) => (
        <div
          key={ex.expr}
          style={{
            position: 'absolute',
            left: CELL_X0,
            top: 596 + i * 88,
            width: FIELDS.length * CELL_W + (FIELDS.length - 1) * CELL_GAP,
            opacity: rows[i],
            transform: `translateY(${(1 - rows[i]) * 76}px)`,
          }}
        >
          <Panel
            accent={i === active ? theme.mech : theme.panelBorder}
            style={{width: '100%', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 34px'}}
          >
            <span style={{fontFamily: theme.mono, fontSize: 34, color: theme.text, letterSpacing: 2}}>{ex.expr}</span>
            <span style={{fontFamily: theme.sans, fontSize: 26, color: i === active ? theme.text : theme.dim}}>{ex.label}</span>
          </Panel>
        </div>
      ))}

      <Footnote delay={a12 + 8}>{'0 9 * * *  ·  */5 * * * *  ·  0 9 * * 1-5'}</Footnote>
    </AbsoluteFill>
  );
};

// ── 幕组装 ──────────────────────────────────────────────────────────────

export const P3FourLayerClock: React.FC<{scene: SceneRange}> = ({scene}) => {
  const w = (fromId: string, toId?: string) => beatWindow(scene.sentences, scene.from, fromId, toId);
  const at = (id: string) => w(id).from;
  const dur = (id: string) => w(id).durationInFrames;

  const bA = w('p3-01', 'p3-05');
  const bB = w('p3-06', 'p3-09');
  const bC = w('p3-10', 'p3-12');
  const bD = w('p3-13', 'p3-17');
  const bE = w('p3-18', 'p3-23');
  const bF = w('p3-24', 'p3-28');
  const bG = w('p3-29', 'p3-31');

  return (
    <AbsoluteFill>
      <HarnessBadge />

      <Sequence {...bA} name="3-A 四层总装">
        {/* 实例内两 cue 背靠背 → 换章自动关入场（ArchifyRecap 实例内抑制） */}
        <ArchifyRecap
          slug="cron-four-layers"
          caption="四层钟"
          cues={[
            {chapterId: 'four-roles', at: at('p3-01') - bA.from, durationInFrames: dur('p3-01') + dur('p3-02')},
            {chapterId: 'four-roles', at: at('p3-03') - bA.from, durationInFrames: dur('p3-03') + dur('p3-04') + dur('p3-05')},
          ]}
        />
      </Sequence>

      <Sequence {...bB} name="3-B 医院四联画">
        <HospitalQuad
          a06={at('p3-06') - bB.from}
          a07={at('p3-07') - bB.from}
          a08={at('p3-08') - bB.from}
          a09={at('p3-09') - bB.from}
        />
      </Sequence>

      <Sequence {...bC} name="3-C 五段表达式">
        <FiveExpr
          a10={at('p3-10') - bC.from}
          a11={at('p3-11') - bC.from}
          a12={at('p3-12') - bC.from}
          end10={at('p3-11') - at('p3-10')}
          end12={bC.durationInFrames - (at('p3-12') - bC.from)}
        />
      </Sequence>

      <Sequence {...bD} name="3-D 或门反直觉">
        {/* 3-C native 之后首挂 → 默认 lead；实例内两 cue 背靠背自动抑制 */}
        <ArchifyRecap
          slug="cron-dom-dow-or"
          caption="五段与或门"
          cues={[
            {chapterId: 'and-or', at: at('p3-13') - bD.from, durationInFrames: dur('p3-13') + dur('p3-14')},
            {chapterId: 'both-ways', at: at('p3-15') - bD.from, durationInFrames: dur('p3-15') + dur('p3-16') + dur('p3-17')},
          ]}
        />
      </Sequence>

      <Sequence {...bE} name="3-E 三道保险">
        {/* 与 3-D 不同 slug、非背靠背 → 默认 lead；三 cue 连续换章自动抑制 */}
        <ArchifyRecap
          slug="three-safeguards"
          caption="三道保险"
          cues={[
            {chapterId: 'mark-date', at: at('p3-18') - bE.from, durationInFrames: dur('p3-18') + dur('p3-19') + dur('p3-20') + dur('p3-21')},
            {chapterId: 'per-task-guard', at: at('p3-22') - bE.from, durationInFrames: dur('p3-22')},
            {chapterId: 'double-check', at: at('p3-23') - bE.from, durationInFrames: dur('p3-23')},
          ]}
        />
      </Sequence>

      <Sequence {...bF} name="3-F 敲门走开">
        <ArchifyRecap
          slug="knock-walk-away"
          caption="敲门走开"
          cues={[
            {chapterId: 'loop-wake', at: at('p3-24') - bF.from, durationInFrames: dur('p3-24') + dur('p3-25')},
            {chapterId: 'door-busy', at: at('p3-26') - bF.from, durationInFrames: dur('p3-26') + dur('p3-27')},
            {chapterId: 'door-open', at: at('p3-28') - bF.from, durationInFrames: dur('p3-28')},
          ]}
        />
      </Sequence>

      <Sequence {...bG} name="3-G 全周期走查">
        {/* 与 3-A 同 slug 实例隔 3-D..3-F 多镜（非背靠背）→ 默认 lead */}
        <ArchifyRecap
          slug="cron-four-layers"
          caption="四层钟"
          cues={[
            {chapterId: 'full-cycle', at: at('p3-29') - bG.from, durationInFrames: dur('p3-29') + dur('p3-30') + dur('p3-31')},
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export default P3FourLayerClock;
