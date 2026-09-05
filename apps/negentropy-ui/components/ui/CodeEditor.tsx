"use client";

import { useContext, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import { baseInputCls } from "./Input";
import { FieldContext } from "./Field";

/**
 * CodeEditor — 定义源「整段源文本」编辑器（YAML / Markdown）。
 *
 * MVP 采用增强 <textarea>（等宽字体 + Tab 插入两空格 + 语言角标），零外部依赖、
 * 无 lockfile 变更风险，契合方案「整段源文本入库 + 编辑器表单」。后续可平滑升级为
 * CodeMirror 6（YAML/Markdown 高亮）——仅替换本组件内部实现，调用方 API 不变。
 *
 * 受控组件：``value`` + ``onValueChange``。Tab 键在光标处插入两空格并保持缩进节奏，
 * 阻止默认「焦点跳出」行为（代码编辑更顺手）。
 */
export interface CodeEditorProps
  extends Omit<ComponentPropsWithoutRef<"textarea">, "onChange" | "value"> {
  value: string;
  onValueChange: (next: string) => void;
  /** 语言角标（如 "yaml" / "markdown"）。 */
  language?: string;
  className?: string;
}

export function CodeEditor({
  value,
  onValueChange,
  language,
  className,
  id,
  rows = 18,
  disabled,
  ...props
}: CodeEditorProps) {
  const fieldId = useContext(FieldContext);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = value.slice(0, start) + "  " + value.slice(end);
    onValueChange(next);
    // 恢复光标到插入后的位置（下一帧，避免受控回写覆盖）。
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + 2;
    });
  };

  return (
    <div className={cn("relative", className)}>
      {language ? (
        <span className="pointer-events-none absolute right-2 top-2 z-10 rounded bg-muted px-1.5 py-0.5 text-micro uppercase tracking-wide text-text-muted">
          {language}
        </span>
      ) : null}
      <textarea
        id={id ?? fieldId}
        rows={rows}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        disabled={disabled}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(
          baseInputCls,
          "resize-y whitespace-pre font-mono text-xs leading-relaxed",
          "min-h-[16rem] overflow-auto",
        )}
        {...props}
      />
    </div>
  );
}
