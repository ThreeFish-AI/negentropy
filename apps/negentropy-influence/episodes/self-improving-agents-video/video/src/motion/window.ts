/** 运动窗口纯函数——「父级持有绝对时间，子动画只是父进度上的窗口」。
 *
 * 这是 audio-first 时序与可复用运动模型兼容的核心机制：beat 的绝对帧来自
 * beatWindow()（数据源是 TTS 实测 manifest），子动画不写死帧数、只声明自己在
 * beat 进度上的 [start, end] 窗口 ⇒ 旁白实测时长变化时全部窗口自动重定时，
 * 「写死帧数与口播脱钩」缺陷类（skills/08 实录）由构造消灭。
 *
 * 语义借 MDC TransitionUtils.lerp(startFraction, endFraction)：窗外钳制端点。
 * 本模块零依赖（不 import remotion / theme）——frozen 跨系列共享与 node 单测的前提。
 */

/** 钳制到 [0,1]——一切进度的唯一出口，防负值/超 1 渗进 transform。 */
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** 子动画窗口：父进度 p(0..1) 在 [s,e] 片段上的局部进度。 */
export const win = (p: number, w: readonly [number, number]): number =>
  clamp01((p - w[0]) / (w[1] - w[0]));

/** beat 进度：局部帧 → 该 beat 的 0..1 进度。 */
export const beatProgress = (
  frame: number,
  from: number,
  durationInFrames: number,
): number => clamp01((frame - from) / Math.max(1, durationInFrames));

/** 帧域进度：[at, at+dur] 上的 0..1（dur ≤ 0 视作 1，防除零）。 */
export const progress = (frame: number, at: number, dur: number): number =>
  clamp01((frame - at) / Math.max(1, dur));
