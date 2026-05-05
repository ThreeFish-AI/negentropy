"use client";

import { useId } from "react";
import { FileText, Grip, X } from "lucide-react";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import type { RetrievedChunkViewModel } from "./retrieved-chunk-presenter";

interface RetrievedChunkDetailDialogProps {
  chunk: RetrievedChunkViewModel | null;
  onClose: () => void;
}

function formatScore(score: number): string {
  return score.toFixed(2);
}

export function RetrievedChunkDetailDialog({
  chunk,
  onClose,
}: RetrievedChunkDetailDialogProps) {
  const titleId = useId();

  if (!chunk) return null;

  const isHierarchical = chunk.variant === "hierarchical";

  return (
    <OverlayDismissLayer
      open={chunk !== null}
      onClose={onClose}
      containerClassName="flex min-h-full items-center justify-center p-4"
      contentClassName="flex h-[82vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl"
      backdropTestId="retrieved-chunk-dialog-backdrop"
      contentProps={{
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": titleId,
      }}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-4">
        <h2 id={titleId} className="text-2xl font-semibold text-foreground">
          Chunk Detail
        </h2>
        <button
          type="button"
          aria-label="Close chunk detail"
          onClick={onClose}
          className="rounded-full border border-border p-1.5 text-zinc-400 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 px-4 pb-4">
        <div className={`grid h-full min-h-0 gap-4 ${isHierarchical ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]" : "grid-cols-1"}`}>
          <section className="min-h-0 rounded-2xl bg-card px-1">
            <div className="mb-3 flex flex-wrap items-center gap-2.5 text-[11px] font-medium text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <Grip className="h-[11px] w-[11px]" />
                {chunk.title}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-red-500" />
                <span title={chunk.sourceTitle}>{chunk.sourceLabel}</span>
              </span>
            </div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {chunk.characterCount} characters
              </div>
              <span className="rounded bg-blue-600 px-1.5 py-[3px] text-[9px] font-semibold text-white">
                SCORE {formatScore(chunk.score)}
              </span>
            </div>
            <div className="h-[calc(100%-3.5rem)] overflow-y-auto pr-2">
              <p className="whitespace-pre-wrap text-[13px] leading-7 text-foreground">
                {chunk.fullContent}
              </p>
            </div>
          </section>

          {isHierarchical && (
            <aside className="flex min-h-0 flex-col rounded-2xl border border-border bg-background/30 p-3">
              <div className="mb-3 text-base font-semibold text-foreground">
                HIT {chunk.childHitCount} CHILD CHUNKS
              </div>
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                {chunk.childChunks.map((childChunk) => (
                  <div key={childChunk.id} className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-blue-600 px-1.5 py-[3px] text-[9px] font-semibold text-white">
                        {childChunk.label}
                      </span>
                      <span className="rounded bg-blue-600/85 px-1.5 py-[3px] text-[9px] font-semibold text-white">
                        SCORE {formatScore(childChunk.score)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words rounded bg-blue-500/20 px-2.5 py-1.5 text-[11px] text-foreground">
                      {childChunk.content}
                    </p>
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>
      </div>
    </OverlayDismissLayer>
  );
}
