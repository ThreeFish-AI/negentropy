/**
 * Attachment chip — 在 Composer 与 MessageBubble 中复用的附件展示与操作组件。
 *
 * 设计原则（参考 AG-UI Multi-modal Annex 与 A2UI 白名单组件清单）：
 * - 非交互场景（消息气泡内）传 readOnly=true，仅展示图标 + 文件名 + 体积；
 * - Composer 场景传 onRemove，提供 ✕ 按钮供撤回。
 *
 * 注意：本组件不进入 message-ledger 比对（dedup 仅看 text content），避免触发 ISSUE-031 双气泡时间窗。
 */
"use client";

export type ComposerAttachment = {
  id: string;
  file?: File;
  /** 上传完成后的远程 URL（可选，用于持久化展示） */
  url?: string;
  name: string;
  mime: string;
  size: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function pickIcon(mime: string): string {
  if (mime.startsWith("image/")) return "🖼";
  if (mime.includes("pdf")) return "📄";
  if (mime.startsWith("text/") || mime.includes("markdown")) return "📝";
  return "📎";
}

export function AttachmentChip({
  attachment,
  onRemove,
  readOnly,
}: {
  attachment: ComposerAttachment;
  onRemove?: (id: string) => void;
  readOnly?: boolean;
}) {
  return (
    <span
      data-testid="attachment-chip"
      data-attachment-name={attachment.name}
      data-attachment-mime={attachment.mime}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-input px-2 py-0.5 text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 max-w-[14rem]"
      title={`${attachment.name} (${formatBytes(attachment.size)})`}
    >
      <span aria-hidden="true">{pickIcon(attachment.mime)}</span>
      <span className="truncate">{attachment.name}</span>
      <span className="text-muted shrink-0">{formatBytes(attachment.size)}</span>
      {!readOnly && onRemove && (
        <button
          type="button"
          aria-label={`移除附件 ${attachment.name}`}
          data-testid="attachment-chip-remove"
          onClick={() => onRemove(attachment.id)}
          className="ml-0.5 rounded-full text-muted hover:text-rose-500"
        >
          ✕
        </button>
      )}
    </span>
  );
}

export function AttachmentChipList({
  attachments,
  onRemove,
  readOnly,
}: {
  attachments: ComposerAttachment[];
  onRemove?: (id: string) => void;
  readOnly?: boolean;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <AttachmentChip
          key={attachment.id}
          attachment={attachment}
          onRemove={onRemove}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
