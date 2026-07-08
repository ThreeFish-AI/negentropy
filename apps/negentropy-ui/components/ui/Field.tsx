"use client";

import { createContext, useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TextTooltip } from "./TextTooltip";
import { Tooltip } from "./Tooltip";
import { HelpCircle } from "lucide-react";

/**
 * Field — 水平表单字段原语（label 与控件同行，label 固定占 1/12 宽）。
 *
 * 落实 AGENTS.md「UI 表单设计规范」：字段 label 与输入控件**同行**（非上下堆叠），
 * label 一律仅占 1/12 宽度。超长 label 经 [[TextTooltip]] 溢出感知截断（省略号 + 悬停全文），
 * 与表格「截断 + Tooltip」哲学一致。
 *
 * 布局（12 栅格）：`col-span-1` label 格 + `col-span-11` 控件格。
 * - label 格 `min-w-0`（grid item 默认 min-width:auto 会阻止 truncate）；
 * - label 元素本身亦 `min-w-0 truncate`，作为 TextTooltip 的 asChild 触发器，
 *   溢出门控读其 scrollWidth/clientWidth，仅在真正省略号时弹浮层。
 *
 * 变体：
 * - `standard`（默认）：label 在 1/12 格，控件在 11/12 格；
 * - `check`：勾选框 / 开关类（控件即 label），1/12 格留空作缩进对齐，11/12 格内以 `<label>`
 *   包裹「控件 + 文本」实现隐式关联（点击文本切换勾选）。
 *
 * 经 {@link FieldContext} 自动生成字段 id，供 {@link Input}/{@link Select}/{@link Textarea}
 * 作 fallback `id`，实现零样板 label↔控件关联（a11y）。
 */

/** 字段 id 上下文：<Field> 生成并下发，控件原语消费作 fallback id。 */
export const FieldContext = createContext<string | undefined>(undefined);

export interface FieldProps {
  /** 字段 label（支持富文本）。超长时省略号截断，悬停 TextTooltip 显示全文。 */
  label: ReactNode;
  /** 显式指定关联控件 id；缺省则用 <Field> 自动生成的 id。 */
  htmlFor?: string;
  /** 是否必填（渲染红色 `*`）。 */
  required?: boolean;
  /** 字段说明：在 label 旁渲染 `?` 图标（Tooltip 悬停展示）。 */
  hint?: ReactNode;
  /** 字段错误：在控件下方渲染 `<p role="alert" className="text-error">`。 */
  error?: string;
  /** 帮助文本：在控件下方渲染（11/12 格内）。 */
  description?: ReactNode;
  /** 控件（Input / Select / Textarea / 复合 div）。 */
  children: ReactNode;
  /** 根容器额外类名。 */
  className?: string;
  /** 布局变体：standard（默认）/ check（勾选框/开关）。 */
  variant?: "standard" | "check";
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  description,
  children,
  className,
  variant = "standard",
}: FieldProps) {
  const autoId = useId();
  const fieldId = htmlFor ?? autoId;

  // check 变体：控件即 label（勾选框/开关），1/12 格留空对齐全局左缩进。
  if (variant === "check") {
    return (
      <FieldContext.Provider value={fieldId}>
        <div className={cn("grid grid-cols-12 gap-x-3 items-start", className)}>
          <div className="col-span-1" aria-hidden />
          <div className="col-span-11 min-w-0 space-y-1">
            {/* 隐式关联：勾选控件作为 <label> 后代，点击文本即可切换。 */}
            <label htmlFor={htmlFor} className="flex items-center gap-2 text-sm text-foreground">
              {children}
              <span className="text-text-secondary">{label}</span>
              {required && <span className="text-error"> *</span>}
            </label>
            {description && <p className="text-caption text-text-muted">{description}</p>}
            {error && (
              <p role="alert" className="text-xs text-error">
                {error}
              </p>
            )}
          </div>
        </div>
      </FieldContext.Provider>
    );
  }

  return (
    <FieldContext.Provider value={fieldId}>
      <div className={cn("grid grid-cols-12 gap-x-3 items-start", className)}>
        {/* label 格：1/12，min-w-0 允许内部 truncate；pt-2 与控件首行基线对齐。 */}
        <div className="col-span-1 flex min-w-0 items-center gap-1 pt-2">
          <TextTooltip content={label}>
            <label
              htmlFor={fieldId}
              className="min-w-0 truncate text-xs font-medium text-text-secondary"
            >
              {label}
              {required && <span className="text-error"> *</span>}
            </label>
          </TextTooltip>
          {hint && (
            <Tooltip content={hint} triggerProps={{ "aria-label": "字段说明" }}>
              <HelpCircle className="h-3 w-3 shrink-0 text-text-muted" />
            </Tooltip>
          )}
        </div>
        {/* 控件格：11/12。description / error 紧随控件，置于同列。 */}
        <div className="col-span-11 min-w-0 space-y-1">
          {children}
          {description && <p className="text-caption text-text-muted">{description}</p>}
          {error && (
            <p role="alert" className="text-xs text-error">
              {error}
            </p>
          )}
        </div>
      </div>
    </FieldContext.Provider>
  );
}

/**
 * InlineField — 紧凑同质字段组的内联原语（用于密集数字输入网格，如 Budget & Approval）。
 *
 * 与 {@link Field} 的分工：Field 是「全宽单字段一行」（label 1/12 + 控件 11/12）；
 * InlineField 用于在调用方提供的 `grid-cols-N` 网格单元内，label 与控件**按单元宽度**内联，
 * label `max-w-[50%]` 封顶（避免吃掉数值输入），仍 `min-w-0 truncate` + TextTooltip。
 * 替代历史 `labelInlineCls = "shrink-0 whitespace-nowrap"`（原先不截断），补齐截断语义。
 */
export interface InlineFieldProps {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function InlineField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: InlineFieldProps) {
  const autoId = useId();
  const fieldId = htmlFor ?? autoId;
  return (
    <FieldContext.Provider value={fieldId}>
      <div className={cn("flex min-w-0 items-center gap-2", className)}>
        <TextTooltip content={label}>
          <label
            htmlFor={fieldId}
            className="max-w-[50%] min-w-0 shrink-0 truncate text-xs font-medium text-text-secondary"
          >
            {label}
            {required && <span className="text-error"> *</span>}
          </label>
        </TextTooltip>
        {hint && (
          <Tooltip content={hint} triggerProps={{ "aria-label": "字段说明" }}>
            <HelpCircle className="h-3 w-3 shrink-0 text-text-muted" />
          </Tooltip>
        )}
        <div className="min-w-0 flex-1">
          {children}
          {error && (
            <p role="alert" className="mt-0.5 text-xs text-error">
              {error}
            </p>
          )}
        </div>
      </div>
    </FieldContext.Provider>
  );
}
