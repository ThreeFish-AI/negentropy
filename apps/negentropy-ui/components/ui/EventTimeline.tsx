export type TimelineItem =
  | {
      id: string;
      kind: "tool";
      name: string;
      args: string;
      result: string;
      status: "running" | "done" | "completed";
      timestamp?: number;
    }
  | {
      id: string;
      kind: "artifact";
      title: string;
      content: Record<string, unknown>;
      timestamp?: number;
    }
  | {
      id: string;
      kind: "state";
      title: string;
      content: unknown;
      timestamp?: number;
    }
  | {
      id: string;
      kind: "event";
      title: string;
      content: unknown;
      timestamp?: number;
    };

type EventTimelineProps = {
  events: TimelineItem[];
};

function formatTimestamp(timestamp?: number) {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString();
}

export function EventTimeline({ events }: EventTimelineProps) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Event Timeline</p>
      <div className="space-y-3 text-xs text-zinc-700">
        {events.length === 0 ? (
          <p className="text-zinc-400">暂无事件</p>
        ) : (
          events.slice(-20).map((event) => {
            if (event.kind === "tool") {
              return (
                <div key={event.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                  <div className="flex items-center justify-between text-[10px] uppercase text-zinc-400">
                    <span>Tool</span>
                    <span>{formatTimestamp(event.timestamp)}</span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-zinc-800">{event.name}</div>
                  {event.args ? (
                    <pre className="mt-2 max-h-24 overflow-auto rounded bg-zinc-50 p-2 text-[11px] text-zinc-600">
                      {event.args}
                    </pre>
                  ) : (
                    <p className="mt-2 text-[11px] text-zinc-400">无入参</p>
                  )}
                  {event.result ? (
                    <pre className="mt-2 max-h-24 overflow-auto rounded bg-emerald-50 p-2 text-[11px] text-emerald-800">
                      {event.result}
                    </pre>
                  ) : (
                    <p className="mt-2 text-[11px] text-zinc-400">未返回结果</p>
                  )}
                  <div className="mt-2 text-[10px] uppercase text-zinc-400">{event.status}</div>
                </div>
              );
            }

            if (event.kind === "artifact") {
              return (
                <div key={event.id} className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                  <div className="flex items-center justify-between text-[10px] uppercase text-indigo-400">
                    <span>{event.title}</span>
                    <span>{formatTimestamp(event.timestamp)}</span>
                  </div>
                  <pre className="mt-2 max-h-24 overflow-auto rounded bg-white/80 p-2 text-[11px] text-indigo-800">
                    {JSON.stringify(event.content, null, 2)}
                  </pre>
                </div>
              );
            }

            if (event.kind === "state") {
              return (
                <div key={event.id} className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                  <div className="flex items-center justify-between text-[10px] uppercase text-sky-400">
                    <span>{event.title}</span>
                    <span>{formatTimestamp(event.timestamp)}</span>
                  </div>
                  <pre className="mt-2 max-h-24 overflow-auto rounded bg-white/80 p-2 text-[11px] text-sky-800">
                    {JSON.stringify(event.content, null, 2)}
                  </pre>
                </div>
              );
            }

            return (
              <div key={event.id} className="rounded-xl border border-zinc-200 p-3">
                <div className="flex items-center justify-between text-[10px] uppercase text-zinc-400">
                  <span>{event.title}</span>
                  <span>{formatTimestamp(event.timestamp)}</span>
                </div>
                <div className="mt-2 text-[11px] text-zinc-600">
                  {typeof event.content === "string" ? event.content : JSON.stringify(event.content)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
