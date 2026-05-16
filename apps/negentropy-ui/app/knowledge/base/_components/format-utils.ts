import {
  normalizeChunkingConfig,
  type DocumentChunkItem,
  type KnowledgeMatch,
  type CorpusRecord,
} from "@/features/knowledge";
import type { RetrievedChunkViewModel } from "./retrieved-chunk-presenter";

export function formatCorpusConfigSummary(corpus: CorpusRecord): string {
  const config = normalizeChunkingConfig(
    (corpus.config ?? {}) as Record<string, unknown>,
  );

  if (config.strategy === "semantic") {
    return `strategy: semantic · threshold: ${config.semantic_threshold.toFixed(2)} · buffer: ${config.semantic_buffer_size}`;
  }

  if (config.strategy === "hierarchical") {
    return `strategy: hierarchical · parent: ${config.hierarchical_parent_chunk_size} · child: ${config.hierarchical_child_chunk_size}`;
  }

  return `strategy: ${config.strategy} · size: ${config.chunk_size} · overlap: ${config.overlap}`;
}

export function formatFileSize(size?: number | null): string {
  if (!size || size <= 0) return "--";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN");
}

export function formatChunkLabel(chunk: DocumentChunkItem): string {
  if (chunk.chunk_role === "parent") {
    const index = chunk.parent_chunk_index ?? chunk.chunk_index;
    return `Parent-${String(index).padStart(2, "0")}`;
  }
  return `Chunk-${String(chunk.chunk_index).padStart(2, "0")}`;
}

export function toDocumentChunkCardViewModel(chunk: DocumentChunkItem): RetrievedChunkViewModel {
  return {
    id: chunk.id,
    variant: chunk.child_chunks.length > 0 ? "hierarchical" : "standard",
    title: formatChunkLabel(chunk),
    characterCount: chunk.character_count,
    preview: chunk.content,
    fullContent: chunk.content,
    sourceLabel: chunk.source_uri || "-",
    sourceTitle: chunk.source_uri || "-",
    score: 0,
    childHitCount: chunk.child_chunks.length,
    childChunks: chunk.child_chunks
      .filter((child) => child.content.trim().length > 0)
      .map((child) => ({
        id: child.id,
        label: `C-${String(child.child_chunk_index ?? child.chunk_index).padStart(2, "0")}`,
        content: child.content,
        score: 0,
      })),
    raw: {
      id: chunk.id,
      content: chunk.content,
      source_uri: chunk.source_uri,
      combined_score: 0,
      metadata: chunk.metadata,
    } as KnowledgeMatch,
  };
}
