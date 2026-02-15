/**
 * API 执行器
 *
 * 根据 endpoint.id 映射到对应的 API 函数
 */

import { ApiEndpoint } from "@/features/knowledge/utils/api-specs";
import {
  searchKnowledge,
  ingestText,
  ingestUrl,
  replaceSource,
  fetchKnowledgeItems,
  createCorpus,
  deleteCorpus,
} from "@/features/knowledge";

const APP_NAME = process.env.NEXT_PUBLIC_AGUI_APP_NAME || "agents";

type ExecutorResult = Promise<unknown>;

interface ExecutorContext {
  corpusId?: string;
  params: Record<string, unknown>;
}

type ExecutorFn = (context: ExecutorContext) => ExecutorResult;

const API_EXECUTORS: Record<string, ExecutorFn> = {
  search: async ({ corpusId, params }) => {
    if (!corpusId) throw new Error("corpus_id is required");
    return searchKnowledge(corpusId, {
      app_name: APP_NAME,
      query: params.query as string,
      mode: params.mode as "semantic" | "keyword" | "hybrid",
      limit: params.limit as number | undefined,
      semantic_weight: params.semantic_weight as number | undefined,
      keyword_weight: params.keyword_weight as number | undefined,
      metadata_filter: params.metadata_filter as Record<string, unknown> | undefined,
    });
  },

  ingest: async ({ corpusId, params }) => {
    if (!corpusId) throw new Error("corpus_id is required");
    return ingestText(corpusId, {
      app_name: APP_NAME,
      text: params.text as string,
      source_uri: params.source_uri as string | undefined,
      metadata: params.metadata as Record<string, unknown> | undefined,
      chunk_size: params.chunk_size as number | undefined,
      overlap: params.overlap as number | undefined,
      preserve_newlines: params.preserve_newlines as boolean | undefined,
    });
  },

  ingest_url: async ({ corpusId, params }) => {
    if (!corpusId) throw new Error("corpus_id is required");
    return ingestUrl(corpusId, {
      app_name: APP_NAME,
      url: params.url as string,
      metadata: params.metadata as Record<string, unknown> | undefined,
      chunk_size: params.chunk_size as number | undefined,
      overlap: params.overlap as number | undefined,
    });
  },

  replace_source: async ({ corpusId, params }) => {
    if (!corpusId) throw new Error("corpus_id is required");
    return replaceSource(corpusId, {
      app_name: APP_NAME,
      text: params.text as string,
      source_uri: params.source_uri as string,
      metadata: params.metadata as Record<string, unknown> | undefined,
      chunk_size: params.chunk_size as number | undefined,
      overlap: params.overlap as number | undefined,
    });
  },

  list_knowledge: async ({ corpusId, params }) => {
    if (!corpusId) throw new Error("corpus_id is required");
    return fetchKnowledgeItems(corpusId, {
      appName: APP_NAME,
      limit: params.limit as number | undefined,
      offset: params.offset as number | undefined,
    });
  },

  create_corpus: async ({ params }) => {
    return createCorpus({
      app_name: APP_NAME,
      name: params.name as string,
      description: params.description as string | undefined,
      config: params.chunk_size || params.overlap
        ? {
            chunk_size: params.chunk_size as number | undefined,
            overlap: params.overlap as number | undefined,
          }
        : undefined,
    });
  },

  delete_corpus: async ({ corpusId }) => {
    if (!corpusId) throw new Error("corpus_id is required");
    await deleteCorpus(corpusId);
    return { success: true, message: "语料库已删除" };
  },
};

/**
 * 执行 API 调用
 *
 * @param endpoint API 端点配置
 * @param values 表单值
 * @returns API 响应
 */
export async function executeApiCall(
  endpoint: ApiEndpoint,
  values: Record<string, unknown>,
): ExecutorResult {
  const executor = API_EXECUTORS[endpoint.id];

  if (!executor) {
    throw new Error(`不支持的 API 端点: ${endpoint.id}`);
  }

  // 提取 corpus_id（如果存在）
  const { corpus_id, ...restParams } = values;

  return executor({
    corpusId: corpus_id as string | undefined,
    params: restParams,
  });
}
