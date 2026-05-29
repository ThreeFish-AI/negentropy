import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 统一加载指示器（Reuse-Driven）。
 *
 * 收敛全站散用的 `animate-spin` 旋转图标：默认继承 `currentColor`，
 * 故可直接置于任意前景色容器（按钮、卡片、内联文本）。无障碍上，
 * 提供 `label` 时渲染 `role="status"` 供读屏播报，否则视为装饰元素隐藏。
 * 旋转动画已被全局 `prefers-reduced-motion` 规则降级。
 */

const SIZE = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 } as const;

export interface SpinnerProps {
  /** 尺寸档位，映射到像素边长。默认 `md`(16px)。 */
  size?: keyof typeof SIZE;
  className?: string;
  /** 无障碍标签；提供后渲染为可播报的 status，否则隐藏为装饰元素。 */
  label?: string;
}

export function Spinner({ size = "md", className, label }: SpinnerProps) {
  return (
    <Loader2
      size={SIZE[size]}
      strokeWidth={2}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 animate-spin text-current", className)}
    />
  );
}
