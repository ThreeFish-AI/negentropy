import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, Square, Sparkles } from "lucide-react";

import type { ModelConfigItem } from "@/features/knowledge/utils/knowledge-api";
import type { MentionCandidate, MentionToken } from "@negentropy/agents-chat-core/parse";
import {
  applyMention,
  detectMentionTrigger,
  reconcileMentions,
} from "@negentropy/agents-chat-core/parse";

import { LlmModelSelect } from "./LlmModelSelect";
import { AttachmentChipList, type ComposerAttachment } from "./AttachmentChip";
import { MentionChipList } from "./MentionChipList";
import { MentionPopover } from "./MentionPopover";

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
  thinkingEnabled?: boolean;
  thinkingSupported?: boolean;
  onThinkingEnabledChange?: (value: boolean) => void;
  /**
   * 中断门 — 当 isGenerating=true 时，主按钮切换为 Stop；点击触发本回调。
   * 复用 NdjsonHttpAgent.abortRun()（最小干预，不引入新协议事件）。
   * 详见 docs/issue.md ISSUE-040 关于运行中状态的人因学需求。
   */
  onCancel?: () => void;
  /**
   * 附件 — Multi-modal 输入；空数组表示无附件。
   * 与 AG-UI Multi-modal 子集对齐（详见 docs/architecture/framework.md §9 协议规范）。
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
  /**
   * @ Mention 系统 —— 全部可选，未传时 Composer 行为完全等同于改造前（向后兼容）。
   * 接入方需同时传 ``mentions / onMentionsChange`` 及候选项数据源。
   */
  mentions?: MentionToken[];
  onMentionsChange?: (next: MentionToken[]) => void;
  agentCandidates?: MentionCandidate[];
  corpusCandidates?: MentionCandidate[];
  agentsLoading?: boolean;
  agentsError?: string | null;
  corporaLoading?: boolean;
  corporaError?: string | null;
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
  thinkingEnabled = false,
  thinkingSupported = true,
  onThinkingEnabledChange,
  onCancel,
  attachments,
  onAttachmentsChange,
  attachmentMaxBytes = DEFAULT_ATTACHMENT_MAX_BYTES,
  attachmentAccept = DEFAULT_ATTACHMENT_ACCEPT,
  mentions,
  onMentionsChange,
  agentCandidates,
  corpusCandidates,
  agentsLoading,
  agentsError,
  corporaLoading,
  corporaError,
}: ComposerProps) {
  const showModelSelect = Boolean(models && onSelectedLlmModelChange);
  const showThinkingToggle = Boolean(onThinkingEnabledChange);
  const showAttachments = Boolean(onAttachmentsChange);
  const showMentions = Boolean(onMentionsChange);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isComposingRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  // --------------------------------------------------------------------
  // @ Mention 弹层状态：trigger 由 onChange / onSelect 检测，position 锁定
  // textarea 左下角（不依赖光标具体像素，避免 caret 测量复杂度）。
  // --------------------------------------------------------------------
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverQuery, setPopoverQuery] = useState("");
  const triggerRangeRef = useRef<{ start: number; end: number } | null>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  // --------------------------------------------------------------------
  // Auto-resize：根据内容动态调整 textarea 高度
  // --------------------------------------------------------------------
  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const recomputePopoverPos = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const rect = ta.getBoundingClientRect();
    setPopoverPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  const tryDetectTrigger = useCallback(
    (val: string, caret: number) => {
      if (!showMentions || isComposingRef.current) {
        setPopoverOpen(false);
        return;
      }
      const trig = detectMentionTrigger(val, caret);
      if (!trig) {
        setPopoverOpen(false);
        triggerRangeRef.current = null;
        return;
      }
      triggerRangeRef.current = { start: trig.start, end: trig.end };
      setPopoverQuery(trig.queryText);
      setPopoverOpen(true);
      recomputePopoverPos();
    },
    [showMentions, recomputePopoverPos],
  );

  useEffect(() => {
    if (!popoverOpen) return;
    const handle = () => recomputePopoverPos();
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [popoverOpen, recomputePopoverPos]);

  const handleMentionPick = useCallback(
    (candidate: MentionCandidate) => {
      const trig = triggerRangeRef.current;
      if (!trig || !onMentionsChange) {
        setPopoverOpen(false);
        return;
      }
      const result = applyMention(value, { ...trig, queryText: popoverQuery }, candidate);
      onChange(result.value);
      onMentionsChange([...(mentions ?? []), result.token]);
      setPopoverOpen(false);
      triggerRangeRef.current = null;
      // 异步把光标移到 mention 插入后的位置，确保用户可继续输入
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(result.caret, result.caret);
      });
    },
    [value, popoverQuery, onChange, onMentionsChange, mentions],
  );

  const handleMentionRemove = useCallback(
    (tokenId: string) => {
      if (!onMentionsChange || !mentions) return;
      const target = mentions.find((m) => m.id === tokenId);
      if (!target) return;
      // 移除 textarea 中对应 rawText（含尾空格）—— 找最近 anchor 出现位置
      const haystack = value;
      const idx = haystack.indexOf(target.rawText, Math.max(0, target.start - 16));
      let nextValue = value;
      if (idx >= 0) {
        // 同时吞掉紧跟的一个空格（applyMention 写入的闭合空格）
        const end =
          idx + target.rawText.length < haystack.length &&
          haystack[idx + target.rawText.length] === " "
            ? idx + target.rawText.length + 1
            : idx + target.rawText.length;
        nextValue = haystack.slice(0, idx) + haystack.slice(end);
        onChange(nextValue);
      }
      const survivors = reconcileMentions(value, nextValue, mentions).filter(
        (m) => m.id !== tokenId,
      );
      onMentionsChange(survivors);
    },
    [value, mentions, onMentionsChange, onChange],
  );

  const handleAddFiles = (files: FileList | File[] | null) => {
    if (!files || !onAttachmentsChange) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    // 过滤式接受：超大文件单独列出，合规文件正常进入；避免一颗老鼠屎拒掉整批拖拽。
    const oversized = list.filter((f) => f.size > attachmentMaxBytes);
    const accepted = list.filter((f) => f.size <= attachmentMaxBytes);
    if (oversized.length > 0) {
      setAttachmentError(
        `${oversized.map((f) => f.name).join(", ")} 超过 ${Math.floor(attachmentMaxBytes / (1024 * 1024))}MB 上限，已忽略`,
      );
    } else {
      setAttachmentError(null);
    }
    if (accepted.length === 0) return;
    const next: ComposerAttachment[] = accepted.map((file) => ({
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

  const hasContent = Boolean(
    (showMentions && mentions && mentions.length > 0) ||
    (showAttachments && attachments && attachments.length > 0) ||
    attachmentError,
  );

  return (
    <form
      data-testid="composer-form"
      className={`group/composer rounded-2xl border bg-card p-3 transition-all duration-200 ${
        dragOver
          ? "border-amber-400/80 shadow-[0_0_0_2px_rgba(251,191,36,0.25)]"
          : "border-border/60 shadow-sm focus-within:shadow-md focus-within:border-text-secondary/30"
      }`}
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
      {/* Mention chips */}
      {showMentions && mentions && mentions.length > 0 && (
        <div className="mb-2" data-testid="composer-mentions-wrapper">
          <MentionChipList mentions={mentions} onRemove={handleMentionRemove} />
        </div>
      )}

      {/* Attachment chips */}
      {showAttachments && attachments && attachments.length > 0 && (
        <div className="mb-2" data-testid="composer-attachments">
          <AttachmentChipList
            attachments={attachments}
            onRemove={handleRemoveAttachment}
          />
        </div>
      )}

      {/* Attachment error */}
      {attachmentError && (
        <div
          className="mb-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
          data-testid="composer-attachment-error"
        >
          {attachmentError}
        </div>
      )}

      {/* Textarea + Send button row */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          name="prompt_content"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-testid="composer-textarea"
          className="min-h-[52px] max-h-[200px] w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-input-placeholder"
          placeholder={dragOver ? "释放以添加附件..." : "输入指令..."}
          value={value}
          rows={1}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next);
            if (showMentions) {
              // 同步对齐 mention offset，防止编辑前缀导致区间漂移
              if (mentions && onMentionsChange && mentions.length > 0) {
                const reconciled = reconcileMentions(value, next, mentions);
                if (reconciled !== mentions) onMentionsChange(reconciled);
              }
              tryDetectTrigger(next, event.target.selectionStart ?? next.length);
            }
          }}
          onSelect={(event) => {
            if (!showMentions) return;
            const ta = event.currentTarget;
            tryDetectTrigger(ta.value, ta.selectionStart ?? ta.value.length);
          }}
          onCompositionStart={() => {
            isComposingRef.current = true;
            setPopoverOpen(false);
          }}
          onCompositionEnd={(event) => {
            isComposingRef.current = false;
            if (showMentions) {
              const ta = event.currentTarget;
              tryDetectTrigger(ta.value, ta.selectionStart ?? ta.value.length);
            }
          }}
          onKeyDown={(event) => {
            // 弹层打开时，↑↓ Enter Tab Esc 由 MentionPopover 全局监听拦截，
            // textarea 自身仅在 Enter 未被拦截（弹层关闭/无候选）时触发发送。
            if (event.key === "Enter" && !event.shiftKey && !popoverOpen) {
              event.preventDefault();
              onSend();
            }
          }}
          onBlur={(event) => {
            // 仅当焦点离开 textarea + 不在 mention 弹层内部时关闭
            // —— 点击 Popover Tab / 候选项不应关闭弹层。
            const next = event.relatedTarget as HTMLElement | null;
            if (next && next.closest('[data-testid="mention-popover"]')) {
              return;
            }
            setTimeout(() => setPopoverOpen(false), 150);
          }}
        />

        {/* Send / Stop button */}
        {showStop ? (
          <button
            type="button"
            data-testid="composer-stop-button"
            aria-label="Stop"
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white transition-all hover:bg-rose-700"
            onClick={onCancel}
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            data-testid="composer-send-button"
            aria-label="Send"
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-all hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed"
            onClick={onSend}
            disabled={disabled || !value.trim() || !!isBlocked}
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Mention popover */}
      {showMentions && (
        <MentionPopover
          open={popoverOpen}
          position={popoverPos}
          queryText={popoverQuery}
          agentCandidates={agentCandidates ?? []}
          corpusCandidates={corpusCandidates ?? []}
          agentsLoading={agentsLoading}
          agentsError={agentsError ?? null}
          corporaLoading={corporaLoading}
          corporaError={corporaError ?? null}
          onPick={handleMentionPick}
          onClose={() => setPopoverOpen(false)}
        />
      )}

      {/* Toolbar row */}
      <div className={`flex items-center justify-between gap-2 ${hasContent ? "mt-2" : "mt-1"}`}>
        <div className="flex items-center gap-1.5 min-w-0">
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
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled && !isGenerating}
              >
                <Paperclip className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          )}
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
          {showThinkingToggle && (
            <button
              type="button"
              role="switch"
              aria-checked={thinkingSupported && thinkingEnabled}
              aria-label={
                thinkingSupported
                  ? "切换 Thinking 推理增强"
                  : "当前模型不支持 Thinking 推理增强"
              }
              title={
                thinkingSupported
                  ? "Thinking：请求模型启用更强推理"
                  : "当前模型未声明支持 Thinking"
              }
              data-testid="composer-thinking-toggle"
              disabled={!thinkingSupported || (disabled && !isGenerating)}
              onClick={() => {
                if (!thinkingSupported) return;
                onThinkingEnabledChange?.(!thinkingEnabled);
              }}
              className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors ${
                thinkingSupported && thinkingEnabled
                  ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                  : "border-transparent text-muted hover:text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Thinking
            </button>
          )}
        </div>
        <p className="text-[10px] text-text-muted/60 shrink-0 select-none">
          {showMentions ? "@ 选 Agent · " : ""}Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </form>
  );
}
