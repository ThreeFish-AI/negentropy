/**
 * Activity Log 共享 UI 常量与工具函数。
 *
 * 原 ActivityLogPanel 内联面板已重构为右侧抽屉（ActivityDrawer），
 * 本文件仅保留共享常量供 ActivityDrawer 及其他消费方复用。
 */

import type { ActivityLevel } from "@/hooks/useActivityLog";

export const LEVEL_OPTIONS: { value: ActivityLevel | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "success", label: "Success" },
  { value: "error", label: "Error" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
];

export const LEVEL_DOT: Record<ActivityLevel, string> = {
  success: "bg-emerald-500",
  error: "bg-rose-500",
  info: "bg-blue-500",
  warning: "bg-amber-500",
};

export const LEVEL_BADGE: Record<ActivityLevel, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  error:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  warning:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
};

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}
