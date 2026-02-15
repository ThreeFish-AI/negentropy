"use client";

import { useState } from "react";
import { IngestResult } from "@/features/knowledge";

interface AddSourceDialogProps {
  isOpen: boolean;
  corpusId: string | null;
  onClose: () => void;
  onIngest: (params: { text: string; source_uri?: string }) => Promise<IngestResult>;
  onIngestUrl: (params: { url: string }) => Promise<IngestResult>;
  onSuccess?: () => void;
}

export function AddSourceDialog({
  isOpen,
  corpusId,
  onClose,
  onIngest,
  onIngestUrl,
  onSuccess,
}: AddSourceDialogProps) {
  const [mode, setMode] = useState<"text" | "url">("text");
  const [sourceUri, setSourceUri] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleIngest = async () => {
    if (!corpusId || isSubmitting) return;

    if (mode === "text" && !text.trim()) return;
    if (mode === "url" && !url.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      if (mode === "text") {
        await onIngest({
          text,
          source_uri: sourceUri || undefined,
        });
      } else {
        await onIngestUrl({ url });
      }
      // Reset form
      setSourceUri("");
      setText("");
      setUrl("");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSourceUri("");
    setText("");
    setUrl("");
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 dark:bg-zinc-900">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Add Source
          </h2>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="mb-4 flex gap-4 text-xs">
          <button
            onClick={() => setMode("text")}
            className={`pb-1 font-medium ${
              mode === "text"
                ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            Raw Text
          </button>
          <button
            onClick={() => setMode("url")}
            className={`pb-1 font-medium ${
              mode === "url"
                ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            From URL
          </button>
        </div>

        {/* Content */}
        {mode === "text" ? (
          <>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Source URI (optional)
              </label>
              <input
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
                placeholder="e.g., document.pdf"
                value={sourceUri}
                onChange={(e) => setSourceUri(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
                rows={6}
                placeholder="Paste knowledge text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              URL <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleIngest}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            disabled={
              isSubmitting ||
              !corpusId ||
              (mode === "text" && !text.trim()) ||
              (mode === "url" && !url.trim())
            }
          >
            {isSubmitting ? "Processing..." : "Ingest"}
          </button>
        </div>
      </div>
    </div>
  );
}
