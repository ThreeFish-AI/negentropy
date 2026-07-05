"use client";

import { cn } from "@/lib/utils";

/**
 * 运行态指示器 —— Conductor「Working… / Planning…」态的纯 CSS 等价物（规避 dotlottie-web WASM）。
 *
 * 三个点经 ``animate-working-pulse`` + 错相位 ``animationDelay`` 形成波动脉冲，尾随一行状态文案。
 * 仅在 ``live`` 在途态渲染于转录流末尾，示意「机器仍在工作」。已尊重 prefers-reduced-motion（全局降级）。
 */
export function WorkingIndicator({ label = "Working…", className }: { label?: string; className?: string }) {
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
    </div>
  );
}
