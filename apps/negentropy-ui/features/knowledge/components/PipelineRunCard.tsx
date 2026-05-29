"use client";

import { useState } from "react";
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

const ACTIVE_STATUSES = new Set(["pending", "running", "in_progress", "cancelling"]);

/** 判断 run 是否可被取消（pending/running/in_progress/cancelling 时可见取消按钮） */
function isCancellable(status?: string): boolean {
  return ACTIVE_STATUSES.has((status || "").toLowerCase());
}

function isCancellingState(status?: string): boolean {
  return (status || "").toLowerCase() === "cancelling";
}

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
  // ---- KG 专属字段 ----
  /** 来源类型 */
  source?: "kb" | "kg";
  /** KG: corpus ID */
  corpus_id?: string;
  /** KG: 进度百分比 */
  progress_percent?: number;
  /** KG: 实体数 */
  entity_count?: number;
  /** KG: 关系数 */
  relation_count?: number;
  /** KG: 模型名称 */
  model_name?: string;
  /** KG: 错误信息 */
  error_message?: string;
  /**
   * 取消按钮回调：用户在二次确认通过后被调用，由父组件实际发起 cancel API
   * 调用并刷新列表。返回 Promise 以便卡片在调用期间显示 loading 态。
   * 仅当 status 处于活跃态（pending/running/cancelling）时按钮可见。
   */
  onCancel?: () => Promise<void> | void;
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
  source = "kb",
  entity_count,
  relation_count,
  model_name,
  error_message,
  progress_percent,
  onCancel,
}: PipelineRunCardProps & { isSelectable: boolean }) {
  const duration = formatDuration(duration_ms, started_at, completed_at);
  const isKg = source === "kg";
  const operationLabel = isKg
    ? OPERATION_LABELS.graph_build
    : operation
      ? OPERATION_LABELS[operation] || operation
      : null;
  const triggerLabel = trigger ? TRIGGER_LABELS[trigger] || trigger : null;
  const hasStages = stages && Object.keys(stages).length > 0;

  const startLabel = formatCompactTimestamp(started_at);
  const endLabel = formatCompactTimestamp(completed_at);
  const hasTimeline = startLabel || endLabel;

  // Cancel 按钮状态：仅活跃 run（pending/running/cancelling）显示；
  // cancelling 时 disabled + 显示 spinner（已发出信号但未到检查点）。
  const [submitting, setSubmitting] = useState(false);
  const showCancelButton = onCancel && isCancellable(status);
  const cancelDisabled = isCancellingState(status) || submitting;

  const handleCancelClick = async (e: React.MouseEvent) => {
    // 阻止冒泡：selectable 模式下点击卡片会切换选中，X 按钮不应触发选中
    e.stopPropagation();
    e.preventDefault();
    if (!onCancel || cancelDisabled) return;
    try {
      setSubmitting(true);
      await onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* 第一行：Run ID + 共享状态标签 + Cancel X 按钮 */}
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`truncate text-xs font-semibold ${
            isSelectable ? "" : "font-mono text-text-secondary"
          }`}>
            {isSelectable ? run_id : truncateRunId(run_id)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PipelineStatusBadge status={status} />
          {showCancelButton && (
            <button
              type="button"
              role="button"
              aria-label={cancelDisabled ? "正在取消" : "取消运行"}
              title={cancelDisabled ? "正在取消..." : "取消运行"}
              disabled={cancelDisabled}
              onClick={handleCancelClick}
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] transition-colors ${
                cancelDisabled
                  ? "cursor-not-allowed opacity-60"
                  : isSelectable
                    ? "hover:bg-background/20"
                    : "text-text-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
              }`}
            >
              {cancelDisabled ? (
                <svg
                  className="h-3 w-3 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                  <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 6 L18 18 M6 18 L18 6"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 第二行：操作类型 + 触发方式/KG 统计 + 时长 + 版本 */}
      <div className={`mt-1.5 flex min-w-0 items-center justify-between text-[11px] ${
        isSelectable ? "opacity-70" : "text-text-muted"
      }`}>
        <div className="flex items-center gap-1.5">
          {operationLabel && (
            <>
              <span className={isSelectable ? "font-medium" : "font-medium text-text-secondary"}>
                {operationLabel}
              </span>
              {isKg && entity_count != null && relation_count != null && (
                <>
                  <span className={isSelectable ? "" : "text-text-muted"}>·</span>
                  <span>{entity_count} 实体 / {relation_count} 关系</span>
                </>
              )}
              {!isKg && triggerLabel && (
                <span className={isSelectable ? "" : "text-text-muted"}>·</span>
              )}
            </>
          )}
          {!isKg && triggerLabel && (
            <span className="uppercase">{triggerLabel}</span>
          )}
          {!operationLabel && (
            <span>{formatRelativeTime(updated_at)}</span>
          )}
          {duration !== "-" && (
            <>
              <span className={isSelectable ? "" : "text-text-muted"}>·</span>
              <span>{duration}</span>
            </>
          )}
          {isKg && model_name && (
            <>
              <span className={isSelectable ? "" : "text-text-muted"}>·</span>
              <span className="truncate max-w-[100px]">{model_name}</span>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasTimeline && (
            <span className={isSelectable ? "opacity-60" : "text-text-muted"}>
              {startLabel ?? "-"} → {endLabel ?? "-"}
            </span>
          )}
          {isKg && progress_percent != null && status?.toLowerCase() === "running" && (
            <span className="shrink-0 tabular-nums">
              {Math.round(progress_percent * 100)}%
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

      {/* 第四行：失败摘要 */}
      {status === "failed" && (() => {
        // KG: 直接展示 error_message
        if (isKg && error_message) {
          return (
            <p className="mt-1 truncate text-[11px] text-rose-500 dark:text-rose-400">
              {error_message}
            </p>
          );
        }
        // KB: 从 stages 或 error 中提取
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
            ? "border-foreground bg-foreground text-background"
            : "border-border text-text-secondary hover:border-foreground/30"
        }`}
        onClick={onSelect}
      >
        <PipelineRunCardContent {...props} isSelectable />
      </button>
    );
  }

  return (
    <div
      className="block rounded-lg border border-border bg-muted px-3 py-2.5
                 text-left"
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
      <p className="mt-4 text-xs text-text-muted">
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
