import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToolExecutionGroup } from "@/components/ui/ToolExecutionGroup";
import type { ToolGroupDisplayBlock } from "@/types/a2ui";

function createBlock(overrides: Partial<ToolGroupDisplayBlock> = {}): ToolGroupDisplayBlock {
  return {
    id: "tool-group:1",
    kind: "tool-group",
    nodeId: "tool:1",
    timestamp: 1000,
    sourceOrder: 1,
    parallel: true,
    defaultExpanded: true,
    status: "running",
    title: "Google Search 并行执行",
    summary: "执行中，2 个工具",
    tools: [
      {
        id: "tool-1",
        nodeId: "tool:1",
        name: "Google Search",
        args: "{\"q\":\"AfterShip\"}",
        status: "running",
        startedAt: 1000,
        summary: ["查询: AfterShip"],
      },
      {
        id: "tool-2",
        nodeId: "tool:2",
        name: "Web Search",
        args: "{\"q\":\"tracking\"}",
        result: "{\"items\":[1]}",
        status: "completed",
        startedAt: 1000.1,
        endedAt: 1001,
        summary: ["查询: tracking", "结果 1 条"],
      },
    ],
    ...overrides,
  };
}

describe("ToolExecutionGroup", () => {
  it("运行中默认展开并展示并行工具卡片", () => {
    render(<ToolExecutionGroup block={createBlock()} />);

    expect(screen.getByText("Google Search 并行执行")).toBeInTheDocument();
    expect(screen.getByText("执行中，2 个工具")).toBeInTheDocument();
    expect(screen.getAllByText("Parameters")).toHaveLength(2);
    expect(screen.getByText("Web Search")).toBeInTheDocument();
  });

  it("完成后默认折叠，并可手动展开", async () => {
    const user = userEvent.setup();
    render(
      <ToolExecutionGroup
        block={createBlock({
          defaultExpanded: false,
          status: "completed",
          summary: "已完成，2 个工具",
        })}
      />,
    );

    expect(screen.queryByText("Parameters")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Google Search 并行执行/ }));
    await user.click(
      screen.getAllByText((content, element) => {
        return content.includes("Google Search") && element?.tagName.toLowerCase() === "span";
      })[1].closest("button")!,
    );
    expect(screen.getByText("Parameters")).toBeInTheDocument();
  });

  it("将点击回传到选中回调", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ToolExecutionGroup block={createBlock()} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: /Google Search 并行执行/ }));
    expect(onSelect).toHaveBeenCalledWith("tool:1");
  });

  it("错误态会显示失败摘要并默认展开", () => {
    render(
      <ToolExecutionGroup
        block={createBlock({
          defaultExpanded: true,
          status: "error",
          summary: "执行失败，2 个工具",
        })}
      />,
    );

    expect(screen.getByText("执行失败，2 个工具")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getAllByText("Parameters")).toHaveLength(2);
  });

  it("当 block identity 保持稳定时，hydration 不会重置用户手动展开状态", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ToolExecutionGroup
        block={createBlock({
          id: "tool-group:msg-1:tool-1:tool-2",
          defaultExpanded: false,
          status: "completed",
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Google Search 并行执行/ }));
    expect(screen.queryAllByText("Parameters")).toHaveLength(0);

    await user.click(
      screen.getAllByText((content, element) => {
        return content.includes("Google Search") && element?.tagName.toLowerCase() === "span";
      })[1].closest("button")!,
    );
    expect(screen.getByText("Parameters")).toBeInTheDocument();

    rerender(
      <ToolExecutionGroup
        block={createBlock({
          id: "tool-group:msg-1:tool-1:tool-2",
          defaultExpanded: false,
          status: "completed",
          summary: "已完成，2 个工具",
        })}
      />,
    );

    expect(screen.getByText("Parameters")).toBeInTheDocument();
  });

  it("当 block identity 保持稳定且用户未手动操作时，会跟随新的 defaultExpanded", () => {
    const { rerender } = render(
      <ToolExecutionGroup
        block={createBlock({
          id: "tool-group:msg-2:tool-1:tool-2",
          defaultExpanded: false,
          status: "completed",
        })}
      />,
    );

    expect(screen.queryByText("Parameters")).not.toBeInTheDocument();

    rerender(
      <ToolExecutionGroup
        block={createBlock({
          id: "tool-group:msg-2:tool-1:tool-2",
          defaultExpanded: true,
          status: "running",
          summary: "执行中，2 个工具",
        })}
      />,
    );

    expect(screen.getAllByText("Parameters")).toHaveLength(2);
  });

  it("当 block identity 变化时，会按新 block 的 defaultExpanded 重新初始化", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ToolExecutionGroup
        block={createBlock({
          id: "tool-group:msg-3:tool-1:tool-2",
          defaultExpanded: true,
          status: "running",
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Google Search 并行执行/ }));
    expect(screen.queryByText("Parameters")).not.toBeInTheDocument();

    rerender(
      <ToolExecutionGroup
        block={createBlock({
          id: "tool-group:msg-4:tool-1:tool-2",
          defaultExpanded: true,
          status: "running",
          summary: "执行中，2 个工具（新块）",
        })}
      />,
    );

    expect(screen.getByText("执行中，2 个工具（新块）")).toBeInTheDocument();
    expect(screen.getAllByText("Parameters")).toHaveLength(2);
  });
});
