import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * 统一卡片/面板外壳（Reuse-Driven / elevation-consistent）。
 *
 * 收敛各页手搓的 `bg-card rounded-xl border shadow-*`，统一为令牌驱动的圆角
 * (rounded-card) 与软层叠阴影标度 (shadow-sm/md)。`interactive` 用于可点击卡片，
 * 提供克制的 hover 抬升（box-shadow + 边框，无布局位移）。
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 悬浮层级：flat=仅边框；sm/md 叠加对应阴影。默认 sm。 */
  elevation?: "flat" | "sm" | "md";
  /** 可点击卡片：启用 hover 抬升过渡。 */
  interactive?: boolean;
}

const ELEVATION = {
  flat: "",
  sm: "shadow-sm",
  md: "shadow-md",
} as const;

export function Card({
  elevation = "sm",
  interactive = false,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-card text-card-foreground",
        ELEVATION[elevation],
        interactive &&
          "cursor-pointer transition-[box-shadow,border-color] duration-150 ease-out hover:border-foreground/15 hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}
