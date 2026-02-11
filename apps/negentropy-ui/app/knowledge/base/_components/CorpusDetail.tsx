import { useMemo } from "react";
import { CorpusRecord } from "@/features/knowledge";

interface CorpusDetailProps {
  corpus: CorpusRecord | null;
}

export function CorpusDetail({ corpus }: CorpusDetailProps) {
  const config = useMemo(() => corpus?.config ?? {}, [corpus]);

  if (!corpus) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">数据源详情</h2>
        <p className="mt-3 text-xs text-zinc-500">请选择数据源</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">数据源详情</h2>
      <div className="mt-3 space-y-1.5 text-xs text-zinc-600">
        <p>
          <span className="text-zinc-400">Name</span>{" "}
          <span className="font-medium text-zinc-900">{corpus.name}</span>
        </p>
        <p>
          <span className="text-zinc-400">Description</span>{" "}
          {corpus.description || "-"}
        </p>
        <p>
          <span className="text-zinc-400">Knowledge Count</span>{" "}
          <span className="font-medium text-zinc-900">
            {corpus.knowledge_count}
          </span>
        </p>
        <div className="my-2 border-t border-zinc-100" />
        <p>
          <span className="text-zinc-400">Chunk Size</span>{" "}
          {config.chunk_size || 800}
        </p>
        <p>
          <span className="text-zinc-400">Overlap</span>{" "}
          {config.overlap || 100}
        </p>
        <p>
          <span className="text-zinc-400">Embedding</span>{" "}
          {config.embedding_model || "default"}
        </p>
      </div>
    </div>
  );
}
