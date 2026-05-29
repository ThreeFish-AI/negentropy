/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useState } from "react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import {
  FactListPayload,
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

export default function MemoryFactsPage() {
  const [users, setUsers] = useState<Array<{ id: string; label: string }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [payload, setPayload] = useState<FactListPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fact History modal state
  const [historyFactId, setHistoryFactId] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<FactHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadFacts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchFacts(activeUserId ?? undefined, APP_NAME);
      setPayload(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [activeUserId]);

  useEffect(() => {
    setUsersLoading(true);
    fetchMemories(APP_NAME)
      .then((data) => setUsers(data.users || []))
      .catch(console.error)
      .finally(() => setUsersLoading(false));
  }, []);

  useEffect(() => {
    loadFacts();
  }, [loadFacts]);

  const facts = payload?.items || [];
  const userLabelMap = new Map(users.map((u) => [u.id, u.label || u.id]));

  const handleSearch = async () => {
    if (!searchQuery.trim() || !activeUserId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await searchFacts({
        app_name: APP_NAME,
        user_id: activeUserId,
        query: searchQuery.trim(),
      });
      setPayload(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    loadFacts();
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
            sidebar={
              <>
                <SidebarCard title="Facts Overview">
                  <p className="mt-2 text-[11px] text-muted">
                    {activeUserId
                      ? `${facts.length} facts for selected user`
                      : `${facts.length} facts across ${users.length} users`}
                  </p>
                  {!activeUserId && users.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {users.slice(0, 8).map((u) => (
                        <button
                          key={u.id}
                          className="flex w-full items-center justify-between rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-muted transition-colors hover:border-foreground/20 hover:text-foreground"
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
                onSelect={setActiveUserId}
                loading={usersLoading}
              />
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                {error?.message || String(error)}
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
                <button
                  className={outlineButtonClassName("neutral", "rounded-lg px-3 py-2 text-xs")}
                  onClick={handleSearch}
                >
                  Search
                </button>
                <button
                  className={outlineButtonClassName("neutral", "rounded-lg px-3 py-2 text-xs")}
                  onClick={handleClearSearch}
                >
                  Clear
                </button>
              </div>
            )}

            {/* Facts grid -- always shown */}
            {isLoading ? (
              <p className="text-xs text-muted">Loading facts...</p>
            ) : facts.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
                <p className="text-sm text-muted">
                  {activeUserId ? "No facts found for this user." : "No facts found."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {facts.map((fact) => (
                  <FactCard
                    key={fact.id}
                    fact={fact}
                    userLabel={activeUserId ? undefined : userLabelMap.get(fact.user_id)}
                    onShowHistory={handleShowHistory}
                  />
                ))}
              </div>
            )}
          </MemorySidebarLayout>
        </div>
      </div>

      {/* Fact History Modal */}
      {historyFactId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
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
              <button
                className="text-xs text-muted hover:text-foreground"
                onClick={handleCloseHistory}
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-[11px] font-mono text-muted">
              {historyFactId}
            </p>

            {historyLoading ? (
              <p className="mt-4 text-xs text-muted">Loading history...</p>
            ) : historyError ? (
              <p className="mt-4 text-xs text-rose-600">{historyError}</p>
            ) : historyItems.length === 0 ? (
              <p className="mt-4 text-xs text-muted">No history available.</p>
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
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          item.status === "active"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "border-border bg-muted/30 text-muted"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <pre className="mt-2 max-h-20 overflow-auto rounded-lg bg-muted/30 p-2 text-[11px] text-muted">
                      {JSON.stringify(item.value, null, 2)}
                    </pre>
                    <div className="mt-2 flex gap-3 text-[11px] text-muted">
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
