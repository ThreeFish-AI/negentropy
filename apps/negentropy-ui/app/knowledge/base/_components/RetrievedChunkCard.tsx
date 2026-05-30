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
  showHitPrefix?: boolean;
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
  showHitPrefix = true,
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
            "flex min-w-0 flex-wrap items-center gap-1.5 text-caption font-medium text-text-muted",
            isCompact && "text-micro",
          )}
        >
          <Grip className={cn("h-[11px] w-[11px] shrink-0", isCompact && "h-2.5 w-2.5")} />
          <span className="truncate text-text-secondary">{chunk.title}</span>
          <span className="shrink-0 text-text-muted">·</span>
          <span className="shrink-0 text-text-secondary">{chunk.characterCount} characters</span>
          {badges}
        </div>
        {!hideScores && (
          <span
            className={cn(
              "shrink-0 rounded bg-blue-600 px-1.5 py-[3px] text-micro font-semibold text-white",
              isCompact && "px-1 py-[2px]",
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
            isCompact && "text-caption",
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
              "flex items-center gap-1.5 text-caption font-semibold tracking-wide text-text-secondary",
              isCompact && "text-micro",
            )}
          >
            {isExpanded ? (
              <ChevronDown className={cn("h-3.5 w-3.5", isCompact && "h-3 w-3")} />
            ) : (
              <ChevronRight className={cn("h-3.5 w-3.5", isCompact && "h-3 w-3")} />
            )}
            <span>{showHitPrefix ? "HIT " : ""}{chunk.childHitCount} CHILD CHUNKS</span>
          </button>

          {isExpanded && chunk.childChunks.length > 0 && (
            <div id={childSectionId} className="mt-2.5 flex flex-col gap-1.5">
              {chunk.childChunks.map((childChunk) => {
                const childContent = (
                  <>
                    <span
                      className={cn(
                        "rounded bg-blue-600 px-1.5 py-[3px] text-micro font-semibold text-white",
                        isCompact && "px-1 py-[2px]",
                      )}
                    >
                      {childChunk.label}
                    </span>
                    {!hideScores && (
                      <span
                        className={cn(
                          "rounded bg-blue-600/85 px-1.5 py-[3px] text-micro font-semibold text-white",
                          isCompact && "px-1 py-[2px]",
                        )}
                      >
                        SCORE {formatScore(childChunk.score)}
                      </span>
                    )}
                    <span
                      className={cn(
                        "line-clamp-1 min-w-0 flex-1 rounded bg-blue-500/20 px-1.5 py-[3px] text-caption text-foreground",
                        isCompact && "text-micro",
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
                        "flex w-full flex-wrap items-center gap-1.5 text-left text-caption text-foreground",
                        isCompact && "text-micro",
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
                      "flex flex-wrap items-center gap-1.5 text-caption text-foreground",
                      isCompact && "text-micro",
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
            "flex items-center justify-between gap-3 border-t border-border px-3 py-2.5 text-caption",
            isCompact && "text-micro",
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5 text-text-secondary">
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
              "inline-flex items-center gap-1 text-caption font-medium uppercase tracking-overline text-text-muted hover:text-foreground",
              isCompact && "text-micro",
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
