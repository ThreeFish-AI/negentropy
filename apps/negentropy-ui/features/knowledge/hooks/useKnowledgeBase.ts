/**
 * 知识库管理 Hook
 *
 * 提供知识库 CRUD 操作的封装
 * 遵循 AGENTS.md 原则：单一职责、状态下沉、复用驱动
 *
 * 参考文献:
 * [1] E. Gamma, R. Helm, R. Johnson, and J. Vlissides, "Design Patterns: Elements of Reusable Object-Oriented Software,"
 *     Addison-Wesley Professional, 1994.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CorpusRecord,
  IngestResult,
  SearchResults,
  ChunkingConfig,
  SearchConfig,
  fetchCorpus,
  fetchCorpora,
  createCorpus,
  updateCorpus,
  deleteCorpus,
  ingestText,
  replaceSource,
  searchKnowledge,
  KnowledgeError,
} from "../utils/knowledge-api";

// ============================================================================
// Types
// ============================================================================

/**
 * useKnowledgeBase Hook 参数
 */
export interface UseKnowledgeBaseOptions {
  /** 应用名称 */
  appName?: string;
  /** 语料库 ID */
  corpusId?: string;
  /** 错误回调 */
  onError?: (error: KnowledgeError) => void;
  /** 成功回调 - 用于摄取操作 */
  onIngestSuccess?: (result: IngestResult) => void;
  /** 成功回调 - 用于搜索操作 */
  onSearchSuccess?: (results: SearchResults) => void;
}

/**
 * useKnowledgeBase Hook 返回值
 */
export interface UseKnowledgeBaseReturnValue {
  /** 当前语料库 */
  corpus: CorpusRecord | null;
  /** 所有语料库列表 */
  corpora: CorpusRecord[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 加载语料库 */
  loadCorpus: (id: string) => Promise<void>;
  /** 加载所有语料库 */
  loadCorpora: () => Promise<void>;
  /** 创建语料库 */
  createCorpus: (params: {
    name: string;
    description?: string;
    config?: Record<string, unknown>;
  }) => Promise<CorpusRecord>;
  /** 更新语料库 */
  updateCorpus: (
    id: string,
    params: {
      name?: string;
      description?: string;
      config?: Record<string, unknown>;
    },
  ) => Promise<CorpusRecord>;
  /** 删除语料库 */
  deleteCorpus: (id: string) => Promise<void>;
  /** 摄取文本 */
  ingestText: (params: {
    text: string;
    source_uri?: string;
    metadata?: Record<string, unknown>;
    chunkingConfig?: ChunkingConfig;
  }) => Promise<IngestResult>;
  /** 替换源文本 */
  replaceSource: (params: {
    text: string;
    source_uri: string;
    metadata?: Record<string, unknown>;
    chunkingConfig?: ChunkingConfig;
  }) => Promise<IngestResult>;
  /** 搜索知识库 */
  search: (query: string, config?: SearchConfig) => Promise<SearchResults>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

const DEFAULT_LOADING_STATE = {
  isLoading: false,
  error: null as Error | null,
};

/**
 * 知识库管理 Hook
 *
 * 提供知识库的 CRUD 操作和搜索功能
 *
 * @param options - Hook 配置选项
 * @returns Hook 返回值
 *
 * @example
 * ```ts
 * const { corpus, ingestText, search, isLoading } = useKnowledgeBase({
 *   appName: "my-app",
 *   corpusId: "corpus-123",
 *   onError: (error) => console.error(error),
 * });
 *
 * // 摄取文本
 * await ingestText({ text: "Hello world", source_uri: "doc://1" });
 *
 * // 搜索
 * const results = await search("query", { mode: "hybrid", limit: 10 });
 * ```
 */
export function useKnowledgeBase(
  options: UseKnowledgeBaseOptions = {},
): UseKnowledgeBaseReturnValue {
  const {
    appName,
    corpusId: initialCorpusId,
    onError,
    onIngestSuccess,
    onSearchSuccess,
  } = options;

  // 状态管理
  const [corpus, setCorpus] = useState<CorpusRecord | null>(null);
  const [corpora, setCorpora] = useState<CorpusRecord[]>([]);
  const [state, setState] = useState(DEFAULT_LOADING_STATE);

  // 加载语料库
  const loadCorpus = useCallback(
    async (id: string) => {
      setState({ isLoading: true, error: null });
      try {
        const result = await fetchCorpus(id, appName);
        setCorpus(result);
        setState({ isLoading: false, error: null });
      } catch (error) {
        const err = error as Error;
        setState({ isLoading: false, error: err });
        onError?.(err as KnowledgeError);
      }
    },
    [appName, onError],
  );

  // 加载所有语料库
  const loadCorpora = useCallback(async () => {
    setState({ isLoading: true, error: null });
    try {
      const result = await fetchCorpora(appName);
      setCorpora(result);
      setState({ isLoading: false, error: null });
    } catch (error) {
      const err = error as Error;
      setState({ isLoading: false, error: err });
      onError?.(err as KnowledgeError);
    }
  }, [appName, onError]);

  // 创建语料库
  const createCorpusHandler = useCallback(
    async (params: {
      name: string;
      description?: string;
      config?: Record<string, unknown>;
    }) => {
      setState({ isLoading: true, error: null });
      try {
        const result = await createCorpus({
          app_name: appName,
          ...params,
        });
        setCorpora((prev) => [result, ...prev]);
        setState({ isLoading: false, error: null });
        return result;
      } catch (error) {
        const err = error as Error;
        setState({ isLoading: false, error: err });
        onError?.(err as KnowledgeError);
        throw err;
      }
    },
    [appName, onError],
  );

  // 更新语料库
  const updateCorpusHandler = useCallback(
    async (
      id: string,
      params: {
        name?: string;
        description?: string;
        config?: Record<string, unknown>;
      },
    ) => {
      setState({ isLoading: true, error: null });
      try {
        const result = await updateCorpus(id, params);
        setCorpora((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...result } : c)),
        );
        if (corpus?.id === id) {
          setCorpus((prev) => (prev ? { ...prev, ...result } : result));
        }
        setState({ isLoading: false, error: null });
        return result;
      } catch (error) {
        const err = error as Error;
        setState({ isLoading: false, error: err });
        onError?.(err as KnowledgeError);
        throw err;
      }
    },
    [corpus?.id, onError],
  );

