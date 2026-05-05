"use client";

import { outlineButtonClassName } from "@/components/ui/button-styles";
import type { GraphBuildRunRecord } from "@/features/knowledge";

interface BuildPanelProps {
  building: boolean;
  corpusId: string | null;
  lastBuildError: string | null;
  onBuild: () => void;
}

function statusColor(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "running":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "failed":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

function formatDuration(run: GraphBuildRunRecord): string {
  if (!run.started_at) return "-";
  const start = new Date(run.started_at).getTime();
  const end = run.completed_at
    ? new Date(run.completed_at).getTime()
    : Date.now();
  const sec = Math.round((end - start) / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

interface BuildHistoryListProps {
  runs: GraphBuildRunRecord[];
}

export function BuildHistoryList({ runs }: BuildHistoryListProps) {
  if (!runs.length) {
    return (
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        暂无构建记录
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {runs.map((run) => (
        <div
          key={run.run_id}
          className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
        >
          <div className="flex items-center justify-between">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(run.status)}`}
            >
              {run.status}
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {formatDuration(run)}
            </span>
          </div>
          <div className="mt-1.5 flex gap-3 text-[11px] text-zinc-600 dark:text-zinc-400">
            <span>实体 {run.entity_count}</span>
            <span>关系 {run.relation_count}</span>
            {run.model_name && <span>模型 {run.model_name}</span>}
          </div>
          {run.error_message && (
            <p className="mt-1 text-[10px] text-red-600 dark:text-red-400 line-clamp-2">
              {run.error_message}
            </p>
          )}
          {run.started_at && (
            <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
              {new Date(run.started_at).toLocaleString()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function BuildPanel({
  building,
  corpusId,
  lastBuildError,
  onBuild,
}: BuildPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          className={outlineButtonClassName("neutral", "rounded-lg px-4 py-2 text-xs font-medium")}
          onClick={onBuild}
          disabled={!corpusId || building}
        >
          {building ? "构建中..." : "构建图谱"}
        </button>
        {!corpusId && (
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            请先选择语料库
          </span>
        )}
      </div>
      {lastBuildError && (
        <p className="text-[11px] text-red-600 dark:text-red-400">
          {lastBuildError}
        </p>
      )}
    </div>
  );
}
