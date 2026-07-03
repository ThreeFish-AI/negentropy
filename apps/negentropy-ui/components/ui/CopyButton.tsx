"use client";

/**
 * 通用「复制到剪贴板」图标按钮（Reuse-Driven / Single Source of Truth）。
 *
 * 收敛此前各处内联的 `useState` + `navigator.clipboard.writeText` + lucide `Copy`/`Check` 范式
 * （如 scheduler `SchedulerHandlerSource`、`MessageBubble` 等）。复制成功后图标 `Copy → Check`
 * 短暂切换（~2s 回退）。相较内联实现补齐无障碍：显式 `type="button"` + `aria-label`（复制后切至
 * 「已复制」语义）；点击内 `stopPropagation`/`preventDefault`，使其安全嵌于可点击行/卡片而不冒泡触发父级。
 */

import { useCallback, useState } from "react";

import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CopyButtonProps {
  /** 待复制到剪贴板的文本。 */
  value: string;
  /** 无障碍标签 + 原生 title（默认「复制」；复制后统一切至「已复制」）。 */
  ariaLabel?: string;
  /** 图标尺寸类（默认 `h-3.5 w-3.5`）。 */
  iconClassName?: string;
  /** 追加到按钮根节点的类（如 `shrink-0`）。 */
  className?: string;
}

export function CopyButton({
  value,
  ariaLabel = "复制",
  iconClassName = "h-3.5 w-3.5",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      // 嵌于可点击行/卡片时，阻断冒泡与默认行为，避免触发父级 onClick（如行内打开详情）。
      e.stopPropagation();
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy to clipboard", err);
      }
    },
    [value],
  );

  const label = copied ? "已复制" : ariaLabel;

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded p-1 text-text-muted transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {copied ? (
        <Check className={cn(iconClassName, "text-emerald-500")} aria-hidden />
      ) : (
        <Copy className={iconClassName} aria-hidden />
      )}
    </button>
  );
}
