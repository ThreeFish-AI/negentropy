"use client";

import { useEffect, useRef } from "react";

/**
 * useHeartbeatPoll — 统一的"心跳节拍轮询"前端约定（Phase 3-A）。
 *
 * 设计动机：散落的 ``setInterval`` 各自定义节奏（1s / 3s / 5s）、缺乏 visibility
 * 暂停与即停语义，导致：
 * 1. 后台标签页持续打 API（无谓流量 + 服务端压力）；
 * 2. 多页面节拍不齐，UI 节奏感不一致；
 * 3. 错误抑制不统一（callback throw 直接断链）。
 *
 * 本 hook 承担：
 * - 统一节拍：默认 5000ms（与后端心跳 ``NEGENTROPY_SCHEDULER_HEARTBEAT_SECONDS=5``
 *   对齐，让前端的"自然刷新节奏"与后端的"调度心跳节奏"在用户感知层面同步）；
 * - **enabled** gate：状态机解耦，避免父组件 useEffect 重复创建 / 销毁；
 * - **页面可见性暂停**：document.hidden 时暂停轮询，回前台立即触发一次刷新；
 * - **网络恢复触发**：navigator.onLine 从 false 转 true 时立即触发；
 * - **callback 错误隔离**：单次 callback 抛错不会停掉轮询，由调用方自行处理 UI。
 *
 * 设计取舍：
 * - 不内置 ``maxTicks``：bootstrap-style 探测窗口由调用方自行用 enabled + 计数关掉，
 *   保持本 hook 单一职责。
 * - 不绑定到具体 API：与 ``useSchedulerStream`` 互补——前者是 push（SSE），后者
 *   是 pull（heartbeat）；调度任务用前者，知识库异步任务用后者。
 *
 * 参考 [[useSchedulerStream]] 的连接生命周期写法（ref 防 stale 闭包）。
 */
export interface UseHeartbeatPollOptions {
  /** 默认 5000ms，与后端心跳对齐。设 0 立刻执行一次后即停。 */
  intervalMs?: number;
  /** false 时挂起所有定时与事件监听，hook 完全无副作用。 */
  enabled?: boolean;
  /** 挂载 / enabled 变 true / 回前台时是否立即触发一次。默认 true。 */
  fireImmediately?: boolean;
  /** 暂停时仍保留监听器，回前台触发一次刷新。默认 true。 */
  pauseWhenHidden?: boolean;
}

const DEFAULT_INTERVAL_MS = 5000;

export function useHeartbeatPoll(
  callback: () => void | Promise<void>,
  options: UseHeartbeatPollOptions = {},
): void {
  const {
    intervalMs = DEFAULT_INTERVAL_MS,
    enabled = true,
    fireImmediately = true,
    pauseWhenHidden = true,
  } = options;

  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let timerId: number | null = null;

    const run = () => {
      if (disposed) return;
      try {
        const ret = callbackRef.current();
        if (ret && typeof (ret as Promise<void>).catch === "function") {
          (ret as Promise<void>).catch(() => {
            // 错误隔离：调用方应在 callback 内通过 setError 显示，不影响轮询节拍。
          });
        }
      } catch {
        // 同步 throw 同样吞掉，保持节拍。
      }
    };

    const start = () => {
      if (timerId !== null) return;
      timerId = window.setInterval(run, intervalMs);
    };
    const stop = () => {
      if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
    };

    const handleVisibility = () => {
      if (!pauseWhenHidden) return;
      if (document.hidden) {
        stop();
      } else {
        // 回前台立即跑一次 + 重启节拍
        run();
        start();
      }
    };
    const handleOnline = () => {
      run();
    };

    if (fireImmediately) run();
    if (!(pauseWhenHidden && document.hidden)) {
      start();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    return () => {
      disposed = true;
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled, intervalMs, fireImmediately, pauseWhenHidden]);
}
