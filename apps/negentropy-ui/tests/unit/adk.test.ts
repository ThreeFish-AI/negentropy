import { EventType } from "@ag-ui/core";
import {
  AdkMessageStreamNormalizer,
  adkEventToAguiEvents,
  adkEventsToMessages,
  aguiEventsToMessages,
} from "../../lib/adk";

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
      .map((event) => String(event.messageId));
    expect(textStartIds).toEqual(["chunk-1", "chunk-2"]);
    expect(events.some((event) => event.type === EventType.TOOL_CALL_START)).toBe(true);
  });
});
