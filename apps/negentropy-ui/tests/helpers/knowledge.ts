import { vi, type Mock } from "vitest";
import {
  buildCorpusConfig,
  buildExtractorRoutesFromDraft,
  createDefaultChunkingConfig,
  createEmptyExtractorDraftTarget,
  encodeSeparatorsForDisplay,
  decodeSeparatorsFromInput,
  normalizeChunkingConfig,
  normalizeCorpusExtractorRoutes,
  normalizeExtractorDraftRoutes,
  separatorsArrayEqual,
} from "@/features/knowledge/utils/knowledge-api";
import { SeparatorsTextarea } from "@/features/knowledge/components/SeparatorsTextarea";
import {
  buildPipelineErrorDetails,
  calculateStageWidth,
  getFailureCategoryLabel,
  formatDuration,
  getFailedStages,
  getPipelineStatusColor,
  getSortedStages,
  getStageColor,
  getStageErrorMessage,
  getStageErrorSummary,
  OPERATION_LABELS,
  STAGE_LABELS,
} from "@/features/knowledge/utils/pipeline-helpers";
import { PipelineRunCard, PipelineRunList } from "@/features/knowledge/components/PipelineRunCard";
import { PipelineRunDetailPanel } from "@/features/knowledge/components/PipelineRunDetailPanel";
import { PipelineStatusBadge } from "@/features/knowledge/components/PipelineStatusBadge";
import { PipelineStagesBar } from "@/features/knowledge/components/PipelineStagesBar";

type VitestMock = Mock<(...args: unknown[]) => unknown>;

export interface KnowledgeFeatureMockSet {
  fetchDashboardMock: VitestMock;
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
  fetchDocumentChunkDetailMock: VitestMock;
  updateDocumentChunkMock: VitestMock;
  regenerateDocumentChunkFamilyMock: VitestMock;
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
    fetchDashboardMock: vi.fn(),
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
    fetchDocumentChunkDetailMock: vi.fn(),
    updateDocumentChunkMock: vi.fn(),
    regenerateDocumentChunkFamilyMock: vi.fn(),
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

export function resetKnowledgeFeatureMocks(mocks: KnowledgeFeatureMockSet): void {
  Object.values(mocks).forEach((mock) => {
    mock.mockReset();
  });
}

export function primeKnowledgeFeatureMocks(
  mocks: KnowledgeFeatureMockSet,
  overrides: Partial<
    Pick<
      KnowledgeFeatureMockSet,
      "ingestTextMock" | "ingestUrlMock" | "replaceSourceMock" | "createCorpusMock"
    >
  > = {},
): void {
  const stableSuccessMocks = {
    ingestTextMock: mocks.ingestTextMock,
    ingestUrlMock: mocks.ingestUrlMock,
    replaceSourceMock: mocks.replaceSourceMock,
    createCorpusMock: mocks.createCorpusMock,
    ...overrides,
  };

  Object.values(stableSuccessMocks).forEach((mock) => {
    mock.mockResolvedValue({ ok: true });
  });
}

export function createKnowledgeConfigTestExports() {
  return {
    createDefaultChunkingConfig,
    encodeSeparatorsForDisplay,
    decodeSeparatorsFromInput,
    separatorsArrayEqual,
    normalizeChunkingConfig,
    normalizeCorpusExtractorRoutes,
    createEmptyExtractorDraftTarget,
    normalizeExtractorDraftRoutes,
    buildExtractorRoutesFromDraft,
    buildCorpusConfig,
    SeparatorsTextarea,
    OPERATION_LABELS,
    STAGE_LABELS,
    getPipelineStatusColor,
    getStageColor,
    getFailureCategoryLabel,
    getStageErrorMessage,
    getStageErrorSummary,
    getFailedStages,
    buildPipelineErrorDetails,
    formatDuration,
    calculateStageWidth,
    getSortedStages,
    PipelineRunCard,
    PipelineRunList,
    PipelineRunDetailPanel,
    PipelineStatusBadge,
    PipelineStagesBar,
  };
}

export function createKnowledgeFeatureTestHarness(
  mocks: KnowledgeFeatureMockSet,
  overrides: Record<string, unknown> = {},
): KnowledgeFeatureTestHarness {
  return {
    mocks,
    exports: {
      fetchDashboard: (...args: unknown[]) => mocks.fetchDashboardMock(...args),
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
      fetchDocumentChunkDetail: (...args: unknown[]) => mocks.fetchDocumentChunkDetailMock(...args),
      updateDocumentChunk: (...args: unknown[]) => mocks.updateDocumentChunkMock(...args),
      regenerateDocumentChunkFamily: (...args: unknown[]) =>
        mocks.regenerateDocumentChunkFamilyMock(...args),
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
