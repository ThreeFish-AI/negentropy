import {
  buildCorpusConfig,
  buildExtractorRoutesFromDraft,
  createDefaultChunkingConfig,
  createEmptyExtractorDraftTarget,
  normalizeChunkingConfig,
  normalizeCorpusExtractorRoutes,
  normalizeExtractorDraftRoutes,
} from "@/features/knowledge/utils/knowledge-api";

export interface KnowledgeApiMockSet {
  fetchCorpusMock: ReturnType<typeof vi.fn>;
  fetchCorporaMock: ReturnType<typeof vi.fn>;
  createCorpusMock: ReturnType<typeof vi.fn>;
  updateCorpusMock: ReturnType<typeof vi.fn>;
  deleteCorpusMock: ReturnType<typeof vi.fn>;
  ingestTextMock: ReturnType<typeof vi.fn>;
  ingestUrlMock: ReturnType<typeof vi.fn>;
  ingestFileMock: ReturnType<typeof vi.fn>;
  replaceSourceMock: ReturnType<typeof vi.fn>;
  syncSourceMock: ReturnType<typeof vi.fn>;
  rebuildSourceMock: ReturnType<typeof vi.fn>;
  deleteSourceMock: ReturnType<typeof vi.fn>;
  archiveSourceMock: ReturnType<typeof vi.fn>;
  searchKnowledgeMock: ReturnType<typeof vi.fn>;
}

export interface KnowledgeApiTestHarness {
  exports: Record<string, unknown>;
  mocks: KnowledgeApiMockSet;
}

export function createKnowledgeApiMockSet(): KnowledgeApiMockSet {
  return {
    fetchCorpusMock: vi.fn(),
    fetchCorporaMock: vi.fn(),
    createCorpusMock: vi.fn(),
    updateCorpusMock: vi.fn(),
    deleteCorpusMock: vi.fn(),
    ingestTextMock: vi.fn(),
    ingestUrlMock: vi.fn(),
    ingestFileMock: vi.fn(),
    replaceSourceMock: vi.fn(),
    syncSourceMock: vi.fn(),
    rebuildSourceMock: vi.fn(),
    deleteSourceMock: vi.fn(),
    archiveSourceMock: vi.fn(),
    searchKnowledgeMock: vi.fn(),
  };
}

export function createKnowledgeApiConfigTestExports() {
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

export function createKnowledgeApiTestHarness(
  mocks: KnowledgeApiMockSet,
  overrides: Record<string, unknown> = {},
): KnowledgeApiTestHarness {
  return {
    mocks,
    exports: {
      fetchCorpus: (...args: unknown[]) => mocks.fetchCorpusMock(...args),
      fetchCorpora: (...args: unknown[]) => mocks.fetchCorporaMock(...args),
      createCorpus: (...args: unknown[]) => mocks.createCorpusMock(...args),
      updateCorpus: (...args: unknown[]) => mocks.updateCorpusMock(...args),
      deleteCorpus: (...args: unknown[]) => mocks.deleteCorpusMock(...args),
      ingestText: (...args: unknown[]) => mocks.ingestTextMock(...args),
      ingestUrl: (...args: unknown[]) => mocks.ingestUrlMock(...args),
      ingestFile: (...args: unknown[]) => mocks.ingestFileMock(...args),
      replaceSource: (...args: unknown[]) => mocks.replaceSourceMock(...args),
      syncSource: (...args: unknown[]) => mocks.syncSourceMock(...args),
      rebuildSource: (...args: unknown[]) => mocks.rebuildSourceMock(...args),
      deleteSource: (...args: unknown[]) => mocks.deleteSourceMock(...args),
      archiveSource: (...args: unknown[]) => mocks.archiveSourceMock(...args),
      searchKnowledge: (...args: unknown[]) => mocks.searchKnowledgeMock(...args),
      ...createKnowledgeApiConfigTestExports(),
      ...overrides,
    },
  };
}
