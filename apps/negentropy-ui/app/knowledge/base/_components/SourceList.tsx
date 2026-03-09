"use client";

import { useState } from "react";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import type { SourceSummary } from "@/features/knowledge";

interface SourceListProps {
  sources: SourceSummary[];
  selectedUri: string | null | undefined;
  onSelect: (uri: string | null | undefined) => void;
  onAddSource?: () => void;
  onReplaceSource?: (uri: string) => void;
  onSyncSource?: (uri: string) => void;
  onRebuildSource?: (uri: string) => void;
  onDeleteSource?: (payload: { uri: string; name: string }) => void;
  onArchiveSource?: (uri: string) => void;
  onUnarchiveSource?: (uri: string) => void;
}

function getFallbackDisplayName(uri: string): string {
  if (uri.startsWith("gs://")) {
    const parts = uri.split("/");
    return parts[parts.length - 1] || uri;
  }
  return uri;
}

export function SourceList({
  sources,
  selectedUri,
  onSelect,
  onAddSource,
  onReplaceSource,
  onSyncSource,
  onRebuildSource,
  onDeleteSource,
  onArchiveSource,
  onUnarchiveSource,
}: SourceListProps) {
  const totalCount = sources.reduce((sum, item) => sum + item.count, 0);

  const sortedSources = [...sources].sort((a, b) => {
    if (a.source_uri === null) return 1;
    if (b.source_uri === null) return -1;
    return a.source_uri.localeCompare(b.source_uri);
  });

  return (
    <div className="space-y-1">
      <button
        className={`w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
          selectedUri === undefined
            ? "bg-foreground text-background shadow-sm"
            : "text-muted hover:bg-muted/50 hover:text-foreground"
        }`}
        onClick={() => onSelect(undefined)}
      >
        <span className="font-medium">All Sources</span>
        <span className="ml-1.5 text-[10px] opacity-70">({totalCount})</span>
      </button>

      {onAddSource && (
        <button
          onClick={onAddSource}
          className={outlineButtonClassName(
            "neutral",
            "w-full rounded-lg border-dashed px-2 py-1.5 text-xs",
          )}
        >
          + Add Source
        </button>
      )}

      {sortedSources.length > 0 && <div className="my-1.5 border-t border-border" />}

      {sortedSources.map((source) => {
        const uri = source.source_uri;
        const displayName = source.display_name || (uri ? getFallbackDisplayName(uri) : "(无来源)");
        const key = uri ?? "__no_source__";
        const showMenu = Boolean(
          uri &&
            (onReplaceSource ||
              onSyncSource ||
              onRebuildSource ||
              onDeleteSource ||
              onArchiveSource ||
              onUnarchiveSource),
        );

        return (
          <div key={key} className="flex min-w-0 items-center gap-1">
            <button
              className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                selectedUri === uri
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted hover:bg-muted/50 hover:text-foreground"
              }`}
              onClick={() => onSelect(uri)}
              title={displayName}
            >
              <span className="block truncate">{displayName}</span>
              <span className="text-[10px] opacity-70">
                {source.count} chunk{source.count > 1 ? "s" : ""}
                {source.archived ? " · Archived" : ""}
              </span>
            </button>
            {showMenu && uri && (
              <SourceMenu
                uri={uri}
                displayName={displayName}
                sourceType={source.source_type}
                archived={source.archived}
                onReplace={onReplaceSource}
                onSync={onSyncSource}
                onRebuild={onRebuildSource}
                onDelete={onDeleteSource}
                onArchive={onArchiveSource}
                onUnarchive={onUnarchiveSource}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SourceMenu({
  uri,
  displayName,
  sourceType,
  archived,
  onReplace,
  onSync,
  onRebuild,
  onDelete,
  onArchive,
  onUnarchive,
}: {
  uri: string;
  displayName: string;
  sourceType: "file" | "url" | "text" | "unknown";
  archived: boolean;
  onReplace?: (uri: string) => void;
  onSync?: (uri: string) => void;
  onRebuild?: (uri: string) => void;
  onDelete?: (payload: { uri: string; name: string }) => void;
  onArchive?: (uri: string) => void;
  onUnarchive?: (uri: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const closeAndRun = (fn?: (uri: string) => void) => {
    setIsOpen(false);
    fn?.(uri);
  };

  const closeAndRunDelete = () => {
    setIsOpen(false);
    onDelete?.({
      uri,
      name: displayName,
    });
  };

  const isFile = sourceType === "file";
  const isUrl = sourceType === "url";

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded p-1 text-muted transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
        title="Source actions"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[136px] rounded-lg border border-border bg-card p-1 shadow-lg">
            {onReplace && !isFile && (
              <button
                onClick={() => closeAndRun(onReplace)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-muted hover:text-foreground"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.232-6.232a2.5 2.5 0 113.536 3.536L12.536 16.536a4 4 0 01-1.79 1.024L7 18l.44-3.746A4 4 0 018.464 12.464z" />
                </svg>
                Replace
              </button>
            )}
            {onSync && isUrl && (
              <button
                onClick={() => closeAndRun(onSync)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-muted hover:text-foreground"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync
              </button>
            )}
            {onRebuild && isFile && (
              <button
                onClick={() => closeAndRun(onRebuild)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-muted hover:text-foreground"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Rebuild
              </button>
            )}
            {onDelete && (
              <button
                onClick={closeAndRunDelete}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                </svg>
                Delete
              </button>
            )}
            {!archived && onArchive && (
              <button
                onClick={() => closeAndRun(onArchive)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-muted hover:text-foreground"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8l1 11h12l1-11M9 8V5a3 3 0 016 0v3" />
                </svg>
                Archive
              </button>
            )}
            {archived && onUnarchive && (
              <button
                onClick={() => closeAndRun(onUnarchive)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-muted hover:text-foreground"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7v14" />
                </svg>
                Unarchive
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
