"use client";

import { type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TextTooltip } from "./TextTooltip";

/**
 * TruncatedCell — 表格单元格「截断 + 溢出 Tooltip」原语（去重全仓 ~20 处习惯写法）。
 *
 * 落实 AGENTS.md「UI 表格设计规范」第 3 条：单元格内容单行、超出省略号截断、悬停 Tooltip 全文。
 * 三种形态由 props 组合覆盖：
 * 1. **纯文本截断**（默认）：`<TruncatedCell text={value} />` → `<td><TextTooltip><span class="truncate"/></TextTooltip></td>`；
 * 2. **文本 + 尾图标**（如 ID + CopyButton）：`<TruncatedCell text={key} mono trailing={<CopyButton/>} />`；
 * 3. **复合单元格**（如状态芯片组合）：`<TruncatedCell text={composeStatusTitle(r)} showOnOverflowOnly={false}>{<div>…chips…</div>}</TruncatedCell>`
 *    —— 此时 children 为自定义单元格内容，text 仅作 Tooltip 文案，`showOnOverflowOnly` 置 false（复合内容恒弹）。
 *
 * 设计参考：[[RoutineTable]]（黄金标准，手写 `<td><TextTooltip><span class="min-w-0 flex-1 truncate">`）。
 */
export interface TruncatedCellProps {
  /** 文本内容（同时作为 Tooltip 文案）。纯文本形态下渲染为截断 span 的内容。 */
  text?: ReactNode;
  /** 复合单元格内容（如状态芯片组合）。提供时 text 仅作 Tooltip 文案，不渲染截断 span。 */
  children?: ReactElement;
  /** 尾部图标节点（如 CopyButton），与文本同行渲染。 */
  trailing?: ReactNode;
  /** `<td>` 类名（默认 `px-4 py-3`，对齐参考表）。 */
  className?: string;
  /** 截断 span 的文本类名（字号/颜色/字重等）。 */
  textClassName?: string;
  /** 等宽字体（ID/key/cron 等场景）。 */
  mono?: boolean;
  /** 是否仅溢出时弹 Tooltip（默认 true；复合形态置 false）。透传给 TextTooltip。 */
  showOnOverflowOnly?: boolean;
  /** colspan 透传。 */
  colSpan?: number;
}

export function TruncatedCell({
  text,
  children,
  trailing,
  className,
  textClassName,
  mono,
  showOnOverflowOnly = true,
  colSpan,
}: TruncatedCellProps) {
  // 形态 3：复合单元格（children 提供自定义内容）
  if (children !== undefined) {
    return (
      <td className={cn("px-4 py-3", className)} colSpan={colSpan}>
        <TextTooltip content={text ?? children} showOnOverflowOnly={showOnOverflowOnly}>
          {children}
        </TextTooltip>
      </td>
    );
  }

  const truncateSpan = (
    <span className={cn("block min-w-0 truncate", mono && "font-mono text-xs", textClassName)}>
      {text}
    </span>
  );

  // 形态 2：文本 + 尾图标
  if (trailing) {
    return (
      <td className={cn("px-4 py-3", className)} colSpan={colSpan}>
        <div className="flex min-w-0 items-center gap-1">
          <TextTooltip content={text} showOnOverflowOnly={showOnOverflowOnly}>
            {truncateSpan}
          </TextTooltip>
          {trailing}
        </div>
      </td>
    );
  }

  // 形态 1：纯文本截断
  return (
    <td className={cn("px-4 py-3", className)} colSpan={colSpan}>
      <TextTooltip content={text} showOnOverflowOnly={showOnOverflowOnly}>
        {truncateSpan}
      </TextTooltip>
    </td>
  );
}
