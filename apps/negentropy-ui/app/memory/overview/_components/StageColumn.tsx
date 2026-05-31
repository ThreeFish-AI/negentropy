"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FeatureFlagChip, type FeatureFlagTone } from "../../_shared/FeatureFlagChip";

/**
 * Pipeline 单阶段列 —— 可点击 Card，跳转该阶段首要子页面。
 *
 * 三阶段配色经 accent 区分（Formation=blue / Evolution=amber / Retrieval=emerald），
 * 全部走 Tailwind token + dark: 变体，深色安全（不硬编码 hex，规避 Mermaid theme-frozen 问题）。
 */

export interface StageStat {
  label: string;
  value: string;
}

export interface StageFlag {
  label: string;
  tone: FeatureFlagTone;
  title?: string;
}

export type StageAccent = "formation" | "evolution" | "retrieval";

const ACCENT_STYLES: Record<
  StageAccent,
  { ring: string; badge: string; step: string; index: string }
> = {
  formation: {
    ring: "hover:border-blue-400/60 dark:hover:border-blue-500/50",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    step: "text-blue-600 dark:text-blue-400",
    index: "bg-blue-500",
  },
  evolution: {
    ring: "hover:border-amber-400/60 dark:hover:border-amber-500/50",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    step: "text-amber-600 dark:text-amber-400",
    index: "bg-amber-500",
  },
  retrieval: {
    ring: "hover:border-emerald-400/60 dark:hover:border-emerald-500/50",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    step: "text-emerald-600 dark:text-emerald-400",
    index: "bg-emerald-500",
  },
};

interface StageColumnProps {
  index: number;
  accent: StageAccent;
  title: string;
  subtitle: string;
  steps: string[];
  stats: StageStat[];
  flags: StageFlag[];
  href: string;
  hrefLabel: string;
}

export function StageColumn({
  index,
  accent,
  title,
  subtitle,
  steps,
  stats,
  flags,
  href,
  hrefLabel,
}: StageColumnProps) {
  const styles = ACCENT_STYLES[accent];

  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-1 flex-col rounded-2xl border border-border bg-card p-5 shadow-sm outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
        styles.ring,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-micro font-bold text-white",
            styles.index,
          )}
        >
          {index}
        </span>
        <h3 className="text-sm font-bold tracking-heading text-foreground">{title}</h3>
      </div>
      <p className="mt-1 text-caption leading-relaxed text-muted-foreground">{subtitle}</p>

      {/* Pipeline steps */}
      <ol className="mt-3 space-y-1.5">
        {steps.map((step, i) => (
          <li key={step} className="flex items-start gap-1.5 text-xs text-foreground">
            <span className={cn("mt-0.5 shrink-0 font-mono text-micro", styles.step)}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="leading-snug">{step}</span>
          </li>
        ))}
      </ol>

      {/* Live stats */}
      {stats.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
          {stats.map((stat) => (
            <span
              key={stat.label}
              className={cn(
                "inline-flex items-baseline gap-1 rounded-md px-2 py-0.5 text-micro font-medium",
                styles.badge,
              )}
            >
              <span className="tabular-nums">{stat.value}</span>
              <span className="opacity-70">{stat.label}</span>
            </span>
          ))}
        </div>
      )}

      {/* Feature flags */}
      {flags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {flags.map((flag) => (
            <FeatureFlagChip
              key={flag.label}
              label={flag.label}
              tone={flag.tone}
              title={flag.title}
            />
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="mt-auto pt-4">
        <span className="inline-flex items-center gap-1 text-caption font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
          {hrefLabel}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
