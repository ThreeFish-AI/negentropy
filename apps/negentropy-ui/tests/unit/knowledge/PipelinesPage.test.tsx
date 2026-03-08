import { act, render, screen } from "@testing-library/react";
import type { KnowledgeFeatureMockSet } from "@/tests/helpers/knowledge";

const knowledgeMocks = vi.hoisted(() => ({}) as KnowledgeFeatureMockSet);

vi.mock("@/components/ui/KnowledgeNav", () => ({
  KnowledgeNav: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("@/features/knowledge", async () => {
  const { createKnowledgeFeatureMockSet, createKnowledgeFeatureTestHarness } = await import(
    "@/tests/helpers/knowledge"
  );
  Object.assign(knowledgeMocks, createKnowledgeFeatureMockSet());
  return createKnowledgeFeatureTestHarness(knowledgeMocks).exports;
});

import KnowledgePipelinesPage from "@/app/knowledge/pipelines/page";
import { resetKnowledgeFeatureMocks } from "@/tests/helpers/knowledge";

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const settle = async () => {
  await act(async () => {
    await flushPromises();
  });
};

const makeRun = (
  overrides?: Partial<{
    id: string;
    run_id: string;
    status: string;
    version: number;
    operation: string;
    started_at: string;
    completed_at: string;
    duration_ms: number;
  }>
) => ({
  id: overrides?.id ?? "run-1-id",
  run_id: overrides?.run_id ?? "run-1",
  status: overrides?.status ?? "completed",
  version: overrides?.version ?? 1,
  operation: overrides?.operation,
  started_at: overrides?.started_at,
  completed_at: overrides?.completed_at,
  duration_ms: overrides?.duration_ms,
});

describe("KnowledgePipelinesPage polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetKnowledgeFeatureMocks(knowledgeMocks);
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

  it("桌面端使用固定双栏 grid，并为长内容提供收敛样式", async () => {
    knowledgeMocks.fetchPipelinesMock.mockResolvedValue({
      runs: [
        {
          ...makeRun({
            id: "run-long-id",
            run_id: "run-id-with-a-very-long-identifier-that-should-not-expand-the-layout",
          }),
          input: {
            source: "https://example.com/" + "segment/".repeat(20),
          },
          output: {
            message: "value-".repeat(30),
          },
          error: {
            detail: "error-".repeat(30),
          },
          stages: {
            extract_primary: {
              status: "completed",
              duration_ms: 1234,
            },
            persist: {
              status: "failed",
              duration_ms: 5678,
              error: {
                message: "stage-error-message-".repeat(10),
              },
            },
          },
        },
      ],
      last_updated_at: "t0",
    });

    const { container } = render(<KnowledgePipelinesPage />);
    await settle();

    const layout = Array.from(container.querySelectorAll("div")).find((element) =>
      element.className.includes("lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]")
    );
    expect(layout).toBeTruthy();
    expect(layout?.className).toContain("grid-cols-1");

    const runsSection = screen.getByRole("heading", { name: "Runs" }).closest("section");
    expect(runsSection?.className).toContain("min-w-0");
    expect(runsSection?.className).toContain("overflow-hidden");

    const detailHeading = screen.getByRole("heading", { name: "Run Detail" });
    const detailPanel = detailHeading.parentElement?.querySelector("pre");
    expect(detailPanel?.className).toContain("whitespace-pre-wrap");
    expect(detailPanel?.className).toContain("break-words");

    expect(screen.getAllByText(/run-id-with-a-very-long-identifier/).length).toBeGreaterThan(0);
    expect(screen.getByText(/https:\/\/example\.com/)).toBeInTheDocument();
  });

  it("失败的重建源 Run 会在 Timeline 中显示开始与结束时间", async () => {
    knowledgeMocks.fetchPipelinesMock.mockResolvedValue({
      runs: [
        makeRun({
          id: "run-failed-id",
          run_id: "run-failed",
          status: "failed",
          operation: "rebuild_source",
          started_at: "2026-03-08T10:00:00Z",
          completed_at: "2026-03-08T10:02:00Z",
          duration_ms: 120000,
        }),
      ],
      last_updated_at: "t0",
    });

    render(<KnowledgePipelinesPage />);
    await settle();

    expect(screen.getAllByText("重建源").length).toBeGreaterThan(0);
    expect(screen.getByText("开始 2026-03-08T10:00:00Z")).toBeInTheDocument();
    expect(screen.getByText("结束 2026-03-08T10:02:00Z")).toBeInTheDocument();
  });
});
