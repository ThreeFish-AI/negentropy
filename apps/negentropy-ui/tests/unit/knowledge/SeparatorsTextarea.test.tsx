import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import { SeparatorsTextarea } from "@/features/knowledge";

/**
 * 回归本次修复的 UX 契约：
 * 不要将 `encodeSeparatorsForDisplay(decodeSeparatorsFromInput(input))` 作为受控
 * textarea 的 value —— 该组合对孤立 `\` 非幂等，会在键入时把单 `\` 扩写为 `\\`
 * 并阻止后续删除/继续编辑成 `\n\n`。
 */
describe("SeparatorsTextarea", () => {
  it("键入单个反斜杠：textarea 保持 1 字符 \\，不被自动扩写为 \\\\", () => {
    const onChange = vi.fn();
    render(
      <SeparatorsTextarea
        data-testid="seps"
        value={[]}
        onChange={onChange}
      />,
    );

    const textarea = screen.getByTestId("seps") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "\\" } });

    expect(textarea.value).toBe("\\");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(["\\"]);
  });

  it("键入字面量 \\n（2 字符）：textarea 原样保留 \\n；onChange 以真换行回调", () => {
    const onChange = vi.fn();
    render(
      <SeparatorsTextarea
        data-testid="seps"
        value={[]}
        onChange={onChange}
      />,
    );

    const textarea = screen.getByTestId("seps") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "\\n" } });

    expect(textarea.value).toBe("\\n");
    expect(onChange).toHaveBeenLastCalledWith(["\n"]);
  });

  it("外部 value 语义变化（如策略切换）时重同步显示", () => {
    function Harness({ value }: { value: string[] }) {
      return (
        <SeparatorsTextarea
          data-testid="seps"
          value={value}
          onChange={() => {}}
        />
      );
    }

    const { rerender } = render(<Harness value={["\n"]} />);
    const textarea = screen.getByTestId("seps") as HTMLTextAreaElement;
    expect(textarea.value).toBe("\\n");

    rerender(<Harness value={["。"]} />);
    expect(textarea.value).toBe("。");
  });

  it("外部 value 数组引用变化但内容等价时不重置本地显示", () => {
    function Harness() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <>
          <SeparatorsTextarea
            data-testid="seps"
            value={value}
            onChange={setValue}
          />
          <button
            type="button"
            data-testid="rerender"
            onClick={() => setValue((prev) => [...prev])}
          >
            rerender
          </button>
        </>
      );
    }

    render(<Harness />);
    const textarea = screen.getByTestId("seps") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "\\" } });
    expect(textarea.value).toBe("\\");

    // 父组件再次渲染并传入内容相等但引用不同的数组 → 本地显示不应被 encode(decode(...)) 重置
    fireEvent.click(screen.getByTestId("rerender"));
    expect(textarea.value).toBe("\\");
  });

  it("退格清空：textarea 为空串，onChange 以空数组回调", () => {
    const onChange = vi.fn();
    render(
      <SeparatorsTextarea
        data-testid="seps"
        value={["\\"]}
        onChange={onChange}
      />,
    );

    const textarea = screen.getByTestId("seps") as HTMLTextAreaElement;
    expect(textarea.value).toBe("\\\\");

    fireEvent.change(textarea, { target: { value: "" } });
    expect(textarea.value).toBe("");
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
