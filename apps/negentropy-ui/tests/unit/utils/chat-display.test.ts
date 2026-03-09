import { describe, expect, it } from "vitest";
import { EventType } from "@ag-ui/core";
import { buildConversationTree } from "@/utils/conversation-tree";
import { buildChatDisplayBlocks } from "@/utils/chat-display";
import { createTestEvent } from "@/tests/helpers/agui";
import type { AgUiEvent } from "@/types/agui";

describe("buildChatDisplayBlocks", () => {
  it("将正文、工具过程、后续正文投影为分离的展示块", () => {
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

    expect(blocks.map((block) => block.kind)).toEqual([
      "message",
      "tool-group",
      "message",
    ]);
    expect(blocks[0]?.kind === "message" ? blocks[0].message.content : "").toContain(
      "Web 搜索",
    );
    expect(blocks[1]?.kind === "tool-group" ? blocks[1].tools[0]?.name : "").toBe(
      "Google Search",
    );
    expect(blocks[2]?.kind === "message" ? blocks[2].message.content : "").toContain(
      "AfterShip",
    );
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
    const toolGroup = blocks.find((block) => block.kind === "tool-group");

    expect(toolGroup?.kind).toBe("tool-group");
    if (toolGroup?.kind === "tool-group") {
      expect(toolGroup.parallel).toBe(true);
      expect(toolGroup.defaultExpanded).toBe(true);
      expect(toolGroup.tools).toHaveLength(2);
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
});
