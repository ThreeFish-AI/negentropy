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
      className={`rounded-md bg-muted/40 px-2.5 py-1.5 ${
        href ? "transition-colors hover:bg-muted/70" : ""
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted leading-none">
        {label}
      </div>
      <div
        className={`text-base font-semibold leading-tight mt-0.5 ${
          toneClass[tone] ?? toneClass.neutral
        }`}
      >
        {loading ? (
          <span className="inline-block h-4 w-10 animate-pulse rounded bg-muted/60" />
        ) : (
          value
        )}
      </div>
      {hint && !loading ? (
        <div className="text-[10px] text-muted leading-none mt-0.5">
          {hint}
        </div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="cursor-pointer">
        {cell}
      </a>
    );
  }

  return cell;
}
