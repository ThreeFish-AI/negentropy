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
});
