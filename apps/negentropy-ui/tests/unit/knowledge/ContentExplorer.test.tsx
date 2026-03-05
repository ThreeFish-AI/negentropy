import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("默认以折叠态渲染内容", () => {
    render(
      <ContentExplorer
        items={[makeItem("item-1", "第一行内容，默认应为折叠状态展示。".repeat(8))]}
      />,
    );

    const toggle = screen.getByTestId("content-toggle-item-1");
    const body = screen.getByTestId("content-body-item-1");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(body.className).toContain("line-clamp-2");
  });

  it("支持点击展开/收起，且同一时间仅展开一行", async () => {
    render(
      <ContentExplorer
        items={[
          makeItem("item-1", "Chunk 1 内容。".repeat(12)),
          makeItem("item-2", "Chunk 2 内容。".repeat(12)),
        ]}
      />,
    );

    const firstToggle = screen.getByTestId("content-toggle-item-1");
    const secondToggle = screen.getByTestId("content-toggle-item-2");
    const firstBody = screen.getByTestId("content-body-item-1");
    const secondBody = screen.getByTestId("content-body-item-2");

    await userEvent.click(firstToggle);
    expect(firstToggle).toHaveAttribute("aria-expanded", "true");
    expect(firstBody.className).toContain("whitespace-pre-wrap");
    expect(firstBody.className).not.toContain("line-clamp-2");

    await userEvent.click(secondToggle);
    expect(firstToggle).toHaveAttribute("aria-expanded", "false");
    expect(secondToggle).toHaveAttribute("aria-expanded", "true");
    expect(secondBody.className).toContain("whitespace-pre-wrap");
    expect(firstBody.className).toContain("line-clamp-2");

    await userEvent.click(secondToggle);
    expect(secondToggle).toHaveAttribute("aria-expanded", "false");
    expect(secondBody.className).toContain("line-clamp-2");
  });

  it("数据更新后会重置展开状态", async () => {
    const { rerender } = render(
      <ContentExplorer
        items={[
          makeItem("item-1", "Chunk 1 内容。".repeat(12)),
          makeItem("item-2", "Chunk 2 内容。".repeat(12)),
        ]}
      />,
    );

    const firstToggle = screen.getByTestId("content-toggle-item-1");
    await userEvent.click(firstToggle);
    expect(firstToggle).toHaveAttribute("aria-expanded", "true");

    rerender(
      <ContentExplorer
        items={[makeItem("item-3", "新数据。".repeat(12))]}
      />,
    );

    const newToggle = screen.getByTestId("content-toggle-item-3");
    expect(newToggle).toHaveAttribute("aria-expanded", "false");
  });
});
