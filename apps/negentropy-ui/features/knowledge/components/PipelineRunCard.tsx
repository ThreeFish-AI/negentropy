"use client";

import Link from "next/link";
import type { PipelineStageResult } from "../utils/knowledge-api";
import {
  getPipelineStatusColor,
  getPipelineStatusTextColor,
  formatRelativeTime,
  truncateRunId,
  OPERATION_LABELS,
  TRIGGER_LABELS,
  STAGE_LABELS,
  getStageColor,
  formatDuration,
  calculateStageWidth,
  getSortedStages,
} from "../utils/pipeline-helpers";

/**
 * Pipeline Run 卡片属性
 * 与 KnowledgeDashboard.pipeline_runs 数组元素类型兼容
 * 扩展支持更多字段以展示丰富的概要信息
 */
export interface PipelineRunCardProps {
  run_id: string;
  status: string;
  version: number;
  updated_at?: string;
  /** 操作类型 */
  operation?: "ingest_text" | "ingest_url" | "replace_source";
  /** 触发方式 */
  trigger?: "api" | "ui" | "schedule";
  /** 运行时长（毫秒） */
  duration_ms?: number;
  /** 开始时间 */
  started_at?: string;
  /** 结束时间 */
  completed_at?: string;
  /** 阶段执行结果 */
  stages?: Record<string, PipelineStageResult>;
  /** 支持扩展字段 */
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
  operation,
  trigger,
  duration_ms,
  started_at,
  completed_at,
  stages,
}: PipelineRunCardProps) {
  // 计算运行时长
  const duration = formatDuration(duration_ms, started_at, completed_at);
  // 操作类型标签
  const operationLabel = operation ? OPERATION_LABELS[operation] || operation : null;
  // 触发方式标签
  const triggerLabel = trigger ? TRIGGER_LABELS[trigger] || trigger : null;
  // 是否有阶段数据
  const hasStages = stages && Object.keys(stages).length > 0;

  return (
    <Link
      href="/knowledge/pipelines"
      className="block rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5
                 text-left transition-all hover:border-zinc-400 hover:bg-zinc-100
                 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-zinc-500
                 dark:hover:bg-zinc-800"
    >
      {/* 第一行：状态指示器 + Run ID + 状态标签 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* 状态指示灯 */}
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${getPipelineStatusColor(status)}`}
            title={status}
            role="status"
            aria-label={`状态: ${status}`}
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

      {/* 第二行：操作类型 + 触发方式 + 时长 + 版本 */}
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-1.5">
          {operationLabel && (
            <>
              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                {operationLabel}
              </span>
              {triggerLabel && (
                <span className="text-zinc-400 dark:text-zinc-500">·</span>
              )}
            </>
          )}
          {triggerLabel && (
            <span className="uppercase">{triggerLabel}</span>
          )}
          {!operationLabel && !triggerLabel && (
            <span>{formatRelativeTime(updated_at)}</span>
          )}
          {duration !== "-" && (
            <>
              <span className="text-zinc-400 dark:text-zinc-500">·</span>
              <span>{duration}</span>
            </>
          )}
        </div>
        <span>v{version}</span>
      </div>

      {/* 第三行：阶段进度条（仅在存在阶段数据时显示） */}
      {hasStages && (
        <div className="mt-2 flex items-center gap-0.5">
          {getSortedStages(stages).map(([stageName, stage]) => (
            <div
              key={stageName}
              className="group relative"
              style={{ width: calculateStageWidth(stage, stages!) }}
            >
              <div
                className={`h-1.5 w-full rounded-full ${getStageColor(stageName, stage.status)}`}
              />
              {/* Hover Tooltip */}
              <div
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2
                            whitespace-nowrap rounded-md bg-zinc-800 px-2 py-1.5 text-[11px] text-white
                            opacity-0 shadow-lg transition-opacity duration-150
                            group-hover:opacity-100 dark:bg-zinc-700 dark:text-zinc-100"
              >
                <div className="font-medium">{STAGE_LABELS[stageName] || stageName}</div>
                <div className="text-zinc-300 dark:text-zinc-400">
                  {stage.status}
                  {stage.duration_ms ? ` · ${formatDuration(stage.duration_ms)}` : ""}
                </div>
                {stage.status === "failed" && stage.error && (
                  <div className="mt-0.5 max-w-[150px] truncate text-rose-400">
                    {typeof stage.error === "object" && stage.error !== null && "message" in stage.error
                      ? String((stage.error as { message?: unknown }).message)
                      : "Error"}
                  </div>
                )}
                {stage.status === "skipped" && stage.reason && (
                  <div className="mt-0.5 max-w-[150px] truncate italic text-zinc-400">
                    {stage.reason}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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
        <PipelineRunCard key={run.run_id || `run-${index}`} {...run} />
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
