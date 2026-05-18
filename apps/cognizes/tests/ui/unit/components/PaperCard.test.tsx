import { PaperCard } from "@/components/papers/PaperCard";
import { usePaperStore } from "@/store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_PAPERS } from "../../helpers/factory";
import { fireEvent, render, screen } from "../../helpers/render";

// Mock the store
vi.mock("@/store", () => ({
  usePaperStore: vi.fn(() => ({
    selectedPapers: [],
    togglePaperSelection: vi.fn(),
  })),
  useUIStore: vi.fn(() => ({
    addNotification: vi.fn(),
  })),
}));

describe("PaperCard", () => {
  const defaultProps = {
    paper: TEST_PAPERS.ATTENTION_PAPER,
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    onProcess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders paper title correctly", () => {
    render(<PaperCard {...defaultProps} />);

    expect(
      screen.getByText(TEST_PAPERS.ATTENTION_PAPER.title)
    ).toBeInTheDocument();
  });

  it("renders paper authors correctly", () => {
    render(<PaperCard {...defaultProps} />);

    // Authors should be displayed (first 3 joined with comma)
    const authorsText = TEST_PAPERS.ATTENTION_PAPER.authors
      .slice(0, 3)
      .join(", ");
    expect(screen.getByText(authorsText)).toBeInTheDocument();
  });

  it("renders paper status correctly", () => {
    render(<PaperCard {...defaultProps} />);

    // Status "processed" is displayed as "已分析" or similar
    // Check that some status indicator is present
    const statusElement = screen.getByText((content) =>
      ["已上传", "处理中", "已翻译", "已分析", "失败"].includes(content)
    );
    expect(statusElement).toBeInTheDocument();
  });

  it("renders paper category correctly", () => {
    render(<PaperCard {...defaultProps} />);

    // Category should be displayed
    expect(screen.getByText("LLM Agents")).toBeInTheDocument();
  });

  it("handles checkbox selection", () => {
    render(<PaperCard {...defaultProps} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();

    fireEvent.click(checkbox);
    // The mock will be called
  });

  it("renders view link correctly", () => {
    render(<PaperCard {...defaultProps} />);

    const viewLink = screen.getByText("查看");
    expect(viewLink).toBeInTheDocument();
    expect(viewLink.closest("a")).toHaveAttribute(
      "href",
      `/papers/${TEST_PAPERS.ATTENTION_PAPER.id}`
    );
  });

  it("renders process button when status allows", () => {
    render(<PaperCard {...defaultProps} />);

    const processButton = screen.getByText("处理");
    expect(processButton).toBeInTheDocument();
  });

  it("renders delete button correctly", () => {
    render(<PaperCard {...defaultProps} />);

    const deleteButton = screen.getByText("删除");
    expect(deleteButton).toBeInTheDocument();
  });

  it("shows file size correctly", () => {
    render(<PaperCard {...defaultProps} />);

    // File size should be converted to MB
    const expectedSize = (
      TEST_PAPERS.ATTENTION_PAPER.fileSize /
      1024 /
      1024
    ).toFixed(2);
    expect(screen.getByText(`${expectedSize} MB`)).toBeInTheDocument();
  });

  it("shows upload date correctly", () => {
    render(<PaperCard {...defaultProps} />);

    // Date should be formatted
    expect(screen.getByText(/2024-01-15/)).toBeInTheDocument();
  });

  it("renders abstract when present", () => {
    render(<PaperCard {...defaultProps} />);

    if (TEST_PAPERS.ATTENTION_PAPER.abstract) {
      // Abstract might be truncated, so just check for partial text
      const abstractElement = screen.getByText((content) =>
        content.includes(
          TEST_PAPERS.ATTENTION_PAPER.abstract?.substring(0, 20) || ""
        )
      );
      expect(abstractElement).toBeInTheDocument();
    }
  });

  it("hides process button when status is processing", () => {
    const processingPaper = {
      ...TEST_PAPERS.BERT_PAPER,
      status: "processing" as const,
    };

    render(<PaperCard {...defaultProps} paper={processingPaper} />);

    // Process button should not be visible for processing papers
    expect(screen.queryByText("处理")).not.toBeInTheDocument();
  });

  it("shows processing status for processing papers", () => {
    const processingPaper = {
      ...TEST_PAPERS.BERT_PAPER,
      status: "processing" as const,
    };

    render(<PaperCard {...defaultProps} paper={processingPaper} />);

    expect(screen.getByText("处理中")).toBeInTheDocument();
  });

  it("applies selected styles when paper is selected", () => {
    // Mock the store to return selected state
    (usePaperStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedPapers: [TEST_PAPERS.ATTENTION_PAPER.id],
      selectPaper: vi.fn(),
      clearSelection: vi.fn(),
    });

    render(<PaperCard paper={TEST_PAPERS.ATTENTION_PAPER} />);
    const card = screen.getByRole("article");
    expect(card.className).toContain("ring-2");
  });
});
