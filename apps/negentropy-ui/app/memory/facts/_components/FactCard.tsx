"use client";

import { JsonViewer } from "@/components/ui/JsonViewer";
import type { FactItem } from "@/features/memory";

import {
  formatConfidenceColor,
  formatShortDate,
  formatValidityLabel,
  getConfidenceLevel,
  isExpired,
} from "../_lib/fact-helpers";

// ============================================================================
// Sub-components
// ============================================================================

const FACT_TYPE_STYLES: Record<string, string> = {
  preference:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  profile:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  knowledge:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

function FactTypeBadge({ type }: { type: string }) {
  const style =
    FACT_TYPE_STYLES[type] ??
    "bg-muted text-text-secondary";
  return (
    <span
      className={`inline-flex shrink-0 items-center px-2 py-0.5 text-micro font-medium rounded-full ${style}`}
    >
      {type}
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const percent = Math.round(
    (Number.isFinite(confidence) ? confidence : 0) * 100,
  );
  const colorClass = formatConfidenceColor(confidence);
  const level = getConfidenceLevel(confidence);

  const levelLabel: Record<string, string> = {
    high: "高",
    medium: "中",
    low: "低",
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`置信度 ${percent}%`}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="shrink-0 text-micro font-mono text-text-muted tabular-nums">
        {percent}%
        <span className="ml-0.5 text-text-muted">
          {levelLabel[level]}
        </span>
      </span>
    </div>
  );
}

function TemporalBadge({ fact }: { fact: FactItem }) {
  const label = formatValidityLabel(fact);
  if (!label) return null;

  const expired = isExpired(fact);
  return (
    <span
      className={
        expired
          ? "text-rose-500 dark:text-rose-400"
          : "text-text-muted"
      }
    >
      {label}
    </span>
  );
}

// ============================================================================
// FactCard
// ============================================================================

interface FactCardProps {
  fact: FactItem;
  userLabel?: string;
  onShowHistory: (factId: string) => void;
}

export function FactCard({ fact, userLabel, onShowHistory }: FactCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <ConfidenceBar confidence={fact.confidence} />

      <div className="mt-3 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground leading-tight">
          {fact.key}
        </p>
        <FactTypeBadge type={fact.fact_type} />
      </div>

      <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3">
        <JsonViewer data={fact.value} />
      </div>

      <div className="mt-3 flex items-center justify-between text-caption text-text-muted">
        <div className="flex items-center gap-3">
          <TemporalBadge fact={fact} />
          {fact.created_at && (
            <span>{formatShortDate(fact.created_at)}</span>
          )}
          {userLabel && (
            <span className="truncate rounded-full border border-border px-1.5 py-px text-micro">
              {userLabel}
            </span>
          )}
        </div>
        <button
          className="text-text-muted underline hover:text-text-secondary"
          onClick={() => onShowHistory(fact.id)}
        >
          History
        </button>
      </div>
    </article>
  );
}
