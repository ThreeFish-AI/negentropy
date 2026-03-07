import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionList } from "@/components/ui/SessionList";

describe("SessionList", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("活跃视图点击归档不会触发选中", async () => {
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

    expect(onArchive).toHaveBeenCalledWith("s1");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("归档视图显示返回入口并支持解档", async () => {
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

    expect(onSwitchView).toHaveBeenCalledWith("active");
    expect(onUnarchive).toHaveBeenCalledWith("s2");
  });
});
