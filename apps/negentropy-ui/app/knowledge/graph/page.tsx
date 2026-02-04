"use client";

import { useEffect, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

export default function KnowledgeGraphPage() {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/knowledge/graph?app_name=${encodeURIComponent(APP_NAME)}`, { cache: "no-store" })
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
      <KnowledgeNav title="Knowledge Graph" description="实体关系视图与构建历史" />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[2.2fr_1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Graph Canvas</h2>
            <span className="text-xs text-zinc-500">缩放/拖拽预留</span>
          </div>
          <div className="mt-4 h-[360px] rounded-xl border border-dashed border-zinc-200 bg-zinc-50" />
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Entity Detail</h2>
            <p className="mt-2 text-xs text-zinc-500">暂无实体选中</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm">
            {error ? `加载失败：${error}` : `状态源：${payload ? "已加载" : "等待加载"}`}
          </div>
        </aside>
      </div>
    </div>
  );
}
