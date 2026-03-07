import { render, screen } from "@testing-library/react";
import { ChatStream } from "../../components/ui/ChatStream";
import { CHAT_CONTENT_RAIL_CLASS } from "../../components/ui/chat-layout";
import type { ConversationNode } from "@/types/a2ui";

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: null }),
}));

describe("ChatStream", () => {
  it("在空树时渲染占位文案", () => {
    render(<ChatStream nodes={[]} />);
    expect(
      screen.getByText("发送指令开始对话。主区将以 A2UI 模块树实时展示消息、工具、活动与状态。"),
    ).toBeInTheDocument();
  });

  it("递归渲染父子节点", () => {
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
            children: [
              {
                id: "tool:1",
                type: "tool-call",
                parentId: "message:1",
                children: [],
                threadId: "thread-1",
                runId: "run-1",
                toolCallId: "tool-1",
                timestamp: 1002,
                timeRange: { start: 1002, end: 1002 },
                sourceOrder: 2,
                title: "search",
                visibility: "chat",
                isStructural: false,
                payload: { args: "{\"q\":\"hello\"}", toolCallName: "search" },
                sourceEventTypes: ["tool_call_start"],
                relatedMessageIds: ["msg-1"],
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
            payload: { content: "你好" },
            sourceEventTypes: ["text_message_start"],
            relatedMessageIds: ["msg-1"],
          },
        ],
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
        timeRange: { start: 1000, end: 1003 },
        sourceOrder: 0,
        title: "轮次 run-1",
        visibility: "chat",
        isStructural: false,
        payload: {},
        sourceEventTypes: ["run_started"],
        relatedMessageIds: [],
      },
    ];

    render(<ChatStream nodes={nodes} />);

    expect(screen.getByText("轮次 run-1")).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("你好"))).toBeInTheDocument();
    expect(screen.getAllByText("search").length).toBeGreaterThan(0);
  });

  it("使用统一内容轨道类控制主聊天区宽度与水平留白", () => {
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
            children: [
              {
                id: "message:2",
                type: "text",
                parentId: "message:1",
                children: [],
                threadId: "thread-1",
                runId: "run-1",
                messageId: "msg-2",
                timestamp: 1002,
                timeRange: { start: 1002, end: 1002 },
                sourceOrder: 2,
                title: "继续回复",
                role: "assistant",
                visibility: "chat",
                isStructural: false,
                payload: { content: "继续说明" },
                sourceEventTypes: ["text_message_content"],
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
            payload: { content: "你好" },
            sourceEventTypes: ["text_message_start"],
            relatedMessageIds: ["msg-1"],
          },
        ],
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
        timeRange: { start: 1000, end: 1003 },
        sourceOrder: 0,
        title: "轮次 run-1",
        visibility: "chat",
        isStructural: false,
        payload: {},
        sourceEventTypes: ["run_started"],
        relatedMessageIds: [],
      },
    ];

    const { container } = render(<ChatStream nodes={nodes} />);

    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();

    const contentWrapper = container.querySelector(".space-y-4");
    CHAT_CONTENT_RAIL_CLASS.split(" ").forEach((className) => {
      expect(contentWrapper?.className).toContain(className);
    });
  });

  it("不渲染 debug-only 根节点，并将技术节点折叠为摘要卡片", () => {
    const nodes: ConversationNode[] = [
      {
        id: "raw:1",
        type: "raw",
        parentId: null,
        children: [],
        threadId: "thread-1",
        timestamp: 1000,
        timeRange: { start: 1000, end: 1000 },
        sourceOrder: 0,
        title: "原始事件",
        visibility: "debug-only",
        isStructural: false,
        payload: { data: { ignored: true } },
        sourceEventTypes: ["raw"],
        relatedMessageIds: [],
      },
      {
        id: "activity:1",
        type: "activity",
        parentId: null,
        children: [],
        threadId: "thread-1",
        timestamp: 1001,
        timeRange: { start: 1001, end: 1001 },
        sourceOrder: 1,
        title: "LOG_ACTIVITY",
        visibility: "collapsed",
        isStructural: false,
        payload: { content: { status: "ok", message: "已记录" } },
        sourceEventTypes: ["activity_snapshot"],
        relatedMessageIds: [],
      },
    ];

    render(<ChatStream nodes={nodes} />);

    expect(screen.queryByText("原始事件")).not.toBeInTheDocument();
    expect(screen.getByText("LOG_ACTIVITY")).toBeInTheDocument();
    expect(screen.getByText("状态: ok")).toBeInTheDocument();
    expect(screen.queryByText(/ignored/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开详情" })).toBeInTheDocument();
  });

  it("在轮次进行中且暂无助手回复时展示状态提示", () => {
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

    render(<ChatStream nodes={nodes} />);

    expect(screen.getByText("NE 正在生成回复...")).toBeInTheDocument();
  });

  it("在 HITL 阻塞时展示等待确认提示", () => {
    const nodes: ConversationNode[] = [
      {
        id: "turn:blocked",
        type: "turn",
        parentId: null,
        children: [],
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
        timeRange: { start: 1000, end: 1000 },
        sourceOrder: 0,
        title: "轮次 run-1",
        status: "blocked",
        visibility: "chat",
        isStructural: false,
        payload: {},
        sourceEventTypes: ["tool_call_start"],
        relatedMessageIds: [],
      },
    ];

    render(<ChatStream nodes={nodes} />);

    expect(screen.getByText("等待用户确认后继续")).toBeInTheDocument();
  });

  it("直接展示错误节点而不是折叠隐藏", () => {
    const nodes: ConversationNode[] = [
      {
        id: "error:1",
        type: "error",
        parentId: null,
        children: [],
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
        timeRange: { start: 1000, end: 1000 },
        sourceOrder: 0,
        title: "运行错误",
        status: "error",
        visibility: "chat",
        isStructural: false,
        payload: { message: "stream failed", code: "AGUI_STREAM_ERROR" },
        sourceEventTypes: ["run_error"],
        relatedMessageIds: [],
      },
    ];

    render(<ChatStream nodes={nodes} />);

    expect(screen.getByText("运行错误")).toBeInTheDocument();
    expect(screen.getByText("stream failed")).toBeInTheDocument();
  });
});
