import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentCard } from "@/app/interface/agents/_components/AgentCard";

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: { roles: ["admin"] },
  }),
}));

vi.mock("@/components/ui/TiltedCard", () => ({
  TiltedCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

const baseAgent = {
  id: "a1",
  owner_id: "u1",
  visibility: "private",
  name: "PerceptionFaculty",
  display_name: "PerceptionFaculty",
  description:
    "Handles long description text for responsive card layout testing and tooltip fallback.",
  agent_type: "llm_agent",
  system_prompt: null,
  model: "zai/glm-5",
  config: {},
  adk_config: { agent_class: "LlmAgent" },
  skills: ["skill_a", "skill_b", "skill_c", "skill_d"],
  tools: ["tool_a", "tool_b"],
  source: "negentropy_builtin",
  is_builtin: true,
  is_enabled: true,
};

describe("AgentCard", () => {
  it("calls edit handler on card click and delete handler on delete button", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<AgentCard agent={baseAgent} onEdit={onEdit} onDelete={onDelete} />);

    // Clicking the card body triggers onEdit
    const card = screen.getByRole("button", { name: "Edit PerceptionFaculty" });
    await userEvent.click(card);

    // Delete button triggers onDelete
    await userEvent.click(screen.getByRole("button", { name: "Delete PerceptionFaculty" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("keeps fixed-height layout classes and title tooltip for description", () => {
    const { container } = render(
      <AgentCard agent={baseAgent} onEdit={vi.fn()} onDelete={vi.fn()} />
    );

    // DOM: useSortable div > TiltedCard div > card div (with h-full)
    const sortableWrapper = container.firstElementChild;
    const tiltedCardWrapper = sortableWrapper?.firstElementChild;
    const card = tiltedCardWrapper?.firstElementChild;
    expect(card).toHaveClass("h-full");

    const description = screen.getByText((content) => content.includes("Handles long description"));
    expect(description).toHaveAttribute("title", baseAgent.description);
  });
});
