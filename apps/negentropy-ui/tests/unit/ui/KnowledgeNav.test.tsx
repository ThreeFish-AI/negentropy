import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KnowledgeNav } from "@/components/ui/KnowledgeNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/knowledge/dashboard",
}));

vi.mock("@/components/providers/NavigationProvider", () => ({
  useNavigation: () => ({
    setNavigationInfo: vi.fn(),
  }),
}));

describe("KnowledgeNav", () => {
  it("保留 Dashboard 二级导航项并高亮 dashboard 页面", () => {
    render(<KnowledgeNav title="Dashboard" />);

    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    const baseLink = screen.getByRole("link", { name: "Knowledge Base" });

    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute("href", "/knowledge/dashboard");
    expect(dashboardLink.className).toContain("bg-foreground");
    expect(baseLink).toHaveAttribute("href", "/knowledge/base");
  });
});
