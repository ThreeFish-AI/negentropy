"use client";

import { useId, useState } from "react";
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
}

function formatScore(score: number): string {
  return score.toFixed(2);
}

export function RetrievedChunkCard({
  chunk,
  onOpen,
}: RetrievedChunkCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const childSectionId = useId();
  const hasChildren = chunk.variant === "hierarchical" && chunk.childHitCount > 0;

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
      )}
    >
      <div className="flex items-start justify-between gap-4 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <Grip className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-zinc-600 dark:text-zinc-400">{chunk.title}</span>
          <span className="shrink-0 text-zinc-400 dark:text-zinc-500">·</span>
          <span className="shrink-0 text-zinc-600 dark:text-zinc-400">{chunk.characterCount} characters</span>
        </div>
        <span className="shrink-0 rounded bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white">
          SCORE {formatScore(chunk.score)}
        </span>
      </div>

      <div className="px-4 pb-3 pt-2">
        <p className="line-clamp-2 whitespace-pre-wrap text-[15px] font-medium text-foreground">
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
            className="flex items-center gap-2 text-sm font-semibold tracking-wide text-zinc-700 dark:text-zinc-300"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span>HIT {chunk.childHitCount} CHILD CHUNKS</span>
          </button>

          {isExpanded && chunk.childChunks.length > 0 && (
            <div id={childSectionId} className="mt-3 flex flex-col gap-2">
              {chunk.childChunks.map((childChunk) => (
                <div
                  key={childChunk.id}
                  className="flex flex-wrap items-center gap-2 text-sm text-foreground"
                >
                  <span className="rounded bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white">
                    {childChunk.label}
                  </span>
                  <span className="rounded bg-blue-600/85 px-2 py-1 text-[11px] font-semibold text-white">
                    SCORE {formatScore(childChunk.score)}
                  </span>
                  <span className="line-clamp-1 min-w-0 flex-1 rounded bg-blue-500/20 px-2 py-1 text-sm text-foreground">
                    {childChunk.content}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3 text-sm">
        <div className="flex min-w-0 items-center gap-2 text-zinc-700 dark:text-zinc-200">
          <FileText className="h-4 w-4 shrink-0 text-red-500" />
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
          className="inline-flex items-center gap-1 text-sm font-medium uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <span>Open</span>
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
