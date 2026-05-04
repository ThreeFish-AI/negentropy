import { useRef, useState } from "react";

import type { ModelConfigItem } from "@/features/knowledge/utils/knowledge-api";

import { LlmModelSelect } from "./LlmModelSelect";
import { AttachmentChipList, type ComposerAttachment } from "./AttachmentChip";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  isGenerating?: boolean;
  isBlocked?: boolean;
  models?: ModelConfigItem[];
  selectedLlmModel?: string | null;
  onSelectedLlmModelChange?: (value: string | null) => void;
  /**
   * 中断门 — 当 isGenerating=true 时，主按钮切换为 Stop；点击触发本回调。
   * 复用 NdjsonHttpAgent.abortRun()（最小干预，不引入新协议事件）。
   * 详见 docs/issue.md ISSUE-040 关于运行中状态的人因学需求。
   */
  onCancel?: () => void;
  /**
   * 附件 — Multi-modal 输入；空数组表示无附件。
   * 与 AG-UI Multi-modal 子集对齐（详见 docs/framework.md §9 协议规范）。
   */
  attachments?: ComposerAttachment[];
  onAttachmentsChange?: (attachments: ComposerAttachment[]) => void;
  /**
   * 单文件最大字节数限制（默认 20MB）。超过即拒绝，避免大文件阻塞 stream。
   */
  attachmentMaxBytes?: number;
  /**
   * 允许的 MIME 通配；undefined 表示所有 image/* + application/pdf + text/*。
   */
  attachmentAccept?: string;
};

const DEFAULT_ATTACHMENT_ACCEPT = ".pdf,.txt,.md,application/pdf,image/*,text/*";
const DEFAULT_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  isGenerating,
  isBlocked,
  models,
  selectedLlmModel,
  onSelectedLlmModelChange,
  onCancel,
  attachments,
  onAttachmentsChange,
  attachmentMaxBytes = DEFAULT_ATTACHMENT_MAX_BYTES,
  attachmentAccept = DEFAULT_ATTACHMENT_ACCEPT,
}: ComposerProps) {
  const showModelSelect = Boolean(models && onSelectedLlmModelChange);
  const showAttachments = Boolean(onAttachmentsChange);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const handleAddFiles = (files: FileList | File[] | null) => {
    if (!files || !onAttachmentsChange) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    const oversized = list.find((f) => f.size > attachmentMaxBytes);
    if (oversized) {
      setAttachmentError(
        `${oversized.name} 超过 ${Math.floor(attachmentMaxBytes / (1024 * 1024))}MB 上限，已忽略`,
      );
      return;
    }
    setAttachmentError(null);
    const next: ComposerAttachment[] = list.map((file) => ({
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      name: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
    }));
    onAttachmentsChange([...(attachments ?? []), ...next]);
  };

  const handleRemoveAttachment = (id: string) => {
    if (!onAttachmentsChange) return;
    onAttachmentsChange((attachments ?? []).filter((a) => a.id !== id));
  };

  const showStop = Boolean(isGenerating && onCancel);

  return (
    <form
      data-testid="composer-form"
      className="mt-6 rounded-2xl border border-border bg-card p-4"
      autoComplete="off"
      onSubmit={(e) => e.preventDefault()}
      onDragEnter={(e) => {
        if (!showAttachments) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        if (!showAttachments) return;
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!showAttachments) return;
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={(e) => {
        if (!showAttachments) return;
        e.preventDefault();
        setDragOver(false);
        handleAddFiles(e.dataTransfer.files);
      }}
    >
      <textarea
        name="prompt_content"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-testid="composer-textarea"
        className={`h-28 w-full resize-none rounded-lg border bg-input p-3 text-sm outline-none placeholder:text-input-placeholder ${
          dragOver
            ? "border-amber-400 ring-2 ring-amber-300/60"
            : "border-border focus:border-text-secondary"
        }`}
        placeholder={dragOver ? "释放以添加附件..." : "输入指令..."}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
      />
      {showAttachments && attachments && attachments.length > 0 && (
        <div className="mt-2" data-testid="composer-attachments">
          <AttachmentChipList
            attachments={attachments}
            onRemove={handleRemoveAttachment}
          />
        </div>
      )}
      {attachmentError && (
        <div
          className="mt-2 rounded-md bg-rose-50 px-3 py-1 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
          data-testid="composer-attachment-error"
        >
          {attachmentError}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {showModelSelect && (
            <LlmModelSelect
              models={models ?? []}
              value={selectedLlmModel ?? ""}
              onChange={(v) => onSelectedLlmModelChange?.(v === "" ? null : v)}
              placeholder="Default"
              allowClear
              ariaLabel="选择主 Agent 使用的 LLM"
            />
          )}
          {showAttachments && (
            <>
              <input
                ref={fileInputRef}
                data-testid="composer-file-input"
                type="file"
                accept={attachmentAccept}
                multiple
                className="hidden"
                onChange={(e) => {
                  handleAddFiles(e.target.files);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <button
                type="button"
                data-testid="composer-attach-button"
                aria-label="添加附件"
                title="添加附件（PDF / 图片 / 文本，≤ 20MB）"
                className="rounded-md border border-border bg-input px-2 py-1 text-xs text-muted hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled && !isGenerating}
              >
                + 附件
              </button>
            </>
          )}
          <p className="text-xs text-muted truncate">Shift+Enter 换行</p>
        </div>
        {showStop ? (
          <button
            type="button"
            data-testid="composer-stop-button"
            aria-label="中断当前任务"
            className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition-all flex items-center gap-2 hover:bg-rose-700"
            onClick={onCancel}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-white" aria-hidden="true" />
            Stop
          </button>
        ) : (
          <button
            type="button"
            data-testid="composer-send-button"
            className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-40 transition-all flex items-center gap-2"
            onClick={onSend}
            disabled={disabled || (!value.trim() && (attachments?.length ?? 0) === 0)}
          >
            {isGenerating && (
              <span className="h-2 w-2 rounded-full bg-background animate-pulse" />
            )}
            {isBlocked ? "Waiting..." : isGenerating ? "Generating..." : "Send"}
          </button>
        )}
      </div>
    </form>
  );
}
