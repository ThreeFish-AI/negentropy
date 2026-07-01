import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ChatStream } from "../../components/ui/ChatStream";
import type { ChatSuggestion } from "../../components/ui/ChatWelcome";

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: null }),
}));

// framer-motion 的 useReducedMotion 依赖 window.matchMedia，jsdom 默认缺失，需补桩。
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

const suggestions: ChatSuggestion[] = [
  { id: "research", title: "调研一个主题", prompt: "帮我调研：" },
];

describe("ChatStream 空态欢迎区", () => {
  it("传入 onSuggestionPick 时空树渲染 ChatWelcome 而非 EmptyState", () => {
    render(
      <ChatStream nodes={[]} suggestions={suggestions} onSuggestionPick={vi.fn()} />,
    );
    expect(screen.getByTestId("chat-welcome")).toBeInTheDocument();
    // 欢迎区取代精简空态文案
    expect(screen.queryByText("开始一段对话")).toBeNull();
  });

  it("点击建议词以 prompt 回调 onSuggestionPick", async () => {
    const user = userEvent.setup();
    const onSuggestionPick = vi.fn();
    render(
      <ChatStream
        nodes={[]}
        suggestions={suggestions}
        onSuggestionPick={onSuggestionPick}
      />,
    );
    await user.click(screen.getByText("调研一个主题"));
    expect(onSuggestionPick).toHaveBeenCalledWith("帮我调研：");
  });

  it("未传 onSuggestionPick 时保持精简空态（向后兼容）", () => {
    render(<ChatStream nodes={[]} />);
    expect(screen.getByText("开始一段对话")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-welcome")).toBeNull();
  });
});
