"use client";

import { forwardRef, useContext, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import { FieldContext } from "./Field";

/**
 * Input — 文本输入控件原语（单一事实源）。
 *
 * 统一全仓历史 4 套 input 样式约定到 token 化基线 {@link baseInputCls}：
 * - 圆角 / 边框 / 底色 / 聚焦环均用 @theme 语义 token（随明暗翻转）；
 * - `focus:ring-2 ring-ring/60` 较历史 `ring-1` 或硬编码蓝更符合 AA 可见性；
 * - `min-w-0` 内置，保证在 flex 复合行内可收缩；
 * - `w-full` 为默认，复合行由调用方 `className="w-auto flex-1"` 覆盖（cn/tailwind-merge 生效）。
 *
 * 经 {@link FieldContext} 自动拾取 <Field> 下发的 id 作 fallback，实现零样板 label↔控件关联。
 */

/** 输入控件类名 SSOT —— 表单输入族（Input/Select/Textarea）共用。 */
export const baseInputCls =
  "w-full min-w-0 rounded-control border border-border bg-input px-3 py-2 text-sm text-foreground transition-colors placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-60";

export interface InputProps extends ComponentPropsWithoutRef<"input"> {
  className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", id, ...props },
  ref,
) {
  const fieldId = useContext(FieldContext);
  return (
    <input
      ref={ref}
      type={type}
      id={id ?? fieldId}
      className={cn(baseInputCls, className)}
      {...props}
    />
  );
});
