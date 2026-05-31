"use client";

/**
 * Feature Flag 芯片 —— Overview Pipeline 图与 Insights 健康面板共享。
 *
 * 三态语义（Visibility of system status）：
 * - active（green）：特性已开启并按配置运行
 * - off（gray）：特性关闭
 * - warn（amber）：已配置但运行态降级（如 pii_engine ≠ pii_engine_actual）
 * - unknown（slate dashed）：health 端点不可用，状态未知
 *
 * 复用 conflicts/page.tsx 的 inline pill 习惯（rounded-full border px-2 py-0.5 text-micro
 * + dark: 变体），token 驱动、深色安全。
 */

import { cn } from "@/lib/utils";

export type FeatureFlagTone = "active" | "off" | "warn" | "unknown";

const TONE_STYLES: Record<FeatureFlagTone, { dot: string; chip: string }> = {
  active: {
    dot: "bg-emerald-500",
    chip: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  off: {
    dot: "bg-slate-400",
    chip: "border-border bg-muted/40 text-muted-foreground",
  },
  warn: {
    dot: "bg-amber-500",
    chip: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  },
  unknown: {
    dot: "bg-slate-300 dark:bg-slate-600",
    chip: "border-dashed border-border bg-transparent text-muted-foreground",
  },
};

interface FeatureFlagChipProps {
  label: string;
  tone: FeatureFlagTone;
  /** 鼠标悬停说明（如降级原因 / 当前实际引擎）。 */
  title?: string;
  className?: string;
}

export function FeatureFlagChip({
  label,
  tone,
  title,
  className,
}: FeatureFlagChipProps) {
  const styles = TONE_STYLES[tone];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-micro font-medium",
        styles.chip,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", styles.dot)} />
      {label}
    </span>
  );
}

/** 把布尔 flag 归一为芯片三态：true→active, false→off。 */
export function boolTone(value: boolean | undefined): FeatureFlagTone {
  if (value === undefined) return "unknown";
  return value ? "active" : "off";
}
