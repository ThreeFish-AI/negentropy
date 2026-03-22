import { describe, expect, it } from "vitest";
import { EventType } from "@ag-ui/core";
import { buildConversationTree } from "@/utils/conversation-tree";
import { buildChatDisplayBlocks } from "@/utils/chat-display";
import { createTestEvent } from "@/tests/helpers/agui";
import type { AgUiEvent } from "@/types/agui";
import type { ConversationTree } from "@/types/a2ui";

describe("buildChatDisplayBlocks", () => {
  it("将正文、工具过程、后续正文投影为同一 assistant 回复内的分段", () => {
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
        delta: "好的，我将使用 Web 搜索获取相关信息。",
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-1",
        toolCallId: "tool-1",
        toolCallName: "google_search",
        timestamp: 1003,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_ARGS,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-1",
        toolCallId: "tool-1",
        delta: "{\"q\":\"AfterShip\"}",
        timestamp: 1004,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_RESULT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-1",
        toolCallId: "tool-1",
        content: "{\"items\":[{\"title\":\"AfterShip\"}]}",
        timestamp: 1005,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-2",
        role: "assistant",
        timestamp: 1006,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-2",
        delta: "## AfterShip 信息摘要",
        timestamp: 1007,
      }),
    ];

    const tree = buildConversationTree({ events });
    const blocks = buildChatDisplayBlocks(tree);

    expect(blocks.map((block) => block.kind)).toEqual(["assistant-reply"]);
    expect(blocks[0]?.kind).toBe("assistant-reply");
    if (blocks[0]?.kind === "assistant-reply") {
      expect(blocks[0].segments.map((segment) => segment.kind)).toEqual([
        "text",
        "tool-group",
        "text",
      ]);
      expect(blocks[0].segments[0]?.kind === "text" ? blocks[0].segments[0].content : "").toContain(
        "Web 搜索",
      );
      expect(
        blocks[0].segments[1]?.kind === "tool-group"
          ? blocks[0].segments[1].tools[0]?.name
          : "",
      ).toBe("Google Search");
      expect(blocks[0].segments[2]?.kind === "text" ? blocks[0].segments[2].content : "").toContain(
        "AfterShip",
      );
    }
  });

  it("将同一锚点下的并行工具合并为单个工具组", () => {
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
        delta: "我将并行搜索两个来源。",
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-1",
        toolCallId: "tool-1",
        toolCallName: "google_search",
        timestamp: 1003,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-1",
        toolCallId: "tool-2",
        toolCallName: "web_search",
        timestamp: 1003.1,
      }),
    ];

    const tree = buildConversationTree({ events });
    const blocks = buildChatDisplayBlocks(tree);
    const reply = blocks.find((block) => block.kind === "assistant-reply");

    expect(reply?.kind).toBe("assistant-reply");
    if (reply?.kind === "assistant-reply") {
      const toolGroup = reply.segments.find((segment) => segment.kind === "tool-group");
      expect(toolGroup?.kind).toBe("tool-group");
      if (toolGroup?.kind === "tool-group") {
        expect(toolGroup.parallel).toBe(true);
        expect(toolGroup.defaultExpanded).toBe(true);
        expect(toolGroup.tools).toHaveLength(2);
      }
    }
  });

  it("工具全部完成后默认折叠", () => {
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
        toolCallName: "google_search",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_RESULT,
        threadId: "thread-1",
        runId: "run-1",
        toolCallId: "tool-1",
        content: "{\"items\":[1]}",
        timestamp: 1002,
      }),
    ];

    const tree = buildConversationTree({ events });
    const blocks = buildChatDisplayBlocks(tree);
    const toolGroup = blocks.find((block) => block.kind === "tool-group");

    expect(toolGroup?.kind).toBe("tool-group");
    if (toolGroup?.kind === "tool-group") {
      expect(toolGroup.defaultExpanded).toBe(false);
      expect(toolGroup.status).toBe("completed");
    }
  });

  it("同时间戳下仍按 sourceOrder 保持正文与工具组的稳定顺序", () => {
    const tree: ConversationTree = {
      roots: [
        {
          id: "turn:1",
          type: "turn",
          parentId: null,
          children: [
            {
              id: "message:b",
              type: "text",
              parentId: "turn:1",
              children: [
                {
                  id: "tool:a",
                  type: "tool-call",
                  parentId: "message:b",
                  children: [],
                  threadId: "thread-1",
                  runId: "run-1",
                  toolCallId: "tool-1",
                  timestamp: 1001,
                  timeRange: { start: 1001, end: 1001 },
                  sourceOrder: 2,
                  title: "google_search",
                  visibility: "chat",
                  isStructural: false,
                  payload: { args: "{\"q\":\"AfterShip\"}", toolCallName: "google_search" },
                  sourceEventTypes: ["tool_call_start"],
                  relatedMessageIds: ["msg-1"],
                },
                {
                  id: "message:a",
                  type: "text",
                  parentId: "message:b",
                  children: [],
                  threadId: "thread-1",
                  runId: "run-1",
                  messageId: "msg-2",
                  timestamp: 1001,
                  timeRange: { start: 1001, end: 1001 },
                  sourceOrder: 3,
                  title: "助手消息",
                  role: "assistant",
                  visibility: "chat",
                  isStructural: false,
                  payload: { content: "## AfterShip 信息摘要", streaming: false },
                  sourceEventTypes: ["text_message_start", "text_message_end"],
                  relatedMessageIds: ["msg-2"],
                },
              ],
              threadId: "thread-1",
              runId: "run-1",
              messageId: "msg-1",
              timestamp: 1001,
              timeRange: { start: 1001, end: 1001 },
              sourceOrder: 1,
              title: "助手消息",
              role: "assistant",
              visibility: "chat",
              isStructural: false,
              payload: { content: "好的，我将使用 Web 搜索获取相关信息。", streaming: false },
              sourceEventTypes: ["text_message_start", "text_message_end"],
              relatedMessageIds: ["msg-1"],
            },
          ],
          threadId: "thread-1",
          runId: "run-1",
          timestamp: 1000,
          timeRange: { start: 1000, end: 1001 },
          sourceOrder: 0,
          title: "轮次 run-1",
          visibility: "chat",
          isStructural: false,
          payload: {},
          sourceEventTypes: ["run_started"],
          relatedMessageIds: [],
        },
      ],
      nodeIndex: new Map(),
      messageNodeIndex: new Map(),
      toolNodeIndex: new Map(),
    };

    const blocks = buildChatDisplayBlocks(tree);

    expect(blocks.map((block) => block.id)).toEqual([
      "assistant-reply:turn:1:msg-1",
    ]);
    expect(blocks[0]?.kind).toBe("assistant-reply");
    if (blocks[0]?.kind === "assistant-reply") {
      expect(blocks[0].segments.map((segment) => segment.kind)).toEqual([
        "text",
        "tool-group",
        "text",
      ]);
      expect(
        blocks[0].segments[1]?.kind === "tool-group"
          ? blocks[0].segments[1].id
          : "",
      ).toBe("tool-group:msg-1:tool-1");
    }
  });

  it("非关键 error 节点不产生 error display block", () => {
    const tree: ConversationTree = {
      roots: [
        {
          id: "turn:1",
          type: "turn",
          parentId: null,
          children: [
            {
              id: "message:1",
              type: "text",
              parentId: "turn:1",
              children: [],
              threadId: "thread-1",
              runId: "run-1",
              messageId: "msg-1",
              timestamp: 1001,
              timeRange: { start: 1001, end: 1001 },
              sourceOrder: 1,
              title: "助手消息",
              role: "assistant",
              visibility: "chat",
              isStructural: false,
              payload: { content: "回答内容", streaming: false },
              sourceEventTypes: ["text_message_start", "text_message_end"],
              relatedMessageIds: ["msg-1"],
            },
            {
              id: "error:1",
              type: "error",
              parentId: "turn:1",
              children: [],
              threadId: "thread-1",
              runId: "run-1",
              timestamp: 1002,
              timeRange: { start: 1002, end: 1002 },
              sourceOrder: 2,
              title: "运行错误",
              status: "error",
              visibility: "chat",
              isStructural: false,
              payload: {
                message:
                  "litellm.APIError: Error building chunks for logging/streaming usage calculation",
                code: "",
              },
              sourceEventTypes: ["run_error"],
              relatedMessageIds: [],
            },
          ],
          threadId: "thread-1",
          runId: "run-1",
          timestamp: 1000,
          timeRange: { start: 1000, end: 1002 },
          sourceOrder: 0,
          title: "轮次 run-1",
          visibility: "chat",
          isStructural: false,
          payload: {},
          sourceEventTypes: ["run_started"],
          relatedMessageIds: [],
        },
      ],
      nodeIndex: new Map(),
      messageNodeIndex: new Map(),
      toolNodeIndex: new Map(),
    };

    const blocks = buildChatDisplayBlocks(tree);
    const errorBlocks = blocks.filter((block) => block.kind === "error");
    expect(errorBlocks).toHaveLength(0);
    expect(blocks.some((block) => block.kind === "assistant-reply")).toBe(true);
  });

  it("工具失败时显示失败摘要并默认展开", () => {
    const tree: ConversationTree = {
      roots: [
        {
          id: "tool:error",
          type: "tool-call",
          parentId: null,
          children: [
            {
              id: "tool-result:error",
              type: "tool-result",
              parentId: "tool:error",
              children: [],
              threadId: "thread-1",
              runId: "run-1",
              toolCallId: "tool-1",
              timestamp: 1002,
              timeRange: { start: 1002, end: 1002 },
              sourceOrder: 2,
              title: "工具结果",
              status: "error",
              visibility: "chat",
              isStructural: false,
              payload: { content: "{\"error\":\"boom\"}" },
              sourceEventTypes: ["tool_call_result"],
              relatedMessageIds: [],
            },
          ],
          threadId: "thread-1",
          runId: "run-1",
          toolCallId: "tool-1",
          timestamp: 1001,
          timeRange: { start: 1001, end: 1002 },
          sourceOrder: 1,
          title: "google_search",
          status: "error",
          visibility: "chat",
          isStructural: false,
          payload: { args: "{\"q\":\"AfterShip\"}", toolCallName: "google_search" },
          sourceEventTypes: ["tool_call_start", "tool_call_result"],
          relatedMessageIds: [],
        },
      ],
      nodeIndex: new Map(),
      messageNodeIndex: new Map(),
      toolNodeIndex: new Map(),
    };

    const blocks = buildChatDisplayBlocks(tree);
    const toolGroup = blocks.find((block) => block.kind === "tool-group");

    expect(toolGroup?.kind).toBe("tool-group");
    if (toolGroup?.kind === "tool-group") {
      expect(toolGroup.summary).toBe("执行失败，1 个工具");
      expect(toolGroup.defaultExpanded).toBe(true);
      expect(toolGroup.status).toBe("error");
    }
  });
});
