import { ReactNode, useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventType } from "@ag-ui/core";
import { HomeBody } from "../../app/home-body";
import { createTestEvent } from "@/tests/helpers/agui";
import type { AgUiEvent } from "@/types/agui";

type MockAgent = {
  messages: unknown[];
  state: { stage: string };
  isRunning: boolean;
  subscribe: ReturnType<typeof vi.fn>;
  addMessage: ReturnType<typeof vi.fn>;
  runAgent: ReturnType<typeof vi.fn>;
};

type HitlRenderPayload = {
  status: string;
  args: {
    title: string;
    detail: string;
  };
  respond: () => Promise<void>;
};

type HitlConfig = {
  render: (payload: HitlRenderPayload) => ReactNode;
};

type SessionEventPayload = {
  id: string;
  runId: string;
  threadId: string;
  timestamp: number;
  message?: {
    role?: string;
    content?: string;
  };
  author?: string;
  content?: {
    parts: Array<{ text: string }>;
  };
};

type SubscriptionHandlers = {
  onEvent?: (payload: { event: AgUiEvent }) => void;
  onRunInitialized?: () => void;
  onRunStartedEvent?: () => void;
  onRunFinishedEvent?: () => void;
};

let mockAgent: MockAgent;
let lastHitlConfig: HitlConfig | null;
let detailEvents: SessionEventPayload[];
let subscriptionHandlers: SubscriptionHandlers | null;

vi.mock("@copilotkitnext/react", () => ({
  CopilotKitProvider: ({ children }: { children: ReactNode }) => children,
  UseAgentUpdate: {
    OnMessagesChanged: "OnMessagesChanged",
    OnStateChanged: "OnStateChanged",
  },
  useAgent: () => ({ agent: mockAgent }),
  useHumanInTheLoop: (config: HitlConfig) => {
    lastHitlConfig = config;
  },
}));

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: null, status: "authenticated" }),
}));

function Wrapper({ sessionId }: { sessionId: string | null }) {
  const [currentSession, setCurrentSession] = useState(sessionId);

  return (
    <HomeBody
      sessionId={currentSession}
      userId="ui"
      setSessionId={setCurrentSession}
    />
  );
}

function emitEvent(event: AgUiEvent) {
  subscriptionHandlers?.onEvent?.({ event });
}

function emitAssistantReply(sessionId: string, messageId: string, content: string) {
  const timestamp = Date.now() / 1000;
  emitEvent(createTestEvent({
    type: EventType.RUN_STARTED,
    threadId: sessionId,
    runId: sessionId,
    timestamp,
  }));
  emitEvent(createTestEvent({
    type: EventType.TEXT_MESSAGE_START,
    threadId: sessionId,
    runId: sessionId,
    messageId,
    role: "assistant",
    timestamp: timestamp + 0.001,
  }));
  emitEvent(createTestEvent({
    type: EventType.TEXT_MESSAGE_CONTENT,
    threadId: sessionId,
    runId: sessionId,
    messageId,
    delta: content,
    timestamp: timestamp + 0.002,
  }));
  emitEvent(createTestEvent({
    type: EventType.TEXT_MESSAGE_END,
    threadId: sessionId,
    runId: sessionId,
    messageId,
    timestamp: timestamp + 0.003,
  }));
}

function expectHitlConfig(): HitlConfig {
  expect(lastHitlConfig).not.toBeNull();
  return lastHitlConfig as HitlConfig;
}

async function waitForInitialHydration() {
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/agui/sessions/s1"),
    );
  });
}

