/**
 * 消息处理工具函数
 *
 * 从 app/page.tsx 提取的消息处理工具函数
 */

import { Message } from "@ag-ui/core";
import { BaseEvent, EventType } from "@ag-ui/core";
import type { ChatMessage } from "@/types/common";

export type { ChatMessage };

/**
 * 标准化消息内容为字符串
 * @param message 消息对象
 * @returns 标准化后的字符串内容
 */
export function normalizeMessageContent(message: Message): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("");
  }
  return message.content ? JSON.stringify(message.content) : "";
}

/**
 * 将消息数组映射为聊天消息格式
 * @param messages 原始消息数组
 * @returns 聊天消息数组
 */
export function mapMessagesToChat(messages: Message[]): ChatMessage[] {
  const chatMessages: ChatMessage[] = [];
  messages.forEach((message) => {
    const rawRole = (message.role || "assistant").toLowerCase();

    // 1. 过滤技术性/隐藏角色
    if (rawRole === "tool" || rawRole === "system" || rawRole === "function") {
      return;
    }

    // 2. 标准化角色为 "user" 或 "assistant"
    const role = rawRole === "user" ? "user" : "assistant";

    const content = normalizeMessageContent(message);
    if (!content) {
      return;
    }

    // 3. 提取来源信息（Message 扩展字段）
    const author = (message as { author?: string }).author;
    const timestamp = message.createdAt
      ? message.createdAt.getTime() / 1000
      : undefined;
    const runId = (message as { runId?: string }).runId;

    // 4. 添加到结果
    chatMessages.push({
      id: message.id,
      role,
      content,
      author,
      timestamp,
      runId,
    });
  });
  return chatMessages;
}

/**
 * 合并相邻的助手消息
 *
 * 合并策略（基于 runId 区分场景）：
 * - 同一 runId → 直接拼接（流式 token 碎片，不引入段落分隔）
 * - 不同 runId / 无 runId → 使用双换行符 (\n\n) 分隔（多轮次答复）
 *
 * @param messages 聊天消息数组
 * @returns 合并后的消息数组
 */
export function mergeAdjacentAssistant(messages: ChatMessage[]): ChatMessage[] {
  const merged: ChatMessage[] = [];
  messages.forEach((message) => {
    const last = merged[merged.length - 1];
    if (last && last.role === "assistant" && message.role === "assistant") {
      // 同一 runId → 直接拼接（流式 token 碎片，不引入段落分隔）
      // 不同 runId / 无 runId → 换行分隔（不同轮次答复）
      const sameRun =
        last.runId && message.runId && last.runId === message.runId;
      const separator = sameRun ? "" : "\n\n";
      last.content = `${last.content}${separator}${message.content}`;
      // 更新 runId 以便后续消息基于最新轮次判断
      last.runId = message.runId;
      return;
    }
    merged.push({ ...message });
  });
  return merged;
}

/**
 * 从事件构建聊天消息，带回退机制
 * @param events AG-UI 事件数组
 * @param fallbackMessages 回退消息数组
 * @returns 聊天消息数组
 */
