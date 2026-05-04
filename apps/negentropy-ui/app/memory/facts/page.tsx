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
} from "@/features/memory";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

export default function MemoryFactsPage() {
  const [userId, setUserId] = useState("");
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
    if (!activeUserId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchFacts(activeUserId, APP_NAME);
      setPayload(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [activeUserId]);

  useEffect(() => {
    loadFacts();
  }, [loadFacts]);

  const facts = payload?.items || [];

  const handleLoadUser = () => {
    const trimmed = userId.trim();
    if (!trimmed) return;
    setActiveUserId(trimmed);
    if (activeUserId === trimmed) {
      setError(null);
      setIsLoading(true);
      fetchFacts(trimmed, APP_NAME)
        .then((data) => setPayload(data))
        .catch((err) => setError(err))
        .finally(() => setIsLoading(false));
    }
  };

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

  // Esc 关闭模态：仅在打开期间监听，避免无谓全局键盘开销。
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
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <MemoryNav title="Facts" description="语义记忆管理 (结构化 KV)" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="pb-6">
            {/* User selection */}
            <div className="flex items-center gap-3 mb-6">
              <input
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs w-64 dark:border-zinc-700 dark:bg-zinc-800"
                placeholder="Enter User ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLoadUser()}
              />
              <button
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-zinc-800 dark:text-zinc-100"
                onClick={handleLoadUser}
              >
                Load Facts
              </button>
              {activeUserId && (
                <>
                  <div className="h-4 w-px bg-zinc-200 mx-1 dark:bg-zinc-700" />
                  <input
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs w-48 dark:border-zinc-700 dark:bg-zinc-800"
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
                </>
              )}
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                {error?.message || String(error)}
              </div>
            )}

            {!activeUserId ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Enter a User ID to view their semantic memory (Facts).
                </p>
              </div>
            ) : isLoading ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading facts...</p>
            ) : facts.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No facts found for this user.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {facts.map((fact) => (
                  <div
                    key={fact.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {fact.key}
                      </p>
                      <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                        {fact.fact_type}
                      </span>
                    </div>
                    <pre className="mt-3 max-h-24 overflow-auto rounded-lg bg-zinc-50 p-3 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {JSON.stringify(fact.value, null, 2)}
                    </pre>
                    <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-zinc-400 dark:text-zinc-500">
                      <span>
                        Confidence: {(fact.confidence * 100).toFixed(0)}%
                      </span>
                      {fact.valid_from && <span>From: {fact.valid_from}</span>}
                      {fact.valid_until && <span>Until: {fact.valid_until}</span>}
                    </div>
                    <div className="mt-2">
                      <button
                        className="text-[11px] text-zinc-400 underline hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                        onClick={() => handleShowHistory(fact.id)}
                      >
                        History
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
            className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fact-history-title"
          >
            <div className="flex items-center justify-between">
              <h3 id="fact-history-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Fact Version History
              </h3>
              <button
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                onClick={handleCloseHistory}
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              {historyFactId}
            </p>

            {historyLoading ? (
              <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">Loading history...</p>
            ) : historyError ? (
              <p className="mt-4 text-xs text-rose-600">{historyError}</p>
            ) : historyItems.length === 0 ? (
              <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">No history available.</p>
            ) : (
              <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
                {historyItems.map((item, i) => (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-3 text-xs ${
                      i === 0
                        ? "border-zinc-900 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800"
                        : "border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.key}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          item.status === "active"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <pre className="mt-2 max-h-20 overflow-auto rounded bg-zinc-50 p-2 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {JSON.stringify(item.value, null, 2)}
                    </pre>
                    <div className="mt-2 flex gap-3 text-[11px] text-zinc-400 dark:text-zinc-500">
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