  // 删除语料库
  const deleteCorpusHandler = useCallback(
    async (id: string) => {
      setState({ isLoading: true, error: null });
      try {
        await deleteCorpus(id);
        setCorpora((prev) => prev.filter((c) => c.id !== id));
        if (corpus?.id === id) {
          setCorpus(null);
        }
        setState({ isLoading: false, error: null });
      } catch (error) {
        const err = error as Error;
        setState({ isLoading: false, error: err });
        onError?.(err as KnowledgeError);
        throw err;
      }
    },
    [corpus?.id, onError],
  );

  // 摄取文本
  const ingestTextHandler = useCallback(
    async (params: {
      text: string;
      source_uri?: string;
      metadata?: Record<string, unknown>;
      chunkingConfig?: ChunkingConfig;
    }) => {
      if (!corpus?.id) {
        throw new Error("No corpus selected");
      }

      setState({ isLoading: true, error: null });
      try {
        const result = await ingestText(corpus.id, {
          app_name: appName,
          text: params.text,
          source_uri: params.source_uri,
          metadata: params.metadata,
          chunk_size: params.chunkingConfig?.chunk_size,
          overlap: params.chunkingConfig?.overlap,
          preserve_newlines: params.chunkingConfig?.preserve_newlines,
        });
        setState({ isLoading: false, error: null });
        onIngestSuccess?.(result);
        return result;
      } catch (error) {
        const err = error as Error;
        setState({ isLoading: false, error: err });
        onError?.(err as KnowledgeError);
        throw err;
      }
    },
    [corpus?.id, appName, onError, onIngestSuccess],
  );

  // 替换源文本
  const replaceSourceHandler = useCallback(
    async (params: {
      text: string;
      source_uri: string;
      metadata?: Record<string, unknown>;
      chunkingConfig?: ChunkingConfig;
    }) => {
      if (!corpus?.id) {
        throw new Error("No corpus selected");
      }

      setState({ isLoading: true, error: null });
      try {
        const result = await replaceSource(corpus.id, {
          app_name: appName,
          text: params.text,
          source_uri: params.source_uri,
          metadata: params.metadata,
          chunk_size: params.chunkingConfig?.chunk_size,
          overlap: params.chunkingConfig?.overlap,
          preserve_newlines: params.chunkingConfig?.preserve_newlines,
        });
        setState({ isLoading: false, error: null });
        return result;
      } catch (error) {
        const err = error as Error;
        setState({ isLoading: false, error: err });
        onError?.(err as KnowledgeError);
        throw err;
      }
    },
    [corpus?.id, appName, onError],
  );

  // 搜索知识库
  const searchHandler = useCallback(
    async (query: string, config?: SearchConfig) => {
      if (!corpus?.id) {
        throw new Error("No corpus selected");
      }

      setState({ isLoading: true, error: null });
      try {
        const result = await searchKnowledge(corpus.id, {
          app_name: appName,
          query,
          mode: config?.mode,
          limit: config?.limit,
          semantic_weight: config?.semantic_weight,
          keyword_weight: config?.keyword_weight,
          metadata_filter: config?.metadata_filter,
        });
        setState({ isLoading: false, error: null });
        onSearchSuccess?.(result);
        return result;
      } catch (error) {
        const err = error as Error;
        setState({ isLoading: false, error: err });
        onError?.(err as KnowledgeError);
        throw err;
      }
    },
    [corpus?.id, appName, onError, onSearchSuccess],
  );

  // 初始化：如果有 corpusId，加载语料库
  useEffect(() => {
    if (initialCorpusId) {
      loadCorpus(initialCorpusId);
    }
  }, [initialCorpusId, loadCorpus]);

  return {
    corpus,
    corpora,
    isLoading: state.isLoading,
    error: state.error,
    loadCorpus,
    loadCorpora,
    createCorpus: createCorpusHandler,
    updateCorpus: updateCorpusHandler,
    deleteCorpus: deleteCorpusHandler,
    ingestText: ingestTextHandler,
    replaceSource: replaceSourceHandler,
    search: searchHandler,
  };
}
