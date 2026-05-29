"use client";

/**
 * 统一按钮系统（Reuse-Driven / Single Source of Truth）。
 *
 * 收敛全站手搓按钮的视觉与交互：变体 + 尺寸 + 加载/图标态，统一焦点环、
 * scale 按压反馈、过渡缓动与 disabled 语义。所有取值走设计令牌
 * （--primary / --foreground / --destructive / rounded-control / ring / shadow-xs），
 * 随明暗自动翻转。
 *
 * 同时导出 `buttonClassName` 工厂：供 <Link>/<a> 等非 button 元素复用完全一致的样式，
 * 避免「组件」与「链接按钮」两套取值源。
 */

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";

export type ButtonVariant =
  | "primary" // 品牌主操作（indigo）：每屏建议仅一个
  | "neutral" // 中性实心（foreground 反白）：非品牌的强操作
  | "secondary" // 低强度填充
  | "outline" // 描边
  | "ghost" // 透明，仅 hover 显底
  | "danger" // 破坏性操作
  | "link"; // 文本链接样式

export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "relative inline-flex items-center justify-center whitespace-nowrap rounded-control font-medium cursor-pointer select-none outline-none " +
  "transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out " +
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover",
  neutral: "bg-foreground text-background shadow-xs hover:opacity-90",
  secondary: "bg-muted text-foreground hover:bg-border/60 dark:hover:bg-border",
  outline:
    "border border-border bg-background text-text-secondary hover:border-foreground/20 hover:bg-muted hover:text-foreground",
  ghost: "text-text-secondary hover:bg-muted hover:text-foreground",
  danger: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
  link: "text-primary underline-offset-4 hover:underline",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-9 gap-2 px-4 text-sm",
  lg: "h-10 gap-2 px-5 text-sm",
};

const ICON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
};

const SPINNER_SIZE: Record<ButtonSize, "sm" | "md"> = {
  sm: "sm",
  md: "md",
  lg: "md",
};

export interface ButtonClassNameOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 方形图标按钮（宽=高，无文字内边距）。务必配 aria-label。 */
  iconOnly?: boolean;
  fullWidth?: boolean;
  className?: string;
}

/** 生成按钮类名；供 <Link>/<a> 等非 button 元素复用同一套样式。 */
export function buttonClassName({
  variant = "primary",
  size = "md",
  iconOnly = false,
  fullWidth = false,
  className,
}: ButtonClassNameOptions = {}): string {
  return cn(
    BASE,
    VARIANTS[variant],
    iconOnly ? ICON_SIZES[size] : SIZES[size],
    // 文本链接不做位移按压，其余变体统一 scale 反馈
    variant !== "link" && "active:scale-[0.97]",
    fullWidth && "w-full",
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  fullWidth?: boolean;
  /** 异步进行中：展示 Spinner 并禁用，置 aria-busy。 */
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    iconOnly = false,
    fullWidth = false,
    loading = false,
    leftIcon,
    rightIcon,
    type = "button",
    disabled,
    className,
    children,
    ...props
  },
  ref,
) {
  const content = iconOnly ? (
    loading ? <Spinner size={SPINNER_SIZE[size]} /> : children
  ) : (
    <>
      {loading ? (
        <Spinner size={SPINNER_SIZE[size]} className="-ml-0.5" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </>
  );

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClassName({ variant, size, iconOnly, fullWidth, className })}
      {...props}
    >
      {content}
    </button>
  );
});
