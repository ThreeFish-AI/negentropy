/**
 * Agent 事件订阅 Hook
 *
 * 从 app/page.tsx HomeBody 组件提取的 Agent 事件订阅逻辑
 * 遵循 AGENTS.md 原则：模块化、复用驱动、单一职责
 *
 * 职责：
 * - Agent 事件流订阅管理
 * - 运行生命周期事件处理
 * - 指标追踪和性能监控
 * - 连接状态管理
 */

import { useEffect, useRef, useCallback } from "react";
import { BaseEvent } from "@ag-ui/core";
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
 * useAgentSubscription Hook 参数
 */
export interface UseAgentSubscriptionOptions {
  /** Agent 实例 */
  agent: AgentLike | null;
  /** 当前会话 ID */
  sessionId?: string | null;
  /** 原始事件回调 */
  onRawEvent?: (event: BaseEvent) => void;
  /** 连接状态变化回调 */
  onConnectionChange?: (state: ConnectionState) => void;
  /** 指标报告回调 */
  onMetricReport?: (name: string, payload: Record<string, unknown>) => void;
  /** 更新会话时间回调 */
  onUpdateSessionTime?: (sessionId: string) => void;
}

/**
 * useAgentSubscription Hook 返回值
 */
export interface UseAgentSubscriptionReturnValue {
  /** 运行指标引用 */
  metricsRef: ReturnType<typeof useRef<AgentMetrics>>;
  /** 设置连接状态的函数 */
  setConnectionWithMetrics: (state: ConnectionState) => void;
}

type AgentSubscriptionHandlers = {
  onRunInitialized?: () => void;
  onRunStartedEvent?: () => void;
  onRunFinishedEvent?: () => void;
  onRunErrorEvent?: () => void;
  onRunFailed?: () => void;
  onEvent?: (payload: { event: BaseEvent }) => void;
};

export type AgentSubscription = {
  unsubscribe: () => void;
};

export type AgentSubscriptionHandlersLike = AgentSubscriptionHandlers;

export type AgentLike = {
  subscribe: (handlers: AgentSubscriptionHandlers) => AgentSubscription;
};

/**
 * Agent 事件订阅 Hook
 *
 * 管理与 Agent 的订阅关系，处理各种运行时事件
 *
 * @param options - Hook 配置选项
 * @returns Hook 返回值
 */
export function useAgentSubscription(
  options: UseAgentSubscriptionOptions,
): UseAgentSubscriptionReturnValue {
  const {
    agent,
    sessionId,
    onRawEvent,
    onConnectionChange,
    onMetricReport,
    onUpdateSessionTime,
  } = options;

  const metricsRef = useRef<AgentMetrics>({
    runCount: 0,
    errorCount: 0,
    reconnectCount: 0,
    lastRunStartedAt: 0,
    lastRunMs: 0,
  });
  const previousConnectionRef = useRef<ConnectionState>("idle");

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

  // 设置连接状态并记录重连指标
  const setConnectionWithMetrics = useCallback(
    (next: ConnectionState) => {
      const prev = previousConnectionRef.current;
      if (prev === "error" && next === "connecting") {
        metricsRef.current.reconnectCount += 1;
        reportMetric("reconnect", {
          count: metricsRef.current.reconnectCount,
        });
      }
      previousConnectionRef.current = next;
      if (typeof onConnectionChange === "function") {
        onConnectionChange(next);
      }
    },
    [onConnectionChange, reportMetric],
  );

  // Agent 事件订阅
  useEffect(() => {
    if (!agent) {
      return;
    }
    const subscription = agent.subscribe({
      onRunInitialized: () => {
        if (typeof onConnectionChange === "function") {
          onConnectionChange("connecting");
        }
      },
      onRunStartedEvent: () => {
        metricsRef.current.runCount += 1;
        metricsRef.current.lastRunStartedAt = performance.now();
        reportMetric("run_started", {
          runCount: metricsRef.current.runCount,
        });
        if (typeof onConnectionChange === "function") {
          onConnectionChange("streaming");
        }
      },
      onRunFinishedEvent: () => {
        if (metricsRef.current.lastRunStartedAt) {
          metricsRef.current.lastRunMs =
            performance.now() - metricsRef.current.lastRunStartedAt;
          metricsRef.current.lastRunStartedAt = 0;
          reportMetric("run_finished", {
            lastRunMs: metricsRef.current.lastRunMs,
          });
        }
        if (typeof onConnectionChange === "function") {
          onConnectionChange("idle");
        }
        if (sessionId && typeof onUpdateSessionTime === "function") {
          onUpdateSessionTime(sessionId);
        }
      },
      onRunErrorEvent: () => {
        metricsRef.current.errorCount += 1;
        reportMetric("run_error", {
          errorCount: metricsRef.current.errorCount,
        });
        if (typeof onConnectionChange === "function") {
          onConnectionChange("error");
        }
      },
      onRunFailed: () => {
        metricsRef.current.errorCount += 1;
        reportMetric("run_failed", {
          errorCount: metricsRef.current.errorCount,
        });
        if (typeof onConnectionChange === "function") {
          onConnectionChange("error");
        }
      },
      onEvent: ({ event }: { event: BaseEvent }) => {
        if (typeof onRawEvent === "function") {
          onRawEvent(event);
        }
      },
    });

    return () => subscription.unsubscribe();
  }, [
    agent,
    onConnectionChange,
    onRawEvent,
    onUpdateSessionTime,
    sessionId,
    reportMetric,
  ]);

  return {
    metricsRef,
    setConnectionWithMetrics,
  };
}
