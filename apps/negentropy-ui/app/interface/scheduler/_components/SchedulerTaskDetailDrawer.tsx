"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { fetchTaskDetail } from "@/features/scheduler";
import type { ScheduledTaskDTO } from "@/features/scheduler";
import { patrolReasonLabel, patrolReasonStyle } from "@/features/scheduler/patrol-reason";
import { fetchRoutines } from "@/features/routine";
import type { RoutineDTO } from "@/features/routine";

import { SchedulerHandlerSource } from "./SchedulerHandlerSource";

interface SchedulerTaskDetailDrawerProps {
  task: ScheduledTaskDTO;
  onClose: () => void;
  onRun: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (task: ScheduledTaskDTO) => void;
  onDelete: (task: ScheduledTaskDTO) => void;
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-1.5 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
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
        ? "bg-muted text-text-secondary"
        : "bg-muted/50 text-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-micro font-semibold ${cls}`}>
      {children}
    </span>
  );
}

const ROUTINE_STATUS_STYLE: Record<string, string> = {
  running: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  succeeded: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "bg-red-500/10 text-red-700 dark:text-red-300",
  paused: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  cancelled: "bg-muted text-text-secondary",
  pending: "bg-muted/50 text-foreground",
};

/**
 * 派生 Routine 面板：按 config.source_task_key 拉取本任务派生的 Routine（如巡检），
 * 每行深链到 /interface/routine?sel=<id>（Routine 详情抽屉，含迭代/事件/评分/PR 全历史）。
 */
function SpawnedRoutinesSection({ taskKey, taskId }: { taskKey: string; taskId: string }) {
  const [routines, setRoutines] = useState<RoutineDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState<string | null>(null);
  const [skipTime, setSkipTime] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // 注：不在此同步 setLoading/setError（触发 react-hooks/set-state-in-effect）；
    // 改由外层 <SpawnedRoutinesSection key={taskKey} /> 每任务重挂载、初始 loading=true。
    fetchRoutines({ source_task_key: taskKey, is_template: false })
      .then(async (res) => {
        if (cancelled) return;
        setRoutines(res.items);
        // 空态：拉任务详情取最近一次执行的跳过原因，避免泛泛「暂无」（不 silent ok）。
        if (res.items.length === 0) {
          try {
            const detail = await fetchTaskDetail(taskId);
            if (cancelled) return;
            const latest = detail.recent_executions?.[0];
            const reason = latest?.metrics?.reason;
            if (typeof reason === "string") {
              setSkipReason(reason);
              setSkipTime(latest?.started_at ?? null);
            }
          } catch {
            // 任务详情拉取失败不阻塞派生面板主流程
          }
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskKey, taskId]);

  return (
    <section>
      <h3 className="text-micro uppercase tracking-overline text-muted-foreground mb-2">
        派生 Routine（Spawned Routines）
      </h3>
      <div className="rounded-lg border border-border p-2 space-y-0.5">
        {loading ? (
          <p className="text-micro text-muted-foreground px-1 py-1.5">加载中…</p>
        ) : error ? (
          <p className="text-micro text-red-600 dark:text-red-400 px-1 py-1.5">加载失败：{error}</p>
        ) : routines.length === 0 ? (
          <div className="px-1 py-1.5 space-y-1">
            {patrolReasonLabel(skipReason) ? (
              <p className="text-micro text-muted-foreground">
                最近未派生 Routine：
                <span
                  className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-micro font-semibold mx-1 align-middle ${patrolReasonStyle(skipReason)}`}
                >
                  {patrolReasonLabel(skipReason)}
                </span>
                {skipTime && <span>（{new Date(skipTime).toLocaleString()}）</span>}
              </p>
            ) : (
              <p className="text-micro text-muted-foreground">暂无派生 Routine（任务触发后将在此列出）。</p>
            )}
            <p className="text-micro text-muted-foreground/70">
              点击派生 Routine 直达其详情全历史（迭代 / 事件 / 评分 / PR）。
            </p>
          </div>
        ) : (
          routines.map((r) => (
            <a
              key={r.id}
              href={`/interface/routine?sel=${encodeURIComponent(r.id)}`}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-micro font-semibold ${ROUTINE_STATUS_STYLE[r.status] ?? "bg-muted text-text-secondary"}`}
                >
                  {r.status}
                </span>
                <span className="text-foreground truncate">{r.display_name || r.title}</span>
              </span>
              <span className="flex items-center gap-2 text-micro text-muted-foreground shrink-0">
                {r.best_score != null && <span>best {r.best_score}</span>}
                {r.pr_url && <span className="text-blue-600 dark:text-blue-400">PR</span>}
                <span>→</span>
              </span>
            </a>
          ))
        )}
      </div>
    </section>
  );
}

