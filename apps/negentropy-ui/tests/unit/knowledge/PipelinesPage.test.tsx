import { act, render, screen } from "@testing-library/react";

const knowledgeMocks = vi.hoisted(() => ({
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
  searchAcrossCorporaMock: vi.fn(),
  syncDocumentMock: vi.fn(),
  rebuildDocumentMock: vi.fn(),
  replaceDocumentMock: vi.fn(),
  archiveDocumentMock: vi.fn(),
  unarchiveDocumentMock: vi.fn(),
  downloadDocumentMock: vi.fn(),
  deleteDocumentMock: vi.fn(),
}));
vi.mock("@/components/ui/KnowledgeNav", () => ({
  KnowledgeNav: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("@/features/knowledge", async () => {
  const { createKnowledgeFeatureTestHarness } = await import("@/tests/helpers/knowledge");
  return createKnowledgeFeatureTestHarness(knowledgeMocks).exports;
});

import KnowledgePipelinesPage from "@/app/knowledge/pipelines/page";

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const settle = async () => {
  await act(async () => {
    await flushPromises();
  });
};

const makeRun = (overrides?: Partial<{ id: string; run_id: string; status: string; version: number }>) => ({
  id: overrides?.id ?? "run-1-id",
  run_id: overrides?.run_id ?? "run-1",
  status: overrides?.status ?? "completed",
  version: overrides?.version ?? 1,
});

describe("KnowledgePipelinesPage polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    knowledgeMocks.fetchPipelinesMock.mockReset();
    knowledgeMocks.upsertPipelinesMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("在首屏无数据时，会通过兜底轮询自动显示新 Run", async () => {
    knowledgeMocks.fetchPipelinesMock
      .mockResolvedValueOnce({ runs: [], last_updated_at: "t0" })
      .mockResolvedValueOnce({ runs: [], last_updated_at: "t1" })
      .mockResolvedValueOnce({
        runs: [makeRun({ run_id: "run-new", id: "run-new-id" })],
        last_updated_at: "t2",
      });

    render(<KnowledgePipelinesPage />);
    await settle();
    expect(knowledgeMocks.fetchPipelinesMock).toHaveBeenCalledTimes(1);

    expect(screen.getByText("暂无作业")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await settle();

    expect(screen.getAllByText("run-new").length).toBeGreaterThan(0);
  });

  it("兜底轮询在达到 8 秒窗口后停止继续请求", async () => {
    knowledgeMocks.fetchPipelinesMock.mockResolvedValue({
      runs: [],
      last_updated_at: "t0",
    });

    render(<KnowledgePipelinesPage />);
    await settle();
    expect(knowledgeMocks.fetchPipelinesMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    await settle();
    expect(knowledgeMocks.fetchPipelinesMock).toHaveBeenCalledTimes(9);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    await settle();

    expect(knowledgeMocks.fetchPipelinesMock).toHaveBeenCalledTimes(9);
  });

  it("存在 running Run 时按 3 秒节奏轮询", async () => {
    knowledgeMocks.fetchPipelinesMock.mockResolvedValue({
      runs: [makeRun({ status: "running" })],
      last_updated_at: "t0",
    });

    render(<KnowledgePipelinesPage />);
    await settle();
    expect(knowledgeMocks.fetchPipelinesMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    await settle();
    expect(knowledgeMocks.fetchPipelinesMock).toHaveBeenCalledTimes(3);
  });
});
