"use client";

import Link from "next/link";
import {
  getPipelineStatusColor,
  getPipelineStatusTextColor,
  formatRelativeTime,
  truncateRunId,
} from "../utils/pipeline-helpers";

/**
 * Pipeline Run 卡片属性
 * 与 KnowledgeDashboard.pipeline_runs 数组元素类型兼容
 */
export interface PipelineRunCardProps {
  run_id: string;
  status: string;
  version: number;
  updated_at?: string;
  [key: string]: unknown;
}

/**
 * Pipeline Run 卡片组件
 *
 * 用于 Dashboard 页面展示 Pipeline 运行状态概览
 * 点击卡片跳转到 /knowledge/pipelines 详情页
 */
export function PipelineRunCard({
  run_id,
  status,
  version,
  updated_at,
}: PipelineRunCardProps) {
  return (
    <Link
      href="/knowledge/pipelines"
      className="block rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5
                 text-left transition-all hover:border-zinc-400 hover:bg-zinc-100
                 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-zinc-500
                 dark:hover:bg-zinc-800"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* 状态指示灯 */}
          <span
            className={`h-2 w-2 rounded-full ${getPipelineStatusColor(status)}`}
            title={status}
          />
          {/* Run ID */}
          <span className="font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {truncateRunId(run_id)}
          </span>
        </div>
        {/* 状态标签 */}
        <span
          className={`text-[11px] font-medium uppercase ${getPipelineStatusTextColor(status)}`}
        >
          {status}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>v{version}</span>
        <span>{formatRelativeTime(updated_at)}</span>
      </div>
    </Link>
  );
}

/**
 * Pipeline Run 列表容器组件
 *
 * 渲染 Pipeline Run 卡片列表，包含"查看更多"链接
 * 空列表时显示"暂无作业记录"
 */
export function PipelineRunList({ runs }: { runs: PipelineRunCardProps[] }) {
  if (!runs.length) {
    return (
      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        暂无作业记录
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {runs.map((run, index) => (
        <PipelineRunCard key={run.run_id || index} {...run} />
      ))}
      {/* 查看更多链接 */}
      <Link
        href="/knowledge/pipelines"
        className="block rounded-lg border border-dashed border-zinc-200 px-3 py-2
                   text-center text-xs text-zinc-500 transition-colors
                   hover:border-zinc-400 hover:text-zinc-700
                   dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500
                   dark:hover:text-zinc-300"
      >
        查看全部作业 →
      </Link>
    </div>
  );
}
