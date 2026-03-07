import type { KnowledgeFeatureMockSet } from "@/tests/helpers/knowledge";

const knowledgeMocks = vi.hoisted(() => ({}) as KnowledgeFeatureMockSet);

vi.mock("@/features/knowledge", async () => {
  const { createKnowledgeFeatureMockSet, createKnowledgeFeatureTestHarness } = await import(
    "@/tests/helpers/knowledge"
  );
  Object.assign(knowledgeMocks, createKnowledgeFeatureMockSet());
  return createKnowledgeFeatureTestHarness(knowledgeMocks).exports;
});

import { executeApiCall } from "@/app/knowledge/apis/_components/utils/ApiExecutor";
import { KNOWLEDGE_API_ENDPOINTS } from "@/features/knowledge/utils/api-specs";

const getEndpoint = (id: string) => {
  const endpoint = KNOWLEDGE_API_ENDPOINTS.find((item) => item.id === id);
  expect(endpoint).toBeDefined();
  return endpoint!;
};

describe("ApiExecutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    knowledgeMocks.ingestTextMock.mockResolvedValue({ ok: true });
    knowledgeMocks.ingestUrlMock.mockResolvedValue({ ok: true });
    knowledgeMocks.replaceSourceMock.mockResolvedValue({ ok: true });
    knowledgeMocks.createCorpusMock.mockResolvedValue({ ok: true });
  });

  it("ingest 通过 chunking_config 透传 canonical 配置", async () => {
    await executeApiCall(getEndpoint("ingest"), {
      corpus_id: "corpus-1",
      text: "hello",
      chunking_config: {
        strategy: "semantic",
        semantic_threshold: 0.9,
        semantic_buffer_size: 2,
        min_chunk_size: 100,
        max_chunk_size: 1200,
      },
    });

    expect(knowledgeMocks.ingestTextMock).toHaveBeenCalledWith("corpus-1", {
      app_name: "negentropy",
      text: "hello",
      source_uri: undefined,
      metadata: undefined,
      chunking_config: {
        strategy: "semantic",
        semantic_threshold: 0.9,
        semantic_buffer_size: 2,
        min_chunk_size: 100,
        max_chunk_size: 1200,
      },
    });
  });

  it("ingest_url 和 replace_source 使用 chunking_config 而不是旧扁平字段", async () => {
    const chunkingConfig = {
      strategy: "hierarchical",
      preserve_newlines: true,
      separators: ["\n\n", "\n"],
      hierarchical_parent_chunk_size: 1024,
      hierarchical_child_chunk_size: 256,
      hierarchical_child_overlap: 51,
    };

    await executeApiCall(getEndpoint("ingest_url"), {
      corpus_id: "corpus-1",
      url: "https://example.com",
      chunking_config: chunkingConfig,
    });
    await executeApiCall(getEndpoint("replace_source"), {
      corpus_id: "corpus-1",
      text: "updated",
      source_uri: "docs://example/doc1",
      chunking_config: chunkingConfig,
    });

    expect(knowledgeMocks.ingestUrlMock).toHaveBeenCalledWith("corpus-1", {
      app_name: "negentropy",
      url: "https://example.com",
      metadata: undefined,
      chunking_config: chunkingConfig,
    });
    expect(knowledgeMocks.replaceSourceMock).toHaveBeenCalledWith("corpus-1", {
      app_name: "negentropy",
      text: "updated",
      source_uri: "docs://example/doc1",
      metadata: undefined,
      chunking_config: chunkingConfig,
    });
  });

  it("create_corpus 直接透传 canonical config 对象", async () => {
    await executeApiCall(getEndpoint("create_corpus"), {
      name: "产品文档",
      description: "desc",
      config: {
        strategy: "recursive",
        chunk_size: 800,
        overlap: 100,
        preserve_newlines: true,
        separators: ["\n\n", "\n"],
      },
    });

    expect(knowledgeMocks.createCorpusMock).toHaveBeenCalledWith({
      app_name: "negentropy",
      name: "产品文档",
      description: "desc",
      config: {
        strategy: "recursive",
        chunk_size: 800,
        overlap: 100,
        preserve_newlines: true,
        separators: ["\n\n", "\n"],
      },
    });
  });
});
