"use client";

import { useEffect, useMemo, useState } from "react";

import { MemoryNav } from "@/components/ui/MemoryNav";
import {
  MemoryTimelineCard,
  RetryableErrorBanner,
  useMemoryTimeline,
  submitAudit,
  fetchAuditHistory,
  MemoryUserPillFilter,
  MemorySidebarLayout,
  SidebarCard,
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
    <div className="flex h-full flex-col bg-background">
      <MemoryNav
        title="Audit"
        description="记忆审计治理 (Retain / Delete / Anonymize)"
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
          <RetryableErrorBanner error={timelineError} onRetry={reloadTimeline} />

          <MemorySidebarLayout
            sidebar={
              <>
                <SidebarCard title="Submit Audit">
                  <p className="mt-2 text-[11px] text-muted">
                    {`${pendingCount} decision${pendingCount !== 1 ? "s" : ""} pending`}
                  </p>
                  <textarea
                    className="mt-3 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
                    rows={3}
                    placeholder="Audit note (optional)"
                    value={auditNote}
                    onChange={(e) => setAuditNote(e.target.value)}
                  />
                  <button
                    className="mt-3 w-full rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-40"
                    disabled={!selectedUserId || pendingCount === 0}
                    onClick={handleSubmitAudit}
                  >
                    Submit ({pendingCount})
                  </button>
                  {auditStatus && (
                    <p className="mt-2 text-[11px] text-muted">{auditStatus}</p>
                  )}
                </SidebarCard>

                <SidebarCard title="Recent Audits">
                  {auditHistory.length ? (
                    <div className="mt-3 space-y-2 text-xs text-muted">
                      {auditHistory.slice(0, 10).map((record, i) => (
                        <div
                          key={`${record.memory_id}-${i}`}
                          className="rounded-lg border border-border p-2"
                        >
                          <p className="font-medium text-foreground">
                            {record.memory_id.slice(0, 8)}... → {record.decision}
                          </p>
                          {record.note && (
                            <p className="mt-1 text-[11px] text-muted">
                              {record.note}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-muted">
                            v{record.version} · {record.created_at || "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted">
                      {selectedUserId ? "No audits yet" : "Select a user to view audit history"}
                    </p>
                  )}
                </SidebarCard>
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
                  setAuditMap({});
                }}
                loading={timelineLoading}
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-foreground">
                  Memory Audit
                </h2>
                <span className="text-xs text-muted">
                  {selectedUserId || "select a user"}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {filteredTimeline.length ? (
                  filteredTimeline.map((item) => (
                    <div key={item.id}>
                      <MemoryTimelineCard item={item} />
                      <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-2 text-[11px]">
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
                                      : "border-foreground bg-foreground text-background"
                                  : "border-border text-muted hover:border-foreground/30 hover:text-foreground"
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
                            className="rounded-full border border-border px-3 py-1 text-muted hover:text-foreground"
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
                  <p className="text-xs text-muted">
                    {timelineLoading
                      ? "Loading memories..."
                      : "No memories found for this user"}
                  </p>
                )}
              </div>
            </div>
          </MemorySidebarLayout>
        </div>
      </div>
    </div>
  );
}
