/**
 * Pipeline 共享常量与工具函数
 *
 * 遵循 AGENTS.md 原则：
 * - Single Source of Truth: 状态颜色和时间格式化逻辑统一管理
 * - Reuse-Driven: 供 Dashboard 和 Pipelines 页面复用
 */

/**
 * 获取 Pipeline 状态指示灯颜色
 * @param status - Pipeline 运行状态
 * @returns Tailwind CSS 类名字符串
 */
export const getPipelineStatusColor = (status?: string): string => {
  switch ((status || "").toLowerCase()) {
    case "completed":
    case "success":
      return "bg-emerald-500";
    case "running":
    case "in_progress":
      return "bg-amber-500 animate-pulse";
    case "failed":
    case "error":
      return "bg-rose-500";
    case "skipped":
      return "bg-zinc-300 dark:bg-zinc-600";
    default:
      return "bg-zinc-400";
  }
};

/**
 * 获取 Pipeline 状态文本颜色
 * @param status - Pipeline 运行状态
 * @returns Tailwind CSS 类名字符串
 */
export const getPipelineStatusTextColor = (status?: string): string => {
  switch ((status || "").toLowerCase()) {
    case "completed":
    case "success":
      return "text-emerald-600 dark:text-emerald-400";
    case "running":
    case "in_progress":
      return "text-amber-600 dark:text-amber-400";
    case "failed":
    case "error":
      return "text-rose-600 dark:text-rose-400";
    default:
      return "text-zinc-500 dark:text-zinc-400";
  }
};

/**
 * 格式化相对时间
 * @param dateStr - ISO 日期字符串
 * @returns 格式化后的相对时间字符串
 */
export const formatRelativeTime = (dateStr?: string): string => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "-";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString("zh-CN");
};

/**
 * 截断 Run ID 显示
 * @param runId - 完整的 Run ID
 * @param length - 保留的字符长度，默认 8
 * @returns 截断后的 Run ID
 */
export const truncateRunId = (runId: string, length = 8): string => {
  if (!runId) return "-";
  return runId.length > length ? `${runId.slice(0, length)}...` : runId;
};
