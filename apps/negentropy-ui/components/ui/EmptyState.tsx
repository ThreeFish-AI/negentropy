import { type ComponentType, type ReactNode } from "react";
import { type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 统一空状态（Reuse-Driven）。
 *
 * 收敛各页手搓的「暂无数据 / 开始一段对话」空态：图标 + 标题 + 说明 + 可选主操作，
 * 居中留白、层级清晰（符合 MD `empty-states` 与 HIG 引导准则）。
 */
export interface EmptyStateProps {
  /** Lucide 图标组件（可选），置于顶部圆角容器中。 */
  icon?: ComponentType<LucideProps>;
  title: string;
  description?: ReactNode;
  /** 引导操作区（通常为一个 Button）。 */
  action?: ReactNode;
  /** 视觉强调：neutral=中性灰；accent=主强调色容器。默认 neutral。 */
  tone?: "neutral" | "accent";
  size?: "sm" | "md";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  size = "md",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "md" ? "gap-3 px-6 py-12" : "gap-2 px-4 py-8",
        className,
      )}
    >
      {Icon ? (
        <div
          className={cn(
            "flex items-center justify-center rounded-2xl",
            tone === "accent"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-text-muted",
            size === "md" ? "h-12 w-12" : "h-10 w-10",
          )}
        >
          <Icon className={size === "md" ? "h-6 w-6" : "h-5 w-5"} aria-hidden />
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-body-lg font-semibold tracking-default text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm leading-caption text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
