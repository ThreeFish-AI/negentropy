"use client";

import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

/**
 * 统一错误态（Reuse-Driven / 无障碍）。
 *
 * 收敛各页零散的红色错误文案与 banner。两种形态：
 * - `ErrorState`：整面板加载失败的居中态（图标 + 文案 + 重试）。
 * - `ErrorBanner`：页面顶部/区块内的紧凑告警条（可重试、可关闭）。
 * 两者均 role="alert" + aria-live，错误必含恢复路径（符合 WCAG/HIG/MD）。
 */

export interface ErrorStateProps {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = "加载失败",
  description,
  onRetry,
  retryLabel = "重试",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export interface ErrorBannerProps {
  message: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorBanner({
  message,
  onRetry,
  retryLabel = "重试",
  onDismiss,
  className,
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 rounded-card border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive",
        className,
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 cursor-pointer rounded font-medium underline-offset-4 transition-opacity hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
        >
          {retryLabel}
        </button>
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="关闭"
          className="shrink-0 cursor-pointer rounded p-0.5 text-destructive/70 transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
