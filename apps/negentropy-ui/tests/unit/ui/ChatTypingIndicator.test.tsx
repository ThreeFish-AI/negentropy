import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChatTypingIndicator } from "@/components/ui/ChatTypingIndicator";

describe("ChatTypingIndicator", () => {
  it("inline variant 默认 testid 与 a11y 属性正确", () => {
    render(<ChatTypingIndicator variant="inline" />);
    const node = screen.getByTestId("agent-waiting-placeholder");
    expect(node).toBeInTheDocument();
    expect(node).toHaveAttribute("role", "status");
    expect(node).toHaveAttribute("aria-live", "polite");
    expect(node).toHaveAttribute("aria-label", "Agent 正在响应");
    // 三个 bouncing dots
    expect(node.querySelectorAll("span.animate-bounce").length).toBe(3);
  });

  it("standalone variant 使用独立 testid 并附加 px-1", () => {
    render(<ChatTypingIndicator variant="standalone" />);
    const node = screen.getByTestId("chat-pending-indicator");
    expect(node).toBeInTheDocument();
    expect(node.className).toContain("px-1");
  });

  it("自定义 ariaLabel 透传到 aria-label 与 sr-only 文本", () => {
    render(
      <ChatTypingIndicator variant="inline" ariaLabel="Agent 正在思考" />,
    );
    const node = screen.getByTestId("agent-waiting-placeholder");
    expect(node).toHaveAttribute("aria-label", "Agent 正在思考");
    // sr-only 文本兜底（屏幕阅读器可读，但视觉隐藏）
    expect(node.querySelector("span.sr-only")?.textContent).toBe(
      "Agent 正在思考",
    );
  });

  it("默认 variant 为 inline（兼容既有 testid）", () => {
    render(<ChatTypingIndicator />);
    expect(screen.getByTestId("agent-waiting-placeholder")).toBeInTheDocument();
  });

  it("dots 都带有 motion-reduce:animate-none 降级修饰符（响应 prefers-reduced-motion）", () => {
    render(<ChatTypingIndicator variant="inline" />);
    const node = screen.getByTestId("agent-waiting-placeholder");
    const dots = Array.from(node.querySelectorAll("span.animate-bounce"));
    for (const dot of dots) {
      expect(dot.className).toContain("motion-reduce:animate-none");
    }
  });

  it("额外 className 透传到根节点", () => {
    render(
      <ChatTypingIndicator variant="standalone" className="extra-test-class" />,
    );
    expect(screen.getByTestId("chat-pending-indicator").className).toContain(
      "extra-test-class",
    );
  });
});
