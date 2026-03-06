import { describe, expect, it } from "vitest";
import { EventType, type BaseEvent, type Message } from "@ag-ui/core";
import { buildConversationTree } from "@/utils/conversation-tree";

describe("buildConversationTree", () => {
  it("将文本、工具和结果构造成父子树", () => {
    const events: BaseEvent[] = [
      {
        type: EventType.RUN_STARTED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "msg-1",
        role: "assistant",
        timestamp: 1001,
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "msg-1",
        delta: "你好",
        timestamp: 1002,
      } as BaseEvent,
      {
        type: EventType.TOOL_CALL_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "msg-1",
        toolCallId: "tool-1",
        toolCallName: "search",
        timestamp: 1003,
      } as BaseEvent,
      {
        type: EventType.TOOL_CALL_ARGS,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "msg-1",
        toolCallId: "tool-1",
        delta: "{\"q\":\"hello\"}",
        timestamp: 1004,
      } as BaseEvent,
      {
        type: EventType.TOOL_CALL_RESULT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "msg-1",
        toolCallId: "tool-1",
        content: "{\"items\":1}",
        timestamp: 1005,
      } as BaseEvent,
    ];

    const tree = buildConversationTree({ events });
    expect(tree.roots).toHaveLength(1);
    const turn = tree.roots[0];
    expect(turn.type).toBe("turn");
    expect(turn.children[0].type).toBe("text");
    expect(turn.children[0].children[0].type).toBe("tool-call");
    expect(turn.children[0].children[0].children[0].type).toBe("tool-result");
  });

  it("在没有事件时用 fallback message 建树", () => {
    const fallbackMessages: Message[] = [
      {
        id: "msg-user",
        role: "user",
        content: "hello",
        createdAt: new Date(1000 * 1000),
      } as Message,
    ];

    const tree = buildConversationTree({ events: [], fallbackMessages });
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].type).toBe("text");
    expect(tree.roots[0].payload.content).toBe("hello");
  });
});
