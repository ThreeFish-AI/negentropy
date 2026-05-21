import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionListService } from "@/features/session/hooks/useSessionListService";

// next/navigation：在 hooks-only 测试环境（无 App Router 包裹）下 stub 出
// usePathname / useSearchParams，让 useSessionListService 内部的 URL 同步
// (ISSUE-061 v2-D) 不会因 Provider 缺失而崩溃。
//
// ISSUE-088：实现已从 router.replace 迁移到 window.history.replaceState。
// jsdom 原生支持 history API 更新 location.search，但不会自动触发 React 订阅。
// 这里通过 useSyncExternalStore + 在 beforeEach 中 patch window.history.replaceState
// 让其在每次写入后通知所有订阅者，复刻 Next.js App Router 中
// useSearchParams 监听 history API 变更的行为。
const { setRenderTick } = vi.hoisted(() => ({
  setRenderTick: new Set<() => void>(),
}));
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    usePathname: () => "/",
    useSearchParams: () => {
      const snapshot = useSyncExternalStore(
        (cb: () => void) => {
          setRenderTick.add(cb);
          return () => setRenderTick.delete(cb);
        },
        () => (typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : ""),
        () => "",
      );
      return new URLSearchParams(snapshot);
    },
  };
});

// 在 mock 安装前抓住 jsdom 原生的 history.replaceState 引用，避免 beforeEach
// 反复抓取时把上一轮的 spy 自身视作 "original"，导致递归调用栈爆炸。
const originalReplaceState = window.history.replaceState.bind(window.history);

