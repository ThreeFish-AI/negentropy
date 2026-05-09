"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import { useConfirmDialog } from "@/components/ui/useConfirmDialog";
import {
  fetchDashboard,
  fetchPipelines,
  upsertPipelines,
  fetchCorpora,
  fetchGraphBuildHistory,
  cancelPipelineRun,
  KnowledgeDashboard,
  KnowledgePipelinesPayload,
  PipelineRunCard,
  PipelineRunDetailPanel,
} from "@/features/knowledge";
import { KgRunDetailPanel } from "@/features/knowledge/components/KgRunDetailPanel";
import {
  UnifiedPipelineRun,
  KgPipelineRun,
  adaptKgRunToUnified,
  mergeAndSortRuns,
  hasActiveRuns,
} from "@/features/knowledge/utils/unified-pipeline";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";
const PAGE_SIZE = 10;
const RUNNING_POLL_INTERVAL_MS = 5000;
const BOOTSTRAP_POLL_INTERVAL_MS = 1000;
const BOOTSTRAP_POLL_MAX_TICKS = 8;

interface RunsSnapshot {
  count: number;
  firstRunId: string | null;
  firstStatus: string | null;
  firstVersion: number | null;
}

const createRunsSnapshot = (
  runs: UnifiedPipelineRun[] | undefined,
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
  const [allRuns, setAllRuns] = useState<UnifiedPipelineRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UnifiedPipelineRun | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [retryQueue, setRetryQueue] = useState<UnifiedPipelineRun[]>([]);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [page, setPage] = useState(1);
  const [kbTotal, setKbTotal] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const bootstrapBaselineRef = useRef<RunsSnapshot | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const applyRuns = useCallback(
    (kbData: KnowledgePipelinesPayload, kgRuns: KgPipelineRun[]) => {
      const merged = mergeAndSortRuns(kbData.runs ?? [], kgRuns);
      setAllRuns(merged);
      setKbTotal(kbData.count ?? kbData.runs?.length ?? 0);
      setLastUpdatedAt(kbData.last_updated_at ?? null);
      setError(null);
      setSelected((prev) => {
        if (!merged.length) return null;
        if (!prev) return merged[0];
        const updated = merged.find((r) => r.id === prev.id);
        return updated ?? merged[0];
      });
    },
    [],
  );

  const loadRuns = useCallback(
    async (overridePage?: number) => {
      const p = overridePage ?? page;
      const offset = (p - 1) * PAGE_SIZE;

      const [pipeData, corpora] = await Promise.all([
        fetchPipelines(APP_NAME, { limit: PAGE_SIZE, offset }),
        fetchCorpora(APP_NAME).catch(() => []),
      ]);

      // 仅对有知识的 corpus 查询 KG history，每个 corpus 取最近 5 条
      const activeCorpora = corpora.filter(
        (c) => c.knowledge_count > 0,
      );
      const kgHistories = await Promise.all(
        activeCorpora.map((c) =>
          fetchGraphBuildHistory(c.id, APP_NAME, 5).catch(() => null),
        ),
      );

      const kgRuns: KgPipelineRun[] = kgHistories
        .filter((h) => h !== null)
        .flatMap((h) =>
          (h!.runs ?? []).map((r) => adaptKgRunToUnified(r, h!.corpus_id)),
        );

      applyRuns(pipeData, kgRuns);
      return { pipeData, kgRuns };
    },
    [applyRuns, page],
  );

  /**
   * 取消 Pipeline Run 的统一处理：弹 ConfirmDialog（替代浏览器原生 confirm，遵循
   * AGENTS.md 视觉规范），用户确认后调用 cancelPipelineRun；成功后立即 refetch 让
   * 卡片状态从 running 切换到 cancelling/cancelled，剩余收敛由现有 5s 轮询观察。
   */
  const handleCancelRun = useCallback(
    async (run: UnifiedPipelineRun) => {
      const confirmed = await confirm({
        title: "取消 Pipeline Run",
        message: (
          <div className="space-y-2">
            <p>
              确定取消 <span className="font-mono">{run.run_id || run.id}</span>?
            </p>
            <p className="text-xs opacity-80">
              已写入的数据不会回滚（best-effort 取消）；详情可在取消后展开 Run 详情查看
              「取消时进度」。
            </p>
          </div>
        ),
        confirmLabel: "确认取消",
        cancelLabel: "保持运行",
        destructive: true,
      });
      if (!confirmed) return;
      try {
        if (run.source === "kb") {
          await cancelPipelineRun(run.run_id || run.id, "kb", { appName: APP_NAME });
        } else {
          await cancelPipelineRun(run.run_id || run.id, "kg", {
            appName: APP_NAME,
            corpusId: run.corpus_id,
          });
        }
        // 立即刷新让卡片切换到 cancelling/cancelled；剩余收敛交给 5s 轮询
        await loadRuns().catch(() => undefined);
      } catch (err) {
        setError(String(err));
      }
    },
    [confirm, loadRuns],
  );

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { pipeData, kgRuns } = await loadRuns();
        if (!active) return;
        const merged = mergeAndSortRuns(pipeData.runs ?? [], kgRuns);
        bootstrapBaselineRef.current = createRunsSnapshot(merged);
        setHasInitialLoad(true);
      } catch (err) {
        if (active) setError(String(err));
      }
    })();

    (async () => {
      try {
        const dashData = await fetchDashboard(APP_NAME);
        if (active) setDashboardData(dashData);
      } catch (err) {
        if (active) setError(String(err));
      }
    })();

    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load
  }, [page]);

  // Bootstrap polling
  useEffect(() => {
    if (!hasInitialLoad) return;
    if (page !== 1) return;

    let active = true;
    let tick = 0;
    const baseline = bootstrapBaselineRef.current ?? createRunsSnapshot(allRuns);

    const intervalId = setInterval(async () => {
      tick += 1;
      try {
        const { pipeData, kgRuns } = await loadRuns();
        if (!active) return;

        const merged = mergeAndSortRuns(pipeData.runs ?? [], kgRuns);
        const nextSnapshot = createRunsSnapshot(merged);
        const changed = !isSameRunsSnapshot(baseline, nextSnapshot);
        const running = hasActiveRuns(merged);

        if (changed || running) {
          applyRuns(pipeData, kgRuns);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInitialLoad, page]);

  // Running-state polling
  useEffect(() => {
    if (page !== 1) return;
    if (!hasActiveRuns(allRuns)) return;

    const intervalId = setInterval(() => {
      loadRuns(1).catch((err) => {
        setError(String(err));
      });
    }, RUNNING_POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [loadRuns, allRuns, page]);

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

  // KB 分页总量来自服务端，KG 运行在每页始终展示
  const total = kbTotal;

  const selectedKbRun =
    selected?.source === "kb" ? selected : undefined;

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

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Pipeline Runs
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{lastUpdatedAt || "最近 24h"}</span>
                    {selectedKbRun && (
                      <button
                        className={outlineButtonClassName("neutral", "rounded-full px-3 py-1 text-[11px]")}
                        onClick={async () => {
                          if (!selectedKbRun) return;
                          setSaveStatus("saving");
                          try {
                            await upsertPipelines({
                              app_name: APP_NAME,
                              run_id: selectedKbRun.run_id,
                              status: selectedKbRun.status || "completed",
                              payload: {
                                started_at: selectedKbRun.started_at,
                                completed_at: selectedKbRun.completed_at,
                                duration_ms: selectedKbRun.duration_ms,
                                duration: selectedKbRun.duration,
                                trigger: selectedKbRun.trigger,
                                input: selectedKbRun.input,
                                output: selectedKbRun.output,
                                error: selectedKbRun.error,
                              },
                              expected_version: selectedKbRun.version,
                              idempotency_key: crypto.randomUUID(),
                            });
                            setSaveStatus("saved");
                          } catch (err) {
                            setSaveStatus(`error:${String(err)}`);
                            setRetryQueue((prev) => [...prev, selectedKbRun]);
                          }
                        }}
                      >
                        写回管线
                      </button>
                    )}
                  </div>
                </div>
                {allRuns.length ? (
                  <div className="mt-4 space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {allRuns.map((run) => (
                      <PipelineRunCard
                        key={run.id}
                        run_id={run.run_id || run.id}
                        status={run.status}
                        version={run.version ?? 0}
                        operation={
                          run.source === "kb"
                            ? (run.operation as "ingest_text" | "ingest_url" | "ingest_file" | "replace_source")
                            : undefined
                        }
                        trigger={run.source === "kb" ? run.trigger : undefined}
                        duration_ms={run.duration_ms}
                        started_at={run.started_at}
                        completed_at={run.completed_at}
                        stages={run.stages}
                        error={run.source === "kb" ? run.error : undefined}
                        mode="selectable"
                        selected={selected?.id === run.id}
                        onSelect={() => setSelected(run)}
                        onCancel={() => handleCancelRun(run)}
                        // KG 专属字段
                        source={run.source}
                        corpus_id={run.source === "kg" ? run.corpus_id : undefined}
                        entity_count={run.source === "kg" ? run.entity_count : undefined}
                        relation_count={run.source === "kg" ? run.relation_count : undefined}
                        model_name={run.source === "kg" ? run.model_name : undefined}
                        error_message={run.source === "kg" ? run.error_message : undefined}
                        progress_percent={run.source === "kg" ? run.progress_percent : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">暂无作业</p>
                )}
                {total > 0 && (
                  <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {`${total} run${total !== 1 ? "s" : ""}`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-[11px]")}
                      >
                        Previous
                      </button>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Page {page} / {Math.ceil(total / PAGE_SIZE) || 1}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(Math.ceil(total / PAGE_SIZE), p + 1))}
                        disabled={page >= Math.ceil(total / PAGE_SIZE)}
                        className={outlineButtonClassName("neutral", "rounded px-2 py-1 text-[11px]")}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="min-h-0 min-w-0 overflow-hidden overflow-y-auto">
            <div className="space-y-4 pb-4 pr-2">
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

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                {error
                  ? `加载失败：${error}`
                  : `状态源：${allRuns.length ? "已加载" : "等待加载"}${saveStatus ? ` | ${saveStatus}` : ""}`}
              </div>

              {selected && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Run Detail</h2>
                  {selected.source === "kb" ? (
                    <PipelineRunDetailPanel run={selected} />
                  ) : (
                    <KgRunDetailPanel run={selected} />
                  )}
                </div>
              )}

              {retryQueue.length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-700 shadow-sm dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                  <p className="font-semibold">待重试写回：{retryQueue.length}</p>
                  <button
                    className="mt-3 rounded bg-amber-600 px-3 py-2 text-[11px] font-semibold text-white"
                    onClick={async () => {
                      const next = retryQueue[0];
                      if (!next || next.source !== "kb") return;
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
      {confirmDialog}
    </div>
  );
}
