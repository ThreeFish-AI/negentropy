/* eslint-disable react-hooks/set-state-in-effect -- useEffect 内调用 setCurrentPage 重置分页 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { SessionListView } from "@/utils/session";

const PAGE_SIZE = 10;

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

  // 会话搜索：按标题客户端过滤（大小写不敏感），在当前视图（active/archived）内生效
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSessions = normalizedQuery
    ? sessions.filter((s) => s.label.toLowerCase().includes(normalizedQuery))
    : sessions;

  // 分页：过滤结果数量 / view / 查询变化时重置到第 1 页
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredSessions.length, view, normalizedQuery]);
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedSessions = filteredSessions.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

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
    <aside className="h-full border-r border-border bg-card px-3 py-3 flex flex-col overflow-hidden">
      <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
        {/* View segmented control: Active / Archived */}
        <div
          role="tablist"
          aria-label="Session view"
          className="inline-flex h-7 items-center rounded-lg border border-border bg-border-muted/50 p-0.5 text-[11px] font-medium"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "active"}
            onClick={() => onSwitchView("active")}
            className={cn(
              "whitespace-nowrap rounded-md px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              view === "active"
                ? "bg-card text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary",
            )}
          >
            Active
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "archived"}
            onClick={() => onSwitchView("archived")}
            className={cn(
              "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              view === "archived"
                ? "bg-card text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary",
            )}
          >
            <Archive className="h-3 w-3" />
            Archived
          </button>
        </div>
        {view === "active" && onNewSession && (
          <button
            className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-[background-color,transform] duration-150 ease-out hover:bg-primary-hover active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onNewSession}
            type="button"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        )}
      </div>
      {/* 会话搜索框 */}
      <div className="relative mb-3 shrink-0">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索会话…"
          aria-label="搜索会话"
          className="w-full rounded-lg border border-border bg-input py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-input-placeholder focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="space-y-1 flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        {pagedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-border-muted/70 text-text-muted">
              {normalizedQuery ? (
                <Search className="h-4 w-4" aria-hidden="true" />
              ) : view === "archived" ? (
                <Archive className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <p className="text-xs text-text-muted">
              {normalizedQuery
                ? "未找到匹配会话"
                : view === "archived"
                  ? "暂无已归档会话"
                  : "暂无会话"}
            </p>
            {!normalizedQuery && view === "active" && onNewSession ? (
              <p className="text-[10px] text-text-muted/80">
                点击右上角 New 开始新会话
              </p>
            ) : null}
          </div>
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
                  aria-current={session.id === activeId ? "true" : undefined}
                  className={cn(
                    "group relative flex items-center gap-0.5 rounded-lg pr-1.5 transition-colors",
                    session.id === activeId
                      ? "bg-primary/10 text-primary before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary"
                      : "text-text-secondary hover:bg-border-muted/70 hover:text-text-primary",
                  )}
                >
                  <button
                    onClick={() => onSelect(session.id)}
                    onDoubleClick={() => {
                      if (view === "active" && onRename) {
                        startEdit(session);
                      }
                    }}
                    className="min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    type="button"
                    aria-label={session.label}
                    title={view === "active" && onRename ? "双击编辑标题" : undefined}
                  >
                    <span className="block truncate">{session.label}</span>
                    {session.timeLabel && (
                      <span className={cn(
                        "block text-[10px] font-normal mt-0.5 truncate",
                        session.id === activeId ? "text-primary/70" : "text-text-muted",
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
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-text-muted opacity-0 transition-colors hover:bg-border-muted hover:text-text-primary group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-text-muted opacity-0 transition-colors hover:bg-border-muted hover:text-text-primary group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-error/70 opacity-0 transition-colors hover:bg-error/10 hover:text-error group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      {filteredSessions.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border shrink-0">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            aria-label="上一页"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-medium tabular-nums text-text-muted">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            aria-label="下一页"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </aside>
    </>
  );
}
