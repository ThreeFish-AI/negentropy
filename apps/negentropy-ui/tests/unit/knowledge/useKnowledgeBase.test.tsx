import { renderHook } from "@testing-library/react";

const { fetchCorpusMock, fetchCorporaMock } = vi.hoisted(() => ({
  fetchCorpusMock: vi.fn(),
  fetchCorporaMock: vi.fn(),
}));

vi.mock("@/features/knowledge/utils/knowledge-api", async () => {
  const actual = await vi.importActual<typeof import("@/features/knowledge/utils/knowledge-api")>(
    "@/features/knowledge/utils/knowledge-api",
  );

  return {
    ...actual,
    fetchCorpus: (...args: unknown[]) => fetchCorpusMock(...args),
    fetchCorpora: (...args: unknown[]) => fetchCorporaMock(...args),
    createCorpus: vi.fn(),
    updateCorpus: vi.fn(),
    deleteCorpus: vi.fn(),
    ingestText: vi.fn(),
    ingestUrl: vi.fn(),
    ingestFile: vi.fn(),
    replaceSource: vi.fn(),
    syncSource: vi.fn(),
    rebuildSource: vi.fn(),
    deleteSource: vi.fn(),
    archiveSource: vi.fn(),
    searchKnowledge: vi.fn(),
  };
});

import { useKnowledgeBase } from "@/features/knowledge/hooks/useKnowledgeBase";

describe("useKnowledgeBase", () => {
  beforeEach(() => {
    fetchCorpusMock.mockReset();
    fetchCorporaMock.mockReset();
    fetchCorporaMock.mockResolvedValue([]);
  });

  it("在相同输入下保持返回对象和 loadCorpus 引用稳定", () => {
    const { result, rerender } = renderHook(
      ({ appName }: { appName: string }) => useKnowledgeBase({ appName }),
      {
        initialProps: { appName: "negentropy" },
      },
    );

    const initialValue = result.current;
    const initialLoadCorpus = result.current.loadCorpus;

    rerender({ appName: "negentropy" });

    expect(result.current).toBe(initialValue);
    expect(result.current.loadCorpus).toBe(initialLoadCorpus);
  });
});
