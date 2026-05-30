/* eslint-disable react-hooks/set-state-in-effect --
 * React 19 + eslint-plugin-react-hooks v7.1.1 的 React Compiler 兼容新规则集
 * 在该文件中命中既有代码模式（useEffect 内调用 fetcher / ref 写入 / deps 校验等）。
 * 这些代码功能正确，仅是新规则严格度提升导致的告警；
 * TODO(react-compiler): 按 React Compiler 范式 / SWR / useSyncExternalStore 重构。
 */
"use client";

import { useCallback, useEffect, useState } from "react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import {
  ConflictItem,
  fetchConflicts,
  fetchMemories,
  resolveConflict,
  MemoryUserPillFilter,
  MemorySidebarLayout,
  SidebarCard,
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
  const [users, setUsers] = useState<Array<{ id: string; label: string }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [resolutionFilter, setResolutionFilter] = useState("");
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolveStatus, setResolveStatus] = useState<string | null>(null);

  useEffect(() => {
    setUsersLoading(true);
    fetchMemories(APP_NAME)
      .then((data) => setUsers(data.users || []))
      .catch(console.error)
      .finally(() => setUsersLoading(false));
  }, []);

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
    <div className="flex h-full flex-col bg-background">
      <MemoryNav title="Conflicts" description="事实冲突检视与解决" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
          <MemorySidebarLayout
            sidebar={
              <SidebarCard title="Conflict Detail">
                {selected ? (
                  <div className="mt-4 space-y-3 text-xs">
                    <div>
                      <p className="text-caption uppercase tracking-overline text-muted-foreground">
                        Type
                      </p>
                      <p className="mt-1 font-medium text-foreground">
                        {selected.conflict_type}
                      </p>
                    </div>
                    <div>
                      <p className="text-caption uppercase tracking-overline text-muted-foreground">
                        Detected By
                      </p>
                      <p className="mt-1 text-foreground">
                        {selected.detected_by}
                      </p>
                    </div>
                    <div>
                      <p className="text-caption uppercase tracking-overline text-muted-foreground">
                        Current Resolution
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-micro ${
                          RESOLUTION_COLORS[selected.resolution] || RESOLUTION_COLORS.pending
                        }`}
                      >
                        {selected.resolution}
                      </span>
                    </div>
                    {selected.old_fact_id && (
                      <div>
                        <p className="text-caption uppercase tracking-overline text-muted-foreground">
                          Old Fact
                        </p>
                        <p className="mt-1 font-mono text-caption text-muted-foreground">
                          {selected.old_fact_id}
                        </p>
                      </div>
                    )}
                    {selected.new_fact_id && (
                      <div>
                        <p className="text-caption uppercase tracking-overline text-muted-foreground">
                          New Fact
                        </p>
                        <p className="mt-1 font-mono text-caption text-muted-foreground">
                          {selected.new_fact_id}
                        </p>
                      </div>
                    )}

                    {selected.resolution === "pending" && (
                      <div className="mt-4 space-y-2">
                        <p className="text-caption uppercase tracking-overline text-muted-foreground">
                          Resolve
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {["supersede", "keep_old", "keep_new", "merge"].map((action) => (
                            <button
                              key={action}
                              className="rounded-full border border-border px-3 py-1 text-caption text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={resolveStatus === "resolving"}
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
                  <p className="mt-4 text-xs text-muted-foreground">
                    Select a conflict to view details.
                  </p>
                )}
              </SidebarCard>
            }
          >
            {/* Controls */}
            <div className="mb-4 flex items-center gap-3">
              <MemoryUserPillFilter
                users={users}
                activeUserId={activeUserId}
                onSelect={setActiveUserId}
                loading={usersLoading}
              />
              <div className="h-4 w-px bg-border mx-1" />
              <select
                aria-label="Filter by resolution"
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
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
              <Button
                variant="outline"
                size="sm"
                onClick={loadConflicts}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Refresh"}
              </Button>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                {error}
              </div>
            )}

            {resolveStatus && (
              <div className="mb-4 rounded-2xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                {resolveStatus}
              </div>
            )}

            {isLoading ? (
              <p className="text-xs text-muted-foreground">
                <Spinner size="sm" className="mr-1.5 inline-block align-text-bottom" />
                Loading conflicts...
              </p>
            ) : conflicts.length === 0 ? (
              <EmptyState
                size="sm"
                title="No conflicts found."
              />
            ) : (
              <div className="space-y-3">
                {conflicts.map((c) => (
                  <button
                    key={c.id}
                    className={`w-full rounded-lg border p-3 text-left text-xs transition-colors ${
                      selectedId === c.id
                        ? "border-foreground/30 bg-muted/20"
                        : "border-border bg-card hover:border-foreground/20"
                    }`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {c.conflict_type}
                        </p>
                        <p className="text-caption text-muted-foreground">
                          by {c.detected_by} · user {c.user_id.slice(0, 8)}...
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-micro ${
                          RESOLUTION_COLORS[c.resolution] || RESOLUTION_COLORS.pending
                        }`}
                      >
                        {c.resolution}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-3 text-caption text-muted-foreground">
                      {c.old_fact_id && <span>Old: {c.old_fact_id.slice(0, 8)}...</span>}
                      {c.new_fact_id && <span>New: {c.new_fact_id.slice(0, 8)}...</span>}
                      <span>{c.created_at || "-"}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </MemorySidebarLayout>
        </div>
      </div>
    </div>
  );
}
