"use client";

import { useEffect, useRef } from "react";

import type { ScheduledTaskDTO } from "@/features/scheduler";

interface SchedulerTaskDetailDrawerProps {
  task: ScheduledTaskDTO;
  onClose: () => void;
  onRun: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-1.5 text-xs">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-foreground text-right ml-4 break-all">{children}</span>
    </div>
  );
}

function Badge({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "enabled" | "disabled" | "default";
}) {
  const cls =
    variant === "enabled"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : variant === "disabled"
        ? "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
        : "bg-muted/50 text-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

export function SchedulerTaskDetailDrawer({
  task,
  onClose,
  onRun,
  onToggle,
}: SchedulerTaskDetailDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Slide-in animation
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transform = "translateX(100%)";
    requestAnimationFrame(() => {
      el.style.transition = "transform 200ms ease-out";
      el.style.transform = "translateX(0)";
    });
  }, []);

  const triggerDisplay =
    task.trigger_type === "cron"
      ? task.cron_expr
      : task.trigger_type === "interval"
        ? `Every ${task.interval_seconds}s`
        : "One-shot";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed inset-y-0 right-0 z-50 w-[420px] max-w-[90vw] bg-card border-l border-border shadow-xl flex flex-col"
        style={{ transform: "translateX(100%)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {task.display_name || task.key}
            </h2>
            <p className="text-[10px] text-muted mt-0.5">{task.key}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
          {/* Status */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-muted mb-2">Status</h3>
            <div className="rounded-lg border border-border p-3 space-y-0.5">
              <DetailField label="Enabled">
                <Badge variant={task.enabled ? "enabled" : "disabled"}>
                  {task.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </DetailField>
              {task.last_status && (
                <DetailField label="Last Status">
                  <Badge variant="default">{task.last_status}</Badge>
                </DetailField>
              )}
              {task.consecutive_failures > 0 && (
                <DetailField label="Consecutive Failures">
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {task.consecutive_failures}
                  </span>
                </DetailField>
              )}
              {task.backoff_until && (
                <DetailField label="Backoff Until">
                  {new Date(task.backoff_until).toLocaleString()}
                </DetailField>
              )}
              {task.last_error && (
                <div className="pt-1.5">
                  <div className="text-[10px] text-muted mb-0.5">Last Error</div>
                  <pre className="text-[10px] text-red-600 dark:text-red-400 bg-red-500/5 rounded p-2 whitespace-pre-wrap break-all">
                    {task.last_error}
                  </pre>
                </div>
              )}
            </div>
          </section>

          {/* Schedule */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-muted mb-2">Schedule</h3>
            <div className="rounded-lg border border-border p-3 space-y-0.5">
              <DetailField label="Trigger Type">{task.trigger_type}</DetailField>
              <DetailField label="Expression">{triggerDisplay}</DetailField>
              {task.next_fire_at && (
                <DetailField label="Next Fire">
                  {new Date(task.next_fire_at).toLocaleString()}
                </DetailField>
              )}
              {task.last_fire_at && (
                <DetailField label="Last Fire">
                  {new Date(task.last_fire_at).toLocaleString()}
                </DetailField>
              )}
            </div>
          </section>

          {/* Metadata */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-muted mb-2">Metadata</h3>
            <div className="rounded-lg border border-border p-3 space-y-0.5">
              <DetailField label="Handler">{task.handler_kind}</DetailField>
              {task.role && <DetailField label="Role">{task.role}</DetailField>}
              {task.scenario && <DetailField label="Scenario">{task.scenario}</DetailField>}
              {task.category && <DetailField label="Category">{task.category}</DetailField>}
              {task.owner_id && <DetailField label="Owner">{task.owner_id}</DetailField>}
              {task.agent_id && <DetailField label="Agent">{task.agent_id}</DetailField>}
              <DetailField label="Total Runs">{task.total_runs}</DetailField>
              <DetailField label="Max Concurrency">{task.max_concurrency}</DetailField>
            </div>
          </section>

          {/* Payload */}
          {Object.keys(task.payload).length > 0 && (
            <section>
              <h3 className="text-[10px] uppercase tracking-wider text-muted mb-2">Payload</h3>
              <div className="rounded-lg border border-border p-3">
                <pre className="text-[10px] text-foreground whitespace-pre-wrap break-all max-h-[200px] overflow-auto">
                  {JSON.stringify(task.payload, null, 2)}
                </pre>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <button
            onClick={() => onRun(task.id)}
            className="rounded-md px-3 py-1.5 text-xs font-medium bg-foreground text-background hover:opacity-80 transition-opacity"
          >
            Run Now
          </button>
          <button
            onClick={() => onToggle(task.id, !task.enabled)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium border border-border transition-colors ${
              task.enabled
                ? "text-foreground hover:bg-muted/50"
                : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            {task.enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>
    </>
  );
}
