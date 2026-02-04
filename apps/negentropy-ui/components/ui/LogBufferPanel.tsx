type LogEntry = {
  id: string;
  timestamp: number;
  level: "info" | "warn" | "error";
  message: string;
  payload?: Record<string, unknown>;
};

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
        <p className="text-xs font-semibold uppercase text-zinc-500">Runtime Logs</p>
        <button
          className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] text-zinc-600"
          onClick={onExport}
          type="button"
        >
          Export
        </button>
      </div>
      <div className="max-h-52 space-y-2 overflow-auto rounded-xl border border-zinc-200 bg-white p-3 text-[11px] text-zinc-600">
        {entries.length === 0 ? (
          <p className="text-zinc-400">暂无日志</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-2">
              <div className="flex items-center justify-between text-[10px] uppercase text-zinc-400">
                <span>{entry.level}</span>
                <span>{formatTime(entry.timestamp)}</span>
              </div>
              <div className="mt-1 text-zinc-700">{entry.message}</div>
              {entry.payload ? (
                <pre className="mt-1 whitespace-pre-wrap text-[10px] text-zinc-500">
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
