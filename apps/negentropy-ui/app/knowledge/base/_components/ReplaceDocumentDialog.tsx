"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { defaultRemarkPlugins, defaultRehypePlugins } from "@/utils/markdown-plugins";
import { KnowledgeDocument, fetchDocumentDetail } from "@/features/knowledge";
import { OverlayDismissLayer } from "@/components/ui/OverlayDismissLayer";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "negentropy";

interface ReplaceDocumentDialogProps {
  isOpen: boolean;
  corpusId: string | null;
  document: KnowledgeDocument | null;
  onClose: () => void;
  onSubmit: (payload: { text: string }) => Promise<void>;
}

export function ReplaceDocumentDialog({
  isOpen,
  corpusId,
  document,
  onClose,
  onSubmit,
}: ReplaceDocumentDialogProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestAppName = document?.app_name || APP_NAME;

  useEffect(() => {
    let active = true;

    const loadDocumentMarkdown = async () => {
      if (!isOpen || !corpusId || !document) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const detail = await fetchDocumentDetail(corpusId, document.id, {
          appName: requestAppName,
        });
        if (!active) return;
        setText(detail.markdown_content || "");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "加载文档失败");
        setText("");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDocumentMarkdown();

    return () => {
      active = false;
    };
  }, [isOpen, corpusId, document, requestAppName]);

  const sourceType = useMemo(
    () => String(document?.metadata?.source_type || "file"),
    [document],
  );

  const handleClose = () => {
    if (submitting) return;
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!text.trim()) {
      setError("替换内容不能为空");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ text });
    } catch (err) {
      setError(err instanceof Error ? err.message : "替换失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !document) return null;

  return (
    <OverlayDismissLayer
      open={isOpen && document !== null}
      onClose={handleClose}
      busy={submitting}
      containerClassName="flex min-h-full items-center justify-center p-4"
      contentClassName="flex h-[86vh] w-full max-w-6xl flex-col rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
    >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Replace Document
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {document.original_filename} · {sourceType}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            disabled={submitting}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300">
          将使用下方内容替换该文档对应 source 的 chunks，并触发重建索引。
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="flex min-h-0 flex-col rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">Markdown Editor</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="h-full min-h-0 w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs outline-none focus:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-400"
              placeholder={loading ? "Loading markdown..." : "请输入用于替换的新 Markdown 内容"}
              disabled={loading || submitting}
            />
          </section>

          <section className="flex min-h-0 flex-col rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">Markdown Preview</div>
            <div className="h-full min-h-0 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-950">
              {text.trim() ? (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-pre:text-xs prose-code:text-xs">
                  <ReactMarkdown remarkPlugins={defaultRemarkPlugins} rehypePlugins={defaultRehypePlugins}>{text}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-zinc-500 dark:text-zinc-400">暂无可预览内容</p>
              )}
            </div>
          </section>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            disabled={submitting || loading || !text.trim()}
          >
            {submitting ? "Replacing..." : "Replace"}
          </button>
        </div>
    </OverlayDismissLayer>
  );
}
