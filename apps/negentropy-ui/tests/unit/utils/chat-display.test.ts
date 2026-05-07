import { describe, expect, it } from "vitest";
import { EventType } from "@ag-ui/core";
import { buildConversationTree } from "@/utils/conversation-tree";
import {
  buildChatDisplayBlocks,
  isStreamingDuplicateOfAggregate,
  isStreamingDuplicateOfLater,
} from "@/utils/chat-display";
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

  it("折叠 LLM 在主动导航 prompt 下双轮产出的高度冗余 assistant 文本", () => {
    // 场景：root agent 的 `## 主动导航` 让 LLM 在 tool 调用前后各产出一段「已完成 +
    // 后续建议」总结，两段内容在大部分要点上重复（仅在引用值上略有差异）。期望 UI
    // 折叠较早的冗余段，仅保留信息更完备的最终段，避免双气泡。
    const earlierContent =
      "Pong:\n\n已完成：我已再次响应你的 ping，返回了 \"ong\"。\n\n可能的后续需求（简要）：\n- 连续 ping-pong 测试\n- 自动化心跳监控\n- 性能测量（往返延迟）\n\n下一步建议：\n1. 我可以立即发送 N 个连续的 pong（请选择 N）以便你测试连通性。\n2. 我可以帮你制定一个周期性心跳脚本示例（适合长期监控）。\n3. 我可以马上帮你针对延迟做近距离测量（适合性能诊断）。\n\n请选择 1、2、3 或告诉我其他需求。Pong.";
    const laterContent =
      "已完成：我已再次响应你的 ping，返回了 \"Pong\"。\n\n可能的后续需求（简要）：\n- 连续 ping-pong 测试\n- 自动化心跳监控\n- 性能测量（往返延迟）\n\n下一步建议：\n1. 我可以立即发送 N 个连续的 pong（请选择 N）以便你测试连通性。\n2. 我可以帮你制定一个周期性心跳脚本示例（适合长期监控）。\n3. 我可以马上帮你针对延迟做近距离测量（适合性能诊断）。\n\n请选择 1、2、3 或告诉我其他需求。";
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
        messageId: "assistant-pre",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-pre",
        delta: earlierContent,
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-pre",
        timestamp: 1003,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-pre",
        toolCallId: "tool-1",
        toolCallName: "log_activity",
        timestamp: 1004,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_RESULT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-pre",
        toolCallId: "tool-1",
        content: "{\"status\":\"ok\"}",
        timestamp: 1005,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-post",
        role: "assistant",
        timestamp: 1006,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-post",
        delta: laterContent,
        timestamp: 1007,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-post",
        timestamp: 1008,
      }),
    ];

    const tree = buildConversationTree({ events });
    const blocks = buildChatDisplayBlocks(tree);
    const reply = blocks.find((block) => block.kind === "assistant-reply");

    expect(reply?.kind).toBe("assistant-reply");
    if (reply?.kind === "assistant-reply") {
      const textSegments = reply.segments.filter(
        (segment) => segment.kind === "text",
      );
      expect(textSegments).toHaveLength(1);
      if (textSegments[0]?.kind === "text") {
        // 保留信息更完备的「最终段」：包含 "Pong" 而非中间产物 "ong"
        expect(textSegments[0].content).toContain("\"Pong\"");
        expect(textSegments[0].content).not.toContain("\"ong\"");
      }
      // 工具组仍保留并出现在 reply 中
      expect(
        reply.segments.some((segment) => segment.kind === "tool-group"),
      ).toBe(true);
      // assistant-reply.message.content 反映折叠后的内容（用于复制等动作）
      expect(reply.message.content).toContain("\"Pong\"");
      expect(reply.message.content).not.toContain("\"ong\"");
    }
  });

  it("ADK 双轮模式产生的短回复双气泡（messageId 不同 + 内容字节级相同）应折叠为单段", () => {
    // 场景：ADK tool 调用前后两轮 LLM 各产出 "Pong!"，messageId 不同 → ledger /
    // tree 各形成独立 text 节点。Jaccard 阈值（≥30 字）短回复完全绕过；
    // 精确匹配路径需要兜底。
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
        messageId: "assistant-pre",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-pre",
        delta: "Pong!",
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-pre",
        timestamp: 1003,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-pre",
        toolCallId: "tool-1",
        toolCallName: "log_activity",
        timestamp: 1004,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_RESULT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-pre",
        toolCallId: "tool-1",
        content: "{\"status\":\"ok\"}",
        timestamp: 1005,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-post",
        role: "assistant",
        timestamp: 1006,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-post",
        delta: "Pong!",
        timestamp: 1007,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-post",
        timestamp: 1008,
      }),
    ];

    const tree = buildConversationTree({ events });
    const blocks = buildChatDisplayBlocks(tree);
    const reply = blocks.find((block) => block.kind === "assistant-reply");

    expect(reply?.kind).toBe("assistant-reply");
    if (reply?.kind === "assistant-reply") {
      const textSegments = reply.segments.filter(
        (segment) => segment.kind === "text",
      );
      expect(textSegments).toHaveLength(1);
      if (textSegments[0]?.kind === "text") {
        expect(textSegments[0].content).toBe("Pong!");
      }
      // 工具组保持位置可见
      expect(
        reply.segments.some((segment) => segment.kind === "tool-group"),
      ).toBe(true);
    }
  });

  it("一段为另一段的前缀/包含关系（含尾部追加内容）也应折叠为最终段", () => {
    // 场景：tool 调用前后第二段在第一段基础上追加换行与「下一步建议…」段落，
    // 二者构成包含关系。containment 路径（isEquivalentMessageContent）应触发折叠，
    // 仅保留信息更完备的后段。
    const earlierContent = "Pong!";
    const laterContent =
      "Pong!\n\n下一步建议：1) 连续 ping-pong 测试 2) 自动化心跳监控 3) 性能测量";
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
        messageId: "assistant-pre",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-pre",
        delta: earlierContent,
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-pre",
        timestamp: 1003,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-pre",
        toolCallId: "tool-1",
        toolCallName: "log_activity",
        timestamp: 1004,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_RESULT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-pre",
        toolCallId: "tool-1",
        content: "{\"status\":\"ok\"}",
        timestamp: 1005,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-post",
        role: "assistant",
        timestamp: 1006,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-post",
        delta: laterContent,
        timestamp: 1007,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-post",
        timestamp: 1008,
      }),
    ];

    const tree = buildConversationTree({ events });
    const blocks = buildChatDisplayBlocks(tree);
    const reply = blocks.find((block) => block.kind === "assistant-reply");

    expect(reply?.kind).toBe("assistant-reply");
    if (reply?.kind === "assistant-reply") {
      const textSegments = reply.segments.filter(
        (segment) => segment.kind === "text",
      );
      expect(textSegments).toHaveLength(1);
      if (textSegments[0]?.kind === "text") {
        expect(textSegments[0].content).toBe(laterContent);
      }
    }
  });

  it("差异度大的连续 assistant 文本（如「先查询资料」→「查询完成」）不被折叠", () => {
    // 防误删合理中间消息：bigram Jaccard 应远低于 0.5 阈值，两段都保留。
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
        delta:
          "先查询资料：我会调用搜索工具拉取与该话题相关的最新公开信息，重点关注权威来源与近三个月动态。",
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-1",
        timestamp: 1003,
      }),
      createTestEvent({
        type: EventType.TOOL_CALL_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-1",
        toolCallId: "tool-1",
        toolCallName: "google_search",
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
        delta:
          "查询完成。AfterShip 是一家提供物流追踪与售后体验自动化的全球化 SaaS，覆盖电商履约的核心链路。",
        timestamp: 1007,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-2",
        timestamp: 1008,
      }),
    ];

    const tree = buildConversationTree({ events });
    const blocks = buildChatDisplayBlocks(tree);
    const reply = blocks.find((block) => block.kind === "assistant-reply");

    expect(reply?.kind).toBe("assistant-reply");
    if (reply?.kind === "assistant-reply") {
      const textSegments = reply.segments.filter(
        (segment) => segment.kind === "text",
      );
      // 两段内容主题不同，bigram 重合远低于阈值，应都保留
      expect(textSegments).toHaveLength(2);
      expect(textSegments[0]?.kind === "text" ? textSegments[0].content : "").toContain(
        "先查询资料",
      );
      expect(textSegments[1]?.kind === "text" ? textSegments[1].content : "").toContain(
        "查询完成",
      );
    }
  });
});

