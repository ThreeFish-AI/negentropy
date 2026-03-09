import { act, render, screen, within } from "@testing-library/react";
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

  it("Runs 列表状态标签复用 Dashboard 的共享状态样式", async () => {
    knowledgeMocks.fetchPipelinesMock.mockResolvedValue({
      runs: [
        makeRun({
          id: "run-running-id",
          run_id: "run-running",
          status: "running",
        }),
        makeRun({
          id: "run-completed-id",
          run_id: "run-completed",
          status: "completed",
        }),
        makeRun({
          id: "run-failed-id",
          run_id: "run-failed",
          status: "failed",
        }),
      ],
      last_updated_at: "t0",
    });

    const { container } = render(<KnowledgePipelinesPage />);
    await settle();

    const runningBadge = screen.getByLabelText("状态: running");
    expect(runningBadge.className).toContain("inline-flex");
    expect(runningBadge.querySelector("span")?.className).toContain("animate-pulse");
    expect(within(runningBadge).getByText("running").className).toContain("text-amber-600");

    const completedBadge = screen.getByLabelText("状态: completed");
    expect(completedBadge.className).toContain("inline-flex");
    expect(within(completedBadge).getByText("completed").className).toContain("text-emerald-600");

    const failedBadge = screen.getByLabelText("状态: failed");
    expect(failedBadge.className).toContain("inline-flex");
    expect(within(failedBadge).getByText("failed").className).toContain("text-rose-600");

    const selectedRunButton = Array.from(container.querySelectorAll("button")).find((element) =>
      element.textContent?.includes("run-running")
    );
    expect(selectedRunButton?.className).toContain("bg-zinc-900");
  });

  it("多 Stage 失败时，详情页 Errors 区域会同时展示所有阶段异常", async () => {
    knowledgeMocks.fetchPipelinesMock.mockResolvedValue({
      runs: [
        {
          ...makeRun({
            id: "run-multi-error-id",
            run_id: "run-multi-error",
            status: "failed",
          }),
          stages: {
            extract_primary: {
              status: "failed",
              duration_ms: 1200,
              error: {
                message: "primary extractor failed",
                tool_name: "extract_primary",
              },
            },
            extract_failover_1: {
              status: "failed",
              duration_ms: 800,
              error: {
                message: "backup extractor failed",
                tool_name: "extract_failover_1",
              },
            },
          },
        },
      ],
      last_updated_at: "t0",
    });

    render(<KnowledgePipelinesPage />);
    await settle();

    expect(screen.getByText("Errors")).toBeInTheDocument();
    expect(screen.getAllByText("主 MCP 提取").length).toBeGreaterThan(0);
    expect(screen.getAllByText("备用 MCP 提取 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("primary extractor failed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("backup extractor failed").length).toBeGreaterThan(0);
  });

  it("顶层错误与阶段错误重复时，Errors 区域不会重复展示运行级错误", async () => {
    knowledgeMocks.fetchPipelinesMock.mockResolvedValue({
      runs: [
        {
          ...makeRun({
            id: "run-dedup-id",
            run_id: "run-dedup",
            status: "failed",
          }),
          error: {
            message: "backup extractor failed",
          },
          stages: {
            extract_failover_1: {
              status: "failed",
              duration_ms: 800,
              error: {
                message: "backup extractor failed",
              },
            },
          },
        },
      ],
      last_updated_at: "t0",
    });

    render(<KnowledgePipelinesPage />);
    await settle();

    expect(screen.queryByText("运行级错误")).not.toBeInTheDocument();
    const errorsSection = screen.getByText("Errors").parentElement;
    expect(errorsSection).not.toBeNull();
    expect(within(errorsSection as HTMLElement).getAllByText("备用 MCP 提取 1")).toHaveLength(1);
    expect(within(errorsSection as HTMLElement).getAllByText("backup extractor failed")).toHaveLength(1);
  });

  it("顶层错误与阶段错误不同步时，会同时展示运行级和阶段级错误", async () => {
    knowledgeMocks.fetchPipelinesMock.mockResolvedValue({
      runs: [
        {
          ...makeRun({
            id: "run-run-and-stage-error-id",
            run_id: "run-run-and-stage-error",
            status: "failed",
          }),
          error: {
            message: "pipeline terminated after retries",
          },
          stages: {
            extract_failover_1: {
              status: "failed",
              duration_ms: 800,
              error: {
                message: "backup extractor failed",
              },
            },
          },
        },
      ],
      last_updated_at: "t0",
    });

    render(<KnowledgePipelinesPage />);
    await settle();

    expect(screen.getByText("运行级错误")).toBeInTheDocument();
    expect(screen.getAllByText("pipeline terminated after retries").length).toBeGreaterThan(0);
    expect(screen.getAllByText("备用 MCP 提取 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("backup extractor failed").length).toBeGreaterThan(0);
  });

  it("即使缺少顶层 error，也会基于 stages 渲染 Errors 区域", async () => {
    knowledgeMocks.fetchPipelinesMock.mockResolvedValue({
      runs: [
        {
          ...makeRun({
            id: "run-stage-only-error-id",
            run_id: "run-stage-only-error",
            status: "failed",
          }),
          stages: {
            persist: {
              status: "failed",
              duration_ms: 50,
              error: {
                detail: "persist detail error",
              },
            },
          },
        },
      ],
      last_updated_at: "t0",
    });

    render(<KnowledgePipelinesPage />);
    await settle();

    expect(screen.getByText("Errors")).toBeInTheDocument();
    expect(screen.getAllByText("持久化").length).toBeGreaterThan(0);
    expect(screen.getAllByText("persist detail error").length).toBeGreaterThan(0);
  });

  it("extract_gate 会按共享阶段语义显示，并渲染失败分类文案", async () => {
    knowledgeMocks.fetchPipelinesMock.mockResolvedValue({
      runs: [
        {
          ...makeRun({
            id: "run-extract-gate-id",
            run_id: "run-extract-gate",
            status: "failed",
            operation: "rebuild_source",
          }),
          stages: {
            extract_finalize: {
              status: "completed",
              duration_ms: 120,
            },
            extract_gate: {
              status: "failed",
              duration_ms: 33,
              error: {
                message: "Extractor produced empty document after normalization",
                failure_category: "empty_payload",
              },
            },
          },
        },
      ],
      last_updated_at: "t0",
    });

    render(<KnowledgePipelinesPage />);
    await settle();

    expect(screen.getAllByText("提取结果校验").length).toBeGreaterThan(0);
    expect(screen.getByText("提取结果为空")).toBeInTheDocument();
    expect(
      screen.getAllByText("Extractor produced empty document after normalization").length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/无法构造最小调用参数/)).not.toBeInTheDocument();
  });

  it("契约类失败会在 Errors 区展示受控诊断摘要", async () => {
    knowledgeMocks.fetchPipelinesMock.mockResolvedValue({
      runs: [
        {
          ...makeRun({
            id: "run-contract-summary-id",
            run_id: "run-contract-summary",
            status: "failed",
            operation: "rebuild_source",
          }),
          stages: {
            extract_primary: {
              status: "failed",
              duration_ms: 18,
              error: {
                message: "Tool input schema could not be normalized for document extraction",
                failure_category: "low_confidence_contract",
                diagnostic_summary:
                  "契约为 unknown，要求额外必填字段 opaque，当前提取源无法构造最小调用参数",
              },
            },
          },
        },
      ],
      last_updated_at: "t0",
    });

    render(<KnowledgePipelinesPage />);
    await settle();

    expect(screen.getByText("Tool 契约置信度不足")).toBeInTheDocument();
    expect(
      screen.getAllByText("契约为 unknown，要求额外必填字段 opaque，当前提取源无法构造最小调用参数")
    ).toHaveLength(1);
  });
  it("failure_category 存在时，阶段摘要与错误详情会展示归一化标签", async () => {
    knowledgeMocks.fetchPipelinesMock.mockResolvedValue({
      runs: [
        {
          ...makeRun({
            id: "run-failure-category-id",
            run_id: "run-failure-category",
            status: "failed",
          }),
          error: {
            message: "payload shape is invalid",
            failure_category: "unsupported_contract",
          },
          stages: {
            extract_primary: {
              status: "failed",
              duration_ms: 1200,
              error: {
                message: "payload shape is invalid",
                failure_category: "unsupported_contract",
              },
            },
          },
        },
      ],
      last_updated_at: "t0",
    });

    render(<KnowledgePipelinesPage />);
    await settle();

    expect(screen.getAllByText("Tool 契约不受支持").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tool 契约不受支持 · payload shape is invalid").length).toBeGreaterThan(0);
  });

  it("failure_category 缺失或为空时，不渲染空标签占位", async () => {
    knowledgeMocks.fetchPipelinesMock.mockResolvedValue({
      runs: [
        {
          ...makeRun({
            id: "run-empty-failure-category-id",
            run_id: "run-empty-failure-category",
            status: "failed",
          }),
          error: {
            message: "extractor failed without category",
            failure_category: "   ",
          },
          stages: {
            extract_primary: {
              status: "failed",
              duration_ms: 1200,
              error: {
                message: "extractor failed without category",
                failure_category: "   ",
              },
            },
          },
        },
      ],
      last_updated_at: "t0",
    });

    render(<KnowledgePipelinesPage />);
    await settle();

    expect(screen.queryByText("Tool 契约不受支持")).not.toBeInTheDocument();
    expect(screen.getAllByText("extractor failed without category").length).toBeGreaterThan(0);
  });

  it("failure_category 存在时，阶段摘要与错误详情会展示归一化标签", async () => {
    knowledgeMocks.fetchPipelinesMock.mockResolvedValue({
      runs: [
        {
          ...makeRun({
            id: "run-failure-category-id",
            run_id: "run-failure-category",
            status: "failed",
          }),
          error: {
            message: "payload shape is invalid",
            failure_category: "unsupported_contract",
          },
          stages: {
            extract_primary: {
              status: "failed",
              duration_ms: 1200,
              error: {
                message: "payload shape is invalid",
                failure_category: "unsupported_contract",
              },
            },
          },
        },
      ],
      last_updated_at: "t0",
    });

    render(<KnowledgePipelinesPage />);
    await settle();

    expect(screen.getAllByText("Tool 契约不受支持").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tool 契约不受支持 · payload shape is invalid").length).toBeGreaterThan(0);
  });

  it("failure_category 缺失或为空时，不渲染空标签占位", async () => {
    knowledgeMocks.fetchPipelinesMock.mockResolvedValue({
      runs: [
        {
          ...makeRun({
            id: "run-empty-failure-category-id",
            run_id: "run-empty-failure-category",
            status: "failed",
          }),
          error: {
            message: "extractor failed without category",
            failure_category: "   ",
          },
          stages: {
            extract_primary: {
              status: "failed",
              duration_ms: 1200,
              error: {
                message: "extractor failed without category",
                failure_category: "   ",
              },
            },
          },
        },
      ],
      last_updated_at: "t0",
    });

    render(<KnowledgePipelinesPage />);
    await settle();

    expect(screen.queryByText("Tool 契约不受支持")).not.toBeInTheDocument();
    expect(screen.getAllByText("extractor failed without category").length).toBeGreaterThan(0);
  });
});
