import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SessionList } from "@/components/ui/SessionList";

/** 生成 N 个 SessionItem 供列表/分组测试使用 */
function makeSessions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i + 1}`,
    label: `Session ${i + 1}`,
    timeLabel: `${i + 1}m ago`,
  }));
}

/** 打开某会话行的「⋯」更多菜单 */
async function openMenu(user: UserEvent, label: string) {
  await user.click(screen.getByRole("button", { name: `会话操作 ${label}` }));
}

const defaultProps = {
  onSwitchView: vi.fn(),
  onSelect: vi.fn(),
};

describe("SessionList 行操作（经「⋯」菜单）", () => {
  it("活跃视图菜单内点击归档不会触发选中（弹出确认对话框 + 确认后调 onArchive）", async () => {
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

    await openMenu(user, "Session One");
    await user.click(screen.getByRole("menuitem", { name: "Archive Session One" }));

    // 自定义 ConfirmDialog 替代 window.confirm（参考 ISSUE-054 修复）
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    await user.click(screen.getByTestId("confirm-dialog-confirm"));

    expect(onArchive).toHaveBeenCalledWith("s1");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("归档视图菜单支持解档（自定义确认对话框）", async () => {
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

    await user.click(screen.getByRole("tab", { name: "Active" }));
    await openMenu(user, "Archived Session");
    await user.click(
      screen.getByRole("menuitem", { name: "Unarchive Archived Session" }),
    );
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
    await openMenu(user, "Session One");
    await user.click(screen.getByRole("menuitem", { name: "Archive Session One" }));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    await user.click(screen.getByTestId("confirm-dialog-cancel"));
    expect(onArchive).not.toHaveBeenCalled();
  });

  it("active 视图菜单内点击 Delete 弹出确认对话框，确认后调用 onDelete 且不触发选中", async () => {
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

    await openMenu(user, "Session One");
    await user.click(screen.getByRole("menuitem", { name: "Delete Session One" }));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    // 文案应明确"不可恢复"以降低误触
    expect(screen.getByTestId("confirm-dialog")).toHaveTextContent(/不可恢复/);
    await user.click(screen.getByTestId("confirm-dialog-confirm"));

    expect(onDelete).toHaveBeenCalledWith("s1");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("archived 视图菜单同时提供解档与删除", async () => {
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

    await openMenu(user, "Archived One");
    // 解档与删除两项都应在菜单内
    expect(
      screen.getByRole("menuitem", { name: "Unarchive Archived One" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Delete Archived One" }));
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
    await openMenu(user, "Session One");
    await user.click(screen.getByRole("menuitem", { name: "Delete Session One" }));
    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    await user.click(screen.getByTestId("confirm-dialog-cancel"));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("菜单内点击重命名进入内联编辑态", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(
      <SessionList
        sessions={[{ id: "s1", label: "Session One" }]}
        activeId="s1"
        view="active"
        onSwitchView={vi.fn()}
        onSelect={vi.fn()}
        onRename={onRename}
      />,
    );

    await openMenu(user, "Session One");
    await user.click(screen.getByRole("menuitem", { name: "Rename Session One" }));

    // 进入编辑：出现标题输入框且预填当前标题
    const input = screen.getByPlaceholderText("输入会话标题") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("Session One");
  });
});

describe("SessionList 时间分组与连续滚动", () => {
  it("按 lastUpdateTime 渲染时间分组标题", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const day = 86400;
    render(
      <SessionList
        {...defaultProps}
        sessions={[
          { id: "a", label: "Today A", lastUpdateTime: nowSec },
          { id: "b", label: "Old B", lastUpdateTime: nowSec - 40 * day },
        ]}
        activeId="a"
        view="active"
      />,
    );

    // 今天 / 更早 两个分组标题应出现
    expect(screen.getByText("今天")).toBeInTheDocument();
    expect(screen.getByText("更早")).toBeInTheDocument();
  });

  it("移除数字页码控件：即便超过一页也不渲染 Page/Next/Previous 按钮", () => {
    render(
      <SessionList
        {...defaultProps}
        sessions={makeSessions(15)}
        activeId="s1"
        view="active"
      />,
    );

    // Doubao 式连续滚动：不再有数字页码控件
    expect(screen.queryByRole("button", { name: "Page 1" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous page" })).toBeNull();
    expect(screen.queryByText("15 sessions")).toBeNull();

    // 首屏懒加载切片（PAGE_SIZE=10）：初始揭示不超过 10 项
    const items = document.querySelectorAll("[data-session-id]");
    expect(items.length).toBeLessThanOrEqual(10);
  });

  it("全宽「新建对话」按钮在活跃视图可见并触发 onNewSession", async () => {
    const user = userEvent.setup();
    const onNewSession = vi.fn();
    render(
      <SessionList
        {...defaultProps}
        sessions={makeSessions(2)}
        activeId="s1"
        view="active"
        onNewSession={onNewSession}
      />,
    );

    await user.click(screen.getByRole("button", { name: "新建对话" }));
    expect(onNewSession).toHaveBeenCalledTimes(1);
  });
});
