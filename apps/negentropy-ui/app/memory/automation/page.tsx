"use client";

import { useEffect, useState, useTransition } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { MemoryNav } from "@/components/ui/MemoryNav";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import {
  fetchMemoryAutomation,
  fetchMemoryAutomationLogs,
  runMemoryAutomationJob,
  triggerMemoryAutomationJobAction,
  updateMemoryAutomationConfig,
  type MemoryAutomationLog,
  type MemoryAutomationSnapshot,
} from "@/features/memory";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

export default function MemoryAutomationPage() {
  const { user, status } = useAuth();
  const [snapshot, setSnapshot] = useState<MemoryAutomationSnapshot | null>(null);
  const [logs, setLogs] = useState<MemoryAutomationLog[]>([]);
  const [form, setForm] = useState<MemoryAutomationSnapshot["config"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isAdmin = Boolean(user?.roles?.includes("admin"));
  const isSchedulerReadonly = snapshot ? !snapshot.capabilities.pg_cron_available : false;

  const load = async () => {
    setError(null);
    const [nextSnapshot, nextLogs] = await Promise.all([
      fetchMemoryAutomation(APP_NAME),
      fetchMemoryAutomationLogs(APP_NAME, 10),
    ]);
    setSnapshot(nextSnapshot);
    setForm(nextSnapshot.config);
    setLogs(nextLogs.items);
  };

  useEffect(() => {
    if (!isAdmin) return;
    load().catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [isAdmin]);

  const updateField = (
    section: keyof MemoryAutomationSnapshot["config"],
    key: string,
    value: string | number | boolean,
  ) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [key]: value,
        },
      };
    });
  };

  const handleSave = () => {
    if (!form) return;
    startTransition(async () => {
      try {
        const nextSnapshot = await updateMemoryAutomationConfig({
          app_name: APP_NAME,
          config: form,
        });
        setSnapshot(nextSnapshot);
        setForm(nextSnapshot.config);
        setStatusText("配置已保存并完成 reconcile。");
        const nextLogs = await fetchMemoryAutomationLogs(APP_NAME, 10);
        setLogs(nextLogs.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  const handleJobAction = (jobKey: string, action: "enable" | "disable" | "reconcile") => {
    startTransition(async () => {
      try {
        const nextSnapshot = await triggerMemoryAutomationJobAction(jobKey, action, APP_NAME);
        setSnapshot(nextSnapshot);
        setForm(nextSnapshot.config);
        setStatusText(`任务 ${jobKey} 已执行 ${action}。`);
        const nextLogs = await fetchMemoryAutomationLogs(APP_NAME, 10);
        setLogs(nextLogs.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  const handleRun = (jobKey: string) => {
    startTransition(async () => {
      try {
        const result = await runMemoryAutomationJob(jobKey, APP_NAME);
        setSnapshot(result.snapshot);
        setForm(result.snapshot.config);
        setStatusText(`任务 ${jobKey} 已手动触发，返回结果：${result.result ?? "-"}`);
        const nextLogs = await fetchMemoryAutomationLogs(APP_NAME, 10);
        setLogs(nextLogs.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-sm text-muted">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col bg-background">
        <MemoryNav title="Automation" description="仿生记忆自动化控制面" />
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
            <h1 className="text-lg font-semibold text-foreground">仅管理员可访问</h1>
            <p className="mt-3 text-sm text-muted">
              Memory Automation 控制面包含 retention、cron 调度与过程重建操作，当前账号无权访问。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <MemoryNav title="Automation" description="仿生记忆自动化控制面" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 gap-6 px-6 py-6">
          <aside className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="space-y-4 pb-4 pr-2">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-foreground">系统能力</h2>
                <div className="mt-4 space-y-3 text-xs text-muted">
                  <div className="flex items-center justify-between">
                    <span>pg_cron</span>
                    <span>{snapshot?.capabilities.pg_cron_installed ? "installed" : "missing"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>管理模式</span>
                    <span>{snapshot?.capabilities.management_mode || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>健康状态</span>
                    <span>{snapshot?.health.status || "-"}</span>
                  </div>
                </div>
                {snapshot?.capabilities.degraded_reasons?.length ? (
                  <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    {snapshot.capabilities.degraded_reasons.join(" / ")}
                  </div>
                ) : null}
                {isSchedulerReadonly ? (
                  <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-3 text-[11px] text-muted">
                    当前 `pg_cron` 不可用，调度相关操作已降级为只读；配置和函数状态仍可查看与保存。
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-foreground">过程摘要</h2>
                <div className="mt-4 space-y-3">
                  {snapshot?.processes.map((process) => (
                    <div key={process.key} className="rounded-2xl border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-foreground">{process.label}</p>
                        <span className="text-[11px] text-muted">
                          {process.job?.status || "function-only"}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-muted">{process.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <main className="min-h-0 min-w-0 flex-[1.6] overflow-y-auto">
            <div className="space-y-6 pb-4 pr-2">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Automation Config</h2>
                    <p className="mt-1 text-xs text-muted">后端托管配置，保存后自动 reconcile 预定义函数与任务。</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className={outlineButtonClassName("neutral", "rounded-lg px-3 py-2 text-xs")}
                      onClick={() => load().catch((err) => setError(String(err)))}
                    >
                      刷新
                    </button>
                    <button
                      className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"
                      disabled={!form || isPending}
                      onClick={handleSave}
                    >
                      {isPending ? "保存中..." : "保存并同步"}
                    </button>
                  </div>
                </div>

                {error ? (
                  <div className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                    {error}
                  </div>
                ) : null}
                {statusText ? (
                  <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    {statusText}
                  </div>
                ) : null}

                {form ? (
                  <div className="mt-6 grid gap-5 md:grid-cols-2">
                    <section className="rounded-2xl border border-border p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Retention</h3>
                      <div className="mt-4 grid gap-3">
                        <label className="text-xs text-muted">
                          decay_lambda
                          <input
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
                            type="number"
                            step="0.01"
                            value={form.retention.decay_lambda}
                            onChange={(e) => updateField("retention", "decay_lambda", Number(e.target.value))}
                          />
                        </label>
                        <label className="text-xs text-muted">
                          low_retention_threshold
                          <input
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
                            type="number"
                            step="0.01"
                            value={form.retention.low_retention_threshold}
                            onChange={(e) =>
                              updateField("retention", "low_retention_threshold", Number(e.target.value))
                            }
                          />
                        </label>
                        <label className="text-xs text-muted">
                          min_age_days
                          <input
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
                            type="number"
                            step="1"
                            value={form.retention.min_age_days}
                            onChange={(e) => updateField("retention", "min_age_days", Number(e.target.value))}
                          />
                        </label>
                        <label className="text-xs text-muted">
                          cleanup_schedule
                          <input
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
                            value={form.retention.cleanup_schedule}
                            onChange={(e) => updateField("retention", "cleanup_schedule", e.target.value)}
                          />
                        </label>
                        <label className="flex items-center gap-2 text-xs text-muted">
                          <input
                            type="checkbox"
                            checked={form.retention.auto_cleanup_enabled}
                            onChange={(e) =>
                              updateField("retention", "auto_cleanup_enabled", e.target.checked)
                            }
                          />
                          启用 cleanup cron
                        </label>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-border p-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Consolidation</h3>
                      <div className="mt-4 grid gap-3">
                        <label className="text-xs text-muted">
                          schedule
                          <input
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
                            value={form.consolidation.schedule}
                            onChange={(e) => updateField("consolidation", "schedule", e.target.value)}
                          />
                        </label>
                        <label className="text-xs text-muted">
                          lookback_interval
                          <input
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
                            value={form.consolidation.lookback_interval}
                            onChange={(e) => updateField("consolidation", "lookback_interval", e.target.value)}
                          />
                        </label>
                        <label className="flex items-center gap-2 text-xs text-muted">
                          <input
                            type="checkbox"
                            checked={form.consolidation.enabled}
                            onChange={(e) => updateField("consolidation", "enabled", e.target.checked)}
                          />
                          启用 consolidation cron
                        </label>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-border p-4 md:col-span-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Context Assembler</h3>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <label className="text-xs text-muted">
                          max_tokens
                          <input
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
                            type="number"
                            step="1"
                            value={form.context_assembler.max_tokens}
                            onChange={(e) =>
                              updateField("context_assembler", "max_tokens", Number(e.target.value))
                            }
                          />
                        </label>
                        <label className="text-xs text-muted">
                          memory_ratio
                          <input
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
                            type="number"
                            step="0.05"
                            value={form.context_assembler.memory_ratio}
                            onChange={(e) =>
                              updateField("context_assembler", "memory_ratio", Number(e.target.value))
                            }
                          />
                        </label>
                        <label className="text-xs text-muted">
                          history_ratio
                          <input
                            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
                            type="number"
                            step="0.05"
                            value={form.context_assembler.history_ratio}
                            onChange={(e) =>
                              updateField("context_assembler", "history_ratio", Number(e.target.value))
                            }
                          />
                        </label>
                      </div>
                    </section>
                  </div>
                ) : (
                  <p className="mt-6 text-xs text-muted">Loading automation config...</p>
                )}
              </div>

              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-foreground">Managed Jobs</h2>
                <div className="mt-4 space-y-3">
                  {snapshot?.jobs.map((job) => (
                    <div key={job.job_key} className="rounded-2xl border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-foreground">{job.process_label}</p>
                          <p className="mt-1 text-[11px] text-muted">{job.schedule}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted">
                            {job.status}
                          </span>
                          <button
                            className={outlineButtonClassName("neutral", "rounded-lg px-3 py-2 text-xs")}
                            onClick={() => handleJobAction(job.job_key, job.enabled ? "disable" : "enable")}
                            disabled={isPending || isSchedulerReadonly}
                          >
                            {job.enabled ? "停用" : "启用"}
                          </button>
                          <button
                            className={outlineButtonClassName("neutral", "rounded-lg px-3 py-2 text-xs")}
                            onClick={() => handleJobAction(job.job_key, "reconcile")}
                            disabled={isPending || isSchedulerReadonly}
                          >
                            重建
                          </button>
                          <button
                            className={outlineButtonClassName("neutral", "rounded-lg px-3 py-2 text-xs")}
                            onClick={() => handleRun(job.job_key)}
                            disabled={isPending || isSchedulerReadonly}
                          >
                            手动触发
                          </button>
                        </div>
                      </div>
                      <pre className="mt-3 overflow-x-auto rounded-xl bg-muted/40 p-3 text-[11px] text-muted">
                        {job.command}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>

          <aside className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="space-y-4 pb-4 pr-2">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-foreground">Functions</h2>
                <div className="mt-4 space-y-3">
                  {snapshot?.functions.map((fn) => (
                    <details key={fn.name} className="rounded-2xl border border-border p-3">
                      <summary className="cursor-pointer text-xs font-semibold text-foreground">
                        {fn.name} · {fn.status}
                      </summary>
                      <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-muted/40 p-3 text-[11px] text-muted">
                        {fn.definition}
                      </pre>
                    </details>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-foreground">Recent Logs</h2>
                <div className="mt-4 space-y-3">
                  {logs.length ? (
                    logs.map((item) => (
                      <div key={`${item.run_id}-${item.job_id}`} className="rounded-2xl border border-border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] font-semibold text-foreground">
                            job #{item.job_id ?? "-"} / run #{item.run_id ?? "-"}
                          </span>
                          <span className="text-[11px] text-muted">{item.status || "-"}</span>
                        </div>
                        <p className="mt-2 text-[11px] text-muted">{item.start_time || "-"}</p>
                        <p className="mt-2 break-all text-[11px] text-muted">{item.return_message || item.command}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted">暂无执行日志。</p>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
