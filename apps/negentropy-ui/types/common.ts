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
 * 聊天消息类型
 *
 * 从 Message 类型提取必要的字段，确保类型兼容性
 * 扩展来源信息（author, timestamp, runId）用于 UI 显示
 */
export type ChatMessage = Pick<Message, "id" | "role"> & {
  content: string;
  /** Agent/作者名称（来自后端 AdkEventPayload.author） */
  author?: string;
  /** Unix 时间戳（秒），用于显示消息时间 */
  timestamp?: number;
  /** 运行 ID，用于标识消息所属的轮次 */
  runId?: string;
};
