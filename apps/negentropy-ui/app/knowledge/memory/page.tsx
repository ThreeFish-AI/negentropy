"use client";

import { useEffect, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

export default function KnowledgeMemoryPage() {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/knowledge/memory?app_name=${encodeURIComponent(APP_NAME)}`, { cache: "no-store" })
      .then((resp) => resp.json())
      .then((data) => {
        if (active) {
          setPayload(data as Record<string, unknown>);
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

  return (
    <div className="min-h-screen bg-zinc-50">
      <KnowledgeNav title="User Memory" description="用户记忆时间线与治理策略" />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1fr_2.2fr_1fr]">
        <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Users</h2>
          <p className="mt-3 text-xs text-zinc-500">暂无用户列表</p>
        </aside>
        <main className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Memory Timeline</h2>
          <p className="mt-3 text-xs text-zinc-500">等待记忆同步结果</p>
        </main>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Policy</h2>
            <p className="mt-3 text-xs text-zinc-500">保留/衰减/匿名化策略占位</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm">
            {error ? `加载失败：${error}` : `状态源：${payload ? "已加载" : "等待加载"}`}
          </div>
        </aside>
      </div>
    </div>
  );
}
