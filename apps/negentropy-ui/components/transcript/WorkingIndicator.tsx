"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** 把 epoch 毫秒差格式化为 "45s" / "1m 23s"（对齐 Conductor typing 计时）。 */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

/**
 * 运行态指示器 —— Conductor「Working… / Planning…」态的纯 CSS 等价物（规避 dotlottie-web WASM）。
 *
 * 三个点经 ``animate-working-pulse`` + 错相位 ``animationDelay`` 形成波动脉冲，尾随一行状态文案。
 * 仅在 ``live`` 在途态渲染于转录流末尾，示意「机器仍在工作」。``startedAtMs`` 提供时追加等宽耗时
 * 计时（"1m 23s"，每秒自更新），让长耗时回合有进度感知（对齐 Conductor）。已尊重 prefers-reduced-motion。
 */
export function WorkingIndicator({
  label = "Working…",
  startedAtMs,
  className,
}: {
  label?: string;
  startedAtMs?: number;
  className?: string;
}) {
  // 复用 ``ClockProvider`` 同范式：state 持 ``now``，effect 内经 ``tick()`` 间接刷新——规避
  // render 内调 ``Date.now``（purity）与 effect 内同步 setState（set-state-in-effect）。
  // 仅在需要计时时起 1Hz interval；``now`` 为纯 state，render 内 ``now - startedAtMs`` 安全。
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (startedAtMs === undefined) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAtMs]);
  const elapsed = startedAtMs !== undefined ? formatElapsed(now - startedAtMs) : null;

  return (
    <div
      className={cn("flex items-center gap-2 py-1 text-caption text-text-secondary", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
      data-testid="working-indicator"
    >
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500 [animation:var(--animate-working-pulse)]"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </span>
      <span className="font-medium">{label}</span>
      {elapsed ? (
        <span className="font-mono tabular-nums text-text-muted" aria-hidden>
          {elapsed}
        </span>
      ) : null}
    </div>
  );
}
