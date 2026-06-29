"use client";

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

/**
 * Tooltip — 可复用浮层提示原语（单一事实源）。
 *
 * 设计要点：
 * - **自包含 Provider**：仓库无全局 Tooltip.Provider，本组件内联 `<Provider>`，
 *   调用方零样板即可使用（与 {@link MentionPopover} 局部 Provider 模式一致）。
 * - **简单声明式 API**：`<Tooltip content={<ReactNode/>}>{trigger}</Tooltip>`；
 *   `content` 接富 JSX（如指标网格），非仅字符串。
 * - **Portal**：内容经 `Tooltip.Portal` 提至 body，规避父级 `overflow` 裁切。
 * - **可访问性**：Trigger 为原生 `<button>`，键盘 Tab 可达、Focus/Enter 自动展开。
 *
 * 需要精细控制（多触发器、自定义动画）时，调用方可直接用底层
 * `import * as Tooltip from "@radix-ui/react-tooltip"`，本原语不挡路。
 */

/** 浮层出现方向。 */
type Side = "top" | "right" | "bottom" | "left";
/** 浮层与触发器的对齐。 */
type Align = "start" | "center" | "end";

export interface TooltipProps {
  /** 浮层内容（支持富 JSX）。 */
  content: ReactNode;
  /** 触发器元素；内部以 `asChild` 注入 button 语义（需能接收 ref/className）。 */
  children: ReactNode;
  /** 出现方向，默认 top。 */
  side?: Side;
  /** 对齐方式，默认 center。 */
  align?: Align;
  /** 触发器与浮层间距（px），默认 6。 */
  sideOffset?: number;
  /** 悬停到出现的延迟（ms），默认 150（与 MentionPopover 一致）。 */
  delayDuration?: number;
  /** 离开后再次出现的跳过延迟（ms），默认 120。 */
  skipDelayDuration?: number;
  /** 内容自定义类名（宽度/内边距/字号等）；默认 `max-w-sm`。 */
  contentClassName?: string;
  /** 透传给触发器 button 的属性（如 aria-label）。 */
  triggerProps?: Omit<ComponentPropsWithoutRef<"button">, "children">;
}

/**
 * Tooltip 内容容器（已内联 Portal）。导出以供需要精细控制的调用方直接组合使用。
 */
export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        // 复用 MentionPopover 的浮层令牌；z-[60] 与现有浮层层级一致。
        className={cn(
          "z-[60] max-w-sm rounded-md border border-border bg-zinc-800 px-3 py-2 text-caption text-white shadow-lg",
          "dark:bg-zinc-700 dark:text-zinc-100",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});
TooltipContent.displayName = "TooltipContent";

/**
 * 声明式 Tooltip。`children` 作为触发器（建议传 icon/文本节点），内部包成 button。
 */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 6,
  delayDuration = 150,
  skipDelayDuration = 120,
  contentClassName,
  triggerProps,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
    >
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button type="button" {...triggerProps}>
            {children}
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipContent side={side} align={align} sideOffset={sideOffset} className={contentClassName}>
          {content}
        </TooltipContent>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
