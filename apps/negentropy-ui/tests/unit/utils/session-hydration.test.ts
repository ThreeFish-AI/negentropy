import { describe, expect, it } from "vitest";
import { EventType } from "@ag-ui/core";
import {
  deriveConnectionState,
  deriveRunStates,
  hydrateSessionDetail,
  mergeEvents,
} from "@/utils/session-hydration";
import { createTestEvent } from "@/tests/helpers/agui";
import type { AgUiEvent } from "@/types/agui";

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
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_START,
        threadId: "session-1",
        runId: "run-1",
        toolCallId: "tool-1",
        toolCallName: "ui.confirmation",
        timestamp: 1001,
      }),
    ];

    const states = deriveRunStates(events);
    expect(states[0]?.status).toBe("blocked");
    expect(deriveConnectionState(events)).toBe("blocked");
  });

  it("合并历史事件时保留实时唯一事件而不重复", () => {
    const realtime: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-1",
        delta: "hello",
        timestamp: 1001,
      }),
    ];

    const historical: AgUiEvent[] = [
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "session-1",
        runId: "run-1",
        messageId: "msg-1",
        delta: "hello",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.RUN_FINISHED,
        threadId: "session-1",
        runId: "run-1",
        timestamp: 1002,
      }),
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

  it("历史事件中混入坏 payload 时只保留合法项继续 hydration", () => {
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

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]?.content).toBe("hello");
  });

  it("将仅通过 protocol author 表达的历史用户消息保留到 message ledger", () => {
    const result = hydrateSessionDetail(
      [
        {
          id: "user-msg",
          runId: "run-1",
          threadId: "session-1",
          timestamp: 1000,
          author: "user",
          content: { parts: [{ text: "Hi" }] },
        },
        {
          id: "assistant-msg",
          runId: "run-1",
          threadId: "session-1",
          timestamp: 1001,
          author: "assistant",
          content: { parts: [{ text: "Hello there" }] },
        },
      ],
      "session-1",
    );

    expect(result.messageLedger).toHaveLength(2);
    expect(result.messageLedger[0]).toMatchObject({
      id: "user-msg",
      resolvedRole: "user",
      content: "Hi",
    });
    expect(result.messageLedger[1]).toMatchObject({
      id: "assistant-msg",
      resolvedRole: "assistant",
      content: "Hello there",
    });
    expect(result.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
  });
});
