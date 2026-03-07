import { vi, type Mock } from "vitest";

type VitestMock = Mock<(...args: unknown[]) => unknown>;
type FetchMock = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>;

export interface KnowledgeBasePageLocalMocks {
  replaceMock: VitestMock;
  useKnowledgeBaseMock: VitestMock;
  loadCorpusMock: VitestMock;
  loadCorporaMock: VitestMock;
  updateCorpusMock: VitestMock;
  deleteCorpusMock: VitestMock;
  deleteDocumentMock: VitestMock;
  ingestUrlMock: VitestMock;
  ingestFileMock: VitestMock;
  fetchDocumentsMock: VitestMock;
  fetchDocumentChunksMock: VitestMock;
  searchAcrossCorporaMock: VitestMock;
  documentViewDialogMock: VitestMock;
  fetchMock: FetchMock;
  syncDocumentMock: VitestMock;
  rebuildDocumentMock: VitestMock;
  replaceDocumentFeatureMock: VitestMock;
  archiveDocumentMock: VitestMock;
  unarchiveDocumentMock: VitestMock;
  downloadDocumentMock: VitestMock;
  searchParamsState: {
    value: string;
  };
}

export interface KnowledgeBaseHookState {
  corpora: Array<{
    id: string;
    name: string;
    app_name: string;
    knowledge_count: number;
    config: Record<string, unknown>;
  }>;
  isLoading: boolean;
  loadCorpora: (...args: unknown[]) => unknown;
  loadCorpus: (...args: unknown[]) => unknown;
  createCorpus: (...args: unknown[]) => unknown;
  updateCorpus: (...args: unknown[]) => unknown;
  deleteCorpus: (...args: unknown[]) => unknown;
  ingestUrl: (...args: unknown[]) => unknown;
  ingestFile: (...args: unknown[]) => unknown;
}

const DEFAULT_SEARCH_PARAMS =
  "view=corpus&corpusId=11111111-1111-1111-1111-111111111111&tab=documents";

export function resetKnowledgeBasePageLocalMocks(
  mocks: KnowledgeBasePageLocalMocks,
): void {
  mocks.replaceMock.mockReset();
  mocks.useKnowledgeBaseMock.mockReset();
  mocks.loadCorpusMock.mockReset();
  mocks.loadCorporaMock.mockReset();
  mocks.updateCorpusMock.mockReset();
  mocks.deleteCorpusMock.mockReset();
  mocks.deleteDocumentMock.mockReset();
  mocks.ingestUrlMock.mockReset();
  mocks.ingestFileMock.mockReset();
  mocks.fetchDocumentsMock.mockReset();
  mocks.fetchDocumentChunksMock.mockReset();
  mocks.searchAcrossCorporaMock.mockReset();
  mocks.documentViewDialogMock.mockReset();
  mocks.fetchMock.mockReset();
  mocks.syncDocumentMock.mockReset();
  mocks.rebuildDocumentMock.mockReset();
  mocks.replaceDocumentFeatureMock.mockReset();
  mocks.archiveDocumentMock.mockReset();
  mocks.unarchiveDocumentMock.mockReset();
  mocks.downloadDocumentMock.mockReset();
}

export function primeKnowledgeBasePageLocalMocks(
  mocks: KnowledgeBasePageLocalMocks,
): void {
  mocks.searchParamsState.value = DEFAULT_SEARCH_PARAMS;
  global.fetch = mocks.fetchMock as unknown as typeof fetch;

  mocks.loadCorpusMock.mockResolvedValue(undefined);
  mocks.loadCorporaMock.mockResolvedValue(undefined);
  mocks.updateCorpusMock.mockResolvedValue({
    id: "11111111-1111-1111-1111-111111111111",
    name: "Corpus Alpha",
    app_name: "negentropy",
    knowledge_count: 3,
    config: {},
  });
  mocks.deleteCorpusMock.mockResolvedValue(undefined);
  mocks.deleteDocumentMock.mockResolvedValue(undefined);
  mocks.ingestUrlMock.mockResolvedValue({});
  mocks.ingestFileMock.mockResolvedValue({});
  mocks.fetchDocumentsMock.mockResolvedValue({
    items: [
      {
        id: "doc-1",
        corpus_id: "11111111-1111-1111-1111-111111111111",
        original_filename: "Context Engineering.pdf",
        content_type: "application/pdf",
        status: "active",
        file_size: 2371045,
        metadata: { source_type: "file" },
        markdown_extract_status: "completed",
      },
    ],
  });
  mocks.fetchDocumentChunksMock.mockResolvedValue({ items: [] });
  mocks.searchAcrossCorporaMock.mockResolvedValue({
    items: [
      {
        id: "chunk-1",
        content: "retrieved chunk content",
        source_uri: "https://example.com/doc",
        combined_score: 0.91,
        metadata: {
          corpus_id: "11111111-1111-1111-1111-111111111111",
          chunk_index: 47,
          original_filename: "2512.13564v1.pdf",
        },
      },
    ],
  });

  mocks.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/plugins/mcp/servers") {
      return {
        ok: true,
        json: async () => [
          {
            id: "server-1",
            name: "doc-extractor",
            display_name: "Doc Extractor",
            is_enabled: true,
          },
        ],
      } as Response;
    }

    if (url === "/api/plugins/mcp/servers/server-1/tools") {
      return {
        ok: true,
        json: async () => [
          {
            name: "extract_markdown",
            display_name: "Extract Markdown",
            is_enabled: true,
          },
        ],
      } as Response;
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ detail: "not found" }),
    } as Response;
  });
}

export function buildKnowledgeBaseHookState(
  mocks: KnowledgeBasePageLocalMocks,
  overrides: Partial<KnowledgeBaseHookState> = {},
): KnowledgeBaseHookState {
  return {
    corpora: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Corpus Alpha",
        app_name: "negentropy",
        knowledge_count: 3,
        config: {},
      },
    ],
    isLoading: false,
    loadCorpora: mocks.loadCorporaMock,
    loadCorpus: mocks.loadCorpusMock,
    createCorpus: vi.fn(),
    updateCorpus: mocks.updateCorpusMock,
    deleteCorpus: mocks.deleteCorpusMock,
    ingestUrl: mocks.ingestUrlMock,
    ingestFile: mocks.ingestFileMock,
    ...overrides,
  };
}
