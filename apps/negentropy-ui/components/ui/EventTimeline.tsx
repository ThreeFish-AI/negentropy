type TimelineEvent = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
};

type EventTimelineProps = {
  events: TimelineEvent[];
};

export function EventTimeline({ events }: EventTimelineProps) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Event Timeline</p>
      <div className="space-y-3 text-xs text-zinc-700">
        {events.length === 0 ? (
          <p className="text-zinc-400">暂无事件</p>
        ) : (
          events.slice(-20).map((event) => (
            <div key={event.id} className="rounded-lg border border-zinc-200 p-2">
              <div className="mb-1 text-[10px] uppercase text-zinc-400">{event.type}</div>
              <div className="truncate text-[11px] text-zinc-600">
                {JSON.stringify(event.payload)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
