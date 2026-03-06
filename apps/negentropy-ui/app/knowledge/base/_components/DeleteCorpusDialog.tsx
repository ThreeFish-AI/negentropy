"use client";

interface DeleteCorpusDialogProps {
  isOpen: boolean;
  corpusName: string | null;
  isDeleting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCorpusDialog({
  isOpen,
  corpusName,
  isDeleting = false,
  onClose,
  onConfirm,
}: DeleteCorpusDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-corpus-dialog-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 dark:bg-zinc-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="delete-corpus-dialog-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Delete Corpus
          </h2>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-zinc-400 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-zinc-300"
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

        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          确定删除 Corpus{" "}
          <span className="font-semibold break-all">
            「{corpusName || "-"}」
          </span>{" "}
          吗？此操作不可恢复。
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
