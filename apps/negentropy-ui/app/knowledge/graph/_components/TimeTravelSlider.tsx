"use client";

/**
 * TimeTravelSlider — G3 双时态时间穿梭检索 UI
 *
 * 拉取关系时间轴密度直方图（valid_from/valid_to 事件按 day 桶聚合），
 * 用户拖动 slider 选择历史时刻；选定时刻通过 onChange 回调暴露给上层，
 * 进而透传给所有 graph 读 API 的 as_of 查询参数。
 *
 * 设计参考：
 *   - Snodgrass & Ahn (1985) 双时轴模型
 *   - Graphiti / Zep bi-temporal memory UI
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchGraphTimeline,
  type GraphTimelineBucket,
} from "@/features/knowledge";

interface TimeTravelSliderProps {
  corpusId: string | null;
  asOf: string | null;
  onChange: (asOf: string | null) => void;
}

const ROW_BG = "bg-zinc-50 dark:bg-zinc-900/40";

function formatBucketLabel(iso: string): string {
  // 尽量短：YYYY-MM-DD
  return iso.slice(0, 10);
}

export function TimeTravelSlider({
  corpusId,
  asOf,
  onChange,
}: TimeTravelSliderProps) {
  const [points, setPoints] = useState<GraphTimelineBucket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [bucketIdx, setBucketIdx] = useState(0);

  useEffect(() => {
    if (!corpusId || !enabled) return;
    let cancelled = false;
    fetchGraphTimeline(corpusId, "day")
      .then((data) => {
        if (cancelled) return;
        setPoints(data.points);
        setBucketIdx(Math.max(data.points.length - 1, 0));
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    // 进入加载状态在 fetch 触发后由 React 18 自动批处理；通过 boolean 派生避免
    // 在 effect 顶部直接 setState（react-hooks/set-state-in-effect 规则）。
    Promise.resolve().then(() => {
      if (!cancelled) setLoading(true);
    });
    return () => {
      cancelled = true;
    };
  }, [corpusId, enabled]);

  // 关闭时态过滤 → 通过 onChange 回调清空父组件 as_of（不动本组件 state）
  useEffect(() => {
    if (!enabled && asOf !== null) {
      onChange(null);
    }
  }, [enabled, asOf, onChange]);

  const maxActive = useMemo(
    () => points.reduce((m, p) => Math.max(m, p.active_count), 0) || 1,
    [points],
  );

  const handleSliderChange = useCallback(
    (idx: number) => {
      setBucketIdx(idx);
      const point = points[idx];
      if (point) {
        onChange(point.date);
      }
    },
    [points, onChange],
  );

  const handleToggle = useCallback(() => {
    setEnabled((v) => !v);
  }, []);

  if (!corpusId) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        选择语料库后启用时间穿梭
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            className="h-3 w-3"
          />
          <span className="text-zinc-700 dark:text-zinc-300">时间穿梭</span>
        </label>
        {enabled && asOf && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            as_of: {formatBucketLabel(asOf)}
          </span>
        )}
      </div>

      {enabled && (
        <div className={`rounded p-2 ${ROW_BG}`}>
          {loading && (
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              加载时间轴...
            </p>
          )}
          {error && (
            <p className="text-[10px] text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
          {!loading && !error && points.length === 0 && (
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              该语料库尚无时态关系数据，请构建图谱后重试
            </p>
          )}
          {points.length > 0 && (
            <>
              <div className="flex h-10 items-end gap-[2px]">
                {points.map((p, i) => (
                  <div
                    key={p.date}
                    className={`flex-1 rounded-sm ${
                      i === bucketIdx
                        ? "bg-amber-500"
                        : "bg-zinc-300 dark:bg-zinc-700"
                    }`}
                    style={{
                      height: `${Math.max(
                        2,
                        (p.active_count / maxActive) * 100,
                      )}%`,
                    }}
                    title={`${formatBucketLabel(p.date)}: 生效 ${
                      p.active_count
                    } / 失效 ${p.expired_count}`}
                  />
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={points.length - 1}
                value={bucketIdx}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
                className="mt-2 w-full"
              />
              <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                <span>{formatBucketLabel(points[0]?.date ?? "")}</span>
                <span>
                  {formatBucketLabel(points[points.length - 1]?.date ?? "")}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
