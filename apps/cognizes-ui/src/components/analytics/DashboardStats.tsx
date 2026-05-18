import React from "react";
import { useDashboardStats } from "@/hooks/useApi";
import StatsCard, {
  PaperIcon,
  TaskIcon,
  TranslatedIcon,
  ProcessingIcon,
} from "./StatsCard";

export function DashboardStats() {
  const { data: stats, error, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-center">
              <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
              <div className="ml-4 flex-1">
                <div className="mb-2 h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700"></div>
                <div className="h-8 w-1/2 rounded bg-gray-200 dark:bg-gray-700"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-red-600 dark:text-red-400">加载统计数据失败</p>
      </div>
    );
  }

  // Calculate stats
  const papersTotal = stats?.papers?.total || 0;
  const translatedPapers = stats?.papers?.byStatus?.translated || 0;
  const analyzedPapers = stats?.papers?.byStatus?.analyzed || 0;
  const tasksRunning = stats?.tasks?.running || 0;
  const tasksCompleted = stats?.tasks?.completed || 0;
  const recentlyAdded = stats?.papers?.recentlyAdded || 0;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Papers */}
      <StatsCard
        title="论文总数"
        value={papersTotal}
        change={
          recentlyAdded > 0
            ? { value: recentlyAdded, type: "increase" }
            : undefined
        }
        icon={<PaperIcon />}
        href="/papers"
        color="blue"
      />

      {/* Translated Papers */}
      <StatsCard
        title="已翻译"
        value={translatedPapers}
        change={
          papersTotal > 0
            ? {
                value: Math.round((translatedPapers / papersTotal) * 100),
                type: "increase",
              }
            : undefined
        }
        icon={<TranslatedIcon />}
        href="/papers?status=translated"
        color="green"
      />

      {/* Analyzed Papers */}
      <StatsCard
        title="已分析"
        value={analyzedPapers}
        change={
          papersTotal > 0
            ? {
                value: Math.round((analyzedPapers / papersTotal) * 100),
                type: "increase",
              }
            : undefined
        }
        icon={<ProcessingIcon />}
        href="/papers?status=analyzed"
        color="purple"
      />

      {/* Running Tasks */}
      <StatsCard
        title="运行中任务"
        value={tasksRunning}
        icon={<TaskIcon />}
        href="/tasks"
        color="yellow"
      />
    </div>
  );
}

export default DashboardStats;
