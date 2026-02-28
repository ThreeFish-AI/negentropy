"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AsyncPipelineResult } from "@/features/knowledge";

interface ReplaceSourceDialogProps {
  isOpen: boolean;
  corpusId: string | null;
  sourceUri: string | null;
  onClose: () => void;
  onReplace: (params: { text: string; source_uri: string }) => Promise<AsyncPipelineResult>;
  onSuccess?: () => void;
}

export function ReplaceSourceDialog({
  isOpen,
  corpusId,
  sourceUri,
  onClose,
  onReplace,
  onSuccess,
}: ReplaceSourceDialogProps) {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReplace = async () => {
    if (!corpusId || !sourceUri || !text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onReplace({ text, source_uri: sourceUri });
      toast.success("已开始替换知识源", {
        description: "可在 Pipeline 页面查看构建进度",
      });
      setText("");
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      toast.error("替换失败", {
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setText("");
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
            Replace Source
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

        {/* Warning Message */}
        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          <div className="flex items-start gap-2">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="font-medium">This will replace all content under:</p>
              <p className="mt-1 break-all font-mono text-amber-600 dark:text-amber-300">
                {sourceUri}
              </p>
            </div>
          </div>
        </div>

        {/* Content Input */}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            New Content <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
            rows={8}
            placeholder="Paste new content to replace the existing one..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

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
            onClick={handleReplace}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
            disabled={isSubmitting || !corpusId || !sourceUri || !text.trim()}
          >
            {isSubmitting ? "Processing..." : "Replace"}
          </button>
        </div>
      </div>
    </div>
  );
}
