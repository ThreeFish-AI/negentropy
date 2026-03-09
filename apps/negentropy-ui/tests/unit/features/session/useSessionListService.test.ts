import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionListService } from "@/features/session/hooks/useSessionListService";

describe("useSessionListService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("loadSessions 会按更新时间倒序写入列表并补全 active session", async () => {
    const setSessionId = vi.fn();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "s1", lastUpdateTime: 100, state: { metadata: { title: "Older" } } },
        { id: "s2", lastUpdateTime: 200, state: { metadata: { title: "Newest" } } },
      ],
    } as Response);

    const { result } = renderHook(() =>
      useSessionListService({
        sessionId: null,
        userId: "u1",
        appName: "negentropy",
        setSessionId,
        addLog: vi.fn(),
        setConnectionWithMetrics: vi.fn(),
        onClearActiveSession: vi.fn(),
      }),
    );

    await waitFor(() => {
      expect(result.current.sessions.map((item) => item.id)).toEqual(["s2", "s1"]);
    });
    expect(setSessionId).toHaveBeenCalledWith("s2");
    expect(result.current.activeSession).toBeNull();
  });

  it("startNewSession 会创建会话并切换当前 session", async () => {
    const setSessionId = vi.fn();
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "s-new", lastUpdateTime: 300 }),
      status: 200,
    } as Response);

    const { result } = renderHook(() =>
      useSessionListService({
        sessionId: null,
        userId: "u1",
        appName: "negentropy",
        setSessionId,
        addLog: vi.fn(),
        setConnectionWithMetrics: vi.fn(),
        onClearActiveSession: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.startNewSession();
    });

    expect(result.current.sessions[0]?.id).toBe("s-new");
    expect(setSessionId).toHaveBeenLastCalledWith("s-new");
  });

  it("切换 sessionListView 会带上 archived 参数重新拉取列表", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    const { result } = renderHook(() =>
      useSessionListService({
        sessionId: null,
        userId: "u1",
        appName: "negentropy",
        setSessionId: vi.fn(),
        addLog: vi.fn(),
        setConnectionWithMetrics: vi.fn(),
        onClearActiveSession: vi.fn(),
      }),
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("archived=false"),
      );
    });

    act(() => {
      result.current.setSessionListView("archived");
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("archived=true"),
      );
    });
  });

  it("loadSessions 失败时会记录错误并设置连接状态", async () => {
    const setConnectionWithMetrics = vi.fn();
    const addLog = vi.fn();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));

    renderHook(() =>
      useSessionListService({
        sessionId: null,
        userId: "u1",
        appName: "negentropy",
        setSessionId: vi.fn(),
        addLog,
        setConnectionWithMetrics,
        onClearActiveSession: vi.fn(),
      }),
    );

    await waitFor(() => {
      expect(setConnectionWithMetrics).toHaveBeenCalledWith("error");
    });
    expect(addLog).toHaveBeenCalledWith(
      "error",
      "load_sessions_failed",
      expect.objectContaining({ message: expect.stringContaining("network down") }),
    );
    warnSpy.mockRestore();
  });
});
