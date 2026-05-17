"use client";

import { useEffect, useRef } from "react";

import type { TaskExecutionDTO } from "../_lib/types";

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
    cancelled: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
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
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${map[status] ?? "bg-zinc-500/10"}`}>
      <span>{icon[status] ?? "·"}</span>
      <span>{status}</span>
    </span>
  );
}

export function ExecutionTimeline({ executions }: ExecutionTimelineProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const firstIdRef = useRef<string | null>(null);

  // 高亮新插入的头部条目 800ms
  useEffect(() => {
    if (!executions.length) return;
    const newest = executions[0];
    if (firstIdRef.current === newest.id) return;
    firstIdRef.current = newest.id;
    const node = listRef.current?.firstElementChild as HTMLElement | undefined;
    if (!node) return;
    node.classList.add("ring-2", "ring-indigo-400");
    const id = window.setTimeout(() => {
      node.classList.remove("ring-2", "ring-indigo-400");
    }, 800);
    return () => window.clearTimeout(id);
  }, [executions]);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wider text-muted">
        Execution Timeline
      </div>
      <div ref={listRef} className="max-h-[480px] overflow-auto">
        {executions.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted">No executions yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {executions.map((e) => (
              <li key={e.id} className="px-3 py-2 transition-shadow">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] text-muted">{formatTime(e.started_at)}</span>
                    <StatusBadge status={e.status} />
                    <span className="truncate text-xs font-medium text-foreground">{e.task_key ?? e.task_id}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    {e.duration_ms !== null ? <span>{e.duration_ms}ms</span> : null}
                    <span className="rounded-full bg-muted/50 px-1.5 py-0.5">{e.fire_reason}</span>
                  </div>
                </div>
                {e.output_summary ? (
                  <div className="mt-1 truncate text-[11px] text-muted">{e.output_summary}</div>
                ) : null}
                {e.error ? <div className="mt-1 text-[11px] text-red-600 dark:text-red-400">{e.error}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
