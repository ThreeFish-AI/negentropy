/**
 * ImportDocumentDialog 组件单元测试
 *
 * 覆盖：Tab 切换（URL/PDF/Markdown）、提交禁用态、URL 校验、
 * 文件类型自动切 Tab、超限错误文案、fire-and-forget 提交与 toast。
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ImportDocumentDialog } from "@/app/knowledge/documents/_components/ImportDocumentDialog";

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("@/lib/activity-toast", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

function makeFile(name: string, size = 16, type = "application/pdf"): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function renderDialog(overrides: Partial<Parameters<typeof ImportDocumentDialog>[0]> = {}) {
  const onImportUrl = vi.fn().mockResolvedValue({ run_id: "run-1", status: "running" });
  const onImportFile = vi.fn().mockResolvedValue({ run_id: "run-2", status: "running" });
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  render(
    <ImportDocumentDialog
      isOpen
      onClose={onClose}
      onImportUrl={onImportUrl}
      onImportFile={onImportFile}
      onSuccess={onSuccess}
      {...overrides}
    />,
  );

  return { onImportUrl, onImportFile, onClose, onSuccess };
}

describe("ImportDocumentDialog", () => {
  beforeEach(() => {
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("默认展示 URL Tab，且空 URL 时 Import 按钮禁用", () => {
    renderDialog();

    expect(screen.getByLabelText("网页 URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("非法 URL 不可提交，合法 http(s) URL 才启用 Import", () => {
    renderDialog();

    const input = screen.getByLabelText("网页 URL");
    fireEvent.change(input, { target: { value: "not-a-url" } });
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();

    fireEvent.change(input, { target: { value: "https://example.com/post" } });
    expect(screen.getByRole("button", { name: "Import" })).toBeEnabled();
  });

  it("提交 URL：立即触发成功 toast 并 fire-and-forget 调用 onImportUrl", async () => {
    const { onImportUrl, onSuccess } = renderDialog();

    fireEvent.change(screen.getByLabelText("网页 URL"), {
      target: { value: "https://example.com/post" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "已开始导入文档",
      expect.objectContaining({ description: expect.stringContaining("Pipeline") }),
    );
    await waitFor(() => {
      expect(onImportUrl).toHaveBeenCalledWith({ url: "https://example.com/post" });
    });
  });

  it("提交失败时弹出错误 toast", async () => {
    const onImportUrl = vi.fn().mockRejectedValue(new Error("CONTENT_FETCH_FAILED"));
    renderDialog({ onImportUrl });

    fireEvent.change(screen.getByLabelText("网页 URL"), {
      target: { value: "https://example.com/broken" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "导入失败",
        expect.objectContaining({ description: "CONTENT_FETCH_FAILED" }),
      );
    });
  });

  it("切换到 PDF Tab 后展示拖拽上传区", () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    expect(screen.getByText(/支持 \.pdf/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("PDF Tab 拖入 .md 文件自动切换到 Markdown Tab", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    const dropZone = screen.getByText(/拖拽文件到此处/).closest("div")!.parentElement!;
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [makeFile("notes.md", 16, "text/markdown")] },
    });

    await waitFor(() => {
      expect(screen.getByText("notes.md")).toBeInTheDocument();
    });
    expect(screen.getByText(/Markdown 与纯文本文件直接导入/)).toBeInTheDocument();
  });

  it("超过 200MB 的文件展示大小限制错误", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    const dropZone = screen.getByText(/拖拽文件到此处/).closest("div")!.parentElement!;
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [makeFile("huge.pdf", 200 * 1024 * 1024 + 1)] },
    });

    await waitFor(() => {
      expect(screen.getByText(/文件大小超过限制/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("提交文件：调用 onImportFile 并立即关闭", async () => {
    const { onImportFile, onSuccess } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Markdown" }));
    const dropZone = screen.getByText(/拖拽文件到此处/).closest("div")!.parentElement!;
    const file = makeFile("notes.md", 16, "text/markdown");
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("notes.md")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(onSuccess).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(onImportFile).toHaveBeenCalledWith({ file });
    });
  });
});
