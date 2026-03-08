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
    expect(avatar.parentElement?.className).toContain("rounded-md");

    const avatarRail = avatar.parentElement?.parentElement;
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

  it("流式回复在结束前按 Markdown 语义渲染并显示状态", () => {
    render(
      <MessageBubble
        message={{
          id: "a-stream",
          role: "assistant",
          content: "## 小节标题\n\n- 列表项",
          streaming: true,
        }}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "小节标题" })).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("列表项")).toBeInTheDocument();
    expect(screen.getByText("Streaming")).toBeInTheDocument();
    expect(screen.getByText("实时生成中")).toBeInTheDocument();
  });

  it("流式回复中的未闭合代码块会被稳定补全为代码块渲染", () => {
    render(
      <MessageBubble
        message={{
          id: "a-code-stream",
          role: "assistant",
          content: "```ts\nconst answer = 42;",
          streaming: true,
        }}
      />,
    );

    expect(screen.getByText("const answer = 42;")).toBeInTheDocument();
    expect(screen.getByText("const answer = 42;").closest("pre")).not.toBeNull();
  });
});
