import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChunkDetailDialog } from "@/app/knowledge/base/_components/ChunkDetailDialog";
import type { RetrievedChunkViewModel } from "@/app/knowledge/base/_components/retrieved-chunk-presenter";

function createChunk(
  overrides: Partial<RetrievedChunkViewModel> = {},
): RetrievedChunkViewModel {
  return {
    id: "chunk-1",
    variant: "hierarchical",
    title: "Parent-Chunk-06",
    characterCount: 128,
    preview: "parent chunk preview body",
    fullContent: "parent chunk full content body",
    sourceLabel: "Context Engineering.pdf",
    sourceTitle: "Context Engineering.pdf",
    score: 0.91,
    childHitCount: 1,
    childChunks: [
      { id: "child-1", label: "C-03", content: "child chunk content", score: 0.67 },
    ],
    raw: {
      id: "chunk-1",
      content: "parent chunk full content body",
      source_uri: "doc://context",
      combined_score: 0.91,
      metadata: {},
    },
    ...overrides,
  };
}

function createEditable(
  overrides: Partial<Parameters<typeof ChunkDetailDialog>[0]["editable"] & object> = {},
) {
  return {
    draftContent: "editable draft body",
    draftEnabled: true,
    onDraftContentChange: vi.fn(),
    onDraftEnabledChange: vi.fn(),
    onSave: vi.fn(),
    onRegenerate: vi.fn(),
    pending: false,
    ...overrides,
  };
}

describe("ChunkDetailDialog", () => {
  it("只读模式：渲染 Chunk Detail + SCORE + 正文，且无编辑控件", () => {
    render(<ChunkDetailDialog chunk={createChunk()} onClose={() => {}} />);

    const dialog = screen.getByRole("dialog", { name: "Chunk Detail" });
    expect(within(dialog).getByText("Chunk Detail")).toBeInTheDocument();
    expect(within(dialog).getByText("Parent-Chunk-06")).toBeInTheDocument();
    expect(within(dialog).getByText("Context Engineering.pdf")).toBeInTheDocument();
    expect(within(dialog).getByText("128 characters")).toBeInTheDocument();
    expect(within(dialog).getByText("SCORE 0.91")).toBeInTheDocument();
    expect(within(dialog).getByText("parent chunk full content body")).toBeInTheDocument();
    // hierarchical 子块侧栏
    expect(within(dialog).getByText("HIT 1 CHILD CHUNKS")).toBeInTheDocument();
    expect(within(dialog).getByText("child chunk content")).toBeInTheDocument();
    // 只读：无编辑态控件
    expect(dialog.querySelector("textarea")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByTestId("retrieved-chunk-dialog-backdrop")).toBeInTheDocument();
  });

  it("编辑模式：渲染 Edit Chunk + textarea + Enabled + Save/Regenerate，且隐藏 SCORE", async () => {
    const user = userEvent.setup();
    const editable = createEditable();

    render(
      <ChunkDetailDialog chunk={createChunk()} onClose={() => {}} editable={editable} />,
    );

    const dialog = screen.getByRole("dialog", { name: "Edit Chunk" });
    expect(within(dialog).getByText("Edit Chunk")).toBeInTheDocument();
    // 编辑态隐藏检索分（文档 chunk 无 score）
    expect(within(dialog).queryByText(/^SCORE/)).not.toBeInTheDocument();
    // 子块侧栏作为只读上下文仍在
    expect(within(dialog).getByText("HIT 1 CHILD CHUNKS")).toBeInTheDocument();

    const textarea = dialog.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect((textarea as HTMLTextAreaElement).value).toBe("editable draft body");

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(editable.onSave).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Save & Regenerate Child Chunks" }));
    expect(editable.onRegenerate).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Enabled" }));
    expect(editable.onDraftEnabledChange).toHaveBeenCalledWith(false);
  });

  it("编辑模式 pending 时禁用 Save / Regenerate / Cancel", () => {
    const editable = createEditable({ pending: true });
    render(
      <ChunkDetailDialog chunk={createChunk()} onClose={() => {}} editable={editable} />,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Save & Regenerate Child Chunks" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("非 hierarchical 时为单栏、无子块侧栏", () => {
    render(
      <ChunkDetailDialog
        chunk={createChunk({ variant: "standard", childHitCount: 0, childChunks: [] })}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText(/CHILD CHUNKS$/)).not.toBeInTheDocument();
  });

  it("chunk 为 null 时不渲染", () => {
    const { container } = render(<ChunkDetailDialog chunk={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
