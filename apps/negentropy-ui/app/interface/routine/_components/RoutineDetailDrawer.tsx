"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/Button";
import type { RoutineDTO, RoutineStatus } from "@/features/routine";

import { RoutineIterationTimeline } from "./RoutineIterationTimeline";
import { RoutineScoreSparkline } from "./RoutineScoreSparkline";
import { routineStatusClass, scoreColorClass } from "./status-style";

type ControlAction = "start" | "pause" | "resume" | "cancel";

interface RoutineDetailDrawerProps {
  routine: RoutineDTO;
  onClose: () => void;
  onControl: (action: ControlAction) => void;
  onEdit: (r: RoutineDTO) => void;
  onDelete: (r: RoutineDTO) => void;
  onApproveIteration: (iterationId: string) => void;
  onRejectIteration: (iterationId: string) => void;
  busy?: boolean;
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-1.5 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="ml-4 break-all text-right text-foreground">{children}</span>
    </div>
  );
}

/** 依状态计算可用控制动作。 */
function controlsFor(status: RoutineStatus): ControlAction[] {
  switch (status) {
    case "pending":
      return ["start"];
    case "running":
      return ["pause", "cancel"];
    case "paused":
      return ["resume", "cancel"];
    default:
      return [];
  }
}

export function RoutineDetailDrawer({
  routine,
  onClose,
  onControl,
  onEdit,
  onDelete,
  onApproveIteration,
  onRejectIteration,
  busy,
}: RoutineDetailDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transform = "translateX(100%)";
    requestAnimationFrame(() => {
      el.style.transition = "transform 200ms ease-out";
      el.style.transform = "translateX(0)";
    });
  }, []);

  const iterations = routine.iterations ?? [];
  const ascending = [...iterations].sort((a, b) => a.seq - b.seq);
  const scores = ascending.map((it) => it.score);
  const controls = controlsFor(routine.status);
  const isTerminal = ["succeeded", "failed", "cancelled"].includes(routine.status);

  const controlLabel: Record<ControlAction, string> = {
    start: "Start",
    pause: "Pause",
    resume: "Resume",
    cancel: "Cancel",
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-overlay" onClick={onClose} />
      <div
        ref={panelRef}
        className="fixed inset-y-0 right-0 z-50 flex w-[460px] max-w-[92vw] flex-col border-l border-border bg-card shadow-xl"
        style={{ transform: "translateX(100%)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">{routine.display_name || routine.title}</h2>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${routineStatusClass(routine.status)}`}
              >
                {routine.status}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{routine.key}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close routine details"
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-auto px-5 py-4">
          {/* Goal */}
          <section>
            <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Goal</h3>
            <p className="whitespace-pre-wrap break-words rounded-lg border border-border p-3 text-xs text-foreground">
              {routine.goal}
            </p>
          </section>

          {/* Acceptance criteria */}
          <section>
            <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Acceptance Criteria</h3>
            <p className="whitespace-pre-wrap break-words rounded-lg border border-border p-3 text-xs text-text-secondary">
              {routine.acceptance_criteria}
            </p>
          </section>

          {/* Progress + budgets */}
          <section>
            <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Progress</h3>
            <div className="rounded-lg border border-border p-3">
              <div className="mb-2">
                <RoutineScoreSparkline scores={scores} threshold={routine.success_score_threshold} />
              </div>
              <DetailField label="Iterations">
                {routine.iteration_count}
                {routine.max_iterations ? ` / ${routine.max_iterations}` : ""}
              </DetailField>
              <DetailField label="Best Score">
                <span className={scoreColorClass(routine.best_score)}>{routine.best_score ?? "—"}</span>
              </DetailField>
              <DetailField label="Last Score">
                <span className={scoreColorClass(routine.last_score)}>{routine.last_score ?? "—"}</span>
              </DetailField>
              <DetailField label="Success Threshold">{routine.success_score_threshold}</DetailField>
              <DetailField label="Total Cost">
                ${routine.total_cost_usd.toFixed(4)}
                {routine.max_cost_usd ? ` / $${routine.max_cost_usd}` : ""}
              </DetailField>
              {routine.termination_reason && (
                <DetailField label="Termination">{routine.termination_reason}</DetailField>
              )}
            </div>
          </section>

          {/* Config */}
          <section>
            <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Config</h3>
            <div className="rounded-lg border border-border p-3">
              <DetailField label="Approval Mode">{routine.approval_mode}</DetailField>
              {routine.cwd && <DetailField label="Working Dir">{routine.cwd}</DetailField>}
              {routine.verification_command && (
                <DetailField label="Verify Cmd">
                  <code className="text-[10px]">{routine.verification_command}</code>
                </DetailField>
              )}
              {routine.claude_session_id && (
                <DetailField label="Session">
                  <code className="text-[10px]">{routine.claude_session_id.slice(0, 16)}…</code>
                </DetailField>
              )}
            </div>
          </section>

          {/* Iteration timeline */}
          <section>
            <h3 className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Iterations ({iterations.length})
            </h3>
            <RoutineIterationTimeline
              iterations={iterations}
              onApprove={onApproveIteration}
              onReject={onRejectIteration}
              busy={busy}
            />
          </section>
        </div>

        {/* Footer controls */}
        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          {controls.map((action) => (
            <Button
              key={action}
              variant={action === "cancel" ? "outline" : "neutral"}
              size="sm"
              disabled={busy}
              onClick={() => onControl(action)}
            >
              {controlLabel[action]}
            </Button>
          ))}
          <div className="flex-1" />
          {!["running"].includes(routine.status) && (
            <Button variant="neutral" size="sm" disabled={busy} onClick={() => onEdit(routine)}>
              Edit
            </Button>
          )}
          {isTerminal && (
            <button
              onClick={() => onDelete(routine)}
              disabled={busy}
              className="cursor-pointer rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </>
  );
}
