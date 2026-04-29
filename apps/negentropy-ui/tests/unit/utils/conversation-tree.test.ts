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

  it("fallback assistant 最终快照命中实时流节点时会把节点收敛为完成态", () => {
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
    ];
    const fallbackMessages: AgUiMessage[] = [
      createTestMessage({
        id: "assistant-final",
        role: "assistant",
        content: "我可以帮助你规划任务、分析代码并直接修改实现。",
        createdAt: new Date(1003 * 1000),
        runId: "run-1",
        threadId: "thread-1",
        streaming: false,
      }),
    ];

    const tree = buildConversationTree({ events, fallbackMessages });
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].children.filter((child) => child.type === "text")).toHaveLength(1);
    expect(tree.roots[0].children[0]?.payload.content).toBe(
      "我可以帮助你规划任务、分析代码并直接修改实现。",
    );
    expect(tree.roots[0].children[0]?.payload.streaming).toBe(false);
    expect(tree.roots[0].children[0]?.relatedMessageIds).toEqual(
      expect.arrayContaining(["assistant-live", "assistant-final"]),
    );
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

  it("hydrated 文本事件 messageId 不同且节点已收尾时复用同一节点不重复成段", () => {
    // 长耗时回复在 ledger 去重失败的极端情况下：realtime 节点已 closed
    // (streaming=false)，hydrated TEXT_MESSAGE_* 跨越 8s 窗到达且 messageId
    // 不同。期望 findMatchingTextNodeId 通过严格内容相等命中并复用，避免在
    // turn 下挂出第二个 type=text 子节点。
    const fullContent = "Pong:\n\n- 已收到回执\n- 后续步骤";
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
        messageId: "assistant-live-a1",
        role: "assistant",
        timestamp: 1000.5,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-live-a1",
        delta: fullContent,
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-live-a1",
        timestamp: 1002,
      }),
      // 模拟 hydration 终态事件被错误保留（不同 messageId、跨越 15 秒），
      // 不传 messageLedger，让 buildMessageLedger 自建后形成两条 entry。
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-final-f",
        role: "assistant",
        timestamp: 1015,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-final-f",
        delta: fullContent,
        timestamp: 1015.5,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-final-f",
        timestamp: 1017,
      }),
      createTestEvent({
        type: EventType.RUN_FINISHED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1018,
      }),
    ];

    const tree = buildConversationTree({ events });
    expect(tree.roots).toHaveLength(1);
    const textChildren = tree.roots[0].children.filter(
      (child) => child.type === "text",
    );
    expect(textChildren).toHaveLength(1);
    expect(textChildren[0]?.payload.streaming).toBe(false);
    expect(textChildren[0]?.payload.content).toBe(fullContent);
    expect(textChildren[0]?.relatedMessageIds).toEqual(
      expect.arrayContaining(["assistant-live-a1", "assistant-final-f"]),
    );
  });

  it("技术节点会按真实时序保留在主消息之间，而不是被类型排序打乱", () => {
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
        delta: "先分析问题",
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.ACTIVITY_SNAPSHOT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-1",
        activityType: "research",
        content: "running",
        timestamp: 1003,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-2",
        role: "assistant",
        timestamp: 1004,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-2",
        delta: "再给出结论",
        timestamp: 1005,
      }),
    ];

    const tree = buildConversationTree({ events });
    const rootChildren = tree.roots[0].children;

    expect(rootChildren.map((child) => child.type)).toEqual(["text", "text"]);
    expect(rootChildren[0]?.children[0]?.type).toBe("activity");
    expect(rootChildren[0]?.payload.content).toBe("先分析问题");
    expect(rootChildren[1]?.payload.content).toBe("再给出结论");
  });

  it("带技术子节点的前一段 assistant 文本不会与后一段答复错误收敛", () => {
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
        delta: "先查询资料",
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-live",
        toolCallId: "tool-1",
        toolCallName: "search",
        timestamp: 1003,
      }),
    ];
    const fallbackMessages: AgUiMessage[] = [
      createTestMessage({
        id: "assistant-final",
        role: "assistant",
        content: "查询完成，给出结论。",
        createdAt: new Date(1004 * 1000),
        runId: "run-1",
        threadId: "thread-1",
        streaming: false,
      }),
    ];

    const tree = buildConversationTree({ events, fallbackMessages });
    const textChildren = tree.roots[0].children.filter((child) => child.type === "text");

    expect(textChildren).toHaveLength(2);
    expect(textChildren[0]?.payload.content).toBe("先查询资料");
    expect(textChildren[1]?.payload.content).toBe("查询完成，给出结论。");
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

  it("非关键 RUN_ERROR（litellm logging）不创建 error 节点", () => {
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
        delta: "回答内容",
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.RUN_ERROR,
        threadId: "thread-1",
        runId: "run-1",
        message:
          "litellm.APIError: Error building chunks for logging/streaming usage calculation",
        timestamp: 1003,
      }),
    ];

    const tree = buildConversationTree({ events });
    expect(tree.roots).toHaveLength(1);
    const turn = tree.roots[0];
    const errorChildren = turn.children.filter((child) => child.type === "error");
    expect(errorChildren).toHaveLength(0);
    const textChildren = turn.children.filter((child) => child.type === "text");
    expect(textChildren).toHaveLength(1);
    expect(textChildren[0]?.payload.content).toBe("回答内容");
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

  // ISSUE-040 H3：fallback 段创建的消息节点 sourceOrder 应来自 ledger（即对应
  // ledger 条目的 sourceOrder），而非每次按 events.length + fallbackIndex 重算。
  // 通过让「snapshot 数组顺序」与「ledger 时间序」错位，迫使两套公式给出不同
  // 的 sourceOrder，从而真正回归保护 H3 修复（旧实现按 fallbackIndex 重算会与
  // ledger 错位，跨链路排序漂移）。
  it("fallback 阶段重建节点的 sourceOrder 来自 ledger 而非按 fallbackIndex 重算", () => {
    // 关键：snapshot.messages 数组顺序 [msg-late, msg-early]
    //   → message-ledger 第二轮 snapshot loop 按数组顺序赋 sourceOrder：
    //     msg-late = orderedEvents.length + 0 = 3
    //     msg-early = orderedEvents.length + 1 = 4
    //   → ledger 按 createdAt 排序后回到 [msg-early, msg-late]
    //   → conversation-tree fallback 路径 mergedFallbackMessages 顺序也是
    //     [msg-early, msg-late]（因 effectiveMessageLedger 已按时间排序）
    //
    //   旧实现（按 fallbackIndex 重算）：
    //     msg-early node = orderedEvents.length + 0 = 3
    //     msg-late  node = orderedEvents.length + 1 = 4
    //
    //   新实现（复用 ledger.sourceOrder）：
    //     msg-early node = 4（来自 snapshot 数组次位）
    //     msg-late  node = 3（来自 snapshot 数组首位）
    //
    //   两个公式产出的具体数值在两条消息之间是「互换」的，可作为强差异断言。
    const events: AgUiEvent[] = [
      createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 900,
      }),
      createTestEvent({
        type: EventType.MESSAGES_SNAPSHOT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "snapshot-1",
        timestamp: 1000,
        messages: [
          {
            id: "msg-late",
            role: "user",
            content: "Late message",
            threadId: "thread-1",
            runId: "run-1",
            createdAt: "2026-04-29T00:00:02.000Z",
          },
          {
            id: "msg-early",
            role: "user",
            content: "Early message",
            threadId: "thread-1",
            runId: "run-1",
            createdAt: "2026-04-29T00:00:01.000Z",
          },
        ],
      }),
      createTestEvent({
        type: EventType.RUN_FINISHED,
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1100,
      }),
    ];

    const tree = buildConversationTree({ events });

    const allNodes = tree.roots.flatMap((turn) => turn.children);
    const nodeLate = allNodes.find((n) => n.messageId === "msg-late");
    const nodeEarly = allNodes.find((n) => n.messageId === "msg-early");
    expect(nodeLate).toBeTruthy();
    expect(nodeEarly).toBeTruthy();

    // 关键断言：sourceOrder 必须与「snapshot 数组中的位置」一致（来自 ledger），
    // 而不是「mergedFallbackMessages 中的位置」（即旧 fallbackIndex 重算结果）。
    expect(nodeLate!.sourceOrder).toBe(3);
    expect(nodeEarly!.sourceOrder).toBe(4);

    // 反向核验：旧实现下 nodeEarly.sourceOrder == 3，nodeLate.sourceOrder == 4，
    // 与 ledger sourceOrder 错位。当前断言可有效拦截退化。
    expect(nodeEarly!.sourceOrder).not.toBe(3);
    expect(nodeLate!.sourceOrder).not.toBe(4);
  });
});
