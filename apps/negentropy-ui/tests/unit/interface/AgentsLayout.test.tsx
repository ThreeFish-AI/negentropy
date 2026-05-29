import { render, screen, waitFor } from "@testing-library/react";
import AgentsPage from "@/app/interface/agents/page";

vi.mock("@/components/ui/InterfaceNav", () => ({
  InterfaceNav: ({ title }: { title: string }) => <div data-testid="interface-nav">{title}</div>,
}));

vi.mock("@/app/interface/agents/_components/AgentFormDialog", () => ({
  AgentFormDialog: () => null,
}));

vi.mock("@/app/interface/agents/_components/AgentCard", () => ({
  AgentCard: ({ agent }: { agent: { name: string } }) => (
    <div data-testid="agent-card">{agent.name}</div>
  ),
}));

describe("AgentsPage layout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders responsive grid classes and fixed-height items", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "a1",
          owner_id: "u1",
          visibility: "private",
          name: "PerceptionFaculty",
          display_name: null,
          description: "desc",
          agent_type: "llm_agent",
          system_prompt: null,
          model: null,
          config: {},
          adk_config: {},
          skills: [],
          tools: [],
          source: "negentropy_builtin",
          is_builtin: true,
          is_enabled: true,
        },
      ],
    } as Response);

    render(<AgentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("agent-card")).toBeInTheDocument();
    });

    const grid = screen.getByTestId("agents-grid");
    expect(grid).toHaveClass("grid-cols-1");
    expect(grid).toHaveClass("md:grid-cols-2");
    expect(grid).toHaveClass("xl:grid-cols-3");

    const item = screen.getByTestId("agent-grid-item");
    expect(item).toHaveClass("h-[176px]");
  });
});
