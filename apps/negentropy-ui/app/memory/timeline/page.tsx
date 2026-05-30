"use client";

import { useMemo, useState } from "react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import {
  RetryableErrorBanner,
  useMemoryTimeline,
  MemoryTimelineCard,
  MemoryUserPillFilter,
  MemorySidebarLayout,
  RetentionPolicyCard,
  LegendCard,
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

  const handleSearch = () => {
    if (searchQuery.trim() && selectedUserId) {
      search(selectedUserId, searchQuery.trim());
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    clearSearch();
  };

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
    <div className="flex h-full flex-col bg-background">
      <MemoryNav title="Timeline" description="用户记忆时间线" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
          <RetryableErrorBanner error={error} onRetry={reload} />

          <MemorySidebarLayout
            sidebar={
              <>
                <RetentionPolicyCard policies={policies} />
                <LegendCard />
              </>
            }
          >
            {/* User filter */}
            <div className="mb-4">
              <MemoryUserPillFilter
                users={users}
                activeUserId={selectedUserId}
                onSelect={(id) => {
                  setSelectedUserId(id);
                  handleClearSearch();
                }}
                loading={isLoading}
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-foreground">
                  {searchResult ? "Search Results" : "Memory Timeline"}
                </h2>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {displayItems.length} memories ·{" "}
                  {selectedUserId
                    ? users.find((u) => u.id === selectedUserId)?.name || selectedUserId
                    : "all users"}
                  {searchResult && ` · ${searchResult.count} result(s)`}
                </span>
              </div>

              {/* Search */}
              {selectedUserId && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs"
                    placeholder="Search memories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSearch}
                    disabled={!searchQuery.trim()}
                  >
                    Search
                  </Button>
                  {searchResult && (
                    <Button variant="outline" size="sm" onClick={handleClearSearch}>
                      Clear
                    </Button>
                  )}
                </div>
              )}

              <div className="mt-4 space-y-3">
                {displayItems.length ? (
                  searchResult ? (
                    displayItems.map((item) => (
                      <MemoryTimelineCard
                        key={item.id}
                        item={item}
                        isSearchResult
                      />
                    ))
                  ) : (
                    groupedTimeline.map((group) => (
                      <div key={group.date}>
                        <div className="sticky top-0 z-10 bg-card pb-1 pt-2 text-caption font-semibold text-muted-foreground">
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
                ) : isLoading ? (
                  <p className="text-xs text-muted-foreground">
                    <Spinner size="sm" className="mr-1.5 inline-block align-text-bottom" />
                    Loading memories...
                  </p>
                ) : (
                  <EmptyState
                    size="sm"
                    title={searchResult ? "No matching memories found" : "No memories found"}
                  />
                )}
              </div>
            </div>
          </MemorySidebarLayout>
        </div>
      </div>
    </div>
  );
}
