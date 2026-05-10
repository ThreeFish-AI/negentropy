/**
 * 反向回滚单测 — stale agent guard（ISSUE-NEW）
 *
 * 验证：当 agent.threadId !== sessionId（router.replace 尚未 flush）时，
 * sendInput 必须走 pending 路径而非直接调用 runAgent。
 *
 * 反向回滚：删除 home-body.tsx 中的 `agent.threadId != null && agent.threadId !== sessionId`
 * guard 后，此测试应该失败（runAgent 会被错误调用）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeBody, type HomeBodyAgent } from "@/app/home-body";

vi.mock("@copilotkitnext/react", () => ({
  CopilotKitProvider: ({ children }: { children: React.ReactNode }) => children,
  UseAgentUpdate: {
    OnMessagesChanged: "OnMessagesChanged",
    OnStateChanged: "OnStateChanged",
  },
  useAgent: () => ({ agent: null }),
  useHumanInTheLoop: () => {},
}));

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: null, status: "authenticated" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// 不需要 fetch mock — 测试只验证 runAgent 不被调用
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => [],
  }) as unknown as Response));
});

describe("stale agent guard (ISSUE-NEW)", () => {
  it("when agent.threadId !== sessionId, sendInput must NOT call runAgent", async () => {
    const user = userEvent.setup();
    const runAgent = vi.fn().mockResolvedValue({ result: "ok" });

    // 模拟 stale agent：threadId = "old-session" 但当前 sessionId = "new-session"
    const staleAgent = {
      threadId: "old-session-id",
      isRunning: false,
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
      addMessage: vi.fn(),
      runAgent,
      forwardedProps: {},
    } as unknown as HomeBodyAgent;

    const pendingSendRef = { current: null as string | null };
    const pendingForSessionRef = { current: null as string | null };

    render(
      <HomeBody
        agent={staleAgent}
        sessionId="new-session-id"
        userId="test-user"
        setSessionId={vi.fn()}
        pendingSendRef={pendingSendRef}
        pendingForSessionRef={pendingForSessionRef}
      />,
    );

    // 等 initial render 完成
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/输入/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/输入/i);
    await user.type(textarea, "test message");
    await user.click(screen.getByRole("button", { name: /send/i }));

    // 核心断言：runAgent 不应被调用（消息走了 pending 路径）
    expect(runAgent).not.toHaveBeenCalled();

    // pending ref 应该被设置（消息被缓存等待 agent 重建后自动发送）
    expect(pendingSendRef.current).toBe("test message");
    expect(pendingForSessionRef.current).toBe("new-session-id");
  });

  it("when agent.threadId === sessionId, sendInput should call runAgent normally", async () => {
    const user = userEvent.setup();
    const runAgent = vi.fn().mockResolvedValue({ result: "ok" });

    const freshAgent = {
      threadId: "current-session",
      isRunning: false,
      subscribe: vi.fn(() => ({
        unsubscribe: vi.fn(),
      })),
      addMessage: vi.fn(),
      runAgent,
      forwardedProps: {},
    } as unknown as HomeBodyAgent;

    const pendingSendRef = { current: null as string | null };
    const pendingForSessionRef = { current: null as string | null };

    render(
      <HomeBody
        agent={freshAgent}
        sessionId="current-session"
        userId="test-user"
        setSessionId={vi.fn()}
        pendingSendRef={pendingSendRef}
        pendingForSessionRef={pendingForSessionRef}
      />,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/输入/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/输入/i);
    await user.type(textarea, "hello world");
    await user.click(screen.getByRole("button", { name: /send/i }));

    // 正常路径：runAgent 应该被调用
    expect(runAgent).toHaveBeenCalledTimes(1);
  });
});
