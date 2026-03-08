import { describe, expect, it } from "vitest";
import { EventType } from "@ag-ui/core";
import { buildConversationTree } from "@/utils/conversation-tree";
import { createTestEvent, createTestMessage } from "@/tests/helpers/agui";
import type { AgUiEvent, AgUiMessage } from "@/types/agui";

describe("buildConversationTree", () => {
  it("将文本、工具和结果构造成父子树", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "msg-1",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "msg-1",
        delta: "你好",
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "msg-1",
        toolCallId: "tool-1",
        toolCallName: "search",
        timestamp: 1003,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_ARGS,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "msg-1",
        toolCallId: "tool-1",
        delta: "{\"q\":\"hello\"}",
        timestamp: 1004,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_RESULT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "msg-1",
        toolCallId: "tool-1",
        content: "{\"items\":1}",
        timestamp: 1005,
      }),
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
    const fallbackMessages: AgUiMessage[] = [
      createTestMessage({
        id: "msg-user",
        role: "user",
        content: "hello",
        createdAt: new Date(1000 * 1000),
      }),
    ];

    const tree = buildConversationTree({ events: [], fallbackMessages });
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].type).toBe("text");
    expect(tree.roots[0].payload.content).toBe("hello");
  });

  it("忽略结构性 link 事件并把 fallback 用户消息挂到当前轮次顶部", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "default",
        messageId: "msg-1",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "default",
        messageId: "msg-1",
        delta: "结果",
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.CUSTOM,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1003,
        eventType: "ne.a2ui.link",
        data: { childId: "message:msg-1", parentId: "turn:run-1" },
      }),
    ];
    const fallbackMessages: AgUiMessage[] = [
      createTestMessage({
        id: "msg-user",
        role: "user",
        content: "hello",
        createdAt: new Date(999 * 1000),
      }),
    ];

    const tree = buildConversationTree({ events, fallbackMessages });
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].type).toBe("turn");
    expect(tree.roots[0].children.map((child) => child.type)).toEqual(["text", "text"]);
    expect(tree.roots[0].children[0].role).toBe("user");
    expect(tree.roots[0].children[1].role).toBe("assistant");
    expect(
      tree.roots[0].children.some(
        (child) =>
          child.type === "custom" &&
          String(child.payload.eventType || "") === "ne.a2ui.link",
      ),
    ).toBe(false);
  });

  it("裁剪无内容的空文本节点", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "msg-1",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "msg-1",
        timestamp: 1002,
      }),
    ];

    const tree = buildConversationTree({ events });
    expect(tree.roots).toHaveLength(0);
  });

  it("按 fallback 消息原始顺序稳定保留连续用户消息", () => {
    const fallbackMessages: AgUiMessage[] = [
      createTestMessage({
        id: "msg-1",
        role: "user",
        content: "Hello",
        createdAt: new Date(1000 * 1000),
      }),
      createTestMessage({
        id: "msg-2",
        role: "user",
        content: "Hi",
        createdAt: new Date(1000 * 1000 + 1),
      }),
    ];

    const tree = buildConversationTree({ events: [], fallbackMessages });
    expect(tree.roots).toHaveLength(2);
    expect(tree.roots[0].payload.content).toBe("Hello");
    expect(tree.roots[1].payload.content).toBe("Hi");
  });

  it("在同轮次下按 sourceOrder 保持连续用户消息顺序", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
      }),
    ];
    const fallbackMessages: AgUiMessage[] = [
      createTestMessage({
        id: "msg-b",
        role: "user",
        content: "first",
        createdAt: new Date(1000 * 1000),
      }),
      createTestMessage({
        id: "msg-a",
        role: "user",
        content: "second",
        createdAt: new Date(1000 * 1000),
      }),
    ];

    const tree = buildConversationTree({ events, fallbackMessages });
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].children[0].payload.content).toBe("first");
    expect(tree.roots[0].children[1].payload.content).toBe("second");
  });

  it("无 runId 的 fallback 用户消息不会错误挂到最近轮次", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "thread-1",
        runId: "run-hi",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-hi",
        messageId: "assistant-hi",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-hi",
        messageId: "assistant-hi",
        delta: "Hi",
        timestamp: 1002,
      }),
    ];
    const fallbackMessages: AgUiMessage[] = [
      createTestMessage({
        id: "local-hello",
        role: "user",
        content: "Hello",
        createdAt: new Date(1003 * 1000),
      }),
    ];

    const tree = buildConversationTree({ events, fallbackMessages });

    expect(tree.roots).toHaveLength(2);
    expect(tree.roots[0].type).toBe("turn");
    expect(tree.roots[1].type).toBe("text");
    expect(tree.roots[1].payload.content).toBe("Hello");
  });

  it("fallback assistant 快照命中已有事件节点时不重复新增 bubble", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-stream",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-stream",
        delta: "Hello",
        timestamp: 1002,
      }),
    ];
    const fallbackMessages: AgUiMessage[] = [
      createTestMessage({
        id: "assistant-history",
        role: "assistant",
        content: "Hello",
        createdAt: new Date(1002 * 1000),
        runId: "run-1",
        threadId: "thread-1",
      }),
    ];

    const tree = buildConversationTree({ events, fallbackMessages });
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].children.filter((child) => child.type === "text")).toHaveLength(1);
  });

  it("同一轮次中不同 messageId 的 assistant 最终快照会收敛到同一个节点", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-live",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-live",
        delta: "我可以帮助你规划任务",
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-final",
        delta: "我可以帮助你规划任务、分析代码并执行修改。",
        timestamp: 1003,
      }),
    ];

    const tree = buildConversationTree({ events });
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].children.filter((child) => child.type === "text")).toHaveLength(1);
    expect(tree.roots[0].children[0].payload.content).toBe(
      "我可以帮助你规划任务、分析代码并执行修改。",
    );
    expect(tree.roots[0].children[0].relatedMessageIds).toEqual(
      expect.arrayContaining(["assistant-live", "assistant-final"]),
    );
  });

  it("将运行错误节点保留在主聊天区", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.RUN_ERROR,
        threadId: "thread-1",
        runId: "run-1",
        message: "failed",
        code: "UPSTREAM_ERROR",
        timestamp: 1001,
      }),
    ];

    const tree = buildConversationTree({ events });
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].children[0].type).toBe("error");
    expect(tree.roots[0].children[0].visibility).toBe("chat");
  });

  it("confirmation 工具在运行结束后仍保持 blocked 状态", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_START,
        threadId: "thread-1",
        runId: "run-1",
        toolCallId: "tool-1",
        toolCallName: "ui.confirmation",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.RUN_FINISHED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1002,
      }),
    ];

    const tree = buildConversationTree({ events });
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].status).toBe("blocked");
  });

  it("文本消息在 TEXT_MESSAGE_END 后保留累计内容", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-1",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-1",
        delta: "world",
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-1",
        timestamp: 1003,
      }),
    ];

    const tree = buildConversationTree({ events });
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].children).toHaveLength(1);
    expect(tree.roots[0].children[0].payload.content).toBe("world");
  });

  it("工具参数在 TOOL_CALL_END 后保留累计内容", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_START,
        threadId: "thread-1",
        runId: "run-1",
        toolCallId: "tool-1",
        toolCallName: "search",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_ARGS,
        threadId: "thread-1",
        runId: "run-1",
        toolCallId: "tool-1",
        delta: "{\"q\":\"hello\"}",
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_END,
        threadId: "thread-1",
        runId: "run-1",
        toolCallId: "tool-1",
        timestamp: 1003,
      }),
    ];

    const tree = buildConversationTree({ events });
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].children).toHaveLength(1);
    expect(tree.roots[0].children[0].payload.args).toBe("{\"q\":\"hello\"}");
  });

  it("优先使用 messages snapshot 纠正历史用户消息角色", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "msg-user",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "msg-user",
        delta: "Hi",
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.MESSAGES_SNAPSHOT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "snapshot-1",
        timestamp: 1003,
        messages: [
          {
            id: "msg-user",
            role: "user",
            content: "Hi",
            threadId: "thread-1",
            runId: "run-1",
            createdAt: "1970-01-01T00:16:41.000Z",
          },
        ],
      }),
    ];

    const tree = buildConversationTree({ events });

    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].children).toHaveLength(1);
    expect(tree.roots[0].children[0].type).toBe("text");
    expect(tree.roots[0].children[0].role).toBe("user");
    expect(tree.roots[0].children[0].title).toBe("用户消息");
  });

  it("messages snapshot 可补入缺失的历史用户消息", () => {
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
      }),
      createTestEvent({
        type: EventType.MESSAGES_SNAPSHOT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "snapshot-1",
        timestamp: 1001,
        messages: [
          {
            id: "msg-user",
            role: "user",
            content: "Need help",
            threadId: "thread-1",
            runId: "run-1",
            createdAt: "1970-01-01T00:16:41.000Z",
          },
        ],
      }),
    ];

    const tree = buildConversationTree({ events });

    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].children).toHaveLength(1);
    expect(tree.roots[0].children[0].payload.content).toBe("Need help");
    expect(tree.roots[0].children[0].role).toBe("user");
  });
});
