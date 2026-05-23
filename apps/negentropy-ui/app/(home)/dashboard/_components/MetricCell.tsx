"use client";

interface MetricCellProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "good" | "warn";
  loading?: boolean;
  href?: string;
}

const toneClass: Record<string, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  neutral: "text-foreground",
};

export function MetricCell({
  label,
  value,
  hint,
  tone = "neutral",
  loading,
  href,
}: MetricCellProps) {
  const cell = (
    <div
      className={`flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 ${
        href ? "transition-colors hover:bg-muted/70" : ""
      }`}
    >
      <span className="text-xs text-muted whitespace-nowrap">{label}</span>
      {loading ? (
        <span className="inline-block h-3.5 w-8 animate-pulse rounded bg-muted/60" />
      ) : (
        <span
          className={`text-sm font-semibold whitespace-nowrap ${
            toneClass[tone] ?? toneClass.neutral
          }`}
        >
          {value}
        </span>
      )}
      {hint && !loading ? (
        <span className="text-[10px] text-muted whitespace-nowrap">
          ({hint})
        </span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block cursor-pointer">
        {cell}
      </a>
    );
  }

  return cell;
}
