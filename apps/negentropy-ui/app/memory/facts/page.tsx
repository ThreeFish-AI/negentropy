/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { useInfiniteList, type OffsetFetcher } from "@/hooks/useInfiniteList";
import { useInfiniteScrollSentinel, useScrollPageSync } from "@/hooks/useInfiniteScrollSentinel";
import {
  FactItem,
  FactHistoryItem,
  fetchFacts,
  searchFacts,
  fetchFactHistory,
  fetchMemories,
  MemoryUserPillFilter,
  MemorySidebarLayout,
  SidebarCard,
  LegendCard,
} from "@/features/memory";

import { FactCard } from "./_components/FactCard";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";
const PAGE_SIZE = 12; // 4 rows × 3 columns

/** useInfiniteList 的筛选键：用户 + 已提交的搜索词，任一变化即 reset 回第 1 页。 */
interface FactFilters {
  userId: string | null;
  /** 已提交的搜索词（由 Search 按钮 / Enter 触发，非输入框实时值）；空串 = 浏览模式。 */
  query: string;
}

export default function MemoryFactsPage() {
  const [users, setUsers] = useState<Array<{ id: string; label: string }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(""); // 输入框实时值（不触发取数）
  const [submittedQuery, setSubmittedQuery] = useState(""); // 已提交搜索词（触发取数）
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  // Fact History modal state
  const [historyFactId, setHistoryFactId] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<FactHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // 无限滚动 + 翻页：主内容区滚动容器 ref（哨兵 / 滚动联动 observer 的 root）、
  // 程序化滚动闸门、待跳页号（照搬 Routine 样板结构）。
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const programmaticScrollRef = useRef(false);
  const pendingPageRef = useRef<number | null>(null);

  // 偏移分页适配器：浏览态走 fetchFacts，搜索态走 searchFacts；
  // 两者同形（limit/offset → { count, total, items }），total 即全量总数，直接归一。
  const fetcher = useMemo<OffsetFetcher<FactItem, FactFilters>>(
    () => ({
      kind: "offset",
      fetchRange: async ({ offset, limit, filters }) => {
        const q = filters?.query.trim() ?? "";
        const uid = filters?.userId ?? undefined;
        // 搜索仅在选定用户时有效（searchFacts 必带 user_id）；否则回退浏览。
        if (q && uid) {
          const r = await searchFacts({ app_name: APP_NAME, user_id: uid, query: q, limit, offset });
          return { items: r.items, total: r.total };
        }
        const r = await fetchFacts(uid, APP_NAME, undefined, limit, offset);
        return { items: r.items, total: r.total };
      },
    }),
    [],
  );

  const filters = useMemo<FactFilters>(
    () => ({ userId: activeUserId, query: submittedQuery }),
    [activeUserId, submittedQuery],
  );

  const list = useInfiniteList<FactItem, FactFilters>({ fetcher, pageSize: PAGE_SIZE, filters });

  const facts = list.items;
  const total = list.total ?? 0;
  const userLabelMap = useMemo(
    () => new Map(users.map((u) => [u.id, u.label || u.id])),
    [users],
  );

  // 无限滚动哨兵：滚到底（提前 200px）→ 追加下一偏移页。root = 主内容区滚动容器。
  const { sentinelRef } = useInfiniteScrollSentinel({
    onReach: list.loadMore,
    enabled: list.hasMore && !list.loadingMore && !list.loading,
    root: scrollRootRef,
  });

  // 滚动联动当前页高亮：观测每页首卡的 data-infinite-page 锚点，取最靠上可见页。
  useScrollPageSync({
    enabled: true,
    onPageChange: list.goToPage,
    root: scrollRootRef,
    rescanKey: facts.length,
    programmaticRef: programmaticScrollRef,
  });

  // 点页码跳页：先经 hook 确保该页已加载（偏移单请求补齐缺口），再滚动到该页锚点。
  const handleGoToPage = useCallback(
    (target: number) => {
      pendingPageRef.current = target;
      programmaticScrollRef.current = true; // 抑制 observer 回写，防跳页与联动互相递归
      list.goToPage(target);
    },
    [list],
  );

  // 待跳页锚点出现即平滑滚动（缺口补齐时锚点随 items 增长后再现 → effect 重跑命中）。
  useEffect(() => {
    const target = pendingPageRef.current;
    if (target == null) return;
    const anchor = scrollRootRef.current?.querySelector<HTMLElement>(`[data-infinite-page="${target}"]`);
    if (!anchor) return; // 该页尚未渲染，待 items 增长后重跑
    anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    pendingPageRef.current = null;
    const t = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 600);
    return () => window.clearTimeout(t);
  }, [list.currentPage, facts.length]);

  useEffect(() => {
    setUsersLoading(true);
    fetchMemories(APP_NAME)
      .then((data) => setUsers(data.users || []))
      .catch(console.error)
      .finally(() => setUsersLoading(false));
  }, []);

  // 切换用户即回浏览态（与迁移前一致：原 user-switch effect 走 fetchFacts 浏览、忽略搜索词）。
  // 仅清「已提交搜索词」，输入框文本保留（对齐原行为）。
  useEffect(() => {
    setSubmittedQuery("");
  }, [activeUserId]);

  const handleSearch = () => {
    if (!searchQuery.trim() || !activeUserId) return;
    setSubmittedQuery(searchQuery.trim()); // 提交搜索词 → filters 变化 → useInfiniteList 自动 reset 回第 1 页
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSubmittedQuery(""); // 清空 → 回浏览态 → 自动 reset
  };

  const handleShowHistory = async (factId: string) => {
    setHistoryFactId(factId);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await fetchFactHistory(factId);
      setHistoryItems(data.items);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : String(err));
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCloseHistory = useCallback(() => {
    setHistoryFactId(null);
    setHistoryItems([]);
    setHistoryError(null);
  }, []);

  useEffect(() => {
    if (!historyFactId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCloseHistory();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [historyFactId, handleCloseHistory]);

  return (
    <div className="flex h-full flex-col bg-background">
      <MemoryNav title="Facts" description="语义记忆管理 (结构化 KV)" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
          <MemorySidebarLayout
            mainRef={scrollRootRef}
            sidebar={
              <>
                <SidebarCard title="Facts Overview">
                  <p className="mt-2 text-caption text-muted-foreground">
                    {activeUserId
                      ? `${total} facts for selected user`
                      : `${total} facts across ${users.length} users`}
                  </p>
                  {!activeUserId && users.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {users.slice(0, 8).map((u) => (
                        <button
                          key={u.id}
                          className="flex w-full items-center justify-between rounded-lg border border-border px-2.5 py-1.5 text-caption text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                          onClick={() => setActiveUserId(u.id)}
                        >
                          <span className="truncate">{u.label || u.id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </SidebarCard>
                <LegendCard />
              </>
            }
          >
            {/* User filter */}
            <div className="mb-4">
              <MemoryUserPillFilter
                users={users}
                activeUserId={activeUserId}
                onSelect={setActiveUserId} // 选用户由 useInfiniteList 自动 reset 回第 1 页
                loading={usersLoading}
              />
            </div>

            {list.error && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                {list.error}
              </div>
            )}

            {/* Search bar -- only when a specific user is selected */}
            {activeUserId && (
              <div className="mb-4 flex items-center gap-2">
                <input
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs"
                  placeholder="Search facts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button variant="outline" size="sm" onClick={handleSearch}>
                  Search
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearSearch}>
                  Clear
                </Button>
              </div>
            )}

            {/* Facts grid -- always shown */}
            {list.loading ? (
              <p className="text-xs text-muted-foreground">
                <Spinner size="sm" className="mr-1.5 inline-block align-text-bottom" />
                Loading facts...
              </p>
            ) : facts.length === 0 ? (
              <EmptyState
                size="sm"
                title={activeUserId ? "No facts found for this user." : "No facts found."}
              />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {facts.map((fact, i) => (
                    // 每 PAGE_SIZE 卡首卡挂 data-infinite-page 锚点，供翻页定位与滚动联动当前页。
                    <div
                      key={fact.id}
                      data-infinite-page={i % PAGE_SIZE === 0 ? Math.floor(i / PAGE_SIZE) + 1 : undefined}
                    >
                      <FactCard
                        fact={fact}
                        userLabel={activeUserId ? undefined : userLabelMap.get(fact.user_id)}
                        onShowHistory={handleShowHistory}
                      />
                    </div>
                  ))}
                </div>

                {/* 无限滚动哨兵：进入视口即追加下一页（hasMore 为否时 hook 自动停观察）。 */}
                <div ref={sentinelRef} aria-hidden className="h-px w-full" />

                {/* 居中翻页控件（总数 + 控件组居中成组），与无限滚动并存。 */}
                <div className="mt-6">
                  <Pagination
                    page={list.currentPage}
                    totalPages={list.totalPages}
                    onPageChange={handleGoToPage}
                    total={list.total ?? undefined}
                    itemLabel="fact"
                    disabled={list.loading}
                    loadingMore={list.loadingMore}
                  />
                </div>
              </>
            )}
          </MemorySidebarLayout>
        </div>
      </div>

      {/* Fact History Modal */}
      {historyFactId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay"
          onClick={handleCloseHistory}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fact-history-title"
          >
            <div className="flex items-center justify-between">
              <h3 id="fact-history-title" className="text-sm font-semibold text-foreground">
                Fact Version History
              </h3>
              <Button variant="ghost" size="sm" onClick={handleCloseHistory}>
                Close
              </Button>
            </div>
            <p className="mt-1 text-caption font-mono text-muted-foreground">
              {historyFactId}
            </p>

            {historyLoading ? (
              <p className="mt-4 text-xs text-muted-foreground">Loading history...</p>
            ) : historyError ? (
              <p className="mt-4 text-xs text-rose-600">{historyError}</p>
            ) : historyItems.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">No history available.</p>
            ) : (
              <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
                {historyItems.map((item, i) => (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-3 text-xs ${
                      i === 0
                        ? "border-foreground/20 bg-muted/20"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <p className="font-medium text-foreground">{item.key}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-micro ${
                          item.status === "active"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "border-border bg-muted/30 text-muted-foreground"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <pre className="mt-2 max-h-20 overflow-auto rounded-lg bg-muted/30 p-2 text-caption text-muted-foreground">
                      {JSON.stringify(item.value, null, 2)}
                    </pre>
                    <div className="mt-2 flex gap-3 text-caption text-muted-foreground">
                      <span>Confidence: {(item.confidence * 100).toFixed(0)}%</span>
                      {item.superseded_by && (
                        <span>Superseded by: {item.superseded_by.slice(0, 8)}...</span>
                      )}
                      <span>{item.created_at || "-"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
