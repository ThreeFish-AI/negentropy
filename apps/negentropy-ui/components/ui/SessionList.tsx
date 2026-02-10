import { useCallback, useRef, useState } from "react";

type SessionItem = {
  id: string;
  label: string;
};

type SessionListProps = {
  sessions: SessionItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewSession?: () => void;
  onRename?: (id: string, title: string) => Promise<void> | void;
};

export function SessionList({
  sessions,
  activeId,
  onSelect,
  onNewSession,
  onRename,
}: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const ignoreBlurRef = useRef(false);

  const startEdit = useCallback((session: SessionItem) => {
    setEditingId(session.id);
    setDraftTitle(session.label);
  }, []);

  const finishEdit = useCallback(
    async (shouldCommit: boolean) => {
      if (!editingId) {
        return;
      }
      const targetId = editingId;
      const nextTitle = draftTitle.trim();
      setEditingId(null);
      if (shouldCommit && onRename) {
        await onRename(targetId, nextTitle);
      }
    },
    [draftTitle, editingId, onRename],
  );

  return (
    <aside className="col-span-2 h-full border-r border-zinc-200 bg-white p-4 overflow-y-auto custom-scrollbar">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-zinc-500">
          Sessions
        </p>
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
            <div key={session.id} className="flex items-center gap-2">
              {editingId === session.id ? (
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onBlur={() => {
                    if (ignoreBlurRef.current) {
                      ignoreBlurRef.current = false;
                      return;
                    }
                    void finishEdit(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      ignoreBlurRef.current = true;
                      void finishEdit(true);
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      ignoreBlurRef.current = true;
                      void finishEdit(false);
                    }
                  }}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  placeholder="输入会话标题"
                  autoFocus
                />
              ) : (
                <>
                  <button
                    onClick={() => onSelect(session.id)}
                    className={`flex-1 rounded-lg px-3 py-2 text-left text-xs font-medium truncate transition-colors ${
                      session.id === activeId
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                    type="button"
                  >
                    {session.label}
                  </button>
                  {onRename && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        startEdit(session);
                      }}
                      className="rounded-md border border-zinc-200 bg-white p-1 text-zinc-400 hover:text-zinc-700 hover:border-zinc-300"
                      title="编辑标题"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M14.846 2.146a1.5 1.5 0 0 1 2.121 2.122l-9.19 9.19a1.5 1.5 0 0 1-.67.39l-3.26.93a.5.5 0 0 1-.62-.62l.93-3.26a1.5 1.5 0 0 1 .39-.67l9.19-9.19Z" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
