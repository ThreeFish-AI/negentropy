import { useCallback } from "react";
import useSWR, { SWRConfiguration, SWRResponse } from "swr";
import api, { apiClient } from "@/lib/api";
import type { ApiResponse, PaginationParams } from "@/lib/api";
import type {
  Paper,
  Task,
  SearchResult,
  DashboardStats,
  TaskLog,
} from "@/types";

// Extend api type to include all methods
const typedApi = api as typeof api & {
  papers: {
    list: (params?: any) => Promise<any>;
    get: (id: string) => Promise<Paper>;
    upload: (formData: FormData) => Promise<string>;
    process: (id: string, workflow: string, options?: any) => Promise<Task>;
    delete: (id: string) => Promise<void>;
    batchProcess: (
      ids: string[],
      workflow: string,
      options?: any,
    ) => Promise<Task>;
    batchDelete: (ids: string[]) => Promise<void>;
  };
  tasks: {
    list: (params?: any) => Promise<any>;
    get: (id: string) => Promise<Task>;
    cancel: (id: string) => Promise<void>;
    retry: (id: string) => Promise<void>;
    logs: (id: string) => Promise<TaskLog[]>;
    cleanup: () => Promise<void>;
  };
  search: {
    papers: (
      query: string,
      filters?: any,
    ) => Promise<{ items: SearchResult[]; total: number }>;
    suggestions: (query: string) => Promise<string[]>;
    history: () => Promise<string[]>;
    clearHistory: () => Promise<void>;
  };
  stats: {
    dashboard: () => Promise<DashboardStats>;
    papers: () => Promise<any>;
    tasks: () => Promise<any>;
  };
  system: {
    info: () => Promise<any>;
    health: () => Promise<any>;
  };
};

// 通用 fetcher 函数
const fetcher = async (url: string): Promise<any> => {
  const response = await apiClient.get(url);
  return response;
};

// API 配置
const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  dedupingInterval: 10000,
};

// 论文相关的 hooks
export const usePapers = (
  params?: PaginationParams & {
    category?: string;
    status?: string;
    search?: string;
  },
): SWRResponse<{
  items: Paper[];
  total: number;
  page: number;
  limit: number;
}> => {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
  }

  const url = queryParams.toString()
    ? `/api/papers?${queryParams}`
    : "/api/papers";

  return useSWR(
    url,
    async () => {
      const response = await typedApi.papers.list(params);
      return response;
    },
    swrConfig,
  );
};

export const usePaper = (id: string): SWRResponse<Paper> => {
  return useSWR(
    id ? `/api/papers/${id}` : null,
    async () => {
      const response = await typedApi.papers.get(id);
      return response;
    },
    {
      ...swrConfig,
      revalidateOnMount: true,
    },
  );
};

// 任务相关的 hooks
export const useTasks = (
  params?: PaginationParams & {
    status?: string;
    type?: string;
  },
): SWRResponse<{
  items: Task[];
  total: number;
  page: number;
  limit: number;
}> => {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
  }

  const url = queryParams.toString()
    ? `/api/tasks?${queryParams}`
    : "/api/tasks";

  return useSWR(
    url,
    async () => {
      const response = await typedApi.tasks.list(params);
      return response;
    },
    swrConfig,
  );
};

export const useTask = (id: string): SWRResponse<Task> => {
  return useSWR(
    id ? `/api/tasks/${id}` : null,
    async () => {
      const response = await typedApi.tasks.get(id);
      return response;
    },
    {
      ...swrConfig,
      refreshInterval: 3000, // 每3秒刷新一次运行中的任务
    },
  );
};

export const useTaskLogs = (id: string): SWRResponse<TaskLog[]> => {
  return useSWR(
    id ? `/api/tasks/${id}/logs` : null,
    async () => {
      const response = await typedApi.tasks.logs(id);
      return response;
    },
    {
      ...swrConfig,
      refreshInterval: 2000, // 每2秒刷新日志
    },
  );
};

