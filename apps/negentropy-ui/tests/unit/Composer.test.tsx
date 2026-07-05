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

  it("autoFocusToken 变化（>0）时聚焦输入框并将光标移至末尾", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Composer
        value="hello"
        onChange={onChange}
        onSend={vi.fn()}
        disabled={false}
        autoFocusToken={0}
      />,
    );
    const ta = screen.getByPlaceholderText("输入指令...") as HTMLTextAreaElement;
    // 初值 0 不抢占焦点
    expect(ta).not.toHaveFocus();

    rerender(
      <Composer
        value="hello"
        onChange={onChange}
        onSend={vi.fn()}
        disabled={false}
        autoFocusToken={1}
      />,
    );
    expect(ta).toHaveFocus();
    expect(ta.selectionStart).toBe("hello".length);
    expect(ta.selectionEnd).toBe("hello".length);
  });

  it("聊天输入区与消息流复用同一内容轨道常量", () => {
    expect(CHAT_CONTENT_RAIL_CLASS).toContain("max-w-4xl");
    expect(CHAT_CONTENT_RAIL_CLASS).toContain("px-6");
    expect(CHAT_CONTENT_RAIL_CLASS).toContain("sm:px-8");
  });

  it("isGenerating 时显示 Stop 并回调 onCancel", async () => {
    const onCancel = vi.fn();
    render(
      <Composer
        value="hi"
        onChange={vi.fn()}
        onSend={vi.fn()}
        disabled={false}
        isGenerating
        onCancel={onCancel}
      />,
    );
    const stop = screen.getByRole("button", { name: "Stop" });
    await userEvent.click(stop);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("forceShowStop 在非 generating但有待决审批时也显示 Stop（逃生门）", async () => {
    // ISSUE-156 续：审批弹窗待决时 isGenerating 可能为 false，用户仍需 Stop 自救。
    const onCancel = vi.fn();
    render(
      <Composer
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        disabled // Send 被禁用
        isGenerating={false}
        forceShowStop
        onCancel={onCancel}
      />,
    );
    const stop = screen.getByRole("button", { name: "Stop" });
    expect(stop).not.toBeDisabled();
    await userEvent.click(stop);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
  });

  it("无 onCancel 时不显示 Stop（向后兼容）", () => {
    render(
      <Composer
        value="hi"
        onChange={vi.fn()}
        onSend={vi.fn()}
        disabled={false}
        isGenerating
        // 故意不传 onCancel / forceShowStop
      />,
    );
    // isGenerating 但无 onCancel → 仍回退到 Send
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });
});
