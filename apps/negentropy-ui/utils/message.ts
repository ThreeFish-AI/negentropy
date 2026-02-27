/**
 * 消息处理工具函数
 *
 * 从 app/page.tsx 提取的消息处理工具函数
 */

import { Message } from "@ag-ui/core";
import { BaseEvent, EventType } from "@ag-ui/core";
import type { ChatMessage, ToolCallInfo } from "@/types/common";

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
 * 检查两个消息内容是否相似（用于去重）
 *
 * 相似条件：
 * 1. 内容包含关系（一个包含另一个）
 * 2. Jaccard 相似度 > 0.7（基于词汇集合）
 *
 * @param content1 第一个内容
 * @param content2 第二个内容
 * @returns 是否相似
 */
function isContentSimilar(content1: string, content2: string): boolean {
  // 空内容不相似
  if (!content1.trim() || !content2.trim()) return false;

  // 规范化内容：去除空白、转小写
  const normalized1 = content1.trim().toLowerCase();
  const normalized2 = content2.trim().toLowerCase();

  // 完全相同
  if (normalized1 === normalized2) return true;

  // 包含关系检查（对于长度差异不大的情况）
  const len1 = normalized1.length;
  const len2 = normalized2.length;
  const lengthRatio = Math.min(len1, len2) / Math.max(len1, len2);

  // 如果长度比例大于 0.7，检查包含关系
  if (lengthRatio > 0.7) {
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return true;
    }
  }

  // Jaccard 相似度检查（基于词汇集合）
  // 对于短消息（< 50 字符），使用更严格的完全匹配
  if (len1 < 50 || len2 < 50) {
    return false;
  }

  const words1 = new Set(normalized1.split(/\s+/).filter(Boolean));
  const words2 = new Set(normalized2.split(/\s+/).filter(Boolean));

  if (words1.size === 0 || words2.size === 0) return false;

  // 计算交集
  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  const jaccardSimilarity = intersection.size / union.size;

  return jaccardSimilarity > 0.7;
}

/**
 * 合并相邻的助手消息
 *
 * 合并策略（基于 runId 区分场景）：
 * - 同一 runId → 直接拼接（流式 token 碎片，不引入段落分隔）
 * - 不同 runId / 无 runId → 使用双换行符 (\n\n) 分隔（多轮次答复）
 * - 防重逻辑：如果内容存在包含关系，保留较长内容
 *
 * @param messages 聊天消息数组
 * @returns 合并后的消息数组
 */
export function mergeAdjacentAssistant(messages: ChatMessage[]): ChatMessage[] {
  const merged: ChatMessage[] = [];
  messages.forEach((message) => {
    const last = merged[merged.length - 1];
    if (last && last.role === "assistant" && message.role === "assistant") {
      // 防重检查：如果内容存在包含关系，保留较长内容
      if (last.content.includes(message.content)) {
        // 上一条已包含当前内容，跳过
        return;
      }
      if (message.content.includes(last.content)) {
        // 当前内容包含上一条，替换为当前内容
        last.content = message.content;
        last.runId = message.runId;
        // 合并工具调用
        if (message.toolCalls && message.toolCalls.length > 0) {
          last.toolCalls = [...(last.toolCalls || []), ...message.toolCalls];
        }
        return;
      }

      // 同一 runId → 直接拼接（流式 token 碎片，不引入段落分隔）
      // 不同 runId / 无 runId → 换行分隔（不同轮次答复）
      const sameRun =
        last.runId && message.runId && last.runId === message.runId;
      const separator = sameRun ? "" : "\n\n";
      last.content = `${last.content}${separator}${message.content}`;
      // 更新 runId 以便后续消息基于最新轮次判断
      last.runId = message.runId;
      // 合并工具调用
      if (message.toolCalls && message.toolCalls.length > 0) {
        last.toolCalls = [...(last.toolCalls || []), ...message.toolCalls];
      }
      return;
    }
    merged.push({ ...message });
  });
  return merged;
}

