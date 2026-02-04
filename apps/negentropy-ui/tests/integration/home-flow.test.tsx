import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeBody } from "../../app/page";

let mockAgent: any;
let lastHitlConfig: any;

vi.mock("@copilotkitnext/react", () => ({
  CopilotKitProvider: ({ children }: { children: React.ReactNode }) => children,
  UseAgentUpdate: {
    OnMessagesChanged: "OnMessagesChanged",
    OnStateChanged: "OnStateChanged",
  },
  useAgent: () => ({ agent: mockAgent }),
  useHumanInTheLoop: (config: any) => {
    lastHitlConfig = config;
  },
}));

function Wrapper({ sessionId }: { sessionId: string | null }) {
  const [sessions, setSessions] = useState(
    sessionId ? [{ id: sessionId, label: `Session ${sessionId}` }] : []
  );
  const [currentSession, setCurrentSession] = useState(sessionId);

  return (
    <HomeBody
      sessionId={currentSession}
      userId="ui"
      user={null}
      setSessionId={setCurrentSession}
      sessions={sessions}
      setSessions={setSessions}
      onLogout={() => {}}
    />
  );
}

describe("HomeBody integration", () => {
  beforeEach(() => {
    mockAgent = {
      messages: [
        { id: "m1", role: "user", content: "hello" },
        { id: "m2", role: "assistant", content: "world" },
      ],
      state: { stage: "ready" },
      isRunning: false,
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
      addMessage: vi.fn(),
      runAgent: vi.fn().mockResolvedValue({ result: "ok" }),
      setMessages: vi.fn(),
      setState: vi.fn(),
    };
    lastHitlConfig = null;

    global.fetch = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/agui/sessions") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ id: "s-new", lastUpdateTime: Date.now() }),
        } as Response;
      }
      if (url.includes("/api/agui/sessions/list")) {
        return {
          ok: true,
          json: async () => [],
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
  });

  it("renders agent messages and snapshot", async () => {
    render(<Wrapper sessionId="s1" />);
    expect(await screen.findByText("hello")).toBeInTheDocument();
    expect(screen.getByText("world")).toBeInTheDocument();
    expect(screen.getByText(/"stage": "ready"/)).toBeInTheDocument();
  });

  it("sends input via runAgent with threadId", async () => {
    render(<Wrapper sessionId="s1" />);
    await userEvent.type(screen.getByPlaceholderText("输入指令..."), "ping");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(mockAgent.runAgent).toHaveBeenCalled();
    });

    const call = mockAgent.runAgent.mock.calls[0][0];
    expect(call.threadId).toBe("s1");
    expect(call.runId).toBeDefined();
  });

  it("creates new session from header action", async () => {
    render(<Wrapper sessionId={null} />);
    await userEvent.click(screen.getByRole("button", { name: "New Session" }));
    expect(global.fetch).toHaveBeenCalled();
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
    expect(mockAgent.runAgent).toHaveBeenCalled();
  });

  it("handles HITL correct and supplement actions", async () => {
    render(<Wrapper sessionId="s1" />);
    const respond = vi.fn().mockResolvedValue(undefined);
    const ui = lastHitlConfig.render({
      status: "inProgress",
      args: { title: "确认", detail: "请确认" },
      respond,
    });
    render(ui);

    mockAgent.addMessage.mockClear();
    mockAgent.runAgent.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "修正" }));
    expect(respond).toHaveBeenCalled();
    expect(mockAgent.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("HITL:correct") })
    );
    expect(mockAgent.runAgent).toHaveBeenCalled();

    mockAgent.addMessage.mockClear();
    mockAgent.runAgent.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "补充" }));
    expect(respond).toHaveBeenCalled();
    expect(mockAgent.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("HITL:supplement") })
    );
    expect(mockAgent.runAgent).toHaveBeenCalled();
  });
});
