type StateSnapshotProps = {
  snapshot: Record<string, unknown> | null;
  connection?: string;
};

export function StateSnapshot({ snapshot, connection }: StateSnapshotProps) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-zinc-500">State Snapshot</p>
        {connection && (
          <span className={`text-[10px] font-medium uppercase tracking-wider ${
            connection === "idle"
              ? "text-zinc-400"
              : connection === "streaming"
              ? "text-emerald-600"
              : connection === "error"
              ? "text-red-600"
              : connection === "connecting"
              ? "text-amber-600"
              : "text-zinc-500"
          }`}>
            {connection}
          </span>
        )}
      </div>
      <pre className="max-h-52 overflow-auto rounded-xl bg-zinc-100 p-3 text-xs text-zinc-700">
        {snapshot ? JSON.stringify(snapshot, null, 2) : "No snapshot"}
      </pre>
    </div>
  );
}
