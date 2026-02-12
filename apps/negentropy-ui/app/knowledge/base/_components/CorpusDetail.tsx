import { useMemo } from "react";
import { CorpusRecord } from "@/features/knowledge";

interface CorpusDetailProps {
  corpus: CorpusRecord | null;
}

export function CorpusDetail({ corpus }: CorpusDetailProps) {
  const config = useMemo(() => corpus?.config ?? {}, [corpus]);

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
            {String(config.strategy || "recursive")}
          </span>
        </p>
        <p>
          <span className="text-muted/70">Chunk Size</span>{" "}
          {config.chunk_size || 800}
        </p>
        <p>
          <span className="text-muted/70">Overlap</span> {config.overlap || 100}
        </p>
        <p>
          <span className="text-muted/70">Embedding</span>{" "}
          {config.embedding_model || "default"}
        </p>
      </div>
    </div>
  );
}
