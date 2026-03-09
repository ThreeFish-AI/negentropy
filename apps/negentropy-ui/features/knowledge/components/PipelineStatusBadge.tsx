"use client";

import {
  getPipelineStatusColor,
  getPipelineStatusTextColor,
} from "../utils/pipeline-helpers";

interface PipelineStatusBadgeProps {
  status?: string;
  className?: string;
}

function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/**
 * Pipeline 运行状态展示
 *
 * 采用 Dashboard 现有的状态点 + 文本语义，供 Dashboard / Pipelines 共享，
 * 避免状态样式在多个页面漂移。
 */
export function PipelineStatusBadge({
  status,
  className,
}: PipelineStatusBadgeProps) {
  const label = status || "unknown";

  return (
    <span
      className={joinClassNames("inline-flex shrink-0 items-center gap-2", className)}
      role="status"
      aria-label={`状态: ${label}`}
    >
      <span
        className={joinClassNames(
          "h-2 w-2 shrink-0 rounded-full",
          getPipelineStatusColor(status),
        )}
        title={label}
      />
      <span
        className={joinClassNames(
          "text-[11px] font-medium uppercase",
          getPipelineStatusTextColor(status),
        )}
      >
        {label}
      </span>
    </span>
  );
}
