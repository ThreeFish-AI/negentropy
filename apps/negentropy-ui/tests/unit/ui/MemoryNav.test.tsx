import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemoryNav } from "@/components/ui/MemoryNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/memory/timeline",
}));

vi.mock("@/components/providers/NavigationProvider", () => ({
  useNavigation: () => ({
    setNavigationInfo: vi.fn(),
  }),
}));

describe("MemoryNav", () => {
  it("显示 Timeline 二级导航项并能高亮当前页面", () => {
    render(<MemoryNav title="Timeline" />);

    const timelineLink = screen.getByRole("link", { name: "Timeline" });
    expect(timelineLink).toBeInTheDocument();
    expect(timelineLink.className).toContain("bg-foreground");
  });

  it("渲染按生命周期排序的全部 7 个二级标签", () => {
    render(<MemoryNav title="Timeline" />);

    const expected = [
      "Overview",
      "Timeline",
      "Facts",
      "Conflicts",
      "Core Memory",
      "Audit",
      "Insights",
    ];
    for (const label of expected) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("新标签链接到正确路由", () => {
    render(<MemoryNav title="Timeline" />);

    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/memory/overview",
    );
    expect(screen.getByRole("link", { name: "Core Memory" })).toHaveAttribute(
      "href",
      "/memory/core-blocks",
    );
    expect(screen.getByRole("link", { name: "Insights" })).toHaveAttribute(
      "href",
      "/memory/insights",
    );
  });
});
