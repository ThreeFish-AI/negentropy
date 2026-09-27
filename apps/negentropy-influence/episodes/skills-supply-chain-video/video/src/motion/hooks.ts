/** 运动模型（hooks）——分镜「动效」列动词到帧数学的唯一映射。
 *
 * 设计约束（违反任何一条即失去本层存在意义）：
 * 1. hooks 返回数值 / CSS 片段，不渲染 DOM——FadeUp 式包装组件打不进 svg/<g>/
 *    absolute 布局，是「组件存在却零调用」的实测根因；数值可落进任意 JSX。
 * 2. 弹簧一律吃局部帧（frame - at）：spring() 每次调用从第 0 帧重模拟，喂全局帧
 *    会让长片末帧每个 spring 跑两万余次迭代。
 * 3. effects（不透明度/颜色）永不吃弹簧——一律时长+缓动（tokens 的二分不变量）。
 * 4. 不读 theme：颜色一律经参数传入（frozen 跨系列共享的前提）。
 * 5. `at` 锚点一律来自句边界（rel(beat, '句id')），禁写死帧数。
 */
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  DUR,
  EASING_CP,
  SPRING,
  clampRiseDist,
  type DurToken,
  type EasingToken,
  type SpringPreset,
} from './tokens';
import {progress, revealCharCount} from './window';
import {schedule, type ScheduleOpts} from './schedule';

/** 帧数解析：token 或直接帧数；缺省用 def。 */
export const frames = (d: number | DurToken | undefined, def: number): number =>
  d === undefined ? def : typeof d === 'number' ? d : DUR[d];

/** 缓动令牌 → Remotion 缓动函数（linear 直通）。 */
export const easeF = (t: EasingToken): ((x: number) => number) =>
  t === 'linear'
    ? Easing.linear
    : Easing.bezier(
        ...(EASING_CP[t] as [number, number, number, number]),
      );

/** 缓动后的 0..1 进度（各模型共用的原子）。 */
const eased = (
  frame: number,
  at: number,
  dur: number,
  e: EasingToken,
): number => interpolate(progress(frame, at, dur), [0, 1], [0, 1], {easing: easeF(e)});

/** 缓动数值进度——「clamped 0→1 手写 interpolate」惯用形的统一替身：
 *  时机值走 token，缓动默认 standard（线性原版会被这一档替换——质量提升点之一）。 */
export function useProgress(
  at: number,
  dur: number | DurToken = DUR.f5,
  easing: EasingToken = 'standard',
): number {
  const frame = useCurrentFrame();
  return eased(frame, at, frames(dur, DUR.f5), easing);
}

/** 弹簧数值进度（驱动几何量/位移；effects 通道用 useProgress——tokens 二分不变量）。
 *  局部帧 + 可选 durationInFrames 截停（防窗口外余振；缺省不设上限，与既有手写等价）。 */
export function useSpring(
  preset: SpringPreset,
  o: {at?: number; dur?: number | DurToken} = {},
): number {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cfg: Parameters<typeof spring>[0] = {
    frame: frame - (o.at ?? 0),
    fps,
    config: SPRING[preset],
  };
  if (o.dur !== undefined) {
    cfg.durationInFrames = frames(o.dur, DUR.f5);
  }
  return spring(cfg);
}

// ── 入场（enter：落下/上浮/滑入/弹出/飞入/淡入） ────────────────────────

export type EnterKind = 'fall' | 'rise' | 'slideL' | 'slideR' | 'pop' | 'flyIn' | 'fade';
export type EnterOpts = {
  /** 句边界锚（局部帧）。 */
  at?: number;
  dur?: number | DurToken;
  easing?: EasingToken;
  /** 空间通道用弹簧（位移类才有意义；fade/pop 无效）。 */
  springPreset?: SpringPreset;
  /** 位移像素（fall/rise/slide*；缺省 30）。 */
  dist?: number;
  /** rise 专用：落位态底边 y——行程经 clampRiseDist 钳进字幕安全带之上。 */
  restBottom?: number;
};
export type EnterStyle = {opacity: number; transform: string};

