"use client";

import { useEffect, useRef, useState } from "react";

import type { RoutineStreamEvent } from "../types";

/**
 * SSE 实时事件订阅（与 ``/api/routine/stream`` 配对）。
 *
 * 监听 ``routine`` 与 ``iteration`` 两类事件；自动重连（exponential backoff，最大 30s）。
 * 可选 ``routineId`` 过滤（服务端已过滤，客户端再防御一次）。
 */
export function useRoutineStream(opts?: {
  routineId?: string;
  onRoutineEvent?: (e: RoutineStreamEvent) => void;
  onIterationEvent?: (e: RoutineStreamEvent) => void;
  onActionEvent?: (e: RoutineStreamEvent) => void;
}) {
  const { routineId, onRoutineEvent, onIterationEvent, onActionEvent } = opts ?? {};
  const [connected, setConnected] = useState(false);

  const routineCbRef = useRef(onRoutineEvent);
  const iterationCbRef = useRef(onIterationEvent);
  const actionCbRef = useRef(onActionEvent);
  useEffect(() => {
    routineCbRef.current = onRoutineEvent;
    iterationCbRef.current = onIterationEvent;
    actionCbRef.current = onActionEvent;
  }, [onRoutineEvent, onIterationEvent, onActionEvent]);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let attempt = 0;
    let disposed = false;

    const parse = (ev: Event): RoutineStreamEvent | null => {
      try {
        return JSON.parse((ev as MessageEvent).data) as RoutineStreamEvent;
      } catch {
        return null;
      }
    };

    const open = () => {
      if (disposed) return;
      const url = routineId
        ? `/api/routine/stream?routine_id=${encodeURIComponent(routineId)}`
        : "/api/routine/stream";
      es = new EventSource(url, { withCredentials: true });

      es.onopen = () => {
        if (disposed) return;
        setConnected(true);
        attempt = 0;
      };

      es.addEventListener("routine", (ev) => {
        if (disposed) return;
        const data = parse(ev);
        if (data) routineCbRef.current?.(data);
      });

      es.addEventListener("iteration", (ev) => {
        if (disposed) return;
        const data = parse(ev);
        if (data) iterationCbRef.current?.(data);
      });

      es.addEventListener("action", (ev) => {
        if (disposed) return;
        const data = parse(ev);
        if (data) actionCbRef.current?.(data);
      });

      es.onerror = () => {
        if (disposed) return;
        setConnected(false);
        es?.close();
        attempt += 1;
        const delay = Math.min(30000, 500 * 2 ** Math.min(attempt, 6)) + Math.random() * 500;
        reconnectTimer = window.setTimeout(open, delay);
      };
    };

    open();

    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [routineId]);

  return { connected };
}
