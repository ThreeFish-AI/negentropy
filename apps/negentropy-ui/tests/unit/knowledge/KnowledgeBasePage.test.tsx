import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { KnowledgeFeatureMockSet } from "@/tests/helpers/knowledge";
import { resetKnowledgeFeatureMocks } from "@/tests/helpers/knowledge";
import {
  buildKnowledgeBaseHookState,
  createKnowledgeBaseCorpus,
  createKnowledgeBaseDocument,
  createKnowledgeBaseDocumentChunk,
  createKnowledgeBaseExtractorRoutes,
  createKnowledgeBaseHierarchicalSearchResult,
  expectKnowledgeBaseSelectedMcpOptions,
  expectKnowledgeBaseUnavailableMcpOptions,
  knowledgeBasePageMcpOptionFixtures,
  knowledgeBasePageMcpSelectionFixtures,
  createKnowledgeBaseSearchResult,
  knowledgeBasePageExtractorRouteFixtures,
  knowledgeBasePageSearchParams,
  primeKnowledgeBasePageLocalMocks,
  resetKnowledgeBasePageLocalMocks,
  type KnowledgeBasePageLocalMocks,
} from "@/tests/helpers/knowledge-base-page";

const {
  replaceMock,
  useKnowledgeBaseMock,
  deleteCorpusMock,
  deleteDocumentMock,
  ingestUrlMock,
  ingestFileMock,
  searchParamsState,
  fetchDocumentsMock,
  fetchDocumentChunksMock,
  fetchDocumentChunkDetailMock,
  updateDocumentChunkMock,
  regenerateDocumentChunkFamilyMock,
  searchAcrossCorporaMock,
  documentViewDialogMock,
  fetchMock,
  syncDocumentMock,
  rebuildDocumentMock,
  replaceDocumentFeatureMock,
  archiveDocumentMock,
  unarchiveDocumentMock,
  downloadDocumentMock,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  useKnowledgeBaseMock: vi.fn(),
  deleteCorpusMock: vi.fn(),
  deleteDocumentMock: vi.fn(),
  ingestUrlMock: vi.fn(),
  ingestFileMock: vi.fn(),
  fetchDocumentsMock: vi.fn(),
  fetchDocumentChunksMock: vi.fn(),
  fetchDocumentChunkDetailMock: vi.fn(),
  updateDocumentChunkMock: vi.fn(),
  regenerateDocumentChunkFamilyMock: vi.fn(),
  searchAcrossCorporaMock: vi.fn(),
  documentViewDialogMock: vi.fn(),
  fetchMock: vi.fn(),
  syncDocumentMock: vi.fn(),
  rebuildDocumentMock: vi.fn(),
  replaceDocumentFeatureMock: vi.fn(),
  archiveDocumentMock: vi.fn(),
  unarchiveDocumentMock: vi.fn(),
  downloadDocumentMock: vi.fn(),
  searchParamsState: {
    value: "view=corpus&corpusId=11111111-1111-1111-1111-111111111111&tab=documents",
  },
}));

