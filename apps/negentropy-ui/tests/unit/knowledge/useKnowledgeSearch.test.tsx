import { renderHook, act } from "@testing-library/react";

const knowledgeApiMocks = vi.hoisted(() => ({
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
}));

vi.mock("@/features/knowledge/utils/knowledge-api", async () => {
  const { createKnowledgeApiTestHarness } = await import("@/tests/helpers/knowledge-api");
  return createKnowledgeApiTestHarness(knowledgeApiMocks).exports;
});

import { useKnowledgeSearch } from "@/features/knowledge/hooks/useKnowledgeSearch";

describe("useKnowledgeSearch", () => {
  beforeEach(() => {
    knowledgeApiMocks.searchKnowledgeMock.mockReset();
  });

  it("空查询会直接返回空结果且不请求后端", async () => {
    const { result } = renderHook(() =>
      useKnowledgeSearch({ corpusId: "c1", appName: "negentropy" }),
    );

    await act(async () => {
      await expect(result.current.search("   ")).resolves.toEqual({ count: 0, items: [] });
    });

    expect(result.current.results).toEqual({ count: 0, items: [] });
    expect(knowledgeApiMocks.searchKnowledgeMock).not.toHaveBeenCalled();
  });

  it("search 会合并默认配置并透传成功结果", async () => {
    const onSuccess = vi.fn();
    knowledgeApiMocks.searchKnowledgeMock.mockResolvedValue({
      count: 1,
      items: [{ id: "m1" }],
    } as never);

    const { result } = renderHook(() =>
      useKnowledgeSearch({
        corpusId: "c1",
        appName: "negentropy",
        defaultConfig: { mode: "keyword", limit: 5 },
        onSuccess,
      }),
    );

    await act(async () => {
      await result.current.search("hello", { semantic_weight: 0.9 });
    });

    expect(knowledgeApiMocks.searchKnowledgeMock).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        app_name: "negentropy",
        query: "hello",
        mode: "keyword",
        limit: 5,
        semantic_weight: 0.9,
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith({ count: 1, items: [{ id: "m1" }] });
    expect(result.current.results).toEqual({ count: 1, items: [{ id: "m1" }] });
    expect(result.current.isSearching).toBe(false);
  });

  it("search 失败时会暴露错误并回调 onError", async () => {
    const error = new Error("search failed");
    const onError = vi.fn();
    knowledgeApiMocks.searchKnowledgeMock.mockRejectedValue(error);

    const { result } = renderHook(() =>
      useKnowledgeSearch({ corpusId: "c1", onError }),
    );

    await act(async () => {
      await expect(result.current.search("hello")).rejects.toThrow("search failed");
    });

    expect(result.current.error).toBe(error);
    expect(onError).toHaveBeenCalledWith(error);
    expect(result.current.isSearching).toBe(false);
  });
});
