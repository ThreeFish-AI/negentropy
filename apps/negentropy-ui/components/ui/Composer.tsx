import { useCallback, useEffect, useRef, useState } from "react";

import type { ModelConfigItem } from "@/features/knowledge/utils/knowledge-api";
import type { MentionCandidate, MentionToken } from "@/types/mention";
import {
  applyMention,
  detectMentionTrigger,
  reconcileMentions,
} from "@/utils/mention-parser";

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
        ref={textareaRef}
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
      {showMentions && mentions && mentions.length > 0 && (
        <div className="mt-2" data-testid="composer-mentions-wrapper">
          <MentionChipList mentions={mentions} onRemove={handleMentionRemove} />
        </div>
      )}
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
              className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2 text-xs font-medium transition-colors ${
                thinkingSupported && thinkingEnabled
                  ? "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                  : "border-border bg-input text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  thinkingSupported && thinkingEnabled
                    ? "bg-amber-500"
                    : "bg-zinc-400 dark:bg-zinc-600"
                }`}
              />
              Thinking
            </button>
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
          <p className="text-xs text-muted truncate">
            Shift+Enter 换行{showMentions ? " · @ 选 Agent / 知识库" : ""}
          </p>
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
            // disabled 与 home-body.doSend/sendInput 的 `!input.trim()` 守卫保持一致；
            // MVP 阶段附件仅作为 metadata 透传，无文本时点 Send 会被守卫静默拒绝，故不允许仅附件触发发送。
            // 完整 read_attachment 工具落地后（V1 增强），可同步放开守卫与 disabled 条件。
            disabled={disabled || !value.trim()}
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
