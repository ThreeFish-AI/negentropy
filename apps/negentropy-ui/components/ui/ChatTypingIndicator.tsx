import { cn } from "@/lib/utils";

/**
 * Chat Typing Indicator —— Agent 等待响应时的三点 bounce 动画
 *
 * 双层接力策略：
 * - `inline` variant：嵌入 AssistantReplyBubble 内部，覆盖「气泡已挂载但 segments
 *   尚无可见内容」的窗口；保留旧 testid `agent-waiting-placeholder` 兼容既有测试。
 * - `standalone` variant：嵌入 ChatStream 列表底部，覆盖「请求已发出但 Assistant
 *   气泡尚未挂载」的网络真空期（实测 100–500ms）。
 *
 * a11y：role="status" + aria-live="polite" 让屏幕阅读器以非打断方式播报；
 * sr-only 文本提供语义兜底；motion-reduce:animate-none 响应 prefers-reduced-motion，
 * bounce 退化为静态三点（仍可感知 indicator 存在）。
 */
export type ChatTypingIndicatorVariant = "inline" | "standalone";

const TEST_IDS: Record<ChatTypingIndicatorVariant, string> = {
  inline: "agent-waiting-placeholder",
  standalone: "chat-pending-indicator",
};

export function ChatTypingIndicator({
  variant = "inline",
  ariaLabel = "Agent 正在响应",
  className,
}: {
  variant?: ChatTypingIndicatorVariant;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      data-testid={TEST_IDS[variant]}
      className={cn(
        "flex items-center gap-1.5 py-1 text-text-muted",
        variant === "standalone" && "px-1",
        className,
      )}
    >
      <span className="sr-only">{ariaLabel}</span>
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s] motion-reduce:animate-none" />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s] motion-reduce:animate-none" />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current motion-reduce:animate-none" />
    </div>
  );
}
