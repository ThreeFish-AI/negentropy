"use client";

import { useId } from "react";
import { X } from "lucide-react";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";
import { outlineButtonClassName } from "@/components/ui/button-styles";
import type { DocumentChunkItem } from "@/features/knowledge";

interface EditChunkDialogProps {
  chunk: DocumentChunkItem | null;
  draftContent: string;
  draftEnabled: boolean;
  onDraftContentChange: (value: string) => void;
  onDraftEnabledChange: (value: boolean) => void;
  onClose: () => void;
  onSave: () => void;
  onRegenerate: () => void;
  pending: boolean;
}

export function EditChunkDialog({
  chunk,
  draftContent,
  draftEnabled,
  onDraftContentChange,
  onDraftEnabledChange,
  onClose,
  onSave,
  onRegenerate,
  pending,
}: EditChunkDialogProps) {
  const titleId = useId();

  if (!chunk) return null;

  return (
    <OverlayDismissLayer
      open={chunk !== null}
      onClose={onClose}
      busy={pending}
      containerClassName="flex min-h-full items-center justify-center p-4"
      contentClassName="flex h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl"
      backdropTestId="edit-chunk-dialog-backdrop"
      contentProps={{
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": titleId,
      }}
    >
      <div className="flex items-start justify-between gap-4 px-5 py-5">
        <div>
          <h2 id={titleId} className="text-3xl font-semibold text-foreground">
            Edit Chunk
          </h2>
          <p className="mt-1 text-sm text-muted">
            {chunk.chunk_role === "parent" ? "Parent" : "Chunk"}-
            {String(chunk.chunk_index).padStart(2, "0")} ·{" "}
            {chunk.character_count} characters
          </p>
        </div>
        <button
          type="button"
          aria-label="Close edit chunk"
          onClick={onClose}
          disabled={pending}
          className="rounded-full border border-border p-2 text-zinc-400 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
        <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
          <span className="text-sm text-muted">Enabled</span>
          <button
            type="button"
            aria-pressed={draftEnabled}
            onClick={() => onDraftEnabledChange(!draftEnabled)}
            disabled={pending}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              draftEnabled
                ? "bg-emerald-500 text-white"
                : "bg-zinc-700 text-zinc-200"
            }`}
          >
            {draftEnabled ? "Enabled" : "Disabled"}
          </button>
        </div>

        <textarea
          value={draftContent}
          onChange={(event) => onDraftContentChange(event.target.value)}
          disabled={pending}
          className="min-h-0 flex-1 resize-none rounded-2xl border border-border bg-background p-4 text-sm outline-none disabled:opacity-60"
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={outlineButtonClassName("neutral", "rounded-xl px-4 py-2 text-sm")}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onRegenerate}
            className={outlineButtonClassName("neutral", "rounded-xl px-4 py-2 text-sm")}
          >
            Save & Regenerate Child Chunks
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onSave}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </div>
    </OverlayDismissLayer>
  );
}
