"use client";

import type { PipelineStageResult } from "../utils/knowledge-api";
import {
  calculateStageWidth,
  formatDuration,
  getSortedStages,
  getStageColor,
  getStageErrorSummary,
  STAGE_LABELS,
} from "../utils/pipeline-helpers";

interface PipelineStagesBarProps {
  stages?: Record<string, PipelineStageResult>;
  className?: string;
  gapClassName?: string;
  segmentClassName?: string;
  tooltipClassName?: string;
}

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function PipelineStagesBar({
  stages,
  className,
  gapClassName = "gap-0.5",
  segmentClassName,
  tooltipClassName,
}: PipelineStagesBarProps) {
  if (!stages || Object.keys(stages).length === 0) {
    return null;
  }

  return (
    <div className={joinClassNames("flex items-center", gapClassName, className)}>
      {getSortedStages(stages).map(([stageName, stage]) => (
        <div
          key={stageName}
          className={joinClassNames("group relative", segmentClassName)}
          style={{ width: calculateStageWidth(stage, stages) }}
        >
          <div
            className={joinClassNames(
              "h-1.5 w-full rounded-full",
              getStageColor(stageName, stage.status),
            )}
            aria-label={`阶段 ${STAGE_LABELS[stageName] || stageName}: ${stage.status || "unknown"}`}
          />
          <div
            className={joinClassNames(
              "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2",
              "rounded-md bg-zinc-800 px-2 py-1.5 text-[11px] text-white opacity-0 shadow-lg",
              "transition-opacity duration-150 group-hover:opacity-100 dark:bg-zinc-700 dark:text-zinc-100",
              "max-w-[180px] whitespace-normal break-words",
              tooltipClassName,
            )}
            role="tooltip"
          >
            <div className="font-medium">{STAGE_LABELS[stageName] || stageName}</div>
            <div className="text-zinc-300 dark:text-zinc-400">
              {stage.status || "unknown"}
              {stage.duration_ms ? ` · ${formatDuration(stage.duration_ms)}` : ""}
            </div>
            {stage.status === "failed" && stage.error && (
              <div className="mt-0.5 text-rose-400">{getStageErrorSummary(stage.error)}</div>
            )}
            {stage.status === "skipped" && stage.reason && (
              <div className="mt-0.5 italic text-zinc-400">{stage.reason}</div>
            )}
            {stage.mcp_events && stage.mcp_events.length > 0 && (() => {
              const lastEvent = stage.mcp_events.filter((e) => e.stage !== "stderr").at(-1);
              return lastEvent ? (
                <div className="mt-0.5 text-amber-300">
                  {lastEvent.title} · {lastEvent.status}
                </div>
              ) : null;
            })()}
          </div>
        </div>
      ))}
    </div>
  );
}
