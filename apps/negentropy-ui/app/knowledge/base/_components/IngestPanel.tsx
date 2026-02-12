import { useEffect, useState } from "react";
import { IngestResult } from "@/features/knowledge";

interface IngestPanelProps {
  corpusId: string | null;
  onIngest: (params: {
    text: string;
    source_uri?: string;
  }) => Promise<IngestResult>;
  onIngestUrl: (params: { url: string }) => Promise<IngestResult>;
  onReplace: (params: {
    text: string;
    source_uri: string;
  }) => Promise<IngestResult>;
}

export function IngestPanel({
  corpusId,
  onIngest,
  onIngestUrl,
  onReplace,
}: IngestPanelProps) {
  const [mode, setMode] = useState<"text" | "url">("text");
  const [sourceUri, setSourceUri] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!successMsg) return;
    const timer = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(timer);
  }, [successMsg]);

  const handleIngest = async () => {
    if (!corpusId || isSubmitting) return;

    if (mode === "text" && !text.trim()) return;
    if (mode === "url" && !url.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      let result: IngestResult;
      if (mode === "text") {
        result = await onIngest({
          text,
          source_uri: sourceUri || undefined,
        });
      } else {
        result = await onIngestUrl({ url });
      }
      setSuccessMsg(`已摄入 ${result.count ?? 0} 个分块`);
      // Clear inputs on success
      if (mode === "text") setText("");
      if (mode === "url") setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplace = async () => {
    if (!corpusId || !sourceUri || !text.trim() || isSubmitting) return;
    const confirmed = window.confirm(
      `即将替换 source_uri "${sourceUri}" 下的全部内容，是否继续？`,
    );
    if (!confirmed) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await onReplace({ text, source_uri: sourceUri });
      setSuccessMsg(`已替换，共 ${result.count ?? 0} 个分块`);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-card-foreground">
        Ingest / Replace
      </h2>
      <div>
        {/* Mode Switcher */}
        <div className="mt-3 flex gap-4 text-xs">
          <button
            onClick={() => setMode("text")}
            className={`pb-1 font-medium ${
              mode === "text"
                ? "border-b-2 border-primary text-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            Raw Text
          </button>
          <button
            onClick={() => setMode("url")}
            className={`pb-1 font-medium ${
              mode === "url"
                ? "border-b-2 border-primary text-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            From URL
          </button>
        </div>

        {mode === "text" ? (
          <>
            <input
              className="mt-3 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder-muted"
              placeholder="source_uri (optional)"
              value={sourceUri}
              onChange={(e) => setSourceUri(e.target.value)}
            />
            <textarea
              className="mt-2 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder-muted"
              rows={4}
              placeholder="Paste knowledge text"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </>
        ) : (
          <input
            className="mt-3 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder-muted"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
            disabled={
              isSubmitting ||
              !corpusId ||
              (mode === "text" && !text.trim()) ||
              (mode === "url" && !url.trim())
            }
            onClick={handleIngest}
          >
            {isSubmitting ? "处理中…" : "Ingest"}
          </button>
          {mode === "text" && (
            <button
              className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
              disabled={isSubmitting || !corpusId || !sourceUri || !text.trim()}
              onClick={handleReplace}
            >
              {isSubmitting ? "处理中…" : "Replace Source"}
            </button>
          )}
        </div>
        {successMsg && (
          <div className="mt-3 rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success">
            {successMsg}
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-lg border border-error/50 bg-error/10 p-3 text-xs text-error">
            {error.message}
          </div>
        )}
      </div>
    </div>
  );
}
