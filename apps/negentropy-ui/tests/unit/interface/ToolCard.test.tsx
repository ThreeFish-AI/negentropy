import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolCard } from "@/app/interface/tools/_components/ToolCard";

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: { roles: ["admin"] },
  }),
}));

vi.mock("@/components/ui/TiltedCard", () => ({
  TiltedCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const baseTool = {
  id: "t1",
  owner_id: "u1",
  visibility: "private",
  name: "web-search",
  display_name: "Web Search",
  description:
    "Performs web search and returns ranked results, with a fixed-height card layout for testing.",
  tool_type: "search",
  version: "2.0.1",
  config: {},
  credentials: {},
  config_schema: {},
  is_enabled: true,
  is_system: false,
};

describe("ToolCard", () => {
  it("calls edit, delete and toggle handlers through the tilt wrapper", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onToggleEnabled = vi.fn();
    render(
      <ToolCard
        tool={baseTool}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleEnabled={onToggleEnabled}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Web Search" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Web Search" }));
    await userEvent.click(screen.getByRole("button", { name: "Disable Web Search" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onToggleEnabled).toHaveBeenCalledTimes(1);
  });

  it("keeps fixed-height layout classes after the TiltedCard wrap", () => {
    const { container } = render(
      <ToolCard
        tool={baseTool}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleEnabled={vi.fn()}
      />,
    );

    // mock TiltedCard 包裹一层 div，实际卡片是其子元素
    const root = container.firstElementChild?.firstElementChild;
    expect(root).toHaveClass("h-full");
  });
});
