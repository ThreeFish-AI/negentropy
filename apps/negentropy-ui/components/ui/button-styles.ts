import { cn } from "@/lib/utils";

type OutlineButtonTone = "neutral" | "danger";

const outlineButtonBaseClassName =
  "border bg-background transition-colors transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

const outlineButtonToneClassNames: Record<OutlineButtonTone, string> = {
  neutral:
    "border-border text-text-secondary hover:border-foreground/20 hover:bg-muted hover:text-foreground focus-visible:ring-foreground/20",
  danger:
    "border-destructive/40 text-destructive hover:border-destructive/60 hover:bg-destructive/10 focus-visible:ring-destructive/30",
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
