/**
 * 知识检索：单 Corpus 检索与跨 Corpus 聚合检索
 */
import {
  handleKnowledgeError,
  InvalidSearchConfigError,
  KnowledgeError,
} from "./errors";

export type SearchMode = "semantic" | "keyword" | "hybrid";
export interface SearchConfig {
  mode?: SearchMode;
  limit?: number;
  semantic_weight?: number;
  keyword_weight?: number;
  metadata_filter?: Record<string, unknown>;
}
export interface KnowledgeMatch {
  id: string;
  content: string;
  source_uri?: string;
  metadata?: Record<string, unknown>;
  semantic_score?: number;
  keyword_score?: number;
  combined_score: number;
}
export interface SearchResultError {
  corpusId: string;
  /**
   * 后端返回的结构化错误码（如 `EMBEDDING_FAILED`）；
   * 仅当 rejection 为 `KnowledgeError` 时存在，便于调用方按 code 走差异化分支。
   */
  code?: string;
  message: string;
}

export interface SearchResults {
  count: number;
  items: KnowledgeMatch[];
  errors?: SearchResultError[];
}
export async function searchKnowledge(
  id: string,
  params: {
    app_name?: string;
    query: string;
    mode?: SearchMode;
    limit?: number;
    semantic_weight?: number;
    keyword_weight?: number;
    metadata_filter?: Record<string, unknown>;
  },
): Promise<SearchResults> {
  // 前端配置验证（对齐后端 types.py）
  const { limit, semantic_weight, keyword_weight, mode } = params;

  if (limit !== undefined && (limit < 1 || limit > 1000)) {
    throw new InvalidSearchConfigError({ limit, min: 1, max: 1000 });
  }

  if (
    semantic_weight !== undefined &&
    (semantic_weight < 0 || semantic_weight > 1)
  ) {
    throw new InvalidSearchConfigError({ semantic_weight, min: 0, max: 1 });
  }

  if (
    keyword_weight !== undefined &&
    (keyword_weight < 0 || keyword_weight > 1)
  ) {
    throw new InvalidSearchConfigError({ keyword_weight, min: 0, max: 1 });
  }

  if (mode !== undefined && !["semantic", "keyword", "hybrid"].includes(mode)) {
    throw new InvalidSearchConfigError({
      mode,
      allowed: ["semantic", "keyword", "hybrid"],
    });
  }

  const res = await fetch(`/api/knowledge/base/${id}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleKnowledgeError(res);
}

export async function searchAcrossCorpora(
  corpusIds: string[],
  params: {
    app_name?: string;
    query: string;
    mode?: SearchMode;
    limit?: number;
    semantic_weight?: number;
    keyword_weight?: number;
    metadata_filter?: Record<string, unknown>;
  },
): Promise<SearchResults> {
  const settled = await Promise.allSettled(
    corpusIds.map((corpusId) =>
      searchKnowledge(corpusId, params).then((results) =>
        results.items.map((item) => ({
          ...item,
          metadata: {
            ...(item.metadata || {}),
            corpus_id: corpusId,
          },
        })),
      ),
    ),
  );

  const mergedItems: KnowledgeMatch[] = [];
  const errors: SearchResultError[] = [];
  settled.forEach((item, idx) => {
    if (item.status === "fulfilled") {
      mergedItems.push(...item.value);
    } else {
      const corpusId = corpusIds[idx];
      const reason = item.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unknown error";
      const code =
        reason instanceof KnowledgeError ? reason.code : undefined;
      errors.push(code ? { corpusId, code, message } : { corpusId, message });
    }
  });

  // 全部失败 → 抛聚合 KnowledgeError（保留 code 与逐条 errors，
  // 让调用方既能按上游 vs 自身错误分流，又能拿到完整失败明细）。
  if (errors.length === corpusIds.length && corpusIds.length > 0) {
    const merged = errors
      .map((e) => `[${e.corpusId.slice(0, 8)}] ${e.message}`)
      .join("; ");
    const codes = errors
      .map((e) => e.code)
      .filter((c): c is string => Boolean(c));
    const allSameCode =
      codes.length === errors.length && codes.every((c) => c === codes[0]);
    const aggregatedCode =
      allSameCode && codes.length > 0 ? codes[0] : "AGGREGATED_SEARCH_ERRORS";
    throw new KnowledgeError(aggregatedCode, merged.slice(0, 200), {
      errors,
    });
  }

  mergedItems.sort((a, b) => (b.combined_score ?? 0) - (a.combined_score ?? 0));

  return {
    count: mergedItems.length,
    items: params.limit ? mergedItems.slice(0, params.limit) : mergedItems,
    ...(errors.length > 0 ? { errors } : {}),
  };
}
