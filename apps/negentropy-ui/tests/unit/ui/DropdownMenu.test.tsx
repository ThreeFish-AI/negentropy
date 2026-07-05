import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";

function Harness({ items }: { items: DropdownMenuItem[] }) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button ref={anchorRef} type="button" onClick={() => setOpen(true)}>
        触发
      </button>
      <div data-testid="outside">外部区域</div>
      <DropdownMenu
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        items={items}
      />
    </div>
  );
}

describe("DropdownMenu", () => {
  it("打开后渲染菜单项，点击项调用 onSelect 并关闭", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Harness items={[{ label: "重命名", onSelect }]} />,
    );

    await user.click(screen.getByRole("button", { name: "触发" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "重命名" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Esc 关闭菜单", async () => {
    const user = userEvent.setup();
    render(<Harness items={[{ label: "删除", danger: true, onSelect: vi.fn() }]} />);
    await user.click(screen.getByRole("button", { name: "触发" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("点击浮层外部关闭菜单", async () => {
    const user = userEvent.setup();
    render(<Harness items={[{ label: "归档", onSelect: vi.fn() }]} />);
    await user.click(screen.getByRole("button", { name: "触发" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(screen.getByTestId("outside"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("ariaLabel 支持自定义可及名", async () => {
    const user = userEvent.setup();
    render(<Harness items={[{ label: "操作", onSelect: vi.fn() }]} />);
    await user.click(screen.getByRole("button", { name: "触发" }));
    expect(screen.getByRole("menu")).toHaveAccessibleName("更多操作");
  });
});
