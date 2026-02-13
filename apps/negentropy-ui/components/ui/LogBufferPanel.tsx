import type { LogEntry } from "@/types/common";

type LogBufferPanelProps = {
  entries: LogEntry[];
  onExport?: () => void;
};

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

export function LogBufferPanel({ entries, onExport }: LogBufferPanelProps) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-muted">
          Runtime Logs
        </p>
        <button
          className="rounded-full border border-border px-3 py-1 text-[11px] text-text-secondary"
          onClick={onExport}
          type="button"
        >
          Export
        </button>
      </div>
      <div className="max-h-52 space-y-2 overflow-auto rounded-xl border border-border bg-card p-3 text-[11px] text-text-secondary">
        {entries.length === 0 ? (
          <p className="text-muted">暂无日志</p>
        ) : (
          entries.map((entry, index) => (
            <div
              key={entry.id ?? `${entry.timestamp}-${index}`}
              className="rounded-lg border border-border-muted bg-muted/50 p-2"
            >
              <div className="flex items-center justify-between text-[10px] uppercase text-muted">
                <span>{entry.level}</span>
                <span>{formatTime(entry.timestamp)}</span>
              </div>
              <div className="mt-1 text-foreground">{entry.message}</div>
              {entry.payload ? (
                <pre className="mt-1 whitespace-pre-wrap text-[10px] text-muted">
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
