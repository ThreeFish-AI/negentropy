"use client";

import { useId, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Grip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RetrievedChunkViewModel } from "./retrieved-chunk-presenter";

interface RetrievedChunkCardProps {
  chunk: RetrievedChunkViewModel;
  onOpen: () => void;
  className?: string;
  density?: "default" | "compact";
  hideFooter?: boolean;
  hideScores?: boolean;
  badges?: ReactNode;
  onChildChunkOpen?: (childChunkId: string) => void;
}

function formatScore(score: number): string {
  return score.toFixed(2);
}

export function RetrievedChunkCard({
  chunk,
  onOpen,
  className,
  density = "default",
  hideFooter = false,
  hideScores = false,
  badges,
  onChildChunkOpen,
}: RetrievedChunkCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const childSectionId = useId();
  const hasChildren = chunk.variant === "hierarchical" && chunk.childHitCount > 0;
  const isCompact = density === "compact";

  const handleOpen = () => {
    onOpen();
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpen();
        }
      }}
      className={cn(
        "rounded-2xl border border-border bg-card text-left shadow-sm transition",
        "hover:border-border-muted hover:bg-card/95",
        className,
      )}
    >
      <div className={cn("flex items-start justify-between gap-4 px-4 pt-4", isCompact && "gap-3")}>
        <div
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400",
            isCompact && "text-xs",
          )}
        >
          <Grip className={cn("h-3.5 w-3.5 shrink-0", isCompact && "h-3 w-3")} />
          <span className="truncate text-zinc-600 dark:text-zinc-400">{chunk.title}</span>
          <span className="shrink-0 text-zinc-400 dark:text-zinc-500">·</span>
          <span className="shrink-0 text-zinc-600 dark:text-zinc-400">{chunk.characterCount} characters</span>
          {badges}
        </div>
        {!hideScores && (
          <span
            className={cn(
              "shrink-0 rounded bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white",
              isCompact && "px-1.5 py-0.5 text-[10px]",
            )}
          >
            SCORE {formatScore(chunk.score)}
          </span>
        )}
      </div>

      <div className="px-4 pb-3 pt-2">
        <p
          className={cn(
            "line-clamp-2 whitespace-pre-wrap text-[15px] font-medium text-foreground",
            isCompact && "text-sm",
          )}
        >
          {chunk.preview}
        </p>
      </div>

      {hasChildren && (
        <div className="px-4 pb-4">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={childSectionId}
            onClick={(event) => {
              event.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            className={cn(
              "flex items-center gap-2 text-sm font-semibold tracking-wide text-zinc-700 dark:text-zinc-300",
              isCompact && "text-xs",
            )}
          >
            {isExpanded ? (
              <ChevronDown className={cn("h-4 w-4", isCompact && "h-3.5 w-3.5")} />
            ) : (
              <ChevronRight className={cn("h-4 w-4", isCompact && "h-3.5 w-3.5")} />
            )}
            <span>HIT {chunk.childHitCount} CHILD CHUNKS</span>
          </button>

          {isExpanded && chunk.childChunks.length > 0 && (
            <div id={childSectionId} className="mt-3 flex flex-col gap-2">
              {chunk.childChunks.map((childChunk) => {
                const childContent = (
                  <>
                    <span
                      className={cn(
                        "rounded bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white",
                        isCompact && "px-1.5 py-0.5 text-[10px]",
                      )}
                    >
                      {childChunk.label}
                    </span>
                    {!hideScores && (
                      <span
                        className={cn(
                          "rounded bg-blue-600/85 px-2 py-1 text-[11px] font-semibold text-white",
                          isCompact && "px-1.5 py-0.5 text-[10px]",
                        )}
                      >
                        SCORE {formatScore(childChunk.score)}
                      </span>
                    )}
                    <span
                      className={cn(
                        "line-clamp-1 min-w-0 flex-1 rounded bg-blue-500/20 px-2 py-1 text-sm text-foreground",
                        isCompact && "text-xs",
                      )}
                    >
                      {childChunk.content}
                    </span>
                  </>
                );

                if (onChildChunkOpen) {
                  return (
                    <button
                      key={childChunk.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onChildChunkOpen(childChunk.id);
                      }}
                      className={cn(
                        "flex w-full flex-wrap items-center gap-2 text-left text-sm text-foreground",
                        isCompact && "text-xs",
                      )}
                    >
                      {childContent}
                    </button>
                  );
                }

                return (
                  <div
                    key={childChunk.id}
                    className={cn(
                      "flex flex-wrap items-center gap-2 text-sm text-foreground",
                      isCompact && "text-xs",
                    )}
                  >
                    {childContent}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!hideFooter && (
        <div
          className={cn(
            "flex items-center justify-between gap-4 border-t border-border px-4 py-3 text-sm",
            isCompact && "text-xs",
          )}
        >
          <div className="flex min-w-0 items-center gap-2 text-zinc-700 dark:text-zinc-200">
            <FileText className={cn("h-4 w-4 shrink-0 text-red-500", isCompact && "h-3.5 w-3.5")} />
            <span className="truncate" title={chunk.sourceTitle}>
              {chunk.sourceLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleOpen();
            }}
            className={cn(
              "inline-flex items-center gap-1 text-sm font-medium uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              isCompact && "text-xs",
            )}
          >
            <span>Open</span>
            <ExternalLink className={cn("h-4 w-4", isCompact && "h-3.5 w-3.5")} />
          </button>
        </div>
      )}
    </article>
  );
}
