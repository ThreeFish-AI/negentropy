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
});
