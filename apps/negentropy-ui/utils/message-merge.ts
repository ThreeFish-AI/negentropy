/**
 * 消息合并工具函数
 *
 * 从 app/page.tsx 提取的消息合并逻辑
 * 遵循 AGENTS.md 原则：模块化、复用驱动、单一职责
 */

import { Message } from "@ag-ui/core";
import { normalizeMessageContent } from "./message";

type TimedMessage = Message & {
  createdAt?: Date;
};

/**
 * 合并乐观消息到基础消息列表
 *
 * 将乐观更新的消息与基础消息合并，避免重复
 * 使用内容合并策略处理同一 ID 的消息
 *
 * @param messagesForRenderBase - 基础消息列表
 * @param optimisticMessages - 乐观消息列表
 * @returns 合并后的消息列表
 *
 * @example
 * ```ts
 * const base = [{ id: "1", role: "user", content: "Hello" }];
 * const optimistic = [{ id: "2", role: "user", content: "World" }];
 * const merged = mergeOptimisticMessages(base, optimistic);
 * // [{ id: "1", role: "user", content: "Hello" }, { id: "2", role: "user", content: "World" }]
 * ```
 */
export function mergeOptimisticMessages(
  messagesForRenderBase: Message[],
  optimisticMessages: Message[],
): Message[] {
  // 收集已知消息 ID（仅包含有内容的消息）
  const knownIds = new Set(
    messagesForRenderBase
      .filter((message) => normalizeMessageContent(message).trim().length > 0)
      .map((message) => message.id),
  );

  // 过滤掉已在基础消息中的乐观消息
  const validOptimistic = optimisticMessages.filter(
    (message) => !knownIds.has(message.id),
  );

  // 没有有效的乐观消息，直接返回基础消息
  if (validOptimistic.length === 0) {
    return messagesForRenderBase;
  }

  // 开始合并
  const merged = [...messagesForRenderBase];
  const indexById = new Map<string, number>();
  merged.forEach((message, index) => {
    indexById.set(message.id, index);
  });

  // 处理每个有效的乐观消息
  validOptimistic.forEach((message) => {
    const index = indexById.get(message.id);
    // 消息不存在，直接添加
    if (index === undefined) {
      merged.push(message);
      indexById.set(message.id, merged.length - 1);
      return;
    }
    // 消息已存在，进行内容合并
    const existing = merged[index];
    if (!existing.content && message.content) {
      merged[index] = message;
    }
  });

  return merged;
}

export function reconcileOptimisticMessages(
  messagesForRenderBase: Message[],
  optimisticMessages: Message[],
): Message[] {
  const canonicalByKey = new Map<string, TimedMessage[]>();

  messagesForRenderBase.forEach((message) => {
    if (message.role !== "user") {
      return;
    }
    const content = normalizeMessageContent(message).trim();
    if (!content) {
      return;
    }
    const key = `${message.role}:${content}`;
    const bucket = canonicalByKey.get(key) || [];
    bucket.push(message as TimedMessage);
    canonicalByKey.set(key, bucket);
  });

  canonicalByKey.forEach((bucket) => {
    bucket.sort((a, b) => {
      const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
      return aTime - bTime;
    });
  });

  return optimisticMessages.filter((message) => {
    if (message.role !== "user") {
      return true;
    }

    const content = normalizeMessageContent(message).trim();
    if (!content) {
      return true;
    }

    const key = `${message.role}:${content}`;
    const bucket = canonicalByKey.get(key);
    if (!bucket || bucket.length === 0) {
      return true;
    }

    const optimisticTime =
      message.createdAt instanceof Date ? message.createdAt.getTime() : Date.now();
    const canonicalIndex = bucket.findIndex((candidate) => {
      const candidateTime =
        candidate.createdAt instanceof Date ? candidate.createdAt.getTime() : optimisticTime;
      return candidateTime >= optimisticTime - 2000;
    });

    if (canonicalIndex === -1) {
      return true;
    }

    bucket.splice(canonicalIndex, 1);
    return false;
  });
}
