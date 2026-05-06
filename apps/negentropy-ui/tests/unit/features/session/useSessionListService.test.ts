import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionListService } from "@/features/session/hooks/useSessionListService";

// next/navigation：在 hooks-only 测试环境（无 App Router 包裹）下 stub 出
// useRouter / usePathname / useSearchParams，让 useSessionListService 内部
// 的 URL 同步 (ISSUE-061 v2-D) 不会因 Provider 缺失而崩溃。
// ``urlState.current`` 模拟当前 URL 的 ?... 部分，``routerReplace`` 解析
// 新 URL 写入 urlState.current 并通过 React state 触发组件重渲染（让
// useSearchParams 的下一次返回值反映变更）。
const { routerReplace, urlState, setRenderTick } = vi.hoisted(() => {
  const state = { current: "" };
  const subscribers = new Set<() => void>();
  return {
    urlState: state,
    setRenderTick: subscribers,
    routerReplace: vi.fn((target: string) => {
      const queryIdx = target.indexOf("?");
      state.current = queryIdx >= 0 ? target.slice(queryIdx + 1) : "";
      subscribers.forEach((cb) => cb());
    }),
  };
});
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
    usePathname: () => "/",
    useSearchParams: () => {
      // 通过 useSyncExternalStore 把 urlState 转成响应式订阅，让
      // routerReplace 后下一次 render 拿到新 searchParams。
      const snapshot = useSyncExternalStore(
        (cb: () => void) => {
          setRenderTick.add(cb);
          return () => setRenderTick.delete(cb);
        },
        () => urlState.current,
        () => urlState.current,
      );
      return new URLSearchParams(snapshot);
    },
  };
});

describe("useSessionListService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    routerReplace.mockClear();
    urlState.current = "";
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

  // ============================================================================
  // ISSUE-061 v2-D：sessionListView 同步到 URL ?view=archived
  // ============================================================================
  it("ISSUE-061：setSessionListView('archived') 通过 router.replace 写入 ?view=archived", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
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

    expect(result.current.sessionListView).toBe("active");

    act(() => {
      result.current.setSessionListView("archived");
    });

    expect(routerReplace).toHaveBeenLastCalledWith(
      "/?view=archived",
      expect.objectContaining({ scroll: false }),
    );
    await waitFor(() => {
      expect(result.current.sessionListView).toBe("archived");
    });
  });

  it("ISSUE-061：setSessionListView('active') 删除 ?view=，URL 回到 /", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    urlState.current = "view=archived";
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

    expect(result.current.sessionListView).toBe("archived");

    act(() => {
      result.current.setSessionListView("active");
    });

    expect(routerReplace).toHaveBeenLastCalledWith(
      "/",
      expect.objectContaining({ scroll: false }),
    );
    await waitFor(() => {
      expect(result.current.sessionListView).toBe("active");
    });
  });
});
