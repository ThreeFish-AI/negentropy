import { useCallback, useRef, useState } from "react";
import { Archive, ArchiveRestore, ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import type { SessionListView } from "@/utils/session";

type SessionItem = {
  id: string;
  label: string;
};

type SessionListProps = {
  sessions: SessionItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  view: SessionListView;
  onSwitchView: (view: SessionListView) => void;
  onNewSession?: () => void;
  onRename?: (id: string, title: string) => Promise<void> | void;
  onArchive?: (id: string) => Promise<void> | void;
  onUnarchive?: (id: string) => Promise<void> | void;
};

export function SessionList({
  sessions,
  activeId,
  onSelect,
  view,
  onSwitchView,
  onNewSession,
  onRename,
  onArchive,
  onUnarchive,
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
        <div>
          <p className="text-xs font-semibold uppercase text-muted">
            {view === "archived" ? "Archived Sessions" : "Sessions"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {view === "active" ? (
            <>
              <button
                className={outlineButtonClassName(
                  "neutral",
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                )}
                onClick={() => onSwitchView("archived")}
                type="button"
              >
                <Archive className="h-3 w-3" />
                Archived
              </button>
              {onNewSession && (
                <button
                  className="rounded-full bg-foreground px-3 py-1 text-[10px] font-semibold text-background hover:bg-zinc-800 transition-transform active:scale-95 dark:hover:bg-zinc-200"
                  onClick={onNewSession}
                  type="button"
                >
                  + New
                </button>
              )}
            </>
          ) : (
            <button
              className={outlineButtonClassName(
                "neutral",
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
              )}
              onClick={() => onSwitchView("active")}
              type="button"
            >
              <ChevronLeft className="h-3 w-3" />
              Back
            </button>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {sessions.length === 0 ? (
          <p className="text-xs text-muted">
            {view === "archived" ? "暂无已归档会话" : "暂无会话"}
          </p>
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
                <div
                  className={cn(
                    "group flex items-center gap-1 rounded-lg transition-colors",
                    session.id === activeId ? "bg-foreground text-background" : "bg-muted text-text-secondary hover:bg-accent",
                  )}
                >
                  <button
                    onClick={() => onSelect(session.id)}
                    onDoubleClick={() => {
                      if (view === "active" && onRename) {
                        startEdit(session);
                      }
                    }}
                    className="min-w-0 flex-1 truncate px-3 py-2 text-left text-xs font-medium"
                    type="button"
                    title={view === "active" && onRename ? "双击编辑标题" : undefined}
                  >
                    {session.label}
                  </button>
                  {view === "active" && onArchive ? (
                    <button
                      type="button"
                      aria-label={`Archive ${session.label}`}
                      title="归档会话"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (window.confirm(`确认归档会话“${session.label}”吗？`)) {
                          void onArchive(session.id);
                        }
                      }}
                      className={cn(
                        "mr-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-current opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100",
                        session.id === activeId ? "hover:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/10",
                      )}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {view === "archived" && onUnarchive ? (
                    <button
                      type="button"
                      aria-label={`Unarchive ${session.label}`}
                      title="解档会话"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (window.confirm(`确认解档会话“${session.label}”吗？`)) {
                          void onUnarchive(session.id);
                        }
                      }}
                      className={cn(
                        "mr-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-current opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100",
                        session.id === activeId ? "hover:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/10",
                      )}
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
