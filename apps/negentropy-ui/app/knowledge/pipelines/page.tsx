"use client";

import { useEffect, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { fetchPipelines, KnowledgePipelinesPayload } from "@/lib/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

type RunRecord = KnowledgePipelinesPayload["runs"][number];

export default function KnowledgePipelinesPage() {
  const [payload, setPayload] = useState<KnowledgePipelinesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RunRecord | null>(null);

  useEffect(() => {
    let active = true;
    fetchPipelines(APP_NAME)
      .then((data) => {
        if (active) {
          setPayload(data);
          if (data.runs?.length) {
            setSelected(data.runs[0]);
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

  const runs = payload?.runs || [];

  return (
    <div className="min-h-screen bg-zinc-50">
      <KnowledgeNav title="Pipelines" description="作业运行与错误定位" />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[2.2fr_1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Runs</h2>
            <span className="text-xs text-zinc-500">{payload?.last_updated_at || "-"}</span>
          </div>
          {runs.length ? (
            <div className="mt-4 space-y-3 text-xs text-zinc-600">
              {runs.map((run) => (
                <button
                  key={run.id}
                  className={`w-full rounded-lg border px-3 py-2 text-left ${
                    selected?.id === run.id
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 text-zinc-700 hover:border-zinc-400"
                  }`}
                  onClick={() => setSelected(run)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{run.id}</span>
                    <span className="text-[11px] opacity-70">{run.status || "unknown"}</span>
                  </div>
                  <p className="mt-1 text-[11px] opacity-70">{run.trigger || "manual"}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">暂无作业</p>
          )}
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Run Detail</h2>
            {selected ? (
              <div className="mt-3 space-y-3 text-xs text-zinc-600">
                <div>
                  <p className="text-[11px] uppercase text-zinc-400">Input</p>
                  <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-zinc-50 p-3 text-[11px]">
                    {JSON.stringify(selected.input ?? {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-zinc-400">Output</p>
                  <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-zinc-50 p-3 text-[11px]">
                    {JSON.stringify(selected.output ?? {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-zinc-400">Error</p>
                  <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-zinc-50 p-3 text-[11px]">
                    {JSON.stringify(selected.error ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">选择作业查看详情</p>
            )}
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm">
            {error ? `加载失败：${error}` : `状态源：${payload ? "已加载" : "等待加载"}`}
          </div>
        </aside>
      </div>
    </div>
  );
}
