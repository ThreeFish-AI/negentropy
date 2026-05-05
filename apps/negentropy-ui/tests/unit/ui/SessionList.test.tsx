import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SessionList } from "@/components/ui/SessionList";

describe("SessionList", () => {
  it("活跃视图点击归档不会触发选中（弹出确认对话框 + 确认后调 onArchive）", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onArchive = vi.fn();

    render(
      <SessionList
        sessions={[{ id: "s1", label: "Session One" }]}
        activeId="s1"
        view="active"
        onSwitchView={vi.fn()}
        onSelect={onSelect}
        onArchive={onArchive}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Archive Session One" }));

    // 自定义 ConfirmDialog 替代 window.confirm（参考 ISSUE-049 修复）
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    await user.click(screen.getByTestId("confirm-dialog-confirm"));

    expect(onArchive).toHaveBeenCalledWith("s1");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("归档视图显示返回入口并支持解档（自定义确认对话框）", async () => {
    const user = userEvent.setup();
    const onSwitchView = vi.fn();
    const onUnarchive = vi.fn();

    render(
      <SessionList
        sessions={[{ id: "s2", label: "Archived Session" }]}
        activeId="s2"
        view="archived"
        onSwitchView={onSwitchView}
        onSelect={vi.fn()}
        onUnarchive={onUnarchive}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Unarchive Archived Session" }));
    await user.click(screen.getByTestId("confirm-dialog-confirm"));

    expect(onSwitchView).toHaveBeenCalledWith("active");
    expect(onUnarchive).toHaveBeenCalledWith("s2");
  });

  it("点击取消按钮不调用 onArchive", async () => {
    const user = userEvent.setup();
    const onArchive = vi.fn();
    render(
      <SessionList
        sessions={[{ id: "s1", label: "Session One" }]}
        activeId={null}
        view="active"
        onSwitchView={vi.fn()}
        onSelect={vi.fn()}
        onArchive={onArchive}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Archive Session One" }));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    await user.click(screen.getByTestId("confirm-dialog-cancel"));
    expect(onArchive).not.toHaveBeenCalled();
  });
});
