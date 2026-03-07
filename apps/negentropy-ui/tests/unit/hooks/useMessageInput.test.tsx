import { renderHook, act } from "@testing-library/react";
import { EventType } from "@ag-ui/core";
import { vi } from "vitest";

import { useMessageInput } from "@/hooks/useMessageInput";

vi.mock("@ag-ui/client", () => ({
  randomUUID: () => "run-1",
}));

describe("useMessageInput", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("crypto", { randomUUID: () => "message-1" });
  });

  it("sendInput 会执行乐观更新并触发 runAgent", async () => {
    const agent = {
      addMessage: vi.fn(),
      runAgent: vi.fn().mockResolvedValue(undefined),
    };
    const setRawEvents = vi.fn((updater) => updater([]));
    const setOptimisticMessages = vi.fn((updater) => updater([]));
    const setInputValue = vi.fn();
    const setConnection = vi.fn();
    const onUpdateSessionTime = vi.fn();
    const onLoadSessions = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useMessageInput({
        agent: agent as never,
        sessionId: "s1",
        connection: "idle",
        pendingConfirmations: 0,
        resolvedThreadId: "thread-1",
        setRawEvents,
        setOptimisticMessages,
        setInputValue,
        setConnection,
        onUpdateSessionTime,
        onLoadSessions,
        inputValue: " hello ",
      }),
    );

    await act(async () => {
      await result.current.sendInput();
    });

    expect(setOptimisticMessages).toHaveBeenCalled();
    expect(setRawEvents).toHaveBeenCalled();
    const optimisticEvents = setRawEvents.mock.calls[0][0]([]);
    expect(optimisticEvents.map((event: { type: string }) => event.type)).toEqual([
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_END,
    ]);
    expect(agent.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "message-1", content: "hello", role: "user" }),
    );
    expect(setInputValue).toHaveBeenCalledWith("");
    expect(onUpdateSessionTime).toHaveBeenCalledWith("s1");
    expect(setConnection).toHaveBeenCalledWith("connecting");
    expect(agent.runAgent).toHaveBeenCalledWith({ runId: "run-1" });
    expect(onLoadSessions).toHaveBeenCalled();
  });

  it("连接中或存在待确认时不会发送消息", async () => {
    const agent = {
      addMessage: vi.fn(),
      runAgent: vi.fn(),
    };

    const { result } = renderHook(() =>
      useMessageInput({
        agent: agent as never,
        sessionId: "s1",
        connection: "streaming",
        pendingConfirmations: 1,
        resolvedThreadId: "thread-1",
        setRawEvents: vi.fn(),
        setOptimisticMessages: vi.fn(),
        setInputValue: vi.fn(),
        setConnection: vi.fn(),
        inputValue: "hello",
      }),
    );

    await act(async () => {
      await result.current.sendInput();
    });

    expect(agent.addMessage).not.toHaveBeenCalled();
    expect(agent.runAgent).not.toHaveBeenCalled();
  });

  it("runAgent 失败时会设置错误状态并记录日志", async () => {
    const onAddLog = vi.fn();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const agent = {
      addMessage: vi.fn(),
      runAgent: vi.fn().mockRejectedValue(new Error("boom")),
    };
    const setConnection = vi.fn();

    const { result } = renderHook(() =>
      useMessageInput({
        agent: agent as never,
        sessionId: "s1",
        connection: "idle",
        pendingConfirmations: 0,
        resolvedThreadId: "thread-1",
        setRawEvents: vi.fn((updater) => updater([])),
        setOptimisticMessages: vi.fn((updater) => updater([])),
        setInputValue: vi.fn(),
        setConnection,
        onAddLog,
        inputValue: "hello",
      }),
    );

    await act(async () => {
      await result.current.sendInput();
    });

    expect(setConnection).toHaveBeenLastCalledWith("error");
    expect(onAddLog).toHaveBeenCalledWith(
      "error",
      "run_agent_failed",
      expect.objectContaining({ message: expect.stringContaining("boom") }),
    );
    warnSpy.mockRestore();
  });
});
