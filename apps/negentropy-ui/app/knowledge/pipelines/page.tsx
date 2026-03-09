"use client";

import { useCallback, useEffect, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import {
  buildPipelineErrorDetails,
  calculateStageWidth,
  fetchPipelines,
  formatDuration,
  getStageErrorSummary,
  getPipelineStatusColor,
  getSortedStages,
  getStageColor,
  KnowledgePipelinesPayload,
  PipelineStatusBadge,
  PipelineRunRecord,
  upsertPipelines,
  STAGE_LABELS,
} from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";
const RUNNING_POLL_INTERVAL_MS = 3000;
const BOOTSTRAP_POLL_INTERVAL_MS = 1000;
const BOOTSTRAP_POLL_MAX_TICKS = 8;

type RunRecord = PipelineRunRecord;

// 操作类型中文名称
const OPERATION_LABELS: Record<string, string> = {
  ingest_text: "文本摄入",
  ingest_url: "URL 摄入",
  replace_source: "替换源",
  sync_source: "同步源",
  rebuild_source: "重建源",
};

// 检查是否有运行中的 Run
const hasRunningRuns = (runs: PipelineRunRecord[] | undefined): boolean => {
  return (
    runs?.some((run) => {
      const status = run.status?.toLowerCase();
      return status === "running" || status === "in_progress";
    }) ?? false
  );
};

interface RunsSnapshot {
  count: number;
  firstRunId: string | null;
  firstStatus: string | null;
  firstVersion: number | null;
}

const createRunsSnapshot = (
  runs: PipelineRunRecord[] | undefined,
): RunsSnapshot => {
  const first = runs?.[0];
  return {
    count: runs?.length ?? 0,
    firstRunId: first?.run_id ?? null,
    firstStatus: first?.status ?? null,
    firstVersion: first?.version ?? null,
  };
};

const isSameRunsSnapshot = (a: RunsSnapshot, b: RunsSnapshot): boolean => {
  return (
    a.count === b.count &&
    a.firstRunId === b.firstRunId &&
    a.firstStatus === b.firstStatus &&
    a.firstVersion === b.firstVersion
  );
};

export default function KnowledgePipelinesPage() {
  const [payload, setPayload] = useState<KnowledgePipelinesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RunRecord | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [retryQueue, setRetryQueue] = useState<RunRecord[]>([]);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  const applyPayload = useCallback((data: KnowledgePipelinesPayload) => {
    setPayload(data);
    setError(null);
    setSelected((prev) => {
      if (!data.runs?.length) return null;
      if (!prev) return data.runs[0];
      const updated = data.runs.find((r) => r.id === prev.id);
      return updated ?? data.runs[0];
    });
  }, []);

  const loadPipelines = useCallback(async () => {
    const data = await fetchPipelines(APP_NAME);
    applyPayload(data);
    return data;
  }, [applyPayload]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchPipelines(APP_NAME);
        if (!active) return;
        applyPayload(data);
        setHasInitialLoad(true);
      } catch (err) {
        if (active) {
          setError(String(err));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [applyPayload]);

  // 首屏兜底轮询（避免刚跳转时因时序空窗漏掉新 Run）
  useEffect(() => {
    if (!hasInitialLoad) return;
    if (hasRunningRuns(payload?.runs)) return;

    let active = true;
    let tick = 0;
    const baseline = createRunsSnapshot(payload?.runs);

    const intervalId = setInterval(async () => {
      tick += 1;
      try {
        const data = await fetchPipelines(APP_NAME);
        if (!active) return;

        const nextSnapshot = createRunsSnapshot(data.runs);
        const changed = !isSameRunsSnapshot(baseline, nextSnapshot);
        const running = hasRunningRuns(data.runs);

        if (changed || running) {
          applyPayload(data);
          clearInterval(intervalId);
          return;
        }
      } catch (err) {
        if (!active) return;
        setError(String(err));
      }

      if (tick >= BOOTSTRAP_POLL_MAX_TICKS) {
        clearInterval(intervalId);
      }
    }, BOOTSTRAP_POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [applyPayload, hasInitialLoad, payload?.runs]);

  // 自动刷新 Effect（当有 running 状态时启动）
  useEffect(() => {
    if (!hasRunningRuns(payload?.runs)) return;

    const intervalId = setInterval(() => {
      loadPipelines().catch((err) => {
        setError(String(err));
      });
    }, RUNNING_POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [loadPipelines, payload?.runs]);

  const runs = payload?.runs || [];
  const selectedErrorDetails = selected ? buildPipelineErrorDetails(selected) : [];
  const detailJsonClassName =
    "mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 text-[11px] dark:bg-zinc-800";
  const errorJsonClassName =
    "mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-rose-50 p-3 text-[11px] text-rose-700 dark:bg-rose-900/20 dark:text-rose-400";

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <KnowledgeNav title="Pipelines" description="作业运行与错误定位" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
          <section className="min-h-0 min-w-0 overflow-hidden overflow-y-auto">
            <div className="pb-4 pr-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Runs</h2>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{payload?.last_updated_at || "-"}</span>
                    <button
                      className={outlineButtonClassName("neutral", "rounded-full px-3 py-1 text-[11px]")}
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
                        className={`w-full min-w-0 overflow-hidden rounded-lg border px-3 py-2 text-left ${
                          selected?.id === run.id
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            : "border-zinc-200 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
                        }`}
                        onClick={() => setSelected(run)}
                      >
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="truncate text-xs font-semibold">{run.run_id || run.id}</span>
                          </div>
                          <PipelineStatusBadge status={run.status} />
                        </div>
                        <div className="mt-1 flex min-w-0 items-center justify-between gap-3 text-[11px] opacity-70">
                          <span className="truncate">
                            {run.operation ? OPERATION_LABELS[run.operation] || run.operation : (run.trigger || "manual")}
                          </span>
                          <span className="shrink-0">{formatDuration(run.duration_ms, run.started_at, run.completed_at)}</span>
                        </div>
                        {/* 阶段进度条 */}
                        {run.stages && Object.keys(run.stages).length > 0 && (
                          <div className="mt-2 flex min-w-0 items-center gap-1 overflow-hidden">
                            {(() => {
                              const stages = run.stages;
                              return getSortedStages(stages).map(([stageName, stage]) => (
                              <div
                                key={stageName}
                                className="group relative min-w-0"
                                style={{ width: calculateStageWidth(stage, stages) }}
                              >
                                <div className={`h-1.5 w-full rounded-full ${getStageColor(stageName, stage.status)}`} />
                                {/* Hover Tooltip */}
                                <div
                                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md
                                  bg-zinc-800 px-2 py-1.5 text-[11px] text-white opacity-0 shadow-lg
                                  transition-opacity duration-150 group-hover:opacity-100
                                  dark:bg-zinc-700 dark:text-zinc-100"
                                >
                                  <div className="font-medium">{STAGE_LABELS[stageName] || stageName}</div>
                                  <div className="text-zinc-300 dark:text-zinc-400">
                                    {stage.status}
                                    {stage.duration_ms ? ` · ${formatDuration(stage.duration_ms)}` : ""}
                                  </div>
                                  {stage.status === "failed" && stage.error && (
                                    <div className="mt-0.5 max-w-[180px] truncate text-rose-400">
                                      {getStageErrorSummary(stage.error)}
                                    </div>
                                  )}
                                  {stage.status === "skipped" && stage.reason && (
                                    <div className="mt-0.5 max-w-[150px] truncate italic text-zinc-400">
                                      {stage.reason}
                                    </div>
                                  )}
                                </div>
                              </div>
                              ));
                            })()}
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
          </section>
          <aside className="min-h-0 min-w-0 overflow-hidden overflow-y-auto">
            <div className="space-y-4 pb-4 pr-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Run Detail</h2>
                {selected ? (
                  <div className="mt-3 min-w-0 space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
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
                            <div key={stageName} className="flex min-w-0 items-center gap-2 text-[11px]">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${getPipelineStatusColor(stage.status)}`} />
                              <span className="min-w-0 truncate font-medium text-zinc-700 dark:text-zinc-300">
                                {STAGE_LABELS[stageName] || stageName}
                              </span>
                              <span className="shrink-0 text-zinc-400">
                                {stage.duration_ms ? `${stage.duration_ms}ms` : "-"}
                              </span>
                              {stage.status === "skipped" && stage.reason && (
                                <span className="truncate text-zinc-400 italic">({stage.reason})</span>
                              )}
                              {stage.error && (
                                <span className="truncate max-w-[120px] text-rose-500">
                                  {getStageErrorSummary(stage.error)}
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
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500">Input</p>
                      <pre className={detailJsonClassName}>
                        {JSON.stringify(selected.input ?? {}, null, 2)}
                      </pre>
                    </div>

                    {/* Output */}
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500">Output</p>
                      <pre className={detailJsonClassName}>
                        {JSON.stringify(selected.output ?? {}, null, 2)}
                      </pre>
                    </div>

                    {/* Errors */}
                    {selectedErrorDetails.length > 0 && (
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase text-zinc-400 dark:text-zinc-500">Errors</p>
                        <div className="mt-2 space-y-3">
                          {selectedErrorDetails.map((detail) => (
                            <div
                              key={detail.key}
                              className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                                    {detail.title}
                                  </p>
                                  {detail.failureLabel && (
                                    <p className="mt-0.5 truncate text-[10px] text-rose-500 dark:text-rose-400">
                                      {detail.failureLabel}
                                    </p>
                                  )}
                                </div>
                                <span className="text-[10px] text-rose-500 dark:text-rose-400">
                                  {detail.scope === "stage"
                                    ? `${detail.status || "failed"}${detail.durationMs ? ` · ${formatDuration(detail.durationMs)}` : ""}`
                                    : "failed"}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">
                                {detail.message}
                              </p>
                              <pre className={errorJsonClassName}>
                                {JSON.stringify(detail.error, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
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
                      <div key={run.id} className="flex min-w-0 gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                        <div className="flex shrink-0 flex-col items-center">
                          <span className={`h-2 w-2 rounded-full ${getPipelineStatusColor(run.status)}`} />
                          <span className="h-full w-px bg-zinc-200 dark:bg-zinc-700" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-zinc-900 dark:text-zinc-100">{run.run_id || run.id}</p>
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
