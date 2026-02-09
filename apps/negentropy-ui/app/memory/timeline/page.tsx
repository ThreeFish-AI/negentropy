"use client";

import { useMemo } from "react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import { useMemoryTimeline } from "@/features/memory";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

export default function MemoryTimelinePage() {
  const {
    payload,
    isLoading,
    error,
    selectedUserId,
    setSelectedUserId,
  } = useMemoryTimeline({ appName: APP_NAME });

  const users = payload?.users || [];
  const timeline = payload?.timeline || [];
  const policies = payload?.policies || {};

  const filteredTimeline = useMemo(() => {
    if (!selectedUserId) return timeline;
    return timeline.filter((item) => item.user_id === selectedUserId);
  }, [timeline, selectedUserId]);

  const retentionColor = (score: number) => {
    if (score >= 0.5) return "bg-emerald-500";
    if (score >= 0.1) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <MemoryNav title="Timeline" description="用户记忆时间线" />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1fr_2.2fr_1fr]">
        {/* Users sidebar */}
        <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Users</h2>
          <div className="mt-3 space-y-2">
            {users.length ? (
              users.map((user) => (
                <button
                  key={user.id}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${
                    selectedUserId === user.id
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 text-zinc-700 hover:border-zinc-400"
                  }`}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <p className="text-xs font-semibold">
                    {user.label || user.id}
                  </p>
                </button>
              ))
            ) : (
              <p className="text-xs text-zinc-500">
                {isLoading ? "Loading..." : "No users found"}
              </p>
            )}
          </div>
        </aside>

        {/* Timeline */}
        <main className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Memory Timeline
            </h2>
            <span className="text-xs text-zinc-500">
              {selectedUserId || "all users"}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {filteredTimeline.length ? (
              filteredTimeline.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-zinc-200 p-3 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <p className="text-zinc-900 font-medium">
                      {item.content.length > 200
                        ? `${item.content.slice(0, 200)}...`
                        : item.content}
                    </p>
                    <div className="ml-3 flex items-center gap-2 shrink-0">
                      <span
                        className={`h-2 w-2 rounded-full ${retentionColor(item.retention_score)}`}
                      />
                      <span className="text-[11px] text-zinc-500">
                        {(item.retention_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-zinc-400">
                    <span>Type: {item.memory_type}</span>
                    <span>Access: {item.access_count}x</span>
                    <span>{item.created_at || "-"}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500">
                {isLoading ? "Loading memories..." : "No memories found"}
              </p>
            )}
          </div>
        </main>

        {/* Policies sidebar */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">
              Retention Policy
            </h2>
            <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-zinc-50 p-3 text-[11px] text-zinc-600">
              {JSON.stringify(policies, null, 2)}
            </pre>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Legend</h2>
            <div className="mt-3 space-y-2 text-[11px] text-zinc-600">
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
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm">
            {error
              ? `Error: ${error}`
              : `Status: ${payload ? "loaded" : "loading"}`}
          </div>
        </aside>
      </div>
    </div>
  );
}
