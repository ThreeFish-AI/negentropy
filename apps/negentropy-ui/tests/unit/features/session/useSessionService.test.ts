import { act, renderHook, waitFor } from "@testing-library/react";
import { EventType } from "@ag-ui/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestEvent } from "@/tests/helpers/agui";
import { useSessionService } from "@/features/session/hooks/useSessionService";

type DeferredResponse = {
  promise: Promise<Response>;
  resolve: (value: Response) => void;
};

function createDeferredResponse(): DeferredResponse {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

function createDetailResponse(events: unknown[]): Response {
  return {
    ok: true,
    json: async () => ({ events }),
  } as Response;
}

describe("useSessionService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("loadSessionDetail 会拉取 detail 并更新 session projection", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      createDetailResponse([
        {
          id: "msg-1",
          runId: "s1",
          threadId: "s1",
          timestamp: 1000,
          message: { role: "user", content: "Hi" },
        },
        {
          id: "msg-2",
          runId: "s1",
          threadId: "s1",
          timestamp: 1001,
          message: { role: "assistant", content: "Hello" },
        },
      ]),
    );

    const { result } = renderHook(() =>
      useSessionService({
        sessionId: "s1",
        selectedNodeId: null,
        userId: "u1",
        appName: "negentropy",
        addLog: vi.fn(),
        setConnectionWithMetrics: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.loadSessionDetail("s1");
    });

    await waitFor(() => {
      expect(result.current.sessionProjection.loadedSessionId).toBe("s1");
      expect(result.current.confirmedMessageLedger).toHaveLength(2);
    });
    expect(result.current.messagesForRenderBase.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
  });

  it("loadSessionDetail 会丢弃落后的旧请求响应", async () => {
    const first = createDeferredResponse();
    const second = createDeferredResponse();
    vi.spyOn(global, "fetch")
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const { result } = renderHook(() =>
      useSessionService({
        sessionId: "s1",
        selectedNodeId: null,
        userId: "u1",
        appName: "negentropy",
        addLog: vi.fn(),
        setConnectionWithMetrics: vi.fn(),
      }),
    );

    const firstLoad = result.current.loadSessionDetail("s1");
    const secondLoad = result.current.loadSessionDetail("s1");

    await act(async () => {
      second.resolve(
        createDetailResponse([
          {
            id: "msg-new",
            runId: "s1",
            threadId: "s1",
            timestamp: 1001,
            message: { role: "assistant", content: "new" },
          },
        ]),
      );
      await secondLoad;
    });

    await act(async () => {
      first.resolve(
        createDetailResponse([
          {
            id: "msg-old",
            runId: "s1",
            threadId: "s1",
            timestamp: 1000,
            message: { role: "assistant", content: "old" },
          },
        ]),
      );
      await firstLoad;
    });

    await waitFor(() => {
      expect(result.current.confirmedMessageLedger).toHaveLength(1);
    });
    expect(result.current.confirmedMessageLedger[0]?.content).toBe("new");
  });

  it("session 切换后会丢弃旧 session 的 detail 响应", async () => {
    const deferred = createDeferredResponse();
    vi.spyOn(global, "fetch").mockImplementationOnce(() => deferred.promise);

    const { result, rerender } = renderHook(
      ({ sessionId }) =>
        useSessionService({
          sessionId,
          selectedNodeId: null,
          userId: "u1",
          appName: "negentropy",
          addLog: vi.fn(),
          setConnectionWithMetrics: vi.fn(),
        }),
      {
        initialProps: { sessionId: "s1" as string | null },
      },
    );

    const pendingLoad = result.current.loadSessionDetail("s1");

    rerender({ sessionId: "s2" });

    await act(async () => {
      deferred.resolve(
        createDetailResponse([
          {
            id: "msg-s1",
            runId: "s1",
            threadId: "s1",
            timestamp: 1000,
            message: { role: "assistant", content: "stale" },
          },
        ]),
      );
      await pendingLoad;
    });

    await waitFor(() => {
      expect(result.current.sessionProjection.loadedSessionId).toBeNull();
    });
    expect(result.current.confirmedMessageLedger).toHaveLength(0);
  });

  it("scheduleSessionHydration 在无实时输出时使用完整 delay 队列", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      createDetailResponse([]),
    );

    const { result } = renderHook(() =>
      useSessionService({
        sessionId: "s1",
        selectedNodeId: null,
        userId: "u1",
        appName: "negentropy",
        addLog: vi.fn(),
        setConnectionWithMetrics: vi.fn(),
      }),
    );

    act(() => {
      result.current.scheduleSessionHydration("s1");
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("scheduleSessionHydration 在已有实时 assistant 输出时使用短队列", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      createDetailResponse([]),
    );

    const { result } = renderHook(() =>
      useSessionService({
        sessionId: "s1",
        selectedNodeId: null,
        userId: "u1",
        appName: "negentropy",
        addLog: vi.fn(),
        setConnectionWithMetrics: vi.fn(),
      }),
    );

    act(() => {
      result.current.appendRealtimeEvent(
        createTestEvent({
          type: EventType.TEXT_MESSAGE_CONTENT,
          threadId: "s1",
          runId: "run-1",
          messageId: "msg-1",
          delta: "assistant live output",
          timestamp: 1000,
        }),
      );
    });

    expect(result.current.rawEvents).toHaveLength(1);

    act(() => {
      result.current.scheduleSessionHydration("s1");
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("loadSessionDetail 失败时会记录错误并设置连接状态", async () => {
    const setConnectionWithMetrics = vi.fn();
    const addLog = vi.fn();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("detail failed"));

    const { result } = renderHook(() =>
      useSessionService({
        sessionId: "s1",
        selectedNodeId: null,
        userId: "u1",
        appName: "negentropy",
        addLog,
        setConnectionWithMetrics,
      }),
    );

    await act(async () => {
      await result.current.loadSessionDetail("s1");
    });

    expect(setConnectionWithMetrics).toHaveBeenCalledWith("error");
    expect(addLog).toHaveBeenCalledWith(
      "error",
      "load_session_detail_failed",
      expect.objectContaining({ message: expect.stringContaining("detail failed") }),
    );
    warnSpy.mockRestore();
  });
});
