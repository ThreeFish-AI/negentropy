type SessionItem = {
  id: string;
  label: string;
};

type SessionListProps = {
  sessions: SessionItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewSession?: () => void;
};

export function SessionList({ sessions, activeId, onSelect, onNewSession }: SessionListProps) {
  return (
    <aside className="col-span-2 border-r border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-zinc-500">Sessions</p>
        {onNewSession && (
          <button
            className="rounded-full bg-black px-3 py-1 text-[10px] font-semibold text-white hover:bg-zinc-800 transition-transform active:scale-95"
            onClick={onNewSession}
            type="button"
          >
            + New
          </button>
        )}
      </div>
      <div className="space-y-2">
        {sessions.length === 0 ? (
          <p className="text-xs text-zinc-400">暂无会话</p>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium ${
                session.id === activeId ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {session.label}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
