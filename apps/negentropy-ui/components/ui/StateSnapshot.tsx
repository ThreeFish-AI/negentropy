"use client";

import { JsonViewer } from "./JsonViewer";
import { cn } from "../../lib/utils";

type StateSnapshotProps = {
  snapshot: Record<string, unknown> | null;
  connection?: string;
};

export function StateSnapshot({ snapshot, connection }: StateSnapshotProps) {
  return (
    <div className="mb-6 flex flex-col">
      <div className="shrink-0 mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-muted tracking-wider">
          State Snapshot
        </p>
        {connection && (
          <span
            className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
              connection === "idle"
                ? "bg-muted text-muted"
                : connection === "streaming"
                  ? "bg-emerald-100 text-emerald-600 animate-pulse border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                  : connection === "error"
                    ? "bg-red-100 text-red-600 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                    : connection === "connecting"
                      ? "bg-amber-100 text-amber-600 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
                      : "text-muted"
            }`}
          >
            {connection}
          </span>
        )}
      </div>
      <div
        className={cn(
          "min-h-[100px] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-card p-3 shadow-sm relative custom-scrollbar group/snapshot",
          !snapshot ? "h-[85px]" : "h-[170px] resize-y",
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
