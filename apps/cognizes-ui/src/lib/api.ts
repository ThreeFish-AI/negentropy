import axios, { AxiosError, AxiosResponse } from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_TIMEOUT = 30000;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => config, (error) => {
  return Promise.reject(error);
});

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error: AxiosError) => {
    const errorData = error.response?.data as
      | { detail?: string }
      | undefined;
    const errorMessage = errorData?.detail || error.message || "请求失败";
    return Promise.reject(new Error(errorMessage));
  },
);

export const api = {
  papers: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get("/api/papers", { params }),

    get: (id: string) => apiClient.get(`/api/papers/${id}`),

    upload: (formData: FormData) =>
      apiClient.post("/api/papers", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),

    process: (
      id: string,
      workflow: string,
      options?: Record<string, unknown>,
    ) => apiClient.post(`/api/papers/${id}/process`, { workflow, options }),

    update: (id: string, data: Record<string, unknown>) =>
      apiClient.put(`/api/papers/${id}`, data),

    delete: (id: string) => apiClient.delete(`/api/papers/${id}`),

    batchProcess: (
      ids: string[],
      workflow: string,
      options?: Record<string, unknown>,
    ) => apiClient.post("/api/papers/batch-process", { ids, workflow, options }),

    batchDelete: (ids: string[]) =>
      apiClient.delete("/api/papers/batch", { data: { ids } }),
  },

  tasks: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get("/api/tasks", { params }),

    get: (id: string) => apiClient.get(`/api/tasks/${id}`),

    cancel: (id: string) => apiClient.post(`/api/tasks/${id}/cancel`),

    retry: (id: string) => apiClient.post(`/api/tasks/${id}/retry`),

    logs: (id: string) => apiClient.get(`/api/tasks/${id}/logs`),

    cleanup: () => apiClient.delete("/api/tasks/cleanup"),
  },

  search: {
    papers: (query: string, filters?: Record<string, unknown>) =>
      apiClient.get("/api/search/papers", {
        params: { q: query, ...filters },
      }),

    suggestions: (query: string) =>
      apiClient.get("/api/search/suggestions", { params: { q: query } }),

    history: () => apiClient.get("/api/search/history"),

    clearHistory: () => apiClient.delete("/api/search/history"),
  },

  stats: {
    dashboard: () => apiClient.get("/api/stats/dashboard"),

    papers: () => apiClient.get("/api/stats/papers"),

    tasks: () => apiClient.get("/api/stats/tasks"),
  },

  system: {
    info: () => apiClient.get("/api/system/info"),

    health: () => apiClient.get("/api/system/health"),
  },
};

export default apiClient;
export { apiClient };
