"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { ErrorBanner } from "@/components/ui/ErrorState";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import {
  controlRoutine,
  deleteRoutine,
  fetchRoutineDetail,
  useRoutineLive,
  useRoutineStream,
} from "@/features/routine";
import type {
  RoutineDTO,
  RoutineFilters,
} from "@/features/routine";

import { ClockProvider } from "./_components/ClockProvider";
import { RoutineEditDrawer, drawerKey, type DrawerMode } from "./_components/RoutineEditDrawer";
import { RoutineFilterBar } from "./_components/RoutineFilterBar";
import { RoutineHeader } from "./_components/RoutineHeader";
import { RoutineKpiStrip } from "./_components/RoutineKpiStrip";
import { RoutineTable } from "./_components/RoutineTable";

const DEFAULT_FILTERS: Partial<RoutineFilters> = { status: null, q: "" };

function RoutinePageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const selId = sp.get("sel");

  const [filters, setFilters] = useState<Partial<RoutineFilters>>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<RoutineDTO | null>(null);
  // null = 抽屉关闭；"create" = 新建；否则由 ?sel 派生的 routine-edit。
  const [createOpen, setCreateOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const { confirm, confirmDialog } = useConfirmDialog();
  const {
    routines,
    kpis,
    loading,
    error,
    refresh,
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

  // 统一抽屉 mode：新建优先；否则由 ?sel 派生的选中态进入 routine-edit。
  const drawerMode: DrawerMode | null = createOpen
    ? { kind: "routine-create" }
    : selected
      ? { kind: "routine-edit", routine: selected }
      : null;

  // 创建成功 → 关新建抽屉、刷新列表、打开新建任务详情（routine-edit）。
  // 编辑保存 → 仅刷新列表与选中详情，抽屉保持打开（草稿基线由抽屉自身重置）。
  const handleSaved = (result: RoutineDTO, kind: DrawerMode["kind"]) => {
    if (kind === "routine-create") {
      setCreateOpen(false);
      refresh();
      openDetail(result);
    } else {
      refresh();
      void refreshSelected(result.id);
    }
  };

  return (
    <div className="flex h-full flex-col bg-muted">
      <InterfaceNav title="Routine" />
      <div className="flex-1 overflow-auto">
        <ClockProvider active={clockActive}>
          <div className="space-y-5 px-6 py-6">
            <RoutineHeader connected={connected} onRefresh={refresh} loading={loading} onCreate={() => setCreateOpen(true)} onFromPreset={() => router.push("/interface/routine/templates")} />

            {error && <ErrorBanner message={error} />}

            <RoutineKpiStrip kpis={kpis} loading={loading} />

            <div className="min-w-[200px]">
              <RoutineFilterBar filters={filters} onChange={setFilters} />
            </div>

            <RoutineTable routines={routines} loading={loading} onSelect={openDetail} onOpenFull={openFull} />
          </div>
        </ClockProvider>
      </div>

      {drawerMode && (
        <RoutineEditDrawer
          key={drawerKey(drawerMode)}
          mode={drawerMode}
          onClose={() => (createOpen ? setCreateOpen(false) : closeDetail())}
          onSaved={handleSaved}
          onControl={handleControl}
          onDelete={(target) => handleDelete(target as RoutineDTO)}
          onOpenFull={openFull}
          busy={actionBusy}
        />
      )}

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
