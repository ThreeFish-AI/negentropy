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
});
