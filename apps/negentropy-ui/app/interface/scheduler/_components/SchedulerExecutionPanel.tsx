"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  navPillClassName,
  navRailContainerClassName,
} from "@/components/ui/nav-styles";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { TextTooltip } from "@/components/ui/TextTooltip";
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
    <tr className="border-b border-border/60 last:border-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
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
  const [page, setPage] = useState(1);

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

  // 纯分页：每页 PAGE_SIZE 条，仅展示当前页切片（不累积、无无限滚动）。executions 由父组件
  // 经 SSE pushExecution 实时更新 → filtered 重算 → 当前页切片自动刷新。
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const view = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  // 状态过滤切换 → 同步回到第 1 页（避免落在空页；在 handler 内重置而非 effect，规避 set-state-in-effect）。
  const changeStatus = (s: StatusFilter) => {
    setStatusFilter(s);
    setPage(1);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Status filter pills（计数去重：仅在底部分页栏展示） */}
      <div className="flex items-center justify-end border-b border-border px-4 py-2">
        <div className={`${navRailContainerClassName} gap-0.5 p-0.5`}>
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.key}
              onClick={() => changeStatus(sf.key)}
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

      <table className="w-full table-fixed text-sm">
        {/* 固定列宽（合计 100%）：Started 16 · Status 10 · Task 16 · Duration 8 · Reason 14 · Output 36。
            6 列须与下方 6 个 <th> 严格对齐。注意：colgroup 内不得夹带空白文本节点（含 <col/> 后行内注释），
            否则触发 "whitespace text nodes cannot be a child of colgroup" hydration 报错。 */}
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[10%]" />
          <col className="w-[16%]" />
          <col className="w-[8%]" />
          <col className="w-[14%]" />
          <col className="w-[36%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-overline text-text-secondary">
            <th className="px-4 py-2.5 font-medium">Started</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Task</th>
            <th className="px-4 py-2.5 font-medium">Duration</th>
            <th className="px-4 py-2.5 font-medium">Reason</th>
            <th className="px-4 py-2.5 font-medium">Output</th>
          </tr>
        </thead>
        <tbody>
          {loading && executions.length === 0 ? (
            Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
          ) : view.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                No executions match the current filter.
              </td>
            </tr>
          ) : (
            view.map((e) => (
              <tr
                key={e.id}
                className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
              >
                <td className="px-4 py-3 text-muted-foreground">
                  <TextTooltip content={formatTime(e.started_at)}>
                    <span className="block truncate">{formatTime(e.started_at)}</span>
                  </TextTooltip>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-micro font-semibold ${STATUS_STYLES[e.status]}`}
                  >
                    {e.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground font-medium">
                  <TextTooltip content={e.task_key ?? "—"}>
                    <span className="block truncate">{e.task_key ?? "—"}</span>
                  </TextTooltip>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <span className="block truncate">{formatDuration(e.duration_ms)}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <TextTooltip content={e.fire_reason}>
                    <span className="block truncate">{e.fire_reason}</span>
                  </TextTooltip>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {e.error ? (
                    <TextTooltip content={e.error}>
                      <span className="block truncate text-red-600 dark:text-red-400">{e.error}</span>
                    </TextTooltip>
                  ) : (
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {patrolReasonLabel(e.metrics?.reason) && (
                          <span
                            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-micro font-semibold shrink-0 ${patrolReasonStyle(
                              e.metrics?.reason,
                            )}`}
                          >
                            {patrolReasonLabel(e.metrics?.reason)}
                          </span>
                        )}
                        <TextTooltip content={e.output_summary ?? "—"}>
                          <span className="block min-w-0 flex-1 truncate">{e.output_summary ?? "—"}</span>
                        </TextTooltip>
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

      {/* Pagination — 纯分页：居中统一控件 + 计数 */}
      {filtered.length > 0 && (
        <div className="border-t border-border px-4 py-1.5">
          <Pagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            total={filtered.length}
            itemLabel="execution"
            disabled={loading}
            // 计数字号增至 12px（对齐 Routine）。
            countClassName="text-xs"
          />
        </div>
      )}
    </div>
  );
}
