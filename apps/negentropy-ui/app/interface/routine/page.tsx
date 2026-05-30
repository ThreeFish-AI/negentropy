"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { ErrorBanner } from "@/components/ui/ErrorState";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import {
  approveIteration,
  controlRoutine,
  createRoutine,
  deleteRoutine,
  fetchRoutineDetail,
  rejectIteration,
  updateRoutine,
  useRoutineLive,
  useRoutineStream,
} from "@/features/routine";
import type {
  RoutineCreatePayload,
  RoutineDTO,
  RoutineFilters,
  RoutineUpdatePayload,
} from "@/features/routine";

import { ClockProvider } from "./_components/ClockProvider";
import { RoutineDetailDrawer } from "./_components/RoutineDetailDrawer";
import { RoutineFilterBar } from "./_components/RoutineFilterBar";
import { RoutineFleetView } from "./_components/RoutineFleetView";
import { RoutineFormDialog } from "./_components/RoutineFormDialog";
import { RoutineHeader } from "./_components/RoutineHeader";
import { RoutineKpiStrip } from "./_components/RoutineKpiStrip";
import { RoutineTable } from "./_components/RoutineTable";
import { PresetPickerDialog } from "./_components/PresetPickerDialog";
import { RoutineViewToggle, type RoutineView } from "./_components/RoutineViewToggle";

const DEFAULT_FILTERS: Partial<RoutineFilters> = { status: null, q: "" };

function RoutinePageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const view: RoutineView = sp.get("view") === "fleet" ? "fleet" : "table";
  const selId = sp.get("sel");

  const [filters, setFilters] = useState<Partial<RoutineFilters>>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<RoutineDTO | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoutineDTO | null>(null);
  const [presetPickerOpen, setPresetPickerOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const { confirm, confirmDialog } = useConfirmDialog();
  const {
    routines,
    kpis,
    loading,
    error,
    refresh,
    latestByRoutine,
    seedLatest,
    applyRoutineEvent,
    applyIterationEvent,
  } = useRoutineLive(filters);

  // 时钟仅在有运行中任务时滴答（无在途零开销）。
  const clockActive = useMemo(() => routines.some((r) => r.status === "running"), [routines]);

  // 刷新当前选中详情（含迭代）。
  const refreshSelected = useCallback(async (id: string) => {
    try {
      const detail = await fetchRoutineDetail(id);
      setSelected(detail);
    } catch {
      // ignore — 抽屉可能已关闭
    }
  }, []);

  // ?sel 派生选中态：URL 变化即加载/清空详情（使浏览器后退 / Esc / 遮罩点击一致关闭）。
  useEffect(() => {
    if (!selId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 由 URL ?sel 同步选中态（外部源）
      setSelected(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const detail = await fetchRoutineDetail(selId);
        if (!cancelled) setSelected(detail);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selId]);

  // URL 导航助手（依赖 sp/router，仅在路由变化时重建 → 不破坏子组件 memo）。
  const setView = useCallback(
    (v: RoutineView) => {
      const next = new URLSearchParams(sp.toString());
      if (v === "fleet") next.set("view", "fleet");
      else next.delete("view");
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [router, sp],
  );

  const openDetail = useCallback(
    (r: RoutineDTO) => {
      setSelected(r); // 乐观即时打开（完整迭代由 ?sel effect 拉取）
      const next = new URLSearchParams(sp.toString());
      next.set("sel", r.id);
      router.push(`?${next.toString()}`, { scroll: false });
    },
    [router, sp],
  );

  const closeDetail = useCallback(() => {
    const next = new URLSearchParams(sp.toString());
    next.delete("sel");
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [router, sp]);

  const openFull = useCallback(
    (r: RoutineDTO) => {
      router.push(`/interface/routine/${r.id}`);
    },
    [router],
  );

  // SSE：路由事件去抖动刷新列表；迭代事件即时驱动闭环阶段；选中详情按需刷新。
  const { connected } = useRoutineStream({
    onRoutineEvent: (ev) => {
      applyRoutineEvent();
      if (selId && ev.id === selId) void refreshSelected(selId);
    },
    onIterationEvent: (ev) => {
      applyIterationEvent(ev);
      if (selId && (ev.routine_id === selId || ev.id === selId)) void refreshSelected(selId);
    },
  });

  const handleControl = async (action: "start" | "pause" | "resume" | "cancel") => {
    if (!selected) return;
    setActionBusy(true);
    try {
      const updated = await controlRoutine(selected.id, action);
      toast.success(`Routine ${{ start: "started", pause: "paused", resume: "resumed", cancel: "cancelled" }[action]}`);
      await refreshSelected(updated.id);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setActionBusy(false);
    }
  };

  const handleApprove = async (iterationId: string) => {
    if (!selected) return;
    setActionBusy(true);
    try {
      await approveIteration(selected.id, iterationId);
      toast.success("Iteration approved");
      await refreshSelected(selected.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async (iterationId: string) => {
    if (!selected) return;
    setActionBusy(true);
    try {
      await rejectIteration(selected.id, iterationId);
      toast.success("Iteration rejected");
      await refreshSelected(selected.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (r: RoutineDTO) => {
    setEditing(r);
    setFormOpen(true);
  };

  const handleDelete = async (r: RoutineDTO) => {
    const ok = await confirm({
      title: "Delete Routine",
      message: (
        <>
          Delete{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{r.display_name || r.key}</code>? This
          permanently removes all its iterations and cannot be undone.
        </>
      ),
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteRoutine(r.id);
      toast.success("Routine deleted");
      closeDetail();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleFormSubmit = async (
    mode: "create" | "edit",
    id: string | null,
    body: RoutineCreatePayload | RoutineUpdatePayload,
  ) => {
    if (mode === "create") {
      const created = await createRoutine(body as RoutineCreatePayload);
      toast.success("Routine created");
      setFormOpen(false);
      refresh();
      openDetail(created);
    } else if (mode === "edit" && id) {
      const updated = await updateRoutine(id, body as RoutineUpdatePayload);
      toast.success("Routine updated");
      setFormOpen(false);
      refresh();
      await refreshSelected(updated.id);
    }
  };

  return (
    <div className="flex h-full flex-col bg-muted">
      <InterfaceNav title="Routine" />
      <div className="flex-1 overflow-auto">
        <ClockProvider active={clockActive}>
          <div className="space-y-5 px-6 py-6">
            <RoutineHeader connected={connected} onRefresh={refresh} loading={loading} onCreate={handleCreate} onFromPreset={() => setPresetPickerOpen(true)} />

            {error && <ErrorBanner message={error} />}

            <RoutineKpiStrip kpis={kpis} loading={loading} />

            <div className="flex flex-wrap items-center gap-3">
              <RoutineViewToggle view={view} onChange={setView} />
              <div className="min-w-[200px] flex-1">
                <RoutineFilterBar filters={filters} onChange={setFilters} />
              </div>
            </div>

            {view === "table" ? (
              <RoutineTable routines={routines} loading={loading} onSelect={openDetail} />
            ) : (
              <RoutineFleetView
                routines={routines}
                latestByRoutine={latestByRoutine}
                loading={loading}
                seedLatest={seedLatest}
                onOpenDetail={openDetail}
                onOpenFull={openFull}
              />
            )}

            {selected && (
              <RoutineDetailDrawer
                routine={selected}
                onClose={closeDetail}
                onOpenFull={() => openFull(selected)}
                onControl={handleControl}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onApproveIteration={handleApprove}
                onRejectIteration={handleReject}
                busy={actionBusy}
              />
            )}
          </div>
        </ClockProvider>
      </div>

      <RoutineFormDialog open={formOpen} routine={editing} onClose={() => setFormOpen(false)} onSubmit={handleFormSubmit} />

      <PresetPickerDialog
        open={presetPickerOpen}
        onClose={() => setPresetPickerOpen(false)}
        onCreated={() => { refresh(); }}
      />

      {confirmDialog}
    </div>
  );
}

export default function RoutinePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full flex-col bg-muted">
          <InterfaceNav title="Routine" />
        </div>
      }
    >
      <RoutinePageInner />
    </Suspense>
  );
}
