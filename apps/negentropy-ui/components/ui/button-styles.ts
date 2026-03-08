import { cn } from "@/lib/utils";

type OutlineButtonTone = "neutral" | "danger";

const outlineButtonBaseClassName =
  "border bg-background transition-colors transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

const outlineButtonToneClassNames: Record<OutlineButtonTone, string> = {
  neutral:
    "border-border text-text-secondary hover:border-foreground/20 hover:bg-muted hover:text-foreground focus-visible:ring-foreground/20",
  danger:
    "border-red-300 text-red-600 hover:border-red-400 hover:bg-red-50 hover:text-red-700 focus-visible:ring-red-200 dark:border-red-900/70 dark:text-red-400 dark:hover:border-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300 dark:focus-visible:ring-red-900/50",
};

export function outlineButtonClassName(
  tone: OutlineButtonTone = "neutral",
  className?: string,
) {
  return cn(
    outlineButtonBaseClassName,
    outlineButtonToneClassNames[tone],
    className,
  );
}
