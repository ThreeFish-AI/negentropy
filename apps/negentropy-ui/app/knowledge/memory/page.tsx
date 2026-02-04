"use client";

import { useEffect, useMemo, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { fetchMemory, KnowledgeMemoryPayload, submitMemoryAudit } from "@/lib/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

type AuditAction = "retain" | "delete" | "anonymize";

export default function KnowledgeMemoryPage() {
  const [payload, setPayload] = useState<KnowledgeMemoryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [auditMap, setAuditMap] = useState<Record<string, AuditAction>>({});
  const [auditNote, setAuditNote] = useState("");
  const [auditStatus, setAuditStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchMemory(APP_NAME)
      .then((data) => {
        if (active) {
          setPayload(data);
          if (data.users?.length && !selectedUserId) {
            setSelectedUserId(data.users[0].id);
          }
        }
      })
      .catch((err) => {
        if (active) {
          setError(String(err));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const users = payload?.users || [];
  const timeline = payload?.timeline || [];
  const policies = payload?.policies || {};

  const filteredTimeline = useMemo(() => {
    if (!selectedUserId) {
      return timeline;
    }
    return timeline.filter((item) => item.user_id === selectedUserId);
  }, [timeline, selectedUserId]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <KnowledgeNav title="User Memory" description="用户记忆时间线与治理策略" />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1fr_2.2fr_1fr]">
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
                  <p className="text-xs font-semibold">{user.label || user.id}</p>
                </button>
              ))
            ) : (
              <p className="text-xs text-zinc-500">暂无用户列表</p>
            )}
          </div>
        </aside>
        <main className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Memory Timeline</h2>
            <span className="text-xs text-zinc-500">{selectedUserId || "all users"}</span>
          </div>
          <div className="mt-4 space-y-3">
            {filteredTimeline.length ? (
              filteredTimeline.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-200 p-3 text-xs">
                  <p className="text-zinc-900">{item.summary}</p>
                  <p className="mt-2 text-[11px] text-zinc-500">{item.source || "-"}</p>
                  <p className="mt-1 text-[11px] text-zinc-400">{item.timestamp || "-"}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    {(["retain", "delete", "anonymize"] as AuditAction[]).map((action) => (
                      <button
                        key={action}
                        className={`rounded-full border px-3 py-1 ${
                          auditMap[item.id] === action
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 text-zinc-600"
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
                    ))}
                  </div>
                  {auditMap[item.id] ? (
                    <p className="mt-2 text-[11px] text-emerald-600">
                      已标记：{auditMap[item.id]}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500">等待记忆同步结果</p>
            )}
          </div>
        </main>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Policy</h2>
            <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-zinc-50 p-3 text-[11px] text-zinc-600">
              {JSON.stringify(policies, null, 2)}
            </pre>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Memory Audit</h2>
            <textarea
              className="mt-3 w-full rounded border border-zinc-200 px-2 py-1 text-xs"
              rows={3}
              placeholder="审计备注"
              value={auditNote}
              onChange={(event) => setAuditNote(event.target.value)}
            />
            <button
              className="mt-3 w-full rounded bg-black px-3 py-2 text-xs font-semibold text-white"
              onClick={async () => {
                if (!selectedUserId) return;
                setAuditStatus("saving");
                try {
                  await submitMemoryAudit({
                    app_name: APP_NAME,
                    user_id: selectedUserId,
                    decisions: auditMap,
                    note: auditNote || undefined,
                  });
                  setAuditStatus("saved");
                } catch (err) {
                  setAuditStatus(`error:${String(err)}`);
                }
              }}
            >
              提交审计
            </button>
            {auditStatus ? <p className="mt-2 text-[11px] text-zinc-500">{auditStatus}</p> : null}
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm">
            {error ? `加载失败：${error}` : `状态源：${payload ? "已加载" : "等待加载"}`}
          </div>
        </aside>
      </div>
    </div>
  );
}
