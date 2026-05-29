import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SessionList } from "@/components/ui/SessionList";

/** 生成 N 个 SessionItem 供分页测试使用 */
function makeSessions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i + 1}`,
    label: `Session ${i + 1}`,
    timeLabel: `${i + 1}m ago`,
  }));
}

const defaultProps = {
  onSwitchView: vi.fn(),
  onSelect: vi.fn(),
};

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

    // 自定义 ConfirmDialog 替代 window.confirm（参考 ISSUE-054 修复）
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

    await user.click(screen.getByRole("tab", { name: "进行中" }));
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

  it("active 视图点击 Delete 弹出确认对话框，确认后调用 onDelete 且不触发选中", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    render(
      <SessionList
        sessions={[{ id: "s1", label: "Session One" }]}
        activeId="s1"
        view="active"
        onSwitchView={vi.fn()}
        onSelect={onSelect}
        onArchive={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete Session One" }));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    // 文案应明确"不可恢复"以降低误触
    expect(screen.getByTestId("confirm-dialog")).toHaveTextContent(/不可恢复/);
    await user.click(screen.getByTestId("confirm-dialog-confirm"));

    expect(onDelete).toHaveBeenCalledWith("s1");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("archived 视图也提供 Delete 入口，并与 Unarchive 并存", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onUnarchive = vi.fn();
    render(
      <SessionList
        sessions={[{ id: "s2", label: "Archived One" }]}
        activeId="s2"
        view="archived"
        onSwitchView={vi.fn()}
        onSelect={vi.fn()}
        onUnarchive={onUnarchive}
        onDelete={onDelete}
      />,
    );

    // Unarchive 与 Delete 两个按钮都应可见
    expect(screen.getByRole("button", { name: "Unarchive Archived One" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete Archived One" }));
    await user.click(screen.getByTestId("confirm-dialog-confirm"));

    expect(onDelete).toHaveBeenCalledWith("s2");
    expect(onUnarchive).not.toHaveBeenCalled();
  });

  it("点击 Delete 的取消按钮不调用 onDelete", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <SessionList
        sessions={[{ id: "s1", label: "Session One" }]}
        activeId={null}
        view="active"
        onSwitchView={vi.fn()}
        onSelect={vi.fn()}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete Session One" }));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    await user.click(screen.getByTestId("confirm-dialog-cancel"));
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe("SessionList 分页", () => {
  it("超过 10 个 session 时仅显示 10 个，分页栏显示正确页码", () => {
    const sessions = makeSessions(15);
    render(
      <SessionList
        {...defaultProps}
        sessions={sessions}
        activeId="s1"
        view="active"
      />,
    );

    // 应该恰好渲染 10 个 session（第 1 页）
    const sessionItems = document.querySelectorAll("[data-session-id]");
    expect(sessionItems).toHaveLength(10);

    // 分页栏应显示 "1 / 2"
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("点击下一页显示后续 session", async () => {
    const user = userEvent.setup();
    const sessions = makeSessions(15);
    render(
      <SessionList
        {...defaultProps}
        sessions={sessions}
        activeId="s1"
        view="active"
      />,
    );

    await user.click(screen.getByRole("button", { name: "下一页" }));

    // 第 2 页应显示 5 个 session（11-15）
    const sessionItems = document.querySelectorAll("[data-session-id]");
    expect(sessionItems).toHaveLength(5);
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("首页时上一页按钮 disabled，末页时下一页按钮 disabled", async () => {
    const user = userEvent.setup();
    const sessions = makeSessions(15);
    render(
      <SessionList
        {...defaultProps}
        sessions={sessions}
        activeId="s1"
        view="active"
      />,
    );

    // 第 1 页：上一页 disabled
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一页" })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "下一页" }));

    // 第 2 页：下一页 disabled
    expect(screen.getByRole("button", { name: "上一页" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
  });

  it("10 个或更少 session 时不显示分页栏", () => {
    const sessions = makeSessions(10);
    render(
      <SessionList
        {...defaultProps}
        sessions={sessions}
        activeId="s1"
        view="active"
      />,
    );

    expect(screen.queryByRole("button", { name: "上一页" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下一页" })).not.toBeInTheDocument();
  });

  it("sessions 数量变化后重置到第 1 页", () => {
    const sessions = makeSessions(15);
    const { rerender } = render(
      <SessionList
        {...defaultProps}
        sessions={sessions}
        activeId="s1"
        view="active"
      />,
    );

    // 模拟删除后 sessions 减少
    const reduced = makeSessions(10);
    rerender(
      <SessionList
        {...defaultProps}
        sessions={reduced}
        activeId="s1"
        view="active"
      />,
    );

    // 分页栏应消失（10 <= 10）
    expect(screen.queryByRole("button", { name: "上一页" })).not.toBeInTheDocument();
  });

  it("view 切换后重置到第 1 页", async () => {
    const sessions = makeSessions(15);
    const { rerender } = render(
      <SessionList
        {...defaultProps}
        sessions={sessions}
        activeId="s1"
        view="active"
      />,
    );

    // 导航到第 2 页
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    // 切换到 archived 视图
    rerender(
      <SessionList
        {...defaultProps}
        sessions={sessions}
        activeId="s1"
        view="archived"
      />,
    );

    // 应重置到第 1 页
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });
});