// 搜索相关的 hooks
export const useSearch = (
  query: string,
  filters?: {
    category?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    author?: string;
  },
): SWRResponse<{ items: SearchResult[]; total: number; query: string }> => {
  const params = new URLSearchParams();
  params.append("q", query);
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
  }

  return useSWR(
    query ? `/api/search/papers?${params}` : null,
    async () => {
      const response = await typedApi.search.papers(query, filters);
      return {
        items: response.items,
        total: response.total,
        query: query,
      };
    },
    {
      ...swrConfig,
      revalidateOnMount: false, // 避免重复请求
    },
  );
};

export const useSearchSuggestions = (query: string): SWRResponse<string[]> => {
  return useSWR(
    query && query.length > 2
      ? `/api/search/suggestions?q=${encodeURIComponent(query)}`
      : null,
    async () => {
      const response = await typedApi.search.suggestions(query);
      return response;
    },
    {
      ...swrConfig,
      revalidateOnMount: false,
    },
  );
};

// 统计相关的 hooks
export const useDashboardStats = (): SWRResponse<DashboardStats> => {
  return useSWR(
    "/api/stats/dashboard",
    async () => {
      const response = await typedApi.stats.dashboard();
      return response;
    },
    {
      ...swrConfig,
      refreshInterval: 30000, // 每30秒刷新统计数据
    },
  );
};

// 系统相关的 hooks
export const useSystemHealth = (): SWRResponse<{
  status: "healthy" | "degraded" | "down";
  services: Record<string, boolean>;
}> => {
  return useSWR(
    "/api/system/health",
    async () => {
      const response = await typedApi.system.health();
      return response;
    },
    {
      ...swrConfig,
      refreshInterval: 10000, // 每10秒检查健康状态
    },
  );
};

// 通用 API 请求 hook
export const useApiRequest = () => {
  // 上传论文
  const uploadPaper = useCallback(
    async (file: File, category: string, metadata?: Record<string, any>) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      if (metadata) {
        Object.entries(metadata).forEach(([key, value]) => {
          formData.append(key, String(value));
        });
      }

      return typedApi.papers.upload(formData);
    },
    [],
  );

  // 处理论文
  const processPaper = useCallback(
    async (id: string, workflow: string, options?: Record<string, any>) => {
      return typedApi.papers.process(id, workflow, options);
    },
    [],
  );

  // 批量处理论文
  const batchProcessPapers = useCallback(
    async (ids: string[], workflow: string, options?: Record<string, any>) => {
      return typedApi.papers.batchProcess(ids, workflow, options);
    },
    [],
  );

  // 删除论文
  const deletePaper = useCallback(async (id: string) => {
    return typedApi.papers.delete(id);
  }, []);

  // 批量删除论文
  const batchDeletePapers = useCallback(async (ids: string[]) => {
    return typedApi.papers.batchDelete(ids);
  }, []);

  // 取消任务
  const cancelTask = useCallback(async (id: string) => {
    return typedApi.tasks.cancel(id);
  }, []);

  // 重试任务
  const retryTask = useCallback(async (id: string) => {
    return typedApi.tasks.retry(id);
  }, []);

  // 清理已完成的任务
  const cleanupTasks = useCallback(async () => {
    return typedApi.tasks.cleanup();
  }, []);

  return {
    // Paper actions
    uploadPaper,
    processPaper,
    batchProcessPapers,
    deletePaper,
    batchDeletePapers,

    // Task actions
    cancelTask,
    retryTask,
    cleanupTasks,
  };
};

// 错误处理 hook
export const useApiError = () => {
  const handleError = useCallback((error: unknown) => {
    if (error instanceof Error) {
      console.error("API Error:", error.message);
      return error.message;
    }

    if (typeof error === "object" && error !== null && "response" in error) {
      const axiosError = error as any;
      const message = axiosError.response?.data?.detail || "请求失败";
      console.error("API Error:", message);
      return message;
    }

    console.error("Unknown Error:", error);
    return "未知错误";
  }, []);

  return { handleError };
};

// 导出所有 hooks
export { api, apiClient };

export type { ApiResponse, PaginationParams };
