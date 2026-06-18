import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PipelineRunCard } from "@/features/knowledge/components/PipelineRunCard";
import { OPERATION_LABELS, canRetryRun } from "@/features/knowledge/utils/pipeline-helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

const baseProps = {
  run_id: "build-abc1234-1234567890",
  version: 1,
};

describe("PipelineRunCard 取消按钮", () => {
  it("status=running + onCancel 提供时显示 X 按钮", () => {
    const onCancel = vi.fn();
    render(<PipelineRunCard {...baseProps} status="running" onCancel={onCancel} />);
    expect(screen.getByRole("button", { name: "取消运行" })).toBeInTheDocument();
  });

  it("status=pending 时同样显示 X 按钮", () => {
    const onCancel = vi.fn();
    render(<PipelineRunCard {...baseProps} status="pending" onCancel={onCancel} />);
    expect(screen.getByRole("button", { name: "取消运行" })).toBeInTheDocument();
  });

  it("status=cancelling 时按钮 disabled 且 aria-label 为'正在取消'", () => {
    const onCancel = vi.fn();
    render(<PipelineRunCard {...baseProps} status="cancelling" onCancel={onCancel} />);
    const btn = screen.getByRole("button", { name: "正在取消" });
    expect(btn).toBeDisabled();
  });

  it("status=completed 时不显示 X 按钮（terminal）", () => {
    const onCancel = vi.fn();
    render(<PipelineRunCard {...baseProps} status="completed" onCancel={onCancel} />);
    expect(screen.queryByRole("button", { name: /取消/ })).toBeNull();
  });

  it("status=failed 时不显示 X 按钮（terminal）", () => {
    const onCancel = vi.fn();
    render(<PipelineRunCard {...baseProps} status="failed" onCancel={onCancel} />);
    expect(screen.queryByRole("button", { name: /取消/ })).toBeNull();
  });

  it("status=cancelled 时不显示 X 按钮（terminal）", () => {
    const onCancel = vi.fn();
    render(<PipelineRunCard {...baseProps} status="cancelled" onCancel={onCancel} />);
    expect(screen.queryByRole("button", { name: /取消/ })).toBeNull();
  });

  it("不传 onCancel 时即使 running 也不显示按钮（父组件可控可见性）", () => {
    render(<PipelineRunCard {...baseProps} status="running" />);
    expect(screen.queryByRole("button", { name: /取消/ })).toBeNull();
  });

  it("点击 X 按钮触发 onCancel 回调", () => {
    const onCancel = vi.fn();
    render(<PipelineRunCard {...baseProps} status="running" onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "取消运行" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("点击 X 按钮 stopPropagation 不会触发 selectable 模式的 onSelect", () => {
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    render(
      <PipelineRunCard
        {...baseProps}
        status="running"
        mode="selectable"
        onSelect={onSelect}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "取消运行" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("link 模式下 X 按钮也可工作", () => {
    const onCancel = vi.fn();
    render(<PipelineRunCard {...baseProps} status="running" mode="link" onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "取消运行" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("PipelineRunCard 重试按钮（断点续传 / 重新开始）", () => {
  it("canRetry=true 且提供 onResume/onRestart 时显示两个按钮", () => {
    render(
      <PipelineRunCard
        {...baseProps}
        status="failed"
        canRetry
        onResume={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "断点续传" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新开始" })).toBeInTheDocument();
  });

  it("canRetry=false 时即使提供回调也不显示重试按钮", () => {
    render(
      <PipelineRunCard
        {...baseProps}
        status="failed"
        canRetry={false}
        onResume={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "断点续传" })).toBeNull();
    expect(screen.queryByRole("button", { name: "重新开始" })).toBeNull();
  });

  it("点击「断点续传」触发 onResume", () => {
    const onResume = vi.fn();
    render(
      <PipelineRunCard {...baseProps} status="failed" canRetry onResume={onResume} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "断点续传" }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("点击「重新开始」触发 onRestart", () => {
    const onRestart = vi.fn();
    render(
      <PipelineRunCard {...baseProps} status="failed" canRetry onRestart={onRestart} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "重新开始" }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("selectable 模式下点击重试按钮 stopPropagation 不触发 onSelect", () => {
    const onSelect = vi.fn();
    const onResume = vi.fn();
    render(
      <PipelineRunCard
        {...baseProps}
        status="failed"
        mode="selectable"
        canRetry
        onSelect={onSelect}
        onResume={onResume}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "断点续传" }));
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("Document Library 新操作类型", () => {
  it("import_document / ingest_document 渲染中文操作标签", () => {
    expect(OPERATION_LABELS.import_document).toBe("文档导入");
    expect(OPERATION_LABELS.ingest_document).toBe("文档摄入");
  });

  it("import_document run（input 无 corpus_id）不暴露重试入口", () => {
    const run = {
      id: "r1",
      run_id: "run-import",
      status: "failed",
      input: { document_id: "doc-1", corpus_id: null, source_type: "file_pdf" },
    } as unknown as Parameters<typeof canRetryRun>[0];

    expect(canRetryRun(run)).toBe(false);
  });

  it("ingest_document run（input 含 corpus_id + document_id）允许重试", () => {
    const run = {
      id: "r2",
      run_id: "run-ingest",
      status: "failed",
      input: { document_id: "doc-1", corpus_id: "corpus-1" },
    } as unknown as Parameters<typeof canRetryRun>[0];

    expect(canRetryRun(run)).toBe(true);
  });
});
