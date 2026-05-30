"use client";

import type { KgPipelineRun } from "../utils/unified-pipeline";
import {
  formatDuration,
  getSortedStages,
  getStageColor,
  STAGE_LABELS,
  OPERATION_LABELS,
} from "../utils/pipeline-helpers";

const detailJsonClassName =
  "mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-[11px]";

/**
 * KG 构建运行详情面板
 *
 * 展示 KG 专属信息：模型名称、实体/关系统计、阶段进度、抽取配置、错误信息
 */
export function KgRunDetailPanel({ run }: { run: KgPipelineRun }) {
  return (
    <div className="mt-3 min-w-0 space-y-3 text-xs text-text-secondary">
      {/* 基本信息 */}
      <div className="rounded-lg border border-border bg-muted p-3">
        <p className="text-[11px] uppercase text-text-muted">Info</p>
        <p className="mt-2 text-[11px] text-text-secondary">
          Operation: {OPERATION_LABELS.graph_build}
        </p>
        <p className="text-[11px] text-text-secondary">
          Corpus: {run.corpus_id}
        </p>
        <p className="text-[11px] text-text-secondary">开始 {run.started_at || "-"}</p>
        <p className="text-[11px] text-text-secondary">结束 {run.completed_at || "-"}</p>
        <p className="text-[11px] text-text-secondary">
          Duration: {formatDuration(run.duration_ms, run.started_at, run.completed_at)}
        </p>
        {run.model_name && (
          <p className="text-[11px] text-text-secondary">
            Model: {run.model_name}
          </p>
        )}
        {run.progress_percent != null && (
          <p className="text-[11px] text-text-secondary">
            Progress: {Math.round(run.progress_percent * 100)}%
          </p>
        )}
      </div>

      {/* 实体/关系统计 */}
      <div className="rounded-lg border border-border bg-muted p-3">
        <p className="text-[11px] uppercase text-text-muted">Statistics</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-text-muted">实体数</p>
            <p className="text-sm font-semibold text-text-secondary tabular-nums">
              {run.entity_count}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-text-muted">关系数</p>
            <p className="text-sm font-semibold text-text-secondary tabular-nums">
              {run.relation_count}
            </p>
          </div>
        </div>
      </div>

      {/* 阶段详情 */}
      {run.stages && Object.keys(run.stages).length > 0 && (
        <div className="rounded-lg border border-border bg-muted p-3">
          <p className="text-[11px] uppercase text-text-muted">Phases</p>
          <div className="mt-2 space-y-2">
            {getSortedStages(run.stages).map(([stageName, stage]) => (
              <div key={stageName}>
                <div className="flex min-w-0 items-center gap-2 text-[11px]">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${getStageColor(stageName, stage.status)}`} />
                  <span className="min-w-0 truncate font-medium text-text-secondary">
                    {STAGE_LABELS[stageName] || stageName}
                  </span>
                  <span className="shrink-0 uppercase text-text-muted">
                    {stage.status || "unknown"}
                  </span>
                  {stage.status === "skipped" && stage.reason && (
                    <span className="truncate text-text-muted italic">({stage.reason})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 抽取配置 */}
      {run.extractor_config && Object.keys(run.extractor_config).length > 0 && (
        <div className="min-w-0">
          <p className="text-[11px] uppercase text-text-muted">Extractor Config</p>
          <pre className={detailJsonClassName}>
            {JSON.stringify(run.extractor_config, null, 2)}
          </pre>
        </div>
      )}

      {/* Warnings */}
      {run.warnings && run.warnings.length > 0 && (() => {
        // 过滤掉 _phase 条目，只显示实际 warning
        const realWarnings = run.warnings.filter(
          (w) => !("_phase" in (w as Record<string, unknown>)),
        );
        if (realWarnings.length === 0) return null;
        return (
          <div className="min-w-0">
            <p className="text-[11px] uppercase text-text-muted">
              Warnings ({realWarnings.length})
            </p>
            <div className="mt-2 max-h-32 space-y-1.5 overflow-auto">
              {realWarnings.map((w, i) => (
                <div
                  key={i}
                  className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                >
                  {JSON.stringify(w)}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 错误信息 */}
      {run.error_message && (
        <div className="min-w-0">
          <p className="text-[11px] uppercase text-text-muted">Error</p>
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
            <p className="text-[11px] text-rose-700 dark:text-rose-300">
              {run.error_message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
