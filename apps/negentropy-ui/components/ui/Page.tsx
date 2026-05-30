import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 页面布局原语（Reuse-Driven / Layout）。
 *
 * 收敛各页漂移的最大宽度与水平内边距（px-4 / px-6 混用），统一为响应式栅格容器，
 * 并提供一致的区块标题 SectionHeader（标题 + 说明 + 操作区）。
 */

const WIDTH = {
  default: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
} as const;

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof WIDTH;
}

export function PageContainer({
  size = "default",
  className,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", WIDTH[size], className)}
      {...props}
    />
  );
}

export interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** 右侧操作区（按钮组等）。 */
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h2 className="text-h4 font-semibold tracking-heading text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="text-sm leading-caption text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
