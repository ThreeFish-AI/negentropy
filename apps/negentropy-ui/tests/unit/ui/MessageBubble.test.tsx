import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MessageBubble } from "@/components/ui/MessageBubble";

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: {
      name: "Aurelius Huang",
      email: "aurelius@example.com",
      picture: "https://example.com/avatar.png",
    },
  }),
}));

describe("MessageBubble", () => {
  it("用户头像无边框并定位在消息外侧", () => {
    render(
      <MessageBubble
        message={{ id: "u-1", role: "user", content: "你好" }}
      />,
    );

    const avatar = screen.getByRole("img", { name: "Me" });
    expect(avatar.className).not.toContain("border");
    expect(avatar.className).toContain("rounded-md");

    const avatarRail = avatar.parentElement;
    expect(avatarRail?.className).toContain("absolute");
    expect(avatarRail?.className).toContain("right-0");
    expect(avatarRail?.className).toContain("translate-x-[calc(100%+0.75rem)]");
  });

  it("智能体头像去掉边框与 ring 并定位在消息外侧", () => {
    render(
      <MessageBubble
        message={{ id: "a-1", role: "assistant", content: "收到" }}
      />,
    );

    const avatar = screen.getByAltText("AI").parentElement;
    expect(avatar?.className).not.toContain("border");
    expect(avatar?.className).not.toContain("ring");
    expect(avatar?.className).not.toContain("shadow-sm");
    expect(avatar?.className).toContain("rounded-full");

    const avatarRail = avatar?.parentElement;
    expect(avatarRail?.className).toContain("absolute");
    expect(avatarRail?.className).toContain("left-0");
    expect(avatarRail?.className).toContain("-translate-x-[calc(100%+0.75rem)]");
  });
});
