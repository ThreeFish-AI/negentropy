/**
 * 日志缓冲 Hook
 *
 * 从 app/page.tsx 提取的日志管理逻辑
 * 遵循 AGENTS.md 原则：模块化、复用驱动、单一职责
 */

import { useCallback, useState } from "react";
import type { LogEntry } from "@/types/common";

/**
 * useLogBuffer Hook 参数
 */
export interface UseLogBufferOptions {
  /** 缓冲区大小限制 */
  bufferSize?: number;
}

/**
 * useLogBuffer Hook 返回值
 */
export interface UseLogBufferReturnValue {
  /** 日志条目列表 */
  logEntries: LogEntry[];
  /** 添加日志 */
  addLog: (level: LogEntry["level"], message: string, payload?: Record<string, unknown>) => void;
  /** 清空日志 */
  clearLogs: () => void;
  /** 过滤后的日志（用于历史视图） */
  getFilteredLogs: (cutoffTimestamp: number) => LogEntry[];
}

/**
 * 默认缓冲区大小
 */
const DEFAULT_BUFFER_SIZE = 200;

/**
 * 日志缓冲 Hook
 *
 * 管理日志条目的添加和缓冲
 *
 * @param options - Hook 配置选项
 * @returns Hook 返回值
 */
export function useLogBuffer(
  options: UseLogBufferOptions = {},
): UseLogBufferReturnValue {
  const { bufferSize = DEFAULT_BUFFER_SIZE } = options;
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  // 添加日志
  const addLog = useCallback(
    (
      level: LogEntry["level"],
      message: string,
      payload?: Record<string, unknown>,
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
        return next.slice(-bufferSize);
      });
    },
    [bufferSize],
  );

  // 清空日志
  const clearLogs = useCallback(() => {
    setLogEntries([]);
  }, []);

  // 根据时间戳过滤日志（用于历史视图）
  const getFilteredLogs = useCallback(
    (cutoffTimestamp: number) => {
      // LogEntry.timestamp 是毫秒（Date.now()），事件时间戳是秒
      // 将 cutoff 转换为毫秒进行比较
      const cutoffMs = cutoffTimestamp * 1000;

      return logEntries.filter((entry) => entry.timestamp <= cutoffMs);
    },
    [logEntries],
  );

  return {
    logEntries,
    addLog,
    clearLogs,
    getFilteredLogs,
  };
}
