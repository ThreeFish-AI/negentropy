"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * 单一时钟 —— 整视图共享一个 1Hz 心跳，供在途迭代渲染实时耗时。
 *
 * 设计动机（杜绝「重复定时器 / 重渲染风暴」失败模式）：
 * - **唯一 interval**：N 个在途卡片共用一个 ``setInterval``，而非各自持有。
 * - **可见性暂停**：``document.hidden`` 时停摆，回前台立即补一拍（对齐 [[useHeartbeatPoll]]）。
 * - **空转保护**：``active=false``（无任何在途）时根本不起定时器。
 *
 * 叶子组件用 [[ElapsedClock]] 订阅 ``now``，本地算 ``now - startedAt``；
 * 仅这些极小叶子随 tick 重渲，父层不读 ``now``。
 */

const ClockContext = createContext<number | null>(null);

export function ClockProvider({ active, children }: { active: boolean; children: ReactNode }) {
  // 无在途时回退到一次性快照（足够渲染静态时长），避免无谓 state。
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!active) return;

    let timerId: number | null = null;
    const tick = () => setNow(Date.now());

    const start = () => {
      if (timerId !== null) return;
      timerId = window.setInterval(tick, 1000);
    };
    const stop = () => {
      if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
    };
    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        tick(); // 回前台立即补一拍
        start();
      }
    };

    tick();
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [active]);

  return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>;
}

/**
 * 读取共享时钟。无 Provider 时回退为挂载时刻（静态），保证组件不崩。
 * 注意：回退值不会自动 tick —— 实时计时必须置于 ClockProvider 内。
 */
export function useClock(): number {
  const ctx = useContext(ClockContext);
  const [fallback] = useState(() => Date.now()); // 无条件调用，满足 rules-of-hooks
  return ctx ?? fallback;
}
