"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";

import { useActivityLog } from "@/hooks/useActivityLog";
import type { ActivityEntry } from "@/hooks/useActivityLog";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import { Pagination } from "@/components/ui/Pagination";
import { useInfiniteList, type ClientFetcher } from "@/hooks/useInfiniteList";
import { useInfiniteScrollSentinel, useScrollPageSync } from "@/hooks/useInfiniteScrollSentinel";

import {
  LEVEL_OPTIONS,
  LEVEL_DOT,
  LEVEL_BADGE,
  formatTimestamp,
} from "./ActivityLogPanel";

const PAGE_SIZE = 12;

interface ActivityDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ActivityDrawer({ open, onClose }: ActivityDrawerProps) {
  const { entries, levelFilter, setLevelFilter, reload, clear, totalCount } =
    useActivityLog();

  // 抽屉内滚动容器 ref（哨兵 / 滚动联动 observer 的 root，须为抽屉内 overflow 层，非 viewport）、
  // 程序化滚动闸门、待跳页号——镜像 Routine 样板。
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const programmaticScrollRef = useRef(false);
  const pendingPageRef = useRef<number | null>(null);

  // 客户端模式：entries 全量已在内存（localStorage 派生 + level 本地筛选）；
  // 仅做渐进切片，total 精确，无网络。level 变化作为 filters → 自动 reset 回第 1 页。
  const fetcher = useMemo<ClientFetcher<ActivityEntry>>(
    () => ({ kind: "client", items: entries }),
    [entries],
  );
  const list = useInfiniteList<ActivityEntry, { level: string | null }>({
    fetcher,
    pageSize: PAGE_SIZE,
    filters: { level: levelFilter },
    enabled: open,
  });

  // 无限滚动哨兵：滚到底（提前 200px）→ 揭示下一页。root = 抽屉内 overflow 容器。
  const { sentinelRef } = useInfiniteScrollSentinel({
    onReach: list.loadMore,
    enabled: list.hasMore && !list.loadingMore && !list.loading,
    root: scrollRootRef,
  });

  // 滚动联动当前页高亮：观测每页首项的 data-infinite-page 锚点。
  useScrollPageSync({
    enabled: open,
    onPageChange: list.goToPage,
    root: scrollRootRef,
    rescanKey: list.items.length,
    programmaticRef: programmaticScrollRef,
  });

  const handleGoToPage = useCallback(
    (target: number) => {
      pendingPageRef.current = target;
      programmaticScrollRef.current = true; // 抑制 observer 回写，防跳页与联动互相递归
      list.goToPage(target);
    },
    [list],
  );

  // 待跳页锚点出现即平滑滚动到该页首项（抽屉内 root 限定查询范围）。
  const { currentPage } = list;
  const itemsLen = list.items.length;
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
  }, [currentPage, itemsLen]);

  const handleLevelChange = useCallback(
    (level: typeof levelFilter) => {
      setLevelFilter(level); // 列表由 filters 变化自动 reset 回第 1 页
    },
    [setLevelFilter],
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="activity-log-panel"
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close drawer"
        className="absolute inset-0 bg-overlay backdrop-blur-[2px]"
      />
      <aside className="relative z-10 flex h-full [width:clamp(480px,66.67%,1100px)] flex-col border-l border-border bg-card shadow-xl">
        {/* Header */}
        <header className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                Activity
              </span>
              <span className="rounded-full bg-muted/50 px-2 py-0.5 text-micro font-semibold text-muted-foreground">
                {totalCount}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Level filter pills */}
          <nav className="mt-2 flex items-center gap-1 rounded-full bg-muted/50 p-0.5">
            {LEVEL_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                className={`rounded-full px-2.5 py-0.5 text-caption font-semibold transition-colors ${
                  levelFilter === opt.value
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => handleLevelChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="mt-2 flex items-center justify-end gap-2">
            <span className="text-caption text-muted-foreground">
              {entries.length}
              {levelFilter ? ` / ${totalCount}` : ""} entries
            </span>
            <button
              className={outlineButtonClassName(
                "neutral",
                "rounded-md px-2 py-1 text-caption font-semibold",
              )}
              onClick={reload}
            >
              Refresh
            </button>
            <button
              className={outlineButtonClassName(
                "danger",
                "rounded-md px-2 py-1 text-caption font-semibold",
              )}
              onClick={clear}
            >
              Clear All
            </button>
          </div>
        </header>

        {/* Body — 抽屉内滚动容器（哨兵 / 滚动联动 root） */}
        <div ref={scrollRootRef} className="flex-1 overflow-auto px-4 py-3">
          {list.items.length ? (
            <ul className="space-y-2">
              {list.items.map((entry, i) => (
                <li
                  key={entry.id}
                  data-infinite-page={i % PAGE_SIZE === 0 ? Math.floor(i / PAGE_SIZE) + 1 : undefined}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 shadow-sm"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT[entry.level]}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-micro font-semibold ${LEVEL_BADGE[entry.level]}`}
                      >
                        {entry.level}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-foreground">
                      {entry.message}
                    </p>
                    {entry.description ? (
                      <p className="mt-0.5 text-caption text-muted-foreground">
                        {entry.description}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No activity recorded yet. Toast notifications will appear here as
              they occur across the platform.
            </div>
          )}

          {/* 无限滚动哨兵：进入视口即揭示下一页。 */}
          <div ref={sentinelRef} aria-hidden className="h-px w-full" />
        </div>

        {/* Pagination — 居中统一控件（计数文案沿用「entries」语义） */}
        {entries.length > 0 && (
          <div className="border-t border-border px-4 py-1.5">
            <Pagination
              page={list.currentPage}
              totalPages={list.totalPages}
              onPageChange={handleGoToPage}
              total={list.total ?? undefined}
              itemLabel="entry"
              loadingMore={list.loadingMore}
            />
          </div>
        )}
      </aside>
    </div>
  );
}
