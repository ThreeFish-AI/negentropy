"use client";

import { memo } from "react";

import { useClock } from "./ClockProvider";
import { formatDuration, spanMs } from "./routine-format";

/**
 * 实时耗时 —— 订阅共享时钟，按秒刷新 ``now - startedAt``。
 * 仅用于在途（未完成）迭代；置于 [[ClockProvider]] 内才会 tick。
 */
export const LiveElapsed = memo(function LiveElapsed({
  startedAt,
  prefix,
  className,
}: {
  startedAt: string | null;
  prefix?: string;
  className?: string;
}) {
  const now = useClock();
  const ms = spanMs(startedAt, now);
  if (ms === null) return null;
  return (
    <span className={`tabular-nums ${className ?? ""}`}>
      {prefix}
      {formatDuration(ms)}
    </span>
  );
});

/**
 * 静态时长 —— 已完成迭代 ``finishedAt - startedAt``，不订阅时钟（不随 tick 重渲）。
 */
export const StaticDuration = memo(function StaticDuration({
  startedAt,
  finishedAt,
  prefix,
  className,
}: {
  startedAt: string | null;
  finishedAt: string | null;
  prefix?: string;
  className?: string;
}) {
  if (!startedAt || !finishedAt) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(finishedAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return (
    <span className={`tabular-nums ${className ?? ""}`}>
      {prefix}
      {formatDuration(Math.max(0, end - start))}
    </span>
  );
});
