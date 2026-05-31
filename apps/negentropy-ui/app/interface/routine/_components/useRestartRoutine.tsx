"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { restartRoutine, type RoutineDTO } from "@/features/routine";

import { RestartRoutineDialog } from "./RestartRoutineDialog";

/**
 * 重启 Routine 的单一逻辑源——列表行内、抽屉、详情页三处入口共用，避免逻辑分叉。
 *
 * 返回 `requestRestart(r)`（打开确认对话框）、`restartDialog`（待渲染的对话框节点）、`busy`。
 * 确认后调 {@link restartRoutine}，成功/失败 toast，并回调 `onDone(updated)` 供调用方刷新。
 */
export function useRestartRoutine(onDone?: (updated: RoutineDTO) => void) {
  const [target, setTarget] = useState<RoutineDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const requestRestart = useCallback((r: RoutineDTO) => setTarget(r), []);
  const cancel = useCallback(() => {
    if (!busy) setTarget(null);
  }, [busy]);

  const confirm = useCallback(
    async (keepReflections: boolean) => {
      if (!target) return;
      setBusy(true);
      try {
        const updated = await restartRoutine(target.id, { keep_reflections: keepReflections });
        toast.success("Routine restarted");
        setTarget(null);
        onDone?.(updated);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to restart");
      } finally {
        setBusy(false);
      }
    },
    [target, onDone],
  );

  const restartDialog = target ? (
    <RestartRoutineDialog routine={target} busy={busy} onConfirm={confirm} onCancel={cancel} />
  ) : null;

  return { requestRestart, restartDialog, busy };
}
