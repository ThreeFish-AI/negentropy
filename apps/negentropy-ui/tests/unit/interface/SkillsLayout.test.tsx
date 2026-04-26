import { render, screen, waitFor } from "@testing-library/react";
import SkillsPage from "@/app/interface/skills/page";

vi.mock("@/components/ui/InterfaceNav", () => ({
  InterfaceNav: ({ title }: { title: string }) => <div data-testid="interface-nav">{title}</div>,
}));

vi.mock("@/app/interface/skills/_components/SkillFormDialog", () => ({
  SkillFormDialog: () => null,
}));

vi.mock("@/app/interface/skills/_components/SkillCard", () => ({
  SkillCard: ({ skill }: { skill: { name: string } }) => (
    <div data-testid="skill-card">{skill.name}</div>
  ),
}));

describe("SkillsPage layout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders responsive grid classes and fixed-height items", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "s1",
          owner_id: "u1",
          visibility: "private",
          name: "CodeReview",
          display_name: null,
          description: "desc",
          category: "analysis",
          version: "1.0.0",
          prompt_template: null,
          config_schema: {},
          default_config: {},
          required_tools: [],
          is_enabled: true,
          priority: 0,
        },
      ],
    } as Response);

    render(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("skill-card")).toBeInTheDocument();
    });

    const grid = screen.getByTestId("skills-grid");
    expect(grid).toHaveClass("grid-cols-1");
    expect(grid).toHaveClass("md:grid-cols-2");
    expect(grid).toHaveClass("xl:grid-cols-3");

    const item = screen.getByTestId("skill-grid-item");
    expect(item).toHaveClass("h-[196px]");
  });
});
