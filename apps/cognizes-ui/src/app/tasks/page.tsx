"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTaskStore, useUIStore } from "@/store";
import { useActiveTasksMonitor } from "@/hooks/useWebSocket";
import TaskList from "@/components/tasks/TaskList";
import TaskProgress from "@/components/tasks/TaskProgress";

export default function TasksPage() {
  const router = useRouter();
  const { fetchTasks, activeTasks, tasks } = useTaskStore();
  const { addNotification } = useUIStore();

  // Monitor active tasks via WebSocket
  useActiveTasksMonitor();

  // Fetch tasks on component mount
  useEffect(() => {
    fetchTasks();

    // Set up periodic refresh for active tasks
    const interval = setInterval(() => {
      if (activeTasks.length > 0) {
        fetchTasks();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchTasks, activeTasks.length]);

  // Handle task actions
  const handleTaskCancel = async (taskId: string) => {
    // This will be handled by TaskList component
  };

  const handleTaskRetry = async (taskId: string) => {
    // This will be handled by TaskList component
  };

  const handleTaskView = (taskId: string) => {
    router.push(`/tasks/${taskId}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          任务监控
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          实时查看和管理论文处理任务
        </p>
      </div>

      {/* Active Tasks Overview */}
      {activeTasks.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            正在运行的任务 ({activeTasks.length})
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activeTasks.slice(0, 6).map((task) => (
              <TaskProgress key={task.id} task={task} showDetails={false} />
            ))}
          </div>
          {activeTasks.length > 6 && (
            <div className="mt-4 text-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                还有 {activeTasks.length - 6} 个任务正在运行...
              </span>
            </div>
          )}
        </div>
      )}

      {/* All Tasks List */}
      <TaskList
        onTaskCancel={handleTaskCancel}
        onTaskRetry={handleTaskRetry}
        onTaskView={handleTaskView}
      />
    </div>
  );
}
