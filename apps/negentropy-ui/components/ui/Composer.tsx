import type { ModelConfigItem } from "@/features/knowledge/utils/knowledge-api";

import { LlmModelSelect } from "./LlmModelSelect";

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
};

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
}: ComposerProps) {
  const showModelSelect = Boolean(models && onSelectedLlmModelChange);
  return (
    <form
      className="mt-6 rounded-2xl border border-border bg-card p-4"
      autoComplete="off"
      onSubmit={(e) => e.preventDefault()}
    >
      <textarea
        name="prompt_content"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="h-28 w-full resize-none rounded-lg border border-border bg-input p-3 text-sm outline-none focus:border-text-secondary placeholder:text-input-placeholder"
        placeholder="输入指令..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
      />
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
          <p className="text-xs text-muted truncate">Shift+Enter 换行</p>
        </div>
        <button
          type="button"
          className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-40 transition-all flex items-center gap-2"
          onClick={onSend}
          disabled={disabled || !value.trim()}
        >
          {isGenerating && (
            <span className="h-2 w-2 rounded-full bg-background animate-pulse" />
          )}
          {isBlocked ? "Waiting..." : isGenerating ? "Generating..." : "Send"}
        </button>
      </div>
    </form>
  );
}
