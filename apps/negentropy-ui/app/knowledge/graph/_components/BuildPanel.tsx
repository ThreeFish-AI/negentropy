"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { outlineButtonClassName } from "@/components/ui/button-styles";
import { Pagination } from "@/components/ui/Pagination";
import { useInfiniteList, type ClientFetcher } from "@/hooks/useInfiniteList";
import { useInfiniteScrollSentinel, useScrollPageSync } from "@/hooks/useInfiniteScrollSentinel";
import type { GraphBuildRunRecord } from "@/features/knowledge";

const BUILD_HISTORY_PAGE_SIZE = 5;

interface BuildPanelProps {
  building: boolean;
  corpusId: string | null;
  lastBuildError: string | null;
  onBuild: () => void;
}

function statusColor(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "running":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "cancelling":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "failed":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "cancelled":
      return "bg-muted text-text-secondary";
    default:
      return "bg-muted text-text-secondary";
  }
}

const CANCELLABLE_STATUSES = new Set(["pending", "running", "cancelling"]);

function formatDuration(run: GraphBuildRunRecord): string {
  if (!run.started_at) return "-";
  const start = new Date(run.started_at).getTime();
  const end = run.completed_at
    ? new Date(run.completed_at).getTime()
    : Date.now();
  const sec = Math.round((end - start) / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

interface BuildHistoryListProps {
  runs: GraphBuildRunRecord[];
  corpusId?: string | null;
  onCancel?: (run: GraphBuildRunRecord) => void;
}

export function BuildHistoryList({ runs, corpusId, onCancel }: BuildHistoryListProps) {
  // 无限滚动 + 翻页：滚动容器 ref（哨兵 / 滚动联动 observer 的 root）、程序化滚动闸门、待跳页号。
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const programmaticScrollRef = useRef(false);
  const pendingPageRef = useRef<number | null>(null);

  // 客户端模式：全量 runs 已在内存，仅做渐进切片（零网络、total 精确）。
  // deps:[runs] —— 父组件 `useMemo(() => …, [payload])` 在切换语料库 / 时间穿梭 /
  // 构建后重拉时整体重建 runs 数组（引用变化），useInfiniteList 据此 reset 回第 1 页，
  // 覆盖此前「render 期间引用比较重置 page」的全部刷新场景。
  const fetcher = useMemo<ClientFetcher<GraphBuildRunRecord>>(
    () => ({ kind: "client", items: runs }),
    [runs],
  );
  const list = useInfiniteList<GraphBuildRunRecord>({
    fetcher,
    pageSize: BUILD_HISTORY_PAGE_SIZE,
    deps: [runs],
  });
  const pageRuns = list.items;

  // 无限滚动哨兵：滚到底（提前 200px）→ 渐进揭示下一页。root = 列表内嵌滚动容器。
  const { sentinelRef } = useInfiniteScrollSentinel({
    onReach: list.loadMore,
    enabled: list.hasMore && !list.loadingMore,
    root: scrollRootRef,
  });

  // 滚动联动当前页高亮：观测每页首项的 data-infinite-page 锚点，取最靠上可见页。
  useScrollPageSync({
    enabled: true,
    onPageChange: list.goToPage,
    root: scrollRootRef,
    rescanKey: pageRuns.length,
    programmaticRef: programmaticScrollRef,
  });

  // 点页码跳页：客户端切片即时揭示该页，再滚动到该页锚点。
  const handleGoToPage = useCallback(
    (target: number) => {
      pendingPageRef.current = target;
      programmaticScrollRef.current = true; // 抑制 observer 回写，防跳页与联动互相递归
      list.goToPage(target);
    },
    [list],
  );

  // 待跳页锚点出现即平滑滚动（揭示更多页后锚点再现 → effect 重跑命中）。
  useEffect(() => {
    const target = pendingPageRef.current;
    if (target == null) return;
    const anchor = scrollRootRef.current?.querySelector<HTMLElement>(`[data-infinite-page="${target}"]`);
    if (!anchor) return;
    anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    pendingPageRef.current = null;
    const t = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 600);
    return () => window.clearTimeout(t);
  }, [list.currentPage, pageRuns.length]);

  if (!runs.length) {
    return (
      <p className="mt-2 text-xs text-text-muted">
        暂无构建记录
      </p>
    );
  }

  const showPager = runs.length > BUILD_HISTORY_PAGE_SIZE;

  return (
    <div className="mt-3 space-y-2">
      {/* 内嵌滚动容器同时作为无限滚动哨兵 / 滚动联动 observer 的 root。 */}
      <div ref={scrollRootRef} className="max-h-[360px] space-y-2 overflow-y-auto">
      {pageRuns.map((run, i) => (
        <div
          key={run.run_id}
          data-infinite-page={
            i % BUILD_HISTORY_PAGE_SIZE === 0 ? Math.floor(i / BUILD_HISTORY_PAGE_SIZE) + 1 : undefined
          }
          className="rounded-lg border border-border p-3"
        >
          <div className="flex items-center justify-between">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-micro font-medium ${statusColor(run.status)}`}
            >
              {run.status}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-micro text-text-muted">
                {formatDuration(run)}
              </span>
              {CANCELLABLE_STATUSES.has(run.status) && onCancel && corpusId && (
                <button
                  type="button"
                  className="text-micro text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                  onClick={() => onCancel(run)}
                  disabled={run.status === "cancelling"}
                  title={run.status === "cancelling" ? "正在取消..." : "取消此构建"}
                >
                  {run.status === "cancelling" ? "取消中" : "取消"}
                </button>
              )}
            </div>
          </div>
          <div className="mt-1.5 flex gap-3 text-caption text-text-secondary">
            <span>实体 {run.entity_count}</span>
            <span>关系 {run.relation_count}</span>
            {run.model_name && <span>模型 {run.model_name}</span>}
          </div>
          {run.error_message && (
            <p className="mt-1 text-micro text-red-600 dark:text-red-400 line-clamp-2">
              {run.error_message}
            </p>
          )}
          {run.started_at && (
            <p className="mt-1 text-micro text-text-muted">
              {new Date(run.started_at).toLocaleString()}
            </p>
          )}
        </div>
      ))}
        {/* 无限滚动哨兵：进入视口即揭示下一页（hasMore 为否时 hook 自动停观察）。 */}
        <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      </div>
      {showPager && (
        <Pagination
          page={list.currentPage}
          totalPages={list.totalPages}
          onPageChange={handleGoToPage}
          total={list.total ?? undefined}
          itemLabel="run"
          loadingMore={list.loadingMore}
        />
      )}
    </div>
  );
}

export function BuildPanel({
  building,
  corpusId,
  lastBuildError,
  onBuild,
}: BuildPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          className={outlineButtonClassName("neutral", "rounded-lg px-4 py-2 text-xs font-medium")}
          onClick={onBuild}
          disabled={!corpusId || building}
        >
          {building ? "构建中..." : "构建图谱"}
        </button>
        {!corpusId && (
          <span className="text-micro text-text-muted">
            请先选择语料库
          </span>
        )}
      </div>
      {lastBuildError && (
        <p className="text-caption text-red-600 dark:text-red-400">
          {lastBuildError}
        </p>
      )}
    </div>
  );
}
