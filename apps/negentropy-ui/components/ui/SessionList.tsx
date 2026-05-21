/* eslint-disable react-hooks/set-state-in-effect --
 * 分页重置逻辑需要 useEffect 内调用 setCurrentPage(1) 来响应
 * sessions.length / view 的变化。与项目中其他 hooks 采用相同的
 * eslint-disable 策略（参见 useSessionListService.ts 等）。
 */
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { SessionListView } from "@/utils/session";

const PAGE_SIZE = 12;

type SessionItem = {
  id: string;
  label: string;
  timeLabel?: string;
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
  /**
   * 硬删除会话回调（永久移除，不可恢复）。
   *
   * 与 ``onArchive``（软删=归档）正交：本回调最终触发数据库 ``DELETE FROM threads``，
   * 故组件内部统一经 destructive ConfirmDialog 二次确认后才会触发，避免误触。
   */
  onDelete?: (id: string) => Promise<void> | void;
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
  onDelete,
}: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const ignoreBlurRef = useRef(false);

  // 分页：sessions.length 或 view 变化时重置到第 1 页
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => {
    setCurrentPage(1);
  }, [sessions.length, view]);
  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedSessions = sessions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // 确认弹窗状态：归档 / 解档 / 删除共用一套对话框，避免浏览器原生弹窗的样式割裂（参考 ISSUE-045 / ISSUE-054）
  const [confirmTarget, setConfirmTarget] = useState<
    | { kind: "archive" | "unarchive" | "delete"; session: SessionItem }
    | null
  >(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    try {
      if (confirmTarget.kind === "archive" && onArchive) {
        await onArchive(confirmTarget.session.id);
      } else if (confirmTarget.kind === "unarchive" && onUnarchive) {
        await onUnarchive(confirmTarget.session.id);
      } else if (confirmTarget.kind === "delete" && onDelete) {
        await onDelete(confirmTarget.session.id);
      }
    } finally {
      setConfirmBusy(false);
      setConfirmTarget(null);
    }
  }, [confirmTarget, onArchive, onDelete, onUnarchive]);

  const confirmDialogCopy = (() => {
    if (!confirmTarget) {
      return { title: "", message: "", confirmLabel: "" };
    }
    if (confirmTarget.kind === "archive") {
      return {
        title: "归档会话",
        message: `确认归档会话「${confirmTarget.session.label}」吗？`,
        confirmLabel: "归档",
      };
    }
    if (confirmTarget.kind === "unarchive") {
      return {
        title: "解档会话",
        message: `确认解档会话「${confirmTarget.session.label}」吗？`,
        confirmLabel: "解档",
      };
    }
    // delete：强调"永久不可恢复"，降低误触风险
    return {
      title: "删除会话",
      message: `将永久删除会话「${confirmTarget.session.label}」及其全部消息历史，删除后不可恢复。是否继续？`,
      confirmLabel: "删除",
    };
  })();

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
    <>
    <ConfirmDialog
      open={confirmTarget !== null}
      title={confirmDialogCopy.title}
      message={confirmDialogCopy.message}
      confirmLabel={confirmDialogCopy.confirmLabel}
      cancelLabel="取消"
      // archive 与 delete 均为破坏性动作（红色按钮 + cancel autoFocus 防误触）；
      // unarchive 是恢复操作，使用默认中性样式即可。
      destructive={
        confirmTarget?.kind === "archive" || confirmTarget?.kind === "delete"
      }
      busy={confirmBusy}
      onConfirm={handleConfirm}
      onCancel={() => setConfirmTarget(null)}
    />
    <aside className="col-span-2 h-full border-r border-border bg-card p-4 flex flex-col overflow-hidden">
      <div className="mb-3 flex items-center justify-between shrink-0">
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
      <div className="space-y-2 flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        {pagedSessions.length === 0 ? (
          <p className="text-xs text-muted">
            {view === "archived" ? "暂无已归档会话" : "暂无会话"}
          </p>
        ) : (
          pagedSessions.map((session) => (
            <div
              key={session.id}
              data-session-id={session.id}
              data-active={session.id === activeId ? "true" : "false"}
            >
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
                    "group flex items-center gap-1 rounded-lg pr-2 transition-colors",
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
                    className="min-w-0 flex-1 px-3 py-2 text-left text-xs font-medium"
                    type="button"
                    aria-label={session.label}
                    title={view === "active" && onRename ? "双击编辑标题" : undefined}
                  >
                    <span className="block truncate">{session.label}</span>
                    {session.timeLabel && (
                      <span className={cn(
                        "block text-[10px] font-normal mt-0.5 truncate",
                        session.id === activeId ? "text-background/60" : "text-muted-foreground",
                      )}>
                        {session.timeLabel}
                      </span>
                    )}
                  </button>
                  {view === "active" && onArchive ? (
                    <button
                      type="button"
                      aria-label={`Archive ${session.label}`}
                      title="归档会话"
                      onClick={(event) => {
                        event.stopPropagation();
                        setConfirmTarget({ kind: "archive", session });
                      }}
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-md text-current opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100",
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
                        setConfirmTarget({ kind: "unarchive", session });
                      }}
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-md text-current opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100",
                        session.id === activeId ? "hover:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/10",
                      )}
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      aria-label={`Delete ${session.label}`}
                      title="删除会话（不可恢复）"
                      onClick={(event) => {
                        event.stopPropagation();
                        setConfirmTarget({ kind: "delete", session });
                      }}
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-md opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100",
                        session.id === activeId
                          ? "text-red-300 hover:bg-white/10 hover:text-red-200"
                          : "text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10",
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {sessions.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border shrink-0">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            aria-label="上一页"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-medium text-muted">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            aria-label="下一页"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </aside>
    </>
  );
}
