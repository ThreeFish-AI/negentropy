/** 错峰编排（stagger）纯函数——收敛手写 `frame - i*N`（跨 8 集约 356 处、
 *  步长 K∈{2,3,4,5,6,8,10} 任意取值、无节奏标尺）。
 *
 * 三种模式（互斥，参数即文档）：
 * - stride：固定步长（与旧手写行为一致——迁移期的保守选项）；
 * - lag：Manim LaggedStart 语义 start[i] = i·dur·lagRatio（0 = 同刻齐动，1 = 首尾相接）；
 * - fit：n 个子项恰好装进窗口 total（末项恰在窗口末完成——「随句推进」的首选）。
 *
 * 钳制优先级（motion.test.ts 钉死，自左向右）：不外溢窗口 > 最小步长 > 子项时长。
 * 窗口属于 beat 时间轴，外溢会踩进下一 beat；装不下时先缩子项时长，连 1 帧
 * 子项都无法错开时显式抛错，不返回违反 fit 契约的计划。
 */
export type ScheduleOpts = {
  /** 子项时长（帧；缺省 DUR.f3=5——「快速子项」档）。 */
  dur?: number;
  /** 模式一：固定步长。 */
  stride?: number;
  /** 模式二：lag 比率（Manim lag_ratio）。 */
  lag?: number;
  /** 模式三：拟装入的窗口总长（帧）。 */
  fit?: {total: number};
  /** 相邻起点期望下限，默认 2 帧；fit 紧窗时可按优先级退至 1 帧。 */
  minStride?: number;
  /** 子项时长期望下限，默认 3 帧；fit 为守住窗口可退至 1 帧。 */
  minDur?: number;
};
export type Schedule = {starts: number[]; dur: number};

export function schedule(n: number, o: ScheduleOpts): Schedule {
  const minStride = o.minStride ?? 2;
  const minDur = o.minDur ?? 3;
  const modes = [o.stride !== undefined, o.lag !== undefined, o.fit !== undefined].filter(
    Boolean,
  ).length;
  if (modes > 1) {
    throw new Error('schedule: stride / lag / fit 三选一');
  }
  let dur = Math.max(minDur, o.dur ?? 5);
  if (n <= 0) {
    return {starts: [], dur};
  }
  let stride: number;
  if (o.fit) {
    const total = Math.max(1, o.fit.total);
    if (n > 1 && total < n) {
      throw new Error(
        `schedule: fit.total=${total} 无法容纳 ${n} 个至少 1 帧且起点间隔至少 1 帧的子项`,
      );
    }
    dur = Math.min(dur, total);
    stride = n === 1 ? 0 : (total - dur) / (n - 1);
    const targetStride = Math.max(1, minStride);
    if (n > 1 && stride < targetStride) {
      // 先缩时长争取期望步长；仍不足时牺牲步长，但至少保留 1 帧先后。
      dur = Math.max(1, Math.min(dur, total - targetStride * (n - 1)));
      stride = (total - dur) / (n - 1);
    }
  } else if (o.lag !== undefined) {
    stride = dur * o.lag;
  } else {
    stride = o.stride ?? minStride;
  }
  stride = Math.max(n === 1 || o.lag === 0 ? 0 : 1, stride);
  return {starts: Array.from({length: n}, (_, i) => Math.round(i * stride)), dur};
}
