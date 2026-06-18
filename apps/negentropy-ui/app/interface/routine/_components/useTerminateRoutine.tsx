"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { controlRoutine, type RoutineDTO } from "@/features/routine";

import { TerminateRoutineDialog } from "./TerminateRoutineDialog";

/**
 * 终止 Routine 的单一逻辑源——列表行内、抽屉、详情页三处入口共用，避免逻辑分叉。
 *
 * 返回 `requestTerminate(r)`（打开确认对话框）、`terminateDialog`（待渲染的对话框节点）、`busy`。
 * 确认后调 {@link controlRoutine}(id, "cancel")，成功/失败 toast，并回调 `onDone(updated)` 供调用方刷新。
 */
export function useTerminateRoutine(onDone?: (updated: RoutineDTO) => void) {
  const [target, setTarget] = useState<RoutineDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const requestTerminate = useCallback((r: RoutineDTO) => setTarget(r), []);
  const cancel = useCallback(() => {
    if (!busy) setTarget(null);
  }, [busy]);

  const confirm = useCallback(async () => {
    if (!target) return;
    setBusy(true);
    try {
      const updated = await controlRoutine(target.id, "cancel");
      toast.success("Routine terminated");
      setTarget(null);
      onDone?.(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to terminate");
    } finally {
      setBusy(false);
    }
  }, [target, onDone]);

  const terminateDialog = target ? (
    <TerminateRoutineDialog routine={target} busy={busy} onConfirm={confirm} onCancel={cancel} />
  ) : null;

  return { requestTerminate, terminateDialog, busy };
}