export function useEnter(kind: EnterKind, o: EnterOpts = {}): EnterStyle {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const at = o.at ?? 0;
  const dur = frames(o.dur, DUR.f4);
  let dist = o.dist ?? 30;
  if (kind === 'rise' && o.restBottom !== undefined) {
    dist = clampRiseDist(dist, o.restBottom);
  }
  // effects 通道：纯缓动、略快于空间通道（元素先「看见」再「落位」）
  const opacity = progress(frame, at, Math.max(2, Math.round(dur * 0.8)));
  // spatial 通道：可选弹簧（局部帧 + durationInFrames 截停，防窗口外余振）
  const p = o.springPreset
    ? spring({
        frame: frame - at,
        fps,
        config: SPRING[o.springPreset],
        durationInFrames: dur,
      })
    : eased(frame, at, dur, o.easing ?? 'standard');
  const inv = 1 - p;
  const t: string[] = [];
  if (kind === 'fall') t.push(`translateY(${-inv * dist}px)`);
  if (kind === 'rise') t.push(`translateY(${inv * dist}px)`);
  if (kind === 'slideL') t.push(`translateX(${-inv * dist}px)`);
  if (kind === 'slideR') t.push(`translateX(${inv * dist}px)`);
  if (kind === 'pop') t.push(`scale(${0.9 + 0.1 * p})`);
  if (kind === 'flyIn') t.push(`scale(${0.6 + 0.4 * p})`);
  return {opacity, transform: t.length ? t.join(' ') : 'none'};
}

// ── 序列错峰（stagger：依次/逐行/逐条/逐格） ───────────────────────────

export type StaggerOpts = ScheduleOpts & {at?: number; easing?: EasingToken};

/** 返回 n 个 0..1 进度——第 i 项随编排依次入场。 */
export function useStagger(n: number, o: StaggerOpts = {}): number[] {
  const frame = useCurrentFrame();
  const {at = 0, easing = 'standard'} = o;
  const plan = schedule(n, o);
  return plan.starts.map((s) => eased(frame, at + s, plan.dur, easing));
}

// ── 描线（draw：红线三由构造保证——只产 pathLength 归一化三元组） ────────

export type DrawProps = {pathLength: 1; strokeDasharray: 1; strokeDashoffset: number};

export function useDraw(at: number, dur: number | DurToken = DUR.f5): DrawProps {
  const frame = useCurrentFrame();
  const p = eased(frame, at, frames(dur, DUR.f5), 'decelerate');
  return {pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p};
}

// ── 脉冲 / 呼吸（glow 语法：impulse=一次性强调，breathe=持续辉光） ───────

/** 一次性冲击：sin(πp) 包络，起于 0 归于 0，峰值 peak。 */
export function useImpulse(o: {at?: number; dur?: number | DurToken; peak?: number} = {}): number {
  const frame = useCurrentFrame();
  const p = progress(frame, o.at ?? 0, frames(o.dur, DUR.f5));
  return Math.sin(Math.PI * p) * (o.peak ?? 1);
}

/** 持续呼吸（原 0.55+0.45·sin(frame/K) 散写的收敛；period 帧一周期——注意与
 *  原除数 K 的换算 period = 2πK，如 sin(frame/26) → period 163）。offset 为相位
 *  平移（错峰辉光的 per-index 形态）。 */
export function useBreathe(
  o: {period?: number; amp?: number; base?: number; offset?: number} = {},
): number {
  const frame = useCurrentFrame();
  const {amp = 0.45, base = 0.55, period = 26, offset = 0} = o;
  return base + amp * Math.sin((2 * Math.PI * (frame - offset)) / period);
}

// ── 巡游（travel：环形为主；absorb 原 useRingDot 与加速绕行累加器克隆） ──

export type TravelPos = {x: number; y: number; angle: number};

/** 匀速环形巡游（angle 单位度，-90 = 12 点方向起）。 */
export function useTravel(o: {
  cx: number;
  cy: number;
  r: number;
  secPerLap?: number;
  offset?: number;
}): TravelPos {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lap = (frame / (fps * (o.secPerLap ?? 2.5)) + (o.offset ?? 0)) % 1;
  const a = -90 + lap * 360;
  const rad = (a * Math.PI) / 180;
  return {x: o.cx + o.r * Math.cos(rad), y: o.cy + o.r * Math.sin(rad), angle: a};
}

/** 加速绕行：逐圈时长 durs[]（如 [40,30,22,16]），跑完全部圈后冻结在终点。
 *  heat 0..1 随圈数推进（「失控感」的配色偏移系数）。 */
