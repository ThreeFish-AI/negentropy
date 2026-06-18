/**
 * IngestDocumentDialog 组件单元测试
 *
 * 覆盖：文档列表加载、Library / Corpus / 当前语料库徽标、
 * Markdown 未就绪行禁用、选中提交与 toast、失败错误 toast。
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const fetchAllDocumentsMock = vi.fn();
const fetchCorporaMock = vi.fn();

vi.mock("@/lib/activity-toast", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock("@/features/knowledge", () => ({
  fetchAllDocuments: (...args: unknown[]) => fetchAllDocumentsMock(...args),
  fetchCorpora: (...args: unknown[]) => fetchCorporaMock(...args),
}));

import { IngestDocumentDialog } from "@/app/knowledge/base/_components/IngestDocumentDialog";

const TARGET_CORPUS_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_CORPUS_ID = "22222222-2222-2222-2222-222222222222";

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-ready",
    corpus_id: null,
    app_name: "negentropy",
    file_hash: "hash",
    original_filename: "library-doc.md",
    gcs_uri: "gs://bucket/library/doc.md",
    content_type: "text/markdown",
    file_size: 128,
    status: "active",
    created_at: null,
    created_by: null,
    markdown_extract_status: "completed",
    ...overrides,
  };
}

function renderDialog(overrides: Partial<Parameters<typeof IngestDocumentDialog>[0]> = {}) {
  const onIngestDocument = vi
    .fn()
    .mockResolvedValue({ run_id: "run-1", status: "running" });
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  render(
    <IngestDocumentDialog
      isOpen
      corpusId={TARGET_CORPUS_ID}
      onClose={onClose}
      onIngestDocument={onIngestDocument}
      onSuccess={onSuccess}
      {...overrides}
    />,
  );

  return { onIngestDocument, onClose, onSuccess };
}

describe("IngestDocumentDialog", () => {
  beforeEach(() => {
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    fetchAllDocumentsMock.mockReset();
    fetchCorporaMock.mockReset();
    fetchCorporaMock.mockResolvedValue([
      { id: OTHER_CORPUS_ID, name: "Corpus Beta" },
    ]);
  });

  it("渲染 Library / 其他 Corpus / 当前语料库三种徽标", async () => {
    fetchAllDocumentsMock.mockResolvedValue({
      count: 3,
      items: [
        makeDoc({ id: "doc-lib", corpus_id: null }),
        makeDoc({ id: "doc-other", corpus_id: OTHER_CORPUS_ID, original_filename: "beta.md" }),
        makeDoc({ id: "doc-own", corpus_id: TARGET_CORPUS_ID, original_filename: "own.md" }),
      ],
    });

    renderDialog();

    await waitFor(() => {
      expect(screen.getByText("library-doc.md")).toBeInTheDocument();
    });
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByText("Corpus Beta")).toBeInTheDocument();
    expect(screen.getByText("当前语料库")).toBeInTheDocument();
  });

  it("Markdown 未就绪的文档行禁用，且不可作为提交选项", async () => {
    fetchAllDocumentsMock.mockResolvedValue({
      count: 2,
      items: [
        makeDoc({ id: "doc-pending", markdown_extract_status: "processing", original_filename: "pending.md" }),
        makeDoc({ id: "doc-ready" }),
      ],
    });

    renderDialog();

    await waitFor(() => {
      expect(screen.getByText("pending.md")).toBeInTheDocument();
    });

    const pendingRow = screen.getByText("pending.md").closest("button")!;
    expect(pendingRow).toBeDisabled();
    expect(pendingRow).toHaveAttribute("title", "Markdown 未就绪，无法摄入");
    expect(screen.getByRole("button", { name: "Ingest" })).toBeDisabled();
  });

  it("选中就绪文档后提交：成功 toast + fire-and-forget 调用", async () => {
    fetchAllDocumentsMock.mockResolvedValue({
      count: 1,
      items: [makeDoc()],
    });
    const { onIngestDocument, onSuccess } = renderDialog();

    await waitFor(() => {
      expect(screen.getByText("library-doc.md")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("library-doc.md").closest("button")!);
    const ingestButton = screen.getByRole("button", { name: "Ingest" });
    expect(ingestButton).toBeEnabled();
    fireEvent.click(ingestButton);

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "已开始摄入文档",
      expect.objectContaining({ description: expect.stringContaining("Pipeline") }),
    );
    await waitFor(() => {
      expect(onIngestDocument).toHaveBeenCalledWith(
        expect.objectContaining({ document_id: "doc-ready" }),
      );
    });
  });

  it("摄入失败时弹出错误 toast", async () => {
    fetchAllDocumentsMock.mockResolvedValue({ count: 1, items: [makeDoc()] });
    const onIngestDocument = vi
      .fn()
      .mockRejectedValue(new Error("DOCUMENT_MARKDOWN_NOT_READY"));
    renderDialog({ onIngestDocument });

    await waitFor(() => {
      expect(screen.getByText("library-doc.md")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("library-doc.md").closest("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Ingest" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "摄入失败",
        expect.objectContaining({ description: "DOCUMENT_MARKDOWN_NOT_READY" }),
      );
    });
  });

  it("文档列表为空时展示引导文案", async () => {
    fetchAllDocumentsMock.mockResolvedValue({ count: 0, items: [] });
    renderDialog();

    await waitFor(() => {
      expect(screen.getByText(/暂无文档/)).toBeInTheDocument();
    });
  });
});
