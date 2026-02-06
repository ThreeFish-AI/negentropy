/**
 * 事件处理 Hook
 *
 * 从 app/page.tsx HomeBody 组件提取的事件处理逻辑
 *
 * 职责：
 * - 事件流订阅和处理
 * - 指标追踪
 * - 日志记录
 * - 时间线构建
 * - 消息时间戳管理
 */

import { useRef, useState, useCallback, useMemo } from "react";
import { BaseEvent, compactEvents } from "@ag-ui/core";
import { buildTimelineItems } from "@/utils/timeline";

export type LogEntry = {
  id: string;
  timestamp: number;
  level: "info" | "warn" | "error";
  message: string;
  payload?: Record<string, unknown>;
};

export type ConnectionState = "idle" | "connecting" | "streaming" | "error";

export interface UseEventProcessorOptions {
  sessionMessages?: BaseEvent[];
}

export interface UseEventProcessorReturnValue {
  rawEvents: BaseEvent[];
  logEntries: LogEntry[];
  compactedEvents: BaseEvent[];
  timelineItems: ReturnType<typeof buildTimelineItems>;
  pendingConfirmations: number;
  messageTimestamps: Map<string, number>;
  filteredRawEvents: BaseEvent[];
  addLog: (level: LogEntry["level"], message: string, payload?: Record<string, unknown>) => void;
  reportMetric: (name: string, payload: Record<string, unknown>) => void;
  setRawEvents: React.Dispatch<React.SetStateAction<BaseEvent[]>>;
  setSelectedMessageId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useEventProcessor(
  options: UseEventProcessorOptions = {}
): UseEventProcessorReturnValue {
  const { sessionMessages = [] } = options;

  // 运行时指标追踪
  const metricsRef = useRef({
    runCount: 0,
    errorCount: 0,
    reconnectCount: 0,
    lastRunStartedAt: 0,
    lastRunMs: 0,
  });

  // 日志条目
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  // 原始事件流
  const [rawEvents, setRawEvents] = useState<BaseEvent[]>([]);

  // 选中的消息 ID（用于事件过滤）
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  // 添加日志
  const addLog = useCallback(
    (
      level: LogEntry["level"],
      message: string,
      payload?: Record<string, unknown>
    ) => {
      setLogEntries((prev) => {
        const next = [
          ...prev,
          {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            level,
            message,
            payload,
          },
        ];
        return next.slice(-200);
      });
    },
    []
  );

  // 报告指标
  const reportMetric = useCallback(
    (name: string, payload: Record<string, unknown>) => {
      if (process.env.NODE_ENV !== "production") {
        console.debug(`[metrics] ${name}`, payload);
      }
      addLog("info", name, payload);
    },
    [addLog]
  );

  // 构建消息时间戳映射
  const messageTimestamps = useMemo(() => {
    const timestampMap = new Map<string, number>();

    // 处理所有 TEXT_MESSAGE 事件以构建映射
    rawEvents.forEach((event) => {
      if (
        event.type === "text_message_start" ||
        event.type === "text_message_content" ||
        event.type === "text_message_end"
      ) {
        const messageId = "messageId" in event ? event.messageId : undefined;
        const timestamp = "timestamp" in event ? event.timestamp : undefined;

        if (messageId && timestamp !== undefined) {
          if (!timestampMap.has(messageId)) {
            timestampMap.set(messageId, timestamp);
          }
        }
      }
    });

    return timestampMap;
  }, [rawEvents]);

  // 根据选中的消息时间戳过滤事件
  const filteredRawEvents = useMemo(() => {
    if (!selectedMessageId) {
      return rawEvents;
    }

    const cutoffTimestamp = messageTimestamps.get(selectedMessageId);
    if (cutoffTimestamp === undefined) {
      return rawEvents;
    }

    return rawEvents.filter((event) => {
      const eventTimestamp = event.timestamp || 0;
      return eventTimestamp <= cutoffTimestamp;
    });
  }, [rawEvents, selectedMessageId, messageTimestamps]);

  // 压缩事件
  const compactedEvents = useMemo(
    () => compactEvents(filteredRawEvents),
    [filteredRawEvents]
  );

  // 构建时间线项目
  const timelineItems = useMemo(
    () => buildTimelineItems(compactedEvents),
    [compactedEvents]
  );

  // 待确认数量
  const pendingConfirmations = useMemo(() => {
    const pending = new Set<string>();
    rawEvents.forEach((event) => {
      if (
        event.type === "tool_call_start" &&
        "toolCallName" in event &&
        event.toolCallName === "ui.confirmation"
      ) {
        pending.add(event.toolCallId);
      }
      if (event.type === "tool_call_result") {
        pending.delete(event.toolCallId);
      }
    });
    return pending.size;
  }, [rawEvents]);

  return {
    rawEvents,
    logEntries,
    compactedEvents,
    timelineItems,
    pendingConfirmations,
    messageTimestamps,
    filteredRawEvents,
    addLog,
    reportMetric,
    setRawEvents,
    setSelectedMessageId,
  };
}
