"use client";

import { useState } from "react";

import { outlineButtonClassName } from "@/components/ui/button-styles";
import type { GraphBuildRunRecord } from "@/features/knowledge";

const BUILD_HISTORY_PAGE_SIZE = 5;

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
    case "cancelling":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "failed":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "cancelled":
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

const CANCELLABLE_STATUSES = new Set(["pending", "running", "cancelling"]);

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
  corpusId?: string | null;
  onCancel?: (run: GraphBuildRunRecord) => void;
}

export function BuildHistoryList({ runs, corpusId, onCancel }: BuildHistoryListProps) {
  const [page, setPage] = useState(0);
  // 采用 React 19 推荐的「render 期间根据 props 调整 state」范式（替代 useEffect+setState
  // 的级联渲染），当底层数据刷新时同步重置分页索引。
  // 参考：https://react.dev/learn/you-might-not-need-an-effect
  //
  // 比较对象选择 `runs` 引用而非 `runs.length`：父组件的 `useMemo(() => …, [payload])`
  // 在 payload 改变（切换语料库 / 时间穿梭 / 构建后重拉）时整体重建 `runs` 数组。
  // 若按长度比较，两个语料库恰好拥有等长构建历史时切换不会触发重置，用户会停留在
  // 例如「第 2 页」却看着另一个语料库的数据。引用比较覆盖一切刷新场景。
  const [prevRuns, setPrevRuns] = useState(runs);
  if (prevRuns !== runs) {
    setPrevRuns(runs);
    setPage(0);
  }

  if (!runs.length) {
    return (
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        暂无构建记录
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(runs.length / BUILD_HISTORY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * BUILD_HISTORY_PAGE_SIZE;
  const pageRuns = runs.slice(start, start + BUILD_HISTORY_PAGE_SIZE);
  const showPager = runs.length > BUILD_HISTORY_PAGE_SIZE;

  return (
    <div className="mt-3 space-y-2">
      {pageRuns.map((run) => (
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
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {formatDuration(run)}
              </span>
              {CANCELLABLE_STATUSES.has(run.status) && onCancel && corpusId && (
                <button
                  type="button"
                  className="text-[10px] text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                  onClick={() => onCancel(run)}
                  disabled={run.status === "cancelling"}
                  title={run.status === "cancelling" ? "正在取消..." : "取消此构建"}
                >
                  {run.status === "cancelling" ? "取消中" : "取消"}
                </button>
              )}
            </div>
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
      {showPager && (
        <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded border border-zinc-200 px-2 py-0.5 hover:bg-zinc-50 disabled:opacity-30 disabled:hover:bg-transparent dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            上一页
          </button>
          <span>
            第 {currentPage + 1} / {totalPages} 页 · 共 {runs.length} 条
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="rounded border border-zinc-200 px-2 py-0.5 hover:bg-zinc-50 disabled:opacity-30 disabled:hover:bg-transparent dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            下一页
          </button>
        </div>
      )}
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
