import axios, { AxiosError, AxiosResponse } from "axios";

// API 配置
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_TIMEOUT = 30000; // 30 seconds

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 在这里可以添加认证头
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }

    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error("[API Request Error]", error);
    return Promise.reject(error);
  },
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(
      `[API Response] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`,
    );
    return response.data;
  },
  (error: AxiosError) => {
    const errorMessage =
      (error.response?.data as any)?.detail || error.message || "请求失败";
    console.error("[API Response Error]", {
      url: error.config?.url,
      status: error.response?.status,
      message: errorMessage,
    });

    // 统一错误处理
    if (error.response?.status) {
      const status = error.response.status;
      if (status === 401) {
        // 处理未授权
        console.warn("用户未登录或令牌已过期");
        // TODO: 跳转到登录页
      } else if (status === 403) {
        // 处理禁止访问
        console.warn("用户权限不足");
      } else if (status === 404) {
        // 处理资源未找到
        console.warn("请求的资源不存在");
      } else if (status >= 500) {
        // 处理服务器错误
        console.error("服务器内部错误");
      }
    }

    return Promise.reject(new Error(errorMessage));
  },
);

// API 接口定义
export const api = {
  // 论文相关接口
  papers: {
    // 获取论文列表
    list: (params?: any) => apiClient.get("/api/papers", { params }),

    // 获取单个论文详情
    get: (id: string) => apiClient.get(`/api/papers/${id}`),

    // 上传论文
    upload: (formData: FormData) =>
      apiClient.post("/api/papers", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),

    // 处理论文（翻译、分析等）
    process: (id: string, workflow: string, options?: any) =>
      apiClient.post(`/api/papers/${id}/process`, { workflow, options }),

    // 更新论文信息
    update: (id: string, data: any) => apiClient.put(`/api/papers/${id}`, data),

    // 删除论文
    delete: (id: string) => apiClient.delete(`/api/papers/${id}`),

    // 批量操作
    batchProcess: (ids: string[], workflow: string, options?: any) =>
      apiClient.post("/api/papers/batch-process", { ids, workflow, options }),

    batchDelete: (ids: string[]) =>
      apiClient.delete("/api/papers/batch", { data: { ids } }),
  },

  // 任务相关接口
  tasks: {
    // 获取任务列表
    list: (params?: any) => apiClient.get("/api/tasks", { params }),

    // 获取任务详情
    get: (id: string) => apiClient.get(`/api/tasks/${id}`),

    // 取消任务
    cancel: (id: string) => apiClient.post(`/api/tasks/${id}/cancel`),

    // 重试任务
    retry: (id: string) => apiClient.post(`/api/tasks/${id}/retry`),

    // 获取任务日志
    logs: (id: string) => apiClient.get(`/api/tasks/${id}/logs`),

    // 清理已完成任务
    cleanup: () => apiClient.delete("/api/tasks/cleanup"),
  },

  // 搜索相关接口
  search: {
    // 搜索论文
    papers: (query: string, filters?: any) =>
      apiClient.get("/api/search/papers", { params: { q: query, ...filters } }),

    // 获取搜索建议
    suggestions: (query: string) =>
      apiClient.get("/api/search/suggestions", { params: { q: query } }),

    // 获取搜索历史
    history: () => apiClient.get("/api/search/history"),

    // 清除搜索历史
    clearHistory: () => apiClient.delete("/api/search/history"),
  },

  // 统计相关接口
  stats: {
    // 获取仪表板统计
    dashboard: () => apiClient.get("/api/stats/dashboard"),

    // 获取论文统计
    papers: () => apiClient.get("/api/stats/papers"),

    // 获取任务统计
    tasks: () => apiClient.get("/api/stats/tasks"),
  },

  // 系统相关接口
  system: {
    // 获取系统信息
    info: () => apiClient.get("/api/system/info"),

    // 健康检查
    health: () => apiClient.get("/api/system/health"),
  },
};

// 导出 axios 实例以供高级用法
export default apiClient;
export { apiClient };

// 导出类型
export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: PaginationParams;
    timestamp: string;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
