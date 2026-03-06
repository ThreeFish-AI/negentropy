import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  replaceMock,
  useKnowledgeBaseMock,
  loadCorpusMock,
  loadCorporaMock,
  deleteCorpusMock,
  searchParamsState,
  fetchDocumentsMock,
  fetchDocumentChunksMock,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  useKnowledgeBaseMock: vi.fn(),
  loadCorpusMock: vi.fn(),
  loadCorporaMock: vi.fn(),
  deleteCorpusMock: vi.fn(),
  fetchDocumentsMock: vi.fn(),
  fetchDocumentChunksMock: vi.fn(),
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
  searchAcrossCorpora: vi.fn().mockResolvedValue({ items: [] }),
  syncDocument: vi.fn(),
  rebuildDocument: vi.fn(),
  replaceDocument: vi.fn(),
  archiveDocument: vi.fn(),
  unarchiveDocument: vi.fn(),
  downloadDocument: vi.fn(),
  deleteDocument: vi.fn(),
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
    fetchDocumentsMock.mockReset();
    fetchDocumentChunksMock.mockReset();
    searchParamsState.value = "view=corpus&corpusId=11111111-1111-1111-1111-111111111111&tab=documents";

    loadCorpusMock.mockResolvedValue(undefined);
    loadCorporaMock.mockResolvedValue(undefined);
    deleteCorpusMock.mockResolvedValue(undefined);
    fetchDocumentsMock.mockResolvedValue({ items: [] });
    fetchDocumentChunksMock.mockResolvedValue({ items: [] });

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
      ingestUrl: vi.fn(),
      ingestFile: vi.fn(),
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
});
