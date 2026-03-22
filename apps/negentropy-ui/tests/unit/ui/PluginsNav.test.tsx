import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PluginsNav } from "@/components/ui/PluginsNav";

const setNavigationInfo = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/plugins/skills",
}));

vi.mock("@/components/providers/NavigationProvider", () => ({
  useNavigation: () => ({
    setNavigationInfo,
  }),
}));

describe("PluginsNav", () => {
  it("写入 Interface 模块标签并保持子导航高亮逻辑", () => {
    render(<PluginsNav title="Skills" />);

    expect(setNavigationInfo).toHaveBeenCalledWith({
      moduleLabel: "Interface",
      pageTitle: "Skills",
    });

    const skillsLink = screen.getByRole("link", { name: "Skills" });
    expect(skillsLink).toBeInTheDocument();
    expect(skillsLink).toHaveAttribute("href", "/plugins/skills");
    expect(skillsLink.className).toContain("bg-foreground");

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/plugins",
    );
  });
});
