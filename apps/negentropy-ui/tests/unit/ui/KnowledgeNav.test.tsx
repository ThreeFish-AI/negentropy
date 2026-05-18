import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/knowledge/pipelines",
}));

vi.mock("@/components/providers/NavigationProvider", () => ({
  useNavigation: () => ({
    setNavigationInfo: vi.fn(),
  }),
}));

describe("KnowledgeNav", () => {
  it("保留 Pipelines 二级导航项并高亮 pipelines 页面", () => {
    render(<KnowledgeNav title="Pipelines" />);

    const pipelinesLink = screen.getByRole("link", { name: "Pipelines" });
    const baseLink = screen.getByRole("link", { name: "Knowledge Base" });

    expect(pipelinesLink).toBeInTheDocument();
    expect(pipelinesLink).toHaveAttribute("href", "/knowledge/pipelines");
    expect(pipelinesLink.className).toContain("bg-foreground");
    expect(baseLink).toHaveAttribute("href", "/knowledge/base");
  });

  // 视觉不变量：与 HomeNav/MemoryNav/InterfaceNav/AdminNav 保持二级导航靠右对齐
  it("二级导航容器使用 justify-end，整体右对齐", () => {
    const { container } = render(<KnowledgeNav title="Pipelines" />);
    const nav = container.querySelector("nav") as HTMLElement;
    const flexRow = nav.parentElement as HTMLElement;

    expect(flexRow.className).toContain("justify-end");
    expect(flexRow.className).not.toContain("justify-between");
  });

  it("传入 modeToggle 时，渲染顺序为 modeToggle 在 nav 之前（确保 nav 始终贴最右边缘）", () => {
    const { container } = render(
      <KnowledgeNav title="Wiki" modeToggle={<div data-testid="mt">toggle</div>} />,
    );
    const nav = container.querySelector("nav") as HTMLElement;
    const toggle = container.querySelector("[data-testid='mt']") as HTMLElement;
    const flexRow = nav.parentElement as HTMLElement;

    expect(toggle.parentElement).toBe(flexRow);
    // DOCUMENT_POSITION_FOLLOWING (4) 表示 nav 出现在 toggle 之后
    expect(toggle.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
