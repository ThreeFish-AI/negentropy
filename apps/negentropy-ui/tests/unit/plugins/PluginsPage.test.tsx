import { render, screen, waitFor } from "@testing-library/react";
import PluginsPage from "@/app/plugins/page";
import { MCP_HUB_LABEL } from "@/app/plugins/copy";

vi.mock("@/components/ui/PluginsNav", () => ({
  PluginsNav: ({ title }: { title: string }) => <div data-testid="plugins-nav">{title}</div>,
}));

describe("PluginsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the MCP Hub card with the existing MCP route", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        mcp_servers: { total: 2, enabled: 1 },
        skills: { total: 3, enabled: 2 },
        subagents: { total: 4, enabled: 3 },
      }),
    } as Response);

    render(<PluginsPage />);

    await waitFor(() => {
      expect(screen.getByText(MCP_HUB_LABEL)).toBeInTheDocument();
    });

    expect(screen.getByTestId("plugins-nav")).toHaveTextContent("Dashboard");

    const mcpHubLink = screen.getByRole("link", { name: new RegExp(MCP_HUB_LABEL) });
    expect(mcpHubLink).toHaveAttribute("href", "/plugins/mcp");
  });
});