export function SchedulerTaskDetailDrawer({
  task,
  onClose,
  onRun,
  onToggle,
  onEdit,
  onDelete,
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
        className="fixed inset-0 z-40 bg-overlay"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed inset-y-0 right-0 z-50 [width:clamp(480px,66.67%,1100px)] bg-card border-l border-border shadow-xl flex flex-col"
        style={{ transform: "translateX(100%)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">
                {task.display_name || task.key}
              </h2>
              {task.is_system && (
                <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-micro font-semibold text-blue-700 dark:text-blue-300">
                  System
                </span>
              )}
            </div>
            <p className="text-micro text-muted-foreground mt-0.5">{task.key}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close task details"
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
          {/* Description */}
          {task.description && (
            <section>
              <h3 className="text-micro uppercase tracking-overline text-muted-foreground mb-2">
                Description
              </h3>
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap break-words">
                {task.description}
              </p>
            </section>
          )}

          {/* Status */}
          <section>
            <h3 className="text-micro uppercase tracking-overline text-muted-foreground mb-2">Status</h3>
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
                  <div className="text-micro text-muted-foreground mb-0.5">Last Error</div>
                  <pre className="text-micro text-red-600 dark:text-red-400 bg-red-500/5 rounded p-2 whitespace-pre-wrap break-all">
                    {task.last_error}
                  </pre>
                </div>
              )}
            </div>
          </section>

          {/* Schedule */}
          <section>
            <h3 className="text-micro uppercase tracking-overline text-muted-foreground mb-2">Schedule</h3>
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
            <h3 className="text-micro uppercase tracking-overline text-muted-foreground mb-2">Metadata</h3>
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
              <h3 className="text-micro uppercase tracking-overline text-muted-foreground mb-2">Payload</h3>
              <div className="rounded-lg border border-border p-3">
                <pre className="text-micro text-foreground whitespace-pre-wrap break-all max-h-[200px] overflow-auto">
                  {JSON.stringify(task.payload, null, 2)}
                </pre>
              </div>
            </section>
          )}

          {/* 实现逻辑：Handler 源码与解释 */}
          <section>
            <h3 className="text-micro uppercase tracking-overline text-muted-foreground mb-2">实现逻辑</h3>
            <SchedulerHandlerSource key={task.handler_kind} handlerKind={task.handler_kind} />
          </section>

          {/* 派生 Routine：本任务派生的 Routine（如巡检），深链到 Routine 详情全历史 */}
          <SpawnedRoutinesSection key={task.key} taskKey={task.key} taskId={task.id} />
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <Button variant="neutral" size="sm" onClick={() => onRun(task.id)}>
            Run Now
          </Button>
          <button
            onClick={() => onToggle(task.id, !task.enabled)}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium border border-border transition-colors ${
              task.enabled
                ? "text-foreground hover:bg-muted/50"
                : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            {task.enabled ? "Disable" : "Enable"}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => onDelete(task)}
            disabled={task.is_system}
            title={task.is_system ? "System tasks cannot be deleted" : undefined}
            className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
              task.is_system
                ? "text-muted-foreground/40 border-muted/30 cursor-not-allowed"
                : "cursor-pointer text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-500/10"
            }`}
          >
            Delete
          </button>
          <Button variant="neutral" size="sm" onClick={() => onEdit(task)}>
            Edit
          </Button>
        </div>
      </div>
    </>
  );
}
