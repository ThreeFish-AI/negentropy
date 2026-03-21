"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import {
  fetchDashboard,
  fetchPipelines,
  upsertPipelines,
  KnowledgeDashboard,
  KnowledgePipelinesPayload,
  PipelineRunRecord,
  PipelineRunCard,
  PipelineRunDetailPanel,
} from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";
const RUNNING_POLL_INTERVAL_MS = 3000;
const BOOTSTRAP_POLL_INTERVAL_MS = 1000;
const BOOTSTRAP_POLL_MAX_TICKS = 8;

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

export default function KnowledgeDashboardPage() {
  const [dashboardData, setDashboardData] = useState<KnowledgeDashboard | null>(null);
  const [pipelinesPayload, setPipelinesPayload] = useState<KnowledgePipelinesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PipelineRunRecord | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [retryQueue, setRetryQueue] = useState<PipelineRunRecord[]>([]);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  const applyPipelinesPayload = useCallback((data: KnowledgePipelinesPayload) => {
    setPipelinesPayload(data);
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
    applyPipelinesPayload(data);
    return data;
  }, [applyPipelinesPayload]);

  // 初始加载：并行获取 Dashboard + Pipelines 数据
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [dashData, pipeData] = await Promise.all([
          fetchDashboard(APP_NAME),
          fetchPipelines(APP_NAME),
        ]);
        if (!active) return;
        setDashboardData(dashData);
        applyPipelinesPayload(pipeData);
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
  }, [applyPipelinesPayload]);

  // 首屏兜底轮询（避免刚跳转时因时序空窗漏掉新 Run）
  useEffect(() => {
    if (!hasInitialLoad) return;
    if (hasRunningRuns(pipelinesPayload?.runs)) return;

    let active = true;
    let tick = 0;
    const baseline = createRunsSnapshot(pipelinesPayload?.runs);

    const intervalId = setInterval(async () => {
      tick += 1;
      try {
        const data = await fetchPipelines(APP_NAME);
        if (!active) return;

        const nextSnapshot = createRunsSnapshot(data.runs);
        const changed = !isSameRunsSnapshot(baseline, nextSnapshot);
        const running = hasRunningRuns(data.runs);

        if (changed || running) {
          applyPipelinesPayload(data);
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
  }, [applyPipelinesPayload, hasInitialLoad, pipelinesPayload?.runs]);

  // 自动刷新 Effect（当有 running 状态时启动）
  useEffect(() => {
    if (!hasRunningRuns(pipelinesPayload?.runs)) return;

    const intervalId = setInterval(() => {
      loadPipelines().catch((err) => {
        setError(String(err));
      });
    }, RUNNING_POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [loadPipelines, pipelinesPayload?.runs]);

  const metrics = useMemo(() => {
    if (!dashboardData) return [];
    return [
      { label: "Corpus", value: dashboardData.corpus_count },
      { label: "Knowledge", value: dashboardData.knowledge_count },
      {
        label: "Last Build",
        value: dashboardData.last_build_at ? (
          <span title={dashboardData.last_build_at}>
            {new Intl.DateTimeFormat("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(dashboardData.last_build_at))}
          </span>
        ) : (
          "-"
        ),
      },
    ];
  }, [dashboardData]);

  const runs = pipelinesPayload?.runs || [];

  return (
    <div className="flex h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <KnowledgeNav
        title="Dashboard"
        description="Knowledge 指标、构建与管线概览"
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
          <section className="min-h-0 min-w-0 overflow-hidden overflow-y-auto">
            <div className="space-y-4 pb-4 pr-2">
              {/* Metric Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Pipeline Runs（融合列表） */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Pipeline Runs
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{pipelinesPayload?.last_updated_at || "最近 24h"}</span>
                    {selected && (
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
                    )}
                  </div>
                </div>
                {runs.length ? (
                  <div className="mt-4 space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {runs.map((run) => (
                      <PipelineRunCard
                        key={run.id}
                        run_id={run.run_id || run.id}
                        status={run.status}
                        version={run.version ?? 0}
                        operation={run.operation as PipelineRunCardOperationType}
                        trigger={run.trigger}
                        duration_ms={run.duration_ms}
                        started_at={run.started_at}
                        completed_at={run.completed_at}
                        stages={run.stages}
                        mode="selectable"
                        selected={selected?.id === run.id}
                        onSelect={() => setSelected(run)}
                      />
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
              {/* Run Detail（条件渲染） */}
              {selected && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Run Detail</h2>
                  <PipelineRunDetailPanel run={selected} />
                </div>
              )}

              {/* Alerts */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Alerts</h2>
                {dashboardData?.alerts?.length ? (
                  <div className="mt-3 space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {dashboardData.alerts.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20"
                      >
                        {JSON.stringify(item)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">暂无告警</p>
                )}
              </div>

              {/* Status */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                {error
                  ? `加载失败：${error}`
                  : `状态源：${pipelinesPayload ? "已加载" : "等待加载"}${saveStatus ? ` | ${saveStatus}` : ""}`}
              </div>

              {/* Retry Queue */}
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

// Helper type for operation prop narrowing
type PipelineRunCardOperationType = "ingest_text" | "ingest_url" | "ingest_file" | "replace_source" | undefined;
