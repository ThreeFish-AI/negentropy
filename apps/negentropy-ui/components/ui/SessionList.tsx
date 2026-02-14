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
    <aside className="col-span-2 h-full border-r border-border bg-card p-4 overflow-y-auto custom-scrollbar">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-muted">Sessions</p>
        {onNewSession && (
          <button
            className="rounded-full bg-foreground px-3 py-1 text-[10px] font-semibold text-background hover:bg-zinc-800 transition-transform active:scale-95 dark:hover:bg-zinc-200"
            onClick={onNewSession}
            type="button"
          >
            + New
          </button>
        )}
      </div>
      <div className="space-y-2">
        {sessions.length === 0 ? (
          <p className="text-xs text-muted">暂无会话</p>
        ) : (
          sessions.map((session) => (
            <div key={session.id}>
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
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="输入会话标题"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => onSelect(session.id)}
                  onDoubleClick={() => {
                    if (onRename) {
                      startEdit(session);
                    }
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium truncate transition-colors ${
                    session.id === activeId
                      ? "bg-foreground text-background"
                      : "bg-muted text-text-secondary hover:bg-accent"
                  }`}
                  type="button"
                  title={onRename ? "双击编辑标题" : undefined}
                >
                  {session.label}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
