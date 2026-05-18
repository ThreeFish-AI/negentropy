// 论文相关类型
export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract?: string;
  keywords?: string[];
  category: PaperCategory;
  status: PaperStatus;
  uploadedAt: string;
  updatedAt: string;
  fileSize: number;
  fileName: string;
  filePath?: string;
  translation?: {
    title: string;
    abstract: string;
    content: string;
    translatedAt: string;
  };
  analysis?: {
    summary: string;
    keyPoints: string[];
    insights: string[];
    analyzedAt: string;
  };
  metadata?: {
    journal?: string;
    year?: number;
    doi?: string;
    pages?: string;
  };
}

export type PaperCategory =
  | "llm-agents"
  | "context-engineering"
  | "reasoning"
  | "tool-use"
  | "planning"
  | "memory"
  | "multi-agent"
  | "evaluation"
  | "other";

export type PaperStatus =
  | "uploaded"
  | "processing"
  | "translated"
  | "analyzed"
  | "failed"
  | "deleted";

// 任务相关类型
export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  title: string;
  description?: string;
  progress: number; // 0-100
  paperId?: string;
  paperIds?: string[]; // 批量任务
  workflow: string;
  options?: Record<string, any>;
  result?: any;
  error?: string;
  logs: TaskLog[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedDuration?: number; // 预估耗时（秒）
}

export type TaskType =
  | "translate"
  | "analyze"
  | "extract"
  | "batch-translate"
  | "batch-analyze"
  | "index"
  | "cleanup";

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

export interface TaskLog {
  id: string;
  taskId: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
  details?: any;
}

// WebSocket 消息类型
export interface WebSocketMessage {
  type:
    | "task_update"
    | "task_progress"
    | "task_log"
    | "system_notification"
    | "ping"
    | "pong";
  taskId?: string;
  data?: any;
  timestamp: string;
}

export interface TaskUpdateMessage extends WebSocketMessage {
  type: "task_update";
  taskId: string;
  data: Partial<Task>;
}

export interface TaskProgressMessage extends WebSocketMessage {
  type: "task_progress";
  taskId: string;
  data: {
    progress: number;
    message?: string;
  };
}

export interface TaskLogMessage extends WebSocketMessage {
  type: "task_log";
  taskId: string;
  data: TaskLog;
}

// 搜索相关类型
export interface SearchQuery {
  q: string; // 搜索关键词
  category?: PaperCategory;
  status?: PaperStatus;
  dateFrom?: string;
  dateTo?: string;
  author?: string;
  sortBy?: "relevance" | "date" | "title";
  sortOrder?: "asc" | "desc";
}

export interface SearchResult {
  paper: Paper;
  highlights: {
    title?: string[];
    abstract?: string[];
    content?: string[];
  };
  score: number;
}

export interface SearchFilters {
  categories: PaperCategory[];
  statuses: PaperStatus[];
  dateRange: {
    start: string;
    end: string;
  };
  authors: string[];
}

// 用户界面状态类型
export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  duration?: number; // 自动关闭时间（毫秒）
  timestamp: string;
  read: boolean;
}

export interface ModalState {
  uploadPaper: boolean;
  paperViewer: boolean;
  taskDetails: boolean;
  settings: boolean;
  confirmDialog: boolean;
}

export interface UIState {
  theme: "light" | "dark" | "system";
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  language: "zh" | "en";
  notifications: Notification[];
  modals: ModalState;
  loading: {
    papers: boolean;
    tasks: boolean;
    upload: boolean;
  };
  errors: {
    papers?: string;
    tasks?: string;
    upload?: string;
  };
}

// 分页类型
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: Pagination;
    timestamp: string;
  };
}

// 统计数据类型
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

// 表单类型
export interface UploadPaperForm {
  file: File;
  category: PaperCategory;
  tags?: string[];
  metadata?: {
    journal?: string;
    year?: number;
    doi?: string;
  };
}

export interface PaperFilters {
  search?: string;
  category?: PaperCategory | "all";
  status?: PaperStatus | "all";
  dateRange?: {
    start: string;
    end: string;
  };
  author?: string;
  sortBy?: "uploadedAt" | "updatedAt" | "title";
  sortOrder?: "asc" | "desc";
}

// 配置类型
export interface AppConfig {
  apiBaseUrl: string;
  wsUrl: string;
  maxFileSize: number; // bytes
  supportedFormats: string[];
  uploadChunkSize: number; // bytes
  autoSaveInterval: number; // seconds
  theme: "light" | "dark" | "system";
  language: "zh" | "en";
}

// 导出所有类型的联合类型（用于通用组件）
export type PaperFields = keyof Paper;
export type TaskFields = keyof Task;
export type SortOrder = "asc" | "desc";
export type SortField = string;
