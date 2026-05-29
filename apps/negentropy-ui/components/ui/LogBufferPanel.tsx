import type { LogEntry } from "@/types/common";

type LogBufferPanelProps = {
  entries: LogEntry[];
  onExport?: () => void;
};

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

/** 日志级别 → 状态点配色（色彩仅作辅助，级别文本本身已表语义）。 */
function levelDotClass(level: string): string {
  const lvl = level?.toLowerCase?.() ?? "";
  if (lvl.includes("error") || lvl.includes("fatal") || lvl.includes("crit")) {
    return "bg-error";
  }
  if (lvl.includes("warn")) return "bg-warning";
  if (lvl.includes("info")) return "bg-info";
  return "bg-text-muted";
}

export function LogBufferPanel({ entries, onExport }: LogBufferPanelProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase text-text-muted">
            Runtime Logs
          </p>
          <span className="rounded-full bg-border-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-text-muted">
            {entries.length}
          </span>
        </div>
        <button
          className="rounded-full border border-border px-3 py-1 text-[11px] text-text-secondary transition-colors hover:bg-border-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onExport}
          type="button"
        >
          Export
        </button>
      </div>
      <div className="max-h-72 space-y-2 overflow-auto rounded-xl border border-border bg-card p-3 text-[11px] text-text-secondary custom-scrollbar">
        {entries.length === 0 ? (
          <p className="text-text-muted">暂无日志</p>
        ) : (
          entries.map((entry, index) => (
            <div
              key={entry.id ?? `${entry.timestamp}-${index}`}
              className="rounded-lg border border-border-muted bg-border-muted/50 p-2"
            >
              <div className="flex items-center justify-between text-[10px] uppercase">
                <span className="flex items-center gap-1.5 font-semibold text-text-secondary">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${levelDotClass(entry.level)}`}
                    aria-hidden="true"
                  />
                  {entry.level}
                </span>
                <span className="tabular-nums text-text-muted">
                  {formatTime(entry.timestamp)}
                </span>
              </div>
              <div className="mt-1 text-foreground">{entry.message}</div>
              {entry.payload ? (
                <pre className="mt-1 whitespace-pre-wrap text-[10px] text-text-muted">
                  {JSON.stringify(entry.payload, null, 2)}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
