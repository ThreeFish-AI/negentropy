import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ChatWelcome, type ChatSuggestion } from "@/components/ui/ChatWelcome";

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
  { id: "research", title: "调研一个主题", description: "结构化综述", prompt: "帮我调研：" },
  { id: "summarize", title: "总结一份材料", prompt: "请总结：" },
];

describe("ChatWelcome", () => {
  it("渲染个性化问候与建议词卡片", () => {
    render(
      <ChatWelcome userName="Alice" suggestions={suggestions} onPick={vi.fn()} />,
    );
    expect(screen.getByText("你好，Alice")).toBeInTheDocument();
    expect(screen.getByText("调研一个主题")).toBeInTheDocument();
    expect(screen.getByText("总结一份材料")).toBeInTheDocument();
  });

  it("无用户名时回退到通用问候", () => {
    render(<ChatWelcome suggestions={[]} onPick={vi.fn()} />);
    expect(screen.getByText("你好")).toBeInTheDocument();
  });

  it("点击建议词卡片以 prompt 全文回调 onPick", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<ChatWelcome suggestions={suggestions} onPick={onPick} />);
    await user.click(screen.getByText("调研一个主题"));
    expect(onPick).toHaveBeenCalledWith("帮我调研：");
  });
});
