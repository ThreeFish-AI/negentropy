import { render, screen, waitFor } from "@testing-library/react";
import SubAgentsPage from "@/app/plugins/subagents/page";

vi.mock("@/components/ui/PluginsNav", () => ({
  PluginsNav: ({ title }: { title: string }) => <div data-testid="plugins-nav">{title}</div>,
}));

vi.mock("@/app/plugins/subagents/_components/SubAgentFormDialog", () => ({
  SubAgentFormDialog: () => null,
}));

vi.mock("@/app/plugins/subagents/_components/SubAgentCard", () => ({
  SubAgentCard: ({ agent }: { agent: { name: string } }) => (
    <div data-testid="subagent-card">{agent.name}</div>
  ),
}));

describe("SubAgentsPage layout", () => {
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

    render(<SubAgentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("subagent-card")).toBeInTheDocument();
    });

    const grid = screen.getByTestId("subagents-grid");
    expect(grid).toHaveClass("grid-cols-1");
    expect(grid).toHaveClass("md:grid-cols-2");
    expect(grid).toHaveClass("xl:grid-cols-3");

    const item = screen.getByTestId("subagent-grid-item");
    expect(item).toHaveClass("h-[187px]");
  });
});
