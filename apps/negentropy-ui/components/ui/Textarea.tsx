"use client";

import { forwardRef, useContext, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import { FieldContext } from "./Field";
import { baseInputCls } from "./Input";

/**
 * Textarea — 多行文本控件原语。复用 {@link baseInputCls}，默认 `rows=3`、可纵向缩放。
 * 经 {@link FieldContext} 自动拾取 <Field> 下发的 id 作 fallback。
 */
export interface TextareaProps extends ComponentPropsWithoutRef<"textarea"> {
  className?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, id, rows = 3, ...props },
  ref,
) {
  const fieldId = useContext(FieldContext);
  return (
    <textarea
      ref={ref}
      id={id ?? fieldId}
      rows={rows}
      className={cn(baseInputCls, "resize-y", className)}
      {...props}
    />
  );
});
