"use client";

import { JsonViewer } from "./JsonViewer";
import { cn } from "../../lib/utils";

type StateSnapshotProps = {
  snapshot: Record<string, unknown> | null;
  connection?: string;
};

export function StateSnapshot({ snapshot, connection }: StateSnapshotProps) {
  // 状态点配色（F3 统一映射）：色彩仅作辅助，文本始终高对比中性色，徽标含 aria-label。
  const dotClass =
    connection === "streaming"
      ? "bg-success animate-pulse"
      : connection === "connecting"
        ? "bg-info animate-pulse"
        : connection === "blocked"
          ? "bg-warning"
          : connection === "error"
            ? "bg-error"
            : "bg-text-muted";
  return (
    <div className="flex flex-col">
      <div className="shrink-0 mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-text-muted tracking-wider">
          State Snapshot
        </p>
        {connection && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-border-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary"
            aria-label={`连接状态：${connection}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${dotClass}`}
              aria-hidden="true"
            />
            {connection}
          </span>
        )}
      </div>
      <div
        className={cn(
          "min-h-[100px] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-card p-3 shadow-sm relative custom-scrollbar group/snapshot",
          !snapshot ? "h-[85px]" : "h-[220px] resize-y",
        )}
      >
        {!snapshot ? (
          <div className="absolute inset-0 flex items-center justify-center text-border-muted text-xs">
            No State Available
          </div>
        ) : (
          <div className="w-full h-fit">
            <JsonViewer data={snapshot} />
          </div>
        )}
        {/* Resize handle hint */}
        {snapshot && (
          <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-border-muted opacity-20 group-hover/snapshot:opacity-50 transition-opacity pointer-events-none" />
        )}
      </div>
    </div>
  );
}
