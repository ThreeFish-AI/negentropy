/**
 * KgBuildProgressPill 单元测试（P3-1 G1c）
 *
 * 验证：
 * - enqueued=false 或 corpusId=null 时返回 null（零回归）；
 * - 订阅 SSE 后渲染百分比 + 状态标签；
 * - 收到 terminal 状态后自动 close EventSource；
 * - onerror 时显示 error 状态。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { KgBuildProgressPill } from "@/components/ui/KgBuildProgressPill";

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  withCredentials: boolean;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onopen: ((e: Event) => void) | null = null;
  closed = false;

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  send(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
  fail() {
    this.onerror?.(new Event("error"));
  }
}

describe("KgBuildProgressPill", () => {
  let originalES: typeof EventSource;

  beforeEach(() => {
    MockEventSource.instances = [];
    originalES = global.EventSource;
    // @ts-expect-error - assign mock in test env
    global.EventSource = MockEventSource;
  });

  afterEach(() => {
    global.EventSource = originalES;
    vi.restoreAllMocks();
  });

  it("enqueued=false 时返回 null（零回归保护）", () => {
    const { container } = render(<KgBuildProgressPill corpusId="c-123" enqueued={false} />);
    expect(container).toBeEmptyDOMElement();
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("corpusId 缺失时不订阅", () => {
    render(<KgBuildProgressPill corpusId={null} enqueued={true} />);
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("enqueued=true 时订阅 SSE 并渲染初始 pending 状态", () => {
    render(<KgBuildProgressPill corpusId="abc-123" enqueued={true} />);
    const pill = screen.getByTestId("kg-build-progress");
    expect(pill).toHaveAttribute("data-kg-status", "pending");
    expect(pill).toHaveTextContent("排队中");
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain("/api/knowledge/base/abc-123/graph/build-runs/latest/progress");
    expect(MockEventSource.instances[0].withCredentials).toBe(true);
  });

  it("收到 running 事件后展示百分比 + 实体/关系数", () => {
    render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
    const es = MockEventSource.instances[0];
    act(() => {
      es.send({ status: "running", progress_percent: 0.62, entity_count: 12, relation_count: 7, run_id: "r1" });
    });
    const pill = screen.getByTestId("kg-build-progress");
    expect(pill).toHaveAttribute("data-kg-status", "running");
    expect(pill).toHaveTextContent("62%");
    expect(pill).toHaveTextContent("12 实体");
    expect(pill).toHaveTextContent("7 关系");
    expect(es.closed).toBe(false);
  });

  it("收到 completed 终态后自动关闭 EventSource", () => {
    render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
    const es = MockEventSource.instances[0];
    act(() => {
      es.send({ status: "completed", progress_percent: 1, entity_count: 20, relation_count: 15 });
    });
    expect(screen.getByTestId("kg-build-progress")).toHaveAttribute("data-kg-status", "completed");
    expect(es.closed).toBe(true);
  });

  it("收到 failed 终态展示 error_message", () => {
    render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
    const es = MockEventSource.instances[0];
    act(() => {
      es.send({ status: "failed", error_message: "LLM extractor timeout", progress_percent: 0.3 });
    });
    expect(screen.getByTestId("kg-build-progress")).toHaveTextContent("LLM extractor timeout");
    expect(es.closed).toBe(true);
  });

  it("idle 状态（无 active run）→ 展示无活跃构建文案", () => {
    render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
    const es = MockEventSource.instances[0];
    act(() => {
      es.send({ status: "idle" });
    });
    expect(screen.getByTestId("kg-build-progress")).toHaveTextContent("无活跃构建");
    expect(es.closed).toBe(true);
  });

  it("EventSource onerror 时显示 error 状态并关闭", () => {
    render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
    const es = MockEventSource.instances[0];
    act(() => {
      es.fail();
    });
    expect(screen.getByTestId("kg-build-progress")).toHaveAttribute("data-kg-status", "error");
    expect(es.closed).toBe(true);
  });

  it("非法 JSON event 应 fail-soft 不抛", () => {
    render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
    const es = MockEventSource.instances[0];
    expect(() =>
      act(() => {
        es.onmessage?.({ data: "not json {" } as MessageEvent);
      }),
    ).not.toThrow();
  });

  it("组件卸载时关闭 EventSource（资源清理）", () => {
    const { unmount } = render(<KgBuildProgressPill corpusId="abc" enqueued={true} />);
    const es = MockEventSource.instances[0];
    unmount();
    expect(es.closed).toBe(true);
  });

  it("SSE 终态后通过 onTerminal 通知父组件（解耦 POST 在飞状态）", () => {
    // 回归保护评审 #2：旧实现 Pill 挂载与 building (POST 在飞) 强绑定，
    // POST 因 BFF 15min 超时 abort 时 Pill 立即卸载、SSE 关闭。修复后由 SSE 终态
    // 通过 onTerminal 回调驱动父组件解除挂载，与 POST 解耦。
    vi.useFakeTimers();
    try {
      const onTerminal = vi.fn();
      render(
        <KgBuildProgressPill corpusId="abc" enqueued={true} onTerminal={onTerminal} />,
      );
      const es = MockEventSource.instances[0];
      act(() => {
        es.send({ status: "completed", progress_percent: 1, entity_count: 5, relation_count: 3 });
      });
      // 终态收到后立刻关闭 SSE，但回调延迟触发以保留终态展示窗口
      expect(es.closed).toBe(true);
      expect(onTerminal).not.toHaveBeenCalled();
      // 推进 4s 后回调应已触发，参数为 SSE 收到的最后一个 payload
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(onTerminal).toHaveBeenCalledTimes(1);
      expect(onTerminal).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed", entity_count: 5 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("终态延迟回调中卸载组件不会泄漏 timer", () => {
    vi.useFakeTimers();
    try {
      const onTerminal = vi.fn();
      const { unmount } = render(
        <KgBuildProgressPill corpusId="abc" enqueued={true} onTerminal={onTerminal} />,
      );
      const es = MockEventSource.instances[0];
      act(() => {
        es.send({ status: "completed", progress_percent: 1 });
      });
      // 终态延迟窗口内卸载：timer 应被清理，回调不应再触发
      unmount();
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(onTerminal).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