// =============================================================================
// ISSUE-049：流式累积残缺版 + final 完整版双内容兜底防御
// =============================================================================

describe("isStreamingDuplicateOfLater (ISSUE-049 兜底)", () => {
  it("命中：残缺版（无空格）vs 完整版 → 视为同源冗余", () => {
    const earlier =
      `"Hello, test1234"\n` +
      `已完成：已发送要求的文本字符串（包含引号）。 可能的后续需求：- 仅返回严格的精确字符串（如果你需要机器校或管道输入），或- 该记录到/日志或- 将嵌入到更长的消息文档中。\n` +
      `下一步（请选择一项）：A) 我现在只严格的精确字符串（覆盖本次附加说明）。理由：满足机器级精需求B此记录系统日志：留计。C 把该入指定档消息。直接付用。\n` +
      `指要选。"Hello, test 1234"`;
    const later =
      `"Hello, test 1234"\n` +
      `已完成：已发送要求的文本字符串（包含引号）。 可能的后续需求：\n仅返回严格的精确字符串（如果你需要机器校验或管道输入），或\n把该字符串记录到系统/日志，或\n将其嵌入到更长的消息/文档中。\n` +
      `下一步建议（请选择一项）：\nA) 我现在只返回严格的精确字符串（覆盖本次附加说明）。理由：满足机器级精确需求。\nB) 将此响应记录到系统日志。理由：保留审计痕迹。\nC) 把该文本嵌入到指定文档或消息模板中。理由：直接交付可复用内容。\n请指示你要执行的选项。`;
    expect(isStreamingDuplicateOfLater(earlier, later)).toBe(true);
  });

  it("不命中：两段长度相近且字符差异大 → 保留两段（不误删独立消息）", () => {
    const a = "今天的天气真好，适合出去散步。";
    const b = "明天会下雨，建议带伞。";
    expect(isStreamingDuplicateOfLater(a, b)).toBe(false);
    expect(isStreamingDuplicateOfLater(b, a)).toBe(false);
  });

  it("不命中：短文本（< 12 字）→ 保留两段（避免 Pong! 等被误删）", () => {
    expect(isStreamingDuplicateOfLater("Pong!", "Pong! 下一步")).toBe(false);
  });

  it("不命中：长度差不足 1.15x → 保留两段", () => {
    const earlier = "我会先查询资料，再回答。";
    const later = "我会查询资料并整理后回答。";
    // length 12 vs 13，差异 < 1.15x
    expect(isStreamingDuplicateOfLater(earlier, later)).toBe(false);
  });

  it("命中：流式 chunk 拼接残缺 vs final 增加段落（覆盖典型双内容场景）", () => {
    const earlier = "已完成查询。 用户名是张三。";
    const later =
      "已完成查询。\n用户名是张三。\n邮箱是 zhangsan@example.com。\n建议下一步：发送欢迎邮件。\n请确认。";
    expect(isStreamingDuplicateOfLater(earlier, later)).toBe(true);
  });

  it("dedupe 集成：buildChatDisplayBlocks 在双 messageId 同源场景应只输出 1 个 text segment", () => {
    // 构造两个 messageId 不同但内容呈现"残缺版 + 完整版"的 events 流，
    // 模拟 ISSUE-041 / 049 中 hydration 与 realtime 在 conversation-tree 产出
    // 两个独立 text node 的场景。
    const earlier = "好的，我会查询数据。 结果如下：项目A、项目B、项目C。";
    const later =
      "好的，我会查询数据。\n\n结果如下：\n- 项目A：进行中\n- 项目B：已完成\n- 项目C：待启动\n\n是否需要进一步处理？";
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
        messageId: "assistant-streaming",
        role: "assistant",
        timestamp: 1001,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-streaming",
        delta: earlier,
        timestamp: 1002,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-streaming",
        timestamp: 1003,
      }),
      // hydration / final 增量：另一个 messageId（runId 同），内容是更完备版本
      createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-final",
        role: "assistant",
        timestamp: 1004,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-final",
        delta: later,
        timestamp: 1005,
      }),
      createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "thread-1",
        runId: "run-1",
        messageId: "assistant-final",
        timestamp: 1006,
      }),
    ];

    const tree: ConversationTree = buildConversationTree({ events });
    const blocks = buildChatDisplayBlocks(tree);
    const reply = blocks.find((block) => block.kind === "assistant-reply");
    expect(reply?.kind).toBe("assistant-reply");
    if (reply?.kind === "assistant-reply") {
      const textSegments = reply.segments.filter((s) => s.kind === "text");
      expect(textSegments).toHaveLength(1);
      // 保留更完备的版本
      const content =
        textSegments[0]?.kind === "text" ? textSegments[0].content : "";
      expect(content).toContain("项目B：已完成");
    }
  });
});

