import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/knowledge/pipeline",
}));

vi.mock("@/components/providers/NavigationProvider", () => ({
  useNavigation: () => ({
    setNavigationInfo: vi.fn(),
  }),
}));

describe("KnowledgeNav", () => {
  it("保留 Pipeline 二级导航项并高亮 pipeline 页面", () => {
    render(<KnowledgeNav title="Pipeline" />);

    const pipelineLink = screen.getByRole("link", { name: "Pipeline" });
    const baseLink = screen.getByRole("link", { name: "Knowledge Base" });

    expect(pipelineLink).toBeInTheDocument();
    expect(pipelineLink).toHaveAttribute("href", "/knowledge/pipeline");
    expect(pipelineLink.className).toContain("bg-foreground");
    expect(baseLink).toHaveAttribute("href", "/knowledge/base");
  });
});
