import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "../../components/ui/Composer";

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
});
