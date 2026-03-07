import {
  buildCorpusConfig,
  buildExtractorRoutesFromDraft,
  createDefaultChunkingConfig,
  createEmptyExtractorDraftTarget,
  normalizeChunkingConfig,
  normalizeCorpusExtractorRoutes,
  normalizeExtractorDraftRoutes,
} from "@/features/knowledge/utils/knowledge-api";

export interface KnowledgeFeatureMockSet {
  searchKnowledgeMock: ReturnType<typeof vi.fn>;
  ingestTextMock: ReturnType<typeof vi.fn>;
  ingestUrlMock: ReturnType<typeof vi.fn>;
  replaceSourceMock: ReturnType<typeof vi.fn>;
  fetchKnowledgeItemsMock: ReturnType<typeof vi.fn>;
  createCorpusMock: ReturnType<typeof vi.fn>;
  deleteCorpusMock: ReturnType<typeof vi.fn>;
  fetchPipelinesMock: ReturnType<typeof vi.fn>;
  upsertPipelinesMock: ReturnType<typeof vi.fn>;
  fetchDocumentsMock: ReturnType<typeof vi.fn>;
  fetchDocumentChunksMock: ReturnType<typeof vi.fn>;
  searchAcrossCorporaMock: ReturnType<typeof vi.fn>;
  syncDocumentMock: ReturnType<typeof vi.fn>;
  rebuildDocumentMock: ReturnType<typeof vi.fn>;
  replaceDocumentMock: ReturnType<typeof vi.fn>;
  archiveDocumentMock: ReturnType<typeof vi.fn>;
  unarchiveDocumentMock: ReturnType<typeof vi.fn>;
  downloadDocumentMock: ReturnType<typeof vi.fn>;
  deleteDocumentMock: ReturnType<typeof vi.fn>;
}

export interface KnowledgeFeatureTestHarness {
  exports: Record<string, unknown>;
  mocks: KnowledgeFeatureMockSet;
}

export function createKnowledgeFeatureMockSet(): KnowledgeFeatureMockSet {
  return {
    searchKnowledgeMock: vi.fn(),
    ingestTextMock: vi.fn(),
    ingestUrlMock: vi.fn(),
    replaceSourceMock: vi.fn(),
    fetchKnowledgeItemsMock: vi.fn(),
    createCorpusMock: vi.fn(),
    deleteCorpusMock: vi.fn(),
    fetchPipelinesMock: vi.fn(),
    upsertPipelinesMock: vi.fn(),
    fetchDocumentsMock: vi.fn(),
    fetchDocumentChunksMock: vi.fn(),
    searchAcrossCorporaMock: vi.fn(),
    syncDocumentMock: vi.fn(),
    rebuildDocumentMock: vi.fn(),
    replaceDocumentMock: vi.fn(),
    archiveDocumentMock: vi.fn(),
    unarchiveDocumentMock: vi.fn(),
    downloadDocumentMock: vi.fn(),
    deleteDocumentMock: vi.fn(),
  };
}

export function createKnowledgeConfigTestExports() {
  return {
    createDefaultChunkingConfig,
    normalizeChunkingConfig,
    normalizeCorpusExtractorRoutes,
    createEmptyExtractorDraftTarget,
    normalizeExtractorDraftRoutes,
    buildExtractorRoutesFromDraft,
    buildCorpusConfig,
  };
}

export function createKnowledgeFeatureTestHarness(
  mocks: KnowledgeFeatureMockSet,
  overrides: Record<string, unknown> = {},
): KnowledgeFeatureTestHarness {
  return {
    mocks,
    exports: {
      searchKnowledge: (...args: unknown[]) => mocks.searchKnowledgeMock(...args),
      ingestText: (...args: unknown[]) => mocks.ingestTextMock(...args),
      ingestUrl: (...args: unknown[]) => mocks.ingestUrlMock(...args),
      replaceSource: (...args: unknown[]) => mocks.replaceSourceMock(...args),
      fetchKnowledgeItems: (...args: unknown[]) => mocks.fetchKnowledgeItemsMock(...args),
      createCorpus: (...args: unknown[]) => mocks.createCorpusMock(...args),
      deleteCorpus: (...args: unknown[]) => mocks.deleteCorpusMock(...args),
      fetchPipelines: (...args: unknown[]) => mocks.fetchPipelinesMock(...args),
      upsertPipelines: (...args: unknown[]) => mocks.upsertPipelinesMock(...args),
      fetchDocuments: (...args: unknown[]) => mocks.fetchDocumentsMock(...args),
      fetchDocumentChunks: (...args: unknown[]) => mocks.fetchDocumentChunksMock(...args),
      searchAcrossCorpora: (...args: unknown[]) => mocks.searchAcrossCorporaMock(...args),
      syncDocument: (...args: unknown[]) => mocks.syncDocumentMock(...args),
      rebuildDocument: (...args: unknown[]) => mocks.rebuildDocumentMock(...args),
      replaceDocument: (...args: unknown[]) => mocks.replaceDocumentMock(...args),
      archiveDocument: (...args: unknown[]) => mocks.archiveDocumentMock(...args),
      unarchiveDocument: (...args: unknown[]) => mocks.unarchiveDocumentMock(...args),
      downloadDocument: (...args: unknown[]) => mocks.downloadDocumentMock(...args),
      deleteDocument: (...args: unknown[]) => mocks.deleteDocumentMock(...args),
      ...createKnowledgeConfigTestExports(),
      ...overrides,
    },
  };
}