/**
 * 从事件构建聊天消息，带回退机制
 *
 * 支持功能：
 * - 文本消息拼接（处理 delta 或完整内容）
 * - 工具调用收集（按 runId 关联到消息）
 * - 事件去重（同一 messageId 的多个 TEXT_MESSAGE_CONTENT 只保留最后一个）
 *
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

  // 消息映射（扩展支持 toolCalls）
  const messageMap = new Map<
    string,
    {
      id: string;
      role: string;
      content: string;
      timestamp: number;
      runId?: string;
      author?: string;
      toolCalls?: ToolCallInfo[];
    }
  >();

  // 工具调用收集（按 runId 分组）
  const toolCallsByRunId = new Map<string, ToolCallInfo[]>();
  const toolCallIndex = new Map<string, { runId: string; index: number }>();

  // 追踪当前活跃的 runId（来自 RUN_STARTED 事件）
  let currentRunId: string | undefined;

  // 用于去重：记录每个 messageId 最后一次 TEXT_MESSAGE_CONTENT 事件的内容
  const lastContentByMessageId = new Map<string, string>();

  // 第一遍遍历：收集工具调用和去重后的文本内容
  events.forEach((event) => {
    // 追踪最近的 RUN_STARTED 事件以获取 runId
    if (event.type === EventType.RUN_STARTED) {
      currentRunId =
        "runId" in event ? (event as { runId: string }).runId : undefined;
      return;
    }

    const eventRunId =
      "runId" in event
        ? (event as { runId?: string }).runId
        : currentRunId;

    // 处理工具调用事件
    switch (event.type) {
      case EventType.TOOL_CALL_START: {
        const toolCallId = "toolCallId" in event ? event.toolCallId : "";
        const toolCallName = "toolCallName" in event ? event.toolCallName : "";
        const toolCall: ToolCallInfo = {
          id: toolCallId,
          name: toolCallName,
          args: "",
          status: "running",
          timestamp: "timestamp" in event ? (event.timestamp as number) : undefined,
        };

        const runId = eventRunId || "default";
        if (!toolCallsByRunId.has(runId)) {
          toolCallsByRunId.set(runId, []);
        }
        const toolCalls = toolCallsByRunId.get(runId)!;
        toolCallIndex.set(toolCallId, { runId, index: toolCalls.length });
        toolCalls.push(toolCall);
        break;
      }
      case EventType.TOOL_CALL_ARGS: {
        const toolCallId = "toolCallId" in event ? event.toolCallId : "";
        const delta = "delta" in event ? (event.delta as string) : "";
        const info = toolCallIndex.get(toolCallId);
        if (info) {
          const toolCalls = toolCallsByRunId.get(info.runId);
          if (toolCalls && toolCalls[info.index]) {
            toolCalls[info.index].args += delta;
          }
        }
        break;
      }
      case EventType.TOOL_CALL_RESULT: {
        const toolCallId = "toolCallId" in event ? event.toolCallId : "";
        const content = "content" in event ? (event.content as string) : "";
        const info = toolCallIndex.get(toolCallId);
        if (info) {
          const toolCalls = toolCallsByRunId.get(info.runId);
          if (toolCalls && toolCalls[info.index]) {
            toolCalls[info.index].result = content;
            toolCalls[info.index].status = "completed";
          }
        }
        break;
      }
      case EventType.TOOL_CALL_END: {
        const toolCallId = "toolCallId" in event ? event.toolCallId : "";
        const info = toolCallIndex.get(toolCallId);
        if (info) {
          const toolCalls = toolCallsByRunId.get(info.runId);
          if (toolCalls && toolCalls[info.index] && toolCalls[info.index].status === "running") {
            toolCalls[info.index].status = "done";
          }
        }
        break;
      }
    }

    // 处理文本消息事件
    if (
      event.type === EventType.TEXT_MESSAGE_START ||
      event.type === EventType.TEXT_MESSAGE_CONTENT ||
      event.type === EventType.TEXT_MESSAGE_END
    ) {
      const messageId = "messageId" in event ? event.messageId : undefined;
      if (!messageId) {
        return;
      }

      // 对于 TEXT_MESSAGE_CONTENT，记录最后一次的内容（用于去重）
      if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
        const delta = "delta" in event ? (event.delta as string) : "";
        // 如果 delta 看起来像是完整内容（比当前记录长很多或当前为空），直接替换
        const existing = lastContentByMessageId.get(messageId) || "";
        if (delta.length > existing.length || existing === "") {
          lastContentByMessageId.set(messageId, delta);
        } else {
          // 否则拼接（增量模式）
          lastContentByMessageId.set(messageId, existing + delta);
        }
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
          runId: eventRunId,
          author: "author" in event && event.author ? event.author : undefined,
        };
        messageMap.set(messageId, entry);
      }

      // 更新时间戳
      if ("timestamp" in event && event.timestamp && event.timestamp > 0) {
        if (entry.timestamp === 0 || event.timestamp < entry.timestamp) {
          entry.timestamp = event.timestamp;
        }
      }
    }
  });

  // 应用去重后的文本内容
  lastContentByMessageId.forEach((content, messageId) => {
    const entry = messageMap.get(messageId);
    if (entry) {
      entry.content = content;
    }
  });

  // 将工具调用关联到对应 runId 的消息
  toolCallsByRunId.forEach((toolCalls, runId) => {
    // 找到该 runId 对应的第一个消息
    let targetEntry: { id: string; role: string; content: string; timestamp: number; runId?: string; author?: string; toolCalls?: ToolCallInfo[] } | undefined;
    messageMap.forEach((entry) => {
      if (entry.runId === runId && !targetEntry) {
        targetEntry = entry;
      }
    });

    if (targetEntry) {
      // 关联到现有消息
      targetEntry.toolCalls = toolCalls;
    } else if (toolCalls.length > 0) {
      // 没有对应的文本消息，创建独立的工具调用消息
      const firstToolCall = toolCalls[0];
      const toolMessageId = `tool_${runId}_${firstToolCall.id}`;
      messageMap.set(toolMessageId, {
        id: toolMessageId,
        role: "assistant",
        content: "", // 工具调用消息没有文本内容
        timestamp: firstToolCall.timestamp || 0,
        runId,
        toolCalls,
      });
    }
  });

  // 添加缺失的回退消息（保留不在流窗口中的历史）
  // 使用内容相似度检查防止 ID 不同但内容相同的重复
  fallbackMessages.forEach((fallback) => {
    const fallbackContent = normalizeMessageContent(fallback);

    // 检查是否有 ID 匹配的消息
    if (messageMap.has(fallback.id)) {
      // 回填时间戳
      const entry = messageMap.get(fallback.id)!;
      if (entry.timestamp === 0 && fallback.createdAt) {
        entry.timestamp = fallback.createdAt.getTime() / 1000;
      }
      return;
    }

    // 检查是否有内容相似的消息（防止 ID 不同但内容相同的重复）
    const hasSimilarContent = Array.from(messageMap.values()).some((entry) =>
      isContentSimilar(entry.content, fallbackContent),
    );

    if (hasSimilarContent) {
      // 跳过内容相似的 fallback 消息
      return;
    }

    // 添加新的 fallback 消息
    const timestamp = fallback.createdAt
      ? fallback.createdAt.getTime() / 1000
      : 0;
    messageMap.set(fallback.id, {
      id: fallback.id,
      role: fallback.role,
      content: fallbackContent,
      timestamp,
      runId: (fallback as { runId?: string }).runId,
      author: (fallback as { author?: string }).author,
    });
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
    // 保留工具调用消息（即使没有文本内容）
    .filter((entry) => entry.content.trim().length > 0 || (entry.toolCalls && entry.toolCalls.length > 0))
    .sort((a, b) => {
      // 1. 优先使用 timestamp 排序
      if (a.timestamp && b.timestamp) {
        const timeDiff = a.timestamp - b.timestamp;
        if (timeDiff !== 0) {
          return timeDiff;
        }
        // 2. timestamp 相同时，使用 messageId 作为稳定排序键
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
      toolCalls: entry.toolCalls,
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
