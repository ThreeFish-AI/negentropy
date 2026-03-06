import { useMemo } from "react";
import { CorpusRecord, normalizeChunkingConfig } from "@/features/knowledge";

interface CorpusDetailProps {
  corpus: CorpusRecord | null;
}

export function CorpusDetail({ corpus }: CorpusDetailProps) {
  const config = useMemo(
    () => normalizeChunkingConfig((corpus?.config ?? {}) as Record<string, unknown>),
    [corpus],
  );

  if (!corpus) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-card-foreground">
          数据源详情
        </h2>
        <p className="mt-3 text-xs text-muted">请选择数据源</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-card-foreground">数据源详情</h2>
      <div className="mt-3 space-y-1.5 text-xs text-muted">
        <p>
          <span className="text-muted/70">Name</span>{" "}
          <span className="font-medium text-foreground">{corpus.name}</span>
        </p>
        <p>
          <span className="text-muted/70">Description</span>{" "}
          {corpus.description || "-"}
        </p>
        <p>
          <span className="text-muted/70">Knowledge Count</span>{" "}
          <span className="font-medium text-foreground">
            {corpus.knowledge_count}
          </span>
        </p>
        <div className="my-2 border-t border-border" />
        <p>
          <span className="text-muted/70">Strategy</span>{" "}
          <span className="capitalize">
            {config.strategy}
          </span>
        </p>
        {config.strategy === "fixed" && (
          <>
            <p>
              <span className="text-muted/70">Chunk Size</span> {config.chunk_size}
            </p>
            <p>
              <span className="text-muted/70">Overlap</span> {config.overlap}
            </p>
          </>
        )}
        {config.strategy === "recursive" && (
          <>
            <p>
              <span className="text-muted/70">Chunk Size</span> {config.chunk_size}
            </p>
            <p>
              <span className="text-muted/70">Overlap</span> {config.overlap}
            </p>
          </>
        )}
        {config.strategy === "semantic" && (
          <>
            <p>
              <span className="text-muted/70">Threshold</span> {config.semantic_threshold}
            </p>
            <p>
              <span className="text-muted/70">Buffer Size</span> {config.semantic_buffer_size}
            </p>
          </>
        )}
        {config.strategy === "hierarchical" && (
          <>
            <p>
              <span className="text-muted/70">Parent Size</span> {config.hierarchical_parent_chunk_size}
            </p>
            <p>
              <span className="text-muted/70">Child Size</span> {config.hierarchical_child_chunk_size}
            </p>
          </>
        )}
        <p>
          <span className="text-muted/70">Embedding</span>{" "}
          {(corpus?.config?.embedding_model as string | undefined) || "default"}
        </p>
      </div>
    </div>
  );
}
