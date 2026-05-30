"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorState";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { Spinner } from "@/components/ui/Spinner";
import {
  approveIteration,
  controlRoutine,
  rejectIteration,
  useRoutineDetailLive,
} from "@/features/routine";

import { ClockProvider } from "../_components/ClockProvider";
import { RoutineRunView } from "../_components/RoutineRunView";
import { CONTROL_LABEL, controlsFor, type ControlAction } from "../_components/routine-controls";
import { routineStatusClass } from "../_components/status-style";

export default function RoutineRunPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : null;
  const { routine, loading, error, reload, connected } = useRoutineDetailLive(id);
  const [busy, setBusy] = useState(false);

  const handleControl = useCallback(
    async (action: ControlAction) => {
      if (!id) return;
      setBusy(true);
      try {
        await controlRoutine(id, action);
        toast.success(
          `Routine ${{ start: "started", pause: "paused", resume: "resumed", cancel: "cancelled" }[action]}`,
        );
        await reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Failed to ${action}`);
      } finally {
        setBusy(false);
      }
    },
    [id, reload],
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

  const clockActive = routine?.status === "running";
  const controls = routine ? controlsFor(routine.status) : [];

  return (
    <div className="flex h-full flex-col bg-muted">
      <InterfaceNav title="Routine" />
      <div className="flex-1 overflow-auto">
        <ClockProvider active={!!clockActive}>
          <div className="space-y-4 px-6 py-6">
            {/* 头部：返回 + 标题 + 状态 + 控制 */}
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
                  {routine?.key && <p className="truncate text-[11px] text-text-muted">{routine.key}</p>}
                </div>
                {routine && (
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${routineStatusClass(routine.status)}`}
                  >
                    {routine.status}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "animate-pulse bg-text-muted"}`}
                  />
                  {connected ? "Live" : "Reconnecting..."}
                </span>
                {controls.map((action) => (
                  <Button
                    key={action}
                    variant={action === "cancel" ? "outline" : "neutral"}
                    size="sm"
                    disabled={busy}
                    onClick={() => handleControl(action)}
                  >
                    {CONTROL_LABEL[action]}
                  </Button>
                ))}
              </div>
            </div>

            {error && <ErrorBanner message={error} onRetry={reload} />}

            {routine ? (
              <RoutineRunView
                routine={routine}
                onApproveIteration={handleApprove}
                onRejectIteration={handleReject}
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
    </div>
  );
}
