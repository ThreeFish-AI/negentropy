"use client";

import type { DocumentChunksMetadata } from "@/features/knowledge";
import { formatFileSize, formatDateTime } from "./format-utils";

function DocumentMetadataPanel({
  metadata,
}: {
  metadata: DocumentChunksMetadata;
}) {
  const stats: Array<[string, string | number]> = [
    ["Chunks specification", metadata.chunk_specification ?? "--"],
    ["Chunks length", metadata.chunk_length ?? "--"],
    ["Avg. paragraph length", metadata.avg_paragraph_length ?? "--"],
    ["Paragraphs", metadata.paragraph_count ?? "--"],
    ["Retrieval count", metadata.retrieval_count ?? 0],
    ["Embedding time", metadata.embedding_time_ms ? `${metadata.embedding_time_ms} ms` : "--"],
    ["Embedded spend", metadata.embedded_tokens ? `${metadata.embedded_tokens} tokens` : "--"],
  ];
  const docInfo: Array<[string, string | number]> = [
    ["Original filename", metadata.original_filename ?? "--"],
    ["Original file size", formatFileSize(metadata.file_size)],
    ["Upload date", formatDateTime(metadata.upload_date)],
    ["Last update date", formatDateTime(metadata.last_update_date)],
    ["Source", metadata.source ?? "--"],
  ];
  const renderFieldGroup = (title: string, items: Array<[string, string | number]>) => (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">{title}</h4>
      <dl className="mt-3 space-y-2.5">
        {items.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] items-start gap-x-4 gap-y-1">
            <dt className="break-words text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              {label}
            </dt>
            <dd className="break-words text-sm font-medium leading-6 text-foreground">
              {String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    <section className="h-full rounded-2xl border border-border bg-card p-5">
      <h3 className="text-base font-semibold">Document Metadata</h3>
      <p className="mt-2 text-sm text-muted">
        Metadata serves as a critical filter that enhances the accuracy and relevance of information retrieval.
      </p>
      <div className="mt-6 space-y-6">
        {renderFieldGroup("Document Information", docInfo)}
        {renderFieldGroup("Technical Parameters", stats)}
      </div>
    </section>
  );
}

export { DocumentMetadataPanel };
