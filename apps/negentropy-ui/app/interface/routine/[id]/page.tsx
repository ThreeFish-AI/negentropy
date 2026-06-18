"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorState";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { Spinner } from "@/components/ui/Spinner";
import {
  approveIteration,
  cleanupWorktree,
  controlRoutine,
  rejectIteration,
  useRoutineDetailLive,
} from "@/features/routine";

import { ClockProvider } from "../_components/ClockProvider";
import { RoutineRunView } from "../_components/RoutineRunView";
import { canRestart, CONTROL_LABEL, controlsFor, type ControlAction } from "../_components/routine-controls";
import { phaseClass, phaseLabel, routineStatusClass } from "../_components/status-style";
import { useRestartRoutine } from "../_components/useRestartRoutine";
import { useTerminateRoutine } from "../_components/useTerminateRoutine";

export default function RoutineRunPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : null;
  const { routine, loading, error, reload, connected, liveActionsByIteration } = useRoutineDetailLive(id);
  const [busy, setBusy] = useState(false);

  // 终止 routine（需确认对话框门控）。
  const { requestTerminate, terminateDialog } = useTerminateRoutine(() => void reload());

  // 生命周期控制：cancel 路由到确认对话框；其余直接执行。
  const handleControl = useCallback(
    async (action: ControlAction) => {
      if (!id) return;
      if (action === "cancel") {
        if (routine) requestTerminate(routine);
        return;
      }
      setBusy(true);
      try {
        await controlRoutine(id, action);
        toast.success(
          `Routine ${{ start: "started", pause: "paused", resume: "resumed" }[action]}`,
        );
        await reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Failed to ${action}`);
      } finally {
        setBusy(false);
      }
    },
    [id, reload, routine, requestTerminate],
  );

  const handleApprove = useCallback(
    async (iterationId: string) => {
      if (!id) return;
      setBusy(true);
      try {
        await approveIteration(id, iterationId);
        toast.success("Iteration approved");
        await reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to approve");
      } finally {
        setBusy(false);
      }
    },
    [id, reload],
  );

  const handleReject = useCallback(
    async (iterationId: string) => {
      if (!id) return;
      setBusy(true);
      try {
        await rejectIteration(id, iterationId);
        toast.success("Iteration rejected");
        await reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to reject");
      } finally {
        setBusy(false);
      }
    },
    [id, reload],
  );

  const handleCleanupWorktree = useCallback(async () => {
    if (!id) return;
    setBusy(true);
    try {
      await cleanupWorktree(id);
      toast.success("Worktree cleaned up");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clean up worktree");
    } finally {
      setBusy(false);
    }
  }, [id, reload]);

  const { requestRestart, restartDialog } = useRestartRoutine(() => void reload());

  const clockActive = routine?.status === "running";
  const controls = routine ? controlsFor(routine.status) : [];

  return (
    <div className="flex h-full flex-col bg-muted">
      <InterfaceNav title="Routine" />
      <div className="flex-1 overflow-auto">
        <ClockProvider active={!!clockActive}>
          <div className="space-y-6 px-8 py-8">
            {/* 头部：返回 + 标题 + 状态 + 控制（双行结构） */}
            <div className="border-b border-border pb-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Link
                    href="/interface/routine"
                    aria-label="返回 Routine 列表"
                    className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                  <div className="min-w-0">
                    <h1 className="truncate text-xl font-bold text-foreground">
                      {routine?.display_name || routine?.title || "Routine"}
                    </h1>
                  </div>
                  {routine && (
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${routineStatusClass(routine.status)}`}
                    >
                      {routine.status}
                    </span>
                  )}
                  {routine?.current_phase && routine.status === "running" && (
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${phaseClass(routine.current_phase)}`}
                    >
                      {phaseLabel(routine.current_phase)}
                    </span>
                  )}
                </div>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-text-secondary">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "animate-pulse bg-text-muted"}`}
                  />
                  {connected ? "Live" : "Reconnecting..."}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                {routine?.key && <p className="truncate font-mono text-xs text-text-secondary">{routine.key}</p>}
                <div className="flex-1" />
                <div className="flex shrink-0 items-center gap-2">
                  {controls.map((action) => (
                    <Button
                      key={action}
                      variant={action === "cancel" ? "danger" : "neutral"}
                      size="sm"
                      disabled={busy}
                      onClick={() => handleControl(action)}
                    >
                      {CONTROL_LABEL[action]}
                    </Button>
                  ))}
                  {routine && canRestart(routine.status) && (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busy}
                      leftIcon={<RotateCcw className="h-4 w-4" />}
                      onClick={() => requestRestart(routine)}
                    >
                      Restart
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {error && <ErrorBanner message={error} onRetry={reload} />}

            {routine ? (
              <RoutineRunView
                routine={routine}
                onApproveIteration={handleApprove}
                onRejectIteration={handleReject}
                onCleanupWorktree={handleCleanupWorktree}
                liveActionsByIteration={liveActionsByIteration}
                busy={busy}
              />
            ) : loading ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" label="加载中" />
              </div>
            ) : (
              !error && (
                <div className="rounded-card border border-dashed border-border bg-card py-12 text-center text-sm text-text-muted">
                  未找到该 Routine。
                </div>
              )
            )}
          </div>
        </ClockProvider>
      </div>
      {restartDialog}
      {terminateDialog}
    </div>
  );
}
