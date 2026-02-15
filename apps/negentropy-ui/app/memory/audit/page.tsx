"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import {
  useMemoryTimeline,
  submitAudit,
  fetchAuditHistory,
} from "@/features/memory";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

type AuditAction = "retain" | "delete" | "anonymize";

export default function MemoryAuditPage() {
  const {
    payload,
    isLoading: timelineLoading,
    error: timelineError,
    selectedUserId,
    setSelectedUserId,
    reload: reloadTimeline,
  } = useMemoryTimeline({ appName: APP_NAME });

  const [auditMap, setAuditMap] = useState<Record<string, AuditAction>>({});
  const [auditNote, setAuditNote] = useState("");
  const [auditStatus, setAuditStatus] = useState<string | null>(null);
  const [auditHistory, setAuditHistory] = useState<
    Array<{
      memory_id: string;
      decision: string;
      version?: number;
      note?: string;
      created_at?: string;
    }>
  >([]);

  const users = payload?.users || [];
  const timeline = payload?.timeline || [];

  // D1: 选中用户后自动加载历史审计记录
  const loadAuditHistory = useCallback(async () => {
    if (!selectedUserId) return;
    try {
      const data = await fetchAuditHistory(selectedUserId, APP_NAME);
      setAuditHistory(data.items);
    } catch (err) {
      // 审计历史加载失败不阻塞主功能
      console.error("Failed to load audit history:", err);
    }
  }, [selectedUserId]);

  useEffect(() => {
    loadAuditHistory();
  }, [loadAuditHistory]);

  const filteredTimeline = useMemo(() => {
    if (!selectedUserId) return timeline;
    return timeline.filter((item) => item.user_id === selectedUserId);
  }, [timeline, selectedUserId]);

  const retentionColor = (score: number) => {
    if (score >= 0.5) return "bg-emerald-500";
    if (score >= 0.1) return "bg-amber-500";
    return "bg-rose-500";
  };

  const pendingCount = Object.keys(auditMap).length;

  const handleSubmitAudit = async () => {
    if (!selectedUserId || pendingCount === 0) return;
    setAuditStatus("saving");
    try {
      const result = await submitAudit({
        app_name: APP_NAME,
        user_id: selectedUserId,
        decisions: auditMap,
        note: auditNote || undefined,
        idempotency_key: crypto.randomUUID(),
      });
      setAuditMap({});
      setAuditNote("");
      setAuditStatus("saved");
      setAuditHistory((prev) => [...result.audits, ...prev]);
      await reloadTimeline();
    } catch (err) {
      setAuditStatus(`error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <MemoryNav
        title="Audit"
        description="记忆审计治理 (Retain / Delete / Anonymize)"
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 gap-6 px-6 py-6">
          {/* D5: 统一 error banner */}
          {timelineError && (
            <div className="absolute left-6 right-6 top-[calc(100%-2rem)] z-10 mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300 translate-y-[-100%]">
              {timelineError.message || String(timelineError)}
            </div>
          )}

          {/* Users sidebar */}
          <aside className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="pb-4 pr-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Users</h2>
                <div className="mt-3 space-y-2">
                  {users.length ? (
                    users.map((user) => (
                      <button
                        key={user.id}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${
                          selectedUserId === user.id
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                            : "border-zinc-200 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
                        }`}
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setAuditMap({});
                        }}
                      >
                        <p className="text-xs font-semibold">
                          {user.label || user.id}
                        </p>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {timelineLoading ? "Loading..." : "No users found"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* Main: Memories with audit actions */}
          <main className="min-h-0 min-w-0 flex-[2.2] overflow-y-auto">
            <div className="pb-4 pr-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Memory Audit
                  </h2>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {selectedUserId || "select a user"}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {filteredTimeline.length ? (
                    filteredTimeline.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-700"
                      >
                        <div className="flex items-start justify-between">
                          <p className="text-zinc-900 dark:text-zinc-100">
                            {item.content.length > 200
                              ? `${item.content.slice(0, 200)}...`
                              : item.content}
                          </p>
                          <div className="ml-3 flex items-center gap-2 shrink-0">
                            <span
                              className={`h-2 w-2 rounded-full ${retentionColor(item.retention_score)}`}
                            />
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                              {(item.retention_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-zinc-400 dark:text-zinc-500">
                          <span>Type: {item.memory_type}</span>
                          <span>Access: {item.access_count}x</span>
                          <span>{item.created_at || "-"}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                          {(["retain", "delete", "anonymize"] as AuditAction[]).map(
                            (action) => (
                              <button
                                key={action}
                                className={`rounded-full border px-3 py-1 transition-colors ${
                                  auditMap[item.id] === action
                                    ? action === "delete"
                                      ? "border-rose-600 bg-rose-600 text-white"
                                      : action === "anonymize"
                                        ? "border-amber-600 bg-amber-600 text-white"
                                        : "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                                    : "border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500"
                                }`}
                                onClick={() =>
                                  setAuditMap((prev) => ({
                                    ...prev,
                                    [item.id]: action,
                                  }))
                                }
                              >
                                {action}
                              </button>
                            ),
                          )}
                          {auditMap[item.id] && (
                            <button
                              className="rounded-full border border-zinc-200 px-3 py-1 text-zinc-400 hover:text-zinc-600 dark:border-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
                              onClick={() =>
                                setAuditMap((prev) => {
                                  const next = { ...prev };
                                  delete next[item.id];
                                  return next;
                                })
                              }
                            >
                              clear
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {timelineLoading
                        ? "Loading memories..."
                        : "No memories found for this user"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </main>

          {/* Audit controls sidebar */}
          <aside className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="space-y-4 pb-4 pr-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Submit Audit
                </h2>
                <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {pendingCount} decision(s) pending
                </p>
                <textarea
                  className="mt-3 w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                  rows={3}
                  placeholder="Audit note (optional)"
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                />
                <button
                  className="mt-3 w-full rounded bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-100"
                  disabled={!selectedUserId || pendingCount === 0}
                  onClick={handleSubmitAudit}
                >
                  Submit ({pendingCount})
                </button>
                {auditStatus && (
                  <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">{auditStatus}</p>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Recent Audits
                </h2>
                {auditHistory.length ? (
                  <div className="mt-3 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {auditHistory.slice(0, 10).map((record, i) => (
                      <div
                        key={`${record.memory_id}-${i}`}
                        className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700"
                      >
                        <p className="font-medium">
                          {record.memory_id.slice(0, 8)}... → {record.decision}
                        </p>
                        {record.note && (
                          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                            {record.note}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                          v{record.version} · {record.created_at || "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {selectedUserId ? "No audits yet" : "Select a user to view audit history"}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                Status: {payload ? "loaded" : "loading"}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
