import { vi, type Mock } from "vitest";
import {
  buildCorpusConfig,
  buildExtractorRoutesFromDraft,
  createDefaultChunkingConfig,
  createEmptyExtractorDraftTarget,
  normalizeChunkingConfig,
  normalizeCorpusExtractorRoutes,
  normalizeExtractorDraftRoutes,
} from "@/features/knowledge/utils/knowledge-api";

type VitestMock = Mock<(...args: unknown[]) => unknown>;

export interface KnowledgeFeatureMockSet {
  searchKnowledgeMock: VitestMock;
  ingestTextMock: VitestMock;
  ingestUrlMock: VitestMock;
  replaceSourceMock: VitestMock;
  fetchKnowledgeItemsMock: VitestMock;
  createCorpusMock: VitestMock;
  deleteCorpusMock: VitestMock;
  fetchPipelinesMock: VitestMock;
  upsertPipelinesMock: VitestMock;
  fetchDocumentsMock: VitestMock;
  fetchDocumentChunksMock: VitestMock;
  searchAcrossCorporaMock: VitestMock;
  syncDocumentMock: VitestMock;
  rebuildDocumentMock: VitestMock;
  replaceDocumentMock: VitestMock;
  archiveDocumentMock: VitestMock;
  unarchiveDocumentMock: VitestMock;
  downloadDocumentMock: VitestMock;
  deleteDocumentMock: VitestMock;
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
