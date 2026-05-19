"use client";

import { useEffect, useMemo, useState } from "react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import {
  MemoryTimelineCard,
  RetryableErrorBanner,
  useMemoryTimeline,
  submitAudit,
  fetchAuditHistory,
  MemoryUserSelect,
} from "@/features/memory";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

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
  const timeline = useMemo(() => payload?.timeline || [], [payload?.timeline]);

  // D1: 选中用户后自动加载历史审计记录
  useEffect(() => {
    if (!selectedUserId) return;

    let active = true;

    const run = async () => {
      try {
        const data = await fetchAuditHistory(selectedUserId, APP_NAME);
        if (active) {
          setAuditHistory(data.items);
        }
      } catch (err) {
        // 审计历史加载失败不阻塞主功能
        console.error("Failed to load audit history:", err);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [selectedUserId]);

  const filteredTimeline = useMemo(() => {
    if (!selectedUserId) return timeline;
    return timeline.filter((item) => item.user_id === selectedUserId);
  }, [timeline, selectedUserId]);

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
        <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
          {/* D5: 统一 error banner（独立块，避免被 flex-row 兄弟挤占侧边栏空间） */}
          {/* M3: 5xx 等可重试错误暴露"重试"按钮，复用 RetryableErrorBanner */}
          <RetryableErrorBanner error={timelineError} onRetry={reloadTimeline} />


          <div className="flex min-h-0 flex-1 gap-6">
          {/* Main: Memories with audit actions */}
          <main className="min-h-0 min-w-0 flex-[3] overflow-y-auto">
            <div className="pb-4 pr-2">
              <div className="mb-4 flex items-center gap-3">
                <MemoryUserSelect
                  users={users}
                  selectedUserId={selectedUserId}
                  onSelect={(id) => {
                    setSelectedUserId(id);
                    setAuditMap({});
                  }}
                  loading={timelineLoading}
                />
              </div>
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
                      <div key={item.id}>
                        <MemoryTimelineCard item={item} />
                        <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 px-2.5 py-2 text-[11px] dark:bg-zinc-800/50">
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
                  {/* 把 `(s)` 升级为真正的英文复数，避免界面出现 "0 decision(s) pending" 这类
                      非自然写法。这里没有 JSX 表达式插入造成的 a11y 文本节点合并问题，仅是 copy 改进。 */}
                  {`${pendingCount} decision${pendingCount !== 1 ? "s" : ""} pending`}
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
    </div>
  );
}
