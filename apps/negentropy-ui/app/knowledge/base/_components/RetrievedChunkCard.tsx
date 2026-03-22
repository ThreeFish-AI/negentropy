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
        "rounded-xl border border-border bg-card text-left shadow-sm transition",
        "hover:border-border-muted hover:bg-card/95",
        className,
      )}
    >
      <div className={cn("flex items-start justify-between gap-3 px-3 pt-3", isCompact && "gap-2.5")}>
        <div
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400",
            isCompact && "text-[10px]",
          )}
        >
          <Grip className={cn("h-[11px] w-[11px] shrink-0", isCompact && "h-2.5 w-2.5")} />
          <span className="truncate text-zinc-600 dark:text-zinc-400">{chunk.title}</span>
          <span className="shrink-0 text-zinc-400 dark:text-zinc-500">·</span>
          <span className="shrink-0 text-zinc-600 dark:text-zinc-400">{chunk.characterCount} characters</span>
          {badges}
        </div>
        {!hideScores && (
          <span
            className={cn(
              "shrink-0 rounded bg-blue-600 px-1.5 py-[3px] text-[9px] font-semibold text-white",
              isCompact && "px-1 py-[2px] text-[8px]",
            )}
          >
            SCORE {formatScore(chunk.score)}
          </span>
        )}
      </div>

      <div className="px-3 pb-2.5 pt-1.5">
        <p
          className={cn(
            "line-clamp-2 whitespace-pre-wrap text-[12px] font-medium text-foreground",
            isCompact && "text-[11px]",
          )}
        >
          {chunk.preview}
        </p>
      </div>

      {hasChildren && (
        <div className="px-3 pb-3">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={childSectionId}
            onClick={(event) => {
              event.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-zinc-700 dark:text-zinc-300",
              isCompact && "text-[10px]",
            )}
          >
            {isExpanded ? (
              <ChevronDown className={cn("h-3.5 w-3.5", isCompact && "h-3 w-3")} />
            ) : (
              <ChevronRight className={cn("h-3.5 w-3.5", isCompact && "h-3 w-3")} />
            )}
            <span>HIT {chunk.childHitCount} CHILD CHUNKS</span>
          </button>

          {isExpanded && chunk.childChunks.length > 0 && (
            <div id={childSectionId} className="mt-2.5 flex flex-col gap-1.5">
              {chunk.childChunks.map((childChunk) => {
                const childContent = (
                  <>
                    <span
                      className={cn(
                        "rounded bg-blue-600 px-1.5 py-[3px] text-[9px] font-semibold text-white",
                        isCompact && "px-1 py-[2px] text-[8px]",
                      )}
                    >
                      {childChunk.label}
                    </span>
                    {!hideScores && (
                      <span
                        className={cn(
                          "rounded bg-blue-600/85 px-1.5 py-[3px] text-[9px] font-semibold text-white",
                          isCompact && "px-1 py-[2px] text-[8px]",
                        )}
                      >
                        SCORE {formatScore(childChunk.score)}
                      </span>
                    )}
                    <span
                      className={cn(
                        "line-clamp-1 min-w-0 flex-1 rounded bg-blue-500/20 px-1.5 py-[3px] text-[11px] text-foreground",
                        isCompact && "text-[10px]",
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
                        "flex w-full flex-wrap items-center gap-1.5 text-left text-[11px] text-foreground",
                        isCompact && "text-[10px]",
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
                      "flex flex-wrap items-center gap-1.5 text-[11px] text-foreground",
                      isCompact && "text-[10px]",
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
            "flex items-center justify-between gap-3 border-t border-border px-3 py-2.5 text-[11px]",
            isCompact && "text-[10px]",
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
            <FileText className={cn("h-3.5 w-3.5 shrink-0 text-red-500", isCompact && "h-3 w-3")} />
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
              "inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              isCompact && "text-[10px]",
            )}
          >
            <span>Open</span>
            <ExternalLink className={cn("h-3.5 w-3.5", isCompact && "h-3 w-3")} />
          </button>
        </div>
      )}
    </article>
  );
}
