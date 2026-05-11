/**
 * KgBuildProgressPill 单元测试（P3-1 G1c）
 *
 * 验证：
 * - enqueued=false 或 corpusId=null 时返回 null（零回归）；
 * - 轮询 REST 端点后渲染百分比 + 状态标签；
 * - 收到 terminal 状态后自动停止轮询；
 * - 网络瞬态故障通过指数退避自动恢复；
 * - 连续失败 10 次后显示 error 状态。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { KgBuildProgressPill } from "@/components/ui/KgBuildProgressPill";

const POLL_URL_RE = /\/api\/knowledge\/base\/[^/]+\/graph\/build-runs\/latest$/;

function jsonRes(data: unknown, ok = true, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    statusText: ok ? "OK" : "Error",
    headers: { "content-type": "application/json" },
  });
}

describe("KgBuildProgressPill", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue(jsonRes({ status: "idle" }));
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("enqueued=false 时返回 null（零回归保护）", () => {
    const { container } = render(
      <KgBuildProgressPill corpusId="c-123" enqueued={false} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("corpusId 缺失时不发起轮询", () => {
    render(<KgBuildProgressPill corpusId={null} enqueued={true} />);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("enqueued=true 时首次轮询并渲染初始 pending 状态", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonRes({ status: "pending", progress_percent: 0 }),
    );
    render(<KgBuildProgressPill corpusId="abc-123" enqueued={true} />);
    // 初始 state 为 pending
    expect(screen.getByTestId("kg-build-progress")).toHaveAttribute(
      "data-kg-status",
      "pending",
    );
    await act(async () => {});
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toMatch(POLL_URL_RE);
  });

  it("收到 running 响应后展示百分比 + 实体/关系数", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonRes({
        status: "running",
        progress_percent: 0.62,
        entity_count: 12,
        relation_count: 7,
        run_id: "r1",
      }),
    );
    render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
    await act(async () => {});
    const pill = screen.getByTestId("kg-build-progress");
    expect(pill).toHaveAttribute("data-kg-status", "running");
    expect(pill).toHaveTextContent("62%");
    expect(pill).toHaveTextContent("12 实体");
    expect(pill).toHaveTextContent("7 关系");
  });

  it("收到 completed 终态后停止轮询", async () => {
    vi.useFakeTimers();
    try {
      mockFetch.mockResolvedValueOnce(
        jsonRes({
          status: "completed",
          progress_percent: 1,
          entity_count: 20,
          relation_count: 15,
        }),
      );
      render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
      await act(async () => { vi.advanceTimersByTime(0); });
      expect(screen.getByTestId("kg-build-progress")).toHaveAttribute(
        "data-kg-status",
        "completed",
      );
      // 推进时间，确认没有再次轮询
      await act(async () => { vi.advanceTimersByTime(10000); });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("收到 failed 终态展示 error_message", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonRes({
        status: "failed",
        error_message: "LLM extractor timeout",
        progress_percent: 0.3,
      }),
    );
    render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
    await act(async () => {});
    expect(screen.getByTestId("kg-build-progress")).toHaveTextContent(
      "LLM extractor timeout",
    );
  });

  it("idle 状态（无 active run）→ 展示无活跃构建文案", async () => {
    mockFetch.mockResolvedValueOnce(jsonRes({ status: "idle" }));
    render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
    await act(async () => {});
    expect(screen.getByTestId("kg-build-progress")).toHaveTextContent(
      "无活跃构建",
    );
  });

  it("瞬态网络故障后自动恢复（reject 2 次 → 成功）", async () => {
    vi.useFakeTimers();
    try {
      mockFetch
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce(
          jsonRes({
            status: "running",
            progress_percent: 0.4,
            run_id: "r1",
          }),
        );
      render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
      // 第 1 次失败
      await act(async () => {});
      // 仍然 pending（初始 state），没有显示错误
      expect(screen.getByTestId("kg-build-progress")).toHaveAttribute(
        "data-kg-status",
        "pending",
      );
      // 推进到第 2 次退避（3s * 1.5^0 = 3s）
      act(() => vi.advanceTimersByTime(4000));
      await act(async () => {});
      // 第 3 次：成功
      act(() => vi.advanceTimersByTime(5000));
      await act(async () => {});
      expect(screen.getByTestId("kg-build-progress")).toHaveAttribute(
        "data-kg-status",
        "running",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("连续失败 10 次后显示 error 状态并停止轮询", async () => {
    vi.useFakeTimers();
    try {
      mockFetch.mockRejectedValue(new TypeError("fetch failed"));
      render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
      // 快速推进，触发 10 次失败
      for (let i = 0; i < 10; i++) {
        await act(async () => {});
        act(() => vi.advanceTimersByTime(15000));
      }
      await act(async () => {});
      expect(screen.getByTestId("kg-build-progress")).toHaveAttribute(
        "data-kg-status",
        "error",
      );
      expect(screen.getByTestId("kg-build-progress")).toHaveTextContent(
        "无法订阅",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("HTTP 非 200 响应计入连续失败", async () => {
    vi.useFakeTimers();
    try {
      mockFetch.mockResolvedValueOnce(
        new Response("bad gateway", { status: 502, statusText: "Bad Gateway" }),
      );
      render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
      await act(async () => {});
      // 1 次非 200 不会显示错误
      expect(screen.getByTestId("kg-build-progress")).toHaveAttribute(
        "data-kg-status",
        "pending",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("组件卸载时取消进行中的 fetch（资源清理）", async () => {
    mockFetch.mockImplementationOnce(async () => {
      // 模拟挂起
      await new Promise(() => {});
      return jsonRes({});
    });
    const { unmount } = render(
      <KgBuildProgressPill corpusId="abc" enqueued={true} />,
    );
    await act(async () => {});
    unmount();
    // fetch 应收到 signal
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("终态后通过 onTerminal 通知父组件（解耦 POST 在飞状态）", async () => {
    vi.useFakeTimers();
    try {
      const onTerminal = vi.fn();
      mockFetch.mockResolvedValueOnce(
        jsonRes({
          status: "completed",
          progress_percent: 1,
          entity_count: 5,
          relation_count: 3,
        }),
      );
      render(
        <KgBuildProgressPill
          corpusId="abc"
          enqueued={true}
          onTerminal={onTerminal}
        />,
      );
      // 让 fetch Promise resolve
      await act(async () => {});
      // 终态收到，但回调延迟触发
      expect(onTerminal).not.toHaveBeenCalled();
      // 推进 4s 后回调应已触发
      act(() => { vi.advanceTimersByTime(4000); });
      expect(onTerminal).toHaveBeenCalledTimes(1);
      expect(onTerminal).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed", entity_count: 5 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("终态延迟回调中卸载组件不会泄漏 timer", async () => {
    vi.useFakeTimers();
    try {
      const onTerminal = vi.fn();
      mockFetch.mockResolvedValueOnce(
        jsonRes({ status: "completed", progress_percent: 1 }),
      );
      const { unmount } = render(
        <KgBuildProgressPill
          corpusId="abc"
          enqueued={true}
          onTerminal={onTerminal}
        />,
      );
      await act(async () => {});
      // 终态延迟窗口内卸载：timer 应被清理，回调不应再触发
      unmount();
      act(() => { vi.advanceTimersByTime(4000); });
      expect(onTerminal).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
