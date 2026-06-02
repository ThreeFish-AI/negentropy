import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SkillCard } from "@/app/interface/skills/_components/SkillCard";

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: { roles: ["admin"] },
  }),
}));

vi.mock("@/components/ui/TiltedCard", () => ({
  TiltedCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const baseSkill = {
  id: "s1",
  owner_id: "u1",
  visibility: "private",
  name: "code-review",
  display_name: "Code Review",
  description:
    "Reviews code changes for correctness and reuse, with a fixed-height card layout for testing.",
  category: "engineering",
  version: "1.2.0",
  prompt_template: null,
  config_schema: {},
  default_config: {},
  required_tools: ["read", "grep"],
  is_enabled: true,
  priority: 0,
  enforcement_mode: "warning",
  resources: [],
  is_builtin: false,
};

describe("SkillCard", () => {
  it("calls edit, delete and toggle handlers through the tilt wrapper", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onToggleEnabled = vi.fn();
    render(
      <SkillCard
        skill={baseSkill}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleEnabled={onToggleEnabled}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Code Review" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Code Review" }));
    await userEvent.click(screen.getByRole("button", { name: "Disable Code Review" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onToggleEnabled).toHaveBeenCalledTimes(1);
  });

  it("keeps fixed-height layout classes after the TiltedCard wrap", () => {
    const { container } = render(
      <SkillCard skill={baseSkill} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );

    // mock TiltedCard 包裹一层 div，实际卡片是其子元素
    const root = container.firstElementChild?.firstElementChild;
    expect(root).toHaveClass("h-full");
  });
});
