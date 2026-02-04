"use client";

import { useEffect, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

export default function KnowledgePipelinesPage() {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/knowledge/pipelines?app_name=${encodeURIComponent(APP_NAME)}`, { cache: "no-store" })
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

  const runs = (payload?.runs as unknown[] | undefined) || [];

  return (
    <div className="min-h-screen bg-zinc-50">
      <KnowledgeNav title="Pipelines" description="作业运行与错误定位" />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[2.2fr_1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Runs</h2>
          {runs.length ? (
            <div className="mt-4 space-y-3 text-xs text-zinc-600">
              {runs.map((run, index) => (
                <div key={index} className="rounded-lg border border-zinc-200 p-3">
                  {JSON.stringify(run)}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">暂无作业</p>
          )}
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Run Detail</h2>
            <p className="mt-3 text-xs text-zinc-500">选择作业查看详情</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm">
            {error ? `加载失败：${error}` : `状态源：${payload ? "已加载" : "等待加载"}`}
          </div>
        </aside>
      </div>
    </div>
  );
}
