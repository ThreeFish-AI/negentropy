type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  isGenerating?: boolean;
};

export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  isGenerating,
}: ComposerProps) {
  return (
    <form
      className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4"
      autoComplete="off"
      onSubmit={(e) => e.preventDefault()}
    >
      <textarea
        name="prompt_content"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="h-28 w-full resize-none rounded-lg border border-zinc-200 p-3 text-sm outline-none focus:border-zinc-400"
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
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-zinc-500">Shift+Enter 换行</p>
        <button
          type="button"
          className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 transition-all flex items-center gap-2"
          onClick={onSend}
          disabled={disabled || !value.trim()}
        >
          {isGenerating && (
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          )}
          {isGenerating ? "Generating..." : "Send"}
        </button>
      </div>
    </form>
  );
}
