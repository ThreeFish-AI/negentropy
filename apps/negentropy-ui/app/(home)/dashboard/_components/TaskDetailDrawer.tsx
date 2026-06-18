/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useEffect, useState } from "react";

import { fetchTaskDetail, runTaskNow, toggleTaskEnabled } from "../_lib/api";
import type { ScheduledTaskDTO, TaskDetailResponse } from "../_lib/types";

interface TaskDetailDrawerProps {
  task: ScheduledTaskDTO | null;
  onClose: () => void;
  onTaskChanged: () => void;
}

export function TaskDetailDrawer({ task, onClose, onTaskChanged }: TaskDetailDrawerProps) {
  const [detail, setDetail] = useState<TaskDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionPending, setActionPending] = useState<"run" | "toggle" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTaskDetail(task.id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err instanceof Error ? err.message : err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [task]);

  if (!task) return null;

  async function handleRunNow() {
    if (!task) return;
    setActionPending("run");
    setError(null);
    try {
      await runTaskNow(task.id);
      // 立即刷新详情拿到 running execution
      const d = await fetchTaskDetail(task.id);
      setDetail(d);
      onTaskChanged();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setActionPending(null);
    }
  }

  async function handleToggle() {
    if (!task) return;
    setActionPending("toggle");
    setError(null);
    try {
      await toggleTaskEnabled(task.id, !task.enabled);
      onTaskChanged();
      onClose();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setActionPending(null);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close drawer"
        className="absolute inset-0 bg-overlay backdrop-blur-[2px]"
      />
      <aside className="relative z-10 flex h-full [width:clamp(480px,66.67%,1100px)] flex-col border-l border-border bg-card shadow-xl">
        <header className="border-b border-border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">
                {task.display_name || task.key}
              </div>
              <div className="truncate text-caption text-muted-foreground">{task.key}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-2 py-1 text-caption hover:bg-muted/50"
            >
              Close
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1 text-micro text-muted-foreground">
            <span className="rounded-full bg-muted/50 px-1.5 py-0.5">{task.handler_kind}</span>
            {task.role ? <span className="rounded-full bg-muted/50 px-1.5 py-0.5">role: {task.role}</span> : null}
            {task.scenario ? <span className="rounded-full bg-muted/50 px-1.5 py-0.5">scenario: {task.scenario}</span> : null}
            {task.category ? <span className="rounded-full bg-muted/50 px-1.5 py-0.5">category: {task.category}</span> : null}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleRunNow}
              disabled={actionPending !== null}
              className="rounded-md bg-foreground px-3 py-1 text-xs font-semibold text-background disabled:opacity-50"
            >
              {actionPending === "run" ? "Running…" : "Run Now"}
            </button>
            <button
              type="button"
              onClick={handleToggle}
              disabled={actionPending !== null}
              className="rounded-md border border-border px-3 py-1 text-xs font-semibold disabled:opacity-50"
            >
              {actionPending === "toggle" ? "…" : task.enabled ? "Disable" : "Enable"}
            </button>
          </div>
          {error ? <div className="mt-2 text-caption text-red-600 dark:text-red-400">{error}</div> : null}
        </header>
        <div className="flex-1 overflow-auto px-4 py-3">
          <Section title="Payload">
            <pre className="overflow-auto rounded-md border border-border bg-muted/30 p-2 text-caption">
              {JSON.stringify(task.payload, null, 2)}
            </pre>
          </Section>
          <Section title="Run history">
            {loading ? (
              <div className="text-xs text-muted-foreground">Loading…</div>
            ) : detail?.recent_executions.length ? (
              <ul className="space-y-2">
                {detail.recent_executions.slice(0, 50).map((e) => (
                  <li key={e.id} className="rounded-md border border-border bg-muted/20 p-2">
                    <div className="flex items-center justify-between text-caption text-muted-foreground">
                      <span className="font-mono">{e.started_at}</span>
                      <span>{e.status} · {e.duration_ms ?? "—"}ms · {e.fire_reason}</span>
                    </div>
                    {e.output_summary ? (
                      <div className="mt-1 text-caption text-foreground">{e.output_summary}</div>
                    ) : null}
                    {e.error ? (
                      <div className="mt-1 text-caption text-red-600 dark:text-red-400">{e.error}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-muted-foreground">No executions yet.</div>
            )}
          </Section>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <div className="mb-1 text-micro uppercase tracking-overline text-muted-foreground">{title}</div>
      {children}
    </section>
  );
}
