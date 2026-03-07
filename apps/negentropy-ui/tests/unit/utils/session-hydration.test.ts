import { describe, expect, it } from "vitest";
import { EventType, type BaseEvent } from "@ag-ui/core";
import {
  deriveConnectionState,
  deriveRunStates,
  hydrateSessionDetail,
  mergeEvents,
} from "@/utils/session-hydration";

describe("session-hydration", () => {
  it("为历史回放补齐缺失的运行生命周期事件", () => {
    const result = hydrateSessionDetail(
      [
        {
          id: "msg-1",
          runId: "run-1",
          threadId: "session-1",
          timestamp: 1000,
          message: { role: "assistant", content: "hello" },
        },
      ],
      "session-1",
    );

    expect(result.events[0].type).toBe(EventType.RUN_STARTED);
    expect(result.events[result.events.length - 1].type).toBe(EventType.RUN_FINISHED);
  });

  it("将 confirmation 工具轮次派生为 blocked", () => {
    const events: BaseEvent[] = [
      {
        type: EventType.RUN_STARTED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1000,
      } as BaseEvent,
      {
        type: EventType.TOOL_CALL_START,
        threadId: "session-1",
        runId: "run-1",
        toolCallId: "tool-1",
        toolCallName: "ui.confirmation",
        timestamp: 1001,
      } as BaseEvent,
    ];

    const states = deriveRunStates(events);
    expect(states[0]?.status).toBe("blocked");
    expect(deriveConnectionState(events)).toBe("blocked");
  });

  it("合并历史事件时保留实时唯一事件而不重复", () => {
    const realtime: BaseEvent[] = [
      {
        type: EventType.RUN_STARTED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-1",
        delta: "hello",
        timestamp: 1001,
      } as BaseEvent,
    ];

    const historical: BaseEvent[] = [
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-1",
        delta: "hello",
        timestamp: 1001,
      } as BaseEvent,
      {
        type: EventType.RUN_FINISHED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1002,
      } as BaseEvent,
    ];

    const merged = mergeEvents(realtime, historical);
    expect(
      merged.filter(
        (event) =>
          event.type === EventType.TEXT_MESSAGE_CONTENT &&
          "messageId" in event &&
          event.messageId === "msg-1",
      ),
    ).toHaveLength(1);
    expect(merged[merged.length - 1].type).toBe(EventType.RUN_FINISHED);
  });
});
