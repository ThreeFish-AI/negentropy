import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RetrievedChunkCard } from "@/app/knowledge/base/_components/RetrievedChunkCard";
import type { RetrievedChunkViewModel } from "@/app/knowledge/base/_components/retrieved-chunk-presenter";

function createChunk(
  overrides: Partial<RetrievedChunkViewModel> = {},
): RetrievedChunkViewModel {
  return {
    id: "chunk-1",
    variant: "hierarchical",
    title: "Parent-06",
    characterCount: 128,
    preview: "parent chunk preview",
    fullContent: "parent chunk preview",
    sourceLabel: "Context Engineering.pdf",
    sourceTitle: "Context Engineering.pdf",
    score: 0.91,
    childHitCount: 1,
    childChunks: [
      {
        id: "child-1",
        label: "C-03",
        content: "child chunk content",
        score: 0.67,
      },
    ],
    raw: {
      id: "chunk-1",
      content: "parent chunk preview",
      source_uri: "doc://context",
      combined_score: 0.91,
      metadata: {},
    },
    ...overrides,
  };
}

describe("RetrievedChunkCard", () => {
  it("默认保留来源区与 Open 交互", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(<RetrievedChunkCard chunk={createChunk()} onOpen={onOpen} />);

    expect(screen.getByText("Context Engineering.pdf")).toBeInTheDocument();
    expect(screen.getByText("SCORE 0.91")).toBeInTheDocument();

    await user.click(screen.getByText("Open"));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("可隐藏底部来源区与分数，并渲染额外标签", async () => {
    render(
      <RetrievedChunkCard
        chunk={createChunk()}
        onOpen={() => {}}
        hideFooter
        hideScores
        badges={<span>Retrieval Count 7</span>}
      />,
    );

    expect(screen.getByText("Retrieval Count 7")).toBeInTheDocument();
    expect(screen.getByText("Retrieval Count 7").className).not.toContain("rounded");
    expect(screen.queryByText("Context Engineering.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText("Open")).not.toBeInTheDocument();
    expect(screen.queryByText("SCORE 0.91")).not.toBeInTheDocument();
  });

  it("compact 变体会收敛字号但保持交互不变", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(<RetrievedChunkCard chunk={createChunk()} onOpen={onOpen} density="compact" />);

    expect(screen.getByText("parent chunk preview").className).toContain("text-[11px]");
    expect(screen.getByText("SCORE 0.91").className).toContain("text-[8px]");
    expect(screen.getByText("Open").closest("button")?.className).toContain("text-[10px]");

    await user.click(screen.getByText("Open"));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("提供子 chunk 打开回调时，子项保持可点击", async () => {
    const user = userEvent.setup();
    const onChildChunkOpen = vi.fn();

    render(
      <RetrievedChunkCard
        chunk={createChunk()}
        onOpen={() => {}}
        hideScores
        onChildChunkOpen={onChildChunkOpen}
      />,
    );

    await user.click(screen.getByRole("button", { name: "HIT 1 CHILD CHUNKS" }));
    await user.click(screen.getAllByRole("button", { name: /C-03.*child chunk content/i }).at(-1)!);

    expect(onChildChunkOpen).toHaveBeenCalledWith("child-1");
  });
});
