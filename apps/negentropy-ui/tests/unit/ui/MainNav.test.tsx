import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MainNav } from "@/components/layout/MainNav";
import { mainNavConfig } from "@/config/navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: {
      roles: ["admin"],
    },
  }),
}));

describe("MainNav", () => {
  it("使用更新后的一级导航文案且不改变目标路由", () => {
    render(<MainNav items={mainNavConfig} />);

    const homeLink = screen.getByRole("link", { name: "Home" });
    const interfaceLink = screen.getByRole("link", { name: "Interface" });

    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/");
    expect(homeLink.className).toContain("bg-foreground");

    expect(interfaceLink).toBeInTheDocument();
    expect(interfaceLink).toHaveAttribute("href", "/plugins");

    expect(screen.queryByRole("link", { name: "Chat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Plugins" })).not.toBeInTheDocument();
  });
});
