/**
 * Pipeline 共享常量与工具函数
 *
 * 遵循 AGENTS.md 原则：
 * - Single Source of Truth: 状态颜色和时间格式化逻辑统一管理
 * - Reuse-Driven: 供 Dashboard 和 Pipelines 页面复用
 */

import type { PipelineStageResult } from "./knowledge-api";

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 操作类型中文标签
 */
export const OPERATION_LABELS: Record<string, string> = {
  ingest_text: "文本摄入",
  ingest_url: "URL 摄入",
  replace_source: "替换源",
};

/**
 * 触发方式中文标签
 */
export const TRIGGER_LABELS: Record<string, string> = {
  api: "API",
  ui: "UI",
  schedule: "定时",
};

/**
 * 阶段顺序定义（用于排序显示）
 */
export const STAGE_ORDER = ["fetch", "delete", "chunk", "embed", "persist"];

/**
 * 阶段名称中文标签
 */
export const STAGE_LABELS: Record<string, string> = {
  fetch: "获取内容",
  delete: "删除旧记录",
  chunk: "文本分块",
  embed: "向量化",
  persist: "持久化",
};

/**
 * 阶段颜色定义（每个阶段固定颜色，通过亮度区分状态）
 */
export const STAGE_COLORS: Record<
  string,
  { running: string; completed: string; failed: string; skipped: string }
> = {
  fetch: {
    running: "bg-sky-400",
    completed: "bg-sky-500",
    failed: "bg-sky-700",
    skipped: "bg-sky-300 dark:bg-sky-600",
  },
  delete: {
    running: "bg-rose-400",
    completed: "bg-rose-500",
    failed: "bg-rose-700",
    skipped: "bg-rose-300 dark:bg-rose-600",
  },
  chunk: {
    running: "bg-amber-400",
    completed: "bg-amber-500",
    failed: "bg-amber-700",
    skipped: "bg-amber-300 dark:bg-amber-600",
  },
  embed: {
    running: "bg-violet-400",
    completed: "bg-violet-500",
    failed: "bg-violet-700",
    skipped: "bg-violet-300 dark:bg-violet-600",
  },
  persist: {
    running: "bg-emerald-400",
    completed: "bg-emerald-500",
    failed: "bg-emerald-700",
    skipped: "bg-emerald-300 dark:bg-emerald-600",
  },
};

/**
 * 默认阶段颜色（未知阶段）
 */
const DEFAULT_STAGE_COLOR = {
  running: "bg-zinc-400",
  completed: "bg-zinc-500",
  failed: "bg-zinc-700",
  skipped: "bg-zinc-300 dark:bg-zinc-600",
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取阶段颜色
 * @param stageName - 阶段名称
 * @param status - 阶段状态
 * @returns Tailwind CSS 类名字符串
 */
export const getStageColor = (stageName: string, status?: string): string => {
  const colors = STAGE_COLORS[stageName] || DEFAULT_STAGE_COLOR;
  const statusKey = (status || "").toLowerCase();

  switch (statusKey) {
    case "running":
    case "in_progress":
      return colors.running;
    case "completed":
    case "success":
      return colors.completed;
    case "failed":
    case "error":
      return colors.failed;
    case "skipped":
      return colors.skipped;
    default:
      return colors.completed;
  }
};

/**
 * 格式化运行时长
 * @param durationMs - 运行时长（毫秒）
 * @param startedAt - 开始时间（可选）
 * @param completedAt - 结束时间（可选）
 * @returns 格式化后的时长字符串
 */
export const formatDuration = (
  durationMs?: number,
  startedAt?: string,
  completedAt?: string
): string => {
  // 优先使用 durationMs，否则从时间戳计算
  let ms = durationMs && durationMs > 0 ? durationMs : 0;

  if (ms === 0 && startedAt && completedAt) {
    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      ms = end - start;
    }
  }

  if (ms <= 0) return "-";

  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m${remainingSeconds}s`;
};

/**
 * 计算阶段宽度（基于平方根比例，更好体现耗时差异）
 * @param stage - 当前阶段
 * @param allStages - 所有阶段
 * @returns 宽度百分比字符串
 */
export const calculateStageWidth = (
  stage: { duration_ms?: number },
  allStages: Record<string, { duration_ms?: number }>
): string => {
  const entries = Object.entries(allStages);
  const stageCount = entries.length;

  if (stageCount <= 1) return "100%";

  // 使用平方根比例（比 log10 更能体现差异）
  let totalSqrtDuration = 0;
  for (const [, s] of entries) {
    const duration = Math.max(s.duration_ms || 100, 10); // 最小 10ms
    totalSqrtDuration += Math.sqrt(duration);
  }

  const currentDuration = Math.max(stage.duration_ms || 100, 10);
  const currentSqrtDuration = Math.sqrt(currentDuration);

  // 按比例分配
  let width = (currentSqrtDuration / totalSqrtDuration) * 100;

  // 动态最小宽度：stage 越多，最小宽度越小
  const dynamicMinWidth = Math.max(5, Math.floor(100 / stageCount / 2));
  const maxWidth = 100 - dynamicMinWidth * (stageCount - 1);

  width = Math.max(dynamicMinWidth, Math.min(maxWidth, width));

  return `${width.toFixed(1)}%`;
};

/**
 * 获取排序后的阶段列表
 * @param stages - 阶段记录
 * @returns 排序后的阶段数组
 */
export const getSortedStages = (
  stages?: Record<string, PipelineStageResult>
): [string, PipelineStageResult][] => {
  if (!stages) return [];
  return Object.entries(stages).sort(([a], [b]) => {
    const indexA = STAGE_ORDER.indexOf(a);
    const indexB = STAGE_ORDER.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
};

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
