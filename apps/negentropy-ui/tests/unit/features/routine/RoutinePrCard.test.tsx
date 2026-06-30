import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RoutinePrCard } from "@/app/interface/routine/_components/RoutinePrCard";

/**
 * RoutinePrCard 渲染单测——「已合并」终态 vs 待合并 + 同步按钮。
 *
 * 覆盖：① merged=true 渲染「已合并 ✓」且不再提供合并/同步入口；② 未合并渲染「在 GitHub 合并」
 * 外链 + 「同步状态」按钮；③ 点同步按钮触发 onSync（带本地 syncing 自管理）。
 */

const PR_URL = "https://github.com/owner/repo/pull/123";

describe("RoutinePrCard", () => {
  it("merged=true 显示「已合并」且无合并外链 / 同步按钮", () => {
    render(<RoutinePrCard prUrl={PR_URL} merged={true} onSync={vi.fn()} />);
    expect(screen.getByText("已合并 ✓")).toBeInTheDocument();
    expect(screen.queryByText("在 GitHub 合并 →")).not.toBeInTheDocument();
    expect(screen.queryByText("同步状态")).not.toBeInTheDocument();
    // 「查看 PR」始终保留
    expect(screen.getByText("查看 PR")).toBeInTheDocument();
  });

  it("未合并显示「在 GitHub 合并」外链 + 「同步状态」按钮", () => {
    render(<RoutinePrCard prUrl={PR_URL} merged={false} onSync={vi.fn()} />);
    expect(screen.getByText("在 GitHub 合并 →")).toBeInTheDocument();
    expect(screen.getByText("同步状态")).toBeInTheDocument();
    expect(screen.queryByText("已合并 ✓")).not.toBeInTheDocument();
  });

  it("merged=null（未知/旧记录）按未合并渲染", () => {
    render(<RoutinePrCard prUrl={PR_URL} merged={null} onSync={vi.fn()} />);
    expect(screen.getByText("在 GitHub 合并 →")).toBeInTheDocument();
    expect(screen.queryByText("已合并 ✓")).not.toBeInTheDocument();
  });

  it("点击「同步状态」触发 onSync", () => {
    const onSync = vi.fn(() => Promise.resolve());
    render(<RoutinePrCard prUrl={PR_URL} merged={false} onSync={onSync} />);
    fireEvent.click(screen.getByText("同步状态"));
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it("未提供 onSync 时不渲染同步按钮（仅合并外链）", () => {
    render(<RoutinePrCard prUrl={PR_URL} merged={false} />);
    expect(screen.getByText("在 GitHub 合并 →")).toBeInTheDocument();
    expect(screen.queryByText("同步状态")).not.toBeInTheDocument();
  });

  it("无 prUrl 时渲染为空", () => {
    const { container } = render(<RoutinePrCard prUrl={null} merged={true} onSync={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
