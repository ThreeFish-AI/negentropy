import { act, renderHook, waitFor } from "@testing-library/react";
import type { KnowledgeApiMockSet } from "@/tests/helpers/knowledge-api";

const knowledgeApiMocks = vi.hoisted(() => ({}) as KnowledgeApiMockSet);

vi.mock("@/features/knowledge/utils/knowledge-api", async () => {
  const { createKnowledgeApiMockSet, createKnowledgeApiTestHarness } = await import(
    "@/tests/helpers/knowledge-api"
  );
  Object.assign(knowledgeApiMocks, createKnowledgeApiMockSet());
  return (await createKnowledgeApiTestHarness(knowledgeApiMocks)).exports;
});

import { useKnowledgeBase } from "@/features/knowledge/hooks/useKnowledgeBase";

describe("useKnowledgeBase", () => {
  beforeEach(() => {
    knowledgeApiMocks.fetchCorpusMock.mockReset();
    knowledgeApiMocks.fetchCorporaMock.mockReset();
    knowledgeApiMocks.fetchCorporaMock.mockResolvedValue([]);
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

  it("loadCorpora 成功时会刷新 corpora 列表并恢复 loading 状态", async () => {
    knowledgeApiMocks.fetchCorporaMock.mockResolvedValueOnce([
      {
        id: "corpus-1",
        app_name: "negentropy",
        name: "Corpus One",
        knowledge_count: 2,
      },
    ]);

    const { result } = renderHook(() => useKnowledgeBase({ appName: "negentropy" }));

    await act(async () => {
      await result.current.loadCorpora();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(knowledgeApiMocks.fetchCorporaMock).toHaveBeenCalledWith("negentropy");
    expect(result.current.corpora).toEqual([
      expect.objectContaining({
        id: "corpus-1",
        name: "Corpus One",
      }),
    ]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
