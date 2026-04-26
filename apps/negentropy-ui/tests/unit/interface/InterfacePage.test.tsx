import { render, screen, waitFor } from "@testing-library/react";
import InterfacePage from "@/app/interface/page";
import { MCP_HUB_LABEL } from "@/app/interface/copy";

const useAuthMock = vi.fn();

vi.mock("@/components/ui/InterfaceNav", () => ({
  InterfaceNav: ({ title }: { title: string }) => <div data-testid="interface-nav">{title}</div>,
}));

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}));

function mockStatsFetch(includeModels = true) {
  const stats: Record<string, unknown> = {
    mcp_servers: { total: 2, enabled: 1 },
    skills: { total: 3, enabled: 2 },
    subagents: { total: 4, enabled: 3 },
  };
  if (includeModels) {
    stats.models = { total: 6, enabled: 4, vendors: 2 };
  }
  vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => stats,
  } as Response);
}

describe("InterfacePage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the MCP card with the existing MCP route", async () => {
    useAuthMock.mockReturnValue({ user: { roles: ["user"] }, status: "authenticated" });
    mockStatsFetch();

    render(<InterfacePage />);

    await waitFor(() => {
      expect(screen.getByText(MCP_HUB_LABEL)).toBeInTheDocument();
    });

    expect(screen.getByTestId("interface-nav")).toHaveTextContent("Dashboard");

    const mcpHubLink = screen.getByRole("link", { name: new RegExp(`^${MCP_HUB_LABEL}`) });
    expect(mcpHubLink).toHaveAttribute("href", "/interface/mcp");
  });

  it("admin 用户可见 Models StatCard 与 Quick Link", async () => {
    useAuthMock.mockReturnValue({ user: { roles: ["admin"] }, status: "authenticated" });
    mockStatsFetch();

    render(<InterfacePage />);

    await waitFor(() => {
      expect(screen.getByText(MCP_HUB_LABEL)).toBeInTheDocument();
    });

    const modelsCard = screen.getByRole("link", { name: /^Models/ });
    expect(modelsCard).toHaveAttribute("href", "/interface/models");

    expect(screen.getByRole("link", { name: /Manage Models/ })).toHaveAttribute(
      "href",
      "/interface/models",
    );
  });

  it("非 admin 用户不应看到 Models StatCard 与 Quick Link", async () => {
    useAuthMock.mockReturnValue({ user: { roles: ["user"] }, status: "authenticated" });
    mockStatsFetch();

    render(<InterfacePage />);

    await waitFor(() => {
      expect(screen.getByText(MCP_HUB_LABEL)).toBeInTheDocument();
    });

    expect(screen.queryByRole("link", { name: /^Models/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Manage Models/ })).toBeNull();
  });
});
