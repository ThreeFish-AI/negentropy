"use client";

import type { PipelineErrorPayload, PipelineStageResult } from "../utils/knowledge-api";
import { PipelineStatusBadge } from "./PipelineStatusBadge";
import { PipelineStagesBar } from "./PipelineStagesBar";
import {
  formatRelativeTime,
  truncateRunId,
  OPERATION_LABELS,
  TRIGGER_LABELS,
  formatDuration,
  getFailedStages,
  getStageErrorSummary,
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
  operation?: "ingest_text" | "ingest_url" | "ingest_file" | "replace_source";
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
  /** 运行级错误 */
  error?: PipelineErrorPayload;
  /** 卡片交互模式 */
  mode?: "link" | "selectable";
  /** 是否选中（仅 mode="selectable" 有效） */
  selected?: boolean;
  /** 点击回调（仅 mode="selectable" 有效） */
  onSelect?: () => void;
  /** 支持扩展字段 */
  [key: string]: unknown;
}

/** 格式化时间戳为紧凑显示（MM-DD HH:mm:ss） */
function formatCompactTimestamp(iso?: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${mm}-${dd} ${hh}:${mi}:${ss}`;
  } catch {
    return null;
  }
}

/**
 * Pipeline Run 卡片内部内容（共享渲染逻辑）
 */
function PipelineRunCardContent({
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
  error,
  isSelectable,
}: PipelineRunCardProps & { isSelectable: boolean }) {
  const duration = formatDuration(duration_ms, started_at, completed_at);
  const operationLabel = operation ? OPERATION_LABELS[operation] || operation : null;
  const triggerLabel = trigger ? TRIGGER_LABELS[trigger] || trigger : null;
  const hasStages = stages && Object.keys(stages).length > 0;

  const startLabel = formatCompactTimestamp(started_at);
  const endLabel = formatCompactTimestamp(completed_at);
  const hasTimeline = startLabel || endLabel;

  return (
    <>
      {/* 第一行：Run ID + 共享状态标签 */}
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`truncate text-xs font-semibold ${
            isSelectable ? "" : "font-mono text-zinc-700 dark:text-zinc-300"
          }`}>
            {isSelectable ? run_id : truncateRunId(run_id)}
          </span>
        </div>
        <PipelineStatusBadge status={status} />
      </div>

      {/* 第二行：操作类型 + 触发方式 + 时长 + 版本 */}
      <div className={`mt-1.5 flex min-w-0 items-center justify-between text-[11px] ${
        isSelectable ? "opacity-70" : "text-zinc-500 dark:text-zinc-400"
      }`}>
        <div className="flex items-center gap-1.5">
          {operationLabel && (
            <>
              <span className={isSelectable ? "font-medium" : "font-medium text-zinc-600 dark:text-zinc-300"}>
                {operationLabel}
              </span>
              {triggerLabel && (
                <span className={isSelectable ? "" : "text-zinc-400 dark:text-zinc-500"}>·</span>
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
              <span className={isSelectable ? "" : "text-zinc-400 dark:text-zinc-500"}>·</span>
              <span>{duration}</span>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasTimeline && (
            <span className={isSelectable ? "opacity-60" : "text-zinc-400 dark:text-zinc-500"}>
              {startLabel ?? "-"} → {endLabel ?? "-"}
            </span>
          )}
          <span className="shrink-0">v{version}</span>
        </div>
      </div>

      {/* 第三行：阶段进度条 */}
      {hasStages && (
        <PipelineStagesBar
          stages={stages}
          className={`mt-2 ${isSelectable ? "min-w-0 overflow-visible" : ""}`}
          gapClassName={isSelectable ? "gap-1" : undefined}
          segmentClassName={isSelectable ? "min-w-0" : undefined}
        />
      )}

      {/* 第四行：失败摘要（仅失败时显示） */}
      {status === "failed" && (() => {
        const failedStageList = getFailedStages(stages);
        if (failedStageList.length > 0) {
          const first = failedStageList[0];
          return (
            <p className="mt-1 truncate text-[11px] text-rose-500 dark:text-rose-400">
              {first.label} · {first.message}
            </p>
          );
        }
        if (error && typeof error === "object") {
          return (
            <p className="mt-1 truncate text-[11px] text-rose-500 dark:text-rose-400">
              {getStageErrorSummary(error)}
            </p>
          );
        }
        return null;
      })()}
    </>
  );
}

/**
 * Pipeline Run 卡片组件
 *
 * 支持两种交互模式：
 * - link: 静态展示卡片（默认）
 * - selectable: 可选中的按钮式卡片，用于 Dashboard 融合列表
 */
export function PipelineRunCard(props: PipelineRunCardProps) {
  const { mode = "link", selected, onSelect } = props;

  if (mode === "selectable") {
    return (
      <button
        className={`w-full min-w-0 rounded-lg border px-3 py-2.5 text-left ${
          selected
            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            : "border-zinc-200 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
        }`}
        onClick={onSelect}
      >
        <PipelineRunCardContent {...props} isSelectable />
      </button>
    );
  }

  return (
    <div
      className="block rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5
                 text-left dark:border-zinc-700 dark:bg-zinc-800/50"
    >
      <PipelineRunCardContent {...props} isSelectable={false} />
    </div>
  );
}

/**
 * Pipeline Run 列表容器组件
 *
 * 渲染 Pipeline Run 卡片列表
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
    </div>
  );
}
