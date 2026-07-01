import { useCallback, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { useInfiniteScrollSentinel } from "@/hooks/useInfiniteScrollSentinel";
import { bucketSessionsByRecency, type SessionListView } from "@/utils/session";

const PAGE_SIZE = 10;

type SessionItem = {
  id: string;
  label: string;
  /** 时间摘要（保留于类型以向后兼容传参；栏内改由时间分组标题表达，不再逐条渲染）。 */
  timeLabel?: string;
  /** 最近更新时间（epoch 秒），用于 Doubao 式时间分组。 */
  lastUpdateTime?: number;
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
  const filteredSessions = useMemo(
    () =>
      normalizedQuery
        ? sessions.filter((s) => s.label.toLowerCase().includes(normalizedQuery))
        : sessions,
    [sessions, normalizedQuery],
  );

  // 统一分页（client 模式）：全量过滤结果已在内存，渐进切片即可。
  // filters 编入 view / query，二者变化即由 hook 自动 reset 回第 1 页（替代原手搓 reset effect）。
  const list = useInfiniteList<SessionItem, { view: SessionListView; q: string }>({
    fetcher: useMemo(() => ({ kind: "client" as const, items: filteredSessions }), [filteredSessions]),
    pageSize: PAGE_SIZE,
    filters: { view, q: normalizedQuery },
  });

  // Doubao 式连续滚动：滚动容器 ref 作为无限滚动哨兵的观察根。
  const scrollRootRef = useRef<HTMLDivElement | null>(null);

  // 无限滚动哨兵：滚到底（提前 200px）→ 揭示下一页。root = 会话列表 overflow 容器。
  const { sentinelRef } = useInfiniteScrollSentinel({
    onReach: list.loadMore,
    enabled: list.hasMore && !list.loadingMore && !list.loading,
    root: scrollRootRef,
  });

  // 已懒加载的切片按时间分档（今天 / 昨天 / 7 天内 / 30 天内 / 更早）。
  // list.items 为已排序数组的连续前缀，直接对前缀分组即得有序时间组。
  const groups = useMemo(() => bucketSessionsByRecency(list.items), [list.items]);

  // 确认弹窗状态：归档 / 解档 / 删除共用一套对话框，避免浏览器原生弹窗的样式割裂（参考 ISSUE-045 / ISSUE-054）
  const [confirmTarget, setConfirmTarget] = useState<
    | { kind: "archive" | "unarchive" | "delete"; session: SessionItem }
    | null
  >(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // 单实例「⋯」更多菜单：以 menuSession 标记当前打开的行，anchorRef 指向该行触发钮。
  const [menuSession, setMenuSession] = useState<SessionItem | null>(null);
  const menuAnchorRef = useRef<HTMLElement | null>(null);

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

  // 依据视图与可用回调，为「⋯」菜单装配操作项（保留稳定可及名，便于测试与读屏）。
  const menuItems = useMemo<DropdownMenuItem[]>(() => {
    const session = menuSession;
    if (!session) return [];
    const items: DropdownMenuItem[] = [];
    if (view === "active" && onRename) {
      items.push({
        id: "rename",
        label: "重命名",
        ariaLabel: `Rename ${session.label}`,
        icon: Pencil,
        onSelect: () => startEdit(session),
      });
    }
    if (view === "active" && onArchive) {
      items.push({
        id: "archive",
        label: "归档",
        ariaLabel: `Archive ${session.label}`,
        icon: Archive,
        onSelect: () => setConfirmTarget({ kind: "archive", session }),
      });
    }
    if (view === "archived" && onUnarchive) {
      items.push({
        id: "unarchive",
        label: "解档",
        ariaLabel: `Unarchive ${session.label}`,
        icon: ArchiveRestore,
        onSelect: () => setConfirmTarget({ kind: "unarchive", session }),
      });
    }
    if (onDelete) {
      items.push({
        id: "delete",
        label: "删除",
        ariaLabel: `Delete ${session.label}`,
        icon: Trash2,
        danger: true,
        onSelect: () => setConfirmTarget({ kind: "delete", session }),
      });
    }
    return items;
  }, [menuSession, view, onRename, onArchive, onUnarchive, onDelete, startEdit]);

  const openMenu = useCallback((session: SessionItem, trigger: HTMLElement) => {
    menuAnchorRef.current = trigger;
    setMenuSession(session);
  }, []);

  // 该视图下每行是否存在可用操作（决定是否渲染「⋯」触发钮）。
  const hasRowActions =
    (view === "active" && Boolean(onRename || onArchive)) ||
    (view === "archived" && Boolean(onUnarchive)) ||
    Boolean(onDelete);

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
    <DropdownMenu
      open={menuSession !== null}
      anchorRef={menuAnchorRef}
      items={menuItems}
      onClose={() => setMenuSession(null)}
      ariaLabel={menuSession ? `会话操作：${menuSession.label}` : "会话操作"}
    />
    <aside className="h-full border-r border-border bg-card px-3 py-3 flex flex-col overflow-hidden">
      {/* 新建对话：全宽主操作（两视图均可见） */}
      {onNewSession && (
        <button
          type="button"
          onClick={onNewSession}
          className="mb-3 inline-flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-control bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-xs transition-[background-color,transform] duration-150 ease-out hover:bg-primary-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          新建对话
        </button>
      )}

      {/* View segmented control: Active / Archived */}
      <div
        role="tablist"
        aria-label="Session view"
        className="mb-3 grid shrink-0 grid-cols-2 gap-0.5 rounded-lg border border-border bg-border-muted/50 p-0.5 text-caption font-medium"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "active"}
          onClick={() => onSwitchView("active")}
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
            "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            view === "archived"
              ? "bg-card text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-primary",
          )}
        >
          <Archive className="h-3 w-3" />
          Archived
        </button>
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

      <div ref={scrollRootRef} className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        {list.items.length === 0 ? (
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
              <p className="text-micro text-text-muted/80">
                点击上方「新建对话」开始
              </p>
            ) : null}
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              {/* 吸顶时间分组标题：每组头部在滚动至下一组前保持吸顶（Doubao 式） */}
              <div className="sticky top-0 z-[1] bg-card/95 px-1 py-1 text-caption font-medium text-text-muted backdrop-blur-sm">
                {group.label}
              </div>
              <div className="space-y-0.5 pb-2">
                {group.items.map((session) => {
                  const isActive = session.id === activeId;
                  const isMenuOpen = menuSession?.id === session.id;
                  return (
                    <div
                      key={session.id}
                      data-session-id={session.id}
                      data-active={isActive ? "true" : "false"}
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
                          aria-current={isActive ? "true" : undefined}
                          className={cn(
                            "group relative flex items-center gap-0.5 rounded-lg pr-1 transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-text-secondary hover:bg-muted hover:text-text-primary",
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
                            title={
                              view === "active" && onRename
                                ? "双击编辑标题"
                                : undefined
                            }
                          >
                            <span className="block truncate">{session.label}</span>
                          </button>
                          {hasRowActions ? (
                            <button
                              type="button"
                              aria-label={`会话操作 ${session.label}`}
                              aria-haspopup="menu"
                              aria-expanded={isMenuOpen}
                              title="更多操作"
                              onClick={(event) => {
                                event.stopPropagation();
                                openMenu(session, event.currentTarget);
                              }}
                              className={cn(
                                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-border-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                isMenuOpen
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                              )}
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
        {/* 无限滚动哨兵：进入视口即揭示下一页（hasMore 为否时 hook 自动停观察）。 */}
        <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      </div>
    </aside>
    </>
  );
}