const knowledgeMocks = vi.hoisted(() => ({}) as KnowledgeFeatureMockSet);
const loadCorpusMock = vi.fn();
const loadCorporaMock = vi.fn();
const updateCorpusMock = vi.fn();
const localMocks: KnowledgeBasePageLocalMocks = {
  replaceMock,
  useKnowledgeBaseMock,
  loadCorpusMock,
  loadCorporaMock,
  updateCorpusMock,
  deleteCorpusMock,
  deleteDocumentMock,
  ingestUrlMock,
  ingestFileMock,
  fetchDocumentsMock,
  fetchDocumentChunksMock,
  fetchDocumentChunkDetailMock,
  updateDocumentChunkMock,
  regenerateDocumentChunkFamilyMock,
  searchAcrossCorporaMock,
  documentViewDialogMock,
  fetchMock,
  syncDocumentMock,
  rebuildDocumentMock,
  replaceDocumentFeatureMock,
  archiveDocumentMock,
  unarchiveDocumentMock,
  downloadDocumentMock,
  searchParamsState,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/knowledge/base",
  useSearchParams: () => new URLSearchParams(searchParamsState.value),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/KnowledgeNav", () => ({
  KnowledgeNav: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("@/app/knowledge/base/_components/CorpusFormDialog", () => ({
  CorpusFormDialog: () => null,
}));

vi.mock("@/app/knowledge/base/_components/ReplaceDocumentDialog", () => ({
  ReplaceDocumentDialog: () => null,
}));

vi.mock("@/features/knowledge", async () => {
  const { createKnowledgeFeatureMockSet, createKnowledgeFeatureTestHarness } = await import(
    "@/tests/helpers/knowledge"
  );
  Object.assign(knowledgeMocks, createKnowledgeFeatureMockSet());
  knowledgeMocks.ingestUrlMock = ingestUrlMock;
  knowledgeMocks.deleteCorpusMock = deleteCorpusMock;
  knowledgeMocks.fetchDocumentsMock = fetchDocumentsMock;
  knowledgeMocks.fetchDocumentChunksMock = fetchDocumentChunksMock;
  knowledgeMocks.fetchDocumentChunkDetailMock = fetchDocumentChunkDetailMock;
  knowledgeMocks.updateDocumentChunkMock = updateDocumentChunkMock;
  knowledgeMocks.regenerateDocumentChunkFamilyMock = regenerateDocumentChunkFamilyMock;
  knowledgeMocks.searchAcrossCorporaMock = searchAcrossCorporaMock;
  knowledgeMocks.syncDocumentMock = syncDocumentMock;
  knowledgeMocks.rebuildDocumentMock = rebuildDocumentMock;
  knowledgeMocks.replaceDocumentMock = replaceDocumentFeatureMock;
  knowledgeMocks.archiveDocumentMock = archiveDocumentMock;
  knowledgeMocks.unarchiveDocumentMock = unarchiveDocumentMock;
  knowledgeMocks.downloadDocumentMock = downloadDocumentMock;
  knowledgeMocks.deleteDocumentMock = deleteDocumentMock;

  return createKnowledgeFeatureTestHarness(knowledgeMocks, {
      useKnowledgeBase: (...args: unknown[]) => useKnowledgeBaseMock(...args),
      DocumentViewDialog: ({
        isOpen,
        document,
      }: {
        isOpen: boolean;
        document: { original_filename: string } | null;
      }) => {
        documentViewDialogMock({ isOpen, document });
        if (!isOpen || !document) return null;
        return <div>Viewing {document.original_filename}</div>;
      },
    },
  ).exports;
});

import KnowledgeBasePage from "@/app/knowledge/base/page";

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("KnowledgeBasePage", () => {
  beforeEach(() => {
    resetKnowledgeFeatureMocks(knowledgeMocks);
    resetKnowledgeBasePageLocalMocks(localMocks);
    primeKnowledgeBasePageLocalMocks(localMocks);
    knowledgeMocks.fetchModelConfigsMock.mockResolvedValue([]);
    useKnowledgeBaseMock.mockImplementation(() => buildKnowledgeBaseHookState(localMocks));
  });

  it("重新渲染时不会因为 hook 返回新对象而重复触发 loadCorpus", async () => {
    const { rerender } = render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    expect(loadCorpusMock).toHaveBeenCalledTimes(1);

    rerender(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    expect(loadCorpusMock).toHaveBeenCalledTimes(1);
  });

  it("点击 Delete 后会在页面中央打开确认框，并可取消", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.overview;

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = screen.getByRole("dialog", { name: "Delete Corpus" });
    expect(within(dialog).getByText(/Corpus Alpha/)).toBeInTheDocument();
    expect(deleteCorpusMock).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Delete Corpus")).not.toBeInTheDocument();
    expect(deleteCorpusMock).not.toHaveBeenCalled();
  });

  it("overview Corpus 卡片收敛展示 canonical 摘要并移除 Add Documents", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.overview;

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    expect(screen.queryByRole("button", { name: "Add Documents" })).not.toBeInTheDocument();
    const card = screen.getByTestId("corpus-card-11111111-1111-1111-1111-111111111111");
    const chunks = screen.getByTestId("corpus-chunks-11111111-1111-1111-1111-111111111111");
    const description = screen.getByTestId(
      "corpus-description-11111111-1111-1111-1111-111111111111",
    );
    const footer = screen.getByTestId("corpus-footer-11111111-1111-1111-1111-111111111111");
    const summary = screen.getByTestId("corpus-summary-11111111-1111-1111-1111-111111111111");
    const settingsButton = within(card).getByRole("button", { name: "Settings" });

    expect(chunks).toHaveTextContent("chunks: 3");
    expect(within(card).getByText("Ready")).toBeInTheDocument();
    expect(description).toHaveTextContent("No description");
    expect(description.className).toContain("line-clamp-2");
    expect(card.className).toContain("h-40");
    expect(footer.className).toContain("items-center");
    expect(summary).toHaveTextContent("strategy: recursive · size: 800 · overlap: 100");
    expect(summary).not.toHaveTextContent("chunks:");
    expect(summary.className).toContain("truncate");
    expect(summary.className).toContain("self-center");
    expect(settingsButton.className).toContain("transition-colors");
    expect(settingsButton.className).toContain("hover:bg-muted");
    expect(settingsButton.className).toContain("hover:text-foreground");
    expect(settingsButton.className).toContain("focus-visible:ring-2");

    await user.click(settingsButton);

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("点击删除确认框空白处会关闭弹框", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.overview;

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete Corpus" })).toBeInTheDocument();

    await user.click(screen.getByTestId("overlay-backdrop"));

    expect(screen.queryByRole("dialog", { name: "Delete Corpus" })).not.toBeInTheDocument();
    expect(deleteCorpusMock).not.toHaveBeenCalled();
  });

  it("确认删除当前 Corpus 后会执行删除并跳回 overview", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.overview;

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete Corpus" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await act(async () => {
      await flushPromises();
    });

    expect(deleteCorpusMock).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("进入 documents 视图时使用不超过后端约束的 limit=100", async () => {
    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    expect(fetchDocumentsMock).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      { appName: "negentropy", limit: 100, offset: 0 },
    );
  });

  it("corpus 详情视图使用左侧满高栏与右侧独立滚动区", async () => {
    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    const sidebar = screen.getByTestId("corpus-sidebar");
    const contentScroll = screen.getByTestId("corpus-content-scroll");

    expect(sidebar.className).toContain("h-full");
    expect(sidebar.className).toContain("flex-col");
    expect(contentScroll.className).toContain("overflow-y-auto");
    expect(contentScroll.className).toContain("flex-1");
  });

  it("点击 View 会打开文档预览弹窗，而不是跳到 chunks 视图", async () => {
    const user = userEvent.setup();

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("button", { name: "View" }));

    expect(screen.getByText("Viewing Context Engineering.pdf")).toBeInTheDocument();
    expect(fetchDocumentChunksMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalledWith(
      expect.stringContaining("tab=document-chunks"),
    );
  });

  it("点击文档标题仍然进入 document-chunks 视图", async () => {
    const user = userEvent.setup();
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("button", { name: /Context Engineering\.pdf/ }));

    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      "",
      expect.stringContaining("tab=document-chunks"),
    );
    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      "",
      expect.stringContaining("documentId=doc-1"),
    );

    replaceStateSpy.mockRestore();
  });

  it("点击文档 Delete 后会打开删除确认框，并可取消", async () => {
    const user = userEvent.setup();
    fetchDocumentsMock.mockResolvedValueOnce({
      items: [
        createKnowledgeBaseDocument({
          original_filename: "example.md",
          status: "ready",
          file_size: 123,
        }),
      ],
    });

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = screen.getByRole("dialog", { name: "Delete Document" });
    expect(dialog).toHaveTextContent("example.md");
    expect(deleteDocumentMock).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog", { name: "Delete Document" })).not.toBeInTheDocument();
    expect(deleteDocumentMock).not.toHaveBeenCalled();
  });

  it("确认删除文档后会调用 deleteDocument", async () => {
    const user = userEvent.setup();
    fetchDocumentsMock.mockResolvedValueOnce({
      items: [
        createKnowledgeBaseDocument({
          original_filename: "example.md",
          status: "ready",
          file_size: 123,
        }),
      ],
    });

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete Document" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await act(async () => {
      await flushPromises();
    });

    expect(deleteDocumentMock).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "doc-1",
      { appName: "negentropy" },
    );
    expect(screen.queryByRole("dialog", { name: "Delete Document" })).not.toBeInTheDocument();
  });

  it("documents 视图不显示 Chunking Strategy 配置模块", async () => {
    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    expect(
      screen.queryByRole("heading", { name: "Chunking Strategy" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Save Settings")).not.toBeInTheDocument();
  });

  it("点击 Ingest From URL 后会在页面中央打开 URL 弹框，并可取消", async () => {
    const user = userEvent.setup();

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("button", { name: "Ingest From URL" }));

    const dialog = screen.getByRole("dialog", { name: "Ingest From URL" });
    expect(within(dialog).getByLabelText("URL *")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "From File" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog", { name: "Ingest From URL" })).not.toBeInTheDocument();
    expect(ingestUrlMock).not.toHaveBeenCalled();
  });

  it("提交 Ingest From URL 弹框后会调用 ingestUrl 并携带当前 corpus 配置", async () => {
    const user = userEvent.setup();

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("button", { name: "Ingest From URL" }));

    const dialog = screen.getByRole("dialog", { name: "Ingest From URL" });
    await user.type(
      within(dialog).getByLabelText("URL *"),
      "https://example.com/article",
    );
    await user.click(within(dialog).getByRole("button", { name: "Ingest" }));

    await act(async () => {
      await flushPromises();
    });

    expect(ingestUrlMock).toHaveBeenCalledWith({
      url: "https://example.com/article",
      as_document: true,
      chunkingConfig: {
        strategy: "recursive",
        chunk_size: 800,
        overlap: 100,
        preserve_newlines: true,
        separators: ["\n"],
      },
    });
  });

  it("settings 视图显示 Settings 配置模块", async () => {
    searchParamsState.value = knowledgeBasePageSearchParams.settings;

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    expect(
      screen.getByRole("heading", { name: "Chunking Settings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Document Extraction Settings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("通过 MCP Tools 为当前 Corpus 注入 URL、PDF 等源文档解释器。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Settings" })).toBeInTheDocument();
    expect(screen.getByTestId("corpus-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("corpus-content-scroll").className).toContain("overflow-y-auto");
  });

  it("settings 视图会回显新建 corpus 由后端注入的默认 extraction routes", async () => {
    searchParamsState.value = knowledgeBasePageSearchParams.settings;

    useKnowledgeBaseMock.mockImplementation(() => ({
      corpora: [
        createKnowledgeBaseCorpus({
          config: {
            extractor_routes: createKnowledgeBaseExtractorRoutes([
              knowledgeBasePageExtractorRouteFixtures.defaultConfigured,
            ]),
          },
        }),
      ],
      isLoading: false,
      loadCorpora: loadCorporaMock,
      loadCorpus: loadCorpusMock,
      createCorpus: vi.fn(),
      updateCorpus: updateCorpusMock,
      deleteCorpus: deleteCorpusMock,
      ingestUrl: ingestUrlMock,
      ingestFile: ingestFileMock,
    }));

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });
    expectKnowledgeBaseSelectedMcpOptions(
      knowledgeBasePageMcpSelectionFixtures.defaultConfigured,
    );
  });

  it("settings 视图选择 MCP Server 后不会回退为未配置，并可继续选择 Tool 后保存", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.settings;

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    const serverSelect = screen.getAllByLabelText("MCP Server")[0];
    const toolSelect = screen.getAllByLabelText("Tool")[0];

    expect(serverSelect).toHaveValue("");
    expect(toolSelect).toBeDisabled();

    await user.selectOptions(
      serverSelect,
      String(knowledgeBasePageMcpOptionFixtures.defaultServer.id),
    );

    expect(serverSelect).toHaveValue(knowledgeBasePageMcpSelectionFixtures.defaultConfigured.serverValue);
    expect(toolSelect).not.toBeDisabled();
    expect(toolSelect).toHaveValue("");

    await user.selectOptions(
      toolSelect,
      String(knowledgeBasePageMcpOptionFixtures.defaultTool.name),
    );

    expect(toolSelect).toHaveValue(knowledgeBasePageMcpSelectionFixtures.defaultConfigured.toolValue);

    await user.click(screen.getByRole("button", { name: "Save Settings" }));

    await act(async () => {
      await flushPromises();
    });

    expect(updateCorpusMock).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      {
        config: expect.objectContaining({
          extractor_routes: createKnowledgeBaseExtractorRoutes([
            knowledgeBasePageExtractorRouteFixtures.defaultConfigured,
          ]),
        }),
      },
    );
  });

  it("settings 视图会保留当前不可用的已配置 MCP Server 与 Tool 回显", async () => {
    searchParamsState.value = knowledgeBasePageSearchParams.settings;

    useKnowledgeBaseMock.mockImplementation(() => ({
      corpora: [
        createKnowledgeBaseCorpus({
          config: {
            extractor_routes: createKnowledgeBaseExtractorRoutes([
              knowledgeBasePageExtractorRouteFixtures.legacyConfigured,
            ]),
          },
        }),
      ],
      isLoading: false,
      loadCorpora: loadCorporaMock,
      loadCorpus: loadCorpusMock,
      createCorpus: vi.fn(),
      updateCorpus: updateCorpusMock,
      deleteCorpus: deleteCorpusMock,
      ingestUrl: ingestUrlMock,
      ingestFile: ingestFileMock,
    }));

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    expectKnowledgeBaseUnavailableMcpOptions(
      knowledgeBasePageMcpSelectionFixtures.legacyConfigured,
    );
    expect(
      screen.getByText(/可用于此处的 Tool 需提供可发现的 input\/output schema/i),
    ).toBeInTheDocument();
  });

  it("外部 corpus 刷新不会覆盖 settings 视图中未保存的 MCP 草稿", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.settings;

    const baseCorpus = createKnowledgeBaseCorpus();
    const refreshedCorpus = {
      ...baseCorpus,
      config: {
        strategy: "fixed",
        chunk_size: 1024,
        overlap: 50,
        extractor_routes: createKnowledgeBaseExtractorRoutes([
          knowledgeBasePageExtractorRouteFixtures.refreshedConfigured,
        ]),
      },
    };

    useKnowledgeBaseMock.mockImplementation(() => ({
      corpora: [baseCorpus],
      isLoading: false,
      loadCorpora: loadCorporaMock,
      loadCorpus: loadCorpusMock,
      createCorpus: vi.fn(),
      updateCorpus: updateCorpusMock,
      deleteCorpus: deleteCorpusMock,
      ingestUrl: ingestUrlMock,
      ingestFile: ingestFileMock,
    }));

    const { rerender } = render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    const serverSelect = screen.getAllByLabelText("MCP Server")[0];
    const toolSelect = screen.getAllByLabelText("Tool")[0];

    await user.selectOptions(
      serverSelect,
      String(knowledgeBasePageMcpOptionFixtures.defaultServer.id),
    );
    await user.selectOptions(
      toolSelect,
      String(knowledgeBasePageMcpOptionFixtures.defaultTool.name),
    );

    expect(serverSelect).toHaveValue(knowledgeBasePageMcpSelectionFixtures.defaultConfigured.serverValue);
    expect(toolSelect).toHaveValue(knowledgeBasePageMcpSelectionFixtures.defaultConfigured.toolValue);

    useKnowledgeBaseMock.mockImplementation(() => ({
      corpora: [refreshedCorpus],
      isLoading: false,
      loadCorpora: loadCorporaMock,
      loadCorpus: loadCorpusMock,
      createCorpus: vi.fn(),
      updateCorpus: updateCorpusMock,
      deleteCorpus: deleteCorpusMock,
      ingestUrl: ingestUrlMock,
      ingestFile: ingestFileMock,
    }));

    rerender(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    expectKnowledgeBaseSelectedMcpOptions(
      knowledgeBasePageMcpSelectionFixtures.defaultConfigured,
    );
  });

  it("settings 视图中 semantic 与 hierarchical 只展示各自有效字段", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.settings;

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("button", { name: /semantic/i }));

    expect(screen.queryByText("Chunk Size")).not.toBeInTheDocument();
    expect(screen.queryByText("Overlap")).not.toBeInTheDocument();
    expect(screen.getByText("Buffer Size")).toBeInTheDocument();
    expect(screen.getByText("Min Chunk Size")).toBeInTheDocument();
    expect(screen.getByText("Max Chunk Size")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /hierarchical/i }));

    expect(screen.queryByText("Chunk Size")).not.toBeInTheDocument();
    expect(screen.queryByText("Overlap")).not.toBeInTheDocument();
    expect(screen.getByText("Parent Size")).toBeInTheDocument();
    expect(screen.getByText("Child Size")).toBeInTheDocument();
    expect(screen.getByText("Child Overlap")).toBeInTheDocument();
  });

  it("进入 document-chunks 视图时默认按分页大小 10 拉取，并仅保留左侧主导航", async () => {
    searchParamsState.value = knowledgeBasePageSearchParams.documentChunks();
    fetchDocumentChunksMock.mockResolvedValueOnce({
      count: 1,
      page: 1,
      page_size: 10,
      document_metadata: {
        original_filename: "Context Engineering.pdf",
      },
      items: [createKnowledgeBaseDocumentChunk()],
    });

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    expect(fetchDocumentChunksMock).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "doc-1",
      { appName: "negentropy", limit: 10, offset: 0 },
    );
    const sidebar = screen.getByTestId("corpus-sidebar");
    expect(sidebar).toBeInTheDocument();
    expect(screen.getByTestId("corpus-content-scroll").className).toContain("overflow-hidden");
    expect(screen.getByTestId("document-chunks-queue").className).toContain("overflow-y-auto");
    expect(screen.getByText("Document Chunks")).toBeInTheDocument();
    expect(screen.getByText("Document Metadata")).toBeInTheDocument();
    expect(screen.getByText("1 Chunks")).toBeInTheDocument();
    expect(screen.getByText("Retrieval Count 0")).toBeInTheDocument();
    expect(screen.getByText("Retrieval Count 0").className).toContain("text-zinc-600");
    expect(screen.getByText("Retrieval Count 0").className).not.toContain("rounded");
    expect(screen.getByText("Original filename").tagName).toBe("DT");
    expect(screen.getByText("Original filename").className).toContain("text-sm");
    expect(screen.getByText("Context Engineering.pdf").tagName).toBe("DD");
    expect(screen.getByText("Context Engineering.pdf").className).toContain("font-medium");
    expect(screen.queryByText("Open")).not.toBeInTheDocument();
    expect(screen.queryByText("doc://alpha")).not.toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "Documents" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Documents" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Settings" })).toHaveLength(1);
  });

  it("检索后默认隐藏 Corpus 集合，并通过底部按钮展开与收起", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.overview;

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByPlaceholderText("输入检索内容"), "context engineering");
    await user.click(screen.getByRole("button", { name: "Retrieve" }));

    await act(async () => {
      await flushPromises();
    });

    expect(screen.getByText("1 Retrieved Chunks")).toBeInTheDocument();
    expect(screen.getByText("Chunk-47")).toBeInTheDocument();
    expect(screen.getByText("2512.13564v1.pdf")).toBeInTheDocument();
    expect(screen.getByText("SCORE 0.91")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Corpus" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Corpus" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Corpus" }));

    expect(screen.getByRole("button", { name: "收起 Corpus" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Corpus" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "收起 Corpus" }));

    expect(screen.getByRole("button", { name: "Corpus" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Corpus" })).not.toBeInTheDocument();
  });

  it("新的检索会重置已展开的 Corpus 面板为收起状态", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.overview;

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByPlaceholderText("输入检索内容"), "first query");
    await user.click(screen.getByRole("button", { name: "Retrieve" }));

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("button", { name: "Corpus" }));
    expect(screen.getByRole("button", { name: "收起 Corpus" })).toBeInTheDocument();

    const dockedInput = screen.getByPlaceholderText("输入检索内容");
    await user.clear(dockedInput);
    await user.type(dockedInput, "second query");
    await user.click(screen.getByRole("button", { name: "Retrieve" }));

    await act(async () => {
      await flushPromises();
    });

    expect(screen.getByRole("button", { name: "Corpus" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "收起 Corpus" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Corpus" })).not.toBeInTheDocument();
  });

  it("点击收起结果后回到默认布局并保留检索条件", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.overview;

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    const corpusCheckbox = screen.getByRole("checkbox", { name: /Corpus Alpha/ });
    await user.click(corpusCheckbox);
    await user.type(screen.getByPlaceholderText("输入检索内容"), "context engineering");
    await user.click(screen.getByRole("button", { name: "Retrieve" }));

    await act(async () => {
      await flushPromises();
    });

    expect(screen.getByText("1 Retrieved Chunks")).toBeInTheDocument();
    expect(screen.getByTestId("docked-retrieval-container")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起结果" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "收起结果" }));

    expect(screen.queryByTestId("docked-retrieval-container")).not.toBeInTheDocument();
    expect(screen.queryByText("1 Retrieved Chunks")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Corpus" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("输入检索内容")).toHaveValue("context engineering");
    expect(screen.getByRole("checkbox", { name: /Corpus Alpha/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "hybrid" })).toHaveClass("bg-foreground");
  });

  it("点击收起结果会关闭已打开的检索结果模态框", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.overview;

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByPlaceholderText("输入检索内容"), "context engineering");
    await user.click(screen.getByRole("button", { name: "Retrieve" }));

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByText("Open"));
    expect(screen.getByRole("dialog", { name: "Chunk Detail" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "收起结果" }));

    expect(screen.queryByRole("dialog", { name: "Chunk Detail" })).not.toBeInTheDocument();
    expect(screen.queryByText("1 Retrieved Chunks")).not.toBeInTheDocument();
  });

  it("点击检索结果会打开居中 Chunk Detail 模态框，并可通过遮罩关闭", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.overview;

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByPlaceholderText("输入检索内容"), "context engineering");
    await user.click(screen.getByRole("button", { name: "Retrieve" }));

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByText("Open"));
    expect(screen.getByText("Chunk Detail")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: "Chunk Detail" });
    expect(within(dialog).getByText("Chunk-47")).toBeInTheDocument();
    expect(within(dialog).getByText("2512.13564v1.pdf")).toBeInTheDocument();
    expect(within(dialog).getByText("23 characters")).toBeInTheDocument();

    await user.click(screen.getByTestId("retrieved-chunk-dialog-backdrop"));
    expect(screen.queryByText("Chunk Detail")).not.toBeInTheDocument();
  });

  it("hierarchical 检索结果会显示 child chunks 并在模态框中展示详情", async () => {
    const user = userEvent.setup();
    searchParamsState.value = "view=overview";
    searchAcrossCorporaMock.mockResolvedValueOnce({
      items: [createKnowledgeBaseHierarchicalSearchResult()],
    });

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByPlaceholderText("输入检索内容"), "context engineering");
    await user.click(screen.getByRole("button", { name: "Retrieve" }));

    await act(async () => {
      await flushPromises();
    });

    expect(screen.getByText("Parent-Chunk-06")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HIT 2 CHILD CHUNKS" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "HIT 2 CHILD CHUNKS" }));
    expect(screen.getByText("C-13")).toBeInTheDocument();
    expect(screen.getByText("C-08")).toBeInTheDocument();

    await user.click(screen.getByText("Open"));

    const dialog = screen.getByRole("dialog", { name: "Chunk Detail" });
    expect(within(dialog).getByText("Understanding and Using Context.pdf")).toBeInTheDocument();
    expect(within(dialog).getByText("HIT 2 CHILD CHUNKS")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Context is any information that can be used to characterize the"),
    ).toBeInTheDocument();
  });

  it("字符串形式的 chunk 编号也能正确展示", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.overview;
    searchAcrossCorporaMock.mockResolvedValueOnce({
      items: [
        createKnowledgeBaseSearchResult({
          id: "chunk-string-1",
          content: "string indexed chunk",
          source_uri: "https://example.com/string",
          combined_score: 0.56,
          metadata: {
            corpus_id: "11111111-1111-1111-1111-111111111111",
            chunk_index: "47",
            original_filename: "string-indexed.pdf",
          },
        }),
        {
          id: "chunk-parent-string-1",
          content: "hierarchical string indexed chunk",
          source_uri: "https://example.com/hierarchical-string",
          combined_score: 0.41,
          metadata: {
            corpus_id: "11111111-1111-1111-1111-111111111111",
            original_filename: "hierarchical-string.pdf",
            returned_parent_chunk: true,
            parent_chunk_index: "6",
            matched_child_chunks: [
              {
                id: "child-string-13",
                child_chunk_index: "13",
                content: "child chunk with string index",
                combined_score: 0.41,
              },
            ],
          },
        },
      ],
    });

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByPlaceholderText("输入检索内容"), "string indices");
    await user.click(screen.getByRole("button", { name: "Retrieve" }));

    await act(async () => {
      await flushPromises();
    });

    expect(screen.getByText("Chunk-47")).toBeInTheDocument();
    expect(screen.getByText("Parent-Chunk-06")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "HIT 1 CHILD CHUNKS" }));
    expect(screen.getByText("C-13")).toBeInTheDocument();
  });

  it("缺失 chunk 编号时会明确降级为问号", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.overview;
    searchAcrossCorporaMock.mockResolvedValueOnce({
      items: [
        createKnowledgeBaseSearchResult({
          id: "chunk-no-index-1",
          content: "chunk without index",
          source_uri: "https://example.com/no-index",
          combined_score: 0.21,
          metadata: {
            corpus_id: "11111111-1111-1111-1111-111111111111",
            original_filename: "missing-index.pdf",
          },
        }),
      ],
    });

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByPlaceholderText("输入检索内容"), "missing index");
    await user.click(screen.getByRole("button", { name: "Retrieve" }));

    await act(async () => {
      await flushPromises();
    });

    expect(screen.getByText("Chunk-?")).toBeInTheDocument();
  });

  it("document-chunks 视图点击卡片后以模态框展示 Edit Chunk", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.documentChunks();
    fetchDocumentChunksMock.mockResolvedValueOnce({
      count: 1,
      page: 1,
      page_size: 10,
      document_metadata: {},
      items: [createKnowledgeBaseDocumentChunk()],
    });

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByText("document chunk content"));

    expect(fetchDocumentChunkDetailMock).toHaveBeenCalled();
    expect(await screen.findByText("Edit Chunk")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save & Regenerate Child Chunks" })).toBeInTheDocument();
  });

  it("document-chunks 视图可展开并点击子 chunk 以模态框进入编辑", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.documentChunks();
    fetchDocumentChunksMock.mockResolvedValueOnce({
      count: 1,
      page: 1,
      page_size: 10,
      document_metadata: {},
      items: [
        createKnowledgeBaseDocumentChunk({
          id: "parent-1",
          chunk_role: "parent",
          child_chunks: [
            createKnowledgeBaseDocumentChunk({
              id: "child-1",
              child_chunk_index: 3,
              chunk_index: 3,
              content: "child chunk content",
            }),
          ],
        }),
      ],
    });
    fetchDocumentChunkDetailMock.mockResolvedValueOnce({
      item: createKnowledgeBaseDocumentChunk({
        id: "child-1",
        content: "child chunk content",
      }),
      document_metadata: {},
    });

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("button", { name: "1 CHILD CHUNKS" }));
    await user.click(screen.getAllByRole("button", { name: /C-03.*child chunk content/i }).at(-1)!);

    expect(fetchDocumentChunkDetailMock).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "doc-1",
      "child-1",
      { appName: "negentropy" },
    );
    expect(await screen.findByText("Edit Chunk")).toBeInTheDocument();
  });

  it("未选中任何 Corpus 时禁用 Retrieve，并且不会发起检索", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.overview;

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.type(screen.getByPlaceholderText("输入检索内容"), "context engineering");

    const retrieveButton = screen.getByRole("button", { name: "Retrieve" });
    const corpusLabelRow = screen.getByText("Target Corpus（可多选）").parentElement;
    expect(retrieveButton).toBeDisabled();
    expect(corpusLabelRow).not.toBeNull();
    expect(
      within(corpusLabelRow as HTMLElement).getByText("请至少选择一个 Corpus 后再执行 Retrieve"),
    ).toBeInTheDocument();
    expect(searchAcrossCorporaMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Retrieved Chunks$/)).not.toBeInTheDocument();
  });

  it("仅将选中的 Corpus 传给检索接口，并使用全宽停靠容器", async () => {
    const user = userEvent.setup();
    searchParamsState.value = knowledgeBasePageSearchParams.overview;

    useKnowledgeBaseMock.mockImplementation(() => ({
      corpora: [
        createKnowledgeBaseCorpus(),
        {
          id: "22222222-2222-2222-2222-222222222222",
          name: "Corpus Beta",
          app_name: "negentropy",
          knowledge_count: 5,
          config: {},
        },
      ],
      isLoading: false,
      loadCorpora: loadCorporaMock,
      loadCorpus: loadCorpusMock,
      createCorpus: vi.fn(),
      updateCorpus: updateCorpusMock,
      deleteCorpus: deleteCorpusMock,
      ingestUrl: vi.fn(),
      ingestFile: vi.fn(),
    }));

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    const betaCheckbox = screen.getByRole("checkbox", { name: /Corpus Beta/ });
    await user.click(betaCheckbox);
    await user.type(screen.getByPlaceholderText("输入检索内容"), "context engineering");
    await user.click(screen.getByRole("button", { name: "Retrieve" }));

    await act(async () => {
      await flushPromises();
    });

    expect(searchAcrossCorporaMock).toHaveBeenCalledWith(
      ["22222222-2222-2222-2222-222222222222"],
      {
        app_name: "negentropy",
        query: "context engineering",
        mode: "hybrid",
        limit: 50,
      },
    );

    const dockedContainer = screen.getByTestId("docked-retrieval-container");
    expect(dockedContainer).toHaveClass("w-full");
    expect(dockedContainer).not.toHaveClass("max-w-[1400px]");
  });
});
