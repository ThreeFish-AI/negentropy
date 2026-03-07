import { ReactNode, useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventType, type BaseEvent } from "@ag-ui/core";
import { HomeBody } from "../../app/page";

let mockAgent: any;
let lastHitlConfig: any;
let detailEvents: any[];
let subscriptionHandlers: Record<string, (...args: any[]) => void> | null;

vi.mock("@copilotkitnext/react", () => ({
  CopilotKitProvider: ({ children }: { children: ReactNode }) => children,
  UseAgentUpdate: {
    OnMessagesChanged: "OnMessagesChanged",
    OnStateChanged: "OnStateChanged",
  },
  useAgent: () => ({ agent: mockAgent }),
  useHumanInTheLoop: (config: any) => {
    lastHitlConfig = config;
  },
}));

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: null, status: "authenticated" }),
}));

function Wrapper({ sessionId }: { sessionId: string | null }) {
  const [sessions, setSessions] = useState(
    sessionId ? [{ id: sessionId, label: `Session ${sessionId}` }] : [],
  );
  const [currentSession, setCurrentSession] = useState(sessionId);

  return (
    <HomeBody
      sessionId={currentSession}
      userId="ui"
      setSessionId={setCurrentSession}
      sessions={sessions}
      setSessions={setSessions}
    />
  );
}

function emitEvent(event: BaseEvent) {
  subscriptionHandlers?.onEvent?.({ event });
}

function emitAssistantReply(sessionId: string, messageId: string, content: string) {
  const timestamp = Date.now() / 1000;
  emitEvent({
    type: EventType.RUN_STARTED,
    threadId: sessionId,
    runId: sessionId,
    timestamp,
  } as BaseEvent);
  emitEvent({
    type: EventType.TEXT_MESSAGE_START,
    threadId: sessionId,
    runId: sessionId,
    messageId,
    role: "assistant",
    timestamp: timestamp + 0.001,
  } as BaseEvent);
  emitEvent({
    type: EventType.TEXT_MESSAGE_CONTENT,
    threadId: sessionId,
    runId: sessionId,
    messageId,
    delta: content,
    timestamp: timestamp + 0.002,
  } as BaseEvent);
  emitEvent({
    type: EventType.TEXT_MESSAGE_END,
    threadId: sessionId,
    runId: sessionId,
    messageId,
    timestamp: timestamp + 0.003,
  } as BaseEvent);
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

  it("handles HITL confirmation flow", async () => {
    const user = userEvent.setup();
    render(<Wrapper sessionId="s1" />);
    await waitForInitialHydration();
    const respond = vi.fn().mockResolvedValue(undefined);
    const ui = lastHitlConfig.render({
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
});
