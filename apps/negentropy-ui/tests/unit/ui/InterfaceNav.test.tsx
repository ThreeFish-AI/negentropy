import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InterfaceNav } from "@/components/ui/InterfaceNav";

const setNavigationInfo = vi.fn();
const useAuthMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/interface/skills",
}));

vi.mock("@/components/providers/NavigationProvider", () => ({
  useNavigation: () => ({
    setNavigationInfo,
  }),
}));

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}));

describe("InterfaceNav", () => {
  it("写入 Interface 模块标签并保持子导航高亮逻辑", () => {
    useAuthMock.mockReturnValue({ user: { roles: ["user"] }, status: "authenticated" });

    render(<InterfaceNav title="Skills" />);

    expect(setNavigationInfo).toHaveBeenCalledWith({
      moduleLabel: "Interface",
      pageTitle: "Skills",
    });

    const skillsLink = screen.getByRole("link", { name: "Skills" });
    expect(skillsLink).toBeInTheDocument();
    expect(skillsLink).toHaveAttribute("href", "/interface/skills");
    expect(skillsLink.className).toContain("bg-foreground");

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/interface",
    );
  });

  it("仅在用户具备 admin 角色时展示 Models 入口", () => {
    useAuthMock.mockReturnValue({ user: { roles: ["admin"] }, status: "authenticated" });

    render(<InterfaceNav title="Models" />);

    const modelsLink = screen.getByRole("link", { name: "Models" });
    expect(modelsLink).toHaveAttribute("href", "/interface/models");
  });

  it("非 admin 用户不应看到 Models 入口", () => {
    useAuthMock.mockReturnValue({ user: { roles: ["user"] }, status: "authenticated" });

    render(<InterfaceNav title="Skills" />);

    expect(screen.queryByRole("link", { name: "Models" })).toBeNull();
  });

  it("按 Dashboard → Models → SubAgents → MCP → Skills 顺序渲染（admin）", () => {
    useAuthMock.mockReturnValue({ user: { roles: ["admin"] }, status: "authenticated" });

    render(<InterfaceNav title="Dashboard" />);

    const links = screen.getAllByRole("link").map((node) => node.textContent);
    expect(links.slice(0, 5)).toEqual([
      "Dashboard",
      "Models",
      "SubAgents",
      expect.any(String),
      "Skills",
    ]);
  });
});
