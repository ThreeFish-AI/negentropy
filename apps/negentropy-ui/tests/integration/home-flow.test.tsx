import { ReactNode, useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeBody } from "../../app/page";

let mockAgent: any;
let lastHitlConfig: any;
let detailEvents: any[];

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

describe("HomeBody integration", () => {
  beforeEach(() => {
    detailEvents = [];
    mockAgent = {
      messages: [],
      state: { stage: "ready" },
      isRunning: false,
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
      addMessage: vi.fn((message) => {
        mockAgent.messages = [...mockAgent.messages, message];
      }),
      runAgent: vi.fn().mockImplementation(async () => {
        detailEvents = [
          {
            id: "assistant-1",
            runId: "s1",
            threadId: "s1",
            timestamp: 1002,
            message: { role: "assistant", content: "world" },
          },
        ];
        mockAgent.messages = [
          ...mockAgent.messages,
          { id: "assistant-1", role: "assistant", content: "world" },
        ];
        return { result: "ok" };
      }),
      setMessages: vi.fn((messages) => {
        mockAgent.messages = messages;
      }),
      setState: vi.fn(),
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

  it("发送消息时显式带 threadId，并在运行后回拉会话详情", async () => {
    render(<Wrapper sessionId="s1" />);

    await userEvent.type(screen.getByPlaceholderText("输入指令..."), "ping");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(mockAgent.runAgent).toHaveBeenCalled();
    });

    expect(mockAgent.runAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "s1",
        runId: expect.any(String),
      }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/agui/sessions/s1"),
      );
    });

    await waitFor(() => {
      expect(mockAgent.setMessages).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ content: "world", role: "assistant" }),
        ]),
      );
    });
  });

  it("连续发送两条消息时保持用户消息显示顺序", async () => {
    render(<Wrapper sessionId="s1" />);

    const input = screen.getByPlaceholderText("输入指令...");
    await userEvent.type(input, "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    mockAgent.runAgent.mockResolvedValueOnce({ result: "ok" });
    detailEvents = [];

    await userEvent.type(input, "Hi");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    const hello = await screen.findByText((content) => content.includes("Hello"));
    const hi = await screen.findByText((content) => content.includes("Hi"));

    expect(
      hello.compareDocumentPosition(hi) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("handles HITL confirmation flow", async () => {
    render(<Wrapper sessionId="s1" />);
    const respond = vi.fn().mockResolvedValue(undefined);
    const ui = lastHitlConfig.render({
      status: "inProgress",
      args: { title: "确认", detail: "请确认" },
      respond,
    });
    render(ui);
    await userEvent.click(screen.getByRole("button", { name: "确认" }));
    expect(respond).toHaveBeenCalled();
    expect(mockAgent.addMessage).toHaveBeenCalled();
    expect(mockAgent.runAgent).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: "s1" }),
    );
  });
});
