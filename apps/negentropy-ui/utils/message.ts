/**
 * 消息处理工具函数
 *
 * 从 app/page.tsx 提取的消息处理工具函数
 */

import { Message } from "@ag-ui/core";
import { BaseEvent, EventType } from "@ag-ui/core";

export type ChatMessage = { id: string; role: string; content: string };

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
  const merged: ChatMessage[] = [];
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

    const last = merged[merged.length - 1];

    // 3. 智能合并策略
    // A) 快照更新 (如 "Hello" -> "Hello World"): 新内容以旧内容开头。替换。
    // B) 增量/分块 (如 "Hello" -> "!"): 新内容追加到旧内容。连接。
    if (last && last.role === "assistant" && role === "assistant") {
      if (content.startsWith(last.content)) {
        last.content = content;
      } else {
        last.content = `${last.content}${content}`;
      }
      return;
    }

    merged.push({
      id: message.id,
      role,
      content,
    });
  });
  return merged;
}

/**
 * 合并相邻的助手消息
 * @param messages 聊天消息数组
 * @returns 合并后的消息数组
 */
export function mergeAdjacentAssistant(messages: ChatMessage[]): ChatMessage[] {
  const merged: ChatMessage[] = [];
  messages.forEach((message) => {
    const last = merged[merged.length - 1];
    if (last && last.role === "assistant" && message.role === "assistant") {
      last.content = `${last.content}${message.content}`;
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
  fallbackMessages: Message[]
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
    }
  >();

  events.forEach((event) => {
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
      };
      messageMap.set(messageId, entry);
    }
    if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
      entry.content = `${entry.content}${event.delta ?? ""}`;
    }
    if (entry.timestamp === 0 && "timestamp" in event && event.timestamp) {
      entry.timestamp = event.timestamp;
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
      // 按时间戳排序（秒）
      if (a.timestamp && b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return 0;
    })
    .map((entry) => ({
      id: entry.id,
      role: entry.role,
      content: entry.content,
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
