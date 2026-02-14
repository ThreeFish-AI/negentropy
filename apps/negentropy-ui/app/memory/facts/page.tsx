"use client";

import { useCallback, useEffect, useState } from "react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import { FactListPayload, fetchFacts, searchFacts } from "@/features/memory";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

export default function MemoryFactsPage() {
  const [userId, setUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [payload, setPayload] = useState<FactListPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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
    if (userId.trim()) {
      setActiveUserId(userId.trim());
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

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
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
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
                    onClick={handleSearch}
                  >
                    Search
                  </button>
                  <button
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
