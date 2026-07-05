"use client";

/**
 * TextTooltip — 行内「截断文本」的单行悬浮提示原语。
 *
 * 与通用 [[Tooltip]] 的分工（正交分解）：
 * - **触发器**：通用 `Tooltip` 内部包成 `<button>`（适合图标/操作触发）；本原语用 `asChild` 以
 *   调用方元素（如 `<span class="truncate">`）为触发器，语义中立、不额外占用 tab stop、适合表格
 *   密集单元格。
 * - **内容**：默认 `whitespace-nowrap` + `max-w-none`，**强制单行不折**（满足列表页「Tooltip 不折行」
 *   要求）；通用 `Tooltip` 默认 `max-w-sm` 富文本可折行。
 * - **溢出感知**：仅当触发元素实际溢出（`scrollWidth > clientWidth`）才展开，避免未截断的单元格
 *   弹出冗余提示。
 *
 * Radix `Tooltip.Trigger asChild` v1.2 不对 span 强加 `tabindex`，故不会污染键盘 tab 序。
 */

import { useRef, useState, type ReactElement, type ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

type Side = "top" | "right" | "bottom" | "left";
type Align = "start" | "center" | "end";

export interface TextTooltipProps {
  /** 浮层内容（单行展示）。 */
  content: ReactNode;
  /** 触发器元素（须能接收 ref 与事件合并，通常为带 `truncate` 的 `<span>` / `<div>`）。 */
  children: ReactElement;
  side?: Side;
  align?: Align;
  /** 触发器与浮层间距（px），默认 6。 */
  sideOffset?: number;
  /** 悬停到出现的延迟（ms），默认 150。 */
  delayDuration?: number;
  /** 离开后再次出现的跳过延迟（ms），默认 120。 */
  skipDelayDuration?: number;
  /** 关闭溢出感知（默认仅截断时展开）；置 false 则恒展开（供内容与可见文本不一致的场景，如 STATUS 组合标题）。 */
  showOnOverflowOnly?: boolean;
}

export function TextTooltip({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 6,
  delayDuration = 150,
  skipDelayDuration = 120,
  showOnOverflowOnly = true,
}: TextTooltipProps) {
  const [open, setOpen] = useState(false);
  // Radix Trigger ref 类型为 HTMLButtonElement；asChild 时实际指向调用方元素（span/div），
  // 仅访问 Element 级属性（scrollWidth/clientWidth），类型对齐避免 cast。
  const trigRef = useRef<HTMLButtonElement | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setOpen(false);
      return;
    }
    // 展开门控：溢出感知模式下，仅当触发元素实际截断才展开（消除冗余提示）。
    if (showOnOverflowOnly) {
      const el = trigRef.current;
      setOpen(!!el && el.scrollWidth > el.clientWidth);
    } else {
      setOpen(true);
    }
  };

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration}>
      <TooltipPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <TooltipPrimitive.Trigger asChild ref={trigRef}>
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={sideOffset}
            className="z-[60] max-w-none whitespace-nowrap rounded-md border border-border bg-zinc-800 px-2.5 py-1.5 text-caption text-white shadow-lg dark:bg-zinc-700 dark:text-zinc-100"
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
