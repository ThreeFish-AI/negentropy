import React, { useState, useMemo } from "react";
import { useTaskStore, useUIStore } from "@/store";
import TaskCard from "./TaskCard";
import type { TaskStatus, TaskType } from "@/types";

interface TaskListProps {
  tasks?: any[];
  onTaskCancel?: (id: string) => void;
  onTaskRetry?: (id: string) => void;
  onTaskView?: (id: string) => void;
  className?: string;
}

const statusOptions: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "pending", label: "等待中" },
  { value: "running", label: "运行中" },
  { value: "completed", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "cancelled", label: "已取消" },
  { value: "paused", label: "已暂停" },
];

const typeOptions: { value: TaskType | "all"; label: string }[] = [
  { value: "all", label: "全部类型" },
  { value: "translate", label: "翻译" },
  { value: "analyze", label: "分析" },
  { value: "extract", label: "提取" },
  { value: "batch-translate", label: "批量翻译" },
  { value: "batch-analyze", label: "批量分析" },
  { value: "index", label: "索引" },
  { value: "cleanup", label: "清理" },
];

export function TaskList({
  tasks: externalTasks,
  onTaskCancel,
  onTaskRetry,
  onTaskView,
  className = "",
}: TaskListProps) {
  const {
    tasks: storeTasks,
    loading,
    error,
    fetchTasks,
    clearCompletedTasks,
  } = useTaskStore();

  const { addNotification } = useUIStore();

  // Use external tasks if provided, otherwise use store tasks
  const tasks = externalTasks || storeTasks;

  // Local state for filters
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TaskType | "all">("all");
  const [sortBy, setSortBy] = useState<"createdAt" | "updatedAt">("createdAt");
  const [sortOrder, setSortByOrder] = useState<"desc" | "asc">("desc");

  // Filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter((task) => {
      // Status filter
      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== "all" && task.type !== typeFilter) {
        return false;
      }

      return true;
    });

    // Sort tasks
    filtered.sort((a, b) => {
      const aValue = new Date(a[sortBy]).getTime();
      const bValue = new Date(b[sortBy]).getTime();

      if (sortOrder === "desc") {
        return bValue - aValue;
      } else {
        return aValue - bValue;
      }
    });

    return filtered;
  }, [tasks, statusFilter, typeFilter, sortBy, sortOrder]);

  // Group tasks by status
  const groupedTasks = useMemo(() => {
    const groups: Record<string, typeof tasks> = {
      running: [],
      pending: [],
      failed: [],
      completed: [],
      cancelled: [],
      paused: [],
    };

    filteredTasks.forEach((task) => {
      if (groups[task.status]) {
        groups[task.status].push(task);
      }
    });

    return groups;
  }, [filteredTasks]);

  // Clear completed tasks
  const handleClearCompleted = async () => {
    const completedCount = groupedTasks.completed.length;
    if (completedCount === 0) {
      addNotification({
        type: "info",
        title: "提示",
        message: "没有已完成的任务需要清理",
        duration: 3000,
      });
      return;
    }

    if (window.confirm(`确定要清理 ${completedCount} 个已完成的任务吗？`)) {
      try {
        await clearCompletedTasks();
        addNotification({
          type: "success",
          title: "清理成功",
          message: `已清理 ${completedCount} 个任务`,
          duration: 3000,
        });
      } catch (error) {
        addNotification({
          type: "error",
          title: "清理失败",
          message: error instanceof Error ? error.message : "未知错误",
          duration: 5000,
        });
      }
    }
  };

  // Get task count by status
  const getStatusCount = (status: TaskStatus) => {
    return groupedTasks[status]?.length || 0;
  };

  // Render task group
  const renderTaskGroup = (title: string, taskList: any[], color: string) => {
    if (taskList.length === 0) return null;

    return (
      <div className="mb-6">
        <div className={`mb-3 flex items-center justify-between`}>
          <h3 className={`text-lg font-semibold ${color}`}>
            {title} ({taskList.length})
          </h3>
        </div>
        <div className="space-y-3">
          {taskList.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onCancel={onTaskCancel}
              onRetry={onTaskRetry}
              onView={onTaskView}
            />
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`task-list ${className}`}>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg bg-white p-4 dark:bg-gray-800"
            >
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700"></div>
                  <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`task-list ${className}`}>
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <svg
              className="h-12 w-12 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="mb-4 text-red-600 dark:text-red-400">
            加载失败: {error}
          </p>
          <button
            onClick={() => fetchTasks()}
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`task-list ${className}`}>
      {/* Filters and Actions */}
      <div className="mb-6 space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {getStatusCount("running")}
            </div>
            <div className="text-sm text-blue-800 dark:text-blue-300">
              运行中
            </div>
          </div>
          <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {getStatusCount("pending")}
            </div>
            <div className="text-sm text-yellow-800 dark:text-yellow-300">
              等待中
            </div>
          </div>
          <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {getStatusCount("completed")}
            </div>
            <div className="text-sm text-green-800 dark:text-green-300">
              已完成
            </div>
          </div>
          <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {getStatusCount("failed")}
            </div>
            <div className="text-sm text-red-800 dark:text-red-300">失败</div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as TaskStatus | "all")
            }
            className="rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TaskType | "all")}
            className="rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "createdAt" | "updatedAt")
            }
            className="rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="createdAt">按创建时间</option>
            <option value="updatedAt">按更新时间</option>
          </select>

          <button
            onClick={() =>
              setSortByOrder(sortOrder === "desc" ? "asc" : "desc")
            }
            className="rounded-md border border-gray-300 px-3 py-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {sortOrder === "desc" ? "最新优先" : "最早优先"}
          </button>

          <div className="flex-1"></div>

          {getStatusCount("completed") > 0 && (
            <button
              onClick={handleClearCompleted}
              className="px-3 py-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              清理已完成 ({getStatusCount("completed")})
            </button>
          )}
        </div>
      </div>

      {/* Task Groups */}
      {filteredTasks.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <svg
              className="h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400">没有找到匹配的任务</p>
        </div>
      ) : (
        <>
          {renderTaskGroup(
            "运行中",
            groupedTasks.running,
            "text-blue-600 dark:text-blue-400",
          )}
          {renderTaskGroup(
            "等待中",
            groupedTasks.pending,
            "text-yellow-600 dark:text-yellow-400",
          )}
          {renderTaskGroup(
            "失败",
            groupedTasks.failed,
            "text-red-600 dark:text-red-400",
          )}
          {renderTaskGroup(
            "已完成",
            groupedTasks.completed,
            "text-green-600 dark:text-green-400",
          )}
          {renderTaskGroup(
            "已暂停",
            groupedTasks.paused,
            "text-gray-600 dark:text-gray-400",
          )}
          {renderTaskGroup(
            "已取消",
            groupedTasks.cancelled,
            "text-gray-600 dark:text-gray-400",
          )}
        </>
      )}
    </div>
  );
}

export default TaskList;
