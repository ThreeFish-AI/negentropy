import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventType } from "@ag-ui/core";
import { useAgentSubscription } from "@/hooks/useAgentSubscription";

describe("useAgentSubscription", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("会订阅 agent 事件并在关键生命周期回调中推进连接状态", () => {
    let handlers:
      | Parameters<
          Parameters<typeof useAgentSubscription>[0]["agent"]["subscribe"]
        >[0]
      | undefined;

    const unsubscribe = vi.fn();
    const agent = {
      subscribe: vi.fn((nextHandlers) => {
        handlers = nextHandlers;
        return { unsubscribe };
      }),
    };
    const onConnectionChange = vi.fn();
    const onRawEvent = vi.fn();
    const onUpdateSessionTime = vi.fn();

    const { unmount } = renderHook(() =>
      useAgentSubscription({
        agent,
        sessionId: "s1",
        onConnectionChange,
        onRawEvent,
        onUpdateSessionTime,
      }),
    );

    act(() => {
      handlers?.onRunInitialized?.();
      handlers?.onRunStartedEvent?.();
      handlers?.onEvent?.({
        event: {
          type: EventType.TEXT_MESSAGE_CONTENT,
        } as never,
      });
      handlers?.onRunFinishedEvent?.();
    });

    expect(onConnectionChange).toHaveBeenNthCalledWith(1, "connecting");
    expect(onConnectionChange).toHaveBeenNthCalledWith(2, "streaming");
    expect(onConnectionChange).toHaveBeenNthCalledWith(3, "idle");
    expect(onRawEvent).toHaveBeenCalledTimes(1);
    expect(onUpdateSessionTime).toHaveBeenCalledWith("s1");

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
