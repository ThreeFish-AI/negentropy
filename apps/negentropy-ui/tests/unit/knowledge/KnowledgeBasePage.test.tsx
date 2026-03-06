import { act, render } from "@testing-library/react";

const {
  replaceMock,
  useKnowledgeBaseMock,
  loadCorpusMock,
  loadCorporaMock,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  useKnowledgeBaseMock: vi.fn(),
  loadCorpusMock: vi.fn(),
  loadCorporaMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/knowledge/base",
  useSearchParams: () =>
    new URLSearchParams("view=corpus&corpusId=11111111-1111-1111-1111-111111111111&tab=documents"),
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
  fetchDocuments: vi.fn().mockResolvedValue({ items: [] }),
  fetchDocumentChunks: vi.fn().mockResolvedValue({ items: [] }),
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

    loadCorpusMock.mockResolvedValue(undefined);
    loadCorporaMock.mockResolvedValue(undefined);

    useKnowledgeBaseMock.mockImplementation(() => ({
      corpora: [],
      isLoading: false,
      loadCorpora: loadCorporaMock,
      loadCorpus: loadCorpusMock,
      createCorpus: vi.fn(),
      updateCorpus: vi.fn(),
      deleteCorpus: vi.fn(),
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
});
