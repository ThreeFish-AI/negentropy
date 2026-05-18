import type { PaperCategory, PaperStatus } from "./paper";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    pagination?: Pagination;
    timestamp: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardStats {
  papers: {
    total: number;
    byCategory: Record<PaperCategory, number>;
    byStatus: Record<PaperStatus, number>;
    recentlyAdded: number;
  };
  tasks: {
    total: number;
    running: number;
    completed: number;
    failed: number;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
}

export type SortOrder = "asc" | "desc";
export type SortField = string;
