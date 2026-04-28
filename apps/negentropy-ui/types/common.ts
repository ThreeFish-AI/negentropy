/**
 * 通用类型定义
 *
 * 从 app/page.tsx 提取，解决类型定义分散问题
 * 遵循 AGENTS.md 原则：单一事实源
 */

import type { Message } from "@ag-ui/core";
import type { CanonicalMessageRole } from "@/types/agui";

/**
 * 连接状态类型
 */
export type ConnectionState =
  | "idle"
  | "connecting"
  | "streaming"
  | "blocked"
  | "error";

/**
 * 会话记录类型
 */
export type SessionRecord = {
  id: string;
  label: string;
  lastUpdateTime?: number;
  archived?: boolean;
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
  /** 线程 ID，用于标识消息所属会话 */
  threadId?: string;
  /** 当前消息是否仍在流式生成中 */
  streaming?: boolean;
  /** 关联的工具调用列表（内嵌显示在消息气泡中） */
  toolCalls?: ToolCallInfo[];
};

export type RoleResolutionSource =
  | "explicit_role"
  | "snapshot_role"
  | "protocol_author"
  | "tool_inference"
  | "fallback_assistant";

export type MessageLedgerEntry = {
  id: string;
  threadId: string;
  runId?: string;
  resolvedRole: CanonicalMessageRole;
  resolutionSource: RoleResolutionSource;
  content: string;
  createdAt: Date;
  streaming: boolean;
  lifecycle: "open" | "closed";
  origin: "realtime" | "snapshot" | "fallback";
  author?: string;
  sourceEventTypes: string[];
  relatedMessageIds: string[];
  /**
   * 事件在原始时序中的位置（buildMessageLedger 处理 events 的下标）。
   * 当多个 ledger 条目 createdAt 相等时，作为 tiebreaker 提供确定性时间序排序，
   * 避免退化为 UUID localeCompare 的随机顺序。
   *
   * 设为可选以保持对现有测试夹具与历史持久化数据的向后兼容；排序处统一以
   * `Number.MAX_SAFE_INTEGER` 作为缺省回退，确保未填充该字段的条目仍可比较。
   */
  sourceOrder?: number;
};

export type SessionProjectionState = {
  loadedSessionId: string | null;
  rawEvents: import("@ag-ui/core").BaseEvent[];
  messageLedger: MessageLedgerEntry[];
  snapshot: Record<string, unknown> | null;
};