describe("useSessionListService", () => {
  let replaceStateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();

    // 重置 jsdom URL 到根（用原生引用，绕开任何残留 spy）。
    originalReplaceState(null, "", "/");
    setRenderTick.clear();

    // 包装 window.history.replaceState：调用真实 API 后通知所有订阅者，
    // 让 useSearchParams 在 setSessionListView 触发后下一次 render 拿到新值。
    replaceStateSpy = vi.fn(
      (state: unknown, unused: string, url?: string | URL | null) => {
        originalReplaceState(state, unused, url);
        setRenderTick.forEach((cb) => cb());
      },
    );
    window.history.replaceState = replaceStateSpy as typeof window.history.replaceState;
  });

  afterEach(() => {
    // 恢复原生 replaceState，避免跨用例污染（一旦上一个用例残留 spy，
    // 下一个 beforeEach 抓到的 "current" 引用就是 spy 自身，会引爆递归）。
    window.history.replaceState = originalReplaceState as typeof window.history.replaceState;
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
  // ISSUE-061 v2-D + ISSUE-088：sessionListView 同步到 URL ?view=archived
  //   并通过 window.history.replaceState 直写，绕开 Next.js 16
  //   router.replace 在同 pathname 仅 query 变更下的 __NA no-op 路径。
  // ============================================================================
  it("ISSUE-088：setSessionListView('archived') 通过 window.history.replaceState 写入 ?view=archived", async () => {
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

    expect(replaceStateSpy).toHaveBeenLastCalledWith(null, "", "/?view=archived");
    expect(window.location.search).toBe("?view=archived");
    await waitFor(() => {
      expect(result.current.sessionListView).toBe("archived");
    });
  });

  // ============================================================================
  // deleteSession：硬删除路径（与 archiveSession 同构，差异在 HTTP method/路径）。
  //
  // 为避免 jsdom + useSyncExternalStore mock 在多次 setState 后反复触发 useEffect
  // 引起 waitFor 超时（mock 内 subscribe 引用每次 render 重建会触发 React 重新订阅
  // 但与本测试目的无关），这里采用「先用 loadSessions mock 喂入两条记录，再切换
  // mock 实现验证 DELETE 行为」的范式，与现有 archiveSession 实现等价覆盖。
  // ============================================================================
  it("deleteSession 通过 POST /sessions/{id}/delete 端点请求上游，body 含 app_name/user_id", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      // 首次：useEffect 触发的 loadSessions，返回空列表。
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)
      // 后续所有调用（deleteSession + 可能的 loadSessions 重触发）统一兜底。
      .mockResolvedValue({
        ok: true,
        json: async () => ({ status: "ok" }),
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

    // 等首次 loadSessions 解决，避免与 delete 调用的 fetch 顺序错位。
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.deleteSession("s-target");
    });

    const deleteCall = fetchSpy.mock.calls.find(
      ([url]) => String(url) === "/api/agui/sessions/s-target/delete",
    );
    expect(deleteCall).toBeDefined();
    const [, calledInit] = deleteCall!;
    expect(calledInit?.method).toBe("POST");
    expect(JSON.parse(String(calledInit?.body))).toEqual({
      app_name: "negentropy",
      user_id: "u1",
    });
  });

  it("deleteSession 成功后从列表中移除目标 session 并切换当前选中", async () => {
    const setSessionId = vi.fn();
    const onClearActiveSession = vi.fn();
    const addLog = vi.fn();

    // 第一次：loadSessions 返回两条；后续 DELETE 返回 ok。
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "s1", lastUpdateTime: 300 },
          { id: "s2", lastUpdateTime: 200 },
        ],
      } as Response)
      .mockResolvedValue({
        ok: true,
        json: async () => ({ status: "ok" }),
      } as Response);

    const { result } = renderHook(() =>
      useSessionListService({
        sessionId: "s1",
        userId: "u1",
        appName: "negentropy",
        setSessionId,
        addLog,
        setConnectionWithMetrics: vi.fn(),
        onClearActiveSession,
      }),
    );

    await waitFor(() => {
      expect(result.current.sessions.map((s) => s.id)).toEqual(["s1", "s2"]);
    });

    await act(async () => {
      await result.current.deleteSession("s1");
    });

    expect(result.current.sessions.map((s) => s.id)).toEqual(["s2"]);
    // 当前 sessionId 被删 → 切到剩余列表头部 + 清理 active view
    expect(setSessionId).toHaveBeenLastCalledWith("s2");
    expect(onClearActiveSession).toHaveBeenCalled();
    expect(addLog).toHaveBeenCalledWith(
      "info",
      "session_deleted",
      expect.objectContaining({ sessionId: "s1" }),
    );
  });

  it("deleteSession 上游失败时记录错误且 sessions 不变", async () => {
    const addLog = vi.fn();

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "s1", lastUpdateTime: 100 },
          { id: "s2", lastUpdateTime: 200 },
        ],
      } as Response)
      .mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: "boom" } }),
      } as Response);

    const { result } = renderHook(() =>
      useSessionListService({
        sessionId: "s2",
        userId: "u1",
        appName: "negentropy",
        setSessionId: vi.fn(),
        addLog,
        setConnectionWithMetrics: vi.fn(),
        onClearActiveSession: vi.fn(),
      }),
    );

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(2);
    });

    await act(async () => {
      await result.current.deleteSession("s1");
    });

    // 列表不变（按 lastUpdateTime 倒序：s2(200) > s1(100)）
    expect(result.current.sessions.map((s) => s.id)).toEqual(["s2", "s1"]);
    expect(addLog).toHaveBeenCalledWith(
      "error",
      "delete_session_failed",
      expect.objectContaining({ sessionId: "s1" }),
    );
  });

  it("ISSUE-088：setSessionListView('active') 删除 ?view=，URL 回到 /", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    // 初始 URL 上有 ?view=archived，模拟用户从归档面板回切到实时面板。
    originalReplaceState(null, "", "/?view=archived");
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

    expect(replaceStateSpy).toHaveBeenLastCalledWith(null, "", "/");
    expect(window.location.search).toBe("");
    await waitFor(() => {
      expect(result.current.sessionListView).toBe("active");
    });
  });
});
