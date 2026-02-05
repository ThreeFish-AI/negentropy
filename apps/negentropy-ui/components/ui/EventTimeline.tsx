"use client";

import { useMemo, useState } from "react";

export type TimelineItem =
  | {
      id: string;
      kind: "tool";
      name: string;
      args: string;
      result: string;
      status: "running" | "done" | "completed";
      timestamp?: number;
      runId?: string;
    }
  | {
      id: string;
      kind: "artifact";
      title: string;
      content: Record<string, unknown>;
      timestamp?: number;
      runId?: string;
    }
  | {
      id: string;
      kind: "state";
      title: string;
      content: unknown;
      timestamp?: number;
      runId?: string;
    }
  | {
      id: string;
      kind: "event";
      title: string;
      content: unknown;
      timestamp?: number;
      runId?: string;
    };

type EventTimelineProps = {
  events: TimelineItem[];
};

function formatTimestamp(timestamp?: number) {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

import { JsonViewer } from "./JsonViewer";

// ... existing imports

// ... existing code

function TimelineItemRenderer({ item }: { item: TimelineItem }) {
  if (item.kind === "tool") {
    let argsObj: unknown = item.args;
    try {
      if (typeof item.args === "string") {
        argsObj = JSON.parse(item.args);
      }
    } catch {
      argsObj = item.args;
    }

    let resultObj: unknown = item.result;
    try {
      if (typeof item.result === "string") {
        resultObj = JSON.parse(item.result);
      }
    } catch {
      resultObj = item.result;
    }

    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between text-[10px] uppercase text-zinc-400 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>Tool Call</span>
          </div>
          <span>{formatTimestamp(item.timestamp)}</span>
        </div>
        <div className="text-sm font-semibold text-zinc-800 break-all mb-2">
          {item.name}
        </div>
        {item.args ? (
          <div className="mt-2 text-[10px]">
            <span className="uppercase tracking-wider text-[9px] text-zinc-400 block mb-1">
              Args
            </span>
            <div className="rounded bg-zinc-50 p-2 border border-zinc-100 max-h-64 overflow-auto custom-scrollbar">
              <JsonViewer data={argsObj} />
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-zinc-400 italic">No arguments</p>
        )}

        {item.result && (
          <div className="mt-2 text-[10px]">
            <span className="uppercase tracking-wider text-[9px] text-zinc-400 block mb-1">
              Result
            </span>
            <div className="rounded bg-emerald-50/50 p-2 border border-emerald-100 max-h-64 overflow-auto custom-scrollbar">
              <JsonViewer data={resultObj} />
            </div>
          </div>
        )}
        {!item.result && item.status !== "running" && (
          <p className="mt-2 text-[10px] text-zinc-400 italic">
            No return value
          </p>
        )}
        <div className="mt-2 flex justify-end">
          <span
            className={`text-[9px] uppercase font-medium px-1.5 py-0.5 rounded ${
              item.status === "running"
                ? "bg-amber-100 text-amber-600"
                : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {item.status}
          </span>
        </div>
      </div>
    );
  }

  if (item.kind === "artifact") {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 shadow-sm group">
        <div className="flex items-center justify-between text-[10px] uppercase text-indigo-400 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            <span>{item.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span>{formatTimestamp(item.timestamp)}</span>
            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  JSON.stringify(item.content, null, 2),
                )
              }
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-indigo-600"
              title="Copy to Clipboard"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>
        </div>
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-white/80 p-2 text-[10px] text-indigo-800 border border-indigo-100 font-mono">
          {JSON.stringify(item.content, null, 2)}
        </pre>
      </div>
    );
  }

  if (item.kind === "state") {
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50/30 p-3 shadow-sm">
        <div className="flex items-center justify-between text-[10px] uppercase text-sky-400 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            <span>{item.title}</span>
          </div>
          <span>{formatTimestamp(item.timestamp)}</span>
        </div>
        <pre className="mt-2 max-h-32 overflow-auto rounded bg-white/80 p-2 text-[10px] text-sky-800 border border-sky-100 font-mono">
          {JSON.stringify(item.content, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between text-[10px] uppercase text-zinc-400 mb-2">
        <span>{item.title}</span>
        <span>{formatTimestamp(item.timestamp)}</span>
      </div>
      <div className="mt-1 text-[11px] text-zinc-600 break-words">
        {typeof item.content === "string"
          ? item.content
          : JSON.stringify(item.content)}
      </div>
    </div>
  );
}

function TimelineGroup({
  runId,
  items,
}: {
  runId?: string;
  items: TimelineItem[];
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!items.length) return null;

  return (
    <div className="relative mb-8 last:mb-0 pl-4 border-l-2 border-zinc-100/80 hover:border-zinc-200 transition-colors">
      <div
        className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-zinc-200 ring-4 ring-white cursor-pointer hover:bg-zinc-300 transition-colors z-10"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Expand Group" : "Collapse Group"}
      />

      <div
        className="mb-3 flex items-center gap-2 select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-600 cursor-pointer transition-colors">
          {runId ? `Run ${runId.slice(0, 8)}` : "System Events"}
        </span>
        <span className="text-[10px] text-zinc-300">•</span>
        <span className="text-[10px] text-zinc-400">
          {formatTimestamp(items[0].timestamp)}
        </span>
      </div>

      {!isCollapsed && (
        <div className="space-y-4">
          {items.map((item) => (
            <TimelineItemRenderer key={item.id} item={item} />
          ))}
        </div>
      )}
      {isCollapsed && (
        <div
          className="text-[10px] text-zinc-400 italic pl-1 cursor-pointer hover:text-zinc-600"
          onClick={() => setIsCollapsed(false)}
        >
          {items.length} events hidden...
        </div>
      )}
    </div>
  );
}

export function EventTimeline({ events }: EventTimelineProps) {
  const groups = useMemo(() => {
    const grouped: { runId?: string; items: TimelineItem[] }[] = [];
    if (events.length === 0) return grouped;

    let currentGroup: { runId?: string; items: TimelineItem[] } | null = null;

    events.forEach((item) => {
      // Logic: group sequential items with same runId
      // Or keep all "runId" items together even if interleaved?
      // Timeline should usually be time-ordered.
      // If items come in mixed, we split groups. Assumes events are sorted by time.
      if (!currentGroup || currentGroup.runId !== item.runId) {
        currentGroup = { runId: item.runId, items: [] };
        grouped.push(currentGroup);
      }
      currentGroup.items.push(item);
    });

    // Reverse groups so newest run is at top? Or items are usually newest-bottom?
    // page.tsx returns items sorted by time (oldest first usually?)
    // page.tsx sorts items.
    // If we want newest at TOP, we should reverse.
    // However, chat usually flows Down. Timeline usually flows Down.
    // Let's keep existing order.
    return grouped;
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center opacity-40">
        <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mb-3">
          <svg
            className="w-5 h-5 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-xs font-medium text-zinc-600">No events yet</p>
        <p className="text-[10px] text-zinc-400 max-w-[12rem] mt-1">
          Reference events will appear here during execution.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-xs font-semibold uppercase text-zinc-500 tracking-wider">
        Event Timeline
      </p>
      <div className="relative pb-8 min-h-[200px]">
        {groups.map((g, i) => (
          <TimelineGroup key={i} runId={g.runId} items={g.items} />
        ))}
      </div>
    </div>
  );
}