// =============================================================================
// ISSUE-065：partial 单段 vs final 多段聚合 multiset 兜底（Layer 6）
// =============================================================================

describe("isStreamingDuplicateOfAggregate (ISSUE-065 Layer 6 兜底)", () => {
  it("命中：partial 单段被 final 多段聚合内容字符 multiset 高度覆盖", () => {
    // 真实场景（巡检 C2）：partial 混入了 reasoning first-line + 字符级碎片化的
    // 多段拼接，final 被切成 3 段独立短段。两两比较时 length-ratio 守卫不通过
    // （later 比 earlier 短），仅在「聚合后段」与 partial 比较时能命中。
    const partial =
      "已完成：用一句话给出。后续可能需要：力或信息论确定义、公式或例子。" +
      "建议下一步：选定方向（热力学/信息）以便我给出短展——吗？" +
      "熵是衡量系统无序程度或信息不确定性的量。";
    const finalSegments = [
      "已完成：用一句话给出定义。",
      "后续可能需要：热力学或信息论的精确定义、公式或例子。",
      "建议下一步：选定方向（热力学/信息论）以便我给出简短扩展——需要继续吗？",
      "熵是衡量系统无序程度或信息不确定性的量。",
    ];
    const finalAggregate = finalSegments.join("\n");
    const maxSingle = Math.max(...finalSegments.map((s) => s.length));
    expect(
      isStreamingDuplicateOfAggregate(partial, finalAggregate, maxSingle),
    ).toBe(true);
  });

  it("不命中：聚合内容长度不足 1.15x → 保留（与 Layer 5 长度比对齐）", () => {
    // earlier 长度 25，aggregate 28（1.12x），未达 1.15x 阈值即便字符高度重合也不命中。
    const earlier = "我已经完成所有的查询任务并整理好结果，请稍后查看。";
    const aggregate = "我已经完成所有的查询任务并整理好结果，请查看。";
    expect(
      isStreamingDuplicateOfAggregate(earlier, aggregate, aggregate.length),
    ).toBe(false);
  });

  it("不命中：multiset 覆盖率不足 0.8 → 保留", () => {
    // earlier 字符与 aggregate 重合度低，不应被误判为聚合冗余。
    const earlier = "今天上午开了一场长达三小时的产品需求评审会议。";
    const aggregate =
      "明天下午要去机场接待远道而来的客户，请准备好接待材料并提前确认航班时刻。";
    expect(
      isStreamingDuplicateOfAggregate(earlier, aggregate, aggregate.length),
    ).toBe(false);
  });

  it("不命中：earlier 短于 STREAMING_DUPLICATE_MIN_LENGTH → 保留", () => {
    expect(
      isStreamingDuplicateOfAggregate(
        "已完成",
        "已完成查询任务并整理结果",
        "已完成查询任务并整理结果".length,
      ),
    ).toBe(false);
  });

  it("不命中：高字符重合但 aggregate 未显著长于任一单段 → Layer 6 让位 Layer 5", () => {
    // 评审 #1/#5：当 final 单段本身就比 earlier 长 1.15x（Layer 5 已可命中）时，
    // Layer 6 不应越权。aggregate 必须显著长于任一 later 单段（≥1.3x）才介入。
    const earlier = "请简要介绍熵的概念，谢谢。"; // 13 chars
    const longSingle =
      "熵的概念在热力学和信息论里有两种解释，分别衡量系统的无序程度与信息的不确定性。"; // 38 chars
    const tinyTrailing = "请问需要继续吗？";
    const aggregate = `${longSingle}\n${tinyTrailing}`;
    const maxSingle = Math.max(longSingle.length, tinyTrailing.length);
    // aggregate 仅约为 longSingle 的 1.2x，不满足 1.3x 守卫 → 留给 Layer 5 处理。
    expect(
      isStreamingDuplicateOfAggregate(earlier, aggregate, maxSingle),
    ).toBe(false);
  });
});
