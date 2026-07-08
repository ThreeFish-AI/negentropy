"use client";

import { forwardRef, useContext, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldContext } from "./Field";
import { baseInputCls } from "./Input";

/**
 * Select — 下拉选择控件原语。原生 `<select>` + 自定义 chevron。
 *
 * - `appearance-none pr-9` 隐藏原生箭头，由绝对定位 `ChevronDown`（lucide）替代，统一视觉；
 * - `trailing` 槽位：渲染于 chevron 左侧的附加节点（如 CorpusSelect 的 loading spinner，
 *   调用方以 `pointer-events-none absolute right-9 …` 定位）；
 * - 因外层包 `relative w-full`，复合行内调用方需再包 `<div className="min-w-0 flex-1">`；
 * - 经 {@link FieldContext} 自动拾取 <Field> 下发的 id 作 fallback。
 */
export interface SelectProps extends ComponentPropsWithoutRef<"select"> {
  className?: string;
  /** chevron 左侧的附加节点（如 loading spinner）。 */
  trailing?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, trailing, id, children, ...props },
  ref,
) {
  const fieldId = useContext(FieldContext);
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        id={id ?? fieldId}
        className={cn(baseInputCls, "appearance-none pr-9", className)}
        {...props}
      >
        {children}
      </select>
      {trailing}
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
        aria-hidden
      />
    </div>
  );
});
