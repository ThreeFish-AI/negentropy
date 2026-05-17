import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatStream } from "../../components/ui/ChatStream";
import type { ConversationNode } from "@/types/a2ui";

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: null }),
}));

const EMPTY_PROMPT_TEXT =
  "发送指令开始对话。主区会按正文顺序展示消息，并把工具过程穿插在对应位置。";

describe("ChatStream — stream-level pending typing indicator", () => {
  it("空树 + pending=true：显示 standalone indicator，且不再显示「发送指令开始对话」", () => {
    render(<ChatStream nodes={[]} pending />);
    expect(screen.getByTestId("chat-pending-indicator")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_PROMPT_TEXT)).toBeNull();
  });

  it("空树 + pending=false：保持原有空状态文案，不显示 indicator", () => {
    render(<ChatStream nodes={[]} pending={false} />);
    expect(screen.queryByTestId("chat-pending-indicator")).toBeNull();
    expect(screen.getByText(EMPTY_PROMPT_TEXT)).toBeInTheDocument();
  });

  it("末尾非 assistant-reply（turn-status）+ pending=true：在列表底部追加 indicator", () => {
    // 仅 RUN_STARTED 而尚无任何 assistant 子节点 → buildChatDisplayBlocks
    // 会生成 turn-status 提示块，此时 stream 级 indicator 应可见。
    const nodes: ConversationNode[] = [
      {
        id: "turn:pending",
        type: "turn",
        parentId: null,
        children: [],
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
        timeRange: { start: 1000, end: 1000 },
        sourceOrder: 0,
        title: "轮次 run-1",
        status: "running",
        visibility: "chat",
        isStructural: false,
        payload: {},
        sourceEventTypes: ["run_started"],
        relatedMessageIds: [],
      },
    ];
    render(<ChatStream nodes={nodes} pending />);
    expect(screen.getByTestId("chat-pending-indicator")).toBeInTheDocument();
  });

  it("末尾已是 assistant-reply：不显示 stream 级 indicator（让位给 bubble 级 placeholder）", () => {
    // 已经有 assistant-reply 落地 → AssistantReplyBubble 内置 ChatTypingIndicator
    // 接管展示职责，外层 ChatStream 不能再叠加一层，避免「双 indicator」。
    const nodes: ConversationNode[] = [
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
            payload: { content: "你好", streaming: false },
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
    ];
    render(<ChatStream nodes={nodes} pending />);
    expect(screen.queryByTestId("chat-pending-indicator")).toBeNull();
  });

  it("pending=false 时无论末尾是什么 block，都不显示 indicator", () => {
    const nodes: ConversationNode[] = [
      {
        id: "turn:done",
        type: "turn",
        parentId: null,
        children: [],
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
        timeRange: { start: 1000, end: 1000 },
        sourceOrder: 0,
        title: "轮次 run-1",
        status: "running",
        visibility: "chat",
        isStructural: false,
        payload: {},
        sourceEventTypes: ["run_started"],
        relatedMessageIds: [],
      },
    ];
    render(<ChatStream nodes={nodes} pending={false} />);
    expect(screen.queryByTestId("chat-pending-indicator")).toBeNull();
  });

  it("未提供 pending prop 时默认 false（向后兼容）", () => {
    render(<ChatStream nodes={[]} />);
    expect(screen.queryByTestId("chat-pending-indicator")).toBeNull();
    expect(screen.getByText(EMPTY_PROMPT_TEXT)).toBeInTheDocument();
  });
});
