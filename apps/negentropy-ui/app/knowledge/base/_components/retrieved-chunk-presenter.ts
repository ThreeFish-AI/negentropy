"use client";

import type { KnowledgeMatch } from "@/features/knowledge";

export interface RetrievedChildChunkViewModel {
  id: string;
  label: string;
  content: string;
  score: number;
}

export interface RetrievedChunkViewModel {
  id: string;
  variant: "hierarchical" | "standard";
  title: string;
  characterCount: number;
  preview: string;
  fullContent: string;
  sourceLabel: string;
  sourceTitle: string;
  score: number;
  childHitCount: number;
  childChunks: RetrievedChildChunkViewModel[];
  raw: KnowledgeMatch;
}

interface RetrievedChunkMetadata extends Record<string, unknown> {
  returned_parent_chunk?: boolean;
  parent_chunk_index?: number | string;
  chunk_index?: number | string;
  original_filename?: string;
  matched_child_chunk_indices?: unknown[];
  matched_child_chunks?: Array<{
    id?: string;
    child_chunk_index?: number | string | null;
    content?: string;
    combined_score?: number;
  }>;
}

function toChunkNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toRetrievedChunkMetadata(
  metadata: KnowledgeMatch["metadata"],
): RetrievedChunkMetadata {
  return (metadata || {}) as RetrievedChunkMetadata;
}

function formatChunkNumber(value: number | null | undefined): string {
  const normalized = toChunkNumber(value);
  if (normalized === null) {
    return "?";
  }
  return String(normalized).padStart(2, "0");
}

function basenameFromUri(sourceUri?: string): string | null {
  if (!sourceUri) return null;
  const normalized = sourceUri.split("?")[0]?.split("#")[0] || sourceUri;
  const parts = normalized.split("/").filter(Boolean);
  return parts.at(-1) || sourceUri;
}

function resolveSourceLabel(match: KnowledgeMatch, metadata: RetrievedChunkMetadata) {
  const explicit = typeof metadata.original_filename === "string"
    ? metadata.original_filename.trim()
    : "";
  if (explicit) {
    return {
      label: explicit,
      title: explicit,
    };
  }

  const fallback = basenameFromUri(match.source_uri);
  if (fallback) {
    return {
      label: fallback,
      title: match.source_uri || fallback,
    };
  }

  return {
    label: match.source_uri || "-",
    title: match.source_uri || "-",
  };
}

export function buildRetrievedChunkViewModel(
  match: KnowledgeMatch,
): RetrievedChunkViewModel {
  const metadata = toRetrievedChunkMetadata(match.metadata);
  const variant = metadata.returned_parent_chunk ? "hierarchical" : "standard";
  const indexValue =
    variant === "hierarchical"
      ? metadata.parent_chunk_index
      : metadata.chunk_index;
  const source = resolveSourceLabel(match, metadata);
  const childChunks = Array.isArray(metadata.matched_child_chunks)
    ? metadata.matched_child_chunks
        .map((item, index) => ({
          id: item.id || `${match.id}-child-${index}`,
          label: `C-${formatChunkNumber(item.child_chunk_index ?? undefined)}`,
          content: item.content || "",
          score: toChunkNumber(item.combined_score) ?? 0,
        }))
        .filter((item) => item.content.trim().length > 0)
    : [];
  const childHitCount = childChunks.length > 0
    ? childChunks.length
    : Array.isArray(metadata.matched_child_chunk_indices)
      ? metadata.matched_child_chunk_indices.length
      : 0;

  return {
    id: String(match.id),
    variant,
    title:
      variant === "hierarchical"
        ? `Parent-Chunk-${formatChunkNumber(indexValue)}`
        : `Chunk-${formatChunkNumber(indexValue)}`,
    characterCount: match.content.length,
    preview: match.content,
    fullContent: match.content,
    sourceLabel: source.label,
    sourceTitle: source.title,
    score: match.combined_score ?? 0,
    childHitCount,
    childChunks,
    raw: match,
  };
}
