import { api } from "@/lib/api";
import type {
  Task,
  TaskLog,
  TaskLogMessage,
  TaskProgressMessage,
  TaskUpdateMessage,
  WebSocketMessage,
} from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface TaskState {
  tasks: Task[];
  activeTasks: Task[];
  taskUpdates: Map<string, WebSocketMessage>;
  loading: boolean;
  error: string | null;

  // Actions
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  handleTaskUpdate: (
    message: TaskUpdateMessage | TaskProgressMessage | TaskLogMessage,
  ) => void;
  fetchTasks: (params?: Record<string, unknown>) => Promise<void>;
  fetchTask: (id: string) => Promise<void>;
  cancelTask: (id: string) => Promise<void>;
  retryTask: (id: string) => Promise<void>;
  clearCompletedTasks: () => Promise<void>;
}

interface PaginatedTasksResponse {
  items: Task[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const useTaskStore = create<TaskState>()(
  devtools(
    immer((set, get) => ({
      tasks: [],
      activeTasks: [],
      taskUpdates: new Map(),
      loading: false,
      error: null,

      setTasks: (tasks) =>
        set((state) => {
          state.tasks = tasks;
          state.activeTasks = tasks.filter(
            (t) => t.status === "running" || t.status === "pending",
          );
        }),

      addTask: (task) =>
        set((state) => {
          state.tasks.unshift(task);
          if (task.status === "running" || task.status === "pending") {
            state.activeTasks.push(task);
          }
        }),

      updateTask: (id, updates) =>
        set((state) => {
          const taskIndex = state.tasks.findIndex((t) => t.id === id);
          if (taskIndex !== -1) {
            const task = state.tasks[taskIndex];
            Object.assign(task, updates, {
              updatedAt: new Date().toISOString(),
            });

            const activeIndex = state.activeTasks.findIndex(
              (t) => t.id === id,
            );
            if (task.status === "running" || task.status === "pending") {
              if (activeIndex === -1) {
                state.activeTasks.push(task);
              }
            } else if (activeIndex !== -1) {
              state.activeTasks.splice(activeIndex, 1);
            }
          }
        }),

      removeTask: (id) =>
        set((state) => {
          state.tasks = state.tasks.filter((t) => t.id !== id);
          state.activeTasks = state.activeTasks.filter((t) => t.id !== id);
        }),

      handleTaskUpdate: (message) => {
        const { taskId, data } = message;

        set((state) => {
          state.taskUpdates.set(taskId, message);
        });

        if (message.type === "task_update") {
          get().updateTask(taskId, data);
        } else if (message.type === "task_progress") {
          const progressData = data as { progress: number; message?: string };
          get().updateTask(taskId, {
            progress: progressData.progress,
            ...(progressData.message && { description: progressData.message }),
          });
        } else if (message.type === "task_log") {
          const logData = data as TaskLog;
          get().updateTask(taskId, {
            logs: [
              ...(get().tasks.find((t) => t.id === taskId)?.logs || []),
              logData,
            ],
          });
        }
      },

      fetchTasks: async (params) => {
        set((state) => {
          state.loading = true;
          state.error = null;
        });

        try {
          const response = (await api.tasks.list(
            params,
          )) as unknown as PaginatedTasksResponse;
          set((state) => {
            state.tasks = response?.items || [];
            state.activeTasks = state.tasks.filter(
              (t) => t.status === "running" || t.status === "pending",
            );
          });
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error ? error.message : "获取任务列表失败";
          });
        } finally {
          set((state) => {
            state.loading = false;
          });
        }
      },

      fetchTask: async (id) => {
        try {
          const task = (await api.tasks.get(id)) as unknown as Task;
          get().updateTask(id, task);
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error ? error.message : "获取任务详情失败";
          });
        }
      },

      cancelTask: async (id) => {
        try {
          await api.tasks.cancel(id);
          get().updateTask(id, { status: "cancelled" });
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error ? error.message : "取消任务失败";
          });
        }
      },

      retryTask: async (id) => {
        try {
          await api.tasks.retry(id);
          get().updateTask(id, { status: "pending", progress: 0 });
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error ? error.message : "重试任务失败";
          });
        }
      },

      clearCompletedTasks: async () => {
        try {
          await api.tasks.cleanup();
          set((state) => {
            state.tasks = state.tasks.filter((t) => t.status !== "completed");
          });
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error ? error.message : "清理任务失败";
          });
        }
      },
    })),
    {
      name: "task-store",
    },
  ),
);
