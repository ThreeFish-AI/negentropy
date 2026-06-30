"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import {
  navPillClassName,
  navRailContainerClassName,
} from "@/components/ui/nav-styles";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { useInfiniteList, type ClientFetcher } from "@/hooks/useInfiniteList";
import { useInfiniteScrollSentinel, useScrollPageSync } from "@/hooks/useInfiniteScrollSentinel";
import type { ExecutionStatus, TaskExecutionDTO } from "@/features/scheduler";
import { patrolReasonLabel, patrolReasonStyle } from "@/features/scheduler/patrol-reason";

interface SchedulerExecutionPanelProps {
  executions: TaskExecutionDTO[];
  loading: boolean;
}

type StatusFilter = "all" | ExecutionStatus;

const PAGE_SIZE = 10;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ok", label: "OK" },
  { key: "failed", label: "Failed" },
  { key: "running", label: "Running" },
];

const STATUS_STYLES: Record<ExecutionStatus, string> = {
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "bg-red-500/10 text-red-700 dark:text-red-300",
  running: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  cancelled: "bg-muted text-text-secondary",
  timeout: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

/** 从 HandlerResult.metrics 提取派生 Routine 深链（如巡检 routine_id/doc_id）。 */
function SpawnedRoutineLink({ metrics }: { metrics: Record<string, unknown> | undefined }) {
  const rid = typeof metrics?.routine_id === "string" ? metrics.routine_id : null;
  if (!rid) return null;
  const docId = typeof metrics?.doc_id === "string" ? metrics.doc_id : null;
  return (
    <Link
      href={`/interface/routine?sel=${encodeURIComponent(rid)}`}
      className="inline-flex items-center gap-1 text-micro text-blue-600 dark:text-blue-400 hover:underline w-fit"
    >
      派生 Routine →{docId ? `（doc ${docId.slice(0, 8)}）` : ""}
    </Link>
  );
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border last:border-b-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-3 py-2">
          <Skeleton
            className="h-4"
            style={{ width: `${50 + (i * 17) % 40}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

export function SchedulerExecutionPanel({
  executions,
  loading,
}: SchedulerExecutionPanelProps) {
  // 面板内滚动容器 ref（哨兵 / 滚动联动 observer 的 root，须为该面板 overflow 容器，非 viewport）。
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const programmaticScrollRef = useRef(false);
  const pendingPageRef = useRef<number | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // 按状态过滤【全量】+ 防御性时间倒序（后端已倒序，此处确保契约稳健；null 视为最旧排末位）。
  const filtered = useMemo(() => {
    const base =
      statusFilter === "all"
        ? executions
        : executions.filter((e) => e.status === statusFilter);
    return [...base].sort((a, b) => {
      const ta = a.started_at ? Date.parse(a.started_at) : -Infinity;
      const tb = b.started_at ? Date.parse(b.started_at) : -Infinity;
      return tb - ta;
    });
  }, [executions, statusFilter]);

  // 客户端模式：fetcher.items = 筛选后全量数组（SSE 实时数据由父组件持有，本层仅渐进切片）；
  // statusFilter 作为 filters → 变化即 reset 回第 1 页。
  const fetcher = useMemo<ClientFetcher<TaskExecutionDTO>>(
    () => ({ kind: "client", items: filtered }),
    [filtered],
  );
  const list = useInfiniteList<TaskExecutionDTO, { status: StatusFilter }>({
    fetcher,
    pageSize: PAGE_SIZE,
    filters: { status: statusFilter },
  });

  // 无限滚动哨兵：滚到底（提前 200px）→ 揭示下一页。root = 该面板 overflow 容器。
  const { sentinelRef } = useInfiniteScrollSentinel({
    onReach: list.loadMore,
    enabled: list.hasMore && !list.loadingMore && !list.loading,
    root: scrollRootRef,
  });

  // 滚动联动当前页高亮：观测每页首行的 data-infinite-page 锚点。
  useScrollPageSync({
    enabled: true,
    onPageChange: list.goToPage,
    root: scrollRootRef,
    rescanKey: list.items.length,
    programmaticRef: programmaticScrollRef,
  });

  const handleGoToPage = useCallback(
    (target: number) => {
      pendingPageRef.current = target;
      programmaticScrollRef.current = true;
      list.goToPage(target);
    },
    [list],
  );

  // 待跳页锚点出现即平滑滚动（该面板 root 限定查询范围）。
  const { currentPage } = list;
  const itemsLen = list.items.length;
  useEffect(() => {
    const target = pendingPageRef.current;
    if (target == null) return;
    const anchor = scrollRootRef.current?.querySelector<HTMLElement>(`[data-infinite-page="${target}"]`);
    if (!anchor) return;
    anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    pendingPageRef.current = null;
    const t = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 600);
    return () => window.clearTimeout(t);
  }, [currentPage, itemsLen]);

  const view = list.items;
  const totalCount = list.total ?? filtered.length;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* Status filter pills */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-caption uppercase tracking-overline text-muted-foreground">
          Executions ({totalCount})
        </span>
        <div className={`${navRailContainerClassName} gap-0.5 p-0.5`}>
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.key}
              onClick={() => setStatusFilter(sf.key)}
              className={navPillClassName(
                statusFilter === sf.key,
                "px-3 py-0.5 text-micro font-medium",
              )}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 滚动容器（哨兵 / 滚动联动 root） */}
      <div ref={scrollRootRef} className="max-h-[540px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card text-muted-foreground z-10">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium">Started</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Task</th>
              <th className="px-3 py-2 text-left font-medium">Duration</th>
              <th className="px-3 py-2 text-left font-medium">Reason</th>
              <th className="px-3 py-2 text-left font-medium">Output</th>
            </tr>
          </thead>
          <tbody>
            {loading && executions.length === 0 ? (
              Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
            ) : view.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No executions match the current filter.
                </td>
              </tr>
            ) : (
              view.map((e, i) => (
                <tr
                  key={e.id}
                  data-infinite-page={i % PAGE_SIZE === 0 ? Math.floor(i / PAGE_SIZE) + 1 : undefined}
                  className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {formatTime(e.started_at)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-micro font-semibold ${STATUS_STYLES[e.status]}`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-foreground font-medium">
                    {e.task_key ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDuration(e.duration_ms)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{e.fire_reason}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[260px]">
                    {e.error ? (
                      <span className="text-red-600 dark:text-red-400 truncate block">{e.error}</span>
                    ) : (
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {patrolReasonLabel(e.metrics?.reason) && (
                            <span
                              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-micro font-semibold shrink-0 ${patrolReasonStyle(
                                e.metrics?.reason,
                              )}`}
                            >
                              {patrolReasonLabel(e.metrics?.reason)}
                            </span>
                          )}
                          <span className="truncate block">{e.output_summary ?? "—"}</span>
                        </div>
                        <SpawnedRoutineLink metrics={e.metrics} />
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 无限滚动哨兵：进入视口即揭示下一页。 */}
        <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      </div>

      {/* Pagination — 居中统一控件 */}
      {filtered.length > 0 && (
        <div className="border-t border-border px-3 py-1.5">
          <Pagination
            page={list.currentPage}
            totalPages={list.totalPages}
            onPageChange={handleGoToPage}
            total={list.total ?? undefined}
            itemLabel="execution"
            disabled={loading}
            loadingMore={list.loadingMore}
          />
        </div>
      )}
    </div>
  );
}
