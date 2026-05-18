import { api } from "@/lib/api";
import type {
  ModalState,
  Notification,
  Pagination,
  Paper,
  PaperFilters,
  Task,
  TaskLog,
  TaskLogMessage,
  TaskProgressMessage,
  TaskUpdateMessage,
  UIState,
  WebSocketMessage,
} from "@/types";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// 论文状态管理
interface PaperState {
  papers: Paper[];
  currentPaper: Paper | null;
  selectedPapers: string[];
  filters: PaperFilters;
  pagination: Pagination;
  loading: boolean;
  error: string | null;

  // Actions
  setPapers: (papers: Paper[]) => void;
  addPaper: (paper: Paper) => void;
  updatePaper: (id: string, updates: Partial<Paper>) => void;
  removePaper: (id: string) => void;
  setCurrentPaper: (paper: Paper | null) => void;
  togglePaperSelection: (id: string) => void;
  selectAllPapers: () => void;
  clearPaperSelection: () => void;
  setFilters: (filters: Partial<PaperFilters>) => void;
  setPagination: (pagination: Partial<Pagination>) => void;
  fetchPapers: (params?: any) => Promise<void>;
  fetchPaper: (id: string) => Promise<void>;
  uploadPaper: (
    file: File,
    category: string,
    metadata?: any,
  ) => Promise<string>;
  processPaper: (id: string, workflow: string, options?: any) => Promise<Task>;
  deletePaper: (id: string) => Promise<void>;
  batchProcessPapers: (
    ids: string[],
    workflow: string,
    options?: any,
  ) => Promise<Task>;
  batchDeletePapers: (ids: string[]) => Promise<void>;
}

export const usePaperStore = create<PaperState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        papers: [],
        currentPaper: null,
        selectedPapers: [],
        filters: {
          search: "",
          category: "all",
          status: "all",
          sortBy: "uploadedAt",
          sortOrder: "desc",
        },
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
        loading: false,
        error: null,

        // Actions
        setPapers: (papers) =>
          set((state) => {
            state.papers = papers;
          }),

        addPaper: (paper) =>
          set((state) => {
            state.papers.unshift(paper);
          }),

        updatePaper: (id, updates) =>
          set((state) => {
            const index = state.papers.findIndex((p) => p.id === id);
            if (index !== -1) {
              Object.assign(state.papers[index], updates);
            }
            if (state.currentPaper?.id === id) {
              Object.assign(state.currentPaper, updates);
            }
          }),

        removePaper: (id) =>
          set((state) => {
            console.log("Store: removePaper called for ID:", id);
            const initialLength = state.papers.length;
            state.papers = state.papers.filter((p) => p.id !== id);
            console.log(
              "Store: papers length changed from",
              initialLength,
              "to",
              state.papers.length,
            );
            state.selectedPapers = state.selectedPapers.filter(
              (pId) => pId !== id,
            );
            if (state.currentPaper?.id === id) {
              state.currentPaper = null;
            }
          }),

        setCurrentPaper: (paper) =>
          set((state) => {
            state.currentPaper = paper;
          }),

        togglePaperSelection: (id) => {
          set((state) => {
            if (state.selectedPapers.includes(id)) {
              state.selectedPapers = state.selectedPapers.filter(
                (pId) => pId !== id,
              );
            } else {
              state.selectedPapers.push(id);
            }
          });
        },

        selectAllPapers: () =>
          set((state) => {
            state.selectedPapers = state.papers.map((p) => p.id);
          }),

        clearPaperSelection: () =>
          set((state) => {
            state.selectedPapers = [];
          }),

        setFilters: (filters) =>
          set((state) => {
            Object.assign(state.filters, filters);
            state.pagination.page = 1; // Reset to first page
          }),

        setPagination: (pagination) =>
          set((state) => {
            Object.assign(state.pagination, pagination);
          }),

        fetchPapers: async (params) => {
          set((state) => {
            state.loading = true;
            state.error = null;
          });

          try {
            const response = await api.papers.list({
              ...get().filters,
              ...get().pagination,
              ...params,
            });

            set((state) => {
              state.papers = (response as any)?.items || [];
              state.pagination = {
                page: (response as any)?.page || 1,
                limit: (response as any)?.limit || 20,
                total: (response as any)?.total || 0,
                totalPages: (response as any)?.totalPages || 0,
              };
            });
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error ? error.message : "获取论文列表失败";
            });
          } finally {
            set((state) => {
              state.loading = false;
            });
          }
        },

        fetchPaper: async (id) => {
          set((state) => {
            state.error = null;
          });
          try {
            const response = await api.papers.get(id);
            const paperData = (response as any)?.data || response;
            set((state) => {
              state.currentPaper = paperData as Paper;
            });
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error ? error.message : "获取论文详情失败";
            });
          }
        },

        uploadPaper: async (file, category, metadata) => {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("category", category);
          if (metadata) {
            Object.entries(metadata).forEach(([key, value]) => {
              formData.append(key, String(value));
            });
          }

          try {
            const response = await api.papers.upload(formData);
            return (response as any)?.task_id;
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : "上传失败";
            });
            throw error;
          }
        },

        processPaper: async (id, workflow, options) => {
          try {
            const task = await api.papers.process(id, workflow, options);

            // Update paper status
            get().updatePaper(id, { status: "processing" });

            // Add task to task store
            useTaskStore.getState().addTask(task as unknown as Task);

            return task as unknown as Task;
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : "处理失败";
            });
            throw error;
          }
        },

        deletePaper: async (id) => {
          try {
            await api.papers.delete(id);
            get().removePaper(id);
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : "删除失败";
            });
            throw error;
          }
        },

        batchProcessPapers: async (ids, workflow, options) => {
          try {
            const task = await api.papers.batchProcess(ids, workflow, options);

            // Update papers status
            ids.forEach((id) => {
              get().updatePaper(id, { status: "processing" });
            });

            // Add task to task store
            useTaskStore.getState().addTask(task as unknown as Task);

            return task as unknown as Task;
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error ? error.message : "批量处理失败";
            });
            throw error;
          }
        },

        batchDeletePapers: async (ids) => {
          try {
            await api.papers.batchDelete(ids);
            ids.forEach((id) => {
              get().removePaper(id);
            });
          } catch (error) {
            set((state) => {
              state.error =
                error instanceof Error ? error.message : "批量删除失败";
            });
            throw error;
          }
        },
      })),
      {
        name: "paper-store",
        partialize: (state) => ({
          filters: state.filters,
          pagination: state.pagination,
        }),
      },
    ),
    {
      name: "paper-store",
    },
  ),
);

