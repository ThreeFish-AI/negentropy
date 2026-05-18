import React, { useState } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useTaskStore, useUIStore } from "@/store";
import type { Task, TaskStatus } from "@/types";

interface TaskCardProps {
  task: Task;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onView?: (id: string) => void;
  className?: string;
}

const statusConfig = {
  pending: {
    label: "等待中",
    icon: "⏳",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    textColor: "text-gray-800 dark:text-gray-200",
  },
  running: {
    label: "运行中",
    icon: "🔄",
    bgColor: "bg-blue-100 dark:bg-blue-900",
    textColor: "text-blue-800 dark:text-blue-200",
  },
  completed: {
    label: "已完成",
    icon: "✅",
    bgColor: "bg-green-100 dark:bg-green-900",
    textColor: "text-green-800 dark:text-green-200",
  },
  failed: {
    label: "失败",
    icon: "❌",
    bgColor: "bg-red-100 dark:bg-red-900",
    textColor: "text-red-800 dark:text-red-200",
  },
  cancelled: {
    label: "已取消",
    icon: "⏹️",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    textColor: "text-gray-800 dark:text-gray-200",
  },
  paused: {
    label: "已暂停",
    icon: "⏸️",
    bgColor: "bg-yellow-100 dark:bg-yellow-900",
    textColor: "text-yellow-800 dark:text-yellow-200",
  },
};

const typeLabels = {
  translate: "翻译",
  analyze: "分析",
  extract: "提取",
  "batch-translate": "批量翻译",
  "batch-analyze": "批量分析",
  index: "索引",
  cleanup: "清理",
};

export function TaskCard({
  task,
  onCancel,
  onRetry,
  onView,
  className = "",
}: TaskCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const { cancelTask, retryTask } = useTaskStore();
  const { addNotification } = useUIStore();

  const config = statusConfig[task.status];

  const handleCancel = async () => {
    try {
      await cancelTask(task.id);
      addNotification({
        type: "info",
        title: "任务已取消",
        message: "任务已成功取消",
        duration: 3000,
      });
      onCancel?.(task.id);
    } catch (error) {
      addNotification({
        type: "error",
        title: "取消失败",
        message: error instanceof Error ? error.message : "未知错误",
        duration: 5000,
      });
    }
  };

  const handleRetry = async () => {
    try {
      await retryTask(task.id);
      addNotification({
        type: "info",
        title: "任务已重试",
        message: "任务已重新加入队列",
        duration: 3000,
      });
      onRetry?.(task.id);
    } catch (error) {
      addNotification({
        type: "error",
        title: "重试失败",
        message: error instanceof Error ? error.message : "未知错误",
        duration: 5000,
      });
    }
  };

  const getDuration = () => {
    const start = new Date(task.startedAt || task.createdAt);
    const end = task.completedAt ? new Date(task.completedAt) : new Date();
    const duration = end.getTime() - start.getTime();

    if (duration < 60000) {
      return `${Math.floor(duration / 1000)}秒`;
    } else if (duration < 3600000) {
      return `${Math.floor(duration / 60000)}分${Math.floor((duration % 60000) / 1000)}秒`;
    } else {
      return `${Math.floor(duration / 3600000)}时${Math.floor((duration % 3600000) / 60000)}分`;
    }
  };

  return (
    <div
      className={`task-card rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-1 items-start space-x-3">
            {/* Status Icon */}
            <div
              className={`h-10 w-10 rounded-lg ${config.bgColor} flex items-center justify-center text-lg`}
            >
              {task.status === "running" ? (
                <div className="animate-spin">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              ) : (
                config.icon
              )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              {/* Title and Status */}
              <div className="mb-1 flex items-center space-x-2">
                <h3 className="truncate font-medium text-gray-900 dark:text-gray-100">
                  {task.title}
                </h3>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgColor} ${config.textColor}`}
                >
                  {config.label}
                </span>
              </div>

              {/* Type and Info */}
              <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                <span>
                  {typeLabels[task.type as keyof typeof typeLabels] ||
                    task.type}
                </span>
                {task.paperIds && task.paperIds.length > 1 && (
                  <span>({task.paperIds.length} 篇论文)</span>
                )}
                {task.startedAt && <span>耗时: {getDuration()}</span>}
              </div>

              {/* Description */}
              {task.description && (
                <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                  {task.description}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="ml-4 flex items-center space-x-2">
            {task.status === "pending" || task.status === "running" ? (
              <button
                onClick={handleCancel}
                className="p-1 text-gray-500 transition-colors hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                title="取消任务"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            ) : null}

            {task.status === "failed" ? (
              <button
                onClick={handleRetry}
                className="p-1 text-gray-500 transition-colors hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                title="重试任务"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            ) : null}

            {onView && (
              <button
                onClick={() => onView(task.id)}
                className="p-1 text-gray-500 transition-colors hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                title="查看详情"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>
            )}

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-1 text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg
                className={`h-5 w-5 transform transition-transform ${showDetails ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {(task.status === "running" || task.status === "pending") && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                进度
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {task.progress}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${task.status === "running" ? "bg-blue-500" : "bg-gray-300"} `}
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {task.status === "failed" && task.error && (
          <div className="mt-3 rounded bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {task.error}
          </div>
        )}

        {/* Success Message */}
        {task.status === "completed" && (
          <div className="mt-3 rounded bg-green-50 p-2 text-xs text-green-600 dark:bg-green-900/20 dark:text-green-400">
            任务已成功完成
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {showDetails && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* Timeline */}
          <div className="bg-gray-50 p-4 dark:bg-gray-900/50">
            <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              时间线
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  创建时间:
                </span>
                <span className="text-gray-900 dark:text-gray-100">
                  {format(new Date(task.createdAt), "yyyy-MM-dd HH:mm:ss", {
                    locale: zhCN,
                  })}
                </span>
              </div>
              {task.startedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">
                    开始时间:
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {format(new Date(task.startedAt), "yyyy-MM-dd HH:mm:ss", {
                      locale: zhCN,
                    })}
                  </span>
                </div>
              )}
              {task.completedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">
                    完成时间:
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {format(new Date(task.completedAt), "yyyy-MM-dd HH:mm:ss", {
                      locale: zhCN,
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Latest Log */}
          {task.logs && task.logs.length > 0 && (
            <div className="p-4">
              <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                最新日志
              </h4>
              <div className="space-y-1 font-mono text-xs">
                {task.logs
                  .slice(-5)
                  .reverse()
                  .map((log) => (
                    <div
                      key={log.id}
                      className="text-gray-600 dark:text-gray-400"
                    >
                      <span className="text-gray-400">
                        {format(new Date(log.timestamp), "HH:mm:ss")}
                      </span>{" "}
                      <span
                        className={` ${log.level === "error" ? "text-red-600 dark:text-red-400" : ""} ${log.level === "warn" ? "text-yellow-600 dark:text-yellow-400" : ""} ${log.level === "info" ? "text-blue-600 dark:text-blue-400" : ""} `}
                      >
                        [{log.level.toUpperCase()}]
                      </span>{" "}
                      {log.message}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskCard;
