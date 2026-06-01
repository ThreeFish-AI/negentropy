"use client";

import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { useActivityLog } from "@/hooks/useActivityLog";
import { outlineButtonClassName } from "@/components/ui/button-styles";

import {
  LEVEL_OPTIONS,
  LEVEL_DOT,
  LEVEL_BADGE,
  formatTimestamp,
} from "./ActivityLogPanel";

const PAGE_SIZE = 12;

interface ActivityDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ActivityDrawer({ open, onClose }: ActivityDrawerProps) {
  const { entries, levelFilter, setLevelFilter, reload, clear, totalCount } =
    useActivityLog();

  const [currentPage, setCurrentPage] = useState(1);

  const handleLevelChange = useCallback(
    (level: typeof levelFilter) => {
      setLevelFilter(level);
      setCurrentPage(1);
    },
    [setLevelFilter],
  );

  const handleClose = useCallback(() => {
    setCurrentPage(1);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedEntries = entries.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <div
      data-testid="activity-log-panel"
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close drawer"
        className="absolute inset-0 bg-overlay backdrop-blur-[2px]"
      />
      <aside className="relative z-10 flex h-full [width:clamp(480px,66.67%,1100px)] flex-col border-l border-border bg-card shadow-xl">
        {/* Header */}
        <header className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                Activity
              </span>
              <span className="rounded-full bg-muted/50 px-2 py-0.5 text-micro font-semibold text-muted-foreground">
                {totalCount}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Level filter pills */}
          <nav className="mt-2 flex items-center gap-1 rounded-full bg-muted/50 p-0.5">
            {LEVEL_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                className={`rounded-full px-2.5 py-0.5 text-caption font-semibold transition-colors ${
                  levelFilter === opt.value
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => handleLevelChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="mt-2 flex items-center justify-end gap-2">
            <span className="text-caption text-muted-foreground">
              {entries.length}
              {levelFilter ? ` / ${totalCount}` : ""} entries
            </span>
            <button
              className={outlineButtonClassName(
                "neutral",
                "rounded-md px-2 py-1 text-caption font-semibold",
              )}
              onClick={reload}
            >
              Refresh
            </button>
            <button
              className={outlineButtonClassName(
                "danger",
                "rounded-md px-2 py-1 text-caption font-semibold",
              )}
              onClick={clear}
            >
              Clear All
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-auto px-4 py-3">
          {pagedEntries.length ? (
            <ul className="space-y-2">
              {pagedEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 shadow-sm"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT[entry.level]}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-micro font-semibold ${LEVEL_BADGE[entry.level]}`}
                      >
                        {entry.level}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-foreground">
                      {entry.message}
                    </p>
                    {entry.description ? (
                      <p className="mt-0.5 text-caption text-muted-foreground">
                        {entry.description}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No activity recorded yet. Toast notifications will appear here as
              they occur across the platform.
            </div>
          )}
        </div>

        {/* Pagination */}
        {entries.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() =>
                setCurrentPage(Math.max(1, safePage - 1))
              }
              aria-label="Previous page"
              className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-micro font-medium text-muted-foreground">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() =>
                setCurrentPage(Math.min(totalPages, safePage + 1))
              }
              aria-label="Next page"
              className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
