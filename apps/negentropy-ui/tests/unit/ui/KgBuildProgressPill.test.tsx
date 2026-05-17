/**
 * KgBuildProgressPill 单元测试（P3-1 G1c）
 *
 * 验证：
 * - enqueued=false 或 corpusId=null 时返回 null（零回归）；
 * - 轮询 REST 端点后渲染百分比 + 状态标签；
 * - 收到 terminal 状态后自动停止轮询；
 * - 网络瞬态故障通过指数退避自动恢复；
 * - 连续失败 10 次后显示 error 状态；
 * - 发现期使用 only_active=true 规避 enqueue 写入竞态（与 SSE 端点 grace 等价）；
 * - 已锁定 run_id 后切到不带 only_active；超 grace 窗口后亦切换；
 * - 已锁定 run_id 收到新 run_id 的终态时正确收口，不死循环。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { KgBuildProgressPill } from "@/components/ui/KgBuildProgressPill";

// 允许尾随 query string（发现期会附加 ?only_active=true）
const POLL_URL_RE = /\/api\/knowledge\/base\/[^/]+\/graph\/build-runs\/latest(\?[^#]*)?$/;

// 与组件内 POLL_INTERVAL_MS 保持一致；测试用例中使用而避免硬编码魔法数字。
// （DISCOVERY_GRACE_MS 在测试中通过“逐轮推进 N 次 > 10s / POLL_INTERVAL”表达，
//  不直接耦合常量值，避免组件内 grace 调整时测试失败。）
const POLL_INTERVAL_MS_VALUE = 3000;

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

  // ──────────────────────────────────────────────────────────────────
  // 发现期 grace（与 SSE 端点 no_active_grace_seconds=10 等价）回归覆盖
  // 防止 enqueue_kg_build fire-and-forget 写入 build_run 行前误读历史 run。
  // ──────────────────────────────────────────────────────────────────

  it("发现期内首轮使用 only_active=true 查询", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonRes({ status: "pending", corpus_id: "abc" }),
    );
    render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
    await act(async () => {});
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toMatch(/only_active=true/);
    // 后端在 only_active=true 下回 pending 不应被当作终态
    expect(screen.getByTestId("kg-build-progress")).toHaveAttribute(
      "data-kg-status",
      "pending",
    );
  });

  it("锁定 run_id 后切到不带 only_active 的查询", async () => {
    vi.useFakeTimers();
    try {
      mockFetch
        .mockResolvedValueOnce(
          jsonRes({ status: "running", progress_percent: 0.2, run_id: "r1" }),
        )
        .mockResolvedValueOnce(
          jsonRes({ status: "running", progress_percent: 0.5, run_id: "r1" }),
        );
      render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
      // 首轮：发现期 only_active=true
      await act(async () => {});
      expect(mockFetch.mock.calls[0][0]).toMatch(/only_active=true/);
      // 推进 3s 触发下一轮：已锁定 run_id，不应再带 only_active
      act(() => vi.advanceTimersByTime(POLL_INTERVAL_MS_VALUE + 50));
      await act(async () => {});
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1][0]).not.toMatch(/only_active=true/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("超出发现期 grace 窗口后切到不带 only_active", async () => {
    vi.useFakeTimers();
    try {
      // 持续返回不带 run_id 的 pending：模拟新 run 行迟迟未落库
      mockFetch.mockResolvedValue(jsonRes({ status: "pending" }));
      render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
      await act(async () => {});
      expect(mockFetch.mock.calls[0][0]).toMatch(/only_active=true/);
      // 逐轮推进：每轮 POLL_INTERVAL_MS=3s 间隔一次 fetch；
      // 跨过 DISCOVERY_GRACE_MS=10s 至少需要 4 轮（t=3,6,9,12s），此处推进 5 轮以保险。
      for (let i = 0; i < 5; i++) {
        act(() => vi.advanceTimersByTime(POLL_INTERVAL_MS_VALUE + 50));
        await act(async () => {});
      }
      // 最后一次 fetch 调用必然在 t≈15s+，发现期已过 → URL 不再带 only_active
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0];
      expect(lastCall).not.toMatch(/only_active=true/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("已锁定 run_id 收到新 run_id 的终态时正确收口（不死循环）", async () => {
    vi.useFakeTimers();
    try {
      const onTerminal = vi.fn();
      mockFetch
        // 首轮：锁定 run_id=A 的 running
        .mockResolvedValueOnce(
          jsonRes({ status: "running", progress_percent: 0.3, run_id: "A" }),
        )
        // 次轮：返回完全不同 run_id=B 且已是终态（极端竞态：A 结束 → B 极速失败）
        .mockResolvedValueOnce(
          jsonRes({
            status: "failed",
            error_message: "extractor crashed",
            run_id: "B",
          }),
        );
      render(
        <KgBuildProgressPill
          corpusId="abc"
          enqueued={true}
          onTerminal={onTerminal}
        />,
      );
      // 首轮：锁定 A
      await act(async () => {});
      expect(screen.getByTestId("kg-build-progress")).toHaveAttribute(
        "data-kg-status",
        "running",
      );
      // 次轮：B 终态 → 必须 stop，不能继续轮询
      act(() => vi.advanceTimersByTime(POLL_INTERVAL_MS_VALUE + 50));
      await act(async () => {});
      expect(screen.getByTestId("kg-build-progress")).toHaveAttribute(
        "data-kg-status",
        "failed",
      );
      expect(screen.getByTestId("kg-build-progress")).toHaveTextContent(
        "extractor crashed",
      );
      // 推进 onTerminal 延迟窗口 + 远超下一轮间隔：fetch 不应被再次调用
      act(() => vi.advanceTimersByTime(15000));
      await act(async () => {});
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(onTerminal).toHaveBeenCalledTimes(1);
      expect(onTerminal).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed", run_id: "B" }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  // ----- Layout 契约：保护 compact 变体的两种 spacing 配方，禁止互相回退 -----
  // 背景：KgBuildProgressPill 同时被 ToolExecutionGroup（块级堆叠场景，需 mt-2 py-2）
  // 与 Knowledge Graph Toolbar（行内并排，需去 mt-2、py-1 与按钮组对齐基线）使用。
  // 由于 lib/utils.ts 的 cn 仅做字符串拼接（无 tailwind-merge），不能依赖叠加覆盖；
  // 组件内部以互斥分支输出 className，本组用例锁定该契约，防止后续误改回退。
  it("默认 compact=false 时保留 mt-2 py-2（保护 ToolExecutionGroup 堆叠场景）", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonRes({ status: "running", progress_percent: 0.5 }),
    );
    render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
    await act(async () => {});
    const pill = screen.getByTestId("kg-build-progress");
    expect(pill).toHaveClass("mt-2");
    expect(pill).toHaveClass("py-2");
    expect(pill).not.toHaveClass("py-1");
  });

  it("compact=true 时去除 mt-2 并用 py-1（Toolbar 内与按钮组水平对齐）", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonRes({ status: "running", progress_percent: 0.5 }),
    );
    render(<KgBuildProgressPill corpusId="abc" enqueued={true} compact />);
    await act(async () => {});
    const pill = screen.getByTestId("kg-build-progress");
    expect(pill).not.toHaveClass("mt-2");
    expect(pill).toHaveClass("py-1");
    expect(pill).not.toHaveClass("py-2");
  });
});
