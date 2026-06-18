/**
 * Routine 预设模版的共享样式映射（Reuse-Driven / Single Source of Truth）。
 *
 * 收敛 approval_mode → 中文标签 + 明暗感知配色，供 TemplateCard 等多处复用，
 * 避免重复声明同一套 dark: 变体色表。
 * 约定对齐同目录的 `status-style.ts`（纯样式模块，无 "use client"）。
 */

/** approval_mode → 中文标签 + 颜色（含 dark: 变体）。 */
export const APPROVAL_BADGE: Record<string, { label: string; cls: string }> = {
  auto: { label: "全自动", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  first: { label: "首次审批", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  every: { label: "每轮审批", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
};
