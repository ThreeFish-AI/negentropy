import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemoryNav } from "@/components/ui/MemoryNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/memory/automation",
}));

vi.mock("@/components/providers/NavigationProvider", () => ({
  useNavigation: () => ({
    setNavigationInfo: vi.fn(),
  }),
}));

describe("MemoryNav", () => {
  it("显示 Automation 二级导航项并能高亮当前页面", () => {
    render(<MemoryNav title="Automation" />);

    const automationLink = screen.getByRole("link", { name: "Automation" });
    expect(automationLink).toBeInTheDocument();
    expect(automationLink.className).toContain("bg-foreground");
  });
});
