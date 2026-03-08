/**
 * 消息合并工具函数
 *
 * 从 app/page.tsx 提取的消息合并逻辑
 * 遵循 AGENTS.md 原则：模块化、复用驱动、单一职责
 */

import type { Message } from "@ag-ui/core";
import {
  getMessageCreatedAt,
  getMessageThreadId,
  type AgUiMessage,
} from "@/types/agui";
import {
  getMessageIdentityKey,
  getMessageTimestampMs,
  normalizeMessageContent,
} from "./message";

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
  const merged = new Map<string, Message>();

  [...messagesForRenderBase, ...optimisticMessages].forEach((message) => {
    const key = getMessageIdentityKey(message);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, message);
      return;
    }

    const existingContent = normalizeMessageContent(existing);
    const incomingContent = normalizeMessageContent(message);
    if (incomingContent.length >= existingContent.length) {
      merged.set(key, message);
    }
  });

  return [...merged.values()].sort((a, b) => {
    const timeDiff = getMessageTimestampMs(a) - getMessageTimestampMs(b);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return getMessageIdentityKey(a).localeCompare(getMessageIdentityKey(b));
  });
}

export function reconcileOptimisticMessages(
  messagesForRenderBase: Message[],
  optimisticMessages: Message[],
): Message[] {
  const canonicalByKey = new Map<string, AgUiMessage[]>();

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
    bucket.push(message as AgUiMessage);
    canonicalByKey.set(key, bucket);
  });

  canonicalByKey.forEach((bucket) => {
    bucket.sort((a, b) => {
      const aTime = getMessageCreatedAt(a)?.getTime() || 0;
      const bTime = getMessageCreatedAt(b)?.getTime() || 0;
      return aTime - bTime;
    });
  });

  return optimisticMessages.filter((message) => {
    if (message.role !== "user") {
      return true;
    }

    const optimisticMessage = message as AgUiMessage;
    const content = normalizeMessageContent(optimisticMessage).trim();
    if (!content) {
      return true;
    }

    const key = `${message.role}:${content}`;
    const bucket = canonicalByKey.get(key);
    if (!bucket || bucket.length === 0) {
      return true;
    }

    const optimisticTime =
      getMessageCreatedAt(optimisticMessage)?.getTime() || Date.now();
    const optimisticThreadId = getMessageThreadId(optimisticMessage);
    const canonicalIndex = bucket.findIndex((candidate) => {
      const candidateTime =
        getMessageCreatedAt(candidate)?.getTime() || optimisticTime;
      const sameThreadId =
        !optimisticThreadId ||
        !getMessageThreadId(candidate) ||
        getMessageThreadId(candidate) === optimisticThreadId;
      return (
        sameThreadId &&
        candidateTime >= optimisticTime - 2000 &&
        candidateTime <= optimisticTime + 10000
      );
    });

    if (canonicalIndex === -1) {
      return true;
    }

    bucket.splice(canonicalIndex, 1);
    return false;
  });
}
