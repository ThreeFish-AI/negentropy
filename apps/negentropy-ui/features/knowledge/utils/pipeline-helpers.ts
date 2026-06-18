/**
 * Pipeline 共享常量与工具函数
 *
 * 遵循 AGENTS.md 原则：
 * - Single Source of Truth: 状态颜色和时间格式化逻辑统一管理
 * - Reuse-Driven: 供 Dashboard 和 Pipelines 页面复用
 */

import type { PipelineRunRecord, PipelineStageResult } from "./knowledge-api";

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 操作类型中文标签
 */
export const OPERATION_LABELS: Record<string, string> = {
  ingest_text: "文本摄入",
  ingest_url: "URL 摄入",
  ingest_file: "文件摄入",
  ingest_document: "文档摄入",
  import_document: "文档导入",
  replace_source: "替换源",
  sync_source: "同步源",
  rebuild_source: "重建源",
  translate: "文档翻译",
  graph_build: "图谱构建",
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
export const STAGE_ORDER = [
  "extract_resolve",
  "extract_primary",
  "extract_failover_1",
  "extract_failover_2",
  "extract_assets_store",
  "document_store",
  "source_tracking",
  "markdown_store",
  "extract_finalize",
  "extract_gate",
  "fetch",
  "download",
  "extract",
  "delete",
  "chunk",
  "embed",
  "persist",
  // 翻译阶段
  "chunking",
  "agent_execution",
  "validation",
  "storing",
  // KG 构建阶段
  "kg_extracting",
  "kg_resolving",
  "kg_syncing",
  "kg_pagerank",
  "kg_communities",
  "kg_summaries",
];

/**
 * 阶段名称中文标签
 */
export const STAGE_LABELS: Record<string, string> = {
  fetch: "获取内容",
  download: "下载源文件",
  extract: "提取内容",
  extract_resolve: "解析提取路由",
  extract_primary: "主 MCP 提取",
  extract_failover_1: "备用 MCP 提取 1",
  extract_failover_2: "备用 MCP 提取 2",
  extract_assets_store: "存储提取资源",
  document_store: "存储原始文档",
  source_tracking: "来源追踪",
  markdown_store: "存储 Markdown",
  extract_finalize: "整理提取结果",
  extract_gate: "提取结果校验",
  delete: "删除旧记录",
  chunk: "文本分块",
  embed: "向量化",
  persist: "持久化",
  // 翻译阶段
  chunking: "文档分块",
  agent_execution: "Agent 翻译",
  validation: "校验拼接",
  storing: "译文落库",
  // KG 构建阶段
  kg_extracting: "实体抽取",
  kg_resolving: "实体消解",
  kg_syncing: "一等公民同步",
  kg_pagerank: "PageRank 计算",
  kg_communities: "社区检测",
  kg_summaries: "社区摘要生成",
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
  download: {
    running: "bg-cyan-400",
    completed: "bg-cyan-500",
    failed: "bg-cyan-700",
    skipped: "bg-cyan-300 dark:bg-cyan-600",
  },
  extract: {
    running: "bg-indigo-400",
    completed: "bg-indigo-500",
    failed: "bg-indigo-700",
    skipped: "bg-indigo-300 dark:bg-indigo-600",
  },
  extract_resolve: {
    running: "bg-blue-400",
    completed: "bg-blue-500",
    failed: "bg-blue-700",
    skipped: "bg-blue-300 dark:bg-blue-600",
  },
  extract_primary: {
    running: "bg-fuchsia-400",
    completed: "bg-fuchsia-500",
    failed: "bg-fuchsia-700",
    skipped: "bg-fuchsia-300 dark:bg-fuchsia-600",
  },
  extract_failover_1: {
    running: "bg-pink-400",
    completed: "bg-pink-500",
    failed: "bg-pink-700",
    skipped: "bg-pink-300 dark:bg-pink-600",
  },
  extract_failover_2: {
    running: "bg-purple-400",
    completed: "bg-purple-500",
    failed: "bg-purple-700",
    skipped: "bg-purple-300 dark:bg-purple-600",
  },
  extract_assets_store: {
    running: "bg-teal-400",
    completed: "bg-teal-500",
    failed: "bg-teal-700",
    skipped: "bg-teal-300 dark:bg-teal-600",
  },
  document_store: {
    running: "bg-stone-400",
    completed: "bg-stone-500",
    failed: "bg-stone-700",
    skipped: "bg-stone-300 dark:bg-stone-600",
  },
  source_tracking: {
    running: "bg-lime-400",
    completed: "bg-lime-500",
    failed: "bg-lime-700",
    skipped: "bg-lime-300 dark:bg-lime-600",
  },
  markdown_store: {
    running: "bg-emerald-400",
    completed: "bg-emerald-500",
    failed: "bg-emerald-700",
    skipped: "bg-emerald-300 dark:bg-emerald-600",
  },
  extract_finalize: {
    running: "bg-lime-400",
    completed: "bg-lime-500",
    failed: "bg-lime-700",
    skipped: "bg-lime-300 dark:bg-lime-600",
  },
  extract_gate: {
    running: "bg-orange-400",
    completed: "bg-orange-500",
    failed: "bg-orange-700",
    skipped: "bg-orange-300 dark:bg-orange-600",
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
  // KG 构建阶段颜色（violet/purple 色系区分 KB）
  kg_extracting: {
    running: "bg-violet-400",
    completed: "bg-violet-500",
    failed: "bg-violet-700",
    skipped: "bg-violet-300 dark:bg-violet-600",
  },
  kg_resolving: {
    running: "bg-purple-400",
    completed: "bg-purple-500",
    failed: "bg-purple-700",
    skipped: "bg-purple-300 dark:bg-purple-600",
  },
  kg_syncing: {
    running: "bg-fuchsia-400",
    completed: "bg-fuchsia-500",
    failed: "bg-fuchsia-700",
    skipped: "bg-fuchsia-300 dark:bg-fuchsia-600",
  },
  kg_pagerank: {
    running: "bg-indigo-400",
    completed: "bg-indigo-500",
    failed: "bg-indigo-700",
    skipped: "bg-indigo-300 dark:bg-indigo-600",
  },
  kg_communities: {
    running: "bg-blue-400",
    completed: "bg-blue-500",
    failed: "bg-blue-700",
    skipped: "bg-blue-300 dark:bg-blue-600",
  },
  kg_summaries: {
    running: "bg-cyan-400",
    completed: "bg-cyan-500",
    failed: "bg-cyan-700",
    skipped: "bg-cyan-300 dark:bg-cyan-600",
  },
  // 翻译阶段
  chunking: {
    running: "bg-amber-400",
    completed: "bg-amber-500",
    failed: "bg-amber-700",
    skipped: "bg-amber-300 dark:bg-amber-600",
  },
  agent_execution: {
    running: "bg-purple-400",
    completed: "bg-purple-500",
    failed: "bg-purple-700",
    skipped: "bg-purple-300 dark:bg-purple-600",
  },
  validation: {
    running: "bg-orange-400",
    completed: "bg-orange-500",
    failed: "bg-orange-700",
    skipped: "bg-orange-300 dark:bg-orange-600",
  },
  storing: {
    running: "bg-teal-400",
    completed: "bg-teal-500",
    failed: "bg-teal-700",
    skipped: "bg-teal-300 dark:bg-teal-600",
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
    case "cancelling":
      // amber 脉动：表达"取消信号已发，等待 task 在检查点退出"的中间态
      return "bg-amber-400 animate-pulse";
    case "cancelled":
      // zinc 静态：用户主动取消，区别于失败 (rose) 与跳过 (zinc-300)
      return "bg-zinc-500";
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
    case "processing":
      return "bg-amber-500 animate-pulse";
    case "failed":
    case "error":
      return "bg-rose-500";
    case "pending":
      return "bg-zinc-400 animate-pulse";
    case "cancelling":
      // 取消进行中：amber 脉动（与 running 同色调以表达"还在运行但已收到取消信号"）
      return "bg-amber-400 animate-pulse";
    case "cancelled":
      // 已取消终态：zinc 静态（区别于 failed 的 rose 与 skipped 的浅 zinc）
      return "bg-zinc-500";
    case "skipped":
      return "bg-zinc-300 dark:bg-zinc-600";
    case "idle":
      return "bg-zinc-500";
    case "timeout":
      return "bg-rose-500";
    case "switched":
      return "bg-zinc-500";
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
    case "processing":
      return "text-amber-600 dark:text-amber-400";
    case "failed":
    case "error":
      return "text-rose-600 dark:text-rose-400";
    case "pending":
      return "text-zinc-600 dark:text-zinc-400";
    case "cancelling":
      return "text-amber-700 dark:text-amber-300";
    case "cancelled":
      return "text-zinc-600 dark:text-zinc-400";
    case "idle":
      return "text-zinc-600 dark:text-zinc-400";
    case "timeout":
      return "text-rose-600 dark:text-rose-400";
    case "switched":
      return "text-zinc-600 dark:text-zinc-400";
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
 * 截断 Run ID 显示。
 * 新格式 run_id 为 `{operation}-{label}-{4hex}`，优先保留 operation + label 部分，
 * 省略末尾 short-uuid 后缀；旧格式（纯 8 位 hex）按固定长度截断。
 */
export const truncateRunId = (runId: string, length = 24): string => {
  if (!runId) return "-";
  // 尝试去掉末尾的 short-uuid 后缀 (4 hex chars + '-')
  const withoutSuffix = runId.replace(/-[0-9a-f]{4}$/, "");
  if (withoutSuffix.length <= length) return withoutSuffix;
  return `${withoutSuffix.slice(0, length)}...`;
};

export interface FailedStageDetail {
  stageName: string;
  label: string;
  status: string;
  durationMs?: number;
  error: Record<string, unknown>;
  message: string;
  failureCategory?: string;
  diagnosticSummary?: string;
}

export interface PipelineErrorDetail {
  scope: "run" | "stage";
  key: string;
  title: string;
  message: string;
  error: Record<string, unknown>;
  failureCategory?: string;
  failureLabel?: string;
  diagnosticSummary?: string;
  stageName?: string;
  durationMs?: number;
  status?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const FAILURE_CATEGORY_LABELS: Record<string, string> = {
  no_extractor_configured: "MCP 提取器未配置",
  validation_error: "参数校验失败",
  tool_error: "MCP 调用失败",
  empty_payload: "提取结果为空",
  unrecognized_payload: "结果结构无法识别",
  tool_unavailable: "MCP 服务不可用",
  tool_disabled: "MCP Tool 已禁用",
  unsupported_contract: "Tool 契约不受支持",
  low_confidence_contract: "Tool 契约置信度不足",
};

export const getFailureCategoryLabel = (category: unknown): string | undefined => {
  if (typeof category !== "string" || !category.trim()) {
    return undefined;
  }
  return FAILURE_CATEGORY_LABELS[category] || category;
};

export const getStageErrorMessage = (error: unknown): string => {
  if (typeof error === "string") {
    return error;
  }

  if (!isRecord(error)) {
    return "Unknown error";
  }

  const message = error.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  const detail = error.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  const type = error.type;
  if (typeof type === "string" && type.trim()) {
    return type;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

export const getStageErrorSummary = (error: unknown): string => {
  if (!isRecord(error)) {
    return getStageErrorMessage(error);
  }
  const failureLabel = getFailureCategoryLabel(error.failure_category);
  const message = getStageErrorMessage(error);
  return failureLabel ? `${failureLabel} · ${message}` : message;
};

export const getDiagnosticSummary = (error: unknown): string | undefined => {
  if (!isRecord(error)) {
    return undefined;
  }
  const direct = error.diagnostic_summary;
  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }
  const diagnostics = error.diagnostics;
  if (!isRecord(diagnostics)) {
    return undefined;
  }
  const nested = diagnostics.summary;
  return typeof nested === "string" && nested.trim() ? nested : undefined;
};

const shouldShowDiagnosticSummary = (failureCategory: string | undefined): boolean =>
  failureCategory === "unsupported_contract" ||
  failureCategory === "low_confidence_contract" ||
  failureCategory === "no_extractor_configured";
export const getFailedStages = (
  stages?: Record<string, PipelineStageResult>
): FailedStageDetail[] =>
  getSortedStages(stages)
    .filter(([, stage]) => {
      const status = (stage.status || "").toLowerCase();
      return (status === "failed" || status === "error") && isRecord(stage.error);
    })
    .map(([stageName, stage]) => ({
      stageName,
      label: STAGE_LABELS[stageName] || stageName,
      status: stage.status,
      durationMs: stage.duration_ms,
      error: stage.error as Record<string, unknown>,
      message: getStageErrorMessage(stage.error),
      failureCategory:
        isRecord(stage.error) && typeof stage.error.failure_category === "string"
          ? stage.error.failure_category
          : undefined,
      diagnosticSummary: getDiagnosticSummary(stage.error),
    }));

export const buildPipelineErrorDetails = (
  run: Pick<PipelineRunRecord, "error" | "stages">
): PipelineErrorDetail[] => {
  const stageErrors = getFailedStages(run.stages);
  const stageMessages = new Set(stageErrors.map((item) => item.message));
  const details: PipelineErrorDetail[] = [];

  if (isRecord(run.error)) {
    const runMessage = getStageErrorMessage(run.error);
    if (!stageMessages.has(runMessage)) {
      details.push({
        scope: "run",
        key: "run",
        title: "运行级错误",
        message: runMessage,
        error: run.error,
        failureCategory:
          typeof run.error.failure_category === "string" ? run.error.failure_category : undefined,
        failureLabel: getFailureCategoryLabel(run.error.failure_category),
        diagnosticSummary:
          shouldShowDiagnosticSummary(
            typeof run.error.failure_category === "string" ? run.error.failure_category : undefined
          )
            ? getDiagnosticSummary(run.error)
            : undefined,
      });
    }
  }

  details.push(
    ...stageErrors.map((item) => ({
      scope: "stage" as const,
      key: item.stageName,
      title: item.label,
      message: item.message,
      error: item.error,
      failureCategory: item.failureCategory,
      failureLabel: getFailureCategoryLabel(item.failureCategory),
      diagnosticSummary: shouldShowDiagnosticSummary(item.failureCategory)
        ? item.diagnosticSummary
        : undefined,
      stageName: item.stageName,
      durationMs: item.durationMs,
      status: item.status,
    }))
  );

  return details;
};

// ============================================================================
// 重试 / 断点续传判定（双入口：page 与 detail panel 单一事实源）
// ============================================================================

/**
 * 从 PipelineRunRecord 的 input/output 中尽力抽取关联的 corpus_id / document_id。
 *
 * 不同 operation 把这些字段放在 input 的不同位置：先 union input 与 output
 * 两侧再判定，避免「同一对象必须同时含两字段」的旧逻辑把合法可重试场景误判
 * 为无法定位。抽不到完整对则返回 null（UI 隐藏重试入口）。
 */
export function extractDocumentRef(
  run: PipelineRunRecord,
): { corpusId: string; documentId: string } | null {
  let docId: string | null = null;
  let corpusId: string | null = null;
  for (const obj of [run.input, run.output]) {
    if (!obj) continue;
    if (!docId && typeof obj.document_id === "string") docId = obj.document_id;
    if (!corpusId && typeof obj.corpus_id === "string")
      corpusId = obj.corpus_id;
    if (docId && corpusId) break;
  }
  return docId && corpusId ? { corpusId, documentId: docId } : null;
}

/** 可重试的终态集合：失败 / 部分成功 / 已取消。 */
const RETRYABLE_RUN_STATUSES = new Set(["failed", "partial", "cancelled"]);

/**
 * 判定该 Run 是否可走重试（断点续传 / 重新开始）：
 * 状态为 failed / partial / cancelled，或某 stage 失败。
 */
export function isRunResumable(run: PipelineRunRecord): boolean {
  const s = (run.status || "").toLowerCase();
  if (RETRYABLE_RUN_STATUSES.has(s)) return true;
  if (!run.stages) return false;
  for (const stage of Object.values(run.stages)) {
    if ((stage?.status || "").toLowerCase() === "failed") return true;
  }
  return false;
}

/**
 * 综合判定：Run 是否应在 UI 暴露重试入口。
 * 要求 KB 来源 + 可抽取文档关联 + 可重试状态三者同时满足。
 * （文件 ingest 才有 document_id；URL/text 无法按 document_id 重跑。）
 */
export function canRetryRun(run: PipelineRunRecord): boolean {
  return Boolean(extractDocumentRef(run)) && isRunResumable(run);
}
