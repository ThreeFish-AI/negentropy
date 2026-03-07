import { renderHook, act, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { useSessionManager } from "@/hooks/useSessionManager";

vi.mock("@/lib/adk", () => ({
  adkEventToAguiEvents: vi.fn(() => []),
  adkEventsToMessages: vi.fn(() => [{ id: "m1", role: "assistant", content: "hello" }]),
  adkEventsToSnapshot: vi.fn(() => ({ ready: true })),
}));

describe("useSessionManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loadSessions 会按更新时间倒序写入会话列表", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "s1", lastUpdateTime: 100, state: { metadata: { title: "Older" } } },
        { id: "s2", lastUpdateTime: 200, state: { metadata: { title: "Newest" } } },
      ],
    } as Response);

    const { result } = renderHook(() =>
      useSessionManager({ userId: "u1", appName: "negentropy" }),
    );

    await act(async () => {
      await result.current.loadSessions();
    });

    expect(result.current.sessions.map((item) => item.id)).toEqual(["s2", "s1"]);
    expect(result.current.sessions[0]?.label).toBe("Newest");
  });

  it("startNewSession 在成功后创建并回调新会话", async () => {
    const onSessionLoaded = vi.fn();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "s-new", lastUpdateTime: 300 }),
      status: 200,
    } as Response);

    const { result } = renderHook(() =>
      useSessionManager({ userId: "u1", appName: "negentropy", onSessionLoaded }),
    );

    await act(async () => {
      await result.current.startNewSession();
    });

    expect(result.current.sessions[0]?.id).toBe("s-new");
    expect(onSessionLoaded).toHaveBeenCalledWith("s-new");
  });

  it("loadSessionDetail 会把消息和快照注入 agent", async () => {
    const agent = {
      setMessages: vi.fn(),
      setState: vi.fn(),
    };
    const addLog = vi.fn();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ events: [{ type: "noop" }] }),
    } as Response);

    const { result } = renderHook(() =>
      useSessionManager({
        userId: "u1",
        appName: "negentropy",
        agent: agent as never,
        addLog,
      }),
    );

    await act(async () => {
      await result.current.loadSessionDetail("s1");
    });

    expect(result.current.loadedSessionId).toBe("s1");
    expect(agent.setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ content: "hello" })]),
    );
    expect(agent.setState).toHaveBeenCalledWith({ ready: true });
    expect(addLog).toHaveBeenCalledWith(
      "info",
      "session_detail_loaded",
      expect.objectContaining({ sessionId: "s1", messageCount: 1 }),
    );
  });

  it("loadSessions 失败时会记录错误并设置连接状态", async () => {
    const setConnectionWithMetrics = vi.fn();
    const addLog = vi.fn();
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderHook(() =>
      useSessionManager({
        userId: "u1",
        appName: "negentropy",
        setConnectionWithMetrics,
        addLog,
      }),
    );

    await act(async () => {
      await result.current.loadSessions();
    });

    expect(setConnectionWithMetrics).toHaveBeenCalledWith("error");
    expect(addLog).toHaveBeenCalledWith(
      "error",
      "load_sessions_failed",
      expect.objectContaining({ message: expect.stringContaining("network down") }),
    );
    warnSpy.mockRestore();
  });
});
