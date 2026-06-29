"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { ErrorBanner } from "@/components/ui/ErrorState";
import { InterfaceNav } from "@/components/ui/InterfaceNav";
import { Pagination } from "@/components/ui/Pagination";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import {
  cleanupWorktree,
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
import { RoutineTable } from "./_components/RoutineTable";
import { useRestartRoutine } from "./_components/useRestartRoutine";
import { useTerminateRoutine } from "./_components/useTerminateRoutine";

const DEFAULT_FILTERS: Partial<RoutineFilters> = { status: null, q: "", is_template: false };

const PAGE_SIZE = 10;

/** 列表排序时间戳：updated_at 优先，缺失回退 created_at；无效/缺失返回 null。 */
function rowTimestamp(r: RoutineDTO): number | null {
  const raw = r.updated_at ?? r.created_at;
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

/** Updated At 倒序：有时间者在前并按时间降序；皆缺失者置末；id 兜底保证刷新间排序稳定。 */
function compareByUpdatedDesc(a: RoutineDTO, b: RoutineDTO): number {
  const ta = rowTimestamp(a);
  const tb = rowTimestamp(b);
  if (ta != null && tb != null) {
    if (tb !== ta) return tb - ta;
  } else if (ta != null) {
    return -1;
  } else if (tb != null) {
    return 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function RoutinePageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const selId = sp.get("sel");

  const [filters, setFilters] = useState<Partial<RoutineFilters>>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<RoutineDTO | null>(null);
  // null = 抽屉关闭；"create" = 新建；否则由 ?sel 派生的 routine-edit。
  const [createOpen, setCreateOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  // 行内 Clean Up 在途 routine id（null=无）；按钮 busy/disabled + spinner，防二次点击。
  const [cleanupBusyId, setCleanupBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // SSE ghost-reopen 守卫：镜像 selected 供异步 SSE 回调读取「抽屉是否仍打开」，
  // 关闭时在 closeDetail 内同步清空，杜绝 stale-id 事件在 setSelected 提交前重开抽屉（§2）。
  const selectedRef = useRef<RoutineDTO | null>(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

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

  // 列表分页（客户端）：按 Updated At 倒序排序后切片。clockActive 与 KPI 仍读全量 routines，不受分页影响。
  const sortedRoutines = useMemo(() => [...routines].sort(compareByUpdatedDesc), [routines]);
  const totalPages = Math.max(1, Math.ceil(sortedRoutines.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages); // 渲染期钳制：列表变短时不滞留死页
  const pageRoutines = useMemo(
    () => sortedRoutines.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sortedRoutines, safePage],
  );

  // 刷新当前选中详情（含迭代）。
  const refreshSelected = useCallback(async (id: string) => {
    try {
      const detail = await fetchRoutineDetail(id);
      setSelected(detail);
    } catch {
      // ignore — 抽屉可能已关闭
    }
  }, []);

  // 重启失败 / 取消的 routine（列表行内 + 抽屉共用单一逻辑源）。
  const { requestRestart, restartDialog } = useRestartRoutine((updated) => {
    refresh();
    if (selId === updated.id) void refreshSelected(updated.id);
  });

  // 终止运行中 / 暂停的 routine（列表行内 + 抽屉共用单一逻辑源）。
  const { requestTerminate, terminateDialog } = useTerminateRoutine((updated) => {
    refresh();
    if (selId === updated.id) void refreshSelected(updated.id);
  });

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
    // 乐观即时关闭：与 openDetail 对称，使 drawerMode 立即变 null、抽屉卸载，
    // 规避 Next.js 同路由纯 query nav 下 useSearchParams 反应式不可靠（深链冷启动场景，§1）。
    selectedRef.current = null; // 同步清空：覆盖 setSelected(null) 提交前的微秒级竞态窗，配合 SSE 守卫杜绝 ghost 重开
    setSelected(null);
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
      // 以实际打开的 routine（selectedRef）为准，而非 URL 的 selId——后者在深链冷启动场景下可能 stale，
      // 会用旧 id 把已乐观关闭的抽屉重新打开（ghost-reopen，§2）。
      const id = selectedRef.current?.id;
      if (id && ev.id === id) void refreshSelected(id);
    },
    onIterationEvent: (ev) => {
      applyIterationEvent(ev);
      const id = selectedRef.current?.id;
      if (id && (ev.routine_id === id || ev.id === id)) void refreshSelected(id);
    },
  });

  // 生命周期控制：cancel 路由到确认对话框；其余直接执行。
  const handleControl = async (action: "start" | "pause" | "resume" | "cancel") => {
    if (!selected) return;
    if (action === "cancel") {
      requestTerminate(selected);
      return;
    }
    setActionBusy(true);
    try {
      const updated = await controlRoutine(selected.id, action);
      toast.success(`Routine ${{ start: "started", pause: "paused", resume: "resumed" }[action]}`);
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

  const handleCleanupWorktree = async (r: RoutineDTO) => {
    setCleanupBusyId(r.id);
    try {
      await cleanupWorktree(r.id);
      toast.success("Worktree cleaned up");
      refresh();
      if (selId === r.id) void refreshSelected(r.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clean up worktree");
    } finally {
      setCleanupBusyId(null);
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
            <RoutineHeader connected={connected} onRefresh={refresh} loading={loading} onCreate={() => setCreateOpen(true)} onFromPreset={() => router.push("/interface/routine/templates")} kpis={kpis} />

            {error && <ErrorBanner message={error} />}

            <div className="min-w-[200px]">
              <RoutineFilterBar
                filters={filters}
                onChange={(f) => {
                  setFilters(f);
                  setPage(1); // 筛选变更回到第 1 页
                }}
              />
            </div>

            <RoutineTable
              routines={pageRoutines}
              loading={loading}
              onSelect={openDetail}
              onOpenFull={openFull}
              onRestart={requestRestart}
              onTerminate={requestTerminate}
              onCleanupWorktree={handleCleanupWorktree}
              cleanupBusyId={cleanupBusyId}
            />

            {sortedRoutines.length > 0 && (
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
                total={sortedRoutines.length}
                itemLabel="routine"
                disabled={loading}
              />
            )}
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
          onRestart={requestRestart}
          onDelete={(target) => handleDelete(target as RoutineDTO)}
          onOpenFull={openFull}
          busy={actionBusy}
        />
      )}

      {confirmDialog}
      {restartDialog}
      {terminateDialog}
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
