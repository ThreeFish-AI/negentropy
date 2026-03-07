import { vi, type Mock } from "vitest";

type VitestMock = Mock<(...args: unknown[]) => unknown>;
export interface KnowledgeApiMockSet {
  fetchCorpusMock: VitestMock;
  fetchCorporaMock: VitestMock;
  createCorpusMock: VitestMock;
  updateCorpusMock: VitestMock;
  deleteCorpusMock: VitestMock;
  ingestTextMock: VitestMock;
  ingestUrlMock: VitestMock;
  ingestFileMock: VitestMock;
  replaceSourceMock: VitestMock;
  syncSourceMock: VitestMock;
  rebuildSourceMock: VitestMock;
  deleteSourceMock: VitestMock;
  archiveSourceMock: VitestMock;
  searchKnowledgeMock: VitestMock;
}

export interface KnowledgeApiTestHarness {
  exports: Record<string, unknown>;
  mocks: KnowledgeApiMockSet;
}

export async function importKnowledgeApiActual(): Promise<
  typeof import("@/features/knowledge/utils/knowledge-api")
> {
  return vi.importActual<typeof import("@/features/knowledge/utils/knowledge-api")>(
    "@/features/knowledge/utils/knowledge-api",
  );
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

export async function createKnowledgeApiConfigTestExports() {
  const actual = await importKnowledgeApiActual();
  return {
    createDefaultChunkingConfig: actual.createDefaultChunkingConfig,
    normalizeChunkingConfig: actual.normalizeChunkingConfig,
    normalizeCorpusExtractorRoutes: actual.normalizeCorpusExtractorRoutes,
    createEmptyExtractorDraftTarget: actual.createEmptyExtractorDraftTarget,
    normalizeExtractorDraftRoutes: actual.normalizeExtractorDraftRoutes,
    buildExtractorRoutesFromDraft: actual.buildExtractorRoutesFromDraft,
    buildCorpusConfig: actual.buildCorpusConfig,
  };
}

export async function createKnowledgeApiTestHarness(
  mocks: KnowledgeApiMockSet,
  overrides: Record<string, unknown> = {},
): Promise<KnowledgeApiTestHarness> {
  const configExports = await createKnowledgeApiConfigTestExports();
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
      ...configExports,
      ...overrides,
    },
  };
}
