import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "../../components/ui/Composer";
import { CHAT_CONTENT_RAIL_CLASS } from "../../components/ui/chat-layout";

describe("Composer", () => {
  it("calls onSend on button click", async () => {
    const onSend = vi.fn();
    const onChange = vi.fn();
    render(<Composer value="hi" onChange={onChange} onSend={onSend} disabled={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("calls onSend on Enter", async () => {
    const onSend = vi.fn();
    const onChange = vi.fn();
    render(<Composer value="hello" onChange={onChange} onSend={onSend} disabled={false} />);
    await userEvent.type(screen.getByPlaceholderText("输入指令..."), "{enter}");
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("disables send when empty", () => {
    const onSend = vi.fn();
    const onChange = vi.fn();
    render(<Composer value="" onChange={onChange} onSend={onSend} disabled={false} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("渲染 Thinking 开关并回调切换状态", async () => {
    const onSend = vi.fn();
    const onChange = vi.fn();
    const onThinkingEnabledChange = vi.fn();
    render(
      <Composer
        value="hi"
        onChange={onChange}
        onSend={onSend}
        disabled={false}
        thinkingEnabled={false}
        thinkingSupported
        onThinkingEnabledChange={onThinkingEnabledChange}
      />,
    );

    const toggle = screen.getByRole("switch", { name: "切换 Thinking 推理增强" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    expect(onThinkingEnabledChange).toHaveBeenCalledWith(true);
  });

  it("当前模型不支持 Thinking 时禁用开关", async () => {
    const onSend = vi.fn();
    const onChange = vi.fn();
    const onThinkingEnabledChange = vi.fn();
    render(
      <Composer
        value="hi"
        onChange={onChange}
        onSend={onSend}
        disabled={false}
        thinkingEnabled
        thinkingSupported={false}
        onThinkingEnabledChange={onThinkingEnabledChange}
      />,
    );

    const toggle = screen.getByRole("switch", {
      name: "当前模型不支持 Thinking 推理增强",
    });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    expect(onThinkingEnabledChange).not.toHaveBeenCalled();
  });

  it("聊天输入区与消息流复用同一内容轨道常量", () => {
    expect(CHAT_CONTENT_RAIL_CLASS).toContain("max-w-4xl");
    expect(CHAT_CONTENT_RAIL_CLASS).toContain("px-6");
    expect(CHAT_CONTENT_RAIL_CLASS).toContain("sm:px-8");
  });
});
