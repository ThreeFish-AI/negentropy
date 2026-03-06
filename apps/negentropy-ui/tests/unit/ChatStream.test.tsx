import { render, screen } from "@testing-library/react";
import { ChatStream } from "../../components/ui/ChatStream";
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
                title: "search",
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
            title: "助手消息",
            role: "assistant",
            payload: { content: "你好" },
            sourceEventTypes: ["text_message_start"],
            relatedMessageIds: ["msg-1"],
          },
        ],
        threadId: "thread-1",
        runId: "run-1",
        timestamp: 1000,
        timeRange: { start: 1000, end: 1003 },
        title: "轮次 run-1",
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
});