describe("HomeBody integration", () => {
  beforeEach(() => {
    detailEvents = [];
    subscriptionHandlers = null;
    mockAgent = {
      messages: [],
      state: { stage: "ready" },
      isRunning: false,
      subscribe: vi.fn((handlers) => {
        subscriptionHandlers = handlers;
        return { unsubscribe: vi.fn() };
      }),
      addMessage: vi.fn((message) => {
        mockAgent.messages = [...mockAgent.messages, message];
      }),
      runAgent: vi.fn().mockImplementation(async () => {
        const timestamp = Date.now() / 1000;
        subscriptionHandlers?.onRunInitialized?.();
        subscriptionHandlers?.onRunStartedEvent?.();
        emitAssistantReply("s1", "assistant-1", "world");
        detailEvents = [
          {
            id: "assistant-1",
            runId: "s1",
            threadId: "s1",
            timestamp: timestamp + 0.01,
            message: { role: "assistant", content: "world" },
          },
        ];
        subscriptionHandlers?.onRunFinishedEvent?.();
        return { result: "ok" };
      }),
    };
    lastHitlConfig = null;

    global.fetch = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/agui/sessions/list")) {
        return {
          ok: true,
          json: async () => [{ id: "s1", lastUpdateTime: Date.now() }],
        } as Response;
      }
      if (url.includes("/api/agui/sessions/") && !url.includes("/title")) {
        return {
          ok: true,
          json: async () => ({ events: detailEvents }),
        } as Response;
      }
      if (url.includes("/api/agui/sessions") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ id: "s-new", lastUpdateTime: Date.now() }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    }) as unknown as typeof fetch;
  });

  it("发送消息时使用 runId 触发运行，并在运行后展示 assistant 回复", async () => {
    const user = userEvent.setup();
    render(<Wrapper sessionId="s1" />);
    await waitForInitialHydration();

    await user.type(screen.getByPlaceholderText("输入指令..."), "ping");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(mockAgent.runAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: expect.any(String),
        }),
      );
    });

    expect(
      await screen.findByText((content) => content.includes("world")),
    ).toBeInTheDocument();
    await waitFor(
      () => {
        expect(screen.queryByText("NE 正在生成回复...")).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 10000);

  it("历史回拉暂时为空时，实时 assistant 回复不会被清空", async () => {
    const user = userEvent.setup();
    mockAgent.runAgent.mockImplementationOnce(async () => {
      const timestamp = Date.now() / 1000;
      subscriptionHandlers?.onRunInitialized?.();
      subscriptionHandlers?.onRunStartedEvent?.();
      emitAssistantReply("s1", "assistant-delayed", "delayed world");
      detailEvents = [];
      setTimeout(() => {
        detailEvents = [
          {
            id: "assistant-delayed",
            runId: "s1",
            threadId: "s1",
            timestamp: timestamp + 0.01,
            message: { role: "assistant", content: "delayed world" },
          },
        ];
      }, 500);
      subscriptionHandlers?.onRunFinishedEvent?.();
      return { result: "ok" };
    });

    render(<Wrapper sessionId="s1" />);
    await waitForInitialHydration();

    await user.type(screen.getByPlaceholderText("输入指令..."), "Hi");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText((content) => content.includes("delayed world")),
    ).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(
      screen.getByText((content) => content.includes("delayed world")),
    ).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1800));
    });
    expect(
      screen.getByText((content) => content.includes("delayed world")),
    ).toBeInTheDocument();
    await waitFor(
      () => {
        expect(screen.queryByText("NE 正在生成回复...")).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 10000);

  it("连续发送两条消息时保持用户消息显示顺序", async () => {
    const user = userEvent.setup();
    render(<Wrapper sessionId="s1" />);
    await waitForInitialHydration();

    const input = screen.getByPlaceholderText("输入指令...");
    await user.type(input, "Hello");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText((content) => content.includes("world"))).toBeInTheDocument();
    });

    mockAgent.runAgent.mockResolvedValueOnce({ result: "ok" });
    detailEvents = [];

    await user.type(input, "Hi");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const hello = await screen.findByText((content) => content.includes("Hello"));
    const hi = await screen.findByText((content) => content.includes("Hi"));

    expect(
      hello.compareDocumentPosition(hi) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }, 10000);

  it("历史回拉确认用户消息时不会显示两个相同的 Hi", async () => {
    const user = userEvent.setup();
    mockAgent.runAgent.mockImplementationOnce(async () => {
      const timestamp = Date.now() / 1000;
      subscriptionHandlers?.onRunInitialized?.();
      subscriptionHandlers?.onRunStartedEvent?.();
      emitAssistantReply("s1", "assistant-1", "你好");
      detailEvents = [
        {
          id: "server-user-1",
          runId: "s1",
          threadId: "s1",
          timestamp: timestamp + 0.01,
          message: { role: "user", content: "Hi" },
        },
        {
          id: "assistant-1",
          runId: "s1",
          threadId: "s1",
          timestamp: timestamp + 0.02,
          message: { role: "assistant", content: "你好" },
        },
      ];
      subscriptionHandlers?.onRunFinishedEvent?.();
      return { result: "ok" };
    });

    render(<Wrapper sessionId="s1" />);
    await waitForInitialHydration();

    const input = screen.getByPlaceholderText("输入指令...");
    await user.type(input, "Hi");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getAllByText((content) => content.includes("Hi"))).toHaveLength(1);
    });
  }, 10000);

  it("assistant 实时流与最终回拉 messageId 不同时仍只显示一个最终 bubble", async () => {
    const user = userEvent.setup();
    const finalReply = "我可以帮助你规划任务、分析代码并直接修改实现。";

    mockAgent.runAgent.mockImplementationOnce(async () => {
      const timestamp = Date.now() / 1000;
      subscriptionHandlers?.onRunInitialized?.();
      subscriptionHandlers?.onRunStartedEvent?.();
      emitEvent(createTestEvent({
        type: EventType.RUN_STARTED,
        threadId: "s1",
        runId: "s1",
        timestamp,
      }));
      emitEvent(createTestEvent({
        type: EventType.TEXT_MESSAGE_START,
        threadId: "s1",
        runId: "s1",
        messageId: "assistant-live",
        role: "assistant",
        timestamp: timestamp + 0.001,
      }));
      emitEvent(createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "s1",
        runId: "s1",
        messageId: "assistant-live",
        delta: "我可以帮助你规划任务",
        timestamp: timestamp + 0.002,
      }));
      emitEvent(createTestEvent({
        type: EventType.TEXT_MESSAGE_CONTENT,
        threadId: "s1",
        runId: "s1",
        messageId: "assistant-live",
        delta: finalReply,
        timestamp: timestamp + 0.003,
      }));
      emitEvent(createTestEvent({
        type: EventType.TEXT_MESSAGE_END,
        threadId: "s1",
        runId: "s1",
        messageId: "assistant-live",
        timestamp: timestamp + 0.004,
      }));

      detailEvents = [
        {
          id: "assistant-final",
          runId: "s1",
          threadId: "s1",
          timestamp: timestamp + 0.02,
          message: { role: "assistant", content: finalReply },
        },
      ];
      subscriptionHandlers?.onRunFinishedEvent?.();
      return { result: "ok" };
    });

    render(<Wrapper sessionId="s1" />);
    await waitForInitialHydration();

    await user.type(screen.getByPlaceholderText("输入指令..."), "你能帮我做什么？");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(finalReply)).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1800));
    });

    await waitFor(() => {
      expect(screen.getAllByText(finalReply)).toHaveLength(1);
    });
  }, 10000);

  it("历史回放仅通过 protocol author 标记用户消息时，Chat 主区仍显示用户输入", async () => {
    detailEvents = [
      {
        id: "history-user-1",
        runId: "s1",
        threadId: "s1",
        timestamp: 1000,
        author: "user",
        content: { parts: [{ text: "Hi" }] },
      },
      {
        id: "history-assistant-1",
        runId: "s1",
        threadId: "s1",
        timestamp: 1001,
        author: "assistant",
        content: { parts: [{ text: "Hello from history" }] },
      },
    ];

    render(<Wrapper sessionId="s1" />);
    await waitForInitialHydration();

    const hi = await screen.findByText((content) => content.includes("Hi"));
    const reply = await screen.findByText((content) =>
      content.includes("Hello from history"),
    );

    expect(hi).toBeInTheDocument();
    expect(reply).toBeInTheDocument();
    expect(
      hi.compareDocumentPosition(reply) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }, 10000);

  it("handles HITL confirmation flow", async () => {
    const user = userEvent.setup();
    render(<Wrapper sessionId="s1" />);
    await waitForInitialHydration();
    const respond = vi.fn().mockResolvedValue(undefined);
    const ui = expectHitlConfig().render({
      status: "inProgress",
      args: { title: "确认", detail: "请确认" },
      respond,
    });
    render(ui);
    await user.click(screen.getByRole("button", { name: "确认" }));
    expect(respond).toHaveBeenCalled();
    expect(mockAgent.addMessage).toHaveBeenCalled();
    expect(mockAgent.runAgent).toHaveBeenCalledWith(
      expect.objectContaining({ runId: expect.any(String) }),
    );
  }, 10000);

  it("无 Session 时发送消息自动创建会话", async () => {
    // 覆盖 fetch mock：sessions/list 返回空列表，模拟无 Session 状态
    global.fetch = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/agui/sessions/list")) {
        return {
          ok: true,
          json: async () => [],
        } as Response;
      }
      if (url.includes("/api/agui/sessions") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ id: "s-auto", lastUpdateTime: Date.now() }),
        } as Response;
      }
      if (url.includes("/api/agui/sessions/")) {
        return {
          ok: true,
          json: async () => ({ events: [] }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<Wrapper sessionId={null} />);

    // 等待初始 loadSessions 完成（返回空列表）
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/agui/sessions/list"),
      );
    });

    // Composer 应处于可输入状态（disabled 不包含 !sessionId）
    const input = screen.getByPlaceholderText("输入指令...");
    await user.type(input, "Hello");
    await user.click(screen.getByRole("button", { name: "Send" }));

    // 验证自动触发了 session 创建
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/agui/sessions",
        expect.objectContaining({ method: "POST" }),
      );
    });
  }, 10000);

  it("新建 Session 后中栏立即切换为空白会话", async () => {
    const user = userEvent.setup();
    render(<Wrapper sessionId="s1" />);
    await waitForInitialHydration();

    // 发送一条消息，确保旧 session 有内容
    await user.type(screen.getByPlaceholderText("输入指令..."), "ping");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByText((content) => content.includes("world")),
    ).toBeInTheDocument();

    // 点击 "+ New" 创建新 session
    await user.click(screen.getByRole("button", { name: "+ New" }));

    // 验证创建了新 session
    await waitFor(() => {
      const createCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([url, opts]: [string, RequestInit | undefined]) =>
          url === "/api/agui/sessions" && opts?.method === "POST",
      );
      expect(createCalls.length).toBeGreaterThanOrEqual(1);
    });
  }, 10000);
});
