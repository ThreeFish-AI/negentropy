"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";

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
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${map[status] ?? "bg-border/50"}`}>
      <span>{icon[status] ?? "·"}</span>
      <span>{status}</span>
    </span>
  );
}

export function ExecutionTimeline({ executions }: ExecutionTimelineProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const firstIdRef = useRef<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // --- Client-side filter pipeline ---
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

  const totalCount = executions.length;
  const filteredCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // --- SSE: auto-jump to page 1 when new execution arrives ---
  useEffect(() => {
    if (!executions.length) return;
    const newest = executions[0];
    if (firstIdRef.current === newest.id) return;
    firstIdRef.current = newest.id;
    setCurrentPage(1);
  }, [executions]);

  // --- Flash highlight on the first item of page 1 ---
  const pagedLen = paged.length;
  const firstPagedId = paged[0]?.id;
  useEffect(() => {
    if (safePage !== 1 || !pagedLen) return;
    const node = listRef.current?.firstElementChild as HTMLElement | undefined;
    if (!node) return;
    node.classList.add("ring-2", "ring-indigo-400");
    const id = window.setTimeout(() => {
      node.classList.remove("ring-2", "ring-indigo-400");
    }, 800);
    return () => window.clearTimeout(id);
  }, [safePage, pagedLen, firstPagedId]);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">
            Execution Timeline
          </span>
          {/* Status filter pills */}
          <div className="flex items-center gap-0.5 overflow-x-auto rounded-full bg-muted/50 px-1 py-0.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setStatusFilter(opt.value); setCurrentPage(1); }}
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
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
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search..."
              className="w-full rounded-md border border-border bg-background py-0.5 pl-6 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {/* Count */}
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {filteredCount === totalCount ? `${totalCount}` : `${filteredCount}/${totalCount}`}
          </span>
        </div>
      </div>

      {/* List */}
      <div ref={listRef}>
        {paged.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {filteredCount === 0 && totalCount > 0
              ? "No executions match current filters."
              : "No executions yet."}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {paged.map((e) => (
              <li key={e.id} className="px-3 py-2 transition-shadow">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{formatTime(e.started_at)}</span>
                    <StatusBadge status={e.status} />
                    <span className="truncate text-xs font-medium text-foreground">
                      {e.task_key ?? e.task_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {e.duration_ms !== null ? <span>{e.duration_ms}ms</span> : null}
                    <span className="rounded-full bg-muted/50 px-1.5 py-0.5">{e.fire_reason}</span>
                  </div>
                </div>
                {e.output_summary ? (
                  <div className="mt-1 truncate text-[11px] text-muted-foreground">{e.output_summary}</div>
                ) : null}
                {e.error ? (
                  <div className="mt-1 text-[11px] text-red-600 dark:text-red-400">{e.error}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {filteredCount > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
            aria-label="上一页"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-medium text-muted-foreground">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
            aria-label="下一页"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