export function useAccelTravel(o: {
  cx: number;
  cy: number;
  r: number;
  durs: number[];
  at?: number;
  heatPerLap?: number;
}): {x: number; y: number; heat: number} {
  const frame = useCurrentFrame();
  let t = Math.max(0, frame - (o.at ?? 0));
  let lap = 0;
  while (lap < o.durs.length && t >= o.durs[lap]) {
    t -= o.durs[lap];
    lap += 1;
  }
  const within = lap >= o.durs.length ? 1 : t / o.durs[lap];
  const heat = Math.min(1, lap / (o.heatPerLap ?? o.durs.length));
  const a = -90 + within * 360;
  const rad = (a * Math.PI) / 180;
  return {x: o.cx + o.r * Math.cos(rad), y: o.cy + o.r * Math.sin(rad), heat};
}

// ── 计数 / 水位（meter 语法；显示层自行 Math.round / toFixed） ──────────

export function useCount(o: {
  from?: number;
  to: number;
  at?: number;
  dur?: number | DurToken;
  ease?: EasingToken;
}): number {
  const frame = useCurrentFrame();
  const {from = 0, to, at = 0} = o;
  const p = eased(frame, at, frames(o.dur, DUR.f6), o.ease ?? 'standard');
  return from + (to - from) * p;
}

// ── 打字机 / 逐字流出（type；Terminal 之外的泛化） ──────────────────────

export function useReveal(
  text: string,
  o: {at?: number; cps?: number; framesPerChar?: number} = {},
): string {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const elapsed = Math.max(0, frame - (o.at ?? 0));
  const n = revealCharCount(elapsed, fps, o.cps ?? 12, o.framesPerChar);
  return text.slice(0, Math.min(text.length, n));
}

// ── 镜头推近（pushIn 语法：beat 切换的镜头语言，替代纯淡入） ────────────

export function usePushIn(at: number, o: {scale?: number; dur?: number | DurToken} = {}): string {
  const frame = useCurrentFrame();
  const p = eased(frame, at, frames(o.dur, DUR.f5), 'decelerate');
  return `scale(${1 + (o.scale ?? 0.06) * p})`;
}

// ── 压暗 / 提亮（emphasis 反向：让主体从群像中浮出） ─────────────────────

/** 返回目标透明度系数（1 = 原；to 0.4 即压暗到 40%）。 */
export function useDim(o: {at: number; to?: number; dur?: number | DurToken}): number {
  const frame = useCurrentFrame();
  const p = eased(frame, o.at, frames(o.dur, DUR.f4), 'standard');
  return 1 + ((o.to ?? 0.4) - 1) * p;
}

// ── 流光（flow 语法：连线上的行进虚线） ─────────────────────────────────

/** 返回可直接展开到 <line>/<path> 的描边属性（像素 dasharray——与 draw 的
 *  pathLength 归一化描线是两个正交特性，勿混用于同一元素：红线三）。 */
export function useFlowDash(o: {
  dash?: number;
  gap?: number;
  /** 帧速率：每 period 帧行进一个 dash+gap 周期。 */
  period?: number;
}): {strokeDasharray: string; strokeDashoffset: number} {
  const frame = useCurrentFrame();
  const {dash = 10, gap = 14, period = 40} = o;
  return {
    strokeDasharray: `${dash} ${gap}`,
    strokeDashoffset: -(frame * (dash + gap)) / period,
  };
}

// ── 抖动（错误/故障语义；收敛 P2/P3 两处克隆） ──────────────────────────

/** 返回 translateX 像素值。active 缺省 true；decay=true 时按 dur 衰减归零。 */
export function useShake(o: {
  at: number;
  active?: boolean;
  amp?: number;
  /** 相位分母（原手写 /1.6、/2.2 的口径）。 */
  freq?: number;
  decay?: boolean;
  dur?: number | DurToken;
}): number {
  const frame = useCurrentFrame();
  const {amp = 3, freq = 1.6} = o;
  const t = frame - o.at;
  if (o.active === false || t < 0) {
    return 0;
  }
  if (o.decay) {
    const env = 1 - progress(frame, o.at, frames(o.dur, DUR.f5));
    return amp * env * Math.sin(t / freq);
  }
  return amp * Math.sin(t / freq);
}

// ── 片尾渐黑（红线四：从 beat 总时长推导，勿用末句时长） ────────────────

export function useFadeOut(durationInFrames: number, o: {frames?: number} = {}): number {
  const frame = useCurrentFrame();
  const f = o.frames ?? 36; // 1.2s
  return 1 - progress(frame, durationInFrames - f, f);
}
