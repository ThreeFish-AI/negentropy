import React from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Task, TaskStatus } from "@/types";

interface TaskProgressProps {
  task: Task;
  showDetails?: boolean;
  className?: string;
}

const statusConfig = {
  pending: {
    label: "等待中",
    color: "bg-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    textColor: "text-gray-800 dark:text-gray-200",
  },
  running: {
    label: "运行中",
    color: "bg-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900",
    textColor: "text-blue-800 dark:text-blue-200",
  },
  completed: {
    label: "已完成",
    color: "bg-green-500",
    bgColor: "bg-green-100 dark:bg-green-900",
    textColor: "text-green-800 dark:text-green-200",
  },
  failed: {
    label: "失败",
    color: "bg-red-500",
    bgColor: "bg-red-100 dark:bg-red-900",
    textColor: "text-red-800 dark:text-red-200",
  },
  cancelled: {
    label: "已取消",
    color: "bg-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    textColor: "text-gray-800 dark:text-gray-200",
  },
  paused: {
    label: "已暂停",
    color: "bg-yellow-500",
    bgColor: "bg-yellow-100 dark:bg-yellow-900",
    textColor: "text-yellow-800 dark:text-yellow-200",
  },
};

const workflowLabels = {
  translate: "翻译",
  analyze: "分析",
  extract: "提取",
  "batch-translate": "批量翻译",
  "batch-analyze": "批量分析",
  index: "索引",
  cleanup: "清理",
};

export function TaskProgress({
  task,
  showDetails = true,
  className = "",
}: TaskProgressProps) {
  const config = statusConfig[task.status];
  const isActive = task.status === "running" || task.status === "pending";

  // Calculate estimated time remaining
  const getEstimatedTimeRemaining = () => {
    if (
      !task.estimatedDuration ||
      task.progress <= 0 ||
      task.status !== "running"
    ) {
      return null;
    }

    const elapsed =
      Date.now() - new Date(task.startedAt || task.createdAt).getTime();
    const totalEstimated = task.estimatedDuration * 1000; // Convert to milliseconds
    const remaining = totalEstimated - elapsed;

    if (remaining <= 0) return "即将完成";

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    if (minutes > 0) {
      return `约 ${minutes} 分 ${seconds} 秒`;
    }
    return `约 ${seconds} 秒`;
  };

  const getProgressColor = () => {
    switch (task.status) {
      case "running":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      case "cancelled":
        return "bg-gray-500";
      default:
        return "bg-gray-300";
    }
  };

  return (
    <div
      className={`task-progress rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      {/* Header */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Status Indicator */}
            <div
              className={`h-3 w-3 rounded-full ${config.color} ${isActive ? "animate-pulse" : ""}`}
            />

            {/* Title */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                {task.title}
              </h3>
              <div className="mt-1 flex items-center space-x-2">
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${config.bgColor} ${config.textColor}`}
                >
                  {config.label}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {workflowLabels[task.type as keyof typeof workflowLabels] ||
                    task.type}
                </span>
                {task.paperId && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    单个任务
                  </span>
                )}
                {task.paperIds && task.paperIds.length > 1 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    批量任务 ({task.paperIds.length} 篇)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Time */}
          <div className="text-right text-sm text-gray-500 dark:text-gray-400">
            <div>创建时间</div>
            <div>
              {format(new Date(task.createdAt), "MM-dd HH:mm", {
                locale: zhCN,
              })}
            </div>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {task.description}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            进度
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {task.progress}%
          </span>
        </div>

        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${task.progress}%` }}
          />
        </div>

        {/* Estimated Time */}
        {task.status === "running" && (
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            预计剩余时间: {getEstimatedTimeRemaining() || "计算中..."}
          </div>
        )}

        {/* Status Message */}
        {task.status === "running" && (
          <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
            处理中...
          </div>
        )}

        {task.status === "completed" && (
          <div className="mt-2 text-sm text-green-600 dark:text-green-400">
            ✅ 任务已完成
          </div>
        )}

        {task.status === "failed" && (
          <div className="mt-2 text-sm text-red-600 dark:text-red-400">
            ❌ {task.error || "任务执行失败"}
          </div>
        )}

        {task.status === "cancelled" && (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            ⏹️ 任务已取消
          </div>
        )}
      </div>

      {/* Details */}
      {showDetails && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* Times */}
          <div className="bg-gray-50 px-4 py-2 dark:bg-gray-900/50">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  开始时间:
                </span>
                {task.startedAt ? (
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {format(new Date(task.startedAt), "MM-dd HH:mm:ss", {
                      locale: zhCN,
                    })}
                  </span>
                ) : (
                  <span className="ml-2 text-gray-400">未开始</span>
                )}
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  完成时间:
                </span>
                {task.completedAt ? (
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {format(new Date(task.completedAt), "MM-dd HH:mm:ss", {
                      locale: zhCN,
                    })}
                  </span>
                ) : (
                  <span className="ml-2 text-gray-400">未完成</span>
                )}
              </div>
            </div>
          </div>

          {/* Latest Logs */}
          {task.logs && task.logs.length > 0 && (
            <div className="p-4">
              <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                最新日志
              </div>
              <div className="space-y-1">
                {task.logs.slice(-3).map((log, index) => (
                  <div
                    key={log.id || index}
                    className="font-mono text-xs text-gray-600 dark:text-gray-400"
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
              {task.logs.length > 3 && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  还有 {task.logs.length - 3} 条日志...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskProgress;
