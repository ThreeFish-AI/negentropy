/**
 * 事件过滤 Hook
 *
 * 从 app/page.tsx 提取的事件过滤逻辑
 * 遵循 AGENTS.md 原则：模块化、复用驱动、单一职责
 */

import { useMemo } from "react";
import { BaseEvent, EventType } from "@ag-ui/core";

/**
 * useEventFilter Hook 参数
 */
export interface UseEventFilterOptions {
  /** 原始事件列表 */
  rawEvents: BaseEvent[];
  /** 选中的消息 ID */
  selectedMessageId: string | null;
}

/**
 * useEventFilter Hook 返回值
 */
export interface UseEventFilterReturnValue {
  /** 过滤后的事件列表 */
  filteredEvents: BaseEvent[];
  /** 消息时间戳映射 */
  messageTimestamps: Map<string, number>;
}

/**
 * 事件过滤 Hook
 *
 * 根据选中的消息 ID 过滤事件，实现历史视图功能
 *
 * @param options - Hook 配置选项
 * @returns Hook 返回值
 */
export function useEventFilter(
  options: UseEventFilterOptions,
): UseEventFilterReturnValue {
  const { rawEvents, selectedMessageId } = options;

  // 构建消息时间戳映射
  const messageTimestamps = useMemo(() => {
    const timestampMap = new Map<string, number>();

    // 处理所有 TEXT_MESSAGE 事件以构建映射
    rawEvents.forEach((event) => {
      if (
        event.type === EventType.TEXT_MESSAGE_START ||
        event.type === EventType.TEXT_MESSAGE_CONTENT ||
        event.type === EventType.TEXT_MESSAGE_END
      ) {
        const messageId = "messageId" in event ? event.messageId : undefined;
        const timestamp = "timestamp" in event ? event.timestamp : undefined;

        if (messageId && timestamp !== undefined) {
          // 存储此消息的时间戳
          if (!timestampMap.has(messageId)) {
            timestampMap.set(messageId, timestamp);
          }
        }
      }
    });

    return timestampMap;
  }, [rawEvents]);

  // 根据选中的消息 ID 过滤事件
  const filteredEvents = useMemo(() => {
    if (!selectedMessageId) {
      return rawEvents; // 显示所有事件（当前行为）
    }

    const cutoffTimestamp = messageTimestamps.get(selectedMessageId);
    if (cutoffTimestamp === undefined) {
      return rawEvents; // 消息未找到，显示所有
    }

    // 过滤事件以仅显示在选中消息时间戳之前/处的事件
    return rawEvents.filter((event) => {
      const eventTimestamp = event.timestamp || 0;
      return eventTimestamp <= cutoffTimestamp;
    });
  }, [rawEvents, selectedMessageId, messageTimestamps]);

  return {
    filteredEvents,
    messageTimestamps,
  };
}
