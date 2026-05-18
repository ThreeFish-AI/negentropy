export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  title: string;
  description?: string;
  progress: number;
  paperId?: string;
  paperIds?: string[];
  workflow: string;
  options?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  logs: TaskLog[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedDuration?: number;
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
  details?: Record<string, unknown>;
}

export interface WebSocketMessage {
  type:
    | "task_update"
    | "task_progress"
    | "task_log"
    | "system_notification"
    | "ping"
    | "pong";
  taskId?: string;
  data?: unknown;
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

export type TaskFields = keyof Task;
