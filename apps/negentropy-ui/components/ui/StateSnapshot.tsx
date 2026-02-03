type StateSnapshotProps = {
  snapshot: Record<string, unknown> | null;
};

export function StateSnapshot({ snapshot }: StateSnapshotProps) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">State Snapshot</p>
      <pre className="max-h-52 overflow-auto rounded-xl bg-zinc-100 p-3 text-xs text-zinc-700">
        {snapshot ? JSON.stringify(snapshot, null, 2) : "No snapshot"}
      </pre>
    </div>
  );
}
