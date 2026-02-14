"use client";

import { useEffect, useMemo, useState } from "react";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";
import { fetchDashboard, KnowledgeDashboard } from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

export default function KnowledgeDashboardPage() {
  const [data, setData] = useState<KnowledgeDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchDashboard(APP_NAME)
      .then((payload) => {
        if (active) {
          setData(payload);
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

  const metrics = useMemo(() => {
    if (!data) {
      return [];
    }
    return [
      { label: "Corpus", value: data.corpus_count },
      { label: "Knowledge", value: data.knowledge_count },
      {
        label: "Last Build",
        value: data.last_build_at ? (
          <span title={data.last_build_at}>
            {new Intl.DateTimeFormat("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(data.last_build_at))}
          </span>
        ) : (
          "-"
        ),
      },
    ];
  }, [data]);

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <KnowledgeNav
        title="Knowledge Dashboard"
        description="Knowledge 指标、构建与告警概览"
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 gap-6 px-6 py-6">
          <section className="min-h-0 min-w-0 flex-[2.2] overflow-y-auto">
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
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">最近 24h</span>
                </div>
                {data?.pipeline_runs?.length ? (
                  <div className="mt-4 space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {data.pipeline_runs.map((item, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-dashed border-zinc-200 p-3 dark:border-zinc-700"
                      >
                        {JSON.stringify(item)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">暂无作业记录</p>
                )}
              </div>
            </div>
          </section>
          <aside className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="space-y-4 pb-4 pr-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Alerts</h2>
                {data?.alerts?.length ? (
                  <div className="mt-3 space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {data.alerts.map((item, index) => (
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
                  : "数据由 /api/knowledge/dashboard 提供"}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
