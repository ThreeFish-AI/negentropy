"use client";

import { JsonViewer } from "./JsonViewer";

type StateSnapshotProps = {
  snapshot: Record<string, unknown> | null;
  connection?: string;
};

export function StateSnapshot({ snapshot, connection }: StateSnapshotProps) {
  return (
    <div className="mb-6 flex flex-col h-[40vh]">
      <div className="shrink-0 mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">
          State Snapshot
        </p>
        {connection && (
          <span
            className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
              connection === "idle"
                ? "bg-zinc-100 text-zinc-400"
                : connection === "streaming"
                  ? "bg-emerald-100 text-emerald-600 animate-pulse border border-emerald-200"
                  : connection === "error"
                    ? "bg-red-100 text-red-600 border border-red-200"
                    : connection === "connecting"
                      ? "bg-amber-100 text-amber-600 border border-amber-200"
                      : "text-zinc-500"
            }`}
          >
            {connection}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-auto rounded-xl border border-zinc-200 bg-white p-3 shadow-sm relative custom-scrollbar">
        {!snapshot ? (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-300 text-xs">
            No State Available
          </div>
        ) : (
          <div className="min-w-fit h-full">
            <JsonViewer data={snapshot} />
          </div>
        )}
      </div>
    </div>
  );
}
