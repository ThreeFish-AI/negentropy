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
    "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  return (
    <span
      className={`inline-flex shrink-0 items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${style}`}
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
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
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
      <span className="shrink-0 text-[10px] font-mono text-zinc-500 tabular-nums dark:text-zinc-400">
        {percent}%
        <span className="ml-0.5 text-zinc-400 dark:text-zinc-500">
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
          : "text-zinc-400 dark:text-zinc-500"
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
  onShowHistory: (factId: string) => void;
}

export function FactCard({ fact, onShowHistory }: FactCardProps) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <ConfidenceBar confidence={fact.confidence} />

      <div className="mt-3 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
          {fact.key}
        </p>
        <FactTypeBadge type={fact.fact_type} />
      </div>

      <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
        <JsonViewer data={fact.value} />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
        <div className="flex items-center gap-3">
          <TemporalBadge fact={fact} />
          {fact.created_at && (
            <span>{formatShortDate(fact.created_at)}</span>
          )}
        </div>
        <button
          className="text-zinc-400 underline hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          onClick={() => onShowHistory(fact.id)}
        >
          History
        </button>
      </div>
    </article>
  );
}
