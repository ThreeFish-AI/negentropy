import { api } from "@/lib/api";
import type {
  Pagination,
  Paper,
  PaperFilters,
  Task,
} from "@/types";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

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
  fetchPapers: (params?: Record<string, unknown>) => Promise<void>;
  fetchPaper: (id: string) => Promise<void>;
  uploadPaper: (
    file: File,
    category: string,
    metadata?: Record<string, string | number>,
  ) => Promise<string>;
  processPaper: (
    id: string,
    workflow: string,
    options?: Record<string, unknown>,
  ) => Promise<Task>;
  deletePaper: (id: string) => Promise<void>;
  batchProcessPapers: (
    ids: string[],
    workflow: string,
    options?: Record<string, unknown>,
  ) => Promise<Task>;
  batchDeletePapers: (ids: string[]) => Promise<void>;
}

interface PaginatedPapersResponse {
  items: Paper[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const usePaperStore = create<PaperState>()(
  devtools(
    persist(
      immer((set, get) => ({
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
            state.papers = state.papers.filter((p) => p.id !== id);
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
            state.pagination.page = 1;
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
            const response = (await api.papers.list({
              ...get().filters,
              ...get().pagination,
              ...params,
            })) as unknown as PaginatedPapersResponse;

            set((state) => {
              state.papers = response?.items || [];
              state.pagination = {
                page: response?.page || 1,
                limit: response?.limit || 20,
                total: response?.total || 0,
                totalPages: response?.totalPages || 0,
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
            const responseData = response as unknown as { data?: Paper } | Paper;
            const paperData =
              ("data" in responseData ? responseData.data : responseData) as Paper;
            set((state) => {
              state.currentPaper = paperData;
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
            const response = (await api.papers.upload(formData)) as unknown as {
              task_id?: string;
            };
            return response?.task_id || "";
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : "上传失败";
            });
            throw error;
          }
        },

        processPaper: async (id, workflow, options) => {
          try {
            const task = (await api.papers.process(
              id,
              workflow,
              options,
            )) as unknown as Task;

            get().updatePaper(id, { status: "processing" });

            // Lazy import to avoid circular dependency
            const { useTaskStore } = await import("./task");
            useTaskStore.getState().addTask(task);

            return task;
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
            const task = (await api.papers.batchProcess(
              ids,
              workflow,
              options,
            )) as unknown as Task;

            ids.forEach((id) => {
              get().updatePaper(id, { status: "processing" });
            });

            const { useTaskStore } = await import("./task");
            useTaskStore.getState().addTask(task);

            return task;
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
