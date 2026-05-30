/** Routine 视图共享的轻量格式化工具。 */

/** 毫秒 → 秒表样式时长：<1h 为 ``M:SS``，≥1h 为 ``H:MM:SS``。 */
export function formatDuration(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSec = Math.floor(safe / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** 区间毫秒数；任一端缺失或非法返回 null。 */
export function spanMs(startedAt: string | null | undefined, endAt: number): number | null {
  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return null;
  return Math.max(0, endAt - start);
}

/** 截止时间倒计时（毫秒），过期为 0；缺失返回 null。 */
export function remainingMs(deadlineAt: string | null | undefined, now: number): number | null {
  if (!deadlineAt) return null;
  const dl = Date.parse(deadlineAt);
  if (Number.isNaN(dl)) return null;
  return Math.max(0, dl - now);
}
