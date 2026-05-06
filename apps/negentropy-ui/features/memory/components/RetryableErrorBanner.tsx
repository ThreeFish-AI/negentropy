/**
 * 可重试错误 banner（ISSUE-067）。
 *
 * 当 fetcher 抛出的 Error 满足以下任一条件时显示「重试」按钮：
 *   1. `error.retryable === true`（首选协议；由 fetcher 主动注入）；
 *   2. 兜底正则匹配 `error.message` 中的 `5\d\d|网络|timeout` —— 仅作为 fetcher
 *      尚未接入 retryable 协议时的过渡兜底，不应作为长期判据。
 *
 * 抽出原因：`/memory/audit` 与 `/memory/timeline` 两处 banner 实现完全一致，复制
 * 同款判据会随 retryable 协议或 i18n 文案演进出现双点改动；此组件为后续 Knowledge
 * / Wiki 巡检模块的统一入口（评审 #2）。
 */
import type React from "react";

const FALLBACK_RETRYABLE_REGEX = /5\d\d|网络|timeout/i;

export type RetryableError = Error & { retryable?: boolean };

export function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const flagged = (error as RetryableError).retryable;
  if (typeof flagged === "boolean") return flagged;
  return FALLBACK_RETRYABLE_REGEX.test(error.message ?? "");
}

export interface RetryableErrorBannerProps {
  error: Error | null | undefined;
  onRetry: () => void | Promise<void>;
  retryLabel?: string;
  className?: string;
}

export function RetryableErrorBanner({
  error,
  onRetry,
  retryLabel = "重试",
  className,
}: RetryableErrorBannerProps): React.ReactElement | null {
  if (!error) return null;
  return (
    <div
      className={
        className ??
        "mb-4 flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
      }
    >
      <div className="flex-1">{error.message || String(error)}</div>
      {isRetryable(error) && (
        <button
          type="button"
          onClick={() => {
            void onRetry();
          }}
          className="shrink-0 rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-rose-700"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
