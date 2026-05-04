"use client";

import { useCallback, useEffect, useState } from "react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import {
  ConflictItem,
  fetchConflicts,
  resolveConflict,
} from "@/features/memory";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

const RESOLUTION_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "supersede", label: "Supersede" },
  { value: "keep_old", label: "Keep Old" },
  { value: "keep_new", label: "Keep New" },
  { value: "merge", label: "Merge" },
];

const RESOLUTION_COLORS: Record<string, string> = {
  pending:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  supersede:
    "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  keep_old:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  keep_new:
    "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  merge: "border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
};

export default function MemoryConflictsPage() {
  const [userId, setUserId] = useState("");
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [resolutionFilter, setResolutionFilter] = useState("");
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolveStatus, setResolveStatus] = useState<string | null>(null);

  const loadConflicts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchConflicts({
        user_id: activeUserId || undefined,
        app_name: APP_NAME,
        resolution: resolutionFilter || undefined,
        limit: 100,
      });
      setConflicts(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [activeUserId, resolutionFilter]);

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  const handleLoad = () => {
    const trimmed = userId.trim();
    setActiveUserId(trimmed || null);
  };

  const handleResolve = async (conflictId: string, resolution: string) => {
    setResolveStatus("resolving");
    try {
      await resolveConflict(conflictId, resolution);
      setResolveStatus("resolved");
      await loadConflicts();
    } catch (err) {
      setResolveStatus(`error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const selected = conflicts.find((c) => c.id === selectedId);

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <MemoryNav title="Conflicts" description="事实冲突检视与解决" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="pb-6">
            {/* Controls */}
            <div className="mb-6 flex items-center gap-3">
              <input
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs w-64 dark:border-zinc-700 dark:bg-zinc-800"
                placeholder="Filter by User ID (optional)"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLoad()}
              />
              <button
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-zinc-800 dark:text-zinc-100"
                onClick={handleLoad}
              >
                Filter
              </button>
              {activeUserId && (
                <button
                  className={outlineButtonClassName("neutral", "rounded-lg px-3 py-2 text-xs")}
                  onClick={() => {
                    setUserId("");
                    setActiveUserId(null);
                  }}
                >
                  Clear
                </button>
              )}
              <div className="h-4 w-px bg-zinc-200 mx-1 dark:bg-zinc-700" />
              <select
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                value={resolutionFilter}
                onChange={(e) => setResolutionFilter(e.target.value)}
              >
                {RESOLUTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="flex-1" />
              <button
                className={outlineButtonClassName("neutral", "rounded-lg px-3 py-2 text-xs")}
                onClick={loadConflicts}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Refresh"}
              </button>
              {activeUserId && (
                <span className="text-xs text-muted">Filtered: {activeUserId}</span>
              )}
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                {error}
              </div>
            )}

            {resolveStatus && (
              <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                {resolveStatus}
              </div>
            )}

            {isLoading ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading conflicts...</p>
            ) : conflicts.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No conflicts found.</p>
              </div>
            ) : (
              <div className="flex gap-6">
                {/* Conflict list */}
                <div className="min-w-0 flex-[2] space-y-3">
                  {conflicts.map((c) => (
                    <button
                      key={c.id}
                      className={`w-full rounded-lg border p-3 text-left text-xs transition-colors ${
                        selectedId === c.id
                          ? "border-zinc-900 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800"
                          : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
                      }`}
                      onClick={() => setSelectedId(c.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">
                            {c.conflict_type}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            by {c.detected_by} · user {c.user_id.slice(0, 8)}...
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] ${
                            RESOLUTION_COLORS[c.resolution] || RESOLUTION_COLORS.pending
                          }`}
                        >
                          {c.resolution}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-3 text-[11px] text-zinc-400 dark:text-zinc-500">
                        {c.old_fact_id && <span>Old: {c.old_fact_id.slice(0, 8)}...</span>}
                        {c.new_fact_id && <span>New: {c.new_fact_id.slice(0, 8)}...</span>}
                        <span>{c.created_at || "-"}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Detail panel */}
                <aside className="min-w-0 flex-1">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Conflict Detail
                    </h2>
                    {selected ? (
                      <div className="mt-4 space-y-3 text-xs">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Type
                          </p>
                          <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                            {selected.conflict_type}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Detected By
                          </p>
                          <p className="mt-1 text-zinc-900 dark:text-zinc-100">
                            {selected.detected_by}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Current Resolution
                          </p>
                          <span
                            className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] ${
                              RESOLUTION_COLORS[selected.resolution] || RESOLUTION_COLORS.pending
                            }`}
                          >
                            {selected.resolution}
                          </span>
                        </div>
                        {selected.old_fact_id && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                              Old Fact
                            </p>
                            <p className="mt-1 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                              {selected.old_fact_id}
                            </p>
                          </div>
                        )}
                        {selected.new_fact_id && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                              New Fact
                            </p>
                            <p className="mt-1 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                              {selected.new_fact_id}
                            </p>
                          </div>
                        )}

                        {selected.resolution === "pending" && (
                          <div className="mt-4 space-y-2">
                            <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                              Resolve
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {["supersede", "keep_old", "keep_new", "merge"].map((action) => (
                                <button
                                  key={action}
                                  className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
                                  onClick={() => handleResolve(selected.id, action)}
                                >
                                  {action}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                        Select a conflict to view details.
                      </p>
                    )}
                  </div>
                </aside>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
