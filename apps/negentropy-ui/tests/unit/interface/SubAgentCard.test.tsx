import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubAgentCard } from "@/app/interface/subagents/_components/SubAgentCard";

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

describe("SubAgentCard", () => {
  it("calls edit and delete handlers", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<SubAgentCard agent={baseAgent} onEdit={onEdit} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit PerceptionFaculty" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete PerceptionFaculty" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("keeps fixed-height layout classes and title tooltip for description", () => {
    const { container } = render(
      <SubAgentCard agent={baseAgent} onEdit={vi.fn()} onDelete={vi.fn()} />
    );

    const root = container.firstElementChild;
    expect(root).toHaveClass("h-full");

    const description = screen.getByText((content) => content.includes("Handles long description"));
    expect(description).toHaveAttribute("title", baseAgent.description);
  });
});
