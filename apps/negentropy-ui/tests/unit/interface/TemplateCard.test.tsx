import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateCard } from "@/app/interface/routine/_components/TemplateCard";
import type { RoutineTemplateItem } from "@/features/routine";

vi.mock("@/components/ui/TiltedCard", () => ({
  TiltedCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const baseTemplate: RoutineTemplateItem = {
  id: "tpl-1",
  source: "user",
  key: "nightly-refactor",
  display_name: "Nightly Refactor",
  description: "Runs an automated refactor pass each night and verifies the result.",
  category: "engineering",
  version: "1.0.0",
  features_showcase: [],
  title: "Nightly Refactor",
  goal: "Reduce entropy",
  acceptance_criteria: "All tests pass",
  verification_command: "pnpm test",
  max_iterations: 5,
  max_cost_usd: null,
  success_score_threshold: 0.8,
  no_progress_patience: 2,
  approval_mode: "auto",
  config: {},
  has_verification_command: true,
  owner_id: "u1",
  created_at: null,
  updated_at: null,
};

describe("TemplateCard", () => {
  it("calls detail, use, edit and delete handlers through the tilt wrapper", async () => {
    const onDetail = vi.fn();
    const onUse = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <TemplateCard
        template={baseTemplate}
        onDetail={onDetail}
        onUse={onUse}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Use" }));
    await userEvent.click(screen.getByRole("button", { name: "编辑模板" }));
    await userEvent.click(screen.getByRole("button", { name: "删除模板" }));

    expect(onUse).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    // CTA / 编辑 / 删除均 stopPropagation，不应冒泡触发卡片主体的 onDetail
    expect(onDetail).not.toHaveBeenCalled();
  });

  it("opens detail when the card body is clicked", async () => {
    const onDetail = vi.fn();
    render(
      <TemplateCard template={baseTemplate} onDetail={onDetail} onUse={vi.fn()} />,
    );

    // 卡片主体（可点击 button）打开详情
    await userEvent.click(screen.getByText("Nightly Refactor"));
    expect(onDetail).toHaveBeenCalledTimes(1);
  });

  it("keeps equal-height layout classes after the TiltedCard wrap", () => {
    const { container } = render(
      <TemplateCard template={baseTemplate} onUse={vi.fn()} />,
    );

    // mock TiltedCard 包裹一层 div，实际卡片是其子元素
    const root = container.firstElementChild?.firstElementChild;
    expect(root).toHaveClass("h-full");
  });
});
