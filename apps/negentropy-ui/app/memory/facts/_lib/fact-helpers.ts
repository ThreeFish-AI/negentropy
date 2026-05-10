/**
 * Facts 页面工具函数
 *
 * 纯函数模块，提供置信度颜色映射、有效期标签、日期格式化等。
 * 复用 knowledge/base/page.tsx 中 formatDateTime 的模式。
 */

// ============================================================================
// Confidence
// ============================================================================

export type ConfidenceLevel = "high" | "medium" | "low";

const CONFIDENCE_THRESHOLDS = { high: 0.8, medium: 0.5 } as const;

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  const c = Number.isFinite(confidence) ? confidence : 0;
  if (c >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (c >= CONFIDENCE_THRESHOLDS.medium) return "medium";
  return "low";
}

const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-500",
  low: "bg-rose-500",
};

export function formatConfidenceColor(confidence: number): string {
  return CONFIDENCE_COLORS[getConfidenceLevel(confidence)];
}

// ============================================================================
// Date Formatting
// ============================================================================

const shortDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
});

export function formatShortDate(value?: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return shortDateFormatter.format(date);
}

// ============================================================================
// Validity Label
// ============================================================================

const DAY_MS = 86_400_000;

interface ValidityInput {
  valid_from?: string;
  valid_until?: string;
}

export function formatValidityLabel(fact: ValidityInput): string | null {
  const from = fact.valid_from ? new Date(fact.valid_from) : null;
  const until = fact.valid_until ? new Date(fact.valid_until) : null;
  const fromValid = from && !Number.isNaN(from.getTime()) ? from : null;
  const untilValid = until && !Number.isNaN(until.getTime()) ? until : null;

  if (!fromValid && !untilValid) return null;

  const now = Date.now();

  if (untilValid) {
    const diffMs = untilValid.getTime() - now;
    if (diffMs < 0) {
      const days = Math.ceil(Math.abs(diffMs) / DAY_MS);
      return `已过期 ${days} 天`;
    }
    const days = Math.ceil(diffMs / DAY_MS);
    if (days <= 30) return `有效期剩 ${days} 天`;
    return `有效期至 ${formatShortDate(fact.valid_until!)}`;
  }

  if (fromValid) {
    return `自 ${formatShortDate(fact.valid_from!)} 起`;
  }

  return null;
}

export function isExpired(fact: ValidityInput): boolean {
  if (!fact.valid_until) return false;
  const until = new Date(fact.valid_until);
  if (Number.isNaN(until.getTime())) return false;
  return until.getTime() < Date.now();
}
