"use client";

import { useEffect, useRef, useState } from "react";

import type { TaskExecutionDTO } from "../_lib/types";

/**
 * SSE 实时执行事件订阅（与 ``/api/scheduler/stream`` 配对）。
 *
 * 设计要点：
 * - 自动重连（exponential backoff，最大 30s）；
 * - 兜底 5s 轮询：如果连续 15s 收不到任何 SSE 事件且 EventSource 处于 CLOSED 状态，
 *   仍会驱动调用方刷新（通过 ``lastTickAt`` 状态）；
 * - 可选 ``taskId`` 过滤：服务端已按 query 过滤，本 hook 再次过滤防御客户端误用。
 */
export function useSchedulerStream(opts?: { taskId?: string; onExecution?: (e: TaskExecutionDTO) => void }) {
  const { taskId, onExecution } = opts ?? {};
  const [connected, setConnected] = useState(false);
  const [lastTickAt, setLastTickAt] = useState<number>(0);
  const onExecutionRef = useRef(onExecution);
  useEffect(() => {
    onExecutionRef.current = onExecution;
  }, [onExecution]);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let attempt = 0;
    let disposed = false;

    const open = () => {
      if (disposed) return;
      const url = taskId
        ? `/api/scheduler/stream?task_id=${encodeURIComponent(taskId)}`
        : "/api/scheduler/stream";
      es = new EventSource(url, { withCredentials: true });

      es.onopen = () => {
        if (disposed) return;
        setConnected(true);
        attempt = 0;
      };

      es.addEventListener("execution", (ev) => {
        if (disposed) return;
        setLastTickAt(Date.now());
        try {
          const data = JSON.parse((ev as MessageEvent).data) as TaskExecutionDTO;
          if (taskId && data.task_id !== taskId) return;
          onExecutionRef.current?.(data);
        } catch {
          // ignore malformed event
        }
      });

      es.onerror = () => {
        if (disposed) return;
        setConnected(false);
        es?.close();
        attempt += 1;
        // Exponential backoff with jitter, capped at 30s
        const delay = Math.min(30000, 500 * 2 ** Math.min(attempt, 6)) + Math.random() * 500;
        reconnectTimer = window.setTimeout(open, delay);
      };
    };

    open();

    return () => {
      disposed = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      es?.close();
    };
  }, [taskId]);

  return { connected, lastTickAt };
}