// 任务状态管理
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
  fetchTasks: (params?: any) => Promise<void>;
  fetchTask: (id: string) => Promise<void>;
  cancelTask: (id: string) => Promise<void>;
  retryTask: (id: string) => Promise<void>;
  clearCompletedTasks: () => Promise<void>;
}

export const useTaskStore = create<TaskState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      tasks: [],
      activeTasks: [],
      taskUpdates: new Map(),
      loading: false,
      error: null,

      // Actions
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

            // Update active tasks
            const activeIndex = state.activeTasks.findIndex((t) => t.id === id);
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
          const response = await api.tasks.list(params);
          set((state) => {
            state.tasks = (response as any)?.items || [];
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
          const task = await api.tasks.get(id);
          get().updateTask(id, task as unknown as Partial<Task>);
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

// UI 状态管理
interface UIStateStore extends UIState {
  // Actions
  setTheme: (theme: "light" | "dark" | "system") => void;
  setLanguage: (language: "zh" | "en") => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  addNotification: (
    notification: Omit<Notification, "id" | "timestamp" | "read">,
  ) => void;
  removeNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;
  setModal: (modal: keyof ModalState, open: boolean) => void;
  setLoading: (key: keyof UIState["loading"], value: boolean) => void;
  setError: (key: keyof UIState["errors"], error: string | null) => void;
  clearErrors: () => void;
}

export const useUIStore = create<UIStateStore>()(
  devtools(
    immer((set) => ({
      // Initial state
      theme: "system",
      sidebarOpen: true,
      sidebarCollapsed: false,
      language: "zh",
      notifications: [],
      modals: {
        uploadPaper: false,
        paperViewer: false,
        taskDetails: false,
        settings: false,
        confirmDialog: false,
      },
      loading: {
        papers: false,
        tasks: false,
        upload: false,
      },
      errors: {},

      // Actions
      setTheme: (theme) =>
        set((state) => {
          state.theme = theme;
        }),

      setLanguage: (language) =>
        set((state) => {
          state.language = language;
        }),

      toggleSidebar: () =>
        set((state) => {
          state.sidebarOpen = !state.sidebarOpen;
        }),

      setSidebarOpen: (open) =>
        set((state) => {
          state.sidebarOpen = open;
        }),

      setSidebarCollapsed: (collapsed) =>
        set((state) => {
          state.sidebarCollapsed = collapsed;
        }),

      addNotification: (notification) =>
        set((state) => {
          const id = Date.now().toString();
          const newNotification: Notification = {
            ...notification,
            id,
            timestamp: new Date().toISOString(),
            read: false,
          };
          state.notifications.unshift(newNotification);

          // Auto remove after duration (if specified)
          if (notification.duration && notification.duration > 0) {
            setTimeout(() => {
              set((s) => {
                s.notifications = s.notifications.filter((n) => n.id !== id);
              });
            }, notification.duration);
          }
        }),

      removeNotification: (id) =>
        set((state) => {
          state.notifications = state.notifications.filter((n) => n.id !== id);
        }),

      markNotificationRead: (id) =>
        set((state) => {
          const notification = state.notifications.find((n) => n.id === id);
          if (notification) {
            notification.read = true;
          }
        }),

      clearAllNotifications: () =>
        set((state) => {
          state.notifications = [];
        }),

      setModal: (modal, open) =>
        set((state) => {
          state.modals[modal] = open;
        }),

      setLoading: (key, value) =>
        set((state) => {
          state.loading[key] = value;
        }),

      setError: (key, error) =>
        set((state) => {
          if (error) {
            state.errors[key] = error;
          } else {
            delete state.errors[key];
          }
        }),

      clearErrors: () =>
        set((state) => {
          state.errors = {};
        }),
    })),
    {
      name: "ui-store",
    },
  ),
);

// 导出所有 store
export { usePaperStore as default };
