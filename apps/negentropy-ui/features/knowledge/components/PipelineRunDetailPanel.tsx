"use client";

import type { PipelineRunRecord } from "../utils/knowledge-api";
import {
  buildPipelineErrorDetails,
  formatDuration,
  getSortedStages,
  getStageColor,
  getStageErrorSummary,
  STAGE_LABELS,
  OPERATION_LABELS,
} from "../utils/pipeline-helpers";

const detailJsonClassName =
  "mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-caption";
const errorJsonClassName =
  "mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-rose-50 p-3 text-caption text-rose-700 dark:bg-rose-900/20 dark:text-rose-400";

/**
 * Pipeline Run 详情面板
 *
 * 展示选中 Run 的完整信息：Info、Stages、Input、Output、Errors
 * 从原 Pipelines 页面的 Run Detail 区域提取
 */
export function PipelineRunDetailPanel({ run }: { run: PipelineRunRecord }) {
  const errorDetails = buildPipelineErrorDetails(run);

  return (
    <div className="mt-3 min-w-0 space-y-3 text-xs text-text-secondary">
      {/*
        断点续传 / 重新开始 入口已上移到 PipelineRunCard 卡片（直显两个按钮，
        直接调 retry API），不再在详情面板放跳转链接，避免语义重复。
      */}

      {/* 基本信息 */}
      <div className="rounded-lg border border-border bg-muted p-3">
        <p className="text-caption uppercase tracking-overline text-text-muted">Info</p>
        {run.operation && (
          <p className="mt-2 text-caption text-text-secondary">
            Operation: {OPERATION_LABELS[run.operation] || run.operation}
          </p>
        )}
        <p className="text-caption text-text-secondary">开始 {run.started_at || "-"}</p>
        <p className="text-caption text-text-secondary">结束 {run.completed_at || "-"}</p>
        <p className="text-caption text-text-secondary">
          Duration: {formatDuration(run.duration_ms, run.started_at, run.completed_at)}
        </p>
      </div>

      {/* 阶段详情 */}
      {run.stages && Object.keys(run.stages).length > 0 && (
        <div className="rounded-lg border border-border bg-muted p-3">
          <p className="text-caption uppercase tracking-overline text-text-muted">Stages</p>
          <div className="mt-2 space-y-2">
            {getSortedStages(run.stages).map(([stageName, stage]) => (
              <div key={stageName}>
                <div className="flex min-w-0 items-center gap-2 text-caption">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${getStageColor(stageName, stage.status)}`} />
                  <span className="min-w-0 truncate font-medium text-text-secondary">
                    {STAGE_LABELS[stageName] || stageName}
                  </span>
                  <span className="shrink-0 uppercase text-text-muted">
                    {stage.status || "unknown"}
                  </span>
                  <span className="shrink-0 text-text-muted tabular-nums">
                    {stage.duration_ms ? `${stage.duration_ms}ms` : "-"}
                  </span>
                  {stage.status === "skipped" && stage.reason && (
                    <span className="truncate text-text-muted italic">({stage.reason})</span>
                  )}
                  {stage.error && (
                    <span className="truncate max-w-[120px] text-rose-500">
                      {getStageErrorSummary(stage.error)}
                    </span>
                  )}
                  {stage.output && (
                    <span className="truncate max-w-[120px] text-emerald-600 dark:text-emerald-400">
                      {typeof stage.output === "object" && stage.output !== null && "chunk_count" in stage.output
                        ? `${(stage.output as { chunk_count?: unknown }).chunk_count} chunks`
                        : typeof stage.output === "object" && stage.output !== null && "record_count" in stage.output
                          ? `${(stage.output as { record_count?: unknown }).record_count} records`
                          : ""}
                    </span>
                  )}
                </div>
                {stage.mcp_events && stage.mcp_events.length > 0 && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    {stage.mcp_events
                      .filter((evt) => evt.stage !== "stderr")
                      .map((evt, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-micro text-text-muted">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              evt.status === "completed"
                                ? "bg-emerald-400"
                                : evt.status === "running"
                                  ? "bg-amber-400 animate-pulse"
                                  : evt.status === "failed"
                                    ? "bg-rose-400"
                                    : "bg-text-muted"
                            }`}
                          />
                          <span className="truncate">{evt.title}</span>
                          <span className="shrink-0 text-text-muted">{evt.status}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="min-w-0">
        <p className="text-caption uppercase tracking-overline text-text-muted">Input</p>
        <pre className={detailJsonClassName}>
          {JSON.stringify(run.input ?? {}, null, 2)}
        </pre>
      </div>

      {/* Output */}
      <div className="min-w-0">
        <p className="text-caption uppercase tracking-overline text-text-muted">Output</p>
        <pre className={detailJsonClassName}>
          {JSON.stringify(run.output ?? {}, null, 2)}
        </pre>
      </div>

      {/* Errors */}
      {errorDetails.length > 0 && (
        <div className="min-w-0">
          <p className="text-caption uppercase tracking-overline text-text-muted">Errors</p>
          <div className="mt-2 space-y-3">
            {errorDetails.map((detail) => (
              <div
                key={detail.key}
                className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-caption font-semibold text-rose-700 dark:text-rose-300">
                      {detail.title}
                    </p>
                    {detail.failureLabel && (
                      <p className="mt-0.5 truncate text-micro text-rose-500 dark:text-rose-400">
                        {detail.failureLabel}
                      </p>
                    )}
                    {detail.diagnosticSummary && (
                      <p className="mt-0.5 line-clamp-2 text-micro text-rose-600 dark:text-rose-300">
                        {detail.diagnosticSummary}
                      </p>
                    )}
                  </div>
                  <span className="text-micro text-rose-500 dark:text-rose-400">
                    {detail.scope === "stage"
                      ? `${detail.status || "failed"}${detail.durationMs ? ` · ${formatDuration(detail.durationMs)}` : ""}`
                      : "failed"}
                  </span>
                </div>
                <p className="mt-1 text-caption text-rose-700 dark:text-rose-300">
                  {detail.message}
                </p>
                <pre className={errorJsonClassName}>
                  {JSON.stringify(detail.error, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
