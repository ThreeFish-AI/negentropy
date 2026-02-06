/**
 * 连接状态管理 Hook
 *
 * 整合连接状态管理逻辑
 * 遵循 AGENTS.md 原则：模块化、复用驱动、单一职责
 */

import { useCallback, useRef } from "react";
import type { ConnectionState } from "@/types/common";

/**
 * Agent 运行指标
 */
export interface AgentMetrics {
  runCount: number;
  errorCount: number;
  reconnectCount: number;
  lastRunStartedAt: number;
  lastRunMs: number;
}

/**
 * useConnectionState Hook 参数
 */
export interface UseConnectionStateOptions {
  /** 初始连接状态 */
  initialConnection?: ConnectionState;
  /** 指标报告回调 */
  onMetricReport?: (name: string, payload: Record<string, unknown>) => void;
}

/**
 * useConnectionState Hook 返回值
 */
export interface UseConnectionStateReturnValue {
  /** 当前连接状态 */
  connection: ConnectionState;
  /** 设置连接状态（由调用方实现） */
  setConnection: () => void;
  /** 设置连接状态并追踪重连 */
  setConnectionWithMetrics: (next: ConnectionState, prev: ConnectionState) => void;
  /** Agent 运行指标引用 */
  metricsRef: React.MutableRefObject<AgentMetrics>;
  /** 报告指标 */
  reportMetric: (name: string, payload: Record<string, unknown>) => void;
  /** 重置指标 */
  resetMetrics: () => void;
}

/**
 * 连接状态管理 Hook
 *
 * 提供连接状态管理和 Agent 指标追踪功能
 *
 * @param options - Hook 配置选项
 * @returns Hook 返回值
 *
 * @example
 * ```ts
 * const { connection, setConnection, metricsRef, reportMetric } = useConnectionState({
 *   onMetricReport: (name, payload) => console.log(name, payload),
 * });
 * ```
 */
export function useConnectionState(
  options: UseConnectionStateOptions = {},
): UseConnectionStateReturnValue {
  const { initialConnection = "idle", onMetricReport } = options;

  // 注意：这里不使用 useState，而是返回 setConnection 函数
  // 让调用方控制状态存储方式，避免重复状态
  const setConnection = useCallback(() => {
    // 由调用方实现
  }, []);

  // 报告指标的函数
  const reportMetric = useCallback(
    (name: string, payload: Record<string, unknown>) => {
      if (process.env.NODE_ENV !== "production") {
        console.debug(`[metrics] ${name}`, payload);
      }
      if (typeof onMetricReport === "function") {
        onMetricReport(name, payload);
      }
    },
    [onMetricReport],
  );

  // 创建指标引用
  const metricsRef = useRef<AgentMetrics>({
    runCount: 0,
    errorCount: 0,
    reconnectCount: 0,
    lastRunStartedAt: 0,
    lastRunMs: 0,
  });

  // 重置指标
  const resetMetrics = useCallback(() => {
    // 不直接修改 ref，而是修改其属性
    metricsRef.current.runCount = 0;
    metricsRef.current.errorCount = 0;
    metricsRef.current.reconnectCount = 0;
    metricsRef.current.lastRunStartedAt = 0;
    metricsRef.current.lastRunMs = 0;
  }, []);

  // 设置连接状态并记录重连指标
  const setConnectionWithMetrics = useCallback(
    (next: ConnectionState, prev: ConnectionState) => {
      if (prev === "error" && next === "connecting") {
        metricsRef.current.reconnectCount += 1;
        reportMetric("reconnect", {
          count: metricsRef.current.reconnectCount,
        });
      }
      // 注意：setConnection 不接受参数，由调用方管理状态
      setConnection();
    },
    [setConnection, reportMetric],
  );

  return {
    connection: initialConnection,
    setConnection,
    setConnectionWithMetrics,
    metricsRef,
    reportMetric,
    resetMetrics,
  };
}