export function buildChatMessagesFromEventsWithFallback(
  events: BaseEvent[],
  fallbackMessages: Message[],
): ChatMessage[] {
  const fallbackById = new Map<string, Message>();
  fallbackMessages.forEach((message) => fallbackById.set(message.id, message));

  // 1. 处理事件到映射
  const messageMap = new Map<
    string,
    {
      id: string;
      role: string;
      content: string;
      timestamp: number;
      runId?: string;
      author?: string;
    }
  >();

  // 追踪当前活跃的 runId（来自 RUN_STARTED 事件）
  let currentRunId: string | undefined;

  events.forEach((event) => {
    // 追踪最近的 RUN_STARTED 事件以获取 runId
    if (event.type === EventType.RUN_STARTED) {
      currentRunId =
        "runId" in event ? (event as { runId: string }).runId : undefined;
      return;
    }
    if (
      event.type !== EventType.TEXT_MESSAGE_START &&
      event.type !== EventType.TEXT_MESSAGE_CONTENT &&
      event.type !== EventType.TEXT_MESSAGE_END
    ) {
      return;
    }
    const messageId = "messageId" in event ? event.messageId : undefined;
    if (!messageId) {
      return;
    }
    let entry = messageMap.get(messageId);
    if (!entry) {
      const fallback = fallbackById.get(messageId);
      entry = {
        id: messageId,
        role: ("role" in event && event.role) || fallback?.role || "assistant",
        content: "",
        timestamp:
          "timestamp" in event && event.timestamp ? event.timestamp : 0,
        // 使用当前活跃的 runId（来自最近的 RUN_STARTED 事件）
        runId: currentRunId,
        author: "author" in event && event.author ? event.author : undefined,
      };
      messageMap.set(messageId, entry);
    }
    if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
      entry.content = `${entry.content}${event.delta ?? ""}`;
    }
    // 优化：始终使用非零 timestamp 更新（取最小值，即最早的时间）
    if ("timestamp" in event && event.timestamp && event.timestamp > 0) {
      if (entry.timestamp === 0 || event.timestamp < entry.timestamp) {
        entry.timestamp = event.timestamp;
      }
    }
  });

  // 2. 添加缺失的回退消息（保留不在流窗口中的历史）
  fallbackMessages.forEach((fallback) => {
    if (!messageMap.has(fallback.id)) {
      // 转换 Date 为秒时间戳以匹配事件
      const timestamp = fallback.createdAt
        ? fallback.createdAt.getTime() / 1000
        : 0;
      messageMap.set(fallback.id, {
        id: fallback.id,
        role: fallback.role,
        content: normalizeMessageContent(fallback),
        timestamp,
        runId: (fallback as { runId?: string }).runId,
        author: (fallback as { author?: string }).author,
      });
    } else {
      // 如果事件中缺少时间戳则回填
      const entry = messageMap.get(fallback.id)!;
      if (entry.timestamp === 0 && fallback.createdAt) {
        entry.timestamp = fallback.createdAt.getTime() / 1000;
      }
    }
  });

  const ordered = Array.from(messageMap.values())
    .map((entry) => {
      if (!entry.content.trim()) {
        const fallback = fallbackById.get(entry.id);
        if (fallback) {
          entry.content = normalizeMessageContent(fallback);
          entry.role = fallback.role;
        }
      }
      return entry;
    })
    .filter((entry) => entry.content.trim().length > 0)
    .sort((a, b) => {
      // 1. 优先使用 timestamp 排序
      if (a.timestamp && b.timestamp) {
        const timeDiff = a.timestamp - b.timestamp;
        if (timeDiff !== 0) {
          return timeDiff;
        }
        // 2. timestamp 相同时，使用 messageId 作为稳定排序键
        // 保持 messageId 的字典序，确保排序稳定
        return a.id.localeCompare(b.id);
      }
      // 3. 如果只有一个有 timestamp，有 timestamp 的排前面
      if (a.timestamp) return -1;
      if (b.timestamp) return 1;
      // 4. 都没有 timestamp，使用 messageId 排序
      return a.id.localeCompare(b.id);
    })
    .map((entry) => ({
      id: entry.id,
      role: entry.role,
      content: entry.content,
      timestamp: entry.timestamp || undefined,
      runId: entry.runId,
      author: entry.author,
    }));

  return mergeAdjacentAssistant(ordered);
}

/**
 * 确保消息 ID 唯一
 * @param messages 聊天消息数组
 * @returns ID 唯一的消息数组
 */
export function ensureUniqueMessageIds(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Map<string, number>();
  return messages.map((message) => {
    const count = seen.get(message.id) ?? 0;
    seen.set(message.id, count + 1);
    if (count === 0) {
      return message;
    }
    return {
      ...message,
      id: `${message.id}:${count}`,
    };
  });
}
