import { render, screen } from "@testing-library/react";
import { ContentExplorer } from "@/app/knowledge/base/_components/ContentExplorer";
import type { KnowledgeItem } from "@/features/knowledge";

const makeItem = (id: string, content: string): KnowledgeItem => ({
  id,
  content,
  source_uri: "test://source",
  created_at: "2026-03-05T10:00:00.000Z",
  chunk_index: 0,
  metadata: {},
});

describe("ContentExplorer", () => {
  it("渲染内容条目并按 offset 连续编号", () => {
    render(
      <ContentExplorer
        offset={10}
        items={[makeItem("item-1", "短内容 A"), makeItem("item-2", "短内容 B")]}
      />,
    );
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("短内容 A")).toBeInTheDocument();
    expect(screen.getByText("短内容 B")).toBeInTheDocument();
  });

  it("内容单元格单行截断（truncate），超长全文经 Tooltip 恢复", () => {
    const longContent = "很长的一段内容".repeat(40);
    render(<ContentExplorer items={[makeItem("item-1", longContent)]} />);

    const cell = screen.getByText(longContent);
    expect(cell.className).toContain("truncate");
  });

  it("空数据显示占位文案", () => {
    render(<ContentExplorer items={[]} />);
    expect(screen.getByText("No items found.")).toBeInTheDocument();
  });

  it("loading 与 error 态各自正确呈现", () => {
    const { rerender } = render(<ContentExplorer items={[]} loading />);
    // loading 骨架（3 条脉冲块）
    expect(document.querySelectorAll(".animate-pulse").length).toBe(3);

    rerender(<ContentExplorer items={[]} error="boom" />);
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});
