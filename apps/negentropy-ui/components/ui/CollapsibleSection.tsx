"use client";

import { type ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  /** 标题栏内容（文本 / icon + 文本组合） */
  title: ReactNode;
  /** 折叠区域的展开内容 */
  children: ReactNode;
  /** 初始是否展开，默认 false */
  defaultExpanded?: boolean;
  /** 额外 className 覆盖外层 section */
  className?: string;
  /** 标题栏右侧附加内容（如状态徽标、计数） */
  headerExtra?: ReactNode;
}

/**
 * 可折叠卡片区段 —— 统一的「标题栏点击 → 展开/收起」交互模式。
 * 样式与 ReflectionFlow 手写折叠模式保持一致。
 */
export function CollapsibleSection({
  title,
  children,
  defaultExpanded = false,
  className,
  headerExtra,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className={cn("rounded-card border border-border bg-card p-5 shadow-sm", className)}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="group flex w-full items-center justify-between gap-2 text-xs font-medium uppercase tracking-overline text-text-secondary transition-colors hover:text-foreground"
      >
        <span className="flex items-center gap-1.5">{title}</span>
        <div className="flex items-center gap-2">
          {headerExtra}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-150",
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>
      {expanded && <div className="mt-3">{children}</div>}
    </section>
  );
}
