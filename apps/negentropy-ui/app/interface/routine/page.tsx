"use client";

import { useCallback, useState } from "react";
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
  useRoutineData,
  useRoutineStream,
} from "@/features/routine";
import type {
  RoutineCreatePayload,
  RoutineDTO,
  RoutineFilters,
  RoutineUpdatePayload,
} from "@/features/routine";

import { RoutineDetailDrawer } from "./_components/RoutineDetailDrawer";
import { RoutineFilterBar } from "./_components/RoutineFilterBar";
import { RoutineFormDialog } from "./_components/RoutineFormDialog";
import { RoutineHeader } from "./_components/RoutineHeader";
import { RoutineKpiStrip } from "./_components/RoutineKpiStrip";
import { RoutineTable } from "./_components/RoutineTable";

const DEFAULT_FILTERS: Partial<RoutineFilters> = { status: null, q: "" };

export default function RoutinePage() {
  const [filters, setFilters] = useState<Partial<RoutineFilters>>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<RoutineDTO | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoutineDTO | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const { confirm, confirmDialog } = useConfirmDialog();
  const { routines, kpis, loading, error, refresh } = useRoutineData(filters);

  // 刷新当前选中详情（含迭代）
  const refreshSelected = useCallback(async (id: string) => {
    try {
      const detail = await fetchRoutineDetail(id);
      setSelected(detail);
    } catch {
      // ignore — drawer 可能已关闭
    }
  }, []);

  // SSE：路由 / 迭代事件到达时刷新列表与详情
  const { connected } = useRoutineStream({
    onRoutineEvent: () => {
      void refresh();
      if (selected) void refreshSelected(selected.id);
    },
    onIterationEvent: (ev) => {
      if (selected && (ev.routine_id === selected.id || ev.id === selected.id)) {
        void refreshSelected(selected.id);
      }
    },
  });

  const openDetail = async (r: RoutineDTO) => {
    setSelected(r);
    void refreshSelected(r.id);
  };

  const handleControl = async (action: "start" | "pause" | "resume" | "cancel") => {
    if (!selected) return;
    setActionBusy(true);
    try {
      const updated = await controlRoutine(selected.id, action);
      toast.success(`Routine ${action}ed`);
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
      setSelected(null);
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
      void openDetail(created);
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
        <div className="space-y-5 px-6 py-6">
          <RoutineHeader connected={connected} onRefresh={refresh} loading={loading} onCreate={handleCreate} />

          {error && <ErrorBanner message={error} />}

          <RoutineKpiStrip kpis={kpis} loading={loading} />
          <RoutineFilterBar filters={filters} onChange={setFilters} />
          <RoutineTable routines={routines} loading={loading} onSelect={openDetail} />

          {selected && (
            <RoutineDetailDrawer
              routine={selected}
              onClose={() => setSelected(null)}
              onControl={handleControl}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onApproveIteration={handleApprove}
              onRejectIteration={handleReject}
              busy={actionBusy}
            />
          )}
        </div>
      </div>

      <RoutineFormDialog open={formOpen} routine={editing} onClose={() => setFormOpen(false)} onSubmit={handleFormSubmit} />

      {confirmDialog}
    </div>
  );
}
