"use client";

import { useEffect, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import {
  fetchPipelines,
  KnowledgePipelinesPayload,
  PipelineRunRecord,
  upsertPipelines,
} from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

type RunRecord = PipelineRunRecord;

// 阶段顺序定义（用于排序显示）
const STAGE_ORDER = ["fetch", "delete", "chunk", "embed", "persist"];

// 操作类型中文名称
const OPERATION_LABELS: Record<string, string> = {
  ingest_text: "文本摄入",
  ingest_url: "URL 摄入",
  replace_source: "替换源",
};

// 阶段名称中文名称
const STAGE_LABELS: Record<string, string> = {
  fetch: "获取内容",
  delete: "删除旧记录",
  chunk: "文本分块",
  embed: "向量化",
  persist: "持久化",
};

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
      case "skipped":
        return "bg-zinc-300 dark:bg-zinc-600";
      default:
        return "bg-zinc-400";
    }
  };

  const formatDuration = (durationMs?: number, startedAt?: string, completedAt?: string) => {
    if (durationMs && durationMs > 0) {
      if (durationMs < 1000) {
        return `${durationMs}ms`;
      }
      const seconds = Math.round(durationMs / 1000);
      return `${seconds}s`;
    }
    if (startedAt && completedAt) {
      const start = new Date(startedAt).getTime();
      const end = new Date(completedAt).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
        const ms = end - start;
        if (ms < 1000) {
          return `${ms}ms`;
        }
        const seconds = Math.round(ms / 1000);
        return `${seconds}s`;
      }
    }
    return "-";
  };

  // 获取排序后的阶段列表
  const getSortedStages = (stages?: Record<string, RunRecord["stages"] extends Record<string, infer T> ? T : never>) => {
    if (!stages) return [];
    return Object.entries(stages).sort(([a], [b]) => {
      const indexA = STAGE_ORDER.indexOf(a);
      const indexB = STAGE_ORDER.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <KnowledgeNav title="Pipelines" description="作业运行与错误定位" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 gap-6 px-6 py-6">
          <div className="min-h-0 min-w-0 flex-[2.2] overflow-y-auto">
            <div className="pb-4 pr-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Runs</h2>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{payload?.last_updated_at || "-"}</span>
                    <button
                      className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
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
                  <div className="mt-4 space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {runs.map((run) => (
                      <button
                        key={run.id}
                        className={`w-full rounded-lg border px-3 py-2 text-left ${
                          selected?.id === run.id
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            : "border-zinc-200 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
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
                        <div className="mt-1 flex items-center justify-between text-[11px] opacity-70">
                          <span>
                            {run.operation ? OPERATION_LABELS[run.operation] || run.operation : (run.trigger || "manual")}
                          </span>
                          <span>{formatDuration(run.duration_ms, run.started_at, run.completed_at)}</span>
                        </div>
                        {/* 阶段进度条 */}
                        {run.stages && Object.keys(run.stages).length > 0 && (
                          <div className="mt-2 flex items-center gap-1">
                            {getSortedStages(run.stages).map(([stageName, stage]) => (
                              <div
                                key={stageName}
                                className={`h-1.5 flex-1 rounded-full ${statusColor(stage.status)}`}
                                title={`${STAGE_LABELS[stageName] || stageName}: ${stage.status}${stage.duration_ms ? ` (${stage.duration_ms}ms)` : ""}`}
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">暂无作业</p>
                )}
              </div>
            </div>
          </div>
          <aside className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="space-y-4 pb-4 pr-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Run Detail</h2>
                {selected ? (
                  <div className="mt-3 space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {/* 基本信息 */}
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
                      <p className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500">Info</p>
                      {selected.operation && (
                        <p className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                          Operation: {OPERATION_LABELS[selected.operation] || selected.operation}
                        </p>
                      )}
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">Started: {selected.started_at || "-"}</p>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">Completed: {selected.completed_at || "-"}</p>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        Duration: {formatDuration(selected.duration_ms, selected.started_at, selected.completed_at)}
                      </p>
                    </div>

                    {/* 阶段详情 */}
                    {selected.stages && Object.keys(selected.stages).length > 0 && (
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
                        <p className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500">Stages</p>
                        <div className="mt-2 space-y-2">
                          {getSortedStages(selected.stages).map(([stageName, stage]) => (
                            <div key={stageName} className="flex items-center gap-2 text-[11px]">
                              <span className={`h-2 w-2 rounded-full ${statusColor(stage.status)}`} />
                              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                {STAGE_LABELS[stageName] || stageName}
                              </span>
                              <span className="text-zinc-400">
                                {stage.duration_ms ? `${stage.duration_ms}ms` : "-"}
                              </span>
                              {stage.status === "skipped" && stage.reason && (
                                <span className="text-zinc-400 italic">({stage.reason})</span>
                              )}
                              {stage.error && (
                                <span className="truncate max-w-[120px] text-rose-500">
                                  {typeof stage.error === "object" && stage.error !== null && "message" in stage.error
                                    ? String((stage.error as { message?: unknown }).message)
                                    : JSON.stringify(stage.error)}
                                </span>
                              )}
                              {stage.output && (
                                <span className="truncate max-w-[120px] text-emerald-600 dark:text-emerald-400">
                                  {typeof stage.output === "object" && stage.output !== null && "chunk_count" in stage.output
                                    ? `${(stage.output as { chunk_count?: unknown }).chunk_count} chunks`
                                    : typeof stage.output === "object" && stage.output !== null && "record_count" in stage.output
                                      ? `${(stage.output as { record_count?: unknown }).record_count} records`
                                      : ""}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Input */}
                    <div>
                      <p className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500">Input</p>
                      <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-zinc-50 p-3 text-[11px] dark:bg-zinc-800">
                        {JSON.stringify(selected.input ?? {}, null, 2)}
                      </pre>
                    </div>

                    {/* Output */}
                    <div>
                      <p className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500">Output</p>
                      <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-zinc-50 p-3 text-[11px] dark:bg-zinc-800">
                        {JSON.stringify(selected.output ?? {}, null, 2)}
                      </pre>
                    </div>

                    {/* Error */}
                    {selected.error && Object.keys(selected.error as Record<string, unknown>).length > 0 && (
                      <div>
                        <p className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500">Error</p>
                        <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-rose-50 p-3 text-[11px] text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
                          {JSON.stringify(selected.error, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">选择作业查看详情</p>
                )}
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Timeline</h2>
                {runs.length ? (
                  <div className="mt-3 space-y-3">
                    {runs.map((run) => (
                      <div key={run.id} className="flex gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                        <div className="flex flex-col items-center">
                          <span className={`h-2 w-2 rounded-full ${statusColor(run.status)}`} />
                          <span className="h-full w-px bg-zinc-200 dark:bg-zinc-700" />
                        </div>
                        <div>
                          <p className="text-zinc-900 dark:text-zinc-100">{run.run_id || run.id}</p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            {run.operation ? OPERATION_LABELS[run.operation] || run.operation : (run.trigger || "manual")} · {formatDuration(run.duration_ms, run.started_at, run.completed_at)}
                          </p>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{run.started_at ? `开始 ${run.started_at}` : "开始 -"}</p>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                            {run.completed_at ? `结束 ${run.completed_at}` : "结束 -"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">暂无时间线</p>
                )}
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                {error
                  ? `加载失败：${error}`
                  : `状态源：${payload ? "已加载" : "等待加载"}${saveStatus ? ` | ${saveStatus}` : ""}`}
              </div>
              {retryQueue.length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-700 shadow-sm dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
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
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
