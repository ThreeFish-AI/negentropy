"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Search } from "lucide-react";

import { Pagination } from "@/components/ui/Pagination";
import { useInfiniteList, type ClientFetcher } from "@/hooks/useInfiniteList";
import { useInfiniteScrollSentinel, useScrollPageSync } from "@/hooks/useInfiniteScrollSentinel";

import type { ExecutionStatus, TaskExecutionDTO } from "../_lib/types";

const PAGE_SIZE = 8;

const STATUS_OPTIONS: Array<{ value: ExecutionStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "ok", label: "OK" },
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
  { value: "cancelled", label: "Cancelled" },
  { value: "timeout", label: "Timeout" },
];

interface ExecutionTimelineProps {
  executions: TaskExecutionDTO[];
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const dt = new Date(iso);
    return dt.toLocaleTimeString(undefined, { hour12: false });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    failed: "bg-red-500/10 text-red-700 dark:text-red-300",
    running: "bg-sky-500/10 text-sky-700 dark:text-sky-300 animate-pulse",
    cancelled: "bg-border/50 text-text-muted",
    timeout: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  };
  const icon: Record<string, string> = {
    ok: "✓",
    failed: "✗",
    running: "◐",
    cancelled: "⊘",
    timeout: "⏱",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-micro font-semibold ${map[status] ?? "bg-border/50"}`}>
      <span>{icon[status] ?? "·"}</span>
      <span>{status}</span>
    </span>
  );
}

interface TimelineFilters {
  status: ExecutionStatus | "all";
  q: string;
}

export function ExecutionTimeline({ executions }: ExecutionTimelineProps) {
  // 列表滚动容器 ref（哨兵 / 滚动联动 observer 的 root，须为本组件 overflow 容器，非 viewport）。
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const firstIdRef = useRef<string | null>(null);
  const programmaticScrollRef = useRef(false);
  const pendingPageRef = useRef<number | null>(null);

  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // --- 本地筛选流水线：对【全量】executions 做 status + 关键字筛选（红线：保留原语义） ---
  const filtered = useMemo(() => {
    let result = executions;
    if (statusFilter !== "all") {
      result = result.filter((e) => e.status === statusFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((e) => {
        const fields = [e.task_key, e.output_summary, e.handler_kind].filter(Boolean);
        return fields.some((f) => f!.toLowerCase().includes(q));
      });
    }
    return result;
  }, [executions, statusFilter, searchQuery]);

  // 客户端模式：fetcher.items = 筛选后全量数组；filters 传筛选状态（变化即 reset 回第 1 页）。
  const fetcher = useMemo<ClientFetcher<TaskExecutionDTO>>(
    () => ({ kind: "client", items: filtered }),
    [filtered],
  );
  const list = useInfiniteList<TaskExecutionDTO, TimelineFilters>({
    fetcher,
    pageSize: PAGE_SIZE,
    filters: { status: statusFilter, q: searchQuery.trim().toLowerCase() },
  });

  const totalCount = executions.length;
  const filteredCount = filtered.length;

  // 无限滚动哨兵：滚到底（提前 200px）→ 揭示下一页。root = 本组件 overflow 容器。
  const { sentinelRef } = useInfiniteScrollSentinel({
    onReach: list.loadMore,
    enabled: list.hasMore && !list.loadingMore && !list.loading,
    root: scrollRootRef,
  });

  // 滚动联动当前页高亮：观测每页首项的 data-infinite-page 锚点。
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

  // 待跳页锚点出现即平滑滚动（本组件 root 限定查询范围）。
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

  // --- SSE：新执行（数组头）到达 → 跳回第 1 页（红线：保留「回顶」语义） ---
  const goToPage1 = list.goToPage;
  useEffect(() => {
    if (!executions.length) return;
    const newest = executions[0];
    if (firstIdRef.current === newest.id) return;
    firstIdRef.current = newest.id;
    goToPage1(1);
  }, [executions, goToPage1]);

  // --- 第 1 页 flash 高亮（红线：保留原 ring flash——作用于列表容器首元素，与迁移前一致） ---
  const pagedLen = list.items.length;
  const firstPagedId = list.items[0]?.id;
  useEffect(() => {
    if (list.currentPage !== 1 || !pagedLen) return;
    const node = scrollRootRef.current?.firstElementChild as HTMLElement | undefined;
    if (!node) return;
    node.classList.add("ring-2", "ring-indigo-400");
    const id = window.setTimeout(() => {
      node.classList.remove("ring-2", "ring-indigo-400");
    }, 800);
    return () => window.clearTimeout(id);
  }, [list.currentPage, pagedLen, firstPagedId]);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-caption uppercase tracking-overline text-muted-foreground">
            Execution Timeline
          </span>
          {/* Status filter pills */}
          <div className="flex items-center gap-0.5 overflow-x-auto rounded-full bg-muted/50 px-1 py-0.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-micro font-semibold transition-colors ${
                  statusFilter === opt.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Search input */}
          <div className="relative ml-auto min-w-0 max-w-[140px] flex-1">
            <Search className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-md border border-border bg-background py-0.5 pl-6 pr-2 text-caption text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {/* Count */}
          <span className="shrink-0 text-micro tabular-nums text-muted-foreground">
            {filteredCount === totalCount ? `${totalCount}` : `${filteredCount}/${totalCount}`}
          </span>
        </div>
      </div>

      {/* List — 本组件 overflow 滚动容器（哨兵 / 滚动联动 root） */}
      <div ref={scrollRootRef} className="max-h-[420px] overflow-auto">
        {list.items.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {filteredCount === 0 && totalCount > 0
              ? "No executions match current filters."
              : "No executions yet."}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {list.items.map((e, i) => (
              <li
                key={e.id}
                data-infinite-page={i % PAGE_SIZE === 0 ? Math.floor(i / PAGE_SIZE) + 1 : undefined}
                className="px-3 py-2 transition-shadow"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-caption text-muted-foreground">{formatTime(e.started_at)}</span>
                    <StatusBadge status={e.status} />
                    <span className="truncate text-xs font-medium text-foreground">
                      {e.task_key ?? e.task_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-caption text-muted-foreground">
                    {e.duration_ms !== null ? <span>{e.duration_ms}ms</span> : null}
                    <span className="rounded-full bg-muted/50 px-1.5 py-0.5">{e.fire_reason}</span>
                  </div>
                </div>
                {e.output_summary ? (
                  <div className="mt-1 truncate text-caption text-muted-foreground">{e.output_summary}</div>
                ) : null}
                {e.error ? (
                  <div className="mt-1 text-caption text-red-600 dark:text-red-400">{e.error}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {/* 无限滚动哨兵：进入视口即揭示下一页。 */}
        <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      </div>

      {/* Pagination — 居中统一控件 */}
      {filteredCount > 0 && (
        <div className="border-t border-border px-3 py-1.5">
          <Pagination
            page={list.currentPage}
            totalPages={list.totalPages}
            onPageChange={handleGoToPage}
            total={list.total ?? undefined}
            itemLabel="execution"
            loadingMore={list.loadingMore}
          />
        </div>
      )}
    </div>
  );
}
