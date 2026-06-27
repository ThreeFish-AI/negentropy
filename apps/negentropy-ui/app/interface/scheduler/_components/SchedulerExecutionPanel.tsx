"use client";

import { useMemo, useState } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  navPillClassName,
  navRailContainerClassName,
} from "@/components/ui/nav-styles";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ExecutionStatus, TaskExecutionDTO } from "@/features/scheduler";

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
    <a
      href={`/interface/routine?sel=${encodeURIComponent(rid)}`}
      className="inline-flex items-center gap-1 text-micro text-blue-600 dark:text-blue-400 hover:underline w-fit"
    >
      派生 Routine →{docId ? `（doc ${docId.slice(0, 8)}）` : ""}
    </a>
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  // 历史浏览快照：用户翻到第 2 页及以后时锁定当前数据集，使 SSE 实时插入 / 轮询刷新
  // 不再重排行序、造成翻页抖动；停留或返回第 1 页时为 null，始终呈现最新数据。
  const [frozen, setFrozen] = useState<TaskExecutionDTO[] | null>(null);

  // 按状态过滤 + 防御性时间倒序（后端已倒序，此处确保契约稳健；null 视为最旧排末位）
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

  // 有效视图：冻结态渲染历史快照，否则跟随最新过滤结果。计数 / 分页 / 空态统一以此为准。
  const view = frozen ?? filtered;

  // 客户端切片分页（默认每页 10 条）
  const totalPages = Math.max(1, Math.ceil(view.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paged = view.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // 翻页：离开第 1 页时冻结当前快照，回到第 1 页时解冻并重新同步实时数据。
  const goToPage = (target: number) => {
    const next = Math.min(totalPages, Math.max(1, target));
    if (next === 1) {
      setFrozen(null);
    } else if (safePage === 1) {
      setFrozen(filtered);
    }
    setCurrentPage(next);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* Status filter pills */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-caption uppercase tracking-overline text-muted-foreground">
          Executions ({view.length})
        </span>
        <div className={`${navRailContainerClassName} gap-0.5 p-0.5`}>
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.key}
              onClick={() => {
                setStatusFilter(sf.key);
                setCurrentPage(1);
                setFrozen(null);
              }}
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

      <div className="max-h-[540px] overflow-auto">
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
              paged.map((e) => (
                <tr
                  key={e.id}
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
                  <td className="px-3 py-2 text-muted-foreground max-w-[240px]">
                    {e.error ? (
                      <span className="text-red-600 dark:text-red-400 truncate block">{e.error}</span>
                    ) : (
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="truncate block">{e.output_summary ?? "—"}</span>
                        <SpawnedRoutineLink metrics={e.metrics} />
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {view.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => goToPage(safePage - 1)}
            aria-label="Previous page"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-micro font-medium text-muted-foreground">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => goToPage(safePage + 1)}
            aria-label="Next page"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
