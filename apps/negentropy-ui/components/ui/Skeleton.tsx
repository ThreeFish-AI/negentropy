import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * 骨架占位（Reuse-Driven）。
 *
 * 收敛全站「正在加载…」文本与零散 shimmer，统一为令牌驱动的扫光占位块，
 * 用于 >300ms 的异步加载（符合 MD/HIG 加载反馈准则）。
 * 扫光动画已被全局 `prefers-reduced-motion` 规则降级。预留尺寸以避免布局抖动（CLS）。
 */
export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-control",
        "bg-gradient-to-r from-muted via-muted/40 to-muted bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}

/** 多行文本骨架，便于列表/段落占位。 */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}
