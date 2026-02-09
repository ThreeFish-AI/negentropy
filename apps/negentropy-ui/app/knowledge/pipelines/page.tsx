"use client";

import { useEffect, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { fetchPipelines, KnowledgePipelinesPayload, upsertPipelines } from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

type RunRecord = KnowledgePipelinesPayload["runs"][number];

export default function KnowledgePipelinesPage() {
  const [payload, setPayload] = useState<KnowledgePipelinesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RunRecord | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [retryQueue, setRetryQueue] = useState<RunRecord[]>([]);

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
  const statusColor = (status?: string) => {
    switch ((status || "").toLowerCase()) {
      case "completed":
      case "success":
        return "bg-emerald-500";
      case "running":
      case "in_progress":
        return "bg-amber-500";
      case "failed":
      case "error":
        return "bg-rose-500";
      default:
        return "bg-zinc-400";
    }
  };

  const formatDuration = (durationMs?: number, startedAt?: string, completedAt?: string) => {
    if (durationMs && durationMs > 0) {
      const seconds = Math.round(durationMs / 1000);
      return `${seconds}s`;
    }
    if (startedAt && completedAt) {
      const start = new Date(startedAt).getTime();
      const end = new Date(completedAt).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
        const seconds = Math.round((end - start) / 1000);
        return `${seconds}s`;
      }
    }
    return "-";
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <KnowledgeNav title="Pipelines" description="作业运行与错误定位" />
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[2.2fr_1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Runs</h2>
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span>{payload?.last_updated_at || "-"}</span>
              <button
                className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] text-zinc-600 hover:border-zinc-900 hover:text-zinc-900"
                onClick={async () => {
                  if (!selected) return;
                  setSaveStatus("saving");
                  try {
                    await upsertPipelines({
                      app_name: APP_NAME,
                      run_id: selected.run_id,
                      status: selected.status || "completed",
                      payload: {
                        started_at: selected.started_at,
                        completed_at: selected.completed_at,
                        duration_ms: selected.duration_ms,
                        duration: selected.duration,
                        trigger: selected.trigger,
                        input: selected.input,
                        output: selected.output,
                        error: selected.error,
                      },
                      expected_version: selected.version,
                      idempotency_key: crypto.randomUUID(),
                    });
                    setSaveStatus("saved");
                  } catch (err) {
                    setSaveStatus(`error:${String(err)}`);
                    setRetryQueue((prev) => [...prev, selected]);
                  }
                }}
              >
                写回管线
              </button>
            </div>
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
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${statusColor(run.status)}`} />
                      <span className="text-xs font-semibold">{run.run_id || run.id}</span>
                    </div>
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
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-[11px] uppercase text-zinc-400">Timing</p>
                  <p className="mt-2 text-[11px] text-zinc-600">Started: {selected.started_at || "-"}</p>
                  <p className="text-[11px] text-zinc-600">Completed: {selected.completed_at || "-"}</p>
                  <p className="text-[11px] text-zinc-600">
                    Duration: {formatDuration(selected.duration_ms, selected.started_at, selected.completed_at)}
                  </p>
                </div>
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
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900">Timeline</h2>
            {runs.length ? (
              <div className="mt-3 space-y-3">
                {runs.map((run) => (
                  <div key={run.id} className="flex gap-3 text-xs text-zinc-600">
                    <div className="flex flex-col items-center">
                      <span className={`h-2 w-2 rounded-full ${statusColor(run.status)}`} />
                      <span className="h-full w-px bg-zinc-200" />
                    </div>
                    <div>
                      <p className="text-zinc-900">{run.run_id || run.id}</p>
                      <p className="text-[11px] text-zinc-500">
                        {run.trigger || "manual"} · {formatDuration(run.duration_ms, run.started_at, run.completed_at)}
                      </p>
                      <p className="text-[11px] text-zinc-400">{run.started_at ? `开始 ${run.started_at}` : "开始 -"}</p>
                      <p className="text-[11px] text-zinc-400">
                        {run.completed_at ? `结束 ${run.completed_at}` : "结束 -"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">暂无时间线</p>
            )}
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm">
            {error
              ? `加载失败：${error}`
              : `状态源：${payload ? "已加载" : "等待加载"}${saveStatus ? ` | ${saveStatus}` : ""}`}
          </div>
          {retryQueue.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-700 shadow-sm">
              <p className="font-semibold">待重试写回：{retryQueue.length}</p>
              <button
                className="mt-3 rounded bg-amber-600 px-3 py-2 text-[11px] font-semibold text-white"
                onClick={async () => {
                  const next = retryQueue[0];
                  if (!next) return;
                  setSaveStatus("retrying");
                  try {
                    await upsertPipelines({
                      app_name: APP_NAME,
                      run_id: next.run_id,
                      status: next.status || "completed",
                      payload: {
                        started_at: next.started_at,
                        completed_at: next.completed_at,
                        duration_ms: next.duration_ms,
                        duration: next.duration,
                        trigger: next.trigger,
                        input: next.input,
                        output: next.output,
                        error: next.error,
                      },
                      expected_version: next.version,
                      idempotency_key: crypto.randomUUID(),
                    });
                    setRetryQueue((prev) => prev.slice(1));
                    setSaveStatus("saved");
                  } catch (err) {
                    setSaveStatus(`error:${String(err)}`);
                  }
                }}
              >
                重试写回
              </button>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
