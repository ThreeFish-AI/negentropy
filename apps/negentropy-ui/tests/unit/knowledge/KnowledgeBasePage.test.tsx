import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  replaceMock,
  useKnowledgeBaseMock,
  loadCorpusMock,
  loadCorporaMock,
  deleteCorpusMock,
  deleteDocumentMock,
  ingestUrlMock,
  ingestFileMock,
  searchParamsState,
  fetchDocumentsMock,
  fetchDocumentChunksMock,
  searchAcrossCorporaMock,
  documentViewDialogMock,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  useKnowledgeBaseMock: vi.fn(),
  loadCorpusMock: vi.fn(),
  loadCorporaMock: vi.fn(),
  deleteCorpusMock: vi.fn(),
  deleteDocumentMock: vi.fn(),
  ingestUrlMock: vi.fn(),
  ingestFileMock: vi.fn(),
  fetchDocumentsMock: vi.fn(),
  fetchDocumentChunksMock: vi.fn(),
  searchAcrossCorporaMock: vi.fn(),
  documentViewDialogMock: vi.fn(),
  searchParamsState: {
    value: "view=corpus&corpusId=11111111-1111-1111-1111-111111111111&tab=documents",
  },
}));

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

vi.mock("@/features/knowledge", () => ({
  useKnowledgeBase: (...args: unknown[]) => useKnowledgeBaseMock(...args),
  fetchDocuments: (...args: unknown[]) => fetchDocumentsMock(...args),
  fetchDocumentChunks: (...args: unknown[]) => fetchDocumentChunksMock(...args),
  searchAcrossCorpora: (...args: unknown[]) => searchAcrossCorporaMock(...args),
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
  syncDocument: vi.fn(),
  rebuildDocument: vi.fn(),
  replaceDocument: vi.fn(),
  archiveDocument: vi.fn(),
  unarchiveDocument: vi.fn(),
  downloadDocument: vi.fn(),
  deleteDocument: (...args: unknown[]) => deleteDocumentMock(...args),
}));

import KnowledgeBasePage from "@/app/knowledge/base/page";

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("KnowledgeBasePage", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    loadCorpusMock.mockReset();
    loadCorporaMock.mockReset();
    deleteCorpusMock.mockReset();
    deleteDocumentMock.mockReset();
    ingestUrlMock.mockReset();
    ingestFileMock.mockReset();
    fetchDocumentsMock.mockReset();
    fetchDocumentChunksMock.mockReset();
    searchAcrossCorporaMock.mockReset();
    documentViewDialogMock.mockReset();
    searchParamsState.value = "view=corpus&corpusId=11111111-1111-1111-1111-111111111111&tab=documents";

    loadCorpusMock.mockResolvedValue(undefined);
    loadCorporaMock.mockResolvedValue(undefined);
    deleteCorpusMock.mockResolvedValue(undefined);
    deleteDocumentMock.mockResolvedValue(undefined);
    ingestUrlMock.mockResolvedValue({});
    ingestFileMock.mockResolvedValue({});
    fetchDocumentsMock.mockResolvedValue({
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
    fetchDocumentChunksMock.mockResolvedValue({ items: [] });
    searchAcrossCorporaMock.mockResolvedValue({
      items: [
        {
          id: "chunk-1",
          content: "retrieved chunk content",
          source_uri: "https://example.com/doc",
          combined_score: 0.91,
          metadata: { corpus_id: "11111111-1111-1111-1111-111111111111" },
        },
      ],
    });

    useKnowledgeBaseMock.mockImplementation(() => ({
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
      loadCorpora: loadCorporaMock,
      loadCorpus: loadCorpusMock,
      createCorpus: vi.fn(),
      updateCorpus: vi.fn(),
      deleteCorpus: deleteCorpusMock,
      ingestUrl: ingestUrlMock,
      ingestFile: ingestFileMock,
    }));
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
    searchParamsState.value = "view=overview";

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

  it("点击删除确认框空白处会关闭弹框", async () => {
    const user = userEvent.setup();
    searchParamsState.value = "view=overview";

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
    searchParamsState.value = "view=overview";

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

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.click(screen.getByRole("button", { name: /Context Engineering\.pdf/ }));

    expect(replaceMock).toHaveBeenCalledWith(
      expect.stringContaining("tab=document-chunks"),
    );
    expect(replaceMock).toHaveBeenCalledWith(
      expect.stringContaining("documentId=doc-1"),
    );
  });

  it("点击文档 Delete 后会打开删除确认框，并可取消", async () => {
    const user = userEvent.setup();
    fetchDocumentsMock.mockResolvedValueOnce({
      items: [
        {
          id: "doc-1",
          original_filename: "example.md",
          status: "ready",
          file_size: 123,
          metadata: { source_type: "file" },
        },
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
        {
          id: "doc-1",
          original_filename: "example.md",
          status: "ready",
          file_size: 123,
          metadata: { source_type: "file" },
        },
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
      chunkingConfig: {},
    });
  });

  it("settings 视图显示 Settings 配置模块", async () => {
    searchParamsState.value =
      "view=corpus&corpusId=11111111-1111-1111-1111-111111111111&tab=settings";

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    expect(
      screen.getByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Settings" })).toBeInTheDocument();
  });

  it("进入 document-chunks 视图时使用不超过后端约束的 limit=200", async () => {
    searchParamsState.value =
      "view=corpus&corpusId=11111111-1111-1111-1111-111111111111&tab=document-chunks&documentId=doc-1";

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    expect(fetchDocumentChunksMock).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "doc-1",
      { appName: "negentropy", limit: 200, offset: 0 },
    );
  });

  it("检索后默认隐藏 Corpus 集合，并通过底部按钮展开与收起", async () => {
    const user = userEvent.setup();
    searchParamsState.value = "view=overview";

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

    expect(screen.getByText("Retrieved Chunks")).toBeInTheDocument();
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
    searchParamsState.value = "view=overview";

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

  it("点击右侧抽屉空白处会关闭 Chunk Detail", async () => {
    const user = userEvent.setup();
    searchParamsState.value = "view=overview";

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

    await user.click(screen.getByText("retrieved chunk content"));
    expect(screen.getByText("Chunk Detail")).toBeInTheDocument();

    await user.click(screen.getByTestId("chunk-drawer-backdrop"));
    expect(screen.queryByText("Chunk Detail")).not.toBeInTheDocument();
  });

  it("未选中任何 Corpus 时禁用 Retrieve，并且不会发起检索", async () => {
    const user = userEvent.setup();
    searchParamsState.value = "view=overview";

    render(<KnowledgeBasePage />);

    await act(async () => {
      await flushPromises();
    });

    await user.type(screen.getByPlaceholderText("输入检索内容"), "context engineering");

    const retrieveButton = screen.getByRole("button", { name: "Retrieve" });
    expect(retrieveButton).toBeDisabled();
    expect(screen.getByText("请至少选择一个 Corpus 后再执行 Retrieve")).toBeInTheDocument();
    expect(searchAcrossCorporaMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Retrieved Chunks")).not.toBeInTheDocument();
  });

  it("仅将选中的 Corpus 传给检索接口，并使用全宽停靠容器", async () => {
    const user = userEvent.setup();
    searchParamsState.value = "view=overview";

    useKnowledgeBaseMock.mockImplementation(() => ({
      corpora: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          name: "Corpus Alpha",
          app_name: "negentropy",
          knowledge_count: 3,
          config: {},
        },
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
      updateCorpus: vi.fn(),
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
