import { render, screen, waitFor } from "@testing-library/react";
import McpServersPage from "@/app/plugins/mcp/page";
import { MCP_HUB_LABEL } from "@/app/plugins/copy";

vi.mock("@/components/ui/PluginsNav", () => ({
  PluginsNav: ({ title }: { title: string }) => <div data-testid="plugins-nav">{title}</div>,
}));

vi.mock("@/app/plugins/mcp/_components/McpServerFormDialog", () => ({
  McpServerFormDialog: () => null,
}));

vi.mock("@/app/plugins/mcp/_components/McpServerTrialDialog", () => ({
  McpServerTrialDialog: () => null,
}));

vi.mock("@/app/plugins/mcp/_components/McpServerCard", () => ({
  McpServerCard: ({ server }: { server: { name: string } }) => (
    <div data-testid="mcp-card">{server.name}</div>
  ),
}));

describe("McpServersPage layout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders responsive grid classes", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "m1",
          owner_id: "u1",
          visibility: "private",
          name: "local-mcp",
          display_name: null,
          description: "desc",
          transport_type: "stdio",
          command: "uvx",
          args: [],
          env: {},
          url: null,
          headers: {},
          is_enabled: false,
          auto_start: false,
          config: {},
          tool_count: 0,
        },
      ],
    } as Response);

    render(<McpServersPage />);

    await waitFor(() => {
      expect(screen.getByTestId("mcp-card")).toBeInTheDocument();
    });

    expect(screen.getByTestId("plugins-nav")).toHaveTextContent(MCP_HUB_LABEL);
    expect(screen.getByRole("heading", { level: 1, name: MCP_HUB_LABEL })).toBeInTheDocument();

    const grid = screen.getByTestId("mcp-grid");
    expect(grid).toHaveClass("grid-cols-1");
    expect(grid).toHaveClass("md:grid-cols-2");
    expect(grid).toHaveClass("xl:grid-cols-3");

    expect(screen.getByTestId("mcp-grid-item")).toBeInTheDocument();
  });
});
