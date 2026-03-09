import { EventType } from "@ag-ui/core";
import {
  AdkMessageStreamNormalizer,
  adkEventToAguiEvents,
  adkEventsToMessages,
  aguiEventsToMessages,
  collectAdkEventPayloads,
  parseAdkEventPayload,
  safeParseAdkEventPayload,
} from "../../lib/adk";
import { getEventMessageId, getMessageStreaming, type AgUiEvent } from "../../types/agui";

describe("adk event mapping", () => {
  it("maps text parts to AG-UI text events", () => {
    const payload = {
      id: "evt_1",
      author: "user",
      content: {
        parts: [{ text: "hello" }, { text: " world" }],
      },
    };
    const events = adkEventToAguiEvents(payload);
    const types = events.map((event) => event.type);
    expect(types).toEqual([
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_END,
    ]);
  });

  it("extracts text from message.content array", () => {
    const payload = {
      id: "evt_2",
      author: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "ok" }],
      },
    };
    const events = adkEventToAguiEvents(payload);
    expect(events.find((event) => event.type === EventType.TEXT_MESSAGE_CONTENT)).toBeTruthy();
  });

  it("ignores empty state/artifact deltas", () => {
    const payload = {
      id: "evt_3",
      author: "assistant",
      actions: {
        stateDelta: {},
        artifactDelta: {},
      },
    };
    const events = adkEventToAguiEvents(payload);
    expect(events.some((event) => event.type === EventType.STATE_DELTA)).toBe(false);
    expect(events.some((event) => event.type === EventType.ACTIVITY_SNAPSHOT)).toBe(false);
  });

  it("maps ADK events to messages", () => {
    const payloads = [
      {
        id: "evt_4",
        author: "user",
        content: { parts: [{ text: "ping" }] },
      },
      {
        id: "evt_5",
        author: "assistant",
        content: { parts: [{ text: "pong" }] },
      },
    ];
    const messages = adkEventsToMessages(payloads);
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe("ping");
    expect(messages[1].content).toBe("pong");
  });

  it("将仅通过 protocol author 标记的历史用户消息解析为 user", () => {
    const payload = {
      id: "evt-author-user",
      runId: "run-1",
      threadId: "thread-1",
      author: "user",
      content: { parts: [{ text: "Hi" }] },
      timestamp: 1000,
    };

    const events = adkEventToAguiEvents(payload);
    const startEvent = events.find(
      (event) => event.type === EventType.TEXT_MESSAGE_START,
    );

    expect(startEvent).toMatchObject({
      type: EventType.TEXT_MESSAGE_START,
      role: "user",
    });

    const messages = adkEventsToMessages([payload]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      role: "user",
      content: "Hi",
    });
  });

  it("groups assistant text chunks with changing payload ids into one AG-UI message lifecycle", () => {
    const normalizer = new AdkMessageStreamNormalizer();
    const events = [
      ...normalizer.consume({
        id: "chunk-1",
        runId: "run-1",
        threadId: "thread-1",
        author: "assistant",
        content: { parts: [{ text: "你" }] },
        timestamp: 1000,
      }),
      ...normalizer.consume({
        id: "chunk-2",
        runId: "run-1",
        threadId: "thread-1",
        author: "assistant",
        content: { parts: [{ text: "好" }] },
        timestamp: 1001,
      }),
      ...normalizer.flushRun("run-1", "thread-1", 1002),
    ];

    expect(events.map((event) => event.type)).toEqual([
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_END,
    ]);

    const messageIds = events
      .filter((event) => "messageId" in event)
      .map((event) => String(event.messageId));
    expect(new Set(messageIds)).toEqual(new Set(["chunk-1"]));

    const messages = aguiEventsToMessages(events);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("你好");
    expect(getMessageStreaming(messages[0])).toBe(false);
  });

  it("treats snapshot-style repeated content as one growing assistant message", () => {
    const messages = aguiEventsToMessages([
      {
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-1",
        role: "assistant",
        timestamp: 1000,
      },
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-1",
        delta: "Hel",
        timestamp: 1001,
      },
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-1",
        delta: "Hello",
        timestamp: 1002,
      },
      {
        type: EventType.TEXT_MESSAGE_END,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-1",
        timestamp: 1003,
      },
    ] as AgUiEvent[]);

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Hello");
  });

  it("flushes assistant text before tool calls and starts a new segment after tool results", () => {
    const normalizer = new AdkMessageStreamNormalizer();
    const events = [
      ...normalizer.consume({
        id: "chunk-1",
        runId: "run-1",
        threadId: "thread-1",
        author: "assistant",
        content: { parts: [{ text: "先查询" }] },
        timestamp: 1000,
      }),
      ...normalizer.consume({
        id: "tool-1",
        runId: "run-1",
        threadId: "thread-1",
        author: "assistant",
        content: {
          parts: [
            {
              functionCall: {
                id: "call-1",
                name: "search",
                args: { q: "hello" },
              },
            },
          ],
        },
        timestamp: 1001,
      }),
      ...normalizer.consume({
        id: "chunk-2",
        runId: "run-1",
        threadId: "thread-1",
        author: "assistant",
        content: { parts: [{ text: "查询完成" }] },
        timestamp: 1002,
      }),
      ...normalizer.flushRun("run-1", "thread-1", 1003),
    ];

    const textStartIds = events
      .filter((event) => event.type === EventType.TEXT_MESSAGE_START)
      .map((event) => String(getEventMessageId(event)));
    expect(textStartIds).toEqual(["chunk-1", "chunk-2"]);
    expect(events.some((event) => event.type === EventType.TOOL_CALL_START)).toBe(true);
  });

  it("parses valid ADK event payloads through the shared validator", () => {
    const payload = parseAdkEventPayload({
      id: "evt_6",
      author: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "ok" }],
      },
    });

    expect(payload.id).toBe("evt_6");
    expect(payload.message?.role).toBe("assistant");
  });

  it("rejects malformed ADK event payloads", () => {
    const result = safeParseAdkEventPayload({
      author: "assistant",
      message: {
        role: "assistant",
        content: "ok",
      },
    });

    expect(result.success).toBe(false);
  });

  it("collects valid ADK payloads and drops invalid entries", () => {
    const result = collectAdkEventPayloads([
      {
        id: "evt_7",
        author: "assistant",
        content: { parts: [{ text: "ok" }] },
      },
      {
        author: "assistant",
      },
    ]);

    expect(result.payloads).toHaveLength(1);
    expect(result.invalidCount).toBe(1);
  });
});
