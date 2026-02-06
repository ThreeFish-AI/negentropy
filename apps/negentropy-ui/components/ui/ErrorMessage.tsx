/**
 * ErrorMessage 组件
 *
 * 统一错误展示组件
 * 对齐 docs/negentropy-ui-plan.md 第 13.4.3 节的错误码定义
 */

"use client";

import { AGUI_ERROR_CODES, type AguiErrorCode } from "@/lib/errors";

/**
 * 错误级别到样式的映射
 */
const ERROR_LEVEL_STYLES = {
  error: "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200",
  info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200",
};

/**
 * 错误码到级别的映射
 */
const ERROR_CODE_TO_LEVEL: Record<AguiErrorCode, keyof typeof ERROR_LEVEL_STYLES> = {
  BAD_REQUEST: "warning",
  UNAUTHORIZED: "warning",
  FORBIDDEN: "error",
  NOT_FOUND: "warning",
  RATE_LIMITED: "warning",
  UPSTREAM_TIMEOUT: "error",
  UPSTREAM_ERROR: "error",
  INTERNAL_ERROR: "error",
};

/**
 * 错误码到默认消息的映射（英文）
 */
const ERROR_CODE_MESSAGES: Record<AguiErrorCode, string> = {
  BAD_REQUEST: "Invalid request. Please check your input and try again.",
  UNAUTHORIZED: "Authentication required. Please log in and try again.",
  FORBIDDEN: "You don't have permission to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
  RATE_LIMITED: "Too many requests. Please wait and try again later.",
  UPSTREAM_TIMEOUT: "The service is taking too long to respond. Please try again.",
  UPSTREAM_ERROR: "The service is currently unavailable. Please try again later.",
  INTERNAL_ERROR: "An unexpected error occurred. Please try again.",
};

/**
 * ErrorMessage 组件属性
 */
export interface ErrorMessageProps {
  /** 错误码 */
  code?: AguiErrorCode | string;
  /** 错误消息 */
  message?: string;
  /** 追踪 ID */
  traceId?: string;
  /** 自定义样式类名 */
  className?: string;
  /** 是否显示错误码 */
  showCode?: boolean;
  /** 是否可关闭 */
  dismissible?: boolean;
  /** 关闭回调 */
  onDismiss?: () => void;
}

/**
 * ErrorMessage 组件
 *
 * 用于统一展示错误信息的组件
 */
export function ErrorMessage({
  code,
  message,
  traceId,
  className = "",
  showCode = true,
  dismissible = false,
  onDismiss,
}: ErrorMessageProps) {
  // 确定错误级别
  const level =
    code && code in AGUI_ERROR_CODES
      ? ERROR_CODE_TO_LEVEL[code as AguiErrorCode]
      : "error";

  // 确定显示消息
  const displayMessage =
    message ||
    (code && code in AGUI_ERROR_CODES
      ? ERROR_CODE_MESSAGES[code as AguiErrorCode]
      : "An error occurred.");

  return (
    <div
      className={`rounded-lg border p-4 ${ERROR_LEVEL_STYLES[level]} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">{displayMessage}</h3>
          {showCode && code && (
            <p className="mt-1 text-xs opacity-75">Error code: {code}</p>
          )}
          {traceId && (
            <p className="mt-1 text-xs opacity-75">Trace ID: {traceId}</p>
          )}
        </div>
        {dismissible && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Dismiss error"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 内联错误消息组件（更紧凑的版本）
 */
export interface InlineErrorMessageProps extends Omit<ErrorMessageProps, "showCode" | "dismissible" | "onDismiss"> {}

export function InlineErrorMessage({
  code,
  message,
  traceId,
  className = "",
}: InlineErrorMessageProps) {
  const level =
    code && code in AGUI_ERROR_CODES
      ? ERROR_CODE_TO_LEVEL[code as AguiErrorCode]
      : "error";

  const displayMessage =
    message ||
    (code && code in AGUI_ERROR_CODES
      ? ERROR_CODE_MESSAGES[code as AguiErrorCode]
      : "An error occurred.");

  return (
    <div className={`text-sm ${ERROR_LEVEL_STYLES[level]} ${className} inline-flex items-center gap-1 rounded px-2 py-1`}>
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
          clipRule="evenodd"
        />
      </svg>
      <span>{displayMessage}</span>
    </div>
  );
}
