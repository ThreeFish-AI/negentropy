"use client";

import { useId } from "react";
import { FileText, Grip, X } from "lucide-react";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import { cn } from "@/lib/utils";
import type { RetrievedChunkViewModel } from "./retrieved-chunk-presenter";

/**
 * 编辑能力以可选对象注入：存在即进入「编辑态」(Document Chunks)，
 * 省略即「只读态」(Retrieve 结果)。把「是否可编辑」聚成单一内聚开关，
 * 避免一堆并列可选 props 制造的隐式真值源。
 */
export interface ChunkDetailEditable {
  draftContent: string;
  draftEnabled: boolean;
  onDraftContentChange: (value: string) => void;
  onDraftEnabledChange: (value: boolean) => void;
  onSave: () => void;
  onRegenerate: () => void;
  pending: boolean;
}

interface ChunkDetailDialogProps {
  chunk: RetrievedChunkViewModel | null;
  onClose: () => void;
  /** 省略 = 只读 Retrieve 模式；提供 = 编辑模式（Document Chunks）。 */
  editable?: ChunkDetailEditable;
}

function formatScore(score: number): string {
  return score.toFixed(2);
}

/**
 * Chunk 详情弹窗 —— 单组件双模式。
 *
 * 以 Retrieve「Chunk Detail」双栏布局为统一基线：左栏正文 + 元信息，
 * hierarchical 时右栏只读子块侧栏。编辑态在同一骨架内将正文换为可编辑
 * textarea，并补出 Enabled 开关与 Cancel / Save & Regenerate / Save 操作区，
 * 子块侧栏保持只读作为编辑上下文。
 */
export function ChunkDetailDialog({ chunk, onClose, editable }: ChunkDetailDialogProps) {
  const titleId = useId();

  if (!chunk) return null;

  const isEditable = editable != null;
  const isHierarchical = chunk.variant === "hierarchical";
  // 文档 chunk 无检索分（score 恒为 0），编辑态隐藏 SCORE 徽标避免「SCORE 0.00」误导。
  const showScore = !isEditable;

  return (
    <OverlayDismissLayer
      open={chunk !== null}
      onClose={onClose}
      busy={editable?.pending ?? false}
      containerClassName="flex min-h-full items-center justify-center p-4"
      contentClassName="flex h-[82vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl"
      backdropTestId={isEditable ? "edit-chunk-dialog-backdrop" : "retrieved-chunk-dialog-backdrop"}
      contentProps={{
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": titleId,
      }}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-4">
        <h2 id={titleId} className="text-2xl font-semibold text-foreground">
          {isEditable ? "Edit Chunk" : "Chunk Detail"}
        </h2>
        <button
          type="button"
          aria-label={isEditable ? "Close edit chunk" : "Close chunk detail"}
          onClick={onClose}
          disabled={editable?.pending ?? false}
          className="rounded-full border border-border p-1.5 text-text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <div
          className={cn(
            "grid min-h-0 flex-1 gap-4",
            isHierarchical
              ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]"
              : "grid-cols-1",
          )}
        >
          <section className={cn("min-h-0 rounded-2xl bg-card px-1", isEditable && "flex flex-col")}>
            <div className="mb-3 flex flex-wrap items-center gap-2.5 text-caption font-medium text-text-muted">
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
              <div className="text-caption text-text-muted">
                {chunk.characterCount} characters
              </div>
              {showScore && (
                <span className="rounded bg-blue-600 px-1.5 py-[3px] text-micro font-semibold text-white">
                  SCORE {formatScore(chunk.score)}
                </span>
              )}
              {isEditable && (
                <button
                  type="button"
                  aria-pressed={editable.draftEnabled}
                  onClick={() => editable.onDraftEnabledChange(!editable.draftEnabled)}
                  disabled={editable.pending}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium disabled:opacity-60",
                    editable.draftEnabled
                      ? "bg-emerald-500 text-white"
                      : "bg-foreground text-background",
                  )}
                >
                  {editable.draftEnabled ? "Enabled" : "Disabled"}
                </button>
              )}
            </div>
            {isEditable ? (
              <textarea
                value={editable.draftContent}
                onChange={(event) => editable.onDraftContentChange(event.target.value)}
                disabled={editable.pending}
                className="min-h-0 flex-1 resize-none rounded-2xl border border-border bg-background p-4 text-sm outline-none disabled:opacity-60"
              />
            ) : (
              <div className="h-[calc(100%-3.5rem)] overflow-y-auto pr-2">
                <p className="whitespace-pre-wrap text-[13px] leading-7 text-foreground">
                  {chunk.fullContent}
                </p>
              </div>
            )}
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
                      <span className="rounded bg-blue-600 px-1.5 py-[3px] text-micro font-semibold text-white">
                        {childChunk.label}
                      </span>
                      {showScore && (
                        <span className="rounded bg-blue-600/85 px-1.5 py-[3px] text-micro font-semibold text-white">
                          SCORE {formatScore(childChunk.score)}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap break-words rounded bg-blue-500/20 px-2.5 py-1.5 text-caption text-foreground">
                      {childChunk.content}
                    </p>
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>

        {isEditable && (
          <div className="mt-4 flex shrink-0 items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={editable.pending}
              className={outlineButtonClassName("neutral", "rounded-xl px-4 py-2 text-sm")}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={editable.pending}
              onClick={editable.onRegenerate}
              className={outlineButtonClassName("neutral", "rounded-xl px-4 py-2 text-sm")}
            >
              Save & Regenerate Child Chunks
            </button>
            <button
              type="button"
              disabled={editable.pending}
              onClick={editable.onSave}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </OverlayDismissLayer>
  );
}
