"use client";

import { useMemo, useState } from "react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import {
  RetryableErrorBanner,
  useMemoryTimeline,
  MemoryTimelineCard,
} from "@/features/memory";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

// ---------------------------------------------------------------------------
// Time-grouping helpers
// ---------------------------------------------------------------------------

interface TimelineGroup {
  label: string;
  date: string;
  items: ReturnType<typeof useMemoryTimeline> extends {
    payload: infer P;
  }
    ? P extends { timeline: infer T }
      ? T
      : never
    : never;
}

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function groupByDate(
  items: Array<{ created_at?: string; id: string }>,
): TimelineGroup[] {
  const now = new Date();
  const today = toLocalDateStr(now);
  const yesterday = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

  const map = new Map<string, Array<{ created_at?: string; id: string }>>();
  for (const item of items) {
    const d = item.created_at ? new Date(item.created_at) : null;
    const dateStr = d && !isNaN(d.getTime()) ? toLocalDateStr(d) : "unknown";
    if (!map.has(dateStr)) map.set(dateStr, []);
    map.get(dateStr)!.push(item);
  }

  const groups: TimelineGroup[] = [];
  for (const [dateStr, groupItems] of map) {
    let label: string;
    if (dateStr === today) label = "Today";
    else if (dateStr === yesterday) label = "Yesterday";
    else label = dateStr;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    groups.push({ label, date: dateStr, items: groupItems as any });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function MemoryTimelinePage() {
  const {
    payload,
    searchResult,
    isLoading,
    error,
    selectedUserId,
    setSelectedUserId,
    reload,
    search,
    clearSearch,
  } = useMemoryTimeline({ appName: APP_NAME });

  const [searchQuery, setSearchQuery] = useState("");

  const users = payload?.users || [];
  const timeline = useMemo(() => payload?.timeline || [], [payload?.timeline]);
  const policies = payload?.policies || {};

  const filteredTimeline = useMemo(() => {
    if (!selectedUserId) return timeline;
    return timeline.filter((item) => item.user_id === selectedUserId);
  }, [timeline, selectedUserId]);

  // D2: 搜索处理
  const handleSearch = () => {
    if (searchQuery.trim() && selectedUserId) {
      search(selectedUserId, searchQuery.trim());
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    clearSearch();
  };

  // D2: 当有搜索结果时，将 searchResult.items 映射为 timeline 兼容格式
  const displayItems = searchResult
    ? searchResult.items.map((item) => ({
        id: item.id,
        content: item.content,
        retention_score: item.relevance_score || 0,
        importance_score: 0,
        memory_type: "search",
        access_count: 0,
        created_at: item.timestamp,
        user_id: selectedUserId || "",
        app_name: APP_NAME,
        metadata: item.metadata || {},
      }))
    : filteredTimeline;

  const groupedTimeline = useMemo(() => groupByDate(displayItems), [displayItems]);

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <MemoryNav title="Timeline" description="用户记忆时间线" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
          <RetryableErrorBanner error={error} onRetry={reload} />

          <div className="flex min-h-0 flex-1 gap-6">
            {/* Users sidebar */}
            <aside className="min-h-0 w-56 max-w-56 shrink-0 overflow-y-auto">
              <div className="pb-4 pr-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Users</h2>
                  <div className="mt-3 space-y-1.5">
                    {users.length ? (
                      users.map((user) => (
                        <button
                          key={user.id}
                          className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
                            selectedUserId === user.id
                              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                              : "border-zinc-200 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
                          }`}
                          onClick={() => {
                            setSelectedUserId(user.id);
                            handleClearSearch();
                          }}
                        >
                          <UserAvatar
                            picture={user.picture}
                            name={user.name}
                            email={user.email}
                            className="h-7 w-7 shrink-0"
                            fallbackClassName="h-7 w-7 text-[10px]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold">
                              {user.name || user.id}
                            </p>
                            <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                              {user.count} memories
                            </p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {isLoading ? "Loading..." : "No users found"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </aside>

            {/* Timeline */}
            <main className="min-h-0 min-w-0 flex-[2.2] overflow-y-auto">
              <div className="pb-4 pr-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {searchResult ? "Search Results" : "Memory Timeline"}
                    </h2>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {selectedUserId
                        ? users.find((u) => u.id === selectedUserId)?.name || selectedUserId
                        : "all users"}
                      {searchResult && ` · ${searchResult.count} result(s)`}
                    </span>
                  </div>

                  {/* D2: 搜索框 */}
                  {selectedUserId && (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                        placeholder="Search memories..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      />
                      <button
                        className={outlineButtonClassName("neutral", "rounded-lg px-3 py-2 text-xs")}
                        onClick={handleSearch}
                        disabled={!searchQuery.trim()}
                      >
                        Search
                      </button>
                      {searchResult && (
                        <button
                          className={outlineButtonClassName("neutral", "rounded-lg px-3 py-2 text-xs")}
                          onClick={handleClearSearch}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}

                  <div className="mt-4 space-y-3">
                    {displayItems.length ? (
                      searchResult ? (
                        // Flat list for search results
                        displayItems.map((item) => (
                          <MemoryTimelineCard
                            key={item.id}
                            item={item}
                            isSearchResult
                          />
                        ))
                      ) : (
                        // Time-grouped list for timeline
                        groupedTimeline.map((group) => (
                          <div key={group.date}>
                            <div className="sticky top-0 z-10 bg-white pb-1 pt-2 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                              {group.label}
                            </div>
                            <div className="space-y-2">
                              {group.items.map((item) => (
                                <MemoryTimelineCard key={item.id} item={item} />
                              ))}
                            </div>
                          </div>
                        ))
                      )
                    ) : (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {isLoading
                          ? "Loading memories..."
                          : searchResult
                            ? "No matching memories found"
                            : "No memories found"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </main>

            {/* Policies & Legend sidebar */}
            <aside className="min-h-0 min-w-0 flex-1 overflow-y-auto">
              <div className="space-y-4 pb-4 pr-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Retention Policy
                  </h2>
                  <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-zinc-50 p-3 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {JSON.stringify(policies, null, 2)}
                  </pre>
                </div>

                {/* Legend */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Legend</h2>

                  {/* Retention scores */}
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Retention
                  </p>
                  <div className="mt-1.5 space-y-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      High retention (&ge; 50%)
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Medium retention (10-50%)
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      Low retention (&lt; 10%)
                    </div>
                  </div>

                  {/* Importance scores */}
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Importance
                  </p>
                  <div className="mt-1.5 space-y-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      High importance (&ge; 70%)
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-500" />
                      Medium importance (40-70%)
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      Low importance (&lt; 40%)
                    </div>
                  </div>

                  {/* Memory types */}
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Memory Types
                  </p>
                  <div className="mt-1.5 space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-violet-500" /> Core
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" /> Semantic
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" /> Episodic
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Procedural
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-pink-500" /> Preference
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-500" /> Fact
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  Status: {payload ? "loaded" : "loading"}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
