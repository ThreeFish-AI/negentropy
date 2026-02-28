/**
 * 通用类型定义
 *
 * 从 app/page.tsx 提取，解决类型定义分散问题
 * 遵循 AGENTS.md 原则：单一事实源
 */

import type { Message } from "@ag-ui/core";

/**
 * 连接状态类型
 */
export type ConnectionState = "idle" | "connecting" | "streaming" | "error";

/**
 * 会话记录类型
 */
export type SessionRecord = {
  id: string;
  label: string;
  lastUpdateTime?: number;
};

/**
 * 日志条目类型
 */
export type LogEntry = {
  id?: string; // 可选的日志 ID（用于 UI 渲染）
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  payload?: Record<string, unknown>;
};

/**
 * 认证用户类型
 */
export type AuthUser = {
  userId: string;
  email?: string;
  name?: string;
  picture?: string;
  roles?: string[];
  provider?: string;
};

/**
 * 认证状态类型
 */
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/**
 * 工具调用状态类型
 */
export type ToolCallStatus = "running" | "done" | "completed" | "error";

/**
 * 工具调用信息类型（用于消息流内展示）
 *
 * 参考 Claude.ai / ChatGPT 的工具调用展示设计
 * 支持折叠/展开显示工具调用的入参和结果
 */
export type ToolCallInfo = {
  /** 工具调用 ID */
  id: string;
  /** 工具名称 */
  name: string;
  /** 工具参数（JSON 字符串） */
  args: string;
  /** 工具返回结果 */
  result?: string;
  /** 调用状态 */
  status: ToolCallStatus;
  /** 时间戳（Unix 秒） */
  timestamp?: number;
};

/**
 * 聊天消息类型
 *
 * 从 Message 类型提取必要的字段，确保类型兼容性
 * 扩展来源信息（author, timestamp, runId）用于 UI 显示
 * 支持关联的工具调用列表（内嵌显示在消息气泡中）
 */
export type ChatMessage = Pick<Message, "id" | "role"> & {
  content: string;
  /** Agent/作者名称（来自后端 AdkEventPayload.author） */
  author?: string;
  /** Unix 时间戳（秒），用于显示消息时间 */
  timestamp?: number;
  /** 运行 ID，用于标识消息所属的轮次 */
  runId?: string;
  /** 关联的工具调用列表（内嵌显示在消息气泡中） */
  toolCalls?: ToolCallInfo[];
};
